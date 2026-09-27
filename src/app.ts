import { dailyPuzzle, difficultyOf, levelPuzzle, todayKey } from './core/levels';
import type { WinSummary } from './game/game';
import { Sound } from './game/sound';
import { type ItemKey, type SaveData, clearSave, defaultSave, loadSave, writeSave } from './game/storage';
import { spriteMarkup, use } from './ui/art';
import { GameView, ITEM_DESC, ITEM_LABEL } from './ui/gameView';
import { HomeView } from './ui/homeView';
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
  private readonly root: HTMLElement;
  private view: GameView | HomeView | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    document.body.insertAdjacentHTML('afterbegin', spriteMarkup());
    this.applySettings();
    watchLayout();
    const flush = () => {
      if (this.view instanceof GameView) this.view.persistNow();
    };
    document.addEventListener('visibilitychange', () => document.hidden && flush());
    window.addEventListener('pagehide', flush);
  }

  /** ?level=701 → 그 레벨, ?daily → 오늘의 퍼즐, ?home → 홈. 기본은 이어서 하기 */
  start(): void {
    const q = new URLSearchParams(location.search);
    if (q.has('level')) return this.play(clampLevel(Number(q.get('level'))));
    if (q.has('daily')) return this.playDaily();
    if (q.has('home')) return this.goHome();
    this.play();
  }

  persist(): void {
    writeSave(this.save);
  }

  private applySettings(): void {
    this.sound.enabled = this.save.settings.sound;
    this.sound.vibrate = this.save.settings.vibrate;
  }

  private mount(view: GameView | HomeView): void {
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

  won(view: GameView, s: WinSummary): void {
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
      </div>`,
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
