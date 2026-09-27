import { difficultyOf, levelPuzzle, todayKey } from '../core/levels';
import { COLOR_ORDER, PALETTE } from '../core/palette';
import type { Stats } from '../game/stats';
import type { SaveData } from '../game/storage';
import { catFace, use } from './art';
import { calmMotion } from './layout';
import { fmtDuration, fmtNum } from './format';

export interface HomeHost {
  save: SaveData;
  stats: Stats;
  openStats(): void;
  play(level?: number): void;
  playDaily(): void;
  openSettings(): void;
  pickLevel(): void;
}

/** 첫 화면 — 원본 스크린샷에는 없어서 게임 화면과 같은 톤으로 만들었다 */
export class HomeView {
  readonly root: HTMLElement;
  private readonly timer: number;

  constructor(host: HomeHost) {
    const { save } = host;
    const level = save.level;
    const puzzle = levelPuzzle(level);
    const n = puzzle.size;
    const diff = difficultyOf(puzzle);
    const resume = save.progress.level?.sig === puzzle.sig;
    const today = todayKey();
    const [, mm, dd] = today.split('-').map(Number);
    const done = save.daily[today];
    const day = host.stats.peek(today);

    this.root = document.createElement('section');
    this.root.className = 'home';
    this.root.innerHTML = `
      <header class="topbar">
        <button class="round-btn right" data-act="settings" aria-label="설정">${use('ico-gear')}</button>
      </header>
      <div class="logo">
        <div class="big-cat">${catFace()}</div>
        <h1>Meowdoku</h1>
        <div class="sub">색깔·행·열마다 고양이 한 마리</div>
        <div class="head-row">${COLOR_ORDER.map(
          (c) => `<svg viewBox="0 0 100 100" style="color:${PALETTE[c].head}"><use href="#cat-head"/></svg>`,
        ).join('')}</div>
      </div>
      <div class="menu">
        <div class="card">
          <div class="row">
            <div>
              <div class="title">${resume ? '이어서 하기' : '다음 레벨'}</div>
              <div class="big">레벨 ${level}</div>
              <div class="meta">${n}×${n} 판 · 난이도 ${'★'.repeat(diff.stars)}${'☆'.repeat(4 - diff.stars)} ${diff.label}</div>
            </div>
            <button class="link" data-act="pick">레벨 선택</button>
          </div>
          <button class="btn primary" data-act="play">${use('ico-play')}<span>플레이</span></button>
        </div>
        <div class="card">
          <div class="row">
            <div>
              <div class="title">오늘의 퍼즐</div>
              <div class="big" style="font-size:calc(26 * var(--px))">${mm}월 ${dd}일</div>
              <div class="meta">9×9 판 · 하루 한 판</div>
            </div>
            ${done ? `<span class="done-chip">✓ ${done.score.toLocaleString()}점</span>` : ''}
          </div>
          <button class="btn ${done ? 'soft' : 'green'}" data-act="daily">${done ? '다시 풀기' : '도전하기'}</button>
        </div>
        <div class="card">
          <div class="row">
            <div class="title">오늘</div>
            <button class="link" data-act="stats">하루 통계 ›</button>
          </div>
          <div class="stat-grid today">
            <div><b>${day?.cleared ?? 0}판</b><span>클리어</span></div>
            <div><b>${fmtDuration(day?.playMs ?? 0)}</b><span>플레이</span></div>
            <div><b>${fmtNum(day?.score ?? 0)}</b><span>점수</span></div>
          </div>
          <div class="meta total-line">전체 · 최고 레벨 ${save.best} · 클리어 ${save.cleared}판 · 총점 ${fmtNum(save.totalScore)}</div>
        </div>
      </div>`;

    this.root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'play') host.play();
      else if (act === 'daily') host.playDaily();
      else if (act === 'settings') host.openSettings();
      else if (act === 'pick') host.pickLevel();
      else if (act === 'stats') host.openStats();
    });

    // 큰 고양이도 가끔 두리번거린다
    const face = this.root.querySelector<SVGElement>('.big-cat .catface')!;
    const moods = ['look-l', 'look-r', 'look-u', 'blink', 'blink', 'smug'];
    this.timer = window.setInterval(() => {
      if (calmMotion() && Math.random() < 2 / 3) return; // 동작 줄이기 (#14)
      const m = moods[Math.floor(Math.random() * moods.length)];
      face.classList.add(m);
      setTimeout(() => face.classList.remove(m), m === 'blink' ? 140 : 1300);
    }, 1600);
  }

  destroy(): void {
    clearInterval(this.timer);
    this.root.remove();
  }
}
