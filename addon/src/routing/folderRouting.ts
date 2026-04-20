import type { MailFolder, MessageHeader, MessageId } from "../types/protocol";

const CANONICAL_INBOX_TARGET = "/Inbox";

export async function moveMessageToFolder(
  currentFolder: MailFolder,
  messageId: MessageId,
  targetFolderPath: string
): Promise<MailFolder> {
  const normalizedTargetFolderPath = normalizeTargetFolderPath(targetFolderPath);
  console.log("Preparing to move message", {
    messageId,
    currentFolderName: currentFolder.name,
    currentFolderPath: currentFolder.path,
    currentFolderAccountId: currentFolder.accountId,
    targetFolderPath: normalizedTargetFolderPath
  });

  if (currentFolder.accountId == null) {
    throw new Error("Current folder has no accountId, cannot resolve destination folder");
  }

  if (isAlreadyInTargetFolder(currentFolder, normalizedTargetFolderPath)) {
    console.log("Skipping move because message is already in target folder", {
      messageId,
      currentFolderName: currentFolder.name,
      currentFolderPath: currentFolder.path,
      targetFolderPath: normalizedTargetFolderPath
    });
    return currentFolder;
  }

  const folders = await messenger.folders.query({ accountId: currentFolder.accountId });
  const destinationFolder = findDestinationFolder(folders, normalizedTargetFolderPath);
  if (destinationFolder == null) {
    console.error("Destination folder could not be resolved", {
      messageId,
      currentFolderName: currentFolder.name,
      currentFolderPath: currentFolder.path,
      currentFolderAccountId: currentFolder.accountId,
      targetFolderPath: normalizedTargetFolderPath,
      knownFolderPaths: folders.map((folder) => folder.path).sort()
    });
    throw new Error(`Could not find destination folder '${normalizedTargetFolderPath}' in account ${currentFolder.accountId}`);
  }

  console.log("Resolved destination folder", {
    messageId,
    targetFolderPath: normalizedTargetFolderPath,
    destinationFolderId: destinationFolder.id,
    destinationFolderName: destinationFolder.name,
    destinationFolderPath: destinationFolder.path,
    destinationFolderSpecialUse: destinationFolder.specialUse
  });
  await messenger.messages.move([messageId], destinationFolder.id);
  console.log("Move request finished", {
    messageId,
    targetFolderPath: normalizedTargetFolderPath,
    destinationFolderId: destinationFolder.id
  });
  return destinationFolder;
}

export async function resolveMessageIdInFolder(message: MessageHeader): Promise<MessageId> {
  if (message.folder?.id == null || message.headerMessageId == null) {
    return message.id;
  }

  const queryResult = await messenger.messages.query({
    folderId: message.folder.id,
    headerMessageId: message.headerMessageId
  });

  const reloadedMessage = queryResult.messages[0];
  if (reloadedMessage == null) {
    console.log("Could not re-resolve moved message by headerMessageId, using event message id", {
      messageId: message.id,
      folderId: message.folder.id,
      headerMessageId: message.headerMessageId
    });
    return message.id;
  }

  console.log("Re-resolved moved message in current folder", {
    originalMessageId: message.id,
    resolvedMessageId: reloadedMessage.id,
    folderId: message.folder.id,
    headerMessageId: message.headerMessageId
  });
  return reloadedMessage.id;
}

export async function findMessageInFolderByHeaderMessageId(
  folderId: string,
  headerMessageId: string
): Promise<MessageHeader | null> {
  const queryResult = await messenger.messages.query({
    folderId,
    headerMessageId
  });

  return queryResult.messages[0] ?? null;
}

export async function findMessageInAccountByHeaderMessageId(
  accountId: string,
  headerMessageId: string
): Promise<MessageHeader | null> {
  const queryResult = await messenger.messages.query({
    accountId,
    headerMessageId
  });

  return queryResult.messages[0] ?? null;
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function findDestinationFolder(folders: MailFolder[], targetFolderPath: string): MailFolder | null {
  if (targetFolderPath === CANONICAL_INBOX_TARGET) {
    const inboxFolder = folders.find((folder) => folder.specialUse?.includes("inbox"));
    if (inboxFolder != null) {
      return inboxFolder;
    }
  }

  return folders.find((folder) => folder.path === targetFolderPath) ?? null;
}

function isAlreadyInTargetFolder(folder: MailFolder, targetFolderPath: string): boolean {
  if (targetFolderPath === CANONICAL_INBOX_TARGET && folder.specialUse?.includes("inbox")) {
    return true;
  }

  return folder.path === targetFolderPath;
}

function normalizeTargetFolderPath(targetFolderPath: string): string {
  const trimmedTargetFolderPath = targetFolderPath.trim();
  if (trimmedTargetFolderPath.length === 0) {
    throw new Error("Target folder path must not be blank");
  }

  return trimmedTargetFolderPath.startsWith("/") ? trimmedTargetFolderPath : `/${trimmedTargetFolderPath}`;
}
