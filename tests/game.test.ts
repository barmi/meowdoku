import { describe, expect, it } from 'vitest';
import { levelPuzzle } from '../src/core/levels';
import { CAT, EMPTY, Game, type GameEvent, MAX_FISH, X } from '../src/game/game';

const P701 = () => levelPuzzle(701);
const cell = (r: number, c: number) => r * 8 + c;

function record(game: Game): GameEvent[] {
  const events: GameEvent[] = [];
  game.on((e) => events.push(e));
  return events;
}

describe('Game', () => {
  it('시작하면 스크린샷처럼 3행 4열에 고양이가 있고 물고기는 3마리', () => {
    const g = new Game(P701());
    expect(g.marks[cell(2, 3)]).toBe(CAT);
    expect(g.catCount()).toBe(1);
    expect(g.fish).toBe(MAX_FISH);
  });

  it('탭: 빈 칸 → X → 고양이(정답이면 고정, 점수)', () => {
    const g = new Game(P701());
    g.tap(cell(0, 2));
    expect(g.marks[cell(0, 2)]).toBe(X);
    g.tap(cell(0, 2));
    expect(g.marks[cell(0, 2)]).toBe(CAT);
    expect(g.score).toBeGreaterThanOrEqual(100);
    g.tap(cell(0, 2));
    expect(g.marks[cell(0, 2)]).toBe(CAT);
  });

  it('틀린 고양이는 물고기 -1, 칸은 X, 3번 틀리면 게임 오버', () => {
    const g = new Game(P701());
    const ev = record(g);
    for (const c of [cell(0, 0), cell(1, 1), cell(1, 2)]) {
      g.tap(c);
      g.tap(c);
      expect(g.marks[c]).toBe(X);
    }
    expect(g.fish).toBe(0);
    expect(g.status).toBe('lost');
    expect(ev.filter((e) => e.type === 'wrong')).toHaveLength(3);
    expect(ev.at(-1)).toEqual({ type: 'lost' });
    expect(g.continueGame()).toBe(true);
    expect(g.fish).toBe(MAX_FISH);
    expect(g.continueGame()).toBe(false);
  });

  it('드래그: X 칠하기와 지우기, 고양이 칸은 그대로', () => {
    const g = new Game(P701());
    const row = [...Array(8).keys()].map((c) => cell(2, c));
    g.paint(row, 'x');
    expect(row.filter((c) => g.marks[c] === X)).toHaveLength(7);
    expect(g.marks[cell(2, 3)]).toBe(CAT);
    g.paint(row, 'erase');
    expect(row.filter((c) => g.marks[c] === EMPTY)).toHaveLength(7);
  });

  it('정답을 모두 놓으면 클리어하고 보너스가 붙는다', () => {
    const p = P701();
    const g = new Game(p);
    const ev = record(g);
    p.solution.forEach((c, r) => g.placeCat(cell(r, c), 'user'));
    expect(g.status).toBe('won');
    const won = ev.find((e) => e.type === 'won');
    expect(won && won.type === 'won' && won.summary.fishBonus).toBe(3 * 150);
    expect(won && won.type === 'won' && won.summary.perfectBonus).toBe(300);
  });

  it('자동 X: 고양이 주변(행·열·영역·8방향)이 X 가 된다', () => {
    const g = new Game(P701());
    g.autoX = true;
    g.placeCat(cell(7, 6), 'user');
    for (const c of [cell(7, 0), cell(0, 6), cell(6, 5), cell(6, 7), cell(7, 7)]) expect(g.marks[c]).toBe(X);
  });

  it('힌트: 틀린 X 를 먼저 지우고, 그다음엔 논리적으로 맞는 수만 둔다', () => {
    const p = P701();
    const g = new Game(p);
    const sol = cell(0, p.solution[0]);
    g.tap(sol);
    const d1 = g.hint();
    expect(d1?.kind).toBe('wrong');
    expect(g.marks[sol]).toBe(EMPTY);
    for (let k = 0; k < 40 && g.status === 'playing'; k++) {
      const d = g.hint();
      expect(d).not.toBeNull();
      if (d?.place !== undefined) expect(g.isSolution(d.place)).toBe(true);
      for (const e of d?.eliminate ?? []) expect(g.isSolution(e)).toBe(false);
    }
    expect(g.status).toBe('won');
  });

  it('고양이 아이템은 정답 칸에, 쥐는 한 줄의 고양이 없는 칸만 X', () => {
    const g = new Game(P701());
    const c = g.catItem();
    expect(c).not.toBeNull();
    expect(g.isSolution(c!)).toBe(true);
    const run = g.mouseItem()!;
    expect(run.cells.length).toBeGreaterThan(0);
    for (const x of run.cells) {
      expect(g.isSolution(x)).toBe(false);
      g.applyMouse(run, x);
      expect(g.marks[x]).toBe(X);
    }
  });

  it('진행 상태를 저장했다가 그대로 복원한다', () => {
    const p = P701();
    const g = new Game(p);
    g.tap(cell(0, 0));
    g.tap(cell(1, 1));
    g.tap(cell(1, 1));
    const saved = JSON.parse(JSON.stringify(g.toProgress()));
    const h = new Game(p, saved);
    expect(Array.from(h.marks)).toEqual(Array.from(g.marks));
    expect(h.fish).toBe(2);
    expect(new Game(levelPuzzle(702), saved).fish).toBe(MAX_FISH);
  });
});
