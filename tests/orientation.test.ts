import { describe, expect, it } from 'vitest';
import { isPhoneLandscape, isPhoneViewport } from '../src/ui/orientation';

describe('휴대폰 세로 전용 화면 (#20)', () => {
  it('짧은 변이 600px 이하인 coarse pointer 화면만 휴대폰으로 본다', () => {
    expect(isPhoneViewport(390, 844, true)).toBe(true);
    expect(isPhoneViewport(844, 390, true)).toBe(true);
    expect(isPhoneViewport(1366, 768, true)).toBe(false);
    expect(isPhoneViewport(844, 390, false)).toBe(false);
  });

  it('휴대폰 가로 화면에서만 세로 전환 안내가 필요하다', () => {
    expect(isPhoneLandscape(844, 390, true)).toBe(true);
    expect(isPhoneLandscape(390, 844, true)).toBe(false);
    expect(isPhoneLandscape(1366, 768, true)).toBe(false);
  });
});
