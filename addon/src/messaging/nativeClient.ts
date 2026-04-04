import type { BackendResponse, ClassificationRequest, ClassificationResponse, LearnRuleRequest, LearnRuleResponse } from "../types/protocol";

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (response: BackendResponse) => void;
};

export interface NativeClient {
  classify(request: ClassificationRequest): Promise<ClassificationResponse>;
  connect(): Promise<void>;
  learn(request: LearnRuleRequest): Promise<LearnRuleResponse>;
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
    if (!isBackendResponse(message)) {
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
    console.error("Native host disconnected", {
      application,
      runtimeError
    });
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
      console.log("Connecting to native host", { application });
      const connectedPort = await messenger.runtime.connectNative(application);
      connectedPort.onMessage.addListener(handleMessage);
      connectedPort.onDisconnect.addListener(handleDisconnect);
      port = connectedPort;
      console.log("Connected to native host", { application });
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

      const response = await new Promise<BackendResponse>((resolve, reject) => {
        pendingRequests.set(request.requestId, { resolve, reject });
        try {
          port.postMessage(request);
        } catch (error) {
          pendingRequests.delete(request.requestId);
          reject(error);
        }
      });

      if (response.type !== "classification-result") {
        throw new Error(`Unexpected response type '${response.type}' for classify request`);
      }

      return response;
    },
    async learn(request: LearnRuleRequest): Promise<LearnRuleResponse> {
      await connect();

      if (port == null) {
        throw new Error("Native host connection is not available");
      }

      const response = await new Promise<BackendResponse>((resolve, reject) => {
        pendingRequests.set(request.requestId, { resolve, reject });
        try {
          port.postMessage(request);
        } catch (error) {
          pendingRequests.delete(request.requestId);
          reject(error);
        }
      });

      if (response.type !== "learning-result") {
        throw new Error(`Unexpected response type '${response.type}' for learn request`);
      }

      return response;
    },
    connect
  };
}

function isBackendResponse(value: unknown): value is BackendResponse {
  if (typeof value !== "object" || value == null) {
    return false;
  }

  const response = value as Partial<BackendResponse>;
  if (typeof response.requestId !== "string") {
    return false;
  }

  if (response.type === "classification-result") {
    return typeof response.targetFolder === "string";
  }

  if (response.type === "learning-result") {
    return typeof response.targetFolder === "string" && typeof response.createdPattern === "string";
  }

  return false;
}
