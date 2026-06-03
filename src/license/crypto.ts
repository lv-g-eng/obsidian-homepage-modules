/**
 * 纯 WebCrypto 工具，桌面与移动端 WebView 均可用（crypto.subtle）。
 */

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 用服务端公钥（base64 SPKI，Ed25519）验证离线令牌签名。
 * 令牌格式：base64(payloadJson) + "." + base64(signature)
 * publicKeyB64 为空时返回 false（尚未配置后端）。
 */
export async function verifySignedToken(
  token: string,
  publicKeyB64: string
): Promise<{ ok: boolean; payload?: Record<string, unknown> }> {
  if (!publicKeyB64) return { ok: false };
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return { ok: false };
    const key = await crypto.subtle.importKey(
      "spki",
      base64ToBytes(publicKeyB64),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64ToBytes(sigB64),
      base64ToBytes(payloadB64)
    );
    if (!ok) return { ok: false };
    const json = new TextDecoder().decode(base64ToBytes(payloadB64));
    return { ok: true, payload: JSON.parse(json) };
  } catch (e) {
    console.warn("[HM] token verify error:", e);
    return { ok: false };
  }
}

export function randomUuid(): string {
  // crypto.randomUUID 在 Obsidian 的 Chromium/WebView 均可用
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // 退化方案
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
