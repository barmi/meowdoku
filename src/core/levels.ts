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

/** 레벨이 오를수록 판이 커진다. 701 은 스크린샷처럼 8×8, 702 는 9×9. */
export function sizeForLevel(level: number): number {
  if (level <= 10) return 5;
  if (level <= 30) return 6;
  if (level <= 100) return 7;
  if (level <= 400) return 8;
  if (level <= 1000) return level % 3 === 0 ? 9 : 8;
  return [10, 8, 9][level % 3];
}

function difficulty(size: number): { maxTech: number; minTech: number } {
  if (size <= 5) return { maxTech: TECH.attack, minTech: 0 };
  if (size === 6) return { maxTech: TECH.subset, minTech: TECH.line };
  return { maxTech: TECH.contradiction, minTech: TECH.attack };
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
    const size = sizeForLevel(level);
    const gen = generate(rngFor(`meowdoku:level:${level}`), { size, ...difficulty(size) });
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
