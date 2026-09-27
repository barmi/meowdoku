import type { Progress } from './game';
import type { DayStats } from './stats';
import type { SaveData } from './storage';

/**
 * 두 기기가 같은 기준(base = 마지막으로 서버와 맞춘 상태)에서 각자 바꿨을 때 합친다 (#6).
 * 최상위 항목마다 3-way: 한쪽만 바꿨으면 그쪽을, 둘 다 바꿨으면 항목별 규칙을 따른다.
 */
const json = (v: unknown) => JSON.stringify(v ?? null);
const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** 판의 "실제 진행"이 같은가 — 흐른 시간·점수 같은 부수 값은 보지 않는다 */
export function sameGame(a?: Progress, b?: Progress): boolean {
  if (!a || !b) return !a && !b;
  return a.gameId === b.gameId && a.marks === b.marks && a.fish === b.fish && a.status === b.status;
}

/**
 * 서버 최신 상태(remote)에서 본, 이 기기가 붙잡고 있는 판(mode·gameId)의 처지.
 * - finished: 다른 곳에서 이미 끝났다
 * - other: 다른 곳에서 다른 판으로 바뀌었다
 * - advanced: 같은 판을 다른 곳에서 더 진행했다
 * - untouched: 다른 곳은 이 판을 건드리지 않았다 (다른 항목만 바뀜)
 */
export type Standing = 'finished' | 'other' | 'advanced' | 'untouched';

export function standingOf(remote: SaveData, base: SaveData, mode: 'level' | 'daily', gameId: string): Standing {
  if (remote.finished.includes(gameId)) return 'finished';
  const rp = remote.progress[mode];
  if (sameGame(rp, base.progress[mode])) return 'untouched';
  return rp?.gameId === gameId ? 'advanced' : 'other';
}

function mergeDay(a: DayStats, b: DayStats): DayStats {
  const max = (x: number, y: number) => Math.max(x || 0, y || 0);
  const clears = [...a.clears];
  for (const c of b.clears) if (!clears.some((x) => x.at === c.at && x.level === c.level)) clears.push(c);
  clears.sort((x, y) => x.at - y.at);
  return {
    boards: [...new Set([...a.boards, ...b.boards])],
    cleared: max(a.cleared, b.cleared),
    gameOvers: max(a.gameOvers, b.gameOvers),
    playMs: max(a.playMs, b.playMs),
    score: max(a.score, b.score),
    cats: max(a.cats, b.cats),
    mistakes: max(a.mistakes, b.mistakes),
    items: {
      cat: max(a.items.cat, b.items.cat),
      bulb: max(a.items.bulb, b.items.bulb),
      mouse: max(a.items.mouse, b.items.mouse),
    },
    hours: a.hours.map((h, i) => max(h, b.hours[i])),
    clears,
  };
}

/** 통계는 날마다 늘기만 하는 값이라 큰 쪽을 택한다 (양쪽에서 동시에 늘린 몫은 조금 덜 셀 수 있다) */
export function mergeStats(a: Record<string, DayStats>, b: Record<string, DayStats>): Record<string, DayStats> {
  const out: Record<string, DayStats> = clone(b);
  for (const [day, d] of Object.entries(a)) out[day] = out[day] ? mergeDay(d, out[day]) : clone(d);
  return out;
}

function mergeProgress(
  base: SaveData['progress'],
  local: SaveData['progress'],
  remote: SaveData['progress'],
): SaveData['progress'] {
  const out: SaveData['progress'] = {};
  for (const mode of ['level', 'daily'] as const) {
    const b = base[mode];
    const l = local[mode];
    const r = remote[mode];
    let pick: Progress | undefined;
    if (json(l) === json(b)) pick = r;
    else if (json(r) === json(b)) pick = l;
    // 둘 다 바꿈: 다른 곳이 판을 실제로 진행했으면 그쪽, 아니면(시간만 흐름) 이 기기의 마지막 액션
    else pick = sameGame(r, b) ? l : r;
    if (pick) out[mode] = clone(pick);
  }
  return out;
}

export function merge3(base: SaveData, local: SaveData, remote: SaveData): SaveData {
  const out = clone(remote) as unknown as Record<string, unknown>;
  const B = base as unknown as Record<string, unknown>;
  const L = local as unknown as Record<string, unknown>;
  const R = remote as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(L), ...Object.keys(R)])) {
    const b = json(B[k]);
    const l = json(L[k]);
    const r = json(R[k]);
    if (l === b || l === r) continue; // 이 기기는 안 바꿈 → 서버 값
    if (r === b) {
      out[k] = clone(L[k]); // 서버는 안 바꿈 → 이 기기 값
      continue;
    }
    switch (k) {
      case 'progress':
        out[k] = mergeProgress(base.progress, local.progress, remote.progress);
        break;
      case 'stats':
        out[k] = mergeStats(local.stats, remote.stats);
        break;
      case 'finished':
        out[k] = [...new Set([...remote.finished, ...local.finished])].slice(-50);
        break;
      case 'daily':
        out[k] = { ...remote.daily, ...local.daily };
        break;
      case 'level':
      case 'best':
      case 'cleared':
      case 'totalScore':
      case 'rewardTurn':
        out[k] = Math.max(Number(L[k]) || 0, Number(R[k]) || 0);
        break;
      default:
        out[k] = clone(L[k]); // 나머지(아이템·설정 등)는 마지막 액션을 한 이 기기 값
    }
  }
  return out as unknown as SaveData;
}
