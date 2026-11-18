import { describe, expect, it } from 'vitest';
import {
  counterRotation,
  isPhoneLandscape,
  isPhoneViewport,
  type Point,
  unrotateDelta,
  unrotatePoint,
} from '../src/ui/orientation';

function expectPoint(actual: Point, x: number, y: number): void {
  expect(actual.x).toBeCloseTo(x);
  expect(actual.y).toBeCloseTo(y);
}

describe('휴대폰 세로 전용 화면 (#20, #21)', () => {
  it('짧은 변이 600px 이하인 coarse pointer 화면만 휴대폰으로 본다', () => {
    expect(isPhoneViewport(390, 844, true)).toBe(true);
    expect(isPhoneViewport(844, 390, true)).toBe(true);
    expect(isPhoneViewport(1366, 768, true)).toBe(false);
    expect(isPhoneViewport(844, 390, false)).toBe(false);
  });

  it('휴대폰 가로 화면에서만 세로 좌표계 역회전이 필요하다', () => {
    expect(isPhoneLandscape(844, 390, true)).toBe(true);
    expect(isPhoneLandscape(390, 844, true)).toBe(false);
    expect(isPhoneLandscape(1366, 768, true)).toBe(false);
  });

  it('기기가 돌아간 반대 방향으로 앱을 90도 되돌린다', () => {
    expect(counterRotation(90)).toBe(-90);
    expect(counterRotation(-90)).toBe(90);
    expect(counterRotation(270)).toBe(90);
  });

  it('반시계 회전된 화면의 터치 좌표를 세로 좌표로 되돌린다', () => {
    expectPoint(unrotatePoint(0.1, 0.9, -90), 0.1, 0.1);
    expectPoint(unrotatePoint(0.8, 0.2, -90), 0.8, 0.8);
  });

  it('시계 회전된 화면의 터치 좌표를 세로 좌표로 되돌린다', () => {
    expectPoint(unrotatePoint(0.9, 0.1, 90), 0.1, 0.1);
    expectPoint(unrotatePoint(0.2, 0.8, 90), 0.8, 0.8);
  });

  it('스와이프 벡터도 화면 회전의 반대 방향으로 되돌린다', () => {
    expectPoint(unrotateDelta(0, 50, -90), -50, 0);
    expectPoint(unrotateDelta(0, -50, 90), -50, 0);
    expectPoint(unrotateDelta(50, 0, 0), 50, 0);
  });
});
