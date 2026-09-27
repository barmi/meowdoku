import { Geometry } from '../core/geometry';
import { type Deduction, LogicEngine } from '../core/logic';
import { PALETTE } from '../core/palette';
import { stateFromMarks, unitCount } from '../core/state';
import type { Puzzle } from '../core/types';

export const EMPTY = 0;
export const X = 1;
export const CAT = 2;

export const MAX_FISH = 3;

export type CatSource = 'given' | 'user' | 'item' | 'hint';
export type Status = 'playing' | 'won' | 'lost';

/** 저장용 진행 상태 */
export interface Progress {
  id: string;
  marks: string;
  fish: number;
  score: number;
  combo: number;
  mistakes: number;
  elapsed: number;
  sinceCat: number;
  continued: boolean;
  status: Status;
}

export interface WinSummary {
  catPoints: number;
  fishBonus: number;
  perfectBonus: number;
  timeBonus: number;
  total: number;
  elapsed: number;
  mistakes: number;
}

export type GameEvent =
  | { type: 'marks'; cells: number[] }
  | { type: 'cat'; cell: number; source: CatSource; points: number }
  | { type: 'wrong'; cell: number }
  | { type: 'fish'; fish: number; delta: number }
  | { type: 'score'; score: number }
  | { type: 'won'; summary: WinSummary }
  | { type: 'lost' };

export interface MouseRun {
  line: 'row' | 'col';
  index: number;
  cells: number[];
}

/**
 * 게임 규칙과 점수. DOM 을 모르고 이벤트만 내보낸다.
 * - 빈 칸 탭 → X, X 탭 → 고양이. 고양이는 정답과 바로 대조한다.
 * - 틀리면 물고기(목숨) 하나를 잃고 그 칸은 X 가 된다. 맞힌 고양이는 고정된다.
 */
export class Game {
  readonly puzzle: Puzzle;
  readonly n: number;
  readonly geom: Geometry;
  readonly logic: LogicEngine;
  readonly marks: Uint8Array;
  readonly regionCells: number[][];
  private readonly solutionCells: Set<number>;
  private readonly listeners = new Set<(e: GameEvent) => void>();

  fish = MAX_FISH;
  score = 0;
  combo = 0;
  mistakes = 0;
  /** 플레이 시간(ms) */
  elapsed = 0;
  /** 마지막 고양이 이후 시간(ms) — 빠를수록 점수 보너스 */
  sinceCat = 0;
  continued = false;
  status: Status = 'playing';
  autoX = false;

  constructor(puzzle: Puzzle, saved?: Progress | null) {
    this.puzzle = puzzle;
    this.n = puzzle.size;
    this.geom = new Geometry(this.n, puzzle.regions);
    this.logic = new LogicEngine(this.geom, (r) => PALETTE[puzzle.colors[r]].name);
    this.marks = new Uint8Array(this.n * this.n);
    this.solutionCells = new Set(puzzle.solution.map((c, r) => r * this.n + c));
    this.regionCells = Array.from({ length: this.n }, (_, k) => this.geom.unitCells[2 * this.n + k]);
    if (saved && saved.id === puzzle.id && saved.marks.length === this.marks.length) {
      for (let i = 0; i < this.marks.length; i++) this.marks[i] = Number(saved.marks[i]) as 0 | 1 | 2;
      this.fish = saved.fish;
      this.score = saved.score;
      this.combo = saved.combo;
      this.mistakes = saved.mistakes;
      this.elapsed = saved.elapsed;
      this.sinceCat = saved.sinceCat;
      this.continued = saved.continued;
      this.status = saved.status;
      // 예전 저장본에 틀린 고양이가 남아 있으면 안전하게 X 로
      for (let i = 0; i < this.marks.length; i++) {
        if (this.marks[i] === CAT && !this.solutionCells.has(i)) this.marks[i] = X;
      }
    } else {
      this.reset();
    }
  }

  on(fn: (e: GameEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  reset(): void {
    this.marks.fill(EMPTY);
    for (const g of this.puzzle.givens) this.marks[g] = CAT;
    this.fish = MAX_FISH;
    this.score = 0;
    this.combo = 0;
    this.mistakes = 0;
    this.elapsed = 0;
    this.sinceCat = 0;
    this.continued = false;
    this.status = 'playing';
  }

  restart(): void {
    this.reset();
    this.emit({ type: 'marks', cells: [...this.marks.keys()] });
    this.emit({ type: 'fish', fish: this.fish, delta: 0 });
    this.emit({ type: 'score', score: this.score });
  }

  toProgress(): Progress {
    return {
      id: this.puzzle.id,
      marks: Array.from(this.marks).join(''),
      fish: this.fish,
      score: this.score,
      combo: this.combo,
      mistakes: this.mistakes,
      elapsed: Math.round(this.elapsed),
      sinceCat: Math.round(this.sinceCat),
      continued: this.continued,
      status: this.status,
    };
  }

  isSolution(cell: number): boolean {
    return this.solutionCells.has(cell);
  }

  regionOf(cell: number): number {
    return this.puzzle.regions[cell];
  }

  regionSolved(region: number): boolean {
    return this.regionCells[region].some((c) => this.marks[c] === CAT);
  }

  catCount(): number {
    let k = 0;
    for (const m of this.marks) if (m === CAT) k++;
    return k;
  }

  tick(ms: number): void {
    if (this.status !== 'playing') return;
    this.elapsed += ms;
    this.sinceCat += ms;
  }

  /** 탭: 빈 칸 → X → 고양이 */
  tap(cell: number): void {
    if (this.status !== 'playing') return;
    const m = this.marks[cell];
    if (m === EMPTY) this.setMarks([cell], X);
    else if (m === X) this.placeCat(cell, 'user');
  }

  /** 드래그로 여러 칸에 X 를 칠하거나 지운다 (고양이 칸은 건드리지 않음) */
  paint(cells: number[], mode: 'x' | 'erase'): number[] {
    if (this.status !== 'playing') return [];
    const from = mode === 'x' ? EMPTY : X;
    const to = mode === 'x' ? X : EMPTY;
    return this.setMarks(
      cells.filter((c) => this.marks[c] === from),
      to,
    );
  }

  /** X 만 지운다 (키보드 Delete) */
  clear(cell: number): void {
    if (this.status === 'playing' && this.marks[cell] === X) this.setMarks([cell], EMPTY);
  }

  private setMarks(cells: number[], value: number): number[] {
    const changed = cells.filter((c) => this.marks[c] !== value && this.marks[c] !== CAT);
    for (const c of changed) this.marks[c] = value;
    if (changed.length) this.emit({ type: 'marks', cells: changed });
    return changed;
  }

  /** 고양이를 놓는다. 틀리면 물고기 -1, 칸은 X. */
  placeCat(cell: number, source: CatSource): boolean {
    if (this.status !== 'playing' || this.marks[cell] === CAT) return false;
    if (!this.solutionCells.has(cell)) {
      this.mistakes++;
      this.combo = 0;
      this.fish = Math.max(0, this.fish - 1);
      this.marks[cell] = X;
      this.emit({ type: 'wrong', cell });
      this.emit({ type: 'marks', cells: [cell] });
      this.emit({ type: 'fish', fish: this.fish, delta: -1 });
      if (this.fish === 0) {
        this.status = 'lost';
        this.emit({ type: 'lost' });
      }
      return false;
    }
    let points = 0;
    if (source === 'user') {
      const speed = Math.max(0, 60 - Math.floor(this.sinceCat / 1000));
      points = 100 + speed + 20 * this.combo;
      this.combo++;
      this.score += points;
    }
    this.sinceCat = 0;
    this.marks[cell] = CAT;
    this.emit({ type: 'cat', cell, source, points });
    this.emit({ type: 'marks', cells: [cell] });
    if (points) this.emit({ type: 'score', score: this.score });
    if (this.autoX) this.autoMark(cell);
    if (this.catCount() === this.n) this.win();
    return true;
  }

  /** 고양이 주변(같은 행·열·영역 + 8방향)을 X 로 */
  autoMark(cell: number): number[] {
    return this.setMarks(
      this.geom.peerCells[cell].filter((c) => this.marks[c] === EMPTY),
      X,
    );
  }

  private win(): void {
    this.status = 'won';
    const catPoints = this.score;
    const fishBonus = this.fish * 150;
    const perfectBonus = this.mistakes === 0 ? 300 : 0;
    const par = this.n * this.n * 3;
    const timeBonus = Math.max(0, Math.round((par - this.elapsed / 1000) * 2));
    const total = catPoints + fishBonus + perfectBonus + timeBonus;
    this.score = total;
    this.emit({ type: 'score', score: total });
    this.emit({
      type: 'won',
      summary: { catPoints, fishBonus, perfectBonus, timeBonus, total, elapsed: this.elapsed, mistakes: this.mistakes },
    });
  }

  /** 게임 오버 뒤 이어하기 — 레벨마다 한 번 */
  continueGame(): boolean {
    if (this.status !== 'lost' || this.continued) return false;
    this.continued = true;
    this.status = 'playing';
    this.fish = MAX_FISH;
    this.emit({ type: 'fish', fish: this.fish, delta: MAX_FISH });
    return true;
  }

  addFish(k = 1): void {
    this.fish = Math.min(MAX_FISH, this.fish + k);
    this.emit({ type: 'fish', fish: this.fish, delta: k });
  }

  /* ───────── 아이템 ───────── */

  private currentCats(): number[] {
    const out: number[] = [];
    this.marks.forEach((m, i) => m === CAT && out.push(i));
    return out;
  }

  private wrongXs(): number[] {
    const out: number[] = [];
    this.marks.forEach((m, i) => m === X && this.solutionCells.has(i) && out.push(i));
    return out;
  }

  private logicState() {
    const xs: number[] = [];
    this.marks.forEach((m, i) => m === X && !this.solutionCells.has(i) && xs.push(i));
    return stateFromMarks(this.geom, this.currentCats(), xs);
  }

  /** 전구: 잘못된 X 부터 바로잡고, 없으면 논리로 다음 한 수를 찾아 적용한다 */
  hint(): Deduction | null {
    if (this.status !== 'playing') return null;
    const wrong = this.wrongXs();
    if (wrong.length) {
      this.setMarks(wrong, EMPTY);
      return {
        kind: 'wrong',
        tech: 0,
        eliminate: [],
        unmark: wrong,
        focus: wrong,
        message:
          wrong.length === 1
            ? '이 칸의 X 표시는 틀렸어요. 지워 두었어요!'
            : `틀린 X 표시 ${wrong.length}개를 지워 두었어요!`,
      };
    }
    const d = this.logic.next(this.logicState());
    if (d) {
      if (d.place !== undefined) this.placeCat(d.place, 'hint');
      else this.setMarks(d.eliminate.filter((c) => this.marks[c] === EMPTY), X);
      return d;
    }
    const cell = this.pickRevealCell();
    if (cell === null) return null;
    this.placeCat(cell, 'hint');
    return { kind: 'single', tech: 0, place: cell, eliminate: [], focus: [cell], message: '여기에 고양이가 있어요!' };
  }

  /** 후보가 가장 적은(=가장 막막한) 영역의 정답 칸 */
  private pickRevealCell(): number | null {
    const s = this.logicState();
    let best: number | null = null;
    let bestCount = Infinity;
    for (let k = 0; k < this.n; k++) {
      if (this.regionSolved(k)) continue;
      const cnt = unitCount(this.geom, s, 2 * this.n + k);
      if (cnt < bestCount) {
        bestCount = cnt;
        best = this.regionCells[k].find((c) => this.solutionCells.has(c)) ?? null;
      }
    }
    return best;
  }

  /** 고양이 아이템: 정답 고양이 한 마리를 놓아 준다 */
  catItem(): number | null {
    if (this.status !== 'playing') return null;
    const cell = this.pickRevealCell();
    if (cell === null) return null;
    this.placeCat(cell, 'item');
    return cell;
  }

  /** 쥐 아이템: 한 줄을 달리며 고양이가 없는 빈 칸을 모두 X 로 (고양이 없는 줄 우선) */
  mouseItem(): MouseRun | null {
    if (this.status !== 'playing') return null;
    const n = this.n;
    let best: MouseRun | null = null;
    let bestScore = 0;
    for (const line of ['row', 'col'] as const) {
      for (let k = 0; k < n; k++) {
        const cells = Array.from({ length: n }, (_, j) => (line === 'row' ? k * n + j : j * n + k));
        const targets = cells.filter((c) => this.marks[c] === EMPTY && !this.solutionCells.has(c));
        if (!targets.length) continue;
        const solved = cells.some((c) => this.marks[c] === CAT);
        const score = targets.length + (solved ? 0 : 100);
        if (score > bestScore) {
          bestScore = score;
          best = { line, index: k, cells: targets };
        }
      }
    }
    return best;
  }

  applyMouse(run: MouseRun, cell: number): void {
    if (run.cells.includes(cell)) this.setMarks([cell], X);
  }
}
