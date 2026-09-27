import { generate, givenOptions } from './generator';
import { Geometry } from './geometry';
import { HANDCRAFTED } from './handcrafted';
import { LogicEngine, TECH } from './logic';
import { hashSeed, rngFor } from './rng';
import { findSolutions } from './solver';
import { emptyState, placeCat } from './state';
import type { ColorKey, Puzzle } from './types';

const signature = (size: number, regions: number[], givens: number[]) =>
  hashSeed(`${size}|${regions.join(',')}|${givens.join(',')}`).toString(36);

/*
 * 판 번호와 난이도는 따로 논다 (#4).
 * - 화면·코드의 "레벨 N" 은 판 번호다 (원본 화면 표기를 그대로 따름). 1, 2, 3 … 순서대로 진행하고
 *   같은 번호면 언제나 같은 판이다.
 * - 판 크기와 난이도는 판 번호를 시드로 무작위로 정한다 — 번호가 커진다고 어려워지지 않는다.
 * - 701·702 는 스크린샷 판 그대로.
 */
export type Tier = 'easy' | 'normal' | 'hard';

const SIZE_WEIGHTS: [number, number][] = [
  [5, 6],
  [6, 14],
  [7, 22],
  [8, 30],
  [9, 18],
  [10, 10],
];
const TIER_WEIGHTS: [Tier, number][] = [
  ['easy', 30],
  ['normal', 40],
  ['hard', 30],
];
const TIER_TECH: Record<Tier, { maxTech: number; minTech: number }> = {
  easy: { maxTech: TECH.attack, minTech: 0 },
  normal: { maxTech: TECH.subset, minTech: TECH.attack },
  hard: { maxTech: TECH.contradiction, minTech: TECH.subset },
};

function weighted<T>(rng: () => number, table: [T, number][]): T {
  let x = rng() * table.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of table) {
    if ((x -= w) < 0) return v;
  }
  return table[table.length - 1][0];
}

const boardRng = (level: number) => rngFor(`meowdoku:board:${level}`);

/** 판 번호 → 판 크기와 목표 난이도 (같은 번호면 언제나 같다) */
export function boardSpec(level: number): { size: number; tier: Tier } {
  const h = HANDCRAFTED[level];
  if (h) return { size: h.grid.length, tier: 'normal' };
  const rng = boardRng(level);
  return { size: weighted(rng, SIZE_WEIGHTS), tier: weighted(rng, TIER_WEIGHTS) };
}

/** 실제로 풀 때 필요한 기법으로 매긴 난이도 — 목표 난이도에 못 미쳐도 거짓 표시를 하지 않는다 */
export function difficultyOf(p: Puzzle): { label: string; stars: number } {
  if (p.tech <= TECH.line) return { label: '쉬움', stars: 1 };
  if (p.tech === TECH.attack) return { label: '보통', stars: 2 };
  if (p.tech === TECH.subset) return { label: '어려움', stars: 3 };
  return { label: '아주 어려움', stars: 4 };
}

const cache = new Map<string, Puzzle>();

function fromHandcrafted(id: string, level: number): Puzzle {
  const h = HANDCRAFTED[level];
  const n = h.grid.length;
  const colors: ColorKey[] = [];
  const regions: number[] = [];
  for (const row of h.grid) {
    for (const color of row) {
      let k = colors.indexOf(color);
      if (k < 0) k = colors.push(color) - 1;
      regions.push(k);
    }
  }
  const g = new Geometry(n, regions);
  // 정답은 스크린샷에서 열려 있던 고양이를 넣고 구한다 (그 칸은 반드시 정답이다)
  const opened = h.opened[0] * n + h.opened[1];
  const withOpened = emptyState(g);
  placeCat(g, withOpened, opened);
  const sols = findSolutions(g, 2, withOpened);
  if (sols.length !== 1) throw new Error(`handcrafted level ${level} is not unique`);
  const solution = sols[0];
  const options = givenOptions(g, solution, [opened]);
  if (!options) throw new Error(`handcrafted level ${level} needs more than one opened cat`);
  const givens = options[0];
  return {
    id,
    size: n,
    regions,
    colors,
    solution,
    givens,
    tech: new LogicEngine(g).grade(TECH.contradiction, givens),
    sig: signature(n, regions, givens),
  };
}

export function levelPuzzle(level: number): Puzzle {
  const id = `L${level}`;
  const hit = cache.get(id);
  if (hit) return hit;
  let puzzle: Puzzle;
  if (HANDCRAFTED[level]) {
    puzzle = fromHandcrafted(id, level);
  } else {
    const rng = boardRng(level);
    const size = weighted(rng, SIZE_WEIGHTS);
    const tier = weighted(rng, TIER_WEIGHTS);
    const gen = generate(rng, { size, ...TIER_TECH[tier] });
    puzzle = { id, size, ...gen, sig: signature(size, gen.regions, gen.givens) };
  }
  cache.set(id, puzzle);
  return puzzle;
}

/** 오늘의 퍼즐 — 날짜마다 9×9 하나 (스크린샷의 레벨 표시 없는 화면) */
export function dailyPuzzle(dateKey: string): Puzzle {
  const id = `D${dateKey}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 9;
  const gen = generate(rngFor(`meowdoku:daily:${dateKey}`), { size, maxTech: TECH.contradiction, minTech: TECH.subset });
  const puzzle = { id, size, ...gen, sig: signature(size, gen.regions, gen.givens) };
  cache.set(id, puzzle);
  return puzzle;
}

export function todayKey(d = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
