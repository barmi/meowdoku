import type { SaveData } from './storage';
import type { PushResult, Remote } from './sync';

export type { Remote } from './sync';

/**
 * GitHub Pages 전용 동기화 대체 구현 (#16).
 * 서버 주소를 만들지도, fetch를 호출하지도 않는다. 저장은 storage.ts의 localStorage만 담당한다.
 */
export class SyncClient {
  readonly enabled = false;
  rev = 0;
  dirty = false;
  syncedAt = 0;
  available = false;
  online = false;
  base: SaveData | null = null;

  constructor(_base?: string, _enabled?: boolean) {}

  setBase(_data: SaveData): void {}

  saveMeta(): void {}

  async fetchRemote(_ms?: number): Promise<Remote | null> {
    return null;
  }

  async push(_data: SaveData, _forceFull?: boolean): Promise<PushResult> {
    return { status: 'disabled' };
  }
}
