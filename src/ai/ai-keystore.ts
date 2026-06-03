/**
 * AI 密钥的本地存储与轻度混淆。
 *
 * 重要：vault 本地存储无法做到真正加密——任何能读到 data.json 的程序都能还原。
 * 这里只做防「肩窥/明文扫描」的轻度混淆。密钥永不上传、不写日志、不发给授权服务器。
 */

const OBFUSCATE_SALT = "hm-ai-v1";

function xor(input: string, key: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

export function obfuscate(plain: string): string {
  if (!plain) return "";
  return btoa(unescape(encodeURIComponent(xor(plain, OBFUSCATE_SALT))));
}

export function deobfuscate(stored: string): string {
  if (!stored) return "";
  try {
    return xor(decodeURIComponent(escape(atob(stored))), OBFUSCATE_SALT);
  } catch {
    return "";
  }
}
