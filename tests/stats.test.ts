import { describe, expect, it } from 'vitest';
import { KEEP_DAYS, Stats, shiftDay } from '../src/game/stats';
import { defaultSave } from '../src/game/storage';

function setup(start = new Date(2026, 8, 27, 21, 30)) {
  let now = start;
  const host = { save: defaultSave() };
  const stats = new Stats(host, () => now);
  return { host, stats, setNow: (d: Date) => (now = d) };
}

const clear = (score: number, ms: number, mistakes = 0) => ({
  at: 0,
  mode: 'level' as const,
  level: 1,
  size: 8,
  diff: '보통',
  ms,
  score,
  mistakes,
});

describe('하루 통계', () => {
  it('판·시간·실수·아이템·클리어를 오늘 날짜에 모은다', () => {
    const { host, stats } = setup();
    stats.touch('L1');
    stats.touch('L1');
    stats.touch('L2');
    stats.addTime(60_000);
    stats.addTime(30_000);
    stats.cat();
    stats.mistake();
    stats.gameOver();
    stats.item('bulb');
    stats.cleared(clear(1200, 90_000));
    const d = host.save.stats['2026-09-27'];
    expect(d.boards).toEqual(['L1', 'L2']);
    expect(d.playMs).toBe(90_000);
    expect(d.hours[21]).toBe(90_000);
    expect(d.cats).toBe(1);
    expect(d.mistakes).toBe(1);
    expect(d.gameOvers).toBe(1);
    expect(d.items).toEqual({ cat: 0, bulb: 1, mouse: 0 });
    expect(d.cleared).toBe(1);
    expect(d.score).toBe(1200);
    expect(d.clears).toHaveLength(1);
  });

  it('날짜가 바뀌면 새 날에 쌓이고, 읽기만 해서는 기록이 생기지 않는다', () => {
    const { host, stats, setNow } = setup();
    stats.touch('L1');
    setNow(new Date(2026, 8, 28, 0, 5));
    stats.touch('L2');
    expect(Object.keys(host.save.stats).sort()).toEqual(['2026-09-27', '2026-09-28']);
    expect(stats.peek('2026-09-20')).toBeNull();
    expect(host.save.stats['2026-09-20']).toBeUndefined();
  });

  it('연속 플레이 일수', () => {
    const { stats, setNow } = setup(new Date(2026, 8, 25, 10));
    stats.touch('a');
    setNow(new Date(2026, 8, 26, 10));
    stats.touch('b');
    setNow(new Date(2026, 8, 27, 10));
    stats.touch('c');
    expect(stats.streak('2026-09-27')).toBe(3);
    expect(stats.streak('2026-09-24')).toBe(0);
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });

  it(`${KEEP_DAYS}일보다 오래된 날은 지운다`, () => {
    const { host, stats } = setup();
    host.save.stats['2026-01-01'] = { ...host.save.stats['2026-01-01'], boards: ['x'] } as never;
    stats.cleared(clear(100, 1000));
    expect(host.save.stats['2026-01-01']).toBeUndefined();
    expect(host.save.stats['2026-09-27']).toBeDefined();
  });
});
