export interface ClassificationRequest {
  type: "classify-mail";
  requestId: string;
  from: string;
  subject: string;
}

export type LearningMode = "use-address" | "use-domain";

export interface LearnRuleRequest {
  type: "learn-rule";
  requestId: string;
  from: string;
  learningMode: LearningMode;
}

export interface ClassificationResponse {
  type: "classification-result";
  requestId: string;
  matchedRule?: string;
  targetFolder: string;
}

export interface LearnRuleResponse {
  type: "learning-result";
  requestId: string;
  createdPattern: string;
  targetFolder: string;
}

export type BackendResponse = ClassificationResponse | LearnRuleResponse;

export interface MessageHeader {
  author: string;
  folder?: MailFolder;
  headerMessageId?: string;
  id: number;
  subject?: string;
  tags: string[];
}

export type MessageId = number;

export interface MailFolder {
  accountId?: string;
  id: string;
  name: string;
  path: string;
  specialUse?: string[];
}

export interface MessageList {
  id: string | null;
  messages: MessageHeader[];
}
