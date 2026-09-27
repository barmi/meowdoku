import type { Progress } from './game';
import type { DayStats } from './stats';

export interface Settings {
  sound: boolean;
  vibrate: boolean;
  /** 고양이를 놓으면 주변을 자동으로 X */
  autoX: boolean;
}

export type ItemKey = 'cat' | 'bulb' | 'mouse';

export interface SaveData {
  v: 1;
  /** 지금 도전 중인 레벨 */
  level: number;
  /** 깬 레벨 중 가장 높은 것 */
  best: number;
  cleared: number;
  totalScore: number;
  items: Record<ItemKey, number>;
  settings: Settings;
  /** 'level' / 'daily' 별 진행 상태 */
  progress: Partial<Record<'level' | 'daily', Progress>>;
  daily: Record<string, { score: number; ms: number }>;
  seenHelp: boolean;
  rewardTurn: number;
  /** 날짜(YYYY-MM-DD)별 하루 통계 (#5) */
  stats: Record<string, DayStats>;
  /** 끝낸(클리어한) 판의 gameId — 다른 기기에서 이미 끝난 판을 이어가려는지 가려낸다 (#6) */
  finished: string[];
}

const KEY = 'meowdoku.save.v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    level: 1,
    best: 0,
    cleared: 0,
    totalScore: 0,
    items: { cat: 1, bulb: 1, mouse: 1 },
    settings: { sound: true, vibrate: true, autoX: false },
    progress: {},
    daily: {},
    seenHelp: false,
    rewardTurn: 0,
    stats: {},
    finished: [],
  };
}

/** 저장본(로컬이든 서버에서 받은 것이든)을 현재 형식으로 맞춘다. 알아볼 수 없으면 null */
export function normalizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SaveData>;
  if (data.v !== 1) return null;
  const base = defaultSave();
  return {
    ...base,
    ...data,
    items: { ...base.items, ...data.items },
    settings: { ...base.settings, ...data.settings },
    progress: { ...data.progress },
    daily: { ...data.daily },
    stats: { ...data.stats },
    finished: Array.isArray(data.finished) ? data.finished : [],
  };
}

/** localStorage 는 사생활 보호 모드 등에서 막힐 수 있다 — 실패해도 게임은 돈다 */
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && normalizeSave(JSON.parse(raw))) || defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장 불가 — 무시 */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
