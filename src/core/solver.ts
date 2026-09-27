import { Geometry, lowBit } from './geometry';
import { type LState, cloneState, emptyState, placeCat, unitCount } from './state';

/**
 * 해를 최대 limit 개까지 찾는다 (유일해 검사용). 해는 행 → 열 배열.
 * 후보가 가장 적은 unit(행·열·영역)부터 가지를 친다.
 */
export function findSolutions(g: Geometry, limit = 2, start?: LState): number[][] {
  const out: number[][] = [];
  const n = g.n;
  const units = 3 * n;

  const search = (s: LState): void => {
    if (s.placed === n) {
      out.push(Array.from(s.cats));
      return;
    }
    let best = -1;
    let bestCount = Infinity;
    for (let u = 0; u < units; u++) {
      if (s.solved[u]) continue;
      const k = unitCount(g, s, u);
      if (k === 0) return;
      if (k < bestCount) {
        bestCount = k;
        best = u;
        if (k === 1) break;
      }
    }
    const m = g.unitMasks[best];
    for (let r = 0; r < n; r++) {
      let bits = s.cand[r] & m[r];
      while (bits) {
        const c = lowBit(bits);
        bits &= bits - 1;
        const t = cloneState(s);
        placeCat(g, t, r * n + c);
        search(t);
        if (out.length >= limit) return;
        // 이 unit 에는 고양이가 정확히 하나 — 방금 시도한 칸은 형제 가지에서 뺀다
        s.cand[r] &= ~(1 << c);
      }
    }
  };

  search(start ? cloneState(start) : emptyState(g));
  return out;
}

export function countSolutions(g: Geometry, limit = 2): number {
  return findSolutions(g, limit).length;
}
