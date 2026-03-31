import type { ClassificationRequest, ClassificationResponse } from "../types/protocol";

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (response: ClassificationResponse) => void;
};

export interface NativeClient {
  classify(request: ClassificationRequest): Promise<ClassificationResponse>;
  connect(): Promise<void>;
}

export function createNativeClient(application: string): NativeClient {
  let port: RuntimePort | null = null;
  let connecting: Promise<void> | null = null;
  const pendingRequests = new Map<string, PendingRequest>();

  function rejectPendingRequests(reason: unknown): void {
    for (const pending of pendingRequests.values()) {
      pending.reject(reason);
    }
    pendingRequests.clear();
  }

  function handleMessage(message: unknown): void {
    if (!isClassificationResponse(message)) {
      console.warn("Ignoring unexpected native message", message);
      return;
    }

    const pending = pendingRequests.get(message.requestId);
    if (pending == null) {
      console.warn("Received response without pending request", message);
      return;
    }

    pendingRequests.delete(message.requestId);
    pending.resolve(message);
  }

  function handleDisconnect(): void {
    const runtimeError = messenger.runtime.lastError?.message;
    port = null;
    rejectPendingRequests(new Error(runtimeError ?? "Native host disconnected"));
  }

  async function connect(): Promise<void> {
    if (port != null) {
      return;
    }

    if (connecting != null) {
      await connecting;
      return;
    }

    connecting = (async () => {
      const connectedPort = await messenger.runtime.connectNative(application);
      connectedPort.onMessage.addListener(handleMessage);
      connectedPort.onDisconnect.addListener(handleDisconnect);
      port = connectedPort;
    })();

    try {
      await connecting;
    } finally {
      connecting = null;
    }
  }

  return {
    async classify(request: ClassificationRequest): Promise<ClassificationResponse> {
      await connect();

      if (port == null) {
        throw new Error("Native host connection is not available");
      }

      return await new Promise<ClassificationResponse>((resolve, reject) => {
        pendingRequests.set(request.requestId, { resolve, reject });
        try {
          port.postMessage(request);
        } catch (error) {
          pendingRequests.delete(request.requestId);
          reject(error);
        }
      });
    },
    connect
  };
}

function isClassificationResponse(value: unknown): value is ClassificationResponse {
  if (typeof value !== "object" || value == null) {
    return false;
  }

  const response = value as Partial<ClassificationResponse>;
  return (
    response.type === "classification-result" &&
    typeof response.requestId === "string" &&
    typeof response.applyTag === "boolean"
  );
}
