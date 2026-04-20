import { createNativeClient } from "../messaging/nativeClient";
import {
  delay,
  findMessageInAccountByHeaderMessageId,
  findMessageInFolderByHeaderMessageId,
  moveMessageToFolder,
  resolveMessageIdInFolder
} from "../routing/folderRouting";
import type {
  ClassificationRequest,
  ClassificationResponse,
  LearnRuleRequest,
  LearningMode,
  MailFolder,
  MessageHeader,
  MessageList
} from "../types/protocol";

const nativeClient = createNativeClient("mailprocessor.host");
const TARGET_ACCOUNT_EMAIL = "thomas.maurer@ierax.ch";
const CANDIDATES_FOLDER_NAME = "_Candidates";
const REPROCESS_FOLDER_NAME = "_Reprocess";
const USE_ADDRESS_FOLDER_NAME = "_UseAddress";
const USE_DOMAIN_FOLDER_NAME = "_UseDomain";
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
  const response = await classifyMessage(folder, message, "new mail");
  await moveClassifiedMessageImmediately(folder, message, response, "new mail");
}

async function classifyMessage(
  folder: MailFolder,
  message: MessageHeader,
  trigger: "new mail" | "reprocessing"
): Promise<ClassificationResponse> {
  if (!isTargetAccountFolder(folder)) {
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

async function moveClassifiedMessageImmediately(
  folder: MailFolder,
  message: MessageHeader,
  response: ClassificationResponse,
  trigger: "new mail" | "reprocessing"
): Promise<void> {
  const messageIdToMove = message.id;
  console.log("Starting immediate move after classification", {
    trigger,
    originalMessageId: message.id,
    messageIdToMove,
    targetFolder: response.targetFolder
  });
  await moveMessageToFolder(folder, messageIdToMove, response.targetFolder);
  console.log("Mail move completed", {
    trigger,
    originalMessageId: message.id,
    messageIdToMove,
    targetFolder: response.targetFolder
  });
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

    if (isReprocessingMove(movedMessage.folder)) {
      try {
        console.log("Reprocessing moved mail", {
          movedMessageId: movedMessage.id,
          fromFolderName: originalMessage.folder.name,
          toFolderName: movedMessage.folder.name,
          from: extractEmail(movedMessage.author),
          subject: movedMessage.subject ?? ""
        });
        const response = await classifyMessage(movedMessage.folder, movedMessage, "reprocessing");
        const result = await moveMessageToTargetAfterStabilization(movedMessage, response.targetFolder, "reprocessing");
        console.log("Reprocessing completed", {
          movedMessageId: movedMessage.id,
          messageIdToMove: result.messageIdToMove,
          targetFolder: result.targetFolder,
          remainedInReprocess: result.targetFolder === movedMessage.folder.path
        });
      } catch (error) {
        console.error("Failed to reprocess moved mail", {
          messageId: movedMessage.id,
          fromFolderName: originalMessage.folder.name,
          fromFolderPath: originalMessage.folder.path,
          toFolderName: movedMessage.folder.name,
          toFolderPath: movedMessage.folder.path,
          from: extractEmail(movedMessage.author),
          subject: movedMessage.subject ?? "",
          error: describeError(error)
        });
      }
      continue;
    }

    const learningMode = resolveLearningMode(originalMessage.folder, movedMessage.folder);
    if (learningMode == null) {
      console.log("Moved mail does not match reprocessing or a learning transition", {
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
      const result = await moveMessageToTargetAfterStabilization(movedMessage, response.targetFolder, "learning");
      console.log("Learning move completed", {
        movedMessageId: movedMessage.id,
        createdPattern: response.createdPattern,
        messageIdToMove: result.messageIdToMove,
        targetFolder: result.targetFolder
      });
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

function isReprocessingMove(destinationFolder: MailFolder): boolean {
  return destinationFolder.name === REPROCESS_FOLDER_NAME;
}

function resolveLearningMode(originalFolder: MailFolder, destinationFolder: MailFolder): LearningMode | null {
  if (originalFolder.name !== CANDIDATES_FOLDER_NAME) {
    return null;
  }

  if (destinationFolder.name === USE_ADDRESS_FOLDER_NAME) {
    return "use-address";
  }

  if (destinationFolder.name === USE_DOMAIN_FOLDER_NAME) {
    return "use-domain";
  }

  return null;
}

async function moveMessageToTargetAfterStabilization(
  movedMessage: MessageHeader,
  targetFolder: string,
  operation: "learning" | "reprocessing"
): Promise<{ messageIdToMove: number; targetFolder: string }> {
  if (movedMessage.folder?.id == null) {
    throw new Error(`Moved message has no folder metadata for post-${operation} move`);
  }

  if (movedMessage.folder.accountId == null) {
    throw new Error(`Moved message has no accountId for post-${operation} move verification`);
  }

  if (movedMessage.folder.path === targetFolder) {
    console.log("Skipping follow-up move because message is already in target folder", {
      operation,
      movedMessageId: movedMessage.id,
      targetFolder
    });
    return {
      messageIdToMove: movedMessage.id,
      targetFolder
    };
  }

  if (movedMessage.headerMessageId == null) {
    await delay(1200);
    const destinationFolder = await moveMessageOnceAfterStabilization(movedMessage, targetFolder, operation, 1);
    return {
      messageIdToMove: movedMessage.id,
      targetFolder: destinationFolder.path
    };
  }

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const currentLocation = await findMessageInAccountByHeaderMessageId(
      movedMessage.folder.accountId,
      movedMessage.headerMessageId
    );

    console.log("Waiting for message to stabilize before follow-up move", {
      operation,
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

      console.log("Starting delayed follow-up move", {
        operation,
        movedMessageId: movedMessage.id,
        currentFolderName: currentLocation.folder.name,
        currentFolderPath: currentLocation.folder.path,
        targetFolder,
        attempt
      });
      const destinationFolder = await moveMessageOnceAfterStabilization(currentLocation, targetFolder, operation, attempt);
      await verifyMessageReachedTarget(currentLocation, destinationFolder, targetFolder, operation, attempt);
      return {
        messageIdToMove: currentLocation.id,
        targetFolder: destinationFolder.path
      };
    }

    if (currentLocation?.folder != null) {
      console.log("Message is no longer in staging folder, skipping follow-up move", {
        operation,
        movedMessageId: movedMessage.id,
        currentFolderName: currentLocation.folder.name,
        currentFolderPath: currentLocation.folder.path,
        targetFolder,
        attempt
      });
      return {
        messageIdToMove: currentLocation.id,
        targetFolder: currentLocation.folder.path
      };
    }

    await delay(500);
  }

  throw new Error(`Message ${movedMessage.id} could not be located in the account after ${operation}`);
}

async function moveMessageOnceAfterStabilization(
  movedMessage: MessageHeader,
  targetFolder: string,
  operation: "learning" | "reprocessing",
  attempt: number
): Promise<MailFolder> {
  const resolvedMessageId = await resolveMessageIdInFolder(movedMessage);
  console.log("Moving stabilized message to target folder", {
    operation,
    movedMessageId: movedMessage.id,
    resolvedMessageId,
    targetFolder,
    attempt
  });
  return moveMessageToFolder(movedMessage.folder as MailFolder, resolvedMessageId, targetFolder);
}

async function verifyMessageReachedTarget(
  movedMessage: MessageHeader,
  destinationFolder: MailFolder,
  targetFolder: string,
  operation: "learning" | "reprocessing",
  attempt: number
): Promise<void> {
  if (movedMessage.headerMessageId == null) {
    return;
  }

  for (let verificationAttempt = 1; verificationAttempt <= 6; verificationAttempt += 1) {
    await delay(500);

    const stillInStagingFolder = await findMessageInFolderByHeaderMessageId(movedMessage.folder!.id, movedMessage.headerMessageId);
    const foundInDestinationFolder = await findMessageInFolderByHeaderMessageId(destinationFolder.id, movedMessage.headerMessageId);
    const foundInAccount = await findMessageInAccountByHeaderMessageId(
      movedMessage.folder!.accountId!,
      movedMessage.headerMessageId
    );

    if (stillInStagingFolder == null && foundInDestinationFolder != null) {
      console.log("Follow-up move verified", {
        operation,
        movedMessageId: movedMessage.id,
        destinationFolderName: destinationFolder.name,
        destinationFolderPath: destinationFolder.path,
        targetFolder,
        attempt,
        verificationAttempt
      });
      return;
    }

    if (stillInStagingFolder == null && foundInAccount != null) {
      console.log("Follow-up move verified outside destination folder query", {
        operation,
        movedMessageId: movedMessage.id,
        foundFolderName: foundInAccount.folder?.name,
        foundFolderPath: foundInAccount.folder?.path,
        targetFolder,
        attempt,
        verificationAttempt
      });
      return;
    }

    console.log("Waiting for follow-up move to become visible", {
      operation,
      movedMessageId: movedMessage.id,
      stillInStagingFolder: stillInStagingFolder != null,
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

  throw new Error(`Message ${movedMessage.id} left the staging folder but could not be located after ${operation} follow-up move`);
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
