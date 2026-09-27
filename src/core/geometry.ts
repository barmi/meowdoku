/**
 * 판 모양(크기·영역)만으로 정해지는 값들. 풀이기와 논리 엔진이 함께 쓴다.
 *
 * 칸 집합은 "행별 비트마스크" 배열(Int32Array(n))로 다룬다. n ≤ 12 이면 한 행이 한 정수에
 * 들어가서, 교집합·개수 세기가 칸 단위 반복보다 한 자릿수 빠르다.
 */
export function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** 가장 낮은 켜진 비트의 위치 */
export const lowBit = (x: number): number => 31 - Math.clz32(x & -x);

export type UnitKind = 'row' | 'col' | 'region';

export class Geometry {
  readonly n: number;
  readonly cells: number;
  readonly regions: readonly number[];
  readonly full: number;
  /** unit 번호: 0..n-1 행, n..2n-1 열, 2n..3n-1 영역 */
  readonly unitCells: number[][] = [];
  readonly unitMasks: Int32Array[] = [];
  /** 칸 → [행 unit, 열 unit, 영역 unit] */
  readonly cellUnits: [number, number, number][] = [];
  /** 칸 → 여기 고양이를 두면 더는 고양이를 둘 수 없는 칸들 (같은 행·열·영역 + 주변 8칸) */
  readonly peerMasks: Int32Array[] = [];
  readonly peerCells: number[][] = [];

  constructor(n: number, regions: readonly number[]) {
    if (n > 12) throw new Error('size > 12 is not supported');
    this.n = n;
    this.cells = n * n;
    this.regions = regions;
    this.full = (1 << n) - 1;
    for (let u = 0; u < 3 * n; u++) {
      this.unitCells.push([]);
      this.unitMasks.push(new Int32Array(n));
    }
    for (let i = 0; i < this.cells; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const units: [number, number, number] = [r, n + c, 2 * n + regions[i]];
      this.cellUnits.push(units);
      for (const u of units) {
        this.unitCells[u].push(i);
        this.unitMasks[u][r] |= 1 << c;
      }
    }
    for (let i = 0; i < this.cells; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      const m = new Int32Array(n);
      for (const u of this.cellUnits[i]) for (let k = 0; k < n; k++) m[k] |= this.unitMasks[u][k];
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= n) continue;
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c + dc;
          if (cc >= 0 && cc < n) m[rr] |= 1 << cc;
        }
      }
      m[r] &= ~(1 << c);
      this.peerMasks.push(m);
      this.peerCells.push(maskCells(n, m));
    }
  }

  unitKind(u: number): UnitKind {
    return u < this.n ? 'row' : u < 2 * this.n ? 'col' : 'region';
  }

  /** 영역 번호 → unit 번호 */
  regionUnit(region: number): number {
    return 2 * this.n + region;
  }
}

/** 행별 마스크 → 칸 번호 목록 */
export function maskCells(n: number, m: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let r = 0; r < n; r++) {
    let bits = m[r];
    while (bits) {
      const c = lowBit(bits);
      out.push(r * n + c);
      bits &= bits - 1;
    }
  }
  return out;
}

export function maskCount(m: ArrayLike<number>): number {
  let s = 0;
  for (let r = 0; r < m.length; r++) s += popcount(m[r]);
  return s;
}

export const rowOf = (n: number, i: number): number => Math.floor(i / n);
export const colOf = (n: number, i: number): number => i % n;

export function neighbors4(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}
