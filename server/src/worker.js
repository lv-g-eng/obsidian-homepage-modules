/**
 * Homepage Modules 授权后端 — Cloudflare Worker。
 *
 * 端点：
 *   POST /activate          { key, deviceId }              → { token } | { error }
 *   POST /admin/issue       header x-admin-secret          → { key }   （发码）
 *   POST /admin/revoke      header x-admin-secret { key }  → { ok }
 *   GET  /                                                → 健康检查
 *
 * 绑定（wrangler.toml）：
 *   KV   LICENSES            存 key -> { devices, plan, createdAt, revoked }
 *   Secret SIGNING_KEY_PKCS8 Ed25519 私钥（base64 pkcs8，用 scripts/genkeys.mjs 生成）
 *   Secret ADMIN_SECRET      发码用的管理员口令
 *
 * 令牌格式（与插件 src/license/crypto.ts 的 verifySignedToken 对应）：
 *   base64(payloadJson) + "." + base64(signature)
 *   签名对象 = payloadJson 的原始字节（Ed25519）。
 */

const MAX_DEVICES = 3;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function b64encode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importPrivateKey(pkcs8B64) {
  return crypto.subtle.importKey(
    "pkcs8",
    b64decode(pkcs8B64),
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

async function signToken(payload, privateKey) {
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, payloadBytes);
  return `${b64encode(payloadBytes)}.${b64encode(new Uint8Array(sig))}`;
}

function randomKey() {
  const seg = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(2)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return `HM-${seg()}-${seg()}-${seg()}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, GET, OPTIONS",
          "access-control-allow-headers": "content-type, x-admin-secret",
        },
      });
    }

    if (url.pathname === "/" ) return json({ ok: true, service: "homepage-modules-license" });

    // 发码（管理员）
    if (url.pathname === "/admin/issue" && request.method === "POST") {
      if (request.headers.get("x-admin-secret") !== env.ADMIN_SECRET)
        return json({ error: "unauthorized" }, 401);
      const key = randomKey();
      await env.LICENSES.put(
        key,
        JSON.stringify({ devices: [], plan: "lifetime", createdAt: Date.now() })
      );
      return json({ key });
    }

    // 吊销（管理员）
    if (url.pathname === "/admin/revoke" && request.method === "POST") {
      if (request.headers.get("x-admin-secret") !== env.ADMIN_SECRET)
        return json({ error: "unauthorized" }, 401);
      const { key } = await request.json();
      const raw = await env.LICENSES.get(key);
      if (!raw) return json({ error: "not found" }, 404);
      const rec = JSON.parse(raw);
      rec.revoked = true;
      await env.LICENSES.put(key, JSON.stringify(rec));
      return json({ ok: true });
    }

    // 激活
    if (url.pathname === "/activate" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid body" }, 400);
      }
      const { key, deviceId } = body || {};
      if (!key || !deviceId) return json({ error: "缺少 key 或 deviceId" }, 400);

      const raw = await env.LICENSES.get(key);
      if (!raw) return json({ error: "授权码无效" }, 404);
      const rec = JSON.parse(raw);
      if (rec.revoked) return json({ error: "授权码已被吊销" }, 403);

      if (!rec.devices.includes(deviceId)) {
        if (rec.devices.length >= MAX_DEVICES)
          return json({ error: `已达 ${MAX_DEVICES} 台设备上限` }, 403);
        rec.devices.push(deviceId);
        await env.LICENSES.put(key, JSON.stringify(rec));
      }

      const privateKey = await importPrivateKey(env.SIGNING_KEY_PKCS8);
      const token = await signToken(
        { key, deviceId, issuedAt: Date.now(), plan: rec.plan, features: ["all"] },
        privateKey
      );
      return json({ token });
    }

    return json({ error: "not found" }, 404);
  },
};
