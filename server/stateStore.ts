import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';

/**
 * 기기 사이에 게임 상태를 나누는 아주 작은 저장소 (#6).
 *
 * - GET /api/state → { rev, updatedAt, data }   (아직 없으면 rev 0, data null)
 * - PUT /api/state ← { baseRev, data }
 *     baseRev 가 서버 rev 와 같을 때만 저장하고 rev+1 → 200 { rev, updatedAt }
 *     다르면(다른 기기가 먼저 저장) → 409 와 서버 최신 상태
 *
 * 상태는 서버 디스크의 JSON 파일 하나에 통째로 둔다 (기본 data/state.json, MEOWDOKU_STATE 로 변경).
 * 개인용이라 인증은 없다 — 믿을 수 있는 네트워크(LAN·Tailscale)에서만 연다.
 */
export interface StoredState {
  rev: number;
  updatedAt: number;
  data: unknown;
}

const MAX_BODY = 4 * 1024 * 1024;

export function defaultStateFile(): string {
  return resolve(process.env.MEOWDOKU_STATE ?? 'data/state.json');
}

export function createStateHandler(file = defaultStateFile()) {
  const read = (): StoredState => {
    try {
      const s = JSON.parse(readFileSync(file, 'utf8')) as StoredState;
      if (typeof s.rev === 'number') return s;
    } catch {
      /* 아직 파일이 없거나 깨짐 → 빈 상태 */
    }
    return { rev: 0, updatedAt: 0, data: null };
  };

  const write = (s: StoredState) => {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(s));
    renameSync(tmp, file); // 원자적으로 교체 — 쓰다 죽어도 이전 파일은 멀쩡하다
  };

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  return (req: IncomingMessage, res: ServerResponse, next?: () => void): void => {
    const path = (req.url ?? '').split('?')[0];
    if (!path.endsWith('/api/state')) {
      next?.();
      return;
    }
    if (req.method === 'GET') return send(res, 200, read());
    if (req.method !== 'PUT' && req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        aborted = true;
        send(res, 413, { error: 'too large' });
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (aborted) return;
      let msg: { baseRev?: unknown; data?: unknown };
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(res, 400, { error: 'bad json' });
      }
      if (typeof msg.baseRev !== 'number' || typeof msg.data !== 'object' || msg.data === null) {
        return send(res, 400, { error: 'baseRev and data required' });
      }
      const cur = read();
      if (msg.baseRev !== cur.rev) return send(res, 409, cur);
      const next: StoredState = { rev: cur.rev + 1, updatedAt: Date.now(), data: msg.data };
      write(next);
      send(res, 200, { rev: next.rev, updatedAt: next.updatedAt });
    });
  };
}
