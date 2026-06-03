import type { Card } from "ts-fsrs";
import { HMRecord } from "../../core/storage";

/** FSRS card 的可序列化形式（Date → ISO 字符串）。 */
export interface SerializedCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
  learning_steps?: number;
}

export interface VocabCard extends HMRecord {
  word: string;
  reading?: string;
  meaning: string;
  /** 来源等级（cet4/cet6/ielts/...），用于按等级统计 */
  level?: string;
  /** 错词本：答错(忘记/困难)置 true，答对(认识/简单)清除 */
  wrong?: boolean;
  fsrs: SerializedCard;
}

/** 复习记录，用于热力图与正确率（id = 随机；date 用复习日）。 */
export interface VocabReview extends HMRecord {
  cardId: string;
  date: string;
  /** 本次评分是否算作答对（认识/简单） */
  correct?: boolean;
}

export function serializeCard(c: Card): SerializedCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as number,
    last_review: c.last_review ? c.last_review.toISOString() : undefined,
    learning_steps: (c as unknown as { learning_steps?: number }).learning_steps,
  };
}

export function reviveCard(s: SerializedCard): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
    learning_steps: s.learning_steps ?? 0,
  } as unknown as Card;
}
