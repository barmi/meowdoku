import { describe, expect, it } from 'vitest';
import { BUILD_INFO, buildLabel } from '../src/buildInfo';

describe('앱 버전 (#17)', () => {
  it('package.json 버전과 빌드 식별자를 화면용 문구로 만든다', () => {
    expect(BUILD_INFO.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(BUILD_INFO.revision).toMatch(/^(?:[0-9a-f]{7}|dev)$/);
    expect(buildLabel({ version: '1.2.3', revision: 'abc1234' })).toBe('버전 1.2.3 · 빌드 abc1234');
  });
});
