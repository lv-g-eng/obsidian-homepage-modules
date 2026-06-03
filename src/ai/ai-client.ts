import { requestUrl, Notice } from "obsidian";
import { Plat } from "../core/platform";
import { AIConfig, ChatOptions } from "./ai-types";

/**
 * OpenAI 兼容的对话客户端，双传输：
 * - 桌面：原生 fetch + SSE 流式（response.body.getReader）
 * - 移动：requestUrl 非流式（绕过 WebView 的 CORS 限制）
 * AIClient.chat 屏蔽两者差异。
 */
export class AIClient {
  constructor(private getConfig: () => AIConfig) {}

  isConfigured(): boolean {
    const c = this.getConfig();
    return !!(c.baseUrl && c.apiKey && c.model);
  }

  private endpoint(): string {
    const base = this.getConfig().baseUrl.replace(/\/+$/, "");
    return `${base}/chat/completions`;
  }

  /** 返回完整回复文本；若 stream 且在桌面，则同时通过 onToken 逐段回调。 */
  async chat(opts: ChatOptions): Promise<string> {
    if (!this.isConfigured()) {
      new Notice("请先在设置中配置 AI（Base URL / API Key / 模型）");
      throw new Error("AI not configured");
    }
    const wantStream = opts.stream && Plat.canStreamFetch;
    return wantStream ? this.streamDesktop(opts) : this.requestMobile(opts);
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.getConfig().apiKey}`,
    };
  }

  private body(opts: ChatOptions, stream: boolean): string {
    return JSON.stringify({
      model: this.getConfig().model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      stream,
    });
  }

  private normalizeError(status: number, text: string): Error {
    if (status === 401) return new Error("AI 鉴权失败（401）：检查 API Key");
    if (status === 429) return new Error("AI 频率限制（429）：稍后再试");
    return new Error(`AI 请求失败（${status}）：${text.slice(0, 200)}`);
  }

  /** 桌面流式：逐 token 解析 SSE。 */
  private async streamDesktop(opts: ChatOptions): Promise<string> {
    let resp: Response;
    try {
      resp = await fetch(this.endpoint(), {
        method: "POST",
        headers: this.headers(),
        body: this.body(opts, true),
        signal: opts.signal,
      });
    } catch (e) {
      // CORS / 网络失败 → 回退到非流式
      return this.requestMobile(opts);
    }
    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => "");
      throw this.normalizeError(resp.status, txt);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta: string = json.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            opts.onToken?.(delta);
          }
        } catch {
          /* 不完整的 chunk，忽略 */
        }
      }
    }
    return full;
  }

  /** 移动/回退：requestUrl 非流式整段返回。 */
  private async requestMobile(opts: ChatOptions): Promise<string> {
    const resp = await requestUrl({
      url: this.endpoint(),
      method: "POST",
      headers: this.headers(),
      body: this.body(opts, false),
      throw: false,
    });
    if (resp.status < 200 || resp.status >= 300) {
      throw this.normalizeError(resp.status, resp.text);
    }
    const content: string = resp.json?.choices?.[0]?.message?.content ?? "";
    // 非流式也调一次 onToken，便于 UI 统一渲染
    if (content) opts.onToken?.(content);
    return content;
  }
}
