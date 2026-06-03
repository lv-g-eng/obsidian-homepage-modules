// 生成 Ed25519 密钥对。
//   node server/scripts/genkeys.mjs
// 输出：
//   PUBLIC (SPKI, base64)  → 填入 src/license/license-manager.ts 的 SERVER_PUBLIC_KEY
//   PRIVATE (PKCS8, base64) → npx wrangler secret put SIGNING_KEY_PKCS8 时粘贴
import { webcrypto } from "crypto";

const { subtle } = webcrypto;

const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const spki = new Uint8Array(await subtle.exportKey("spki", pair.publicKey));
const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));

const b64 = (u8) => Buffer.from(u8).toString("base64");

console.log("=== SERVER_PUBLIC_KEY (填入 license-manager.ts) ===");
console.log(b64(spki));
console.log("\n=== SIGNING_KEY_PKCS8 (wrangler secret put) ===");
console.log(b64(pkcs8));
