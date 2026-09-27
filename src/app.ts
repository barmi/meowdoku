import { dailyPuzzle, difficultyOf, levelPuzzle, todayKey } from './core/levels';
import type { WinSummary } from './game/game';
import { Sound } from './game/sound';
import { Stats } from './game/stats';
import { type ItemKey, type SaveData, clearSave, defaultSave, loadSave, writeSave } from './game/storage';
import { merge3, standingOf } from './game/merge';
import { type Remote, SyncClient } from './game/sync';
import { spriteMarkup, use } from './ui/art';
import { GameView, ITEM_DESC, ITEM_LABEL } from './ui/gameView';
import { HomeView } from './ui/homeView';
import { StatsView } from './ui/statsView';
import { watchLayout } from './ui/layout';
import { confetti, openSheet, toast } from './ui/overlay';

const MAX_LEVEL = 9999;
const ITEM_ICON: Record<ItemKey, string> = { cat: 'cat-wink', bulb: 'art-bulb', mouse: 'art-mouse' };

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const clampLevel = (x: number) => Math.min(MAX_LEVEL, Math.max(1, Math.floor(x) || 1));

export class App {
  save: SaveData = loadSave();
  readonly sound = new Sound();
  readonly stats = new Stats(this);
  readonly sync = new SyncClient();
  private readonly root: HTMLElement;
  private view: GameView | HomeView | StatsView | null = null;
  private pushTimer = 0;
  private pushing = false;
  private pushAgain = false;
  private pulling = false;

  constructor(root: HTMLElement) {
    this.root = root;
    document.body.insertAdjacentHTML('afterbegin', spriteMarkup());
    this.applySettings();
    watchLayout();
    // 화면이 가려질 때(다른 기기로 옮겨 갈 때) 바로 저장하고, 돌아오면 다른 기기의 진행을 확인한다
    const flush = () => {
      if (this.view instanceof GameView) this.view.persistNow(false);
      writeSave(this.save);
      if (this.sync.available && this.sync.dirty) void this.pushNow();
    };
    document.addEventListener('visibilitychange', () => (document.hidden ? flush() : void this.pull()));
    window.addEventListener('pagehide', flush);
    window.addEventListener('focus', () => void this.pull());
    window.addEventListener('online', () => void this.pull());
  }

  /** ?level=701 → 그 레벨, ?daily → 오늘의 퍼즐, ?home → 홈, ?stats → 하루 통계. 기본은 이어서 하기 */
  async start(): Promise<void> {
    await this.initialSync();
    const q = new URLSearchParams(location.search);
    if (q.has('level')) return this.play(clampLevel(Number(q.get('level'))));
    if (q.has('daily')) return this.playDaily();
    if (q.has('home')) return this.goHome();
    if (q.has('stats')) return this.openStats();
    this.play();
  }

  /* ───────── 기기 사이 이어하기 (#6) ─────────
   * 서버(/api/state)에 게임 상태를 통째로 두고 rev 로 순서를 맞춘다. 화면을 실시간으로 맞추지는
   * 않고, 액션 결과를 올리고 시작·복귀할 때 최신 상태를 받는다. base 는 마지막으로 서버와 맞춘
   * 상태로, 두 기기가 각자 바꿨을 때 3-way 로 합치는 기준이다.
   */

  /** 처음 열 때 서버 상태와 맞춘다. 서버 API 가 없으면(정적 서빙) 이 기기 저장본으로 한다. */
  private async initialSync(): Promise<void> {
    const remote = await this.sync.fetchRemote();
    if (!remote) return;
    if (!remote.data) {
      // 서버가 비었다 → 이 기기 상태를 공유 상태로 올린다
      this.sync.rev = remote.rev;
      await this.pushNow(true);
      return;
    }
    if (remote.rev === this.sync.rev) {
      if (this.changedSinceBase()) void this.pushNow();
      return;
    }
    this.reconcile(remote);
  }

  private changedSinceBase(): boolean {
    return !this.sync.base || JSON.stringify(this.save) !== JSON.stringify(this.sync.base);
  }

  /** 서버 상태를 그대로 이 기기의 상태로 삼는다 */
  private takeRemote(remote: Remote): void {
    if (!remote.data) return;
    this.save = remote.data;
    this.sync.rev = remote.rev;
    this.sync.setBase(remote.data);
    this.sync.syncedAt = remote.updatedAt;
    this.sync.dirty = false;
    this.sync.saveMeta();
    writeSave(this.save);
    this.applySettings();
  }

  /** 마지막 액션의 결과를 저장한다. push=false 면 이 기기에만 (시간 경과처럼 사소한 변경) */
  persist(push = true): void {
    writeSave(this.save);
    if (!this.sync.available) return;
    this.sync.dirty = this.changedSinceBase();
    this.sync.saveMeta();
    if (push && this.sync.dirty) this.schedulePush();
  }

  private schedulePush(delay = 300): void {
    clearTimeout(this.pushTimer);
    this.pushTimer = window.setTimeout(() => void this.pushNow(), delay);
  }

  /** 바뀐 게 있을 때만 올린다 — 열어 보기만 한 기기가 rev 를 올려 다른 기기와 부딪치지 않게 */
  private async pushNow(force = false): Promise<void> {
    clearTimeout(this.pushTimer);
    if (this.pushing) {
      this.pushAgain = true;
      return;
    }
    if (!force && !this.changedSinceBase()) {
      this.sync.dirty = false;
      this.sync.saveMeta();
      return;
    }
    this.pushing = true;
    try {
      const snapshot = JSON.parse(JSON.stringify(this.save)) as SaveData;
      const res = await this.sync.push(snapshot);
      if (res.status === 'conflict') {
        this.pushAgain = false;
        this.reconcile(res.remote);
      } else if (res.status === 'offline') {
        this.schedulePush(15_000);
      }
    } finally {
      this.pushing = false;
      if (this.pushAgain) {
        this.pushAgain = false;
        void this.pushNow();
      } else if (this.sync.online && this.changedSinceBase()) {
        // 올리는 사이에 또 바뀌었다
        this.schedulePush(50);
      }
    }
  }

  /** 화면으로 돌아오면 다른 기기가 더 진행했는지 본다 */
  private async pull(): Promise<void> {
    if (this.pulling || this.pushing) return;
    this.pulling = true;
    try {
      const remote = await this.sync.fetchRemote();
      if (!remote) return;
      if (!remote.data) {
        this.sync.rev = remote.rev;
        void this.pushNow(true);
        return;
      }
      if (remote.rev === this.sync.rev) {
        if (this.changedSinceBase()) void this.pushNow();
        return;
      }
      this.reconcile(remote);
    } finally {
      this.pulling = false;
    }
  }

  /**
   * 서버가 이 기기가 알던 것보다 앞서 있다 (다른 기기가 저장했다).
   * - 붙잡고 있던 판이 다른 곳에서 끝났거나 다른 판으로 바뀌었으면 → 경고 후 새로 로딩
   * - 같은 판을 다른 곳에서 더 진행했으면 → 그 진행으로 새로 로딩 (알림)
   * - 이 판은 건드리지 않았으면 → 이 기기의 변경을 서버 상태에 얹어(3-way) 저장, 화면은 그대로
   */
  private reconcile(remote: Remote): void {
    const data = remote.data;
    if (!data) return;
    const base = this.sync.base;
    const view = this.view;
    if (!base) {
      // 이 기기는 서버와 맞춰 본 적이 없다 → 합칠 기준이 없으니 서버 상태를 그대로 받는다
      if (!view) return this.takeRemote(remote);
      return this.replaceWithRemote(remote, '', false);
    }
    if (view instanceof GameView && view.game.status !== 'won') {
      const standing = standingOf(data, base, view.mode, view.game.gameId);
      if (standing === 'finished') return this.replaceWithRemote(remote, '이 판은 다른 곳에서 이미 끝났어요.', true);
      if (standing === 'other') return this.replaceWithRemote(remote, '다른 곳에서 다른 판을 진행하고 있어요.', false);
      if (standing === 'advanced') return this.replaceWithRemote(remote, '', false);
    }
    const merged = merge3(base, this.save, data);
    this.save = merged;
    this.sync.rev = remote.rev;
    this.sync.setBase(data);
    this.sync.syncedAt = remote.updatedAt;
    writeSave(merged);
    this.applySettings();
    this.sync.dirty = this.changedSinceBase();
    this.sync.saveMeta();
    if (view instanceof GameView) view.refreshItems();
    else if (view instanceof HomeView) this.goHome();
    else if (view instanceof StatsView) this.openStats();
    if (this.sync.dirty) void this.pushNow();
  }

  private replaceWithRemote(remote: Remote, warning: string, finished: boolean): void {
    const view = this.view;
    if (view instanceof GameView) view.discard(); // 옛 판 상태를 다시 저장하지 않는다
    this.takeRemote(remote);
    const reload = () => {
      if (view instanceof GameView) {
        if (view.mode === 'daily') return finished ? this.goHome() : this.playDaily();
        return this.play();
      }
      if (view instanceof StatsView) return this.openStats();
      return this.goHome();
    };
    if (warning) {
      openSheet({
        html: `<div class="hero">${use('cat-static')}</div><h2>진행 상태가 달라요</h2>
          <p>${warning}<br>다른 곳에서 저장한 최신 상태로 새로 불러올게요.</p>`,
        dismissible: false,
        actions: [{ label: '새로 불러오기', kind: 'primary', onClick: reload }],
      });
      return;
    }
    reload();
    toast('다른 곳에서 진행한 내용을 불러왔어요');
  }

  private applySettings(): void {
    this.sound.enabled = this.save.settings.sound;
    this.sound.vibrate = this.save.settings.vibrate;
  }

  private mount(view: GameView | HomeView | StatsView): void {
    this.root.querySelector('.boot')?.remove();
    this.view?.destroy();
    this.view = view;
    this.root.appendChild(view.root);
    window.scrollTo(0, 0);
  }

  play(level = this.save.level): void {
    level = clampLevel(level);
    if (level !== this.save.level) {
      this.save.level = level;
      delete this.save.progress.level;
    }
    const puzzle = levelPuzzle(level);
    const saved = this.save.progress.level;
    this.mount(new GameView(this, 'level', puzzle, level, saved?.sig === puzzle.sig ? saved : null));
    this.persist();
    // 다음 판은 크기가 랜덤이라 10×10 이면 만드는 데 조금 걸린다 — 한가할 때 미리 만들어 둔다
    const warm = () => levelPuzzle(clampLevel(level + 1));
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1500);
    if (!this.save.seenHelp) {
      this.save.seenHelp = true;
      this.persist();
      setTimeout(() => this.showHelp(), 350);
    }
  }

  playDaily(): void {
    const puzzle = dailyPuzzle(todayKey());
    const saved = this.save.progress.daily;
    this.mount(new GameView(this, 'daily', puzzle, 0, saved?.sig === puzzle.sig ? saved : null));
  }

  goHome(): void {
    this.mount(new HomeView(this));
  }

  openStats(): void {
    this.mount(new StatsView(this));
  }

  won(view: GameView, s: WinSummary): void {
    this.stats.cleared({
      at: Date.now(),
      mode: view.mode,
      level: view.level,
      size: view.game.n,
      diff: difficultyOf(view.game.puzzle).label,
      ms: Math.round(s.elapsed),
      score: s.total,
      mistakes: s.mistakes,
    });
    const table = `<div class="score-table">
        <div><span>고양이 점수</span><b>${s.catPoints.toLocaleString()}</b></div>
        <div><span>남은 물고기 보너스</span><b>+${s.fishBonus}</b></div>
        ${s.perfectBonus ? `<div><span>실수 없이 클리어!</span><b>+${s.perfectBonus}</b></div>` : ''}
        <div><span>시간 보너스 · ${fmtTime(s.elapsed)}</span><b>+${s.timeBonus}</b></div>
        <div class="total"><span>총점</span><b>${s.total.toLocaleString()}</b></div>
      </div>`;
    const cats = `<div class="cat-row">${use('cat-static').repeat(3)}</div>`;

    if (view.mode === 'daily') {
      const key = todayKey();
      if (!this.save.daily[key]) this.save.daily[key] = { score: s.total, ms: Math.round(s.elapsed) };
      delete this.save.progress.daily;
      this.save.totalScore += s.total;
      this.persist();
      const sheet = openSheet({
        html: `${cats}<h2>오늘의 퍼즐 완료!</h2>${table}`,
        dismissible: false,
        actions: [{ label: '홈으로', kind: 'primary', onClick: () => this.goHome() }],
      });
      confetti(36, sheet.root.parentElement!);
      return;
    }

    const lv = view.level;
    this.save.best = Math.max(this.save.best, lv);
    this.save.cleared++;
    this.save.totalScore += s.total;
    if (this.save.level === lv) this.save.level = clampLevel(lv + 1);
    delete this.save.progress.level;
    const reward = (['bulb', 'cat', 'mouse'] as const)[this.save.rewardTurn++ % 3];
    this.save.items[reward]++;
    this.persist();
    const next = clampLevel(lv + 1);
    const nextPuzzle = levelPuzzle(next);
    const sheet = openSheet({
      html: `${cats}<h2>레벨 ${lv} 클리어!</h2>${table}
        <div class="reward">${use(ITEM_ICON[reward])}<span>${ITEM_LABEL[reward]} +1</span></div>`,
      dismissible: false,
      actions: [
        {
          label: `레벨 ${next} 시작 · ${nextPuzzle.size}×${nextPuzzle.size} ${difficultyOf(nextPuzzle).label}`,
          kind: 'primary',
          icon: 'ico-play',
          onClick: () => this.play(next),
        },
        { label: '홈으로', kind: 'soft', onClick: () => this.goHome() },
      ],
    });
    confetti(36, sheet.root.parentElement!);
  }

  private syncLine(): string {
    if (!this.sync.available) return '저장: 이 기기에만 (서버 저장 API 없음)';
    const at = this.sync.syncedAt
      ? new Date(this.sync.syncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '-';
    if (!this.sync.online) return `저장: 서버에 연결 안 됨 — 이 기기에 저장해 두고 연결되면 올려요 (마지막 동기화 ${at})`;
    return `저장: 서버와 동기화됨 · 마지막 저장 ${at}${this.sync.dirty ? ' · 올리는 중' : ''}`;
  }

  openSettings(view?: GameView): void {
    const st = this.save.settings;
    const row = (key: keyof typeof st, label: string, desc: string) =>
      `<div class="setting" data-key="${key}"><div>${label}<small>${desc}</small></div>
        <span class="toggle ${st[key] ? 'on' : ''}" role="switch" aria-checked="${st[key]}"></span></div>`;
    const sheet = openSheet({
      html: `<h2>설정</h2><div class="settings-list">
        ${row('sound', '효과음', '탭·고양이·물고기 소리')}
        ${row('vibrate', '진동', '지원하는 기기(안드로이드 등)에서만')}
        ${row('autoX', '자동 X 표시', '고양이를 놓으면 같은 행·열·색깔과 주변 칸을 X 로 채워요')}
      </div>
      <p class="hint-line sync-line">${this.syncLine()}</p>`,
      actions: [
        { label: '게임 방법', kind: 'soft', onClick: () => void setTimeout(() => this.showHelp(), 30) },
        view
          ? {
              label: '이 판 처음부터',
              kind: 'soft',
              onClick: () =>
                void setTimeout(
                  () =>
                    this.confirm('처음부터 다시 할까요?', '놓은 X 와 고양이, 점수가 모두 지워지고 물고기가 다시 3마리가 돼요.', () =>
                      view.restart(),
                    ),
                  30,
                ),
            }
          : {
              label: '기록 초기화',
              kind: 'soft',
              onClick: () =>
                void setTimeout(
                  () =>
                    this.confirm('기록을 모두 지울까요?', '레벨, 점수, 아이템이 처음 상태로 돌아가요.', () => {
                      clearSave();
                      this.save = defaultSave();
                      this.applySettings();
                      this.persist(); // 서버에 둔 공유 상태도 처음으로
                      this.goHome();
                      toast('기록을 초기화했어요');
                    }),
                  30,
                ),
            },
        { label: '닫기', kind: 'primary' },
      ],
    });
    for (const el of sheet.root.querySelectorAll<HTMLElement>('.setting')) {
      el.addEventListener('click', () => {
        const key = el.dataset.key as keyof typeof st;
        st[key] = !st[key];
        const t = el.querySelector('.toggle')!;
        t.classList.toggle('on', st[key]);
        t.setAttribute('aria-checked', String(st[key]));
        this.applySettings();
        view?.setAutoX(st.autoX);
        this.persist();
        if (key === 'sound' && st.sound) this.sound.mark();
      });
    }
  }

  confirm(title: string, text: string, onYes: () => void): void {
    openSheet({
      html: `<h2>${title}</h2><p>${text}</p>`,
      actions: [
        { label: '네', kind: 'primary', onClick: onYes },
        { label: '아니요', kind: 'soft' },
      ],
    });
  }

  showHelp(): void {
    const demo = (inner: string) => `<div class="demo">${inner}</div>`;
    const itemRow = (key: ItemKey) =>
      `<div class="step"><div class="item-demo">${use(ITEM_ICON[key])}</div><div><b>${ITEM_LABEL[key]}</b><br>${ITEM_DESC[key]}</div></div>`;
    openSheet({
      html: `<h2>게임 방법</h2>
        <p>모든 <b>행</b>과 <b>열</b>, 모든 <b>색깔 영역</b>에 고양이가 딱 한 마리씩 있어요.
        고양이끼리는 <b>대각선으로도 붙어 있을 수 없어요.</b></p>
        <div class="howto">
          <div class="step">${demo(use('pat-sparkle') + use('mark-x'))}<div>빈 칸을 <b>한 번</b> 누르면 X — 고양이가 없는 칸을 표시해요.</div></div>
          <div class="step">${demo(use('pat-sparkle') + use('cat-static'))}<div>X 를 <b>한 번 더</b> 누르면 고양이! 틀리면 물고기 한 마리를 잃어요. 물고기를 다 잃으면 게임 오버.</div></div>
          <div class="step"><div class="strip">${demo(use('mark-x')).repeat(3)}${demo('')}</div><div>누른 채로 <b>쓸면</b> 여러 칸에 X. X 에서 시작해 쓸면 지우개가 돼요.</div></div>
          ${itemRow('cat')}${itemRow('bulb')}${itemRow('mouse')}
        </div>`,
      actions: [{ label: '시작하기', kind: 'primary' }],
    });
  }

  pickLevel(): void {
    let value = this.save.level;
    const sheet = openSheet({
      html: `<h2>레벨 선택</h2>
        <p class="hint-line">번호마다 판 크기와 난이도가 랜덤이에요. 원본 스크린샷의 판은 701(8×8)과 702(9×9).</p>
        <div class="stepper">
          <button data-d="-10">-10</button><button data-d="-1">-1</button>
          <input type="number" inputmode="numeric" min="1" max="${MAX_LEVEL}" value="${value}" aria-label="레벨">
          <button data-d="1">+1</button><button data-d="10">+10</button>
        </div>
        <p class="hint-line" data-size></p>`,
      actions: [
        { label: '이 레벨 하기', kind: 'primary', icon: 'ico-play', onClick: () => this.play(value) },
        { label: '닫기', kind: 'soft' },
      ],
    });
    const input = sheet.root.querySelector('input')!;
    const sizeLine = sheet.root.querySelector<HTMLElement>('[data-size]')!;
    // 판을 실제로 만들어 봐야 난이도를 알 수 있다 (수 ms~0.1초) — 입력이 멈추면 계산
    let timer = 0;
    const show = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const p = levelPuzzle(value);
        const d = difficultyOf(p);
        sizeLine.textContent = `${p.size}×${p.size} 판 · 난이도 ${'★'.repeat(d.stars)}${'☆'.repeat(4 - d.stars)} ${d.label}`;
      }, 120);
    };
    show();
    input.addEventListener('input', () => {
      value = clampLevel(Number(input.value));
      show();
    });
    for (const b of sheet.root.querySelectorAll<HTMLButtonElement>('[data-d]')) {
      b.addEventListener('click', () => {
        value = clampLevel(value + Number(b.dataset.d));
        input.value = String(value);
        show();
      });
    }
  }
}
