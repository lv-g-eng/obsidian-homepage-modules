import { Events, EventRef } from "obsidian";

/**
 * 类型化的事件载荷。新增跨模块事件时在此登记，保证编译期检查。
 */
export interface HMEvents {
  "pomodoro:completed": { minutes: number; at: number; taskId?: string };
  "pomodoro:changed": { running: boolean };
  "habit:checked": { habitId: string; date: string; value: number };
  "todo:dispatched": { taskId: string; boardId: string };
  "todo:changed": { boardId: string };
  "storage:changed": { collection: string };
  "zoom:changed": { scale: number };
  "vocab:reviewed": { cardId: string; at: number };
  "license:changed": { status: string };
}

type EventName = keyof HMEvents;

/**
 * 进程内事件总线。模块用 this.registerEvent(bus.on(...)) 订阅，
 * 随渲染块卸载自动取消订阅。打通「番茄完成→热力图」等联动。
 */
export class EventBus extends Events {
  on<K extends EventName>(
    name: K,
    cb: (payload: HMEvents[K]) => void,
    ctx?: unknown
  ): EventRef {
    return super.on(name as string, cb as (...data: unknown[]) => void, ctx);
  }

  emit<K extends EventName>(name: K, payload: HMEvents[K]): void {
    super.trigger(name as string, payload);
  }
}
