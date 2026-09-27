import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStateHandler } from '../server/stateStore';
import { defaultSave } from '../src/game/storage';
import { merge3, standingOf } from '../src/game/merge';
import { emptyDay } from '../src/game/stats';
import { SyncClient } from '../src/game/sync';

let server: Server;
let base = '';
let dir = '';

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'meowdoku-'));
  const handler = createStateHandler(join(dir, 'state.json'));
  server = createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 404;
      res.end();
    }),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const api = (init?: RequestInit) => fetch(`${base}api/state`, init);
const put = (body: unknown) => api({ method: 'PUT', body: JSON.stringify(body) });

describe('서버 저장소 /api/state', () => {
  it('rev 가 맞을 때만 저장하고, 어긋나면 409 와 최신 상태를 준다', async () => {
    expect(await (await api()).json()).toEqual({ rev: 0, updatedAt: 0, data: null });

    const first = await put({ baseRev: 0, data: { v: 1, level: 5 } });
    expect(first.status).toBe(200);
    expect((await first.json()).rev).toBe(1);

    const stale = await put({ baseRev: 0, data: { v: 1, level: 9 } });
    expect(stale.status).toBe(409);
    const cur = await stale.json();
    expect(cur.rev).toBe(1);
    expect(cur.data).toEqual({ v: 1, level: 5 });

    expect((await put({ baseRev: 1, data: { v: 1, level: 6 } })).status).toBe(200);
    expect(JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')).data.level).toBe(6);
  });

  it('잘못된 요청은 거절하고, 다른 경로는 넘긴다', async () => {
    expect((await api({ method: 'PUT', body: '{nope' })).status).toBe(400);
    expect((await put({ data: { v: 1 } })).status).toBe(400);
    expect((await api({ method: 'DELETE' })).status).toBe(405);
    expect((await fetch(`${base}index.html`)).status).toBe(404);
  });
});

describe('기기 사이 이어하기', () => {
  it('두 기기: 먼저 저장한 쪽이 이기고, 늦은 쪽은 충돌로 최신 상태를 받는다', async () => {
    const phone = new SyncClient(base);
    const desk = new SyncClient(base);
    const r1 = await phone.fetchRemote();
    const r2 = await desk.fetchRemote();
    expect(phone.available && desk.available).toBe(true);
    phone.rev = r1!.rev;
    desk.rev = r2!.rev;

    const a = { ...defaultSave(), level: 12 };
    expect((await phone.push(a)).status).toBe('ok');

    const b = { ...defaultSave(), level: 3 };
    const res = await desk.push(b);
    expect(res.status).toBe('conflict');
    if (res.status === 'conflict') {
      expect(res.remote.rev).toBe(phone.rev);
      expect(res.remote.data?.level).toBe(12);
      // 받은 상태는 현재 형식으로 맞춰져 있다
      expect(res.remote.data?.finished).toEqual([]);
    }
  });

  it('서버 API 가 없으면(정적 서빙) 기기별 저장으로 남는다', async () => {
    const offline = new SyncClient('http://127.0.0.1:9/');
    expect(await offline.fetchRemote(500)).toBeNull();
    expect(offline.available).toBe(false);
    expect((await offline.push(defaultSave())).status).toBe('offline');
  });

  it('붙잡은 판이 서버에서 끝났는지·바뀌었는지·더 진행됐는지·그대로인지 가린다', () => {
    const game = (gameId: string, marks: string) => ({ id: 'L3', gameId, marks, fish: 3, status: 'playing' }) as never;
    const base = defaultSave();
    base.progress.level = game('g1', '0000');
    const remote = defaultSave();
    remote.progress.level = game('g1', '0000');
    expect(standingOf(remote, base, 'level', 'g1')).toBe('untouched');
    remote.progress.level = game('g1', '0100');
    expect(standingOf(remote, base, 'level', 'g1')).toBe('advanced');
    remote.progress.level = game('g2', '0000');
    expect(standingOf(remote, base, 'level', 'g1')).toBe('other');
    remote.finished = ['g1'];
    expect(standingOf(remote, base, 'level', 'g1')).toBe('finished');
  });
});

describe('두 기기 변경 합치기 (3-way)', () => {
  const game = (marks: string, elapsed = 0) =>
    ({ id: 'L3', gameId: 'g1', sig: 's', marks, fish: 3, score: 0, combo: 0, mistakes: 0, elapsed, sinceCat: 0, continued: false, status: 'playing' }) as const;

  it('한쪽만 바꾼 항목은 그쪽, 둘 다 바꾼 판은 다른 곳이 실제로 진행했을 때만 그쪽', () => {
    const base = { ...defaultSave(), level: 3 };
    base.progress.level = game('0000');
    // 이 기기: 판을 한 수 진행 / 서버(다른 기기): 판은 시간만 흐르고 설정을 바꿈
    const local = JSON.parse(JSON.stringify(base));
    local.progress.level = game('0100', 5000);
    const remote = JSON.parse(JSON.stringify(base));
    remote.progress.level = game('0000', 9000);
    remote.settings.sound = false;
    const m = merge3(base, local, remote);
    expect(m.progress.level?.marks).toBe('0100'); // 이 기기의 마지막 액션
    expect(m.settings.sound).toBe(false); // 서버 쪽 변경도 살림

    // 서버 쪽이 판을 실제로 진행했으면 그쪽
    remote.progress.level = game('0010', 9000);
    expect(merge3(base, local, remote).progress.level?.marks).toBe('0010');
  });

  it('숫자 기록은 큰 쪽, 끝낸 판·통계는 합친다', () => {
    const base = defaultSave();
    const local = JSON.parse(JSON.stringify(base));
    const remote = JSON.parse(JSON.stringify(base));
    local.level = 8;
    local.cleared = 5;
    local.finished = ['a'];
    local.stats = { '2026-09-27': { ...emptyDay(), cleared: 2, boards: ['L1', 'L2'] } };
    remote.level = 6;
    remote.cleared = 7;
    remote.finished = ['b'];
    remote.stats = { '2026-09-27': { ...emptyDay(), cleared: 3, boards: ['L2', 'L5'] }, '2026-09-26': emptyDay() };
    const m = merge3(base, local, remote);
    expect(m.level).toBe(8);
    expect(m.cleared).toBe(7);
    expect(m.finished.sort()).toEqual(['a', 'b']);
    expect(m.stats['2026-09-27'].cleared).toBe(3);
    expect(m.stats['2026-09-27'].boards.sort()).toEqual(['L1', 'L2', 'L5']);
    expect(Object.keys(m.stats).sort()).toEqual(['2026-09-26', '2026-09-27']);
  });
});
