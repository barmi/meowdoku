/** 시드 고정 난수. 같은 키(레벨 번호, 날짜)는 항상 같은 퍼즐을 만든다. */
export type Rng = () => number;

/** 문자열 → 32bit 시드 (xmur3) */
export function hashSeed(key: string): number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 — 빠르고 분포가 충분히 고른 32bit PRNG */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rngFor = (key: string): Rng => mulberry32(hashSeed(key));

export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n);

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[randInt(rng, arr.length)];
