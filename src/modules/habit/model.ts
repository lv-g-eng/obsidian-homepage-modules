import { HMRecord } from "../../core/storage";

export type HabitType = "do" | "limit" | "quit";

/** 习惯定义。 */
export interface Habit extends HMRecord {
  name: string;
  type: HabitType;
  /** do: 每日目标次数；limit: 每日上限；quit: 不使用 */
  target?: number;
  unit?: string;
  color?: string; // CSS 变量或颜色值
}

/** 单日打卡记录，id = `${habitId}:${date}`。 */
export interface Checkin extends HMRecord {
  habitId: string;
  date: string; // YYYY-MM-DD
  value: number;
}

export function checkinId(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}

/** 计算「连续天数」：do 满足目标即算达成；quit 算未破戒天数。 */
export function computeStreak(
  habit: Habit,
  checkins: Map<string, number>,
  today: string
): number {
  const d = new Date(today + "T00:00:00");
  let streak = 0;
  for (;;) {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const v = checkins.get(key) ?? 0;
    const achieved =
      habit.type === "do"
        ? v >= (habit.target ?? 1)
        : habit.type === "limit"
        ? v <= (habit.target ?? 0)
        : v === 0; // quit：当天无记录视为坚持
    if (habit.type === "quit") {
      // quit：从今天往前数没有破戒的天数；破戒(value>0)即中断
      if (v > 0) break;
    } else if (!achieved) {
      break;
    }
    streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 366) break;
  }
  return streak;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
