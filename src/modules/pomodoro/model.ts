import { HMRecord } from "../../core/storage";

/** 已完成的番茄会话记录（用于热力图统计）。 */
export interface PomoSession extends HMRecord {
  /** 开始时间戳 ms */
  startedAt: number;
  /** 时长（分钟） */
  minutes: number;
  date: string; // YYYY-MM-DD（按开始时间）
  taskId?: string;
}

/** 正在运行的番茄状态，存 data.json，关闭 Obsidian 也能续上。 */
export interface PomoRunning {
  startedAt: number;
  durationMin: number;
  mode: "focus" | "break";
  taskId?: string;
}
