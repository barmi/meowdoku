export type StorageMode = 'server' | 'browser';

// Vite를 거치지 않은 예외적인 실행은 서버로 전송하지 않는 쪽으로 안전하게 닫는다 (#16).
export const STORAGE_MODE: StorageMode =
  typeof __STORAGE_MODE__ === 'string' && __STORAGE_MODE__ === 'server' ? 'server' : 'browser';

export const SERVER_STORAGE_ENABLED = STORAGE_MODE === 'server';

export function saveStorageKey(mode: StorageMode): string {
  return mode === 'server' ? 'meowdoku.save.v1' : 'meowdoku.browser.save.v1';
}

/** 같은 origin에 두 모드를 번갈아 올려도 진행 데이터가 서로 섞이지 않는다. */
export const SAVE_STORAGE_KEY = __SAVE_STORAGE_KEY__;
