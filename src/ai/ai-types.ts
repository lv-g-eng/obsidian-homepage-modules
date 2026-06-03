export interface AIConfig {
  baseUrl: string; // 如 https://api.openai.com/v1
  apiKey: string;
  model: string; // 如 gpt-4o-mini
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  /** 流式回调（仅桌面流式时逐 token 触发） */
  onToken?: (delta: string) => void;
  signal?: AbortSignal;
}
