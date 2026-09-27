import { Geometry } from '../core/geometry';
import { type Deduction, LogicEngine } from '../core/logic';
import { PALETTE } from '../core/palette';
import { stateFromMarks, unitCount } from '../core/state';
import type { Puzzle } from '../core/types';

export const EMPTY = 0;
export const X = 1;
export const CAT = 2;
/** 틀린 고양이 자리 — 빨간 X 로 남고 지워지지 않는다 (#8) */
export const WRONG = 3;

/** 생각 정리용 마커 (#10) — 판정·힌트·통계와 무관하다. 0 없음 */
export const NOTE_NONE = 0;
/** '?' 마커 — "변환" 으로 한꺼번에 고양이로 놓는다 (#11) */
export const NOTE_QUESTION = 4;
export type NoteShape = 1 | 2 | 3 | 4;
export const NOTE_NAMES: Record<NoteShape, string> = { 1: '세모', 2: '동그라미', 3: '네모', 4: '물음표' };

/**
 * 되돌리기 기록 (#12). 한 칸의 변화 = [칸, X표시 전, 후, 마커 전, 후], 블록 = 한 번의 조작으로 바뀐 칸들.
 * 되돌리는 대상은 X 표시와 마커뿐 — 고양이(정답·틀림)·물고기·점수는 확정된 결과라 기록하지 않는다.
 */
export type Change = [number, number, number, number, number];
type Block = Change[];
const MAX_HISTORY = 100;

export const MAX_FISH = 3;

export function newGameId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type CatSource = 'given' | 'user' | 'item' | 'hint';
export type Status = 'playing' | 'won' | 'lost';

/** 저장용 진행 상태 */
export interface Progress {
  id: string;
  /** 판을 새로 시작할 때마다 새로 붙는 id — 다른 기기에서 끝난/바뀐 판인지 가려낸다 (#6) */
  gameId?: string;
  /** Puzzle.sig — 같은 레벨이라도 판이 바뀌었으면 복원하지 않는다 */
  sig?: string;
  marks: string;
  /** 마커 (칸마다 0~4), 하나도 없으면 생략 */
  notes?: string;
  /** 되돌리기/다시 하기 기록 — 블록마다 [칸, X전, X후, 마커전, 마커후, …] 를 이어 붙인 배열 */
  history?: { u: number[][]; r: number[][] };
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
  | { type: 'notes'; cells: number[] }
  | { type: 'history' }
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
 * - 탭은 X 토글(빈 칸 ↔ X), 더블탭은 고양이. 고양이는 정답과 바로 대조한다.
 * - 틀리면 물고기(목숨) 하나를 잃고 그 칸은 X 가 된다. 맞힌 고양이는 고정된다.
 */
export class Game {
  readonly puzzle: Puzzle;
  readonly n: number;
  readonly geom: Geometry;
  readonly logic: LogicEngine;
  readonly marks: Uint8Array;
  /** 마커 층 — marks 와 따로 두고 빈 칸에만 보인다 */
  readonly notes: Uint8Array;
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
  /** 이번 판(시도)의 id — 처음부터 다시 하면 바뀐다 */
  gameId = newGameId();
  private undoStack: Block[] = [];
  private redoStack: Block[] = [];
  /** 만들고 있는 블록 (드래그처럼 여러 번에 걸친 조작을 한 블록으로 묶는다) */
  private building: Map<number, Change> | null = null;
  private depth = 0;

  constructor(puzzle: Puzzle, saved?: Progress | null) {
    this.puzzle = puzzle;
    this.n = puzzle.size;
    this.geom = new Geometry(this.n, puzzle.regions);
    this.logic = new LogicEngine(this.geom, (r) => PALETTE[puzzle.colors[r]].name);
    this.marks = new Uint8Array(this.n * this.n);
    this.notes = new Uint8Array(this.n * this.n);
    this.solutionCells = new Set(puzzle.solution.map((c, r) => r * this.n + c));
    this.regionCells = Array.from({ length: this.n }, (_, k) => this.geom.unitCells[2 * this.n + k]);
    if (saved && saved.id === puzzle.id && saved.sig === puzzle.sig && saved.marks.length === this.marks.length) {
      for (let i = 0; i < this.marks.length; i++) this.marks[i] = Number(saved.marks[i]) as 0 | 1 | 2;
      this.fish = saved.fish;
      this.score = saved.score;
      this.combo = saved.combo;
      this.mistakes = saved.mistakes;
      this.elapsed = saved.elapsed;
      this.sinceCat = saved.sinceCat;
      this.continued = saved.continued;
      this.status = saved.status;
      this.gameId = saved.gameId ?? this.gameId;
      if (saved.notes?.length === this.notes.length) {
        for (let i = 0; i < this.notes.length; i++) this.notes[i] = Math.min(NOTE_QUESTION, Number(saved.notes[i]) || 0);
      }
      this.undoStack = decodeBlocks(saved.history?.u, this.marks.length);
      this.redoStack = decodeBlocks(saved.history?.r, this.marks.length);
      // 예전 저장본에 틀린 고양이가 남아 있으면 안전하게 빨간 X 로
      for (let i = 0; i < this.marks.length; i++) {
        if (this.marks[i] === CAT && !this.solutionCells.has(i)) this.marks[i] = WRONG;
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
    this.gameId = newGameId();
    this.marks.fill(EMPTY);
    this.notes.fill(NOTE_NONE);
    this.undoStack = [];
    this.redoStack = [];
    this.building = null;
    this.depth = 0;
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
    this.emit({ type: 'notes', cells: [...this.notes.keys()] });
    this.emit({ type: 'history' });
    this.emit({ type: 'fish', fish: this.fish, delta: 0 });
    this.emit({ type: 'score', score: this.score });
  }

  toProgress(): Progress {
    return {
      id: this.puzzle.id,
      gameId: this.gameId,
      sig: this.puzzle.sig,
      marks: Array.from(this.marks).join(''),
      ...(this.notes.some((v) => v) ? { notes: Array.from(this.notes).join('') } : {}),
      ...(this.undoStack.length || this.redoStack.length
        ? { history: { u: this.undoStack.map((b) => b.flat()), r: this.redoStack.map((b) => b.flat()) } }
        : {}),
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

  /** 탭: X 토글 (빈 칸 ↔ X). 고양이는 더블탭 → placeCat (#7) */
  tap(cell: number): void {
    if (this.status !== 'playing') return;
    const m = this.marks[cell];
    if (m === EMPTY) this.setMarks([cell], X);
    else if (m === X) this.setMarks([cell], EMPTY);
  }

  /** 더블탭의 첫 탭이 바꾼 X 표시를 되돌린다 (빨간 X·고양이 칸은 그대로). 첫 탭의 기록도 지운다 */
  restoreMark(cell: number, mark: number): void {
    if (this.status !== 'playing' || (mark !== EMPTY && mark !== X)) return;
    const top = this.undoStack[this.undoStack.length - 1];
    if (!this.building && top?.length === 1 && top[0][0] === cell && top[0][1] === mark && top[0][2] === this.marks[cell]) {
      this.undoStack.pop();
      this.marks[cell] = mark;
      this.emit({ type: 'marks', cells: [cell] });
      this.emit({ type: 'history' });
      return;
    }
    this.setMarks([cell], mark);
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

  /**
   * 마커를 놓거나(shape 1~3) 지운다(0). 놓기는 빈 칸에만 — X·고양이가 있는 칸은 건너뛴다.
   * 정답·힌트·점수와는 상관없는 생각 정리용이다 (#10).
   */
  setNote(cells: number[], shape: number): number[] {
    if (this.status !== 'playing') return [];
    const changed = cells.filter(
      (c) => this.notes[c] !== shape && (shape === NOTE_NONE || this.marks[c] === EMPTY),
    );
    if (!changed.length) return changed;
    this.beginBlock();
    for (const c of changed) {
      this.record(c, this.marks[c], this.marks[c], this.notes[c], shape);
      this.notes[c] = shape;
    }
    this.endBlock();
    this.emit({ type: 'notes', cells: changed });
    return changed;
  }

  /** 빈 칸 위에 보이는 '?' 마커 칸 (위→아래, 왼→오른) */
  questionCells(): number[] {
    const out: number[] = [];
    this.notes.forEach((v, i) => v === NOTE_QUESTION && this.marks[i] === EMPTY && out.push(i));
    return out;
  }

  /** '?' 마커 한 칸을 고양이로 놓는다 (#11) — 더블탭과 같은 판정. 결과: 'cat' | 'wrong' | null */
  convertQuestion(cell: number): 'cat' | 'wrong' | null {
    if (this.status !== 'playing' || this.notes[cell] !== NOTE_QUESTION || this.marks[cell] !== EMPTY) return null;
    this.notes[cell] = NOTE_NONE;
    this.emit({ type: 'notes', cells: [cell] });
    return this.placeCat(cell, 'user') ? 'cat' : 'wrong';
  }

  /** 마커 전체 지우기 — 지운 개수 */
  clearNotes(): number {
    const cells: number[] = [];
    this.notes.forEach((v, i) => v && cells.push(i));
    return this.setNote(cells, NOTE_NONE).length;
  }

  /** X 만 지운다 (키보드 Delete) */
  clear(cell: number): void {
    if (this.status === 'playing' && this.marks[cell] === X) this.setMarks([cell], EMPTY);
  }

  private setMarks(cells: number[], value: number): number[] {
    // 고양이와 빨간 X(틀린 자리)는 확정된 칸이라 표시를 바꾸지 않는다
    const changed = cells.filter((c) => this.marks[c] !== value && this.marks[c] !== CAT && this.marks[c] !== WRONG);
    if (!changed.length) return changed;
    this.beginBlock();
    for (const c of changed) {
      this.record(c, this.marks[c], value, this.notes[c], this.notes[c]);
      this.marks[c] = value;
    }
    this.endBlock();
    this.emit({ type: 'marks', cells: changed });
    return changed;
  }

  /* ───────── 되돌리기 / 다시 하기 (#12) ───────── */

  /** 여러 번에 걸친 조작(드래그, 쥐 한 번)을 한 블록으로 묶는다 — endBlock 과 짝 */
  beginBlock(): void {
    if (this.depth++ === 0) this.building = new Map();
  }

  endBlock(): void {
    if (this.depth === 0) return;
    if (--this.depth > 0) return;
    const b = this.building;
    this.building = null;
    const changes = b ? [...b.values()].filter(([, mb, ma, nb, na]) => mb !== ma || nb !== na) : [];
    if (!changes.length) return;
    this.undoStack.push(changes);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.emit({ type: 'history' });
  }

  private record(cell: number, mb: number, ma: number, nb: number, na: number): void {
    const b = this.building;
    if (!b) return;
    const prev = b.get(cell);
    if (prev) {
      prev[2] = ma;
      prev[4] = na;
    } else b.set(cell, [cell, mb, ma, nb, na]);
  }

  canUndo(): boolean {
    return this.status === 'playing' && this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.status === 'playing' && this.redoStack.length > 0;
  }

  /** 가장 최근 블록을 되돌린다. 그사이 고양이·빨간 X 가 된 칸은 건너뛰고, 되돌릴 게 없는 블록은 버린다 */
  undo(): number[] | null {
    return this.step(this.undoStack, this.redoStack, 'undo');
  }

  redo(): number[] | null {
    return this.step(this.redoStack, this.undoStack, 'redo');
  }

  private step(from: Block[], to: Block[], dir: 'undo' | 'redo'): number[] | null {
    if (this.status !== 'playing') return null;
    while (from.length) {
      const b = from.pop()!;
      const cells = this.applyBlock(b, dir);
      if (cells.length) {
        to.push(b);
        this.emit({ type: 'history' });
        return cells;
      }
    }
    this.emit({ type: 'history' });
    return null;
  }

  private applyBlock(b: Block, dir: 'undo' | 'redo'): number[] {
    const markCells: number[] = [];
    const noteCells: number[] = [];
    for (const [c, mb, ma, nb, na] of b) {
      const [mFrom, mTo] = dir === 'undo' ? [ma, mb] : [mb, ma];
      const [nFrom, nTo] = dir === 'undo' ? [na, nb] : [nb, na];
      if (mFrom !== mTo && this.marks[c] === mFrom && (mTo === EMPTY || mTo === X)) {
        this.marks[c] = mTo;
        markCells.push(c);
      }
      if (nFrom !== nTo && this.notes[c] === nFrom) {
        this.notes[c] = nTo;
        noteCells.push(c);
      }
    }
    if (markCells.length) this.emit({ type: 'marks', cells: markCells });
    if (noteCells.length) this.emit({ type: 'notes', cells: noteCells });
    return [...new Set([...markCells, ...noteCells])];
  }

  /** 고양이를 놓는다. 틀리면 물고기 -1, 칸은 빨간 X. */
  placeCat(cell: number, source: CatSource): boolean {
    if (this.status !== 'playing' || this.marks[cell] === CAT || this.marks[cell] === WRONG) return false;
    if (!this.solutionCells.has(cell)) {
      this.mistakes++;
      this.combo = 0;
      this.fish = Math.max(0, this.fish - 1);
      this.marks[cell] = WRONG;
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
    // 다 깬 판은 되돌릴 필요가 없다
    this.undoStack = [];
    this.redoStack = [];
    this.emit({ type: 'history' });
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
    this.marks.forEach((m, i) => (m === X || m === WRONG) && !this.solutionCells.has(i) && xs.push(i));
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

/** 저장된 기록을 블록으로 — 모양이 어긋난 건 버린다 */
function decodeBlocks(raw: unknown, cells: number): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const flat of raw) {
    if (!Array.isArray(flat) || !flat.length || flat.length % 5) continue;
    const b: Block = [];
    for (let k = 0; k < flat.length; k += 5) {
      const ch = flat.slice(k, k + 5).map(Number) as Change;
      if (ch.every(Number.isFinite) && ch[0] >= 0 && ch[0] < cells) b.push(ch);
    }
    if (b.length) out.push(b);
  }
  return out.slice(-MAX_HISTORY);
}
