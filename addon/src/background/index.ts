import { createNativeClient } from "../messaging/nativeClient";
import {
  delay,
  findMessageInAccountByHeaderMessageId,
  findMessageInFolderByHeaderMessageId,
  moveMessageToFolder,
  resolveMessageIdInFolder
} from "../routing/folderRouting";
import type { ClassificationRequest, LearnRuleRequest, LearningMode, MailFolder, MessageHeader, MessageList } from "../types/protocol";

const nativeClient = createNativeClient("mailprocessor.host");
const TARGET_ACCOUNT_EMAIL = "thomas.maurer@ierax.ch";
const CANDIDATES_FOLDER = "_Candidates";
const USE_ADDRESS_FOLDER = "_UseAddress";
const USE_DOMAIN_FOLDER = "_UseDomain";
let requestCounter = 0;
let targetAccountId: string | null = null;

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

function createLearnRuleRequest(message: MessageHeader, learningMode: LearningMode): LearnRuleRequest {
  return {
    type: "learn-rule",
    requestId: nextRequestId(),
    from: extractEmail(message.author),
    learningMode
  };
}

async function processMessage(folder: MailFolder, message: MessageHeader): Promise<void> {
  if (!isTargetAccountFolder(folder)) {
    console.log("Skipping new mail outside target account", {
      folderName: folder.name,
      folderPath: folder.path,
      accountId: folder.accountId
    });
    return;
  }

  const request = createClassificationRequest(message);
  console.log("Classifying new mail", {
    messageId: message.id,
    from: request.from,
    subject: request.subject,
    folderName: folder.name,
    folderPath: folder.path
  });
  const response = await nativeClient.classify(request);
  console.log("Classification result received", {
    messageId: message.id,
    from: request.from,
    targetFolder: response.targetFolder
  });
  await moveMessageToFolder(folder, message.id, response.targetFolder);
}

async function processMessageList(folder: MailFolder, messages: MessageList): Promise<void> {
  for (const message of messages.messages) {
    try {
      await processMessage(folder, message);
    } catch (error) {
      console.error("Failed to process message", { messageId: message.id, error });
    }
  }
}

async function processMovedMessages(originalMessages: MessageList, movedMessages: MessageList): Promise<void> {
  console.log("messages.onMoved received", {
    originalCount: originalMessages.messages.length,
    movedCount: movedMessages.messages.length
  });

  const originalsByHeaderId = new Map(
    originalMessages.messages
      .filter((message): message is MessageHeader & { headerMessageId: string } => typeof message.headerMessageId === "string")
      .map((message) => [message.headerMessageId, message] as const)
  );

  for (let index = 0; index < movedMessages.messages.length; index += 1) {
    const movedMessage = movedMessages.messages[index];
    const originalMessage =
      (typeof movedMessage.headerMessageId === "string" ? originalsByHeaderId.get(movedMessage.headerMessageId) : undefined) ??
      originalMessages.messages[index];

    if (originalMessage == null || originalMessage.folder == null || movedMessage.folder == null) {
      console.log("Skipping moved mail due to missing folder metadata", {
        movedMessageId: movedMessage.id,
        originalMessageId: originalMessage?.id,
        originalFolder: originalMessage?.folder,
        movedFolder: movedMessage.folder
      });
      continue;
    }

    if (!isTargetAccountFolder(movedMessage.folder)) {
      console.log("Skipping moved mail outside target account", {
        movedMessageId: movedMessage.id,
        folderName: movedMessage.folder.name,
        folderPath: movedMessage.folder.path,
        accountId: movedMessage.folder.accountId
      });
      continue;
    }

    console.log("Evaluating moved mail for learning", {
      movedMessageId: movedMessage.id,
      fromFolderName: originalMessage.folder.name,
      fromFolderPath: originalMessage.folder.path,
      toFolderName: movedMessage.folder.name,
      toFolderPath: movedMessage.folder.path
    });

    const learningMode = resolveLearningMode(originalMessage.folder, movedMessage.folder);
    if (learningMode == null) {
      console.log("Moved mail does not match a learning transition", {
        movedMessageId: movedMessage.id,
        fromFolderName: originalMessage.folder.name,
        toFolderName: movedMessage.folder.name
      });
      continue;
    }

    try {
      console.log("Learning routing rule", {
        movedMessageId: movedMessage.id,
        learningMode,
        from: extractEmail(movedMessage.author)
      });
      const response = await nativeClient.learn(createLearnRuleRequest(movedMessage, learningMode));
      await moveLearnedMessageToTarget(movedMessage, response.targetFolder, response.createdPattern);
    } catch (error) {
      console.error("Failed to learn routing rule", {
        messageId: movedMessage.id,
        learningMode,
        error: describeError(error)
      });
    }
  }
}

function registerMailListener(): void {
  messenger.messages.onNewMailReceived.addListener((folder, messages) => {
    void processMessageList(folder, messages).catch((error) => {
      console.error("Failed to process new mail batch", {
        folder: folder.path,
        error
      });
    });
  });
}

function registerLearningListener(): void {
  console.log("Registering learning listener");
  messenger.messages.onMoved.addListener((originalMessages, movedMessages) => {
    void processMovedMessages(originalMessages, movedMessages).catch((error) => {
      console.error("Failed to process moved mail batch", error);
    });
  });
}

async function resolveTargetAccountId(targetEmail: string): Promise<string> {
  const accounts = await messenger.accounts.list();
  const targetAccount = accounts.find((account) =>
    account.identities.some((identity) => identity.email.toLowerCase() === targetEmail)
  );

  if (targetAccount == null) {
    throw new Error(`Could not find Thunderbird account for ${targetEmail}`);
  }

  return targetAccount.id;
}

function isTargetAccountFolder(folder: MailFolder): boolean {
  return targetAccountId != null && folder.accountId === targetAccountId;
}

function resolveLearningMode(originalFolder: MailFolder, destinationFolder: MailFolder): LearningMode | null {
  if (originalFolder.name !== CANDIDATES_FOLDER) {
    return null;
  }

  if (destinationFolder.name === USE_ADDRESS_FOLDER) {
    return "use-address";
  }

  if (destinationFolder.name === USE_DOMAIN_FOLDER) {
    return "use-domain";
  }

  return null;
}

async function moveLearnedMessageToTarget(
  movedMessage: MessageHeader,
  targetFolder: string,
  createdPattern: string
): Promise<void> {
  if (movedMessage.folder?.id == null) {
    throw new Error("Moved message has no folder metadata for post-learning move");
  }

  if (movedMessage.folder.accountId == null) {
    throw new Error("Moved message has no accountId for post-learning move verification");
  }

  if (movedMessage.headerMessageId == null) {
    await delay(1200);
    await moveLearnedMessageOnce(movedMessage, targetFolder, createdPattern, 1);
    return;
  }

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const currentLocation = await findMessageInAccountByHeaderMessageId(
      movedMessage.folder.accountId,
      movedMessage.headerMessageId
    );

    console.log("Waiting for learned message to stabilize", {
      movedMessageId: movedMessage.id,
      currentFolderName: currentLocation?.folder?.name,
      currentFolderPath: currentLocation?.folder?.path,
      targetFolder,
      attempt
    });

    if (currentLocation?.folder?.id === movedMessage.folder.id) {
      if (attempt < 3) {
        await delay(1000);
        continue;
      }

      console.log("Starting delayed follow-up move for learned message", {
        movedMessageId: movedMessage.id,
        currentFolderName: currentLocation.folder.name,
        currentFolderPath: currentLocation.folder.path,
        targetFolder,
        attempt
      });
      const destinationFolder = await moveLearnedMessageOnce(currentLocation, targetFolder, createdPattern, attempt);
      await verifyMessageReachedTarget(currentLocation, destinationFolder, targetFolder, attempt);
      return;
    }

    if (currentLocation?.folder != null) {
      console.log("Learned message is not in learning folder anymore, skipping follow-up move", {
        movedMessageId: movedMessage.id,
        currentFolderName: currentLocation.folder.name,
        currentFolderPath: currentLocation.folder.path,
        targetFolder,
        attempt
      });
      return;
    }

    await delay(500);
  }

  throw new Error(`Message ${movedMessage.id} could not be located in the account after learning`);
}

async function moveLearnedMessageOnce(
  movedMessage: MessageHeader,
  targetFolder: string,
  createdPattern: string,
  attempt: number
): Promise<MailFolder> {
  const resolvedMessageId = await resolveMessageIdInFolder(movedMessage);
  console.log("Learning completed, moving mail to target folder", {
    movedMessageId: movedMessage.id,
    resolvedMessageId,
    createdPattern,
    targetFolder,
    attempt
  });
  return moveMessageToFolder(movedMessage.folder as MailFolder, resolvedMessageId, targetFolder);
}

async function verifyMessageReachedTarget(
  movedMessage: MessageHeader,
  destinationFolder: MailFolder,
  targetFolder: string,
  attempt: number
): Promise<void> {
  if (movedMessage.headerMessageId == null) {
    return;
  }

  for (let verificationAttempt = 1; verificationAttempt <= 6; verificationAttempt += 1) {
    await delay(500);

    const stillInLearningFolder = await findMessageInFolderByHeaderMessageId(movedMessage.folder!.id, movedMessage.headerMessageId);
    const foundInDestinationFolder = await findMessageInFolderByHeaderMessageId(destinationFolder.id, movedMessage.headerMessageId);
    const foundInAccount = await findMessageInAccountByHeaderMessageId(
      movedMessage.folder!.accountId!,
      movedMessage.headerMessageId
    );

    if (stillInLearningFolder == null && foundInDestinationFolder != null) {
      console.log("Post-learning move verified", {
        movedMessageId: movedMessage.id,
        destinationFolderName: destinationFolder.name,
        destinationFolderPath: destinationFolder.path,
        targetFolder,
        attempt,
        verificationAttempt
      });
      return;
    }

    if (stillInLearningFolder == null && foundInAccount != null) {
      console.log("Post-learning move verified outside destination folder query", {
        movedMessageId: movedMessage.id,
        foundFolderName: foundInAccount.folder?.name,
        foundFolderPath: foundInAccount.folder?.path,
        targetFolder,
        attempt,
        verificationAttempt
      });
      return;
    }

    console.log("Waiting for post-learning move to become visible", {
      movedMessageId: movedMessage.id,
      stillInLearningFolder: stillInLearningFolder != null,
      foundInDestinationFolder: foundInDestinationFolder != null,
      foundInAccountFolderName: foundInAccount?.folder?.name,
      foundInAccountFolderPath: foundInAccount?.folder?.path,
      destinationFolderName: destinationFolder.name,
      destinationFolderPath: destinationFolder.path,
      targetFolder,
      attempt,
      verificationAttempt
    });
  }

  throw new Error(`Message ${movedMessage.id} left the learning folder but could not be located after follow-up move`);
}

async function bootstrap(): Promise<void> {
  console.log("MailProcessor add-on loaded");

  await nativeClient.connect();
  targetAccountId = await resolveTargetAccountId(TARGET_ACCOUNT_EMAIL);
  registerMailListener();
  registerLearningListener();
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
