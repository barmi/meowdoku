import { Geometry, neighbors4 } from './geometry';
import { LogicEngine } from './logic';
import { COLOR_ORDER, SIMILAR } from './palette';
import { type Rng, shuffle } from './rng';
import { findSolutions } from './solver';
import { emptyState, placeCat } from './state';
import type { ColorKey } from './types';

/**
 * 퍼즐 생성
 * 1) 규칙을 지키는 고양이 배치(정답)를 먼저 뽑는다.
 * 2) 고양이 칸을 씨앗으로 영역을 무작위로 키운다.
 * 3) 해가 여러 개면, 다른 해에만 있는 고양이 칸을 이웃 영역으로 넘겨 그 해를 깨뜨린다
 *    (정답 칸은 건드리지 않으므로 정답은 그대로 유효하다) — 오픈 없이 유일해가 될 때까지 반복.
 *    막히면 판을 새로 만든다.
 * 4) 논리 엔진으로 "찍지 않고" 풀리는지, 난이도가 맞는지 확인한다.
 *
 * 오픈(처음부터 놓인 고양이): 원본 게임이 정답 하나를 열어 두는 건 문제에 경우의 수가 있어서
 * 부득이 연 것이다. 여기서는 오픈 없이 해가 하나인 판을 만들 수 있으니 열지 않는다.
 * 1마리 오픈은 그런 판을 끝내 못 만들 때만 쓰는 안전장치이고, 영역을 바꿀 수 없는 스크린샷
 * 판(handcrafted)도 같은 규칙(givenOptions)으로 판단한다.
 */
export interface GenOptions {
  size: number;
  /** 허용하는 최고 기법 단계 (logic.ts TECH) */
  maxTech: number;
  /** 가능하면 이 단계 이상이 필요한 퍼즐을 고른다 */
  minTech?: number;
}

export interface Generated {
  regions: number[];
  solution: number[];
  colors: ColorKey[];
  givens: number[];
  tech: number;
}

export function randomSolution(rng: Rng, n: number): number[] {
  const sol = new Array<number>(n).fill(-1);
  const used = new Array<boolean>(n).fill(false);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    for (const c of shuffle(rng, Array.from({ length: n }, (_, i) => i))) {
      if (used[c] || (r > 0 && Math.abs(sol[r - 1] - c) <= 1)) continue;
      sol[r] = c;
      used[c] = true;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  if (!rec(0)) throw new Error(`no cat placement for size ${n}`);
  return sol;
}

/** i → j 방향으로 j 너머 한 칸 (판 밖이면 -1) */
function beyond(n: number, i: number, j: number): number {
  const d = j - i;
  if (d === 1 || d === -1) {
    const c = (j % n) + d;
    return c >= 0 && c < n ? j + d : -1;
  }
  const b = j + d;
  return b >= 0 && b < n * n ? b : -1;
}

function weightedIndex(rng: Rng, ws: number[]): number {
  let x = rng() * ws.reduce((a, b) => a + b, 0);
  let i = 0;
  while (i < ws.length - 1 && x >= ws[i]) x -= ws[i++];
  return i;
}

/**
 * 영역 k 의 씨앗 = k 행의 정답 칸. 매 걸음마다 "영역"을 먼저 고르고(크기와 무관하게 성향
 * 가중치로) 그 영역 둘레의 칸 하나를 붙인다 — 칸을 먼저 고르면 큰 영역이 계속 커진다.
 * 곧게 뻗는 성향이 있는 영역은 스크린샷의 가로·세로 띠 모양이 된다.
 */
export function growRegions(rng: Rng, n: number, sol: number[]): number[] {
  const N = n * n;
  const reg = new Array<number>(N).fill(-1);
  for (let r = 0; r < n; r++) reg[r * n + sol[r]] = r;
  const weight = Array.from({ length: n }, () => (rng() < 0.12 ? 0.15 : 0.55 + rng()));
  const straight = Array.from({ length: n }, () => (rng() < 0.4 ? 2 + 4 * rng() : 1));
  for (let left = N - n; left > 0; left--) {
    const frontier: number[][] = Array.from({ length: n }, () => []);
    const fw: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < N; i++) {
      if (reg[i] !== -1) continue;
      for (const j of neighbors4(n, i)) {
        const k = reg[j];
        if (k === -1) continue;
        const b = beyond(n, i, j);
        frontier[k].push(i);
        fw[k].push(b >= 0 && reg[b] === k ? straight[k] : 1);
      }
    }
    const k = weightedIndex(
      rng,
      weight.map((w, idx) => (frontier[idx].length ? w : 0)),
    );
    reg[frontier[k][weightedIndex(rng, fw[k])]] = k;
  }
  return reg;
}

function connectedWithout(n: number, reg: number[], region: number, removed: number, seed: number): boolean {
  let total = 0;
  for (let i = 0; i < reg.length; i++) if (reg[i] === region && i !== removed) total++;
  const seen = new Set<number>([seed]);
  const stack = [seed];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of neighbors4(n, i)) {
      if (j === removed || reg[j] !== region || seen.has(j)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen.size === total;
}

/**
 * 오픈 후보: 오픈 없이 해가 하나면 [[]] (열 필요 없음), 여러 개면 한 마리만 열어도 유일해가 되는
 * 정답 칸들 [[a], [b], …] (prefer 를 앞에), 한 마리로 안 되면 null.
 */
export function givenOptions(g: Geometry, sol: number[], prefer: number[] = []): number[][] | null {
  if (findSolutions(g, 2).length === 1) return [[]];
  const n = g.n;
  const cells = sol.map((c, r) => r * n + c);
  const order = [...prefer.filter((c) => cells.includes(c)), ...cells.filter((c) => !prefer.includes(c))];
  const out: number[][] = [];
  for (const cell of order) {
    const s = emptyState(g);
    placeCat(g, s, cell);
    if (findSolutions(g, 2, s).length === 1) out.push([cell]);
  }
  return out.length ? out : null;
}

/** 다른 해 alt 에만 있는 고양이 칸 하나를 이웃 영역으로 넘겨 alt 를 깨뜨린다. 못 하면 false. */
function breakAlternative(rng: Rng, n: number, reg: number[], sol: number[], alt: number[]): boolean {
  const cells = shuffle(
    rng,
    alt.flatMap((c, r) => (c !== sol[r] ? [r * n + c] : [])),
  );
  for (const cell of cells) {
    const a = reg[cell];
    if (!connectedWithout(n, reg, a, cell, a * n + sol[a])) continue;
    const nbs = neighbors4(n, cell).filter((j) => reg[j] !== a);
    if (!nbs.length) continue;
    reg[cell] = reg[shuffle(rng, nbs)[0]];
    return true;
  }
  return false;
}

/** 오픈 없이 해가 하나가 될 때까지 다른 해의 고양이 칸을 이웃 영역으로 넘긴다(reg 를 직접 바꾼다). */
export function makeUnique(rng: Rng, n: number, reg: number[], sol: number[], maxIter = 120): boolean {
  for (let iter = 0; iter < maxIter; iter++) {
    const sols = findSolutions(new Geometry(n, reg), 2);
    if (sols.length === 1) return true;
    const alt = sols.find((s) => s.some((c, r) => c !== sol[r]));
    if (!alt || !breakAlternative(rng, n, reg, sol, alt)) return false;
  }
  return false;
}

function regionSizes(n: number, reg: number[]): number[] {
  const sizes = new Array<number>(n).fill(0);
  for (const k of reg) sizes[k]++;
  return sizes;
}

/** 비슷한 색(청록/하늘 등)이 맞닿지 않게 색을 배정한다 */
export function assignColors(rng: Rng, n: number, reg: number[]): ColorKey[] {
  const touching = new Set<number>();
  for (let i = 0; i < reg.length; i++) {
    for (const j of neighbors4(n, i)) if (reg[i] !== reg[j]) touching.add(reg[i] * 32 + reg[j]);
  }
  const chosen = shuffle(rng, COLOR_ORDER.slice()).slice(0, n);
  let colors = chosen;
  for (let t = 0; t < 80; t++) {
    colors = t === 0 ? chosen : shuffle(rng, chosen.slice());
    const clash = SIMILAR.some(([a, b]) => {
      const ia = colors.indexOf(a);
      const ib = colors.indexOf(b);
      return ia >= 0 && ib >= 0 && touching.has(ia * 32 + ib);
    });
    if (!clash) return colors;
  }
  return colors;
}

type Candidate = { reg: number[]; sol: number[]; givens: number[]; tech: number };

export function generate(rng: Rng, opts: GenOptions): Generated {
  const n = opts.size;
  const minTech = opts.minTech ?? 0;
  let best: Candidate | null = null;
  // 오픈 1마리가 필요한 판 — 오픈 없이 해가 하나인 판을 끝내 못 만들 때만 쓰는 안전장치
  let fallback: Candidate | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const sol = randomSolution(rng, n);
    const reg = growRegions(rng, n, sol);
    const unique = makeUnique(rng, n, reg, sol);
    if (!unique && fallback) continue;
    // 한 칸짜리 영역은 공짜 고양이라서 큰 판에만 하나까지, 너무 큰 영역도 거른다
    const sizes = regionSizes(n, reg);
    if (sizes.filter((s) => s === 1).length > (n >= 8 ? 1 : 0)) continue;
    if (Math.max(...sizes) > Math.ceil(2.3 * n)) continue;
    const g = new Geometry(n, reg);
    const engine = new LogicEngine(g);
    if (!unique) {
      for (const givens of shuffle(rng, givenOptions(g, sol) ?? [])) {
        const tech = engine.grade(opts.maxTech, givens);
        if (Number.isFinite(tech)) {
          fallback = { reg, sol, givens, tech };
          break;
        }
      }
      continue;
    }
    const tech = engine.grade(opts.maxTech);
    if (!Number.isFinite(tech)) continue;
    if (!best || tech > best.tech) best = { reg, sol, givens: [], tech };
    if (tech >= minTech || attempt >= 60) break;
  }
  const pick = best ?? fallback;
  if (!pick) throw new Error(`failed to generate a ${n}x${n} puzzle`);
  const { reg, sol, givens, tech } = pick;
  return { regions: reg, solution: sol, colors: assignColors(rng, n, reg), givens, tech };
}
