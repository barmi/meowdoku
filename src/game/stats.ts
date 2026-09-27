import { todayKey } from '../core/levels';
import type { ItemKey, SaveData } from './storage';

/** 하루 통계 (#5). 날짜별로 localStorage(SaveData.stats)에 쌓는다. */
export interface ClearRecord {
  /** 클리어한 시각 (epoch ms) */
  at: number;
  mode: 'level' | 'daily';
  /** 판 번호 (오늘의 퍼즐은 0) */
  level: number;
  size: number;
  /** 난이도 이름 (쉬움/보통/어려움/아주 어려움) */
  diff: string;
  /** 걸린 시간 (ms) */
  ms: number;
  score: number;
  mistakes: number;
}

export interface DayStats {
  /** 그날 손댄 판 id (중복 없음) — "플레이한 판" */
  boards: string[];
  cleared: number;
  gameOvers: number;
  /** 판을 보고 있던 시간 (창이 떠 있거나 앱이 가려진 시간은 뺀다) */
  playMs: number;
  score: number;
  /** 직접 맞힌 고양이 */
  cats: number;
  /** 틀린 고양이 = 잃은 물고기 */
  mistakes: number;
  items: Record<ItemKey, number>;
  /** 0~23시 시간대별 플레이 시간 (ms) */
  hours: number[];
  clears: ClearRecord[];
}

export const emptyDay = (): DayStats => ({
  boards: [],
  cleared: 0,
  gameOvers: 0,
  playMs: 0,
  score: 0,
  cats: 0,
  mistakes: 0,
  items: { cat: 0, bulb: 0, mouse: 0 },
  hours: new Array<number>(24).fill(0),
  clears: [],
});

/** 이보다 오래된 날은 지운다 */
export const KEEP_DAYS = 90;

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + delta));
}

const active = (d: DayStats | undefined) => !!d && (d.boards.length > 0 || d.playMs > 0);

export class Stats {
  private readonly host: { save: SaveData };
  private readonly now: () => Date;

  constructor(host: { save: SaveData }, now: () => Date = () => new Date()) {
    this.host = host;
    this.now = now;
  }

  private get all(): Record<string, DayStats> {
    return this.host.save.stats;
  }

  /** 오늘 기록 (없으면 만든다) */
  today(): DayStats {
    const key = todayKey(this.now());
    this.all[key] ??= emptyDay();
    return this.all[key];
  }

  /** 읽기 전용 — 기록 없는 날은 null (만들지 않는다) */
  peek(key: string): DayStats | null {
    return this.all[key] ?? null;
  }

  touch(boardId: string): void {
    const d = this.today();
    if (!d.boards.includes(boardId)) d.boards.push(boardId);
  }

  addTime(ms: number): void {
    const d = this.today();
    d.playMs += ms;
    d.hours[this.now().getHours()] += ms;
  }

  cat(): void {
    this.today().cats++;
  }

  mistake(): void {
    this.today().mistakes++;
  }

  gameOver(): void {
    this.today().gameOvers++;
  }

  item(key: ItemKey): void {
    this.today().items[key]++;
  }

  cleared(rec: ClearRecord): void {
    const d = this.today();
    d.cleared++;
    d.score += rec.score;
    d.clears.push(rec);
    this.prune();
  }

  /** key 날까지 이어서 플레이한 날 수 (key 날에 기록이 없으면 0) */
  streak(key: string): number {
    let n = 0;
    for (let k = key; active(this.all[k]); k = shiftDay(k, -1)) n++;
    return n;
  }

  prune(): void {
    const oldest = shiftDay(todayKey(this.now()), -KEEP_DAYS);
    for (const key of Object.keys(this.all)) if (key < oldest) delete this.all[key];
  }
}
