import { describe, expect, it } from 'vitest';
import { generate, givenOptions, growRegions, randomSolution } from '../src/core/generator';
import { Geometry, neighbors4 } from '../src/core/geometry';
import { boardSpec, dailyPuzzle, difficultyOf, levelPuzzle } from '../src/core/levels';
import { LogicEngine, TECH } from '../src/core/logic';
import { rngFor } from '../src/core/rng';
import { findSolutions } from '../src/core/solver';
import { emptyState, placeCat, stateFromMarks } from '../src/core/state';
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
  for (const c of p.givens) placeCat(g, s, c);
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
  // 오픈은 필요할 때만: 없으면 그대로 해가 하나, 있으면(1마리) 오픈 없이는 해가 여럿이고 오픈하면 하나
  const g = new Geometry(n, p.regions);
  expect(p.givens.length).toBeLessThanOrEqual(1);
  if (p.givens.length === 0) {
    expect(findSolutions(g, 2)).toEqual([p.solution]);
  } else {
    expect(findSolutions(g, 2)).toHaveLength(2);
    const s = emptyState(g);
    for (const gv of p.givens) placeCat(g, s, gv);
    expect(findSolutions(g, 2, s)).toEqual([p.solution]);
  }
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
    // 원본은 3행 4열을 열어 두지만, 오픈 없이도 해가 하나라서 열지 않는다
    expect(p.givens).toEqual([]);
    checkPuzzle(p);
  });

  it('레벨 702 (9×9) 는 유일해다', () => {
    const p = levelPuzzle(702);
    expect(p.size).toBe(9);
    expect(p.solution).toEqual([4, 7, 5, 3, 1, 6, 2, 0, 8]);
    expect(p.givens).toEqual([]);
    checkPuzzle(p);
  });
});

describe('생성기', () => {
  for (const size of [5, 6, 7, 8, 9, 10]) {
    it(`${size}×${size} 퍼즐은 규칙에 맞고 유일해이며 논리로 풀린다`, () => {
      for (let seed = 0; seed < (size >= 9 ? 4 : 8); seed++) {
        const gen = generate(rngFor(`test:${size}:${seed}`), { size, maxTech: TECH.contradiction });
        checkPuzzle({ id: 't', size, ...gen, sig: '' });
      }
    });
  }

  it('같은 레벨은 항상 같은 퍼즐', () => {
    const a = generate(rngFor('same'), { size: 7, maxTech: TECH.contradiction });
    const b = generate(rngFor('same'), { size: 7, maxTech: TECH.contradiction });
    expect(a).toEqual(b);
  });

  it('판 번호가 커져도 판 크기·난이도는 랜덤이고, 같은 번호면 같은 판', () => {
    const sizes = [...Array(300).keys()].map((k) => boardSpec(k + 1).size);
    expect(new Set(sizes).size).toBeGreaterThanOrEqual(5);
    // 번호가 커진다고 커지지 않는다: 앞 번호보다 작은 판이 뒤에 나온다
    expect(sizes.some((s, i) => i > 0 && s < sizes[i - 1])).toBe(true);
    expect(new Set(sizes.map((_, i) => boardSpec(i + 1).tier)).size).toBe(3);
    for (const level of [1, 7, 42]) {
      const p = levelPuzzle(level);
      expect(p.size).toBe(boardSpec(level).size);
      expect(p).toBe(levelPuzzle(level));
    }
    expect(boardSpec(701).size).toBe(8);
    expect(boardSpec(702).size).toBe(9);
    const labels = new Set([...Array(40).keys()].map((k) => difficultyOf(levelPuzzle(k + 1)).label));
    expect(labels.size).toBeGreaterThanOrEqual(2);
  });

  it('생성된 레벨은 오픈 없이도 해가 하나라서 아무것도 열지 않는다', () => {
    for (let level = 1; level <= 40; level++) expect(levelPuzzle(level).givens).toEqual([]);
  });

  it('여러 레벨과 오늘의 퍼즐이 만들어진다', () => {
    for (const level of [1, 2, 10, 11, 31, 101, 401, 1003]) checkPuzzle(levelPuzzle(level));
    checkPuzzle(dailyPuzzle('2026-09-27'));
  });
});

/** 영역만 키우고 경계를 고치지 않은, 해가 여러 개인 판 */
function ambiguousBoard(): { n: number; regions: number[]; solution: number[] } {
  for (let seed = 0; ; seed++) {
    const rng = rngFor(`ambiguous:${seed}`);
    const n = 7;
    const solution = randomSolution(rng, n);
    const regions = growRegions(rng, n, solution);
    const g = new Geometry(n, regions);
    if (findSolutions(g, 2).length === 2 && givenOptions(g, solution)) return { n, regions, solution };
  }
}

describe('오픈(처음부터 놓인 고양이)', () => {
  it('해가 하나인 판은 오픈하지 않는다', () => {
    const p = levelPuzzle(701);
    expect(givenOptions(new Geometry(p.size, p.regions), p.solution)).toEqual([[]]);
  });

  it('해가 여러 개인 판은 1마리만 열면 유일해가 되는 정답 칸을 고른다', () => {
    const { n, regions, solution } = ambiguousBoard();
    const g = new Geometry(n, regions);
    const options = givenOptions(g, solution)!;
    expect(options.length).toBeGreaterThan(0);
    for (const [cell] of options) {
      expect(solution[Math.floor(cell / n)]).toBe(cell % n);
      const s = emptyState(g);
      placeCat(g, s, cell);
      expect(findSolutions(g, 2, s)).toEqual([solution]);
    }
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
