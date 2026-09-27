import type { Progress } from './game';

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
  };
}

/** localStorage 는 사생활 보호 모드 등에서 막힐 수 있다 — 실패해도 게임은 돈다 */
export function loadSave(): SaveData {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.v !== 1) return base;
    return {
      ...base,
      ...data,
      items: { ...base.items, ...data.items },
      settings: { ...base.settings, ...data.settings },
      progress: { ...data.progress },
      daily: { ...data.daily },
    };
  } catch {
    return base;
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
