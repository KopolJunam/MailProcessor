import { createNativeClient } from "../messaging/nativeClient";
import { applyTag } from "../tagging/tagService";
import type { ClassificationRequest, MessageHeader, MessageList } from "../types/protocol";

const nativeClient = createNativeClient("mailprocessor.host");
const IMPORTANT_TAG_KEY = "$label1";
let requestCounter = 0;

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
    from: extractEmail(message.author)
  };
}

async function processMessage(message: MessageHeader): Promise<void> {
  const request = createClassificationRequest(message);
  const response = await nativeClient.classify(request);

  if (!response.applyTag || response.tagKey == null) {
    return;
  }

  await applyTag(message, response.tagKey);
}

async function processMessageList(messages: MessageList): Promise<void> {
  for (const message of messages.messages) {
    try {
      await processMessage(message);
    } catch (error) {
      console.error("Failed to process message", { messageId: message.id, error });
    }
  }
}

function registerMailListener(): void {
  messenger.messages.onNewMailReceived.addListener((folder, messages) => {
    void processMessageList(messages).catch((error) => {
      console.error("Failed to process new mail batch", {
        folder: folder.path,
        error
      });
    });
  });
}

async function bootstrap(): Promise<void> {
  console.log("MailProcessor add-on loaded");

  await nativeClient.connect();
  registerMailListener();
  console.log(`Mail listener active, applying tag ${IMPORTANT_TAG_KEY} on backend match`);
}

void bootstrap().catch((error) => {
  console.error("Failed to bootstrap MailProcessor add-on", error);
});
