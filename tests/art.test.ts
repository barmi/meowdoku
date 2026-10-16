import { describe, expect, it } from 'vitest';
import { spriteMarkup } from '../src/ui/art';

describe('SVG sprite', () => {
  it('판의 마커 선 색상을 CSS 변수로 바꿀 수 있다 (#15)', () => {
    const sprite = spriteMarkup();
    expect(sprite).toContain('stroke="var(--note-outline,rgba(60,30,20,.42))"');
    expect(sprite).toContain('stroke="var(--note-stroke,#fff)"');
  });
});
