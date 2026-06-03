import { requestUrl } from "obsidian";
import { EventBus } from "../core/event-bus";
import { computeDeviceId, newDeviceSalt } from "./device-id";
import { verifySignedToken } from "./crypto";

export type LicenseStatus = "none" | "trial" | "active" | "expired";

/** 持久化在插件 data.json 里的授权数据。 */
export interface LicenseData {
  deviceSalt?: string;
  trialStartedAt?: number;
  /** 见过的最大时间戳，用于防回拨时钟绕过试用 */
  maxSeenTime?: number;
  key?: string;
  /** 服务端签发的离线签名令牌 */
  token?: string;
  /** 开发期全解锁开关 */
  devUnlock?: boolean;
}

const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 后端激活地址（部署 Cloudflare Worker 后填入）。 */
const ACTIVATION_URL = "";
/** 内嵌的服务端 Ed25519 公钥（base64 SPKI），部署后端时生成并填入。 */
const SERVER_PUBLIC_KEY = "";

export class LicenseManager {
  deviceId = "";
  status: LicenseStatus = "none";
  private tokenValid = false;

  constructor(
    private data: LicenseData,
    private save: () => Promise<void>,
    private bus: EventBus
  ) {}

  async init(): Promise<void> {
    if (!this.data.deviceSalt) {
      this.data.deviceSalt = newDeviceSalt();
      await this.save();
    }
    this.deviceId = await computeDeviceId(this.data.deviceSalt);

    // 防回拨：记录见过的最大时间
    const now = Date.now();
    this.data.maxSeenTime = Math.max(this.data.maxSeenTime ?? 0, now);

    // 校验离线令牌
    if (this.data.token) {
      const res = await verifySignedToken(this.data.token, SERVER_PUBLIC_KEY);
      this.tokenValid =
        res.ok && (res.payload?.deviceId as string | undefined) === this.deviceId;
    }
    this.evaluate();
    await this.save();
  }

  private effectiveNow(): number {
    // 取「真实 now」与「历史最大时间」的较大者，抵御时钟回拨
    return Math.max(Date.now(), this.data.maxSeenTime ?? 0);
  }

  private evaluate(): void {
    if (this.data.devUnlock) {
      this.status = "active";
    } else if (this.tokenValid) {
      this.status = "active";
    } else if (this.data.trialStartedAt) {
      const elapsed = this.effectiveNow() - this.data.trialStartedAt;
      this.status = elapsed <= TRIAL_DAYS * DAY_MS ? "trial" : "expired";
    } else {
      this.status = "none";
    }
    this.bus.emit("license:changed", { status: this.status });
  }

  /** 付费功能是否解锁（active 或试用中）。 */
  get unlocked(): boolean {
    return this.status === "active" || this.status === "trial";
  }

  /** 试用剩余天数（向上取整）。 */
  trialDaysLeft(): number {
    if (!this.data.trialStartedAt) return TRIAL_DAYS;
    const elapsed = this.effectiveNow() - this.data.trialStartedAt;
    return Math.max(0, Math.ceil((TRIAL_DAYS * DAY_MS - elapsed) / DAY_MS));
  }

  async startTrial(): Promise<void> {
    if (this.data.trialStartedAt) return;
    this.data.trialStartedAt = this.effectiveNow();
    this.evaluate();
    await this.save();
  }

  /**
   * 在线激活：POST {key, deviceId} 到后端，存回签名令牌并离线校验。
   * 未配置后端时返回失败提示。
   */
  async activate(key: string): Promise<{ ok: boolean; message: string }> {
    key = key.trim();
    if (!key) return { ok: false, message: "请输入授权码" };
    if (!ACTIVATION_URL) {
      return { ok: false, message: "激活后端尚未配置（server/ 部署后填入 ACTIVATION_URL）" };
    }
    try {
      const resp = await requestUrl({
        url: ACTIVATION_URL,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ key, deviceId: this.deviceId }),
        throw: false,
      });
      if (resp.status !== 200) {
        return { ok: false, message: `激活失败（${resp.status}）：${resp.text}` };
      }
      const json = resp.json as { token?: string; error?: string };
      if (!json.token) return { ok: false, message: json.error || "激活失败" };

      const verified = await verifySignedToken(json.token, SERVER_PUBLIC_KEY);
      if (!verified.ok || (verified.payload?.deviceId as string) !== this.deviceId) {
        return { ok: false, message: "令牌校验失败" };
      }
      this.data.key = key;
      this.data.token = json.token;
      this.tokenValid = true;
      this.evaluate();
      await this.save();
      return { ok: true, message: "激活成功" };
    } catch (e) {
      return { ok: false, message: `网络错误：${(e as Error).message}` };
    }
  }

  async deactivate(): Promise<void> {
    delete this.data.key;
    delete this.data.token;
    this.tokenValid = false;
    this.evaluate();
    await this.save();
  }

  async setDevUnlock(on: boolean): Promise<void> {
    this.data.devUnlock = on;
    this.evaluate();
    await this.save();
  }
}
