/**
 * 常见 OpenAI 兼容服务商预设。选中后自动填 Base URL 与推荐模型，
 * 用户仍可手改。全部走 /chat/completions，AIClient 无需区分。
 */
export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  keyHint?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek 深度求索",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "platform.deepseek.com 获取 sk-...",
  },
  {
    id: "qwen",
    name: "通义千问 Qwen（阿里 DashScope）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen2.5-72b-instruct"],
    keyHint: "dashscope 控制台获取 sk-...",
  },
  {
    id: "moonshot",
    name: "Kimi 月之暗面",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    keyHint: "platform.moonshot.cn 获取",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-flash", "glm-4-air", "glm-4-plus"],
    keyHint: "bigmodel.cn 获取",
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-7B-Instruct"],
    keyHint: "siliconflow.cn 获取",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "o4-mini"],
    keyHint: "platform.openai.com 获取 sk-...",
  },
  {
    id: "ollama",
    name: "Ollama（本地，仅桌面）",
    baseUrl: "http://localhost:11434/v1",
    models: ["llama3.1", "qwen2.5"],
    keyHint: "本地无需 key，随意填",
  },
  {
    id: "custom",
    name: "自定义（手动填写）",
    baseUrl: "",
    models: [],
  },
];

export function findProvider(id: string | undefined): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

/** 根据已填 baseUrl 反推服务商（用于回显下拉）。 */
export function guessProvider(baseUrl: string): string {
  const hit = AI_PROVIDERS.find((p) => p.baseUrl && baseUrl.startsWith(p.baseUrl.replace(/\/v1$/, "")));
  return hit?.id ?? "custom";
}
