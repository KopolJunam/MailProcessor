import type { FolderQueryInfo, MailFolder, MessageHeader, MessageId } from "../types/protocol";

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

  console.log("Resolving destination folder", {
    messageId,
    accountId: currentFolder.accountId,
    targetFolderPath: normalizedTargetFolderPath
  });

  const destinationFolder = await resolveDestinationFolder(currentFolder.accountId, normalizedTargetFolderPath);
  if (destinationFolder == null) {
    const folders = await messenger.folders.query({ accountId: currentFolder.accountId });
    const similarFolderPaths = findSimilarFolderPaths(folders, normalizedTargetFolderPath);
    console.error("Destination folder could not be resolved", {
      messageId,
      currentFolderName: currentFolder.name,
      currentFolderPath: currentFolder.path,
      currentFolderAccountId: currentFolder.accountId,
      targetFolderPath: normalizedTargetFolderPath,
      knownFolderPaths: folders.map((folder) => folder.path).sort(),
      similarFolderPaths
    });
    console.error(
      `Destination folder lookup details for ${normalizedTargetFolderPath}: similar=${JSON.stringify(similarFolderPaths)}`
    );
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

async function resolveDestinationFolder(accountId: string, targetFolderPath: string): Promise<MailFolder | null> {
  if (targetFolderPath === CANONICAL_INBOX_TARGET) {
    const inboxMatches = await messenger.folders.query({
      accountId,
      specialUse: ["inbox"]
    });
    if (inboxMatches[0] != null) {
      console.log("Resolved inbox destination folder by specialUse", {
        accountId,
        targetFolderPath,
        destinationFolderId: inboxMatches[0].id,
        destinationFolderPath: inboxMatches[0].path
      });
      return inboxMatches[0];
    }
  }

  const exactPathQuery: FolderQueryInfo = {
    accountId,
    path: targetFolderPath
  };
  const exactPathMatches = await messenger.folders.query(exactPathQuery);
  if (exactPathMatches[0] != null) {
    console.log("Resolved destination folder by exact path query", {
      accountId,
      targetFolderPath,
      matchCount: exactPathMatches.length,
      destinationFolderId: exactPathMatches[0].id,
      destinationFolderPath: exactPathMatches[0].path
    });
    return exactPathMatches[0];
  }

  console.warn("Exact path folder query returned no result, falling back to account folder scan", {
    accountId,
    targetFolderPath
  });
  const folders = await messenger.folders.query({ accountId });
  return findDestinationFolder(folders, targetFolderPath);
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

  const canonicalTargetFolderPath = canonicalizeFolderPath(targetFolderPath);
  return folders.find((folder) => canonicalizeFolderPath(folder.path) === canonicalTargetFolderPath) ?? null;
}

function isAlreadyInTargetFolder(folder: MailFolder, targetFolderPath: string): boolean {
  if (targetFolderPath === CANONICAL_INBOX_TARGET && folder.specialUse?.includes("inbox")) {
    return true;
  }

  return canonicalizeFolderPath(folder.path) === canonicalizeFolderPath(targetFolderPath);
}

function normalizeTargetFolderPath(targetFolderPath: string): string {
  const trimmedTargetFolderPath = targetFolderPath.trim();
  if (trimmedTargetFolderPath.length === 0) {
    throw new Error("Target folder path must not be blank");
  }

  return canonicalizeFolderPath(trimmedTargetFolderPath);
}

function canonicalizeFolderPath(folderPath: string): string {
  const decodedFolderPath = decodeImapModifiedUtf7(folderPath);
  const withLeadingSlash = decodedFolderPath.startsWith("/") ? decodedFolderPath : `/${decodedFolderPath}`;
  const withoutTrailingSlash =
    withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")
      ? withLeadingSlash.slice(0, -1)
      : withLeadingSlash;

  return withoutTrailingSlash.normalize("NFC");
}

function findSimilarFolderPaths(folders: MailFolder[], targetFolderPath: string): string[] {
  const targetSegments = canonicalizeFolderPath(targetFolderPath)
    .toLocaleLowerCase()
    .split("/")
    .filter((segment) => segment.length > 0);

  if (targetSegments.length === 0) {
    return [];
  }

  return folders
    .map((folder) => canonicalizeFolderPath(folder.path))
    .filter((folderPath) => {
      const lowercaseFolderPath = folderPath.toLocaleLowerCase();
      return targetSegments.some((segment) => lowercaseFolderPath.includes(segment));
    })
    .sort();
}

function decodeImapModifiedUtf7(value: string): string {
  return value.replace(/&([^-]*)-/g, (_match, encodedSection: string) => {
    if (encodedSection.length === 0) {
      return "&";
    }

    const base64 = encodedSection.replace(/,/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(paddedBase64);
    const codeUnits: number[] = [];

    for (let index = 0; index < binary.length; index += 2) {
      const highByte = binary.charCodeAt(index);
      const lowByte = binary.charCodeAt(index + 1);

      if (Number.isNaN(lowByte)) {
        throw new Error(`Invalid IMAP modified UTF-7 sequence '${encodedSection}'`);
      }

      codeUnits.push((highByte << 8) | lowByte);
    }

    return String.fromCharCode(...codeUnits);
  });
}
