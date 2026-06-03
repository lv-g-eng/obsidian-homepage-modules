import { HMModule } from "../core/module";
// 效率
import { todoModule } from "./todo";
import { todayModule } from "./today";
import { pomodoroModule } from "./pomodoro";
import { pomodoroHeatmapModule } from "./pomodoro-heatmap";
import { timeblockModule } from "./timeblock";
import { countdownModule } from "./countdown";
import { captureModule } from "./capture";
// 习惯健康
import { habitModule } from "./habit";
import { moodModule } from "./mood";
import { waterModule } from "./water";
import { sleepModule } from "./sleep";
// 学习记忆
import { vocabModule } from "./vocab";
import { flashcardsModule } from "./flashcards";
import { readingModule } from "./reading";
import { reviewQueueModule } from "./review-queue";
// AI
import { aiChatModule } from "./ai-chat";
import { aiSummaryModule } from "./ai-summary";
import { aiBriefModule } from "./ai-brief";
// 财务
import { ledgerModule } from "./ledger";
import { budgetModule } from "./budget";
import { goalModule } from "./goal";
import { subsModule } from "./subs";
// 仪表盘
import { overviewModule } from "./overview";
import { calendarModule } from "./calendar";
import { weatherModule } from "./weather";
import { statsModule } from "./stats";
import { linksModule } from "./links";
import { clockModule } from "./clock";
// 工具
import { randomModule } from "./random";
import { quoteModule } from "./quote";

/**
 * 全部模块的中央注册表（28 个）。新增模块 = 在此 import 并加入数组。
 */
export const MODULES: HMModule[] = [
  // 效率 (7)
  todoModule,
  todayModule,
  pomodoroModule,
  pomodoroHeatmapModule,
  timeblockModule,
  countdownModule,
  captureModule,
  // 习惯健康 (4)
  habitModule,
  moodModule,
  waterModule,
  sleepModule,
  // 学习记忆 (4)
  vocabModule,
  flashcardsModule,
  readingModule,
  reviewQueueModule,
  // AI (3)
  aiChatModule,
  aiSummaryModule,
  aiBriefModule,
  // 财务 (4)
  ledgerModule,
  budgetModule,
  goalModule,
  subsModule,
  // 仪表盘 (6)
  overviewModule,
  calendarModule,
  weatherModule,
  statsModule,
  linksModule,
  clockModule,
  // 工具 (2)
  randomModule,
  quoteModule,
];
