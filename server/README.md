# Homepage Modules 授权后端（Cloudflare Worker）

离线签名令牌方案：插件激活时联网换取一枚 Ed25519 签名令牌，之后**永久离线校验**，令牌与设备指纹绑定，一个 key 最多 3 台设备。

> 现实说明：客户端插件是 JS，理论上可被改绕过。本方案目标是「增加门槛 + 遏制随手分享」，非绝对 DRM。

## 部署步骤

1. 安装 wrangler 并登录：
   ```bash
   npm i -g wrangler
   wrangler login
   ```

2. 生成签名密钥对：
   ```bash
   node server/scripts/genkeys.mjs
   ```
   - 把 **SERVER_PUBLIC_KEY** 填入插件 `src/license/license-manager.ts` 的 `SERVER_PUBLIC_KEY` 常量。
   - **SIGNING_KEY_PKCS8** 稍后用作 secret。

3. 创建 KV 命名空间，并把返回的 id 填入 `wrangler.toml`：
   ```bash
   cd server
   wrangler kv namespace create LICENSES
   ```

4. 设置 secrets：
   ```bash
   wrangler secret put SIGNING_KEY_PKCS8   # 粘贴第 2 步的私钥
   wrangler secret put ADMIN_SECRET        # 自定义发码口令
   ```

5. 部署：
   ```bash
   wrangler deploy
   ```
   记下分配的地址（如 `https://homepage-modules-license.<account>.workers.dev`），填入插件
   `src/license/license-manager.ts` 的 `ACTIVATION_URL`（指向 `.../activate`）。

## 发码（卖出一份时）

```bash
curl -X POST https://<your-worker>/admin/issue -H "x-admin-secret: <你的口令>"
# → { "key": "HM-XXXX-XXXX-XXXX" }
```
把 key 发给买家，买家在插件设置页粘贴激活即可。

## 吊销

```bash
curl -X POST https://<your-worker>/admin/revoke -H "x-admin-secret: <口令>" \
     -H "content-type: application/json" -d '{"key":"HM-XXXX-XXXX-XXXX"}'
```

## 改完插件常量后别忘了重新构建

```bash
npm run build   # 在仓库根目录
```
