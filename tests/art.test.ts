import { describe, expect, it } from 'vitest';
import { NOTE_SHAPES, noteToolIcon, spriteMarkup } from '../src/ui/art';

describe('SVG sprite', () => {
  it('판의 마커 선 색상을 CSS 변수로 바꿀 수 있다 (#15)', () => {
    const sprite = spriteMarkup();
    expect(sprite).toContain('stroke="var(--note-outline,rgba(60,30,20,.42))"');
    expect(sprite).toContain('stroke="var(--note-stroke,#fff)"');
  });
  it('마커 도구 아이콘은 물음표(?)와 세모 모양을 올바르게 생성한다 (#18)', () => {
    expect(noteToolIcon(4)).toContain(NOTE_SHAPES[4]);
    expect(noteToolIcon(1)).toContain(NOTE_SHAPES[1]);
  });
});
