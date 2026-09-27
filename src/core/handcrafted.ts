import type { ColorKey } from './types';

/**
 * 원본 스크린샷에서 그대로 옮긴 퍼즐. 둘 다 유일해가 있다(테스트로 확인).
 * - 701: IMG_4711/4712 의 8×8 (시작할 때 3행 4열 고양이가 놓여 있음)
 * - 702: IMG_4709 의 9×9 (3행 6열 고양이)
 */
export interface Handcrafted {
  grid: ColorKey[][];
  /** [행, 열] 0부터 */
  given: [number, number];
}

const parse = (text: string): ColorKey[][] =>
  text
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/) as ColorKey[]);

export const HANDCRAFTED: Record<number, Handcrafted> = {
  701: {
    grid: parse(`
      rose   rose   rose   rose   rose   rose   rose    rose
      teal   teal   teal   teal   pink   rose   orange  rose
      teal   yellow yellow pink   pink   rose   orange  rose
      teal   yellow yellow pink   orange orange orange  rose
      teal   yellow yellow pink   green  green  orange  rose
      teal   yellow green  green  green  green  orange  orange
      yellow yellow yellow yellow purple orange orange  orange
      purple purple purple purple purple purple mustard orange
    `),
    given: [2, 3],
  },
  702: {
    grid: parse(`
      rose      rose      rose      rose      rose   pink   pink   purple purple
      lightblue lightblue rose      rose      rose   pink   purple purple purple
      lightblue lightblue lightblue yellow    yellow pink   pink   pink   purple
      lightblue lightblue lightblue yellow    yellow yellow yellow yellow purple
      lightblue green     lightblue green     green  yellow yellow brown  brown
      orange    green     lightblue green     yellow yellow brown  brown  brown
      orange    green     lightblue green     green  yellow brown  brown  brown
      orange    green     green     green     green  green  brown  brown  brown
      orange    orange    orange    orange    orange orange brown  brown  mustard
    `),
    given: [2, 5],
  },
};
