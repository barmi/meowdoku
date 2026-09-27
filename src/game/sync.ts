import { type SaveData, normalizeSave } from './storage';

/**
 * 서버(/api/state)와 게임 상태를 맞춘다 (#6).
 * 화면을 실시간으로 맞추지는 않는다 — 액션 결과를 올리고, 시작·복귀할 때 최신 상태를 받는다.
 * 서버 rev 와 내가 알던 rev 가 다르면 다른 기기가 먼저 저장한 것이다.
 */
export interface Remote {
  rev: number;
  updatedAt: number;
  data: SaveData | null;
}

export type PushResult =
  | { status: 'ok'; rev: number }
  | { status: 'conflict'; remote: Remote }
  | { status: 'offline' };

const META_KEY = 'meowdoku.sync.v1';
const BASE_KEY = 'meowdoku.sync.base.v1';

function timeout(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) return AbortSignal.timeout(ms);
  return undefined;
}

export class SyncClient {
  private readonly url: string;
  /** 이 기기가 마지막으로 맞춘 서버 rev */
  rev = 0;
  /** 서버에 아직 못 올린 변경이 있다 */
  dirty = false;
  /** 마지막으로 서버에 저장·확인한 시각 */
  syncedAt = 0;
  /** 이 서버에 저장 API 가 있다 (정적 서빙이면 false → 기기별 저장만) */
  available = false;
  /** 마지막 통신이 성공했다 */
  online = false;
  /** 마지막으로 서버와 맞춘 상태 (rev 시점) — 두 기기의 변경을 합치는 기준 */
  base: SaveData | null = null;

  constructor(base: string = document.baseURI) {
    this.url = new URL('api/state', base).toString();
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as Partial<SyncClient> | null;
      if (m) {
        this.rev = Number(m.rev) || 0;
        this.dirty = !!m.dirty;
        this.syncedAt = Number(m.syncedAt) || 0;
      }
      this.base = normalizeSave(JSON.parse(localStorage.getItem(BASE_KEY) ?? 'null'));
    } catch {
      /* 저장 불가 — 메모리로만 */
    }
  }

  setBase(data: SaveData): void {
    this.base = JSON.parse(JSON.stringify(data)) as SaveData;
    try {
      localStorage.setItem(BASE_KEY, JSON.stringify(this.base));
    } catch {
      /* 무시 */
    }
  }

  saveMeta(): void {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ rev: this.rev, dirty: this.dirty, syncedAt: this.syncedAt }));
    } catch {
      /* 무시 */
    }
  }

  async fetchRemote(ms = 2500): Promise<Remote | null> {
    try {
      const res = await fetch(this.url, { cache: 'no-store', signal: timeout(ms) });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { rev?: unknown; updatedAt?: unknown; data?: unknown };
      if (typeof body.rev !== 'number') throw new Error('not a state api');
      this.available = true;
      this.online = true;
      return { rev: body.rev, updatedAt: Number(body.updatedAt) || 0, data: normalizeSave(body.data) };
    } catch {
      this.online = false;
      return null;
    }
  }

  async push(data: SaveData): Promise<PushResult> {
    const body = JSON.stringify({ baseRev: this.rev, data });
    try {
      const res = await fetch(this.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        // 화면이 가려지는 순간에도 끝까지 보내도록 (keepalive 는 64KB 까지만 된다)
        keepalive: body.length < 60_000,
        signal: timeout(8000),
      });
      if (res.status === 409) {
        const r = (await res.json()) as { rev: number; updatedAt: number; data: unknown };
        this.online = true;
        return { status: 'conflict', remote: { rev: r.rev, updatedAt: r.updatedAt, data: normalizeSave(r.data) } };
      }
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as { rev: number; updatedAt: number };
      this.rev = r.rev;
      this.syncedAt = r.updatedAt;
      this.setBase(data);
      this.dirty = false;
      this.online = true;
      this.saveMeta();
      return { status: 'ok', rev: r.rev };
    } catch {
      this.online = false;
      return { status: 'offline' };
    }
  }
}
