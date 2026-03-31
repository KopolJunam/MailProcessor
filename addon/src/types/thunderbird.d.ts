interface RuntimePort {
  onDisconnect: {
    addListener(listener: () => void): void;
  };
  onMessage: {
    addListener(listener: (message: unknown) => void): void;
  };
  postMessage(message: unknown): void;
}

interface MessageUpdateProperties {
  tags?: string[];
}

interface MailFolder {
  path: string;
}

interface ThunderbirdMessenger {
  messages: {
    onNewMailReceived: {
      addListener(listener: (folder: MailFolder, messages: import("./protocol").MessageList) => void): void;
    };
    update(messageId: number, newProperties: MessageUpdateProperties): Promise<void>;
  };
  runtime: {
    connectNative(application: string): Promise<RuntimePort>;
    lastError?: {
      message?: string;
    };
  };
}

declare const messenger: ThunderbirdMessenger;
