export interface ClassificationRequest {
  type: "classify-mail";
  requestId: string;
  from: string;
}

export interface ClassificationResponse {
  type: "classification-result";
  requestId: string;
  applyTag: boolean;
  tagKey?: string;
}

export interface MessageHeader {
  author: string;
  id: number;
  tags: string[];
}

export interface MessageList {
  id: string | null;
  messages: MessageHeader[];
}
