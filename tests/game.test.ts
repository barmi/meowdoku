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
  it('레벨 701 은 오픈 없이도 해가 하나라 빈 판으로 시작하고 물고기는 3마리', () => {
    const g = new Game(P701());
    expect(g.catCount()).toBe(0);
    expect(g.fish).toBe(MAX_FISH);
  });

  it('오픈이 있는 판은 그 고양이가 놓인 채로 시작하고, 처음부터 다시 해도 남는다', () => {
    const p = { ...levelPuzzle(701), givens: [cell(4, 5)] };
    const g = new Game(p);
    expect(g.catCount()).toBe(1);
    expect(g.marks[cell(4, 5)]).toBe(CAT);
    g.placeCat(cell(0, 2), 'user');
    g.restart();
    expect(g.catCount()).toBe(1);
    expect(g.marks[cell(4, 5)]).toBe(CAT);
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
    g.placeCat(cell(2, 3), 'user');
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

  it('판마다 gameId: 저장본에서 이어받고, 처음부터 다시 하면 새로 붙는다 (#6)', () => {
    const p = P701();
    const g = new Game(p);
    const id = g.gameId;
    expect(id).toBeTruthy();
    g.tap(cell(0, 0));
    const h = new Game(p, JSON.parse(JSON.stringify(g.toProgress())));
    expect(h.gameId).toBe(id);
    h.restart();
    expect(h.gameId).not.toBe(id);
    expect(new Game(p).gameId).not.toBe(id);
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
    // 같은 레벨이라도 판(sig)이 바뀐 예전 저장본은 버린다
    expect(new Game(p, { ...saved, sig: 'old' }).fish).toBe(MAX_FISH);
  });
});
