import { todayKey } from '../core/levels';
import { type DayStats, KEEP_DAYS, type Stats, shiftDay } from '../game/stats';
import type { SaveData } from '../game/storage';
import { catFace, use } from './art';
import { fmtClock, fmtDuration, fmtHourMinute, fmtNum } from './format';

export interface StatsHost {
  save: SaveData;
  stats: Stats;
  goHome(): void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 하루 통계 화면 (#5). 막대는 한 계열이라 범례 없이 제목으로 설명하고, 값은 가장 큰 막대에만
 * 적는다(나머지는 눌러서 보기 + 화면 읽기용 표). 막대 색 #D9722C 는 흰 카드 위 대비 3:1 이상.
 */
export class StatsView {
  readonly root: HTMLElement;
  private readonly host: StatsHost;
  private key: string;

  constructor(host: StatsHost, key = todayKey()) {
    this.host = host;
    this.key = key;
    this.root = document.createElement('section');
    this.root.className = 'stats-screen';
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'back') return this.host.goHome();
      if (act === 'prev' || act === 'next') {
        this.key = shiftDay(this.key, act === 'prev' ? -1 : 1);
        return this.render();
      }
      const col = t.closest<HTMLElement>('.hcol');
      if (col) this.showTip(col);
    });
    this.root.addEventListener('pointerover', (e) => {
      const col = (e.target as HTMLElement).closest<HTMLElement>('.hcol');
      if (col && e.pointerType === 'mouse') this.showTip(col);
    });
    this.render();
  }

  private render(): void {
    const today = todayKey();
    const [y, m, dd] = this.key.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(y, m - 1, dd).getDay()];
    const tag = this.key === today ? '오늘' : this.key === shiftDay(today, -1) ? '어제' : '';
    const d = this.host.stats.peek(this.key);
    const hasData = !!d && (d.boards.length > 0 || d.playMs > 0 || d.cleared > 0);
    this.root.innerHTML = `
      <header class="topbar">
        <button class="round-btn left" data-act="back" aria-label="뒤로">${use('ico-back')}</button>
        <h1 class="screen-title">하루 통계</h1>
      </header>
      <div class="date-nav">
        <button data-act="prev" aria-label="이전 날" ${this.key <= shiftDay(today, -KEEP_DAYS) ? 'disabled' : ''}>‹</button>
        <div class="date">${m}월 ${dd}일 (${weekday})${tag ? ` <small>${tag}</small>` : ''}</div>
        <button data-act="next" aria-label="다음 날" ${this.key >= today ? 'disabled' : ''}>›</button>
      </div>
      ${hasData ? this.body(d!) : this.empty(this.key === today)}`;
  }

  private empty(isToday: boolean): string {
    return `<div class="card stats-empty">
        <div class="sleepy">${catFace('sleepy')}</div>
        <p>이날은 플레이 기록이 없어요.</p>
        ${isToday ? '<p class="hint-line">판을 하나 풀면 여기에 기록이 쌓여요.</p>' : ''}
      </div>`;
  }

  private body(d: DayStats): string {
    const played = Math.max(d.boards.length, d.cleared);
    const rate = played ? Math.round((d.cleared / played) * 100) : 0;
    const peakHour = d.hours.indexOf(Math.max(...d.hours));
    const streak = this.host.stats.streak(this.key);
    const tile = (label: string, value: string, sub = '') =>
      `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    return `
      <div class="tiles">
        ${tile('클리어', `${d.cleared}판`, `${played}판 플레이 · ${rate}%`)}
        ${tile('플레이 시간', fmtDuration(d.playMs), d.playMs ? `가장 많이 한 때 ${peakHour}시` : '')}
        ${tile('얻은 점수', fmtNum(d.score), `맞힌 고양이 ${d.cats}마리`)}
        ${tile('연속 플레이', `${streak}일`, streak > 1 ? '하루도 빠짐없이!' : '')}
      </div>
      ${this.hourChart(d)}
      ${this.records(d)}
      <div class="card">
        <h3>실수와 아이템</h3>
        <div class="kv"><span>틀린 고양이 (잃은 물고기)</span><b>${d.mistakes}</b></div>
        <div class="kv"><span>게임 오버</span><b>${d.gameOvers}</b></div>
        <div class="item-uses">
          <div>${use('cat-wink')}<b>${d.items.cat}</b><span>고양이</span></div>
          <div>${use('art-bulb')}<b>${d.items.bulb}</b><span>힌트</span></div>
          <div>${use('art-mouse')}<b>${d.items.mouse}</b><span>쥐</span></div>
        </div>
      </div>
      ${this.sizeChart(d)}
      ${this.clearList(d)}`;
  }

  private hourChart(d: DayStats): string {
    const max = Math.max(...d.hours);
    if (!max) return '';
    const minutes = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}초` : `${Math.round(ms / 60000)}분`);
    const cols = d.hours
      .map((ms, h) => {
        const pct = ms ? Math.max(3, (ms / max) * 100) : 0;
        const label = ms === max ? `<b class="hmax">${minutes(ms)}</b>` : '';
        return `<div class="hcol${ms ? '' : ' zero'}" data-tip="${h}시 · ${ms ? minutes(ms) : '안 함'}">${label}<i style="height:${pct}%"></i></div>`;
      })
      .join('');
    const rows = d.hours
      .map((ms, h) => (ms ? `<tr><th>${h}시</th><td>${minutes(ms)}</td></tr>` : ''))
      .join('');
    return `<div class="card">
        <h3>시간대별 플레이</h3>
        <div class="hchart">
          <div class="hours" aria-hidden="true">${cols}</div>
          <div class="haxis" aria-hidden="true"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span></div>
          <div class="htip" hidden></div>
        </div>
        <table class="sr-only"><caption>시간대별 플레이 시간</caption>${rows}</table>
      </div>`;
  }

  private showTip(col: HTMLElement): void {
    const chart = col.closest('.hchart');
    const tip = chart?.querySelector<HTMLElement>('.htip');
    if (!chart || !tip) return;
    for (const c of chart.querySelectorAll('.hcol.on')) c.classList.remove('on');
    col.classList.add('on');
    tip.textContent = col.dataset.tip ?? '';
    tip.hidden = false;
    const cr = chart.getBoundingClientRect();
    const r = col.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(r.left - cr.left + r.width / 2, 34), cr.width - 34)}px`;
  }

  private records(d: DayStats): string {
    const c = d.clears;
    if (!c.length) return `<div class="card"><h3>기록</h3><p class="hint-line">아직 클리어한 판이 없어요.</p></div>`;
    const name = (r: (typeof c)[number]) => (r.mode === 'daily' ? '오늘의 퍼즐' : `레벨 ${r.level}`);
    const fastest = c.reduce((a, b) => (b.ms < a.ms ? b : a));
    const best = c.reduce((a, b) => (b.score > a.score ? b : a));
    const avg = c.reduce((a, b) => a + b.ms, 0) / c.length;
    const perfect = c.filter((r) => r.mistakes === 0).length;
    return `<div class="card">
        <h3>기록</h3>
        <div class="kv"><span>평균 클리어 시간</span><b>${fmtClock(avg)}</b></div>
        <div class="kv"><span>가장 빠른 클리어</span><b>${fmtClock(fastest.ms)} <small>${name(fastest)} · ${fastest.size}×${fastest.size}</small></b></div>
        <div class="kv"><span>최고 점수 판</span><b>${fmtNum(best.score)}점 <small>${name(best)}</small></b></div>
        <div class="kv"><span>실수 없이 클리어</span><b>${perfect}판</b></div>
      </div>`;
  }

  private sizeChart(d: DayStats): string {
    if (!d.clears.length) return '';
    const counts = new Map<number, number>();
    for (const r of d.clears) counts.set(r.size, (counts.get(r.size) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const rows = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([size, n]) => `<div class="srow"><span>${size}×${size}</span>
          <div class="strack"><i style="width:${(n / max) * 100}%"></i></div><b>${n}판</b></div>`,
      )
      .join('');
    return `<div class="card"><h3>판 크기별 클리어</h3>${rows}</div>`;
  }

  private clearList(d: DayStats): string {
    if (!d.clears.length) return '';
    const rows = [...d.clears]
      .reverse()
      .map(
        (r) => `<div class="crow">
          <span class="when">${fmtHourMinute(r.at)}</span>
          <div class="what"><b>${r.mode === 'daily' ? '오늘의 퍼즐' : `레벨 ${r.level}`}</b><small>${r.size}×${r.size} · ${r.diff}${r.mistakes ? ` · 실수 ${r.mistakes}` : ''}</small></div>
          <div class="how"><b>${fmtNum(r.score)}점</b><small>${fmtClock(r.ms)}</small></div>
        </div>`,
      )
      .join('');
    return `<div class="card"><h3>클리어한 판</h3>${rows}</div>`;
  }

  destroy(): void {
    this.root.remove();
  }
}
