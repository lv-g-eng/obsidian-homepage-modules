# Homepage Modules 授权后端部署手册（DEPLOY-ACTIVATION）

把插件的「付费激活」闭环跑起来。整套方案是：
**插件激活时联网换一枚 Ed25519 签名令牌 → 之后永久离线校验 → 令牌与设备指纹绑定，一个授权码最多 3 台设备。**

后端是一个 Cloudflare Worker（免费版足够），代码在仓库 `server/`。

> 现实说明：客户端插件是 JS，理论上能被改绕过。本方案目标是「抬高门槛 + 遏制随手分享」，不是绝对 DRM。详见 `SELLING-SOP.md`。

---

## 0. 当前现状（重要）

打开 `src/license/license-manager.ts` 你会看到这两个常量**目前是空字符串占位符**：

```ts
// 第 25 行
const ACTIVATION_URL = "";
// 第 27 行
const SERVER_PUBLIC_KEY = "";
```

只要 `ACTIVATION_URL` 为空，插件里的 `activate()` 会直接返回
「激活后端尚未配置（server/ 部署后填入 ACTIVATION_URL）」；`SERVER_PUBLIC_KEY` 为空时
`verifySignedToken()` 一律返回 false。**所以现在发出去的 Release 是「只有 7 天试用、无法激活」的状态。**

本手册做完后，这两个值会被真实的 Worker 地址和公钥替换，激活闭环才成立。

---

## 1. 前置准备

### 1.1 注册 Cloudflare 账号（必须用户本人操作）

- 打开 https://dash.cloudflare.com/sign-up 注册，邮箱验证即可。
- **免费版（Free 计划）就够**：Workers 免费额度每天 10 万次请求；KV 免费额度每天 1000 次写 / 10 万次读，对卖授权码这种低频场景绰绰有余。
- 不需要绑定信用卡、不需要自有域名（部署后会自动给一个 `*.workers.dev` 地址）。

> ⚠️ 这一步**必须你本人操作**：账号是你的资产，发码口令、私钥都托管在你的账号下。别人代注册等于把收款命脉交出去。

### 1.2 安装 Node.js 与 wrangler

- Node.js ≥ 18（`genkeys.mjs` 用到 WebCrypto 的 Ed25519，18+ 才稳）。检查：
  ```bash
  node -v
  ```
- 安装 Cloudflare 官方 CLI `wrangler`：
  ```bash
  npm i -g wrangler
  wrangler --version
  ```

---

## 2. 生成 Ed25519 密钥对

仓库已自带脚本 `server/scripts/genkeys.mjs`，直接跑（**在仓库根目录**）：

```bash
node server/scripts/genkeys.mjs
```

输出形如：

```
=== SERVER_PUBLIC_KEY (填入 license-manager.ts) ===
MCowBQYDK2VwAyEA....（一长串 base64，SPKI 公钥）

=== SIGNING_KEY_PKCS8 (wrangler secret put) ===
MC4CAQAwBQYDK2Vw....（一长串 base64，PKCS8 私钥）
```

脚本内容（已在仓库，无需新建，这里贴出供核对）：

```js
// server/scripts/genkeys.mjs
import { webcrypto } from "crypto";
const { subtle } = webcrypto;

const pair  = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const spki  = new Uint8Array(await subtle.exportKey("spki",  pair.publicKey));
const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));
const b64   = (u8) => Buffer.from(u8).toString("base64");

console.log("=== SERVER_PUBLIC_KEY (填入 license-manager.ts) ===");
console.log(b64(spki));
console.log("\n=== SIGNING_KEY_PKCS8 (wrangler secret put) ===");
console.log(b64(pkcs8));
```

两件事记牢：
- **公钥（SPKI base64）** → 第 4 步填进插件 `SERVER_PUBLIC_KEY`。公钥泄露无所谓，它只能验签。
- **私钥（PKCS8 base64）** → 第 3.4 步作为 Worker secret。**私钥绝不能进 Git、绝不能填进插件、绝不能发给任何人。** 私钥泄露 = 任何人都能伪造永久授权令牌。把它单独存到密码管理器里。

> 提示：每跑一次脚本就是一对全新密钥。只生成一次，之后一直用同一对。换密钥会让所有已激活用户失效。

---

## 3. 部署 Worker

仓库 `server/` 已有 `wrangler.toml` 和 `src/worker.js`，本节基于现有配置走。

### 3.1 登录 Cloudflare（必须用户本人操作）

```bash
wrangler login
```

会弹浏览器让你授权——**用第 1.1 步你自己的 Cloudflare 账号登录**。这一步把本机 wrangler 和你的账号绑定。

### 3.2 创建 KV 命名空间（存授权码与设备绑定）

Worker 用一个名为 `LICENSES` 的 KV，存 `key -> { devices, plan, createdAt, revoked }`。

```bash
cd server
wrangler kv namespace create LICENSES
```

返回类似：

```
🌀 Creating namespace with title "homepage-modules-license-LICENSES"
✨ Success!
[[kv_namespaces]]
binding = "LICENSES"
id = "a1b2c3d4e5f6...."
```

把返回的 `id` 填进 `server/wrangler.toml`（替换掉占位符那行）：

```toml
[[kv_namespaces]]
binding = "LICENSES"
id = "a1b2c3d4e5f6...."   # ← 换成你真实的 id
```

> 现有 `wrangler.toml` 已经写好了 `name`、`main`、`compatibility_date = "2024-09-23"`、
> `compatibility_flags = ["nodejs_compat"]`（Ed25519 在 Workers runtime 需要较新日期/兼容标志）。
> 你**只需要改 KV 的 `id` 一行**，其余不用动。本方案用 KV 不用 D1（KV 的 key-value 模型刚好契合「授权码→记录」）。

### 3.3 设置签名私钥 secret

```bash
wrangler secret put SIGNING_KEY_PKCS8
```

命令会提示粘贴——**粘第 2 步那段 PKCS8 私钥 base64**，回车。secret 存在 Cloudflare 侧，不出现在代码或 toml 里。

### 3.4 设置发码管理员口令 secret

```bash
wrangler secret put ADMIN_SECRET
```

自定义一个足够长的随机口令（比如 `openssl rand -hex 24` 生成的）。**这就是你发码 / 吊销时的钥匙**，泄露 = 别人能免费给自己发授权码。

### 3.5 部署

```bash
wrangler deploy
```

成功后会打印分配的地址，形如：

```
Published homepage-modules-license
  https://homepage-modules-license.<你的子域>.workers.dev
```

**记下这个 URL。** 激活端点是它后面加 `/activate`。

### 3.6 冒烟测试（确认 Worker 活着）

```bash
curl https://homepage-modules-license.<你的子域>.workers.dev/
# 期望： {"ok":true,"service":"homepage-modules-license"}
```

---

## 4. 把后端接回插件并重新打包

### 4.1 填两个常量

打开 `src/license/license-manager.ts`，把第 25、27 行的空字符串换成真实值：

```ts
/** 后端激活地址（部署 Cloudflare Worker 后填入）。 */
const ACTIVATION_URL = "https://homepage-modules-license.<你的子域>.workers.dev/activate";
/** 内嵌的服务端 Ed25519 公钥（base64 SPKI），部署后端时生成并填入。 */
const SERVER_PUBLIC_KEY = "MCowBQYDK2VwAyEA....";  // ← 第 2 步的公钥
```

注意：
- `ACTIVATION_URL` **要带 `/activate` 后缀**（插件直接 POST 到这个完整地址）。
- `SERVER_PUBLIC_KEY` 填**公钥**（SPKI），千万别填私钥。

### 4.2 构建

在仓库根目录：

```bash
npm run build
```

（脚本是 `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`，会产出 `main.js`。）

### 4.3 重发 Release

把构建产物（`main.js` / `manifest.json` / `styles.css` 等，按你现有 `scripts/package-release.mjs` 的打包逻辑）重新打成 Release 包发布。**这一版才是「能激活」的正式版**，之前那版只有试用。

> 安全须知：`main.js` 里只内嵌了**公钥**，不含私钥，公开没问题。
> 但请确认你**没有**误把私钥或 `ADMIN_SECRET` 写进任何会进仓库 / Release 的文件。

---

## 5. 自测清单：验证整条激活闭环

按顺序走一遍，确认四个关键行为都对。

### ① 造一个授权码（用发码端点）

```bash
curl -X POST https://<your-worker>/admin/issue -H "x-admin-secret: <你的ADMIN_SECRET>"
# 期望返回： {"key":"HM-A1B2-C3D4-E5F6"}
```

授权码格式固定为 `HM-XXXX-XXXX-XXXX`（3 段、每段 4 位大写十六进制，Worker 的 `randomKey()` 生成）。

### ② 激活（设备 1）

在装了新 Release 的 Obsidian 里，打开插件设置页，粘贴这个 key 点激活。
期望：提示「激活成功」，状态变为 active，付费模块解锁。

> 想纯命令行验证激活端点本身，也可以：
> ```bash
> curl -X POST https://<your-worker>/activate \
>   -H "content-type: application/json" \
>   -d '{"key":"HM-A1B2-C3D4-E5F6","deviceId":"test-device-1"}'
> # 期望返回 {"token":"<base64payload>.<base64sig>"}
> ```
> 注意：插件里的 `deviceId` 是设备指纹（`computeDeviceId` 算出的 32 位 hex），
> 真机激活时由插件自动带上，不用手填。

### ③ 断网后仍可用（离线校验）

激活成功后，**断开网络**，重启 Obsidian。
期望：付费功能依然解锁。原理——`init()` 里 `verifySignedToken(token, SERVER_PUBLIC_KEY)` 用内嵌公钥**本地验签**，不再请求后端；只要令牌里的 `deviceId` 等于本机指纹即判定 active。

### ④ 第 4 台设备被拒（设备数上限）

用**同一个 key**，在第 2、第 3 台不同设备上分别激活（各自指纹不同），都应成功。
到**第 4 台**再激活，期望返回：

```json
{"error":"已达 3 台设备上限"}
```

（Worker 常量 `MAX_DEVICES = 3`；KV 记录里 `devices` 数组满 3 个就拒绝新指纹。）

### ⑤（可选）吊销验证

```bash
curl -X POST https://<your-worker>/admin/revoke \
  -H "x-admin-secret: <你的ADMIN_SECRET>" \
  -H "content-type: application/json" \
  -d '{"key":"HM-A1B2-C3D4-E5F6"}'
# 期望 {"ok":true}
```

吊销后该 key **再激活新设备**会被拒（`授权码已被吊销`）。注意：已经拿到离线令牌的老设备，因为是离线验签，吊销**不会**实时让它失效——这是离线方案的固有取舍（详见 SOP 防盗版章节）。

---

## 6. 哪些步骤必须用户本人操作（汇总）

| 步骤 | 为什么必须本人 |
|---|---|
| 1.1 注册 Cloudflare 账号 | 账号是你的收款命脉与资产，托管私钥与发码口令 |
| 3.1 `wrangler login` | 把部署权限绑到你自己的 CF 账号 |
| 3.3 设置 `SIGNING_KEY_PKCS8` | 私钥只你掌握，泄露=令牌可被伪造 |
| 3.4 设置 `ADMIN_SECRET` | 发码/吊销口令，泄露=别人免费发码 |
| 2 保管私钥 | 私钥进了任何人手里都无法挽回，需换密钥并让全部用户重激活 |

其余步骤（生成密钥、改常量、构建、发 Release）可以由你或协作者执行，但**密钥/口令/账号这四样必须你本人掌控**。

---

## 附：端点速查（来自 server/src/worker.js）

| 方法 | 路径 | 鉴权 | 入参 | 返回 |
|---|---|---|---|---|
| GET | `/` | 无 | — | `{ok:true,service:...}` 健康检查 |
| POST | `/activate` | 无 | `{key, deviceId}` | `{token}` 或 `{error}` |
| POST | `/admin/issue` | header `x-admin-secret` | — | `{key:"HM-XXXX-XXXX-XXXX"}` |
| POST | `/admin/revoke` | header `x-admin-secret` | `{key}` | `{ok:true}` |

令牌格式：`base64(payloadJson) + "." + base64(signature)`，Ed25519 签名，
payload 含 `{key, deviceId, issuedAt, plan, features:["all"]}`。
