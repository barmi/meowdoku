import { Geometry, lowBit, maskCells, popcount } from './geometry';
import { type LState, cloneState, eliminate, emptyState, placeCat, unitCands, unitCount } from './state';

/**
 * 사람이 쓰는 풀이 기법을 쉬운 것부터 적용하는 논리 엔진.
 * - 힌트(전구): 지금 판에서 다음 한 수와 그 이유를 알려 준다.
 * - 난이도: 빈 판에서 끝까지 풀 때 필요한 최고 기법 단계로 매긴다. 생성기는 이 단계로
 *   "찍지 않고 풀리는" 퍼즐만 통과시킨다.
 */
export const TECH = {
  /** 행·열·영역에 후보가 한 칸만 남음 */
  single: 2,
  /** 영역의 후보가 한 줄에 몰림(또는 줄의 후보가 한 영역에 몰림) */
  line: 3,
  /** 여기 두면 어떤 행·열·영역의 후보가 전부 사라지는 칸 */
  attack: 4,
  /** k개 영역이 k개 줄 안에 몰림 (k ≥ 2) */
  subset: 5,
  /** 여기 두고 따라가 보면 모순 */
  contradiction: 6,
} as const;

export type DeductionKind = 'wrong' | 'single' | 'line' | 'attack' | 'subset' | 'contradiction';

export interface Deduction {
  kind: DeductionKind;
  tech: number;
  /** 고양이를 놓을 칸 */
  place?: number;
  /** X 로 확정되는 칸 */
  eliminate: number[];
  /** 지워야 하는 잘못된 X */
  unmark?: number[];
  /** 근거로 강조해 보여 줄 칸 */
  focus: number[];
  message: string;
}

export type RegionNamer = (region: number) => string;

type Family = { items: number[]; masks: number[]; target: (idx: number) => number; word: string };

export class LogicEngine {
  readonly g: Geometry;
  readonly regionName: RegionNamer;
  /** 영역 → 행 → 열 순서로 살핀다 (영역 단서가 가장 눈에 잘 띈다) */
  private readonly order: number[];

  constructor(g: Geometry, regionName: RegionNamer = (r) => `${r + 1}번`) {
    this.g = g;
    this.regionName = regionName;
    const n = g.n;
    this.order = [];
    for (let k = 0; k < n; k++) this.order.push(2 * n + k);
    for (let k = 0; k < 2 * n; k++) this.order.push(k);
  }

  unitName(u: number): string {
    const n = this.g.n;
    if (u < n) return `${u + 1}행`;
    if (u < 2 * n) return `${u - n + 1}열`;
    return `${this.regionName(u - 2 * n)} 영역`;
  }

  /** 다음 한 수. maxTech 보다 어려운 기법은 쓰지 않는다. batch 면 모순 칸을 한꺼번에 모은다. */
  next(s: LState, maxTech: number = TECH.contradiction, batch = false): Deduction | null {
    return (
      this.findSingle(s) ??
      (maxTech >= TECH.line ? this.findSubset(s, 1, 1) : null) ??
      (maxTech >= TECH.attack ? this.findAttack(s) : null) ??
      (maxTech >= TECH.subset ? this.findSubset(s, 2, this.g.n) : null) ??
      (maxTech >= TECH.contradiction ? this.findContradiction(s, batch) : null)
    );
  }

  apply(s: LState, d: Deduction): void {
    if (d.place !== undefined) placeCat(this.g, s, d.place);
    for (const e of d.eliminate) eliminate(this.g, s, e);
  }

  /** 빈 판(+ 처음부터 열린 고양이)에서 논리만으로 풀어 본다. 풀리면 쓰인 최고 기법 단계, 막히면 Infinity. */
  grade(maxTech: number = TECH.contradiction, givens: readonly number[] = []): number {
    const s = emptyState(this.g);
    for (const cell of givens) placeCat(this.g, s, cell);
    let used = 0;
    for (let guard = 0; guard < 2000 && s.placed < this.g.n; guard++) {
      const d = this.next(s, maxTech, true);
      if (!d) return Infinity;
      used = Math.max(used, d.tech);
      this.apply(s, d);
    }
    return s.placed === this.g.n ? used : Infinity;
  }

  private findSingle(s: LState): Deduction | null {
    const g = this.g;
    for (const u of this.order) {
      if (s.solved[u] || unitCount(g, s, u) !== 1) continue;
      return {
        kind: 'single',
        tech: TECH.single,
        place: unitCands(g, s, u)[0],
        eliminate: [],
        focus: g.unitCells[u],
        message: `${this.unitName(u)}에서 고양이가 들어갈 수 있는 칸은 여기뿐이에요.`,
      };
    }
    return null;
  }

  /** k개 unit 의 후보가 다른 종류의 unit k개 안에 몰려 있으면, 그 k개 unit 의 나머지 후보는 X */
  private findSubset(s: LState, kMin: number, kMax: number): Deduction | null {
    const g = this.g;
    const n = g.n;
    const families = this.families(s);
    for (let k = kMin; k <= kMax; k++) {
      for (const f of families) {
        const m = f.items.length;
        if (k >= m) continue;
        // Gosper's hack: 크기 k 인 부분집합을 차례로
        for (let set = (1 << k) - 1; set < 1 << m; ) {
          let union = 0;
          for (let bits = set; bits; bits &= bits - 1) union |= f.masks[lowBit(bits)];
          if (popcount(union) === k) {
            const inItems = new Int32Array(n);
            for (let bits = set; bits; bits &= bits - 1) {
              const um = g.unitMasks[f.items[lowBit(bits)]];
              for (let r = 0; r < n; r++) inItems[r] |= um[r];
            }
            const elim = new Int32Array(n);
            let any = 0;
            for (let bits = union; bits; bits &= bits - 1) {
              const um = g.unitMasks[f.target(lowBit(bits))];
              for (let r = 0; r < n; r++) {
                elim[r] |= um[r] & s.cand[r] & ~inItems[r];
                any |= elim[r];
              }
            }
            if (any) {
              const focusMask = new Int32Array(n);
              for (let r = 0; r < n; r++) focusMask[r] = inItems[r] & s.cand[r];
              const itemNames = bitsList(set).map((i) => this.unitName(f.items[i]));
              const targetNames = bitsList(union).map((t) => this.unitName(f.target(t)));
              const message =
                k === 1
                  ? `${itemNames[0]}의 고양이는 ${targetNames[0]}에만 올 수 있어요. 그래서 ${targetNames[0]}의 다른 칸에는 고양이가 없어요.`
                  : `${itemNames.join(', ')}의 고양이 ${k}마리는 모두 ${targetNames.join(', ')} 안에 있어야 해요. 그래서 그 ${f.word}의 다른 칸에는 고양이가 없어요.`;
              return {
                kind: k === 1 ? 'line' : 'subset',
                tech: k === 1 ? TECH.line : TECH.subset,
                eliminate: maskCells(n, elim),
                focus: maskCells(n, focusMask),
                message,
              };
            }
          }
          const lo = set & -set;
          const ripple = set + lo;
          set = (((ripple ^ set) >>> 2) / lo) | ripple;
        }
      }
    }
    return null;
  }

  /** 풀리지 않은 unit 들을 "어느 행/열/영역에 후보가 있나" 마스크로 요약한다 */
  private families(s: LState): Family[] {
    const g = this.g;
    const n = g.n;
    const rows: number[] = [];
    const cols: number[] = [];
    const regs: number[] = [];
    for (let k = 0; k < n; k++) {
      if (!s.solved[k]) rows.push(k);
      if (!s.solved[n + k]) cols.push(n + k);
      if (!s.solved[2 * n + k]) regs.push(2 * n + k);
    }
    const rowsOf = (u: number) => {
      let m = 0;
      for (let r = 0; r < n; r++) if (s.cand[r] & g.unitMasks[u][r]) m |= 1 << r;
      return m;
    };
    const colsOf = (u: number) => {
      let m = 0;
      for (let r = 0; r < n; r++) m |= s.cand[r] & g.unitMasks[u][r];
      return m;
    };
    const regsOf = (u: number) => {
      let m = 0;
      for (const cell of g.unitCells[u]) {
        if (s.cand[Math.floor(cell / n)] & (1 << (cell % n))) m |= 1 << g.regions[cell];
      }
      return m;
    };
    const rowUnit = (i: number) => i;
    const colUnit = (i: number) => n + i;
    const regUnit = (i: number) => 2 * n + i;
    return [
      { items: regs, masks: regs.map(rowsOf), target: rowUnit, word: '행' },
      { items: regs, masks: regs.map(colsOf), target: colUnit, word: '열' },
      { items: rows, masks: rows.map(regsOf), target: regUnit, word: '영역' },
      { items: cols, masks: cols.map(regsOf), target: regUnit, word: '영역' },
      { items: rows, masks: rows.map(colsOf), target: colUnit, word: '열' },
      { items: cols, masks: cols.map(rowsOf), target: rowUnit, word: '행' },
    ];
  }

  /** 두면 어떤 unit 의 후보를 모두 없애는 칸 = 그 unit 모든 후보의 peer 교집합 */
  private findAttack(s: LState): Deduction | null {
    const g = this.g;
    const n = g.n;
    const units = this.order
      .filter((u) => !s.solved[u])
      .map((u) => [u, unitCount(g, s, u)] as const)
      .filter(([, k]) => k >= 2)
      .sort((a, b) => a[1] - b[1]);
    for (const [u] of units) {
      const inter = this.attackMask(s, u);
      if (inter) {
        return {
          kind: 'attack',
          tech: TECH.attack,
          eliminate: maskCells(n, inter),
          focus: unitCands(g, s, u),
          message: `여기에 고양이를 두면 ${this.unitName(u)}에 고양이를 놓을 칸이 하나도 남지 않아요.`,
        };
      }
    }
    return null;
  }

  private attackMask(s: LState, u: number): Int32Array | null {
    const g = this.g;
    const n = g.n;
    const inter = new Int32Array(n).fill(g.full);
    for (const x of unitCands(g, s, u)) {
      const p = g.peerMasks[x];
      for (let r = 0; r < n; r++) inter[r] &= p[r];
    }
    let any = 0;
    for (let r = 0; r < n; r++) {
      inter[r] &= s.cand[r];
      any |= inter[r];
    }
    return any ? inter : null;
  }

  private findContradiction(s: LState, batch: boolean): Deduction | null {
    const g = this.g;
    const n = g.n;
    const found: number[] = [];
    let firstFail = -1;
    for (let r = 0; r < n; r++) {
      for (let bits = s.cand[r]; bits; bits &= bits - 1) {
        const cell = r * n + lowBit(bits);
        const t = cloneState(s);
        placeCat(g, t, cell);
        const fail = this.propagate(t);
        if (fail < 0) continue;
        if (firstFail < 0) firstFail = fail;
        found.push(cell);
        if (!batch) break;
      }
      if (found.length && !batch) break;
    }
    if (!found.length) return null;
    return {
      kind: 'contradiction',
      tech: TECH.contradiction,
      eliminate: found,
      focus: found,
      message: `여기에 고양이를 두고 따라가 보면 ${this.unitName(firstFail)}에 고양이를 놓을 칸이 없어져요.`,
    };
  }

  /** 한 칸 가정 후 쉬운 기법(한 칸 남음, 공격 칸)으로 밀어 본다. 모순이 난 unit, 없으면 -1 */
  private propagate(t: LState): number {
    const g = this.g;
    const n = g.n;
    for (let guard = 0; guard < 4 * n * n; guard++) {
      if (t.placed === n) return -1;
      let changed = false;
      for (const u of this.order) {
        if (t.solved[u]) continue;
        const k = unitCount(g, t, u);
        if (k === 0) return u;
        if (k === 1) {
          placeCat(g, t, unitCands(g, t, u)[0]);
          changed = true;
        }
      }
      if (changed) continue;
      for (const u of this.order) {
        if (t.solved[u]) continue;
        const inter = this.attackMask(t, u);
        if (!inter) continue;
        for (let r = 0; r < n; r++) t.cand[r] &= ~inter[r];
        changed = true;
      }
      if (!changed) return -1;
    }
    return -1;
  }
}

function bitsList(x: number): number[] {
  const out: number[] = [];
  for (let b = x; b; b &= b - 1) out.push(lowBit(b));
  return out;
}
