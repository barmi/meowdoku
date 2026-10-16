import { describe, expect, it } from 'vitest';
import { saveStorageKey } from '../src/storageMode';

describe('저장 모드 경계 (#16)', () => {
  it('개인 서버와 브라우저 전용 모드는 서로 다른 localStorage 키를 쓴다', () => {
    expect(saveStorageKey('server')).toBe('meowdoku.save.v1');
    expect(saveStorageKey('browser')).toBe('meowdoku.browser.save.v1');
    expect(saveStorageKey('server')).not.toBe(saveStorageKey('browser'));
  });
});
