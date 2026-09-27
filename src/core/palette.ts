import type { ColorKey } from './types';

export type PatternKey =
  | 'dots'
  | 'sparkle'
  | 'ears'
  | 'claw'
  | 'paw'
  | 'sprout'
  | 'yarn'
  | 'fishbone'
  | 'whisker'
  | 'bell';

export interface RegionStyle {
  /** 칸 바탕색 */
  bg: string;
  /** 칸 무늬색 (바탕보다 조금 어둡게) */
  pat: string;
  /** 상단 고양이 바의 머리 색 = 바탕과 흰색 50:50 */
  head: string;
  pattern: PatternKey;
  /** 힌트 문구에 쓰는 이름 */
  name: string;
}

/** 원본 스크린샷에서 픽셀로 뽑은 색 */
export const PALETTE: Record<ColorKey, RegionStyle> = {
  brown: { bg: '#A86D4A', pat: '#975E3D', head: '#D3B6A5', pattern: 'dots', name: '땡땡이' },
  orange: { bg: '#FA9D5C', pat: '#E98D4D', head: '#FDCEAD', pattern: 'sparkle', name: '반짝이' },
  yellow: { bg: '#FBD983', pat: '#EAC871', head: '#FDECC1', pattern: 'ears', name: '고양이귀' },
  mustard: { bg: '#CDA400', pat: '#BC9700', head: '#E6D180', pattern: 'claw', name: '발톱' },
  green: { bg: '#2A8C53', pat: '#207B46', head: '#95C5A9', pattern: 'paw', name: '발바닥' },
  teal: { bg: '#38A9C0', pat: '#2C99AF', head: '#9CD4E0', pattern: 'sprout', name: '새싹' },
  lightblue: { bg: '#A5C6E7', pat: '#91B3D6', head: '#D2E3F3', pattern: 'yarn', name: '털실' },
  purple: { bg: '#8979DA', pat: '#7868C9', head: '#C4BCED', pattern: 'fishbone', name: '생선뼈' },
  pink: { bg: '#F89BE5', pat: '#E787D4', head: '#FBCDF2', pattern: 'whisker', name: '수염' },
  rose: { bg: '#D36F8F', pat: '#C25E7E', head: '#E9B7C7', pattern: 'bell', name: '방울' },
};

/** 상단 고양이 바에 머리가 놓이는 순서 (스크린샷 순서) */
export const COLOR_ORDER: ColorKey[] = [
  'brown',
  'orange',
  'yellow',
  'mustard',
  'green',
  'teal',
  'lightblue',
  'purple',
  'pink',
  'rose',
];

/** 서로 붙어 있으면 헷갈리는 색 쌍 — 생성기가 인접 배치를 피한다 */
export const SIMILAR: [ColorKey, ColorKey][] = [
  ['teal', 'lightblue'],
  ['yellow', 'mustard'],
  ['pink', 'rose'],
];
