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

interface Alarm {
  name: string;
}

interface ThunderbirdMessenger {
  accounts: {
    getDefault(): Promise<MailAccount | null>;
    list(): Promise<MailAccount[]>;
  };
  action: {
    onClicked: {
      addListener(listener: () => void): void;
    };
  };
  alarms: {
    create(name: string, alarmInfo: { periodInMinutes?: number }): void;
    onAlarm: {
      addListener(listener: (alarm: Alarm) => void): void;
    };
  };
  folders: {
    query(queryInfo?: import("./protocol").FolderQueryInfo): Promise<import("./protocol").MailFolder[]>;
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
    query(queryInfo?: import("./protocol").MessageQueryInfo): Promise<import("./protocol").MessageList>;
    continueList(listId: string): Promise<import("./protocol").MessageList>;
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
