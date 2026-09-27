import type { Deduction } from '../core/logic';
import { COLOR_ORDER, PALETTE } from '../core/palette';
import type { Puzzle } from '../core/types';
import { CAT, EMPTY, Game, type GameEvent, MAX_FISH, type MouseRun, type Progress, type WinSummary, X } from '../game/game';
import type { Sound } from '../game/sound';
import type { ItemKey, SaveData } from '../game/storage';
import { catFace, use } from './art';
import { isSheetOpen, openSheet, toast } from './overlay';

export interface GameHost {
  save: SaveData;
  sound: Sound;
  persist(): void;
  goHome(): void;
  openSettings(view: GameView): void;
  won(view: GameView, summary: WinSummary): void;
}

export type Mode = 'level' | 'daily';

const ITEMS: ItemKey[] = ['cat', 'bulb', 'mouse'];
const ITEM_ICON: Record<ItemKey, string> = { cat: 'cat-wink', bulb: 'art-bulb', mouse: 'art-mouse' };
export const ITEM_LABEL: Record<ItemKey, string> = { cat: '고양이 부르기', bulb: '힌트 전구', mouse: '쥐 풀기' };
export const ITEM_DESC: Record<ItemKey, string> = {
  cat: '고양이 한 마리를 정답 칸에 데려와요.',
  bulb: '다음에 풀 수 있는 칸과 그 이유를 알려 줘요.',
  mouse: '쥐가 한 줄을 달리며 고양이가 없는 칸을 모두 X 로 표시해요.',
};

const RULES: [string, string][] = [
  ['xxxxc_x__', '색깔당 고양이 1마리'],
  ['xcx_x__x_', '행과 열마다 고양이 1마리'],
  ['xxxxcxxxx', '고양이 인접 불가'],
];

const miniGrid = (spec: string) =>
  `<div class="mini">${[...spec]
    .map((ch) =>
      ch === 'x' ? `<i class="x">${use('mark-x')}</i>` : ch === 'c' ? `<i class="c">${use('cat-static')}</i>` : '<i></i>',
    )
    .join('')}</div>`;

/** a 에서 b 까지 격자 위 직선 (a 제외, b 포함) — 빠르게 드래그해도 칸을 건너뛰지 않게 */
function lineCells(n: number, a: number, b: number): number[] {
  let r0 = Math.floor(a / n);
  let c0 = a % n;
  const r1 = Math.floor(b / n);
  const c1 = b % n;
  const dr = Math.abs(r1 - r0);
  const dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1;
  const sc = c0 < c1 ? 1 : -1;
  let err = dc - dr;
  const out: number[] = [];
  while (r0 !== r1 || c0 !== c1) {
    const e2 = 2 * err;
    if (e2 > -dr) {
      err -= dr;
      c0 += sc;
    }
    if (e2 < dc) {
      err += dc;
      r0 += sr;
    }
    out.push(r0 * n + c0);
  }
  return out;
}

export class GameView {
  readonly root: HTMLElement;
  readonly game: Game;
  readonly mode: Mode;
  readonly level: number;
  private readonly host: GameHost;
  private readonly sound: Sound;
  private board!: HTMLElement;
  private cells: HTMLElement[] = [];
  private heads = new Map<number, HTMLElement>();
  private fishEls: HTMLElement[] = [];
  private scoreEl!: HTMLElement;
  private banner!: HTMLElement;
  private bannerTimer = 0;
  private highlightTimer = 0;
  private cursor = -1;
  private drag: { start: number; last: number; mode: 'x' | 'erase' | null } | null = null;
  private intervals: number[] = [];
  private shownScore = 0;
  private scoreRaf = 0;
  private busy = false;
  private lastTick = performance.now();
  private saveTimer = 0;
  private readonly offGame: () => void;
  private destroyed = false;

  constructor(host: GameHost, mode: Mode, puzzle: Puzzle, level: number, saved?: Progress | null) {
    this.host = host;
    this.sound = host.sound;
    this.mode = mode;
    this.level = level;
    this.game = new Game(puzzle, saved);
    this.game.autoX = host.save.settings.autoX;
    this.root = document.createElement('section');
    this.root.className = 'game';
    this.render();
    this.offGame = this.game.on((e) => this.onGameEvent(e));
    this.bindInput();
    this.intervals.push(
      window.setInterval(() => this.tick(), 1000),
      window.setInterval(() => this.eyeTick(), 700),
    );
    if (this.game.status === 'lost') setTimeout(() => this.showLost(), 300);
  }

  /* ───────── 그리기 ───────── */

  private render(): void {
    const { puzzle } = this.game;
    const n = puzzle.size;
    const regionsInOrder = [...Array(n).keys()].sort(
      (a, b) => COLOR_ORDER.indexOf(puzzle.colors[a]) - COLOR_ORDER.indexOf(puzzle.colors[b]),
    );
    const heads = regionsInOrder
      .map(
        (k) => `<div class="head" data-region="${k}" style="color:${PALETTE[puzzle.colors[k]].head}">
          <svg class="sil" viewBox="0 0 100 100"><use href="#cat-head"/></svg>
          <svg class="face" viewBox="0 0 100 100"><use href="#cat-static"/></svg></div>`,
      )
      .join('');
    const cells = puzzle.regions
      .map((k, i) => {
        const st = PALETTE[puzzle.colors[k]];
        return `<div class="cell" role="gridcell" data-i="${i}" style="--bg-c:${st.bg};--pat:${st.pat}">
          <svg viewBox="0 0 100 100"><use href="#pat-${st.pattern}"/></svg>
          <svg class="xm" viewBox="0 0 100 100"><use href="#mark-x"/></svg></div>`;
      })
      .join('');
    const levelStat =
      this.mode === 'level'
        ? `<div class="stat"><span class="label">레벨</span><span class="value">${this.level}</span></div>`
        : '';
    this.root.innerHTML = `
      <header class="topbar">
        <button class="round-btn left" data-act="back" aria-label="뒤로">${use('ico-back')}</button>
        <div class="stats">${levelStat}
          <div class="stat"><span class="label">점수</span><span class="value" data-score>0</span></div>
        </div>
        <button class="round-btn right" data-act="settings" aria-label="설정">${use('ico-gear')}</button>
      </header>
      <div class="status">
        <div class="pill cats" aria-label="찾은 고양이">${heads}</div>
        <div class="pill fishes" aria-label="남은 물고기">${`<div class="fish">${use('art-fish')}</div>`.repeat(MAX_FISH)}</div>
      </div>
      <div class="rules-wrap">
        <div class="rules">${RULES.map(([spec, text]) => `<div class="rule">${miniGrid(spec)}<span>${text}</span></div>`).join('')}</div>
        <div class="banner" role="status">${use('art-bulb')}<div class="msg"></div></div>
      </div>
      <div class="board-wrap">
        <div class="board" role="grid" tabindex="0" aria-label="${n}×${n} 퍼즐 판" style="--n:${n}">${cells}</div>
      </div>
      <div class="items">${ITEMS.map(
        (key) =>
          `<button class="item ${key}" data-item="${key}" aria-label="${ITEM_LABEL[key]}">${use(ITEM_ICON[key])}<span class="badge"></span></button>`,
      ).join('')}</div>`;

    this.board = this.root.querySelector('.board')!;
    this.cells = [...this.board.querySelectorAll<HTMLElement>('.cell')];
    this.scoreEl = this.root.querySelector('[data-score]')!;
    this.banner = this.root.querySelector('.banner')!;
    this.fishEls = [...this.root.querySelectorAll<HTMLElement>('.fish')];
    for (const h of this.root.querySelectorAll<HTMLElement>('.head')) this.heads.set(Number(h.dataset.region), h);

    for (let i = 0; i < this.cells.length; i++) this.updateCell(i);
    this.refreshHeads();
    this.fishEls.forEach((f, i) => f.classList.toggle('gone', i >= this.game.fish));
    this.shownScore = this.game.score;
    this.scoreEl.textContent = String(this.game.score);
    this.updateBadges();
  }

  private updateCell(i: number, anim = ''): void {
    const el = this.cells[i];
    const m = this.game.marks[i];
    el.classList.toggle('x', m === X);
    el.classList.toggle('cat', m === CAT);
    const face = el.querySelector('.catface');
    if (m === CAT && !face) {
      el.insertAdjacentHTML('beforeend', catFace(anim));
      if (anim) {
        const f = el.lastElementChild!;
        f.addEventListener('animationend', () => f.classList.remove(anim), { once: true });
      }
    } else if (m !== CAT && face && !face.classList.contains('angry')) {
      face.remove();
    }
    const n = this.game.n;
    const name = PALETTE[this.game.puzzle.colors[this.game.regionOf(i)]].name;
    const state = m === CAT ? '고양이' : m === X ? 'X' : '빈 칸';
    el.setAttribute('aria-label', `${Math.floor(i / n) + 1}행 ${(i % n) + 1}열 ${name} 영역, ${state}`);
  }

  private refreshHeads(): void {
    for (const [k, h] of this.heads) h.classList.toggle('found', this.game.regionSolved(k));
  }

  private updateBadges(bump?: ItemKey): void {
    for (const key of ITEMS) {
      const badge = this.root.querySelector<HTMLElement>(`.item[data-item="${key}"] .badge`)!;
      const count = this.host.save.items[key];
      badge.className = count > 0 ? 'badge' : 'badge ad';
      badge.innerHTML = count > 0 ? String(count) : use('ico-play');
      if (key === bump) {
        void badge.offsetWidth;
        badge.classList.add('bump');
      }
    }
  }

  private animateScore(target: number): void {
    cancelAnimationFrame(this.scoreRaf);
    const from = this.shownScore;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      this.shownScore = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      this.scoreEl.textContent = String(this.shownScore);
      if (k < 1) this.scoreRaf = requestAnimationFrame(step);
    };
    this.scoreRaf = requestAnimationFrame(step);
  }

  private floatText(cell: number, text: string): void {
    const c = this.cells[cell];
    const el = document.createElement('div');
    el.className = 'points';
    el.textContent = text;
    el.style.left = `${c.offsetLeft + c.offsetWidth / 2}px`;
    el.style.top = `${c.offsetTop + c.offsetHeight * 0.3}px`;
    this.board.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  /* ───────── 게임 이벤트 ───────── */

  private onGameEvent(e: GameEvent): void {
    switch (e.type) {
      case 'marks':
        for (const c of e.cells) this.updateCell(c);
        this.refreshHeads();
        break;
      case 'cat':
        this.updateCell(e.cell, e.source === 'item' ? 'drop' : e.source === 'given' ? '' : 'pop');
        if (e.points) this.floatText(e.cell, `+${e.points}`);
        this.sound.meow();
        this.lookAt(e.cell);
        break;
      case 'wrong': {
        const el = this.cells[e.cell];
        el.classList.remove('wrong');
        void el.offsetWidth;
        el.classList.add('wrong');
        el.insertAdjacentHTML('beforeend', catFace('angry'));
        const angry = el.lastElementChild!;
        setTimeout(() => {
          angry.remove();
          el.classList.remove('wrong');
        }, 900);
        this.sound.wrong();
        break;
      }
      case 'fish':
        this.fishEls.forEach((f, i) => {
          const alive = i < e.fish;
          if (!alive) f.classList.add('gone');
          else if (f.classList.contains('gone')) {
            f.classList.remove('gone');
            f.classList.add('born');
            setTimeout(() => f.classList.remove('born'), 520);
          }
        });
        break;
      case 'score':
        this.animateScore(e.score);
        break;
      case 'won':
        this.celebrate(e.summary);
        break;
      case 'lost':
        this.sound.lose();
        setTimeout(() => this.showLost(), 750);
        break;
    }
    this.schedulePersist();
  }

  private celebrate(summary: WinSummary): void {
    this.clearHighlights();
    this.hideBanner();
    this.sound.win();
    const cats = this.cells.filter((c) => c.classList.contains('cat'));
    cats.forEach((c, k) =>
      setTimeout(() => {
        c.classList.add('happy');
        setTimeout(() => c.classList.remove('happy'), 600);
      }, k * 90),
    );
    setTimeout(() => {
      if (!this.destroyed) this.host.won(this, summary);
    }, cats.length * 90 + 500);
  }

  private showLost(): void {
    if (this.destroyed || this.game.status !== 'lost') return;
    const canContinue = !this.game.continued;
    openSheet({
      html: `<div class="hero" style="filter:grayscale(1);opacity:.55">${use('art-fish')}</div>
        <h2>물고기를 다 먹었어요</h2>
        <p>${canContinue ? '물고기를 다시 채워서 지금 판을 이어서 할 수 있어요.' : '이번 판은 여기까지! 처음부터 다시 도전해요.'}</p>`,
      dismissible: false,
      actions: [
        ...(canContinue
          ? [
              {
                label: '이어하기 · 물고기 3마리',
                kind: 'green' as const,
                icon: 'ico-play',
                onClick: () => {
                  this.game.continueGame();
                  this.sound.coin();
                },
              },
            ]
          : []),
        { label: '처음부터 다시', kind: canContinue ? ('soft' as const) : ('primary' as const), onClick: () => this.restart() },
        { label: '홈으로', kind: 'soft' as const, onClick: () => this.host.goHome() },
      ],
    });
  }

  restart(): void {
    this.clearHighlights();
    this.hideBanner();
    for (const c of this.cells) c.querySelector('.catface')?.remove();
    this.game.restart();
    this.schedulePersist();
  }

  setAutoX(on: boolean): void {
    this.game.autoX = on;
  }

  /* ───────── 입력 ───────── */

  private bindInput(): void {
    const b = this.board;
    b.addEventListener('pointerdown', (e) => this.onDown(e));
    b.addEventListener('pointermove', (e) => this.onMove(e));
    b.addEventListener('pointerup', () => this.onUp());
    b.addEventListener('pointercancel', () => (this.drag = null));
    b.addEventListener('lostpointercapture', () => this.onUp());
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('keydown', (e) => this.onKey(e));
    b.addEventListener('blur', () => this.setCursor(-1));
    this.banner.addEventListener('click', () => this.hideBanner());
    this.root.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-item]');
      if (!t) return;
      if (t.dataset.act === 'back') this.host.goHome();
      else if (t.dataset.act === 'settings') this.host.openSettings(this);
      else if (t.dataset.item) this.useItem(t.dataset.item as ItemKey);
    });
  }

  private cellAt(x: number, y: number): number {
    const r = this.board.getBoundingClientRect();
    const n = this.game.n;
    const col = Math.floor(((x - r.left) / r.width) * n);
    const row = Math.floor(((y - r.top) / r.height) * n);
    if (col < 0 || row < 0 || col >= n || row >= n) return -1;
    return row * n + col;
  }

  private onDown(e: PointerEvent): void {
    if (!e.isPrimary || e.button > 0 || this.busy || this.game.status !== 'playing') return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    e.preventDefault();
    try {
      this.board.setPointerCapture(e.pointerId);
    } catch {
      /* 합성 이벤트 등 */
    }
    this.drag = { start: cell, last: cell, mode: null };
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || !e.isPrimary) return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (cell < 0 || cell === d.last) return;
    if (d.mode === null) {
      d.mode = this.game.marks[d.start] === X ? 'erase' : 'x';
      this.paint([d.start]);
    }
    this.paint(lineCells(this.game.n, d.last, cell));
    d.last = cell;
  }

  private onUp(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.mode === null) this.tapCell(d.start);
  }

  private paint(cells: number[]): void {
    const mode = this.drag?.mode;
    if (!mode) return;
    const changed = this.game.paint(cells, mode);
    if (changed.length) {
      if (mode === 'x') this.sound.mark();
      else this.sound.erase();
    }
  }

  private tapCell(cell: number): void {
    if (this.game.status !== 'playing') return;
    const m = this.game.marks[cell];
    if (m === EMPTY) {
      this.game.tap(cell);
      this.sound.mark();
    } else if (m === X) {
      this.game.tap(cell);
    } else {
      const c = this.cells[cell];
      c.classList.add('happy');
      setTimeout(() => c.classList.remove('happy'), 520);
    }
    this.lookAt(cell);
  }

  private setCursor(i: number): void {
    if (this.cursor >= 0) this.cells[this.cursor]?.classList.remove('cursor');
    this.cursor = i;
    if (i >= 0) this.cells[i].classList.add('cursor');
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.game.n;
    const cur = this.cursor < 0 ? Math.floor(n / 2) * n + Math.floor(n / 2) : this.cursor;
    const r = Math.floor(cur / n);
    const c = cur % n;
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (move[e.key]) {
      e.preventDefault();
      if (this.cursor < 0) return this.setCursor(cur);
      const [dr, dc] = move[e.key];
      this.setCursor(Math.min(n - 1, Math.max(0, r + dr)) * n + Math.min(n - 1, Math.max(0, c + dc)));
      return;
    }
    if (this.cursor < 0) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.tapCell(this.cursor);
    } else if (e.key === 'x' || e.key === 'X') {
      if (this.game.marks[this.cursor] === X) this.game.clear(this.cursor);
      else this.game.tap(this.cursor);
    } else if (e.key === 'c' || e.key === 'C') {
      if (this.game.marks[this.cursor] !== CAT) this.game.placeCat(this.cursor, 'user');
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      this.game.clear(this.cursor);
    }
  }

  /* ───────── 고양이 눈 ───────── */

  private faces(): SVGElement[] {
    return [...this.board.querySelectorAll<SVGElement>('.catface:not(.angry)')];
  }

  private expr(f: SVGElement, cls: string, ms: number): void {
    f.classList.remove('look-l', 'look-r', 'look-u', 'look-d', 'smug', 'sleepy');
    f.classList.add(cls);
    setTimeout(() => f.classList.remove(cls), ms);
  }

  private blink(f: SVGElement): void {
    f.classList.add('blink');
    setTimeout(() => f.classList.remove('blink'), 140);
  }

  /** 모든 고양이가 방금 누른 칸을 쳐다본다 */
  private lookAt(target: number): void {
    const n = this.game.n;
    for (const f of this.faces()) {
      const cell = this.cells.indexOf(f.parentElement as HTMLElement);
      if (cell < 0) continue;
      const dx = (target % n) - (cell % n);
      const dy = Math.floor(target / n) - Math.floor(cell / n);
      if (!dx && !dy) {
        this.blink(f);
        continue;
      }
      const cls = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'look-l' : 'look-r') : dy < 0 ? 'look-u' : 'look-d';
      this.expr(f, cls, 1500);
    }
  }

  private eyeTick(): void {
    const faces = this.faces();
    if (!faces.length || document.hidden) return;
    const f = faces[Math.floor(Math.random() * faces.length)];
    const r = Math.random();
    if (r < 0.45) this.blink(f);
    else if (r < 0.85) this.expr(f, ['look-l', 'look-r', 'look-u', 'look-d'][Math.floor(Math.random() * 4)], 1400);
    else this.expr(f, Math.random() < 0.6 ? 'smug' : 'sleepy', 1900);
  }

  /* ───────── 아이템 ───────── */

  private useItem(key: ItemKey): void {
    if (this.busy || this.game.status !== 'playing') return;
    const items = this.host.save.items;
    if (items[key] <= 0) return this.offerItem(key);
    if (key === 'cat') {
      const cell = this.game.catItem();
      if (cell === null) return toast('고양이를 놓을 자리가 없어요');
      this.sound.magic();
    } else if (key === 'bulb') {
      const d = this.game.hint();
      if (!d) return toast('지금은 힌트가 필요 없어요');
      this.sound.magic();
      this.showDeduction(d);
    } else {
      const run = this.game.mouseItem();
      if (!run) return toast('쥐가 달릴 줄이 없어요');
      this.runMouse(run);
    }
    items[key]--;
    this.updateBadges();
    this.host.persist();
  }

  private offerItem(key: ItemKey): void {
    openSheet({
      html: `<div class="hero">${use(ITEM_ICON[key])}</div><h2>${ITEM_LABEL[key]}</h2>
        <p>${ITEM_DESC[key]}<br>광고 대신, 고양이들이 하나 선물할게요!</p>`,
      actions: [
        {
          label: '무료로 받기',
          kind: 'green',
          icon: 'ico-play',
          onClick: () => {
            this.host.save.items[key]++;
            this.updateBadges(key);
            this.host.persist();
            this.sound.coin();
            toast(`${ITEM_LABEL[key]} +1`);
          },
        },
        { label: '닫기', kind: 'soft' },
      ],
    });
  }

  showMessage(message: string, ms = 5200): void {
    this.banner.querySelector('.msg')!.textContent = message;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.hideBanner(), ms);
  }

  private hideBanner(): void {
    clearTimeout(this.bannerTimer);
    this.banner.classList.remove('show');
  }

  private showDeduction(d: Deduction): void {
    this.clearHighlights();
    const targets = [...(d.place !== undefined ? [d.place] : []), ...d.eliminate, ...(d.unmark ?? [])];
    for (const c of d.focus) if (!targets.includes(c)) this.cells[c].classList.add('focus');
    for (const c of targets) this.cells[c].classList.add('target');
    this.highlightTimer = window.setTimeout(() => this.clearHighlights(), 3600);
    this.showMessage(d.message);
  }

  private clearHighlights(): void {
    clearTimeout(this.highlightTimer);
    for (const c of this.cells) c.classList.remove('focus', 'target');
  }

  private runMouse(run: MouseRun): void {
    this.busy = true;
    this.root.querySelector('.item.mouse')?.classList.add('busy');
    const n = this.game.n;
    const path = Array.from({ length: n }, (_, j) => (run.line === 'row' ? run.index * n + j : j * n + run.index));
    const runner = document.createElement('div');
    runner.className = 'runner';
    runner.innerHTML = use('art-mouse');
    this.board.appendChild(runner);
    const place = (cell: number, off = 0) => {
      const c = this.cells[cell];
      const dx = run.line === 'row' ? off * c.offsetWidth : 0;
      const dy = run.line === 'col' ? off * c.offsetHeight : 0;
      runner.style.transform = `translate(${c.offsetLeft + c.offsetWidth * 0.05 + dx}px, ${
        c.offsetTop + c.offsetHeight * 0.05 + dy
      }px)`;
    };
    place(path[0], -1);
    runner.style.transition = 'transform .12s linear';
    this.sound.squeak();
    const label = run.line === 'row' ? `${run.index + 1}행` : `${run.index + 1}열`;
    this.showMessage(`쥐가 ${label}을 달리며 고양이가 없는 칸을 X 로 표시해요!`, 3200);
    let k = 0;
    const timer = window.setInterval(() => {
      if (this.destroyed) return clearInterval(timer);
      if (k < path.length) {
        place(path[k]);
        const cell = path[k];
        setTimeout(() => {
          if (run.cells.includes(cell)) {
            this.game.applyMouse(run, cell);
            this.sound.step();
          }
        }, 60);
        k++;
      } else {
        clearInterval(timer);
        place(path[path.length - 1], 1.2);
        setTimeout(() => {
          runner.remove();
          this.busy = false;
          this.root.querySelector('.item.mouse')?.classList.remove('busy');
          this.sound.squeak();
        }, 160);
      }
    }, 125);
  }

  /* ───────── 시간·저장 ───────── */

  private tick(): void {
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (document.hidden || isSheetOpen()) return;
    this.game.tick(Math.min(dt, 2000));
    if (Math.round(this.game.elapsed / 1000) % 10 === 0) this.schedulePersist();
  }

  private schedulePersist(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persistNow(), 250);
  }

  persistNow(): void {
    if (this.game.status === 'won') delete this.host.save.progress[this.mode];
    else this.host.save.progress[this.mode] = this.game.toProgress();
    this.host.persist();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.persistNow();
    this.destroyed = true;
    this.offGame();
    this.intervals.forEach((t) => clearInterval(t));
    clearTimeout(this.saveTimer);
    clearTimeout(this.bannerTimer);
    clearTimeout(this.highlightTimer);
    cancelAnimationFrame(this.scoreRaf);
    this.root.remove();
  }
}
