import { Geometry, popcount } from './geometry';

/**
 * 풀이 상태: 아직 고양이가 올 수 있는 칸(후보)과 확정된 고양이.
 * 고양이를 놓으면 같은 행·열·영역과 주변 8칸은 즉시 후보에서 빠진다.
 */
export interface LState {
  /** 후보 칸 — 행별 비트마스크 */
  cand: Int32Array;
  /** 행 → 고양이 열, 없으면 -1 */
  cats: Int8Array;
  /** unit 별 고양이 확정 여부 */
  solved: Uint8Array;
  placed: number;
}

export function emptyState(g: Geometry): LState {
  return {
    cand: new Int32Array(g.n).fill(g.full),
    cats: new Int8Array(g.n).fill(-1),
    solved: new Uint8Array(3 * g.n),
    placed: 0,
  };
}

export function cloneState(s: LState): LState {
  return { cand: s.cand.slice(), cats: s.cats.slice(), solved: s.solved.slice(), placed: s.placed };
}

export function placeCat(g: Geometry, s: LState, cell: number): void {
  const n = g.n;
  const r = Math.floor(cell / n);
  s.cats[r] = cell % n;
  s.placed++;
  for (const u of g.cellUnits[cell]) s.solved[u] = 1;
  const peers = g.peerMasks[cell];
  for (let k = 0; k < n; k++) s.cand[k] &= ~peers[k];
  s.cand[r] &= ~(1 << (cell % n));
}

export function eliminate(g: Geometry, s: LState, cell: number): void {
  s.cand[Math.floor(cell / g.n)] &= ~(1 << (cell % g.n));
}

export function isCand(g: Geometry, s: LState, cell: number): boolean {
  return (s.cand[Math.floor(cell / g.n)] & (1 << (cell % g.n))) !== 0;
}

export function unitCount(g: Geometry, s: LState, u: number): number {
  const m = g.unitMasks[u];
  let k = 0;
  for (let r = 0; r < g.n; r++) {
    const x = s.cand[r] & m[r];
    if (x) k += popcount(x);
  }
  return k;
}

export function unitCands(g: Geometry, s: LState, u: number): number[] {
  const out: number[] = [];
  for (const cell of g.unitCells[u]) if (isCand(g, s, cell)) out.push(cell);
  return out;
}

/** 사용자 판(고양이·X) → 풀이 상태. X 는 전부 옳다고 가정한다(틀린 X 는 호출 전에 걸러낼 것). */
export function stateFromMarks(g: Geometry, cats: Iterable<number>, xs: Iterable<number>): LState {
  const s = emptyState(g);
  for (const x of xs) eliminate(g, s, x);
  for (const c of cats) placeCat(g, s, c);
  return s;
}
