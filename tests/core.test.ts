import { describe, expect, it } from 'vitest';
import { generate } from '../src/core/generator';
import { Geometry, neighbors4 } from '../src/core/geometry';
import { dailyPuzzle, levelPuzzle, sizeForLevel } from '../src/core/levels';
import { LogicEngine, TECH } from '../src/core/logic';
import { rngFor } from '../src/core/rng';
import { findSolutions } from '../src/core/solver';
import { emptyState, stateFromMarks } from '../src/core/state';
import type { Puzzle } from '../src/core/types';

function isValidSolution(n: number, regions: number[], sol: number[]): boolean {
  const cols = new Set(sol);
  const regs = new Set(sol.map((c, r) => regions[r * n + c]));
  if (cols.size !== n || regs.size !== n) return false;
  for (let r = 1; r < n; r++) if (Math.abs(sol[r] - sol[r - 1]) <= 1) return false;
  return true;
}

function regionsConnected(n: number, regions: number[]): boolean {
  for (let k = 0; k < n; k++) {
    const cells = regions.flatMap((x, i) => (x === k ? [i] : []));
    if (!cells.length) return false;
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const i = stack.pop()!;
      for (const j of neighbors4(n, i)) {
        if (regions[j] === k && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

/** 논리 엔진이 내놓는 모든 수가 정답과 맞는지 따라가며 확인 */
function logicAgreesWithSolution(p: Puzzle): boolean {
  const g = new Geometry(p.size, p.regions);
  const engine = new LogicEngine(g);
  const s = emptyState(g);
  const solCells = new Set(p.solution.map((c, r) => r * p.size + c));
  while (s.placed < p.size) {
    const d = engine.next(s);
    if (!d) return false;
    if (d.place !== undefined && !solCells.has(d.place)) return false;
    if (d.eliminate.some((e) => solCells.has(e))) return false;
    engine.apply(s, d);
  }
  return true;
}

function checkPuzzle(p: Puzzle): void {
  const n = p.size;
  expect(p.regions).toHaveLength(n * n);
  expect(p.colors).toHaveLength(n);
  expect(new Set(p.colors).size).toBe(n);
  expect(regionsConnected(n, p.regions)).toBe(true);
  expect(isValidSolution(n, p.regions, p.solution)).toBe(true);
  const sols = findSolutions(new Geometry(n, p.regions), 2);
  expect(sols).toEqual([p.solution]);
  for (const gv of p.givens) expect(p.solution[Math.floor(gv / n)]).toBe(gv % n);
  expect(Number.isFinite(p.tech)).toBe(true);
  expect(logicAgreesWithSolution(p)).toBe(true);
}

describe('스크린샷 퍼즐', () => {
  it('레벨 701 (8×8) 은 유일해이고 정답이 스크린샷과 같다', () => {
    const p = levelPuzzle(701);
    expect(p.size).toBe(8);
    // 1-based: (1,3) (2,1) (3,4) (4,2) (5,6) (6,8) (7,5) (8,7)
    expect(p.solution).toEqual([2, 0, 3, 1, 5, 7, 4, 6]);
    expect(p.givens).toEqual([2 * 8 + 3]);
    checkPuzzle(p);
  });

  it('레벨 702 (9×9) 는 유일해다', () => {
    const p = levelPuzzle(702);
    expect(p.size).toBe(9);
    expect(p.solution).toEqual([4, 7, 5, 3, 1, 6, 2, 0, 8]);
    checkPuzzle(p);
  });
});

describe('생성기', () => {
  for (const size of [5, 6, 7, 8, 9, 10]) {
    it(`${size}×${size} 퍼즐은 규칙에 맞고 유일해이며 논리로 풀린다`, () => {
      for (let seed = 0; seed < (size >= 9 ? 4 : 8); seed++) {
        const gen = generate(rngFor(`test:${size}:${seed}`), { size, maxTech: TECH.contradiction });
        checkPuzzle({ id: 't', size, ...gen });
      }
    });
  }

  it('같은 레벨은 항상 같은 퍼즐', () => {
    const a = generate(rngFor('same'), { size: 7, maxTech: TECH.contradiction });
    const b = generate(rngFor('same'), { size: 7, maxTech: TECH.contradiction });
    expect(a).toEqual(b);
  });

  it('레벨별 판 크기', () => {
    expect(sizeForLevel(1)).toBe(5);
    expect(sizeForLevel(11)).toBe(6);
    expect(sizeForLevel(50)).toBe(7);
    expect(sizeForLevel(200)).toBe(8);
    expect(sizeForLevel(701)).toBe(8);
    expect(sizeForLevel(702)).toBe(9);
  });

  it('여러 레벨과 오늘의 퍼즐이 만들어진다', () => {
    for (const level of [1, 2, 10, 11, 31, 101, 401, 1003]) checkPuzzle(levelPuzzle(level));
    checkPuzzle(dailyPuzzle('2026-09-27'));
  });
});

describe('논리 엔진 힌트', () => {
  it('사용자 판에서도 다음 수가 정답과 맞다', () => {
    const p = levelPuzzle(701);
    const g = new Geometry(p.size, p.regions);
    const engine = new LogicEngine(g);
    // 스크린샷 IMG_4711 상태: 고양이 3마리
    const cats = [2 * 8 + 3, 6 * 8 + 4, 7 * 8 + 6];
    const s = stateFromMarks(g, cats, []);
    const d = engine.next(s);
    expect(d).not.toBeNull();
    const solCells = new Set(p.solution.map((c, r) => r * 8 + c));
    if (d!.place !== undefined) expect(solCells.has(d!.place)).toBe(true);
    for (const e of d!.eliminate) expect(solCells.has(e)).toBe(false);
    expect(d!.message.length).toBeGreaterThan(5);
  });
});
