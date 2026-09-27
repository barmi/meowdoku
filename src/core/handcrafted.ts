import type { ColorKey } from './types';

/**
 * 원본 스크린샷에서 그대로 옮긴 퍼즐.
 * - 701: IMG_4711/4712 의 8×8 (원본은 3행 4열 고양이가 열린 채 시작)
 * - 702: IMG_4709 의 9×9 (원본은 3행 6열 고양이가 열려 있음)
 * 두 판 모두 오픈 없이도 해가 하나라서(테스트로 확인) 규칙대로 아무것도 열지 않고 시작한다.
 * opened 는 오픈이 필요할 때 먼저 써 볼 후보로만 남겨 둔다.
 */
export interface Handcrafted {
  grid: ColorKey[][];
  /** 원본 스크린샷에서 열려 있던 고양이 [행, 열] (0부터) */
  opened: [number, number];
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
    opened: [2, 3],
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
    opened: [2, 5],
  },
};
