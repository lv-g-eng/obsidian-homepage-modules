import { App, normalizePath } from "obsidian";
import { EventBus } from "./event-bus";

/** 所有持久化记录的基础字段，用于 LWW 合并与墓碑删除。 */
export interface HMRecord {
  id: string;
  /** 最后修改时间（ms），跨设备合并的依据 */
  updatedAt: number;
  /** 写入设备指纹，用于同一时间戳时的确定性裁决 */
  deviceId: string;
  /** 墓碑标记：删除不真正移除记录，避免同步把它复活 */
  deleted?: boolean;
}

type RecordMap<T extends HMRecord> = Record<string, T>;
interface CollectionFile<T extends HMRecord> {
  records: RecordMap<T>;
}

const ROOT = ".homemodules";

/**
 * 两个记录的 last-writer-wins 裁决：updatedAt 大者胜，相等时按 deviceId 字典序。
 */
function pickWinner<T extends HMRecord>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.deviceId >= b.deviceId ? a : b;
}

function mergeMaps<T extends HMRecord>(
  base: RecordMap<T>,
  incoming: RecordMap<T>
): RecordMap<T> {
  const out: RecordMap<T> = { ...base };
  for (const id of Object.keys(incoming)) {
    const inc = incoming[id];
    const cur = out[id];
    out[id] = cur ? pickWinner(cur, inc) : inc;
  }
  return out;
}

/**
 * 类型化集合句柄。模块通过它读写自己的数据，无需关心文件路径与防抖。
 */
export class Collection<T extends HMRecord> {
  constructor(
    private svc: StorageService,
    public readonly name: string
  ) {}

  /** 全部未删除记录 */
  all(): T[] {
    return Object.values(this.svc.cacheOf<T>(this.name)).filter((r) => !r.deleted);
  }

  get(id: string): T | undefined {
    const r = this.svc.cacheOf<T>(this.name)[id];
    return r && !r.deleted ? r : undefined;
  }

  /** 插入/更新：自动盖时间戳与设备指纹，并防抖落盘。 */
  upsert(rec: Omit<T, "updatedAt" | "deviceId"> & Partial<HMRecord>): T {
    const map = this.svc.cacheOf<T>(this.name);
    const full = {
      ...rec,
      updatedAt: Date.now(),
      deviceId: this.svc.deviceId,
    } as T;
    map[full.id] = full;
    this.svc.markDirty(this.name);
    this.svc.bus.emit("storage:changed", { collection: this.name });
    return full;
  }

  /** 批量插入/更新：只标脏一次、只发一次事件，避免大批量导入时重绘风暴。 */
  upsertMany(recs: (Omit<T, "updatedAt" | "deviceId"> & Partial<HMRecord>)[]): void {
    if (recs.length === 0) return;
    const map = this.svc.cacheOf<T>(this.name);
    const now = Date.now();
    for (const rec of recs) {
      const full = { ...rec, updatedAt: now, deviceId: this.svc.deviceId } as T;
      map[full.id] = full;
    }
    this.svc.markDirty(this.name);
    this.svc.bus.emit("storage:changed", { collection: this.name });
  }

  /** 软删除（写墓碑）。 */
  remove(id: string): void {
    const map = this.svc.cacheOf<T>(this.name);
    const cur = map[id];
    if (!cur) return;
    map[id] = { ...cur, deleted: true, updatedAt: Date.now(), deviceId: this.svc.deviceId };
    this.svc.markDirty(this.name);
    this.svc.bus.emit("storage:changed", { collection: this.name });
  }

  /** 从磁盘重新合并（拉取其它设备同步过来的改动），返回自身以便链式。 */
  async refresh(): Promise<this> {
    await this.svc.refresh(this.name);
    return this;
  }
}

/**
 * 大体量模块数据的持久化层：每个集合一个 JSON 文件，键值映射存储，
 * 跨设备 last-writer-wins 合并，写入防抖。设置/全局状态走插件 data.json
 * 由 SettingsStore 管理，不在此处。
 */
export class StorageService {
  private cache = new Map<string, RecordMap<HMRecord>>();
  private dirty = new Set<string>();
  private loaded = new Set<string>();
  private flushTimer: number | null = null;

  constructor(
    private app: App,
    public readonly bus: EventBus,
    public deviceId: string
  ) {}

  private pathFor(collection: string): string {
    const [mod, ...rest] = collection.split("/");
    const file = rest.length ? rest.join("/") : "data";
    return normalizePath(`${ROOT}/${mod}/${file}.json`);
  }

  /** 逐层创建目录（adapter.mkdir 不递归）。 */
  private async ensureDir(dir: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    const parts = dir.split("/").filter(Boolean);
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!(await adapter.exists(cur))) await adapter.mkdir(cur);
    }
  }

  cacheOf<T extends HMRecord>(collection: string): RecordMap<T> {
    let m = this.cache.get(collection);
    if (!m) {
      m = {};
      this.cache.set(collection, m);
    }
    return m as RecordMap<T>;
  }

  /** 取集合句柄；首次会异步从磁盘载入（不阻塞调用）。 */
  collection<T extends HMRecord>(name: string): Collection<T> {
    if (!this.loaded.has(name)) {
      void this.refresh(name);
    }
    return new Collection<T>(this, name);
  }

  /** 从磁盘读取并与内存缓存按 LWW 合并。 */
  async refresh(collection: string): Promise<void> {
    const path = this.pathFor(collection);
    try {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(path)) {
        const raw = await adapter.read(path);
        const disk = JSON.parse(raw) as CollectionFile<HMRecord>;
        const merged = mergeMaps(this.cacheOf(collection), disk.records || {});
        this.cache.set(collection, merged);
      }
    } catch (e) {
      console.warn(`[HM] refresh ${collection} failed:`, e);
    } finally {
      this.loaded.add(collection);
    }
  }

  markDirty(collection: string): void {
    this.dirty.add(collection);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 500);
  }

  /** 把所有脏集合写盘（先与磁盘再合并一次，降低覆盖同步改动的概率）。 */
  async flush(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const pending = Array.from(this.dirty);
    this.dirty.clear();
    for (const collection of pending) {
      const path = this.pathFor(collection);
      try {
        const dir = path.substring(0, path.lastIndexOf("/"));
        await this.ensureDir(dir); // 逐层建目录（含根 .homemodules）
        // 落盘前再合并一次磁盘，避免覆盖刚同步进来的他设备记录
        if (await adapter.exists(path)) {
          const disk = JSON.parse(await adapter.read(path)) as CollectionFile<HMRecord>;
          this.cache.set(collection, mergeMaps(this.cacheOf(collection), disk.records || {}));
        }
        const file: CollectionFile<HMRecord> = { records: this.cacheOf(collection) };
        await adapter.write(path, JSON.stringify(file));
      } catch (e) {
        console.error(`[HM] flush ${collection} failed:`, e);
        this.dirty.add(collection); // 失败重试
        this.scheduleFlush(); // 关键：重新排程，否则永不重试 → 静默丢数据
      }
    }
  }

  /** 卸载时确保数据落盘。 */
  async dispose(): Promise<void> {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
