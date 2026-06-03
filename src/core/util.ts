/**
 * 安全的唯一 id 生成。crypto.randomUUID 需要安全上下文，在某些
 * Electron/移动 WebView 环境可能不可用，这里带降级方案。
 */
export function genId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  const rnd = () =>
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(1))[0] / 255
      : Math.random();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (rnd() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
