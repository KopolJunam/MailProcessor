import type { MessageHeader } from "../types/protocol";

export async function applyTag(message: MessageHeader, tagKey: string): Promise<void> {
  const updatedTags = new Set(message.tags);
  updatedTags.add(tagKey);

  await messenger.messages.update(message.id, {
    tags: [...updatedTags]
  });
}
