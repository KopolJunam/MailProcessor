import type { MailFolder, MessageHeader, MessageId } from "../types/protocol";

const INBOX_TARGET = "Inbox";

export async function moveMessageToFolder(
  currentFolder: MailFolder,
  messageId: MessageId,
  targetFolderName: string
): Promise<MailFolder> {
  console.log("Preparing to move message", {
    messageId,
    currentFolderName: currentFolder.name,
    currentFolderPath: currentFolder.path,
    currentFolderAccountId: currentFolder.accountId,
    targetFolderName
  });

  if (currentFolder.accountId == null) {
    throw new Error("Current folder has no accountId, cannot resolve destination folder");
  }

  if (isAlreadyInTargetFolder(currentFolder, targetFolderName)) {
    console.log("Skipping move because message is already in target folder", {
      messageId,
      currentFolderName: currentFolder.name,
      currentFolderPath: currentFolder.path,
      targetFolderName
    });
    return currentFolder;
  }

  const destinationFolder = await findDestinationFolder(currentFolder.accountId, targetFolderName);
  if (destinationFolder == null) {
    throw new Error(`Could not find destination folder '${targetFolderName}' in account ${currentFolder.accountId}`);
  }

  console.log("Resolved destination folder", {
    messageId,
    targetFolderName,
    destinationFolderId: destinationFolder.id,
    destinationFolderName: destinationFolder.name,
    destinationFolderPath: destinationFolder.path,
    destinationFolderSpecialUse: destinationFolder.specialUse
  });
  await messenger.messages.move([messageId], destinationFolder.id);
  console.log("Move request finished", {
    messageId,
    targetFolderName,
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

async function findDestinationFolder(accountId: string, targetFolderName: string): Promise<MailFolder | null> {
  const folders = await messenger.folders.query({ accountId });
  if (targetFolderName === INBOX_TARGET) {
    const inboxFolder = folders.find((folder) => folder.specialUse?.includes("inbox"));
    if (inboxFolder != null) {
      return inboxFolder;
    }
  }

  const matchingFolders = folders.filter((folder) => folder.name === targetFolderName);

  if (matchingFolders.length === 0) {
    return null;
  }

  return (
    matchingFolders.find((folder) => folder.path === `/${targetFolderName}`) ??
    matchingFolders.sort((left, right) => left.path.length - right.path.length)[0]
  );
}

function isAlreadyInTargetFolder(folder: MailFolder, targetFolderName: string): boolean {
  if (targetFolderName === INBOX_TARGET && folder.specialUse?.includes("inbox")) {
    return true;
  }

  return folder.name === targetFolderName || folder.path === `/${targetFolderName}`;
}
