interface RuntimePort {
  onDisconnect: {
    addListener(listener: () => void): void;
  };
  onMessage: {
    addListener(listener: (message: unknown) => void): void;
  };
  postMessage(message: unknown): void;
}

interface MailIdentity {
  email: string;
}

interface MailAccount {
  id: string;
  identities: MailIdentity[];
}

interface ThunderbirdMessenger {
  accounts: {
    list(): Promise<MailAccount[]>;
  };
  folders: {
    query(queryInfo?: { accountId?: string }): Promise<import("./protocol").MailFolder[]>;
  };
  messages: {
    onNewMailReceived: {
      addListener(listener: (folder: import("./protocol").MailFolder, messages: import("./protocol").MessageList) => void): void;
    };
    onMoved: {
      addListener(
        listener: (
          originalMessages: import("./protocol").MessageList,
          movedMessages: import("./protocol").MessageList
        ) => void
      ): void;
    };
    query(queryInfo?: {
      accountId?: string | string[];
      folderId?: string | string[];
      headerMessageId?: string;
    }): Promise<import("./protocol").MessageList>;
    move(messageIds: import("./protocol").MessageId[], destination: string): Promise<void>;
  };
  runtime: {
    connectNative(application: string): Promise<RuntimePort>;
    lastError?: {
      message?: string;
    };
  };
}

declare const messenger: ThunderbirdMessenger;
