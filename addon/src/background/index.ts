import { createNativeClient } from "../messaging/nativeClient";
import { moveMessageToFolder } from "../routing/folderRouting";
import type {
  ClassificationRequest,
  ClassificationResponse,
  LearnRuleRequest,
  LearningMode,
  MailFolder,
  MessageQueryInfo,
  MessageHeader,
  MessageList
} from "../types/protocol";

const nativeClient = createNativeClient("mailprocessor.host");
const TARGET_ACCOUNT_EMAIL = "thomas.maurer@ierax.ch";
const REPROCESS_FOLDER_NAME = "_Reprocess";
const USE_ADDRESS_FOLDER_NAME = "_UseAddress";
const USE_DOMAIN_FOLDER_NAME = "_UseDomain";
const NEWSLETTER_HIGH_FOLDER_NAME = "_Newsletter_high";
const NEWSLETTER_LOW_FOLDER_NAME = "_Newsletter_low";
const INBOX_TARGET_FOLDER = "/Inbox";
const NEWSLETTER_TARGET_FOLDER = "/Newsletter";
const NEWSLETTER_LOW_TARGET_FOLDER = "/Newsletter/Unwichtig";
const STAGING_SWEEP_ALARM_NAME = "process-staging-folders";
const STAGING_SWEEP_PERIOD_MINUTES = 1;

let requestCounter = 0;
let stagingSweepInProgress = false;
let targetAccountId: string | null = null;
let resolvingTargetAccountId: Promise<string> | null = null;

function nextRequestId(): string {
  requestCounter += 1;
  return `request-${requestCounter}`;
}

function extractEmail(author: string): string {
  const match = author.match(/<([^>]+)>/);
  const rawAddress = match?.[1] ?? author;
  return rawAddress.trim().toLowerCase();
}

function createClassificationRequest(message: MessageHeader): ClassificationRequest {
  return {
    type: "classify-mail",
    requestId: nextRequestId(),
    from: extractEmail(message.author),
    subject: message.subject ?? ""
  };
}

function createLearnRuleRequest(message: MessageHeader, learningMode: LearningMode, targetFolder: string): LearnRuleRequest {
  return {
    type: "learn-rule",
    requestId: nextRequestId(),
    from: extractEmail(message.author),
    learningMode,
    targetFolder
  };
}

async function processMessage(folder: MailFolder, message: MessageHeader): Promise<void> {
  const response = await classifyMessage(folder, message, "new mail");
  await moveMessageToFolder(folder, message.id, response.targetFolder);
  console.log("New mail moved", {
    messageId: message.id,
    targetFolder: response.targetFolder
  });
}

async function classifyMessage(
  folder: MailFolder,
  message: MessageHeader,
  trigger: "new mail" | "reprocessing"
): Promise<ClassificationResponse> {
  const resolvedTargetAccountId = await ensureTargetAccountId();
  if (folder.accountId !== resolvedTargetAccountId) {
    throw new Error(`Cannot classify mail outside target account for trigger '${trigger}'`);
  }

  const request = createClassificationRequest(message);
  console.log("Classifying mail", {
    trigger,
    messageId: message.id,
    from: request.from,
    subject: request.subject,
    folderName: folder.name,
    folderPath: folder.path
  });

  const response = await nativeClient.classify(request);
  console.log("Classification result received", {
    trigger,
    messageId: message.id,
    from: request.from,
    targetFolder: response.targetFolder
  });
  return response;
}

async function processMessageList(folder: MailFolder, messages: MessageList): Promise<void> {
  let resolvedTargetAccountId: string;
  try {
    resolvedTargetAccountId = await ensureTargetAccountId();
  } catch (error) {
    console.error("Failed to resolve target account before processing new mail batch", {
      folderPath: folder.path,
      error: describeError(error)
    });
    return;
  }

  if (folder.accountId !== resolvedTargetAccountId) {
    return;
  }

  for (const message of messages.messages) {
    try {
      await processMessage(folder, message);
    } catch (error) {
      console.error("Failed to process message", { messageId: message.id, error: describeError(error) });
    }
  }
}

async function runStagingSweep(trigger: "alarm" | "manual" | "startup"): Promise<void> {
  if (stagingSweepInProgress) {
    console.log("Skipping staging sweep because another run is still active", { trigger });
    return;
  }

  let resolvedTargetAccountId: string;
  try {
    resolvedTargetAccountId = await ensureTargetAccountId();
  } catch (error) {
    console.error("Skipping staging sweep because target account could not be resolved", {
      trigger,
      error: describeError(error)
    });
    return;
  }

  stagingSweepInProgress = true;
  try {
    const folders = await messenger.folders.query({ accountId: resolvedTargetAccountId });
    await processStagingFolderByName(folders, USE_ADDRESS_FOLDER_NAME, trigger);
    await processStagingFolderByName(folders, USE_DOMAIN_FOLDER_NAME, trigger);
    await processStagingFolderByName(folders, NEWSLETTER_HIGH_FOLDER_NAME, trigger);
    await processStagingFolderByName(folders, NEWSLETTER_LOW_FOLDER_NAME, trigger);
    await processStagingFolderByName(folders, REPROCESS_FOLDER_NAME, trigger);
    await processInboxFolder(folders, trigger);
    console.log("Staging sweep completed", { trigger });
  } catch (error) {
    console.error("Staging sweep failed", {
      trigger,
      error: describeError(error)
    });
  } finally {
    stagingSweepInProgress = false;
  }
}

async function processInboxFolder(
  folders: MailFolder[],
  trigger: "alarm" | "manual" | "startup"
): Promise<void> {
  const inboxFolder = findInboxFolder(folders);
  if (inboxFolder == null) {
    console.warn("Inbox folder not found in target account", { trigger });
    return;
  }

  const messages = await loadAllMessages({ folderId: inboxFolder.id, unread: true });
  if (messages.length === 0) {
    return;
  }

  console.log("Processing unread inbox messages", {
    trigger,
    folderName: inboxFolder.name,
    folderPath: inboxFolder.path,
    messageCount: messages.length
  });

  for (const message of messages) {
    try {
      await processMessage(inboxFolder, message);
    } catch (error) {
      console.error("Failed to process unread inbox message", {
        trigger,
        folderPath: inboxFolder.path,
        messageId: message.id,
        from: extractEmail(message.author),
        subject: message.subject ?? "",
        error: describeError(error)
      });
    }
  }
}

async function processStagingFolderByName(
  folders: MailFolder[],
  folderName: string,
  trigger: "alarm" | "manual" | "startup"
): Promise<void> {
  const folder = folders.find((candidate) => candidate.name === folderName);
  if (folder == null) {
    console.log("Staging folder not found in target account", {
      trigger,
      folderName
    });
    return;
  }

  const messages = await loadAllMessagesInFolder(folder.id);
  if (messages.length === 0) {
    return;
  }

  console.log("Processing staging folder", {
    trigger,
    folderName: folder.name,
    folderPath: folder.path,
    messageCount: messages.length
  });

  for (const message of messages) {
    try {
      if (folder.name === REPROCESS_FOLDER_NAME) {
        await processReprocessMessage(folder, message, trigger);
        continue;
      }

      if (folder.name === USE_ADDRESS_FOLDER_NAME) {
        await processLearningMessage(folder, message, "use-address", INBOX_TARGET_FOLDER, trigger);
        continue;
      }

      if (folder.name === USE_DOMAIN_FOLDER_NAME) {
        await processLearningMessage(folder, message, "use-domain", INBOX_TARGET_FOLDER, trigger);
        continue;
      }

      if (folder.name === NEWSLETTER_HIGH_FOLDER_NAME) {
        await processLearningMessage(folder, message, "use-address", NEWSLETTER_TARGET_FOLDER, trigger);
        continue;
      }

      if (folder.name === NEWSLETTER_LOW_FOLDER_NAME) {
        await processLearningMessage(folder, message, "use-address", NEWSLETTER_LOW_TARGET_FOLDER, trigger);
      }
    } catch (error) {
      console.error("Failed to process staging message", {
        trigger,
        folderName: folder.name,
        folderPath: folder.path,
        messageId: message.id,
        from: extractEmail(message.author),
        subject: message.subject ?? "",
        error: describeError(error)
      });
    }
  }
}

async function processReprocessMessage(
  folder: MailFolder,
  message: MessageHeader,
  trigger: "alarm" | "manual" | "startup"
): Promise<void> {
  console.log("Reprocessing staged mail", {
    trigger,
    messageId: message.id,
    folderName: folder.name,
    from: extractEmail(message.author),
    subject: message.subject ?? ""
  });
  const response = await classifyMessage(folder, message, "reprocessing");
  await moveMessageToFolder(folder, message.id, response.targetFolder);
  console.log("Reprocessing move completed", {
    trigger,
    messageId: message.id,
    targetFolder: response.targetFolder
  });
}

async function processLearningMessage(
  folder: MailFolder,
  message: MessageHeader,
  learningMode: LearningMode,
  targetFolder: string,
  trigger: "alarm" | "manual" | "startup"
): Promise<void> {
  console.log("Learning staged mail", {
    trigger,
    messageId: message.id,
    folderName: folder.name,
    learningMode,
    targetFolder,
    from: extractEmail(message.author),
    subject: message.subject ?? ""
  });
  const response = await nativeClient.learn(createLearnRuleRequest(message, learningMode, targetFolder));
  await moveMessageToFolder(folder, message.id, response.targetFolder);
  console.log("Learning move completed", {
    trigger,
    messageId: message.id,
    learningMode,
    createdPattern: response.createdPattern,
    targetFolder: response.targetFolder
  });
}

async function loadAllMessages(queryInfo: MessageQueryInfo): Promise<MessageHeader[]> {
  let currentBatch = await messenger.messages.query(queryInfo);
  const messages = [...currentBatch.messages];

  while (currentBatch.id != null) {
    currentBatch = await messenger.messages.continueList(currentBatch.id);
    messages.push(...currentBatch.messages);
  }

  return messages;
}

async function loadAllMessagesInFolder(folderId: string): Promise<MessageHeader[]> {
  return loadAllMessages({ folderId });
}

function findInboxFolder(folders: MailFolder[]): MailFolder | null {
  return (
    folders.find((folder) => folder.specialUse?.includes("inbox")) ??
    folders.find((folder) => folder.path.toLocaleLowerCase() === "/inbox") ??
    folders.find((folder) => folder.name.toLocaleLowerCase() === "inbox") ??
    null
  );
}

function registerMailListener(): void {
  messenger.messages.onNewMailReceived.addListener((folder, messages) => {
    void processMessageList(folder, messages).catch((error) => {
      console.error("Failed to process new mail batch", {
        folder: folder.path,
        error: describeError(error)
      });
    });
  });
}

function registerManualSweepButton(): void {
  messenger.action.onClicked.addListener(() => {
    console.log("Manual sweep requested");
    void runStagingSweep("manual");
  });
}

function registerStagingSweepAlarm(): void {
  messenger.alarms.create(STAGING_SWEEP_ALARM_NAME, {
    periodInMinutes: STAGING_SWEEP_PERIOD_MINUTES
  });
  messenger.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== STAGING_SWEEP_ALARM_NAME) {
      return;
    }

    void runStagingSweep("alarm");
  });
}

async function resolveTargetAccountId(targetEmail: string): Promise<string> {
  const accounts = await messenger.accounts.list();
  const normalizedTargetEmail = targetEmail.trim().toLowerCase();
  const targetAccount = accounts.find((account) =>
    account.identities.some((identity) => identity.email.trim().toLowerCase() === normalizedTargetEmail)
  );

  if (targetAccount != null) {
    return targetAccount.id;
  }

  const defaultAccount = await messenger.accounts.getDefault();
  if (defaultAccount != null) {
    console.warn("Configured target account email not found, falling back to Thunderbird default account", {
      targetEmail,
      defaultAccountId: defaultAccount.id,
      knownIdentities: accounts.flatMap((account) => account.identities.map((identity) => identity.email))
    });
    return defaultAccount.id;
  }

  if (accounts.length === 1) {
    console.warn("Configured target account email not found, falling back to only available Thunderbird account", {
      targetEmail,
      fallbackAccountId: accounts[0].id,
      knownIdentities: accounts[0].identities.map((identity) => identity.email)
    });
    return accounts[0].id;
  }

  throw new Error(
    `Could not find Thunderbird account for ${targetEmail}. Known identities: ${accounts
      .flatMap((account) => account.identities.map((identity) => identity.email))
      .join(", ")}`
  );
}

async function ensureTargetAccountId(): Promise<string> {
  if (targetAccountId != null) {
    return targetAccountId;
  }

  if (resolvingTargetAccountId != null) {
    return resolvingTargetAccountId;
  }

  resolvingTargetAccountId = (async () => {
    console.log("Resolving target account", { targetEmail: TARGET_ACCOUNT_EMAIL });
    const resolvedAccountId = await resolveTargetAccountId(TARGET_ACCOUNT_EMAIL);
    targetAccountId = resolvedAccountId;
    console.log("Resolved target account", {
      targetEmail: TARGET_ACCOUNT_EMAIL,
      accountId: resolvedAccountId
    });
    return resolvedAccountId;
  })();

  try {
    return await resolvingTargetAccountId;
  } finally {
    resolvingTargetAccountId = null;
  }
}

async function bootstrap(): Promise<void> {
  console.log("MailProcessor add-on loaded");
  registerMailListener();
  registerManualSweepButton();
  registerStagingSweepAlarm();

  void nativeClient.connect().catch((error) => {
    console.error("Initial native host connection failed", describeError(error));
  });
  void ensureTargetAccountId().catch((error) => {
    console.error("Initial target account resolution failed", describeError(error));
  });
  void runStagingSweep("startup");
  console.log(`Mail listener active for account ${TARGET_ACCOUNT_EMAIL}`);
}

void bootstrap().catch((error) => {
  console.error("Failed to bootstrap MailProcessor add-on", describeError(error));
});

function describeError(error: unknown): { message?: string; stack?: string; value: unknown } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      value: error
    };
  }

  return { value: error };
}
