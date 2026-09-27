/** 영역 색 — 스크린샷에서 뽑은 10가지. palette.ts 에 실제 색과 무늬가 있다. */
export type ColorKey =
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'mustard'
  | 'green'
  | 'teal'
  | 'lightblue'
  | 'purple'
  | 'pink'
  | 'rose';

export interface Puzzle {
  /** 'L701'(레벨) 또는 'D2026-09-27'(오늘의 퍼즐) */
  id: string;
  size: number;
  /** 칸별 영역 번호 (행 우선, 길이 size*size) */
  regions: number[];
  /** 영역 번호 → 색 */
  colors: ColorKey[];
  /** 행 → 고양이가 있는 열 (유일해) */
  solution: number[];
  /** 처음부터 놓여 있는 고양이 칸 */
  givens: number[];
  /** 논리로 풀 때 필요한 최고 기법 단계 (logic.ts 의 Tech) */
  tech: number;
}
