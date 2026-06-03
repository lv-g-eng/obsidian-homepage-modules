import { HMRecord } from "../../core/storage";

export interface Project extends HMRecord {
  boardId: string;
  name: string;
  order: number;
  color?: string;
}

export type Priority = "high" | "med" | "low";

export interface Task extends HMRecord {
  boardId: string;
  projectId: string;
  title: string;
  done: boolean;
  /** 是否派单到「今日」 */
  today: boolean;
  order: number;
  /** YYYY-MM-DD */
  due?: string;
  priority?: Priority;
}

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };
export const PRIORITY_LABEL: Record<Priority, string> = { high: "高", med: "中", low: "低" };

export interface Subtask extends HMRecord {
  taskId: string;
  title: string;
  done: boolean;
  order: number;
}

export const COLLECTIONS = {
  projects: "todo/projects",
  tasks: "todo/tasks",
  subtasks: "todo/subtasks",
} as const;
