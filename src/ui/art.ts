/**
 * 게임 그림은 전부 SVG 로 직접 그린다 (원본 앱 이미지·사진을 쓰지 않음).
 * - 정적인 그림(무늬, X, 물고기, 아이템, 아이콘)은 문서에 한 번 넣는 sprite 의 <symbol>
 * - 눈을 굴리고 깜빡이는 판 위 고양이는 칸마다 인라인 SVG (clipPath id 가 달라야 해서)
 */
import type { PatternKey } from '../core/palette';

const star = (x: number, y: number, s = 9.5) =>
  `M${x} ${y - s}Q${x + 1.7} ${y - 1.7} ${x + s} ${y}Q${x + 1.7} ${y + 1.7} ${x} ${y + s}` +
  `Q${x - 1.7} ${y + 1.7} ${x - s} ${y}Q${x - 1.7} ${y - 1.7} ${x} ${y - s}Z`;

const grid3 = (fn: (x: number, y: number) => string) =>
  [22.5, 50, 77.5].flatMap((y) => [22.5, 50, 77.5].map((x) => fn(x, y))).join('');

/** 칸 무늬 — .pf/.pfs 는 무늬색, .pk/.pks 는 바탕색(뚫린 부분). <use> 안쪽이라 CSS 변수로 칠한다 */
export const PATTERNS: Record<PatternKey, string> = {
  bell: `
    <circle class="pfs" cx="50" cy="20.5" r="6" fill="none" stroke-width="4.6"/>
    <path class="pf" d="M26 58C26 40 36.5 28.5 50 28.5S74 40 74 58Z"/>
    <rect class="pf" x="18.5" y="54.5" width="63" height="10.5" rx="5.25"/>
    <path class="pf" d="M27 67.5H73C73 80.5 62.8 89.5 50 89.5S27 80.5 27 67.5Z"/>
    <circle class="pk" cx="50" cy="75.5" r="4.3"/>
    <rect class="pk" x="48.1" y="76" width="3.8" height="14.5" rx="1"/>`,
  sprout: `
    <path class="pf" d="M50 45.5C45.5 30 30.5 21.5 13 26.5C13.5 41.5 28.5 51 50 45.5Z"/>
    <path class="pf" d="M50 45.5C54.5 30 69.5 21.5 87 26.5C86.5 41.5 71.5 51 50 45.5Z"/>
    <rect class="pf" x="46.6" y="40" width="6.8" height="36.5" rx="3.4"/>`,
  whisker: `
    <path class="pf" d="M42.5 48.5Q50 45 57.5 48.5Q56.5 55 50 58.5Q43.5 55 42.5 48.5Z"/>
    <g class="pfs" stroke-width="3.6" stroke-linecap="round" fill="none">
      <path d="M36 44.5L15 39"/><path d="M35.5 51H13.5"/><path d="M36 57.5L15.5 63.5"/>
      <path d="M64 44.5L85 39"/><path d="M64.5 51H86.5"/><path d="M64 57.5L84.5 63.5"/>
    </g>`,
  sparkle: `<path class="pf" d="${grid3((x, y) => star(x, y))}"/>`,
  ears: `
    <path class="pf" d="M15.5 62.5Q13 61.5 13.8 58.5L22.5 37Q24.5 33.5 27.5 36.2L44 51.5Q46.5 54.5 43.2 55.8L18.8 63.2Q17 63.6 15.5 62.5Z"/>
    <path class="pf" transform="matrix(-1 0 0 1 100 0)" d="M15.5 62.5Q13 61.5 13.8 58.5L22.5 37Q24.5 33.5 27.5 36.2L44 51.5Q46.5 54.5 43.2 55.8L18.8 63.2Q17 63.6 15.5 62.5Z"/>`,
  paw: `
    <path class="pf" d="M50 51C60.5 51 72.5 62 72.5 70.5C72.5 77.5 66 79.5 60.5 79C56.5 78.6 53.5 77.5 50 77.5S43.5 78.6 39.5 79C34 79.5 27.5 77.5 27.5 70.5C27.5 62 39.5 51 50 51Z"/>
    <ellipse class="pf" cx="23.5" cy="47" rx="7" ry="8.5" transform="rotate(-18 23.5 47)"/>
    <ellipse class="pf" cx="38.5" cy="33" rx="7.5" ry="9.5" transform="rotate(-6 38.5 33)"/>
    <ellipse class="pf" cx="61.5" cy="33" rx="7.5" ry="9.5" transform="rotate(6 61.5 33)"/>
    <ellipse class="pf" cx="76.5" cy="47" rx="7" ry="8.5" transform="rotate(18 76.5 47)"/>`,
  fishbone: `
    <path class="pf" d="M18.5 21C28 16 39 18.5 44.5 27C47.5 32 47 38.5 44 43L38 49C30.5 48 23.5 44 20 37C17.5 32 16.8 26 18.5 21Z"/>
    <circle class="pk" cx="28" cy="29" r="3.6"/>
    <g class="pfs" stroke-width="4.2" stroke-linecap="round" fill="none">
      <path d="M40 46L69 75"/>
      <path d="M39 61L55 45"/><path d="M46 68L62 52"/><path d="M53 75L69 59"/>
    </g>
    <path class="pf" d="M65.5 72.5C71.5 66 80 63.5 87.5 65C85.5 71 81.5 74.5 76.5 76.5C75.5 81.5 73 86 67.5 89C65.5 83 64 77.5 65.5 72.5Z"/>`,
  claw: `
    <path class="pf" d="M24 75C19.5 58 25.5 33 41 19.5C33.5 35 29.5 53 29 76.5C27.5 78.5 25 78 24 75Z"/>
    <path class="pf" d="M36.5 84C34 64 44 38 75.5 21C56.5 38 46 57 43 83C41.5 86 38 86.5 36.5 84Z"/>
    <path class="pf" d="M48.5 84C53.5 69 65.5 58.5 83 56C69.5 63 59.5 72 54 84.5C52.5 87 49.5 86.5 48.5 84Z"/>`,
  yarn: `
    <circle class="pf" cx="47" cy="47" r="25"/>
    <g class="pks" fill="none" stroke-width="3.4" stroke-linecap="round">
      <path d="M27 33C38 28 53 29 66 36"/><path d="M23 45C38 39 56 41 71 50"/>
      <path d="M25 58C38 53 53 55 66 65"/><path d="M55 23C64 34 67 48 61 70"/>
    </g>
    <path class="pfs" d="M67 64C72 72 79 79 87 78C90 77.5 90 74 87 73.5" fill="none" stroke-width="4" stroke-linecap="round"/>`,
  dots: grid3((x, y) => `<circle class="pf" cx="${x}" cy="${y}" r="7.5"/>`),
};

/* ───────────── 치즈 고양이 (#3 — 사진 속 고양이) ─────────────
 * 주황 태비, 이마 줄무늬, 눈 사이~코끝 흰 줄, 흰 주둥이·턱, 분홍 코,
 * 크고 둥근 연두색 눈, 작고 끝이 둥근 귀, 통통한 볼, 흰 수염.
 */

const EYE_L = 34;
const EYE_R = 66;
const EYE_Y = 50;
const EYE_R_SIZE = 10.8;
const FUR = '#E59A52';

const HEAD =
  'M12.5 40.5C11 33 12.5 25.5 16.5 19.5Q20 15 24.5 17.5L36.5 24Q50 20 63.5 24L75.5 17.5Q80 15 83.5 19.5C87.5 25.5 89 33 87.5 40.5' +
  'C93 47.5 95 57 93 65C90 80 73 89 50 89C27 89 10 80 7 65C5 57 7 47.5 12.5 40.5Z';
/** 사진 속 고양이처럼 작고 끝이 둥근 귀 — 끝이 살짝 앞으로 접힌 선을 넣는다 */
const EAR_L = 'M17 35.5C16.6 29.5 18 24.5 21 20.6Q23 18.8 25.2 20.2L32.5 25C26 26.8 21 30.5 17 35.5Z';
const EAR_R = 'M83 35.5C83.4 29.5 82 24.5 79 20.6Q77 18.8 74.8 20.2L67.5 25C74 26.8 79 30.5 83 35.5Z';
const EAR_FOLDS = `<g fill="none" stroke="#B8672C" stroke-width="1.3" stroke-linecap="round" opacity=".7">
  <path d="M17.6 24.8Q21.5 22.2 26.4 22.6"/><path d="M82.4 24.8Q78.5 22.2 73.6 22.6"/></g>`;
const STRIPES = `
  <g fill="none" stroke="#C4712E" stroke-linecap="round" opacity=".85">
    <g stroke-width="2.7">
      <path d="M50 23.5C49.6 28.5 49.6 33.5 50 38"/>
      <path d="M43.5 24.5C42 29.5 42.4 34.5 44.4 38.5"/><path d="M56.5 24.5C58 29.5 57.6 34.5 55.6 38.5"/>
      <path d="M37.2 27.5C35.8 31.5 36.2 35.5 38.2 38.5"/><path d="M62.8 27.5C64.2 31.5 63.8 35.5 61.8 38.5"/>
    </g>
    <g stroke-width="2.2">
      <path d="M9.5 54.5C13.5 55.5 16.5 57.5 18.5 60.5"/><path d="M10 60.5C13 61.5 15.5 63.5 17 66.5"/>
      <path d="M90.5 54.5C86.5 55.5 83.5 57.5 81.5 60.5"/><path d="M90 60.5C87 61.5 84.5 63.5 83 66.5"/>
    </g>
  </g>`;
const BLAZE = 'M48.7 41C49.3 40 50.7 40 51.3 41L53.9 55.6C52 57.3 48 57.3 46.1 55.6Z';
const MUZZLE =
  'M30.5 67C30.5 61.5 38 58.4 44.4 60.4C47 61.2 48.7 61.9 50 61.9C51.3 61.9 53 61.2 55.6 60.4' +
  'C62 58.4 69.5 61.5 69.5 67C71 77.5 61.5 88 50 88C38.5 88 29 77.5 30.5 67Z';
const NOSE = 'M44.6 57.4Q50 55.4 55.4 57.4Q54.9 61.2 50 63.6Q45.1 61.2 44.6 57.4Z';

function catDefs(id: string): string {
  return `
    <radialGradient id="${id}f" cx="50%" cy="34%" r="70%">
      <stop offset="0" stop-color="#F7BC78"/><stop offset=".55" stop-color="${FUR}"/><stop offset="1" stop-color="#C77834"/>
    </radialGradient>
    <radialGradient id="${id}w" cx="50%" cy="25%" r="85%">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#FFF6EC"/><stop offset="1" stop-color="#EBD9C6"/>
    </radialGradient>
    <linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E7A18F"/><stop offset="1" stop-color="#F7CDBE"/>
    </linearGradient>
    <radialGradient id="${id}i" cx="50%" cy="55%" r="55%">
      <stop offset="0" stop-color="#D5DE7A"/><stop offset=".6" stop-color="#9FAE45"/><stop offset="1" stop-color="#6F7C2A"/>
    </radialGradient>`;
}

const WHISKERS = `
  <g fill="none" stroke="#FFFFFF" stroke-width=".9" stroke-linecap="round" opacity=".95">
    <path d="M31 66.5L5 62"/><path d="M31 69.5L4 70.5"/><path d="M32 72.5L6.5 78"/>
    <path d="M69 66.5L95 62"/><path d="M69 69.5L96 70.5"/><path d="M68 72.5L93.5 78"/>
  </g>`;

function catBase(id: string): string {
  return `
    <path d="${HEAD}" fill="url(#${id}f)" stroke="#9A5424" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="${EAR_L}" fill="url(#${id}e)"/><path d="${EAR_R}" fill="url(#${id}e)"/>
    ${EAR_FOLDS}
    ${STRIPES}
    <circle cx="${EYE_L}" cy="${EYE_Y}" r="13" fill="#F9CC93" opacity=".75"/>
    <circle cx="${EYE_R}" cy="${EYE_Y}" r="13" fill="#F9CC93" opacity=".75"/>
    <path d="${BLAZE}" fill="#FFFDF8"/>
    <path d="${MUZZLE}" fill="url(#${id}w)"/>
    ${WHISKERS}
    <path d="${NOSE}" fill="#EC9D90" stroke="#C97A6E" stroke-width=".7" stroke-linejoin="round"/>`;
}

/** withLid=false: sprite 로 쓰는 정적 고양이 — <use> 안쪽에는 눈꺼풀을 숨기는 CSS 가 닿지 않는다 */
function openEye(id: string, side: 'L' | 'R', withLid = true): string {
  const cx = side === 'L' ? EYE_L : EYE_R;
  const lid = withLid
    ? `<g clip-path="url(#${id}${side})"><rect class="lid" x="${cx - 11.5}" y="${EYE_Y - 11.5}" width="23" height="23.5" fill="${FUR}" stroke="#5A3A1C" stroke-width="1.2"/></g>`
    : '';
  return `
    <g class="eye eye-${side === 'L' ? 'l' : 'r'}">
      <circle cx="${cx}" cy="${EYE_Y}" r="${EYE_R_SIZE}" fill="url(#${id}i)"/>
      <g class="pupil">
        <ellipse cx="${cx}" cy="${EYE_Y + 0.4}" rx="6.3" ry="7.1" fill="#15100b"/>
        <circle cx="${cx - 2.6}" cy="${EYE_Y - 3}" r="2.3" fill="#fff"/>
        <circle cx="${cx + 2.4}" cy="${EYE_Y + 3.2}" r="1" fill="#fff" opacity=".75"/>
      </g>
      ${lid}
      <circle cx="${cx}" cy="${EYE_Y}" r="${EYE_R_SIZE}" fill="none" stroke="#5A3A1C" stroke-width="1.3"/>
    </g>`;
}

const eyeClips = (id: string) =>
  `<clipPath id="${id}L"><circle cx="${EYE_L}" cy="${EYE_Y}" r="${EYE_R_SIZE}"/></clipPath>` +
  `<clipPath id="${id}R"><circle cx="${EYE_R}" cy="${EYE_Y}" r="${EYE_R_SIZE}"/></clipPath>`;

const MOUTH = `<path d="M50 63.6V65.8M46.2 67.2Q48.2 69.2 50 66.6Q51.8 69.2 53.8 67.2" fill="none" stroke="#B57A70" stroke-width="1.1" stroke-linecap="round"/>`;

let uid = 0;

/** 판 위 고양이 — 눈동자(.pupil)와 눈꺼풀(.lid)을 CSS 로 움직인다 */
export function catFace(extraClass = ''): string {
  const id = `cf${++uid}`;
  return `<svg class="catface ${extraClass}" viewBox="1.5 3 97 97" aria-hidden="true">
    <defs>${catDefs(id)}${eyeClips(id)}</defs>
    ${catBase(id)}${openEye(id, 'L')}${openEye(id, 'R')}${MOUTH}
  </svg>`;
}

/** 아이템 버튼용 — 윙크하며 혀를 내민 고양이 */
function winkCat(id: string): string {
  return `${catBase(id)}
    <circle cx="${EYE_L}" cy="${EYE_Y}" r="${EYE_R_SIZE}" fill="url(#${id}i)" stroke="#5A3A1C" stroke-width="1.3"/>
    <ellipse cx="${EYE_L + 0.4}" cy="${EYE_Y + 0.5}" rx="6.4" ry="7.2" fill="#15100b"/>
    <circle cx="${EYE_L - 2.2}" cy="${EYE_Y - 2.8}" r="2.4" fill="#fff"/>
    <path d="M57.5 51.5Q66 44 74.5 51.5" fill="none" stroke="#5A3A1C" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M43.5 65Q50 77.5 56.5 65Q50 67.4 43.5 65Z" fill="#8A2E2E"/>
    <path d="M46 69.4Q50 79 54 69.4Q50 71.2 46 69.4Z" fill="#F28C9A"/>`;
}

/* ───────────── 톱니 (6갈래 꽃 모양) ───────────── */

function gearPath(): string {
  const cx = 20;
  const cy = 20;
  const pts: string[] = [];
  for (let i = 0; i <= 144; i++) {
    const t = (i / 144) * Math.PI * 2;
    const r = 12.6 + (3.3 * Math.tanh(2.2 * Math.cos(6 * t))) / Math.tanh(2.2);
    pts.push(`${(cx + r * Math.sin(t)).toFixed(2)} ${(cy - r * Math.cos(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}ZM25.6 20A5.6 5.6 0 1 0 14.4 20A5.6 5.6 0 1 0 25.6 20Z`;
}

/* ───────────── sprite ───────────── */

export function spriteMarkup(): string {
  const patterns = Object.entries(PATTERNS)
    .map(([k, body]) => `<symbol id="pat-${k}" viewBox="0 0 100 100">${body}</symbol>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sprite" aria-hidden="true">
  <defs>
    ${catDefs('sc')}
    ${catDefs('wk')}
    ${eyeClips('sc')}
    <radialGradient id="fishg" cx="36%" cy="28%" r="78%">
      <stop offset="0" stop-color="#FFE06A"/><stop offset=".45" stop-color="#FBBE25"/><stop offset="1" stop-color="#DE8910"/>
    </radialGradient>
    <radialGradient id="bulbg" cx="40%" cy="28%" r="78%">
      <stop offset="0" stop-color="#FFEE9A"/><stop offset=".42" stop-color="#FFCB2B"/><stop offset="1" stop-color="#F29500"/>
    </radialGradient>
    <radialGradient id="mouseg" cx="45%" cy="32%" r="72%">
      <stop offset="0" stop-color="#d0d0d7"/><stop offset="1" stop-color="#8b8b96"/>
    </radialGradient>
    <linearGradient id="goldbtn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFB36E"/><stop offset="1" stop-color="#F4873F"/>
    </linearGradient>
  </defs>
  ${patterns}
  <symbol id="mark-x" viewBox="0 0 100 100">
    <!-- 보통은 흰 X. 틀린 자리(#8)는 --xc 빨강 + --xs 흰 테두리로 칠한다 (테두리는 아래층에 따로) -->
    <g style="fill:var(--xs,none);stroke:var(--xs,none);stroke-width:var(--xw,0);stroke-linejoin:round">
      <rect x="39" y="15.5" width="22" height="69" rx="7.5" transform="rotate(45 50 50)"/>
      <rect x="39" y="15.5" width="22" height="69" rx="7.5" transform="rotate(-45 50 50)"/>
    </g>
    <g style="fill:var(--xc,#fff)">
      <rect x="39" y="15.5" width="22" height="69" rx="7.5" transform="rotate(45 50 50)"/>
      <rect x="39" y="15.5" width="22" height="69" rx="7.5" transform="rotate(-45 50 50)"/>
    </g>
  </symbol>
  <symbol id="cat-static" viewBox="0 0 100 100">${catBase('sc')}${openEye('sc', 'L', false)}${openEye('sc', 'R', false)}${MOUTH}</symbol>
  <symbol id="cat-wink" viewBox="0 0 100 100">${winkCat('wk')}</symbol>
  <symbol id="cat-head" viewBox="0 0 100 100">
    <path fill="currentColor" d="M11.5 12Q15 7 20.5 9.5L37 20.5Q50 17.5 63 20.5L79.5 9.5Q85 7 88.5 12Q92 22 91.5 37Q98.5 50 96.5 66Q93 93 50 93.5Q7 93 3.5 66Q1.5 50 8.5 37Q8 22 11.5 12Z"/>
  </symbol>
  <symbol id="art-fish" viewBox="0 0 100 100">
    <path fill="url(#fishg)" d="M40 11C56 11 69 24 69 40C69 44.5 68 48.5 66.4 52.2C75 48.5 85.5 43.5 92.5 46C99 48.5 99 56 93 58.5C87 61 81 63.5 77 68.5C74 72.5 73 80 71.5 87C70 94.5 62.5 97 59 92.5C56.5 89 57.5 82 57 76C56.8 73 56 70.8 54.6 68.8C50.2 70.2 45.2 71 40 71C24 71 11 56 11 40C11 24 24 11 40 11Z"/>
    <ellipse cx="32" cy="24.5" rx="12.5" ry="6.5" fill="#fff" opacity=".42" transform="rotate(-24 32 24.5)"/>
    <circle cx="27" cy="33" r="3.4" fill="#99560c"/>
    <g fill="none" stroke="#cf7c10" stroke-width="2.6" stroke-linecap="round" opacity=".9">
      <path d="M51.5 25.5Q51 31.5 45.5 34.5"/><path d="M60 33.5Q59.5 39.5 54 42.5"/>
      <path d="M45 40.5Q44.5 46.5 39 49.5"/><path d="M53.5 48.5Q53 54.5 47.5 57.5"/>
    </g>
  </symbol>
  <symbol id="art-bulb" viewBox="0 0 100 100">
    <path fill="url(#bulbg)" d="M50 7C71 7 83.5 23 83.5 40.5C83.5 52.5 77 60.5 71 67C68 70.5 66 73.5 65.5 77.5H34.5C34 73.5 32 70.5 29 67C23 60.5 16.5 52.5 16.5 40.5C16.5 23 29 7 50 7Z"/>
    <ellipse cx="36" cy="27" rx="7.5" ry="13" transform="rotate(35 36 27)" fill="#fff" opacity=".6"/>
    <circle cx="29.5" cy="45" r="3" fill="#fff" opacity=".35"/>
    <rect x="33.5" y="76" width="33" height="8.5" rx="4.25" fill="#9d80e6"/>
    <rect x="35" y="83.5" width="30" height="7.5" rx="3.75" fill="#7f5fd0"/>
    <path d="M40.5 90H59.5Q58.5 97.5 50 97.5Q41.5 97.5 40.5 90Z" fill="#6445b6"/>
  </symbol>
  <symbol id="art-mouse" viewBox="0 0 100 100">
    <circle cx="22.5" cy="32" r="18" fill="url(#mouseg)"/><circle cx="23" cy="33" r="11.5" fill="#f5a8b7"/>
    <circle cx="77.5" cy="32" r="18" fill="url(#mouseg)"/><circle cx="77" cy="33" r="11.5" fill="#f5a8b7"/>
    <ellipse cx="50" cy="58.5" rx="31" ry="28" fill="url(#mouseg)"/>
    <ellipse cx="50" cy="71.5" rx="15.5" ry="11" fill="#dddde3"/>
    <circle cx="38" cy="54" r="5.2" fill="#151515"/><circle cx="36.3" cy="52.2" r="1.8" fill="#fff"/>
    <circle cx="62" cy="54" r="5.2" fill="#151515"/><circle cx="60.3" cy="52.2" r="1.8" fill="#fff"/>
    <ellipse cx="50" cy="65.5" rx="4.8" ry="3.5" fill="#ef879e"/>
    <path d="M45.3 71.5H54.7V78.8Q54.7 80.5 53 80.5H47Q45.3 80.5 45.3 78.8Z" fill="#fff" stroke="#c4c4cc" stroke-width=".8"/>
    <path d="M50 71.5V80.5" stroke="#c4c4cc" stroke-width=".8"/>
    <g stroke="#6b6b75" stroke-width="1" stroke-linecap="round">
      <path d="M35 67L14.5 63"/><path d="M35 70.5L14 72"/><path d="M65 67L85.5 63"/><path d="M65 70.5L86 72"/>
    </g>
  </symbol>
  <symbol id="ico-back" viewBox="0 0 40 40">
    <path d="M19.5 9.5L9.5 20L19.5 30.5M10.5 20H30.5" fill="none" stroke="currentColor" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>
  </symbol>
  <symbol id="ico-gear" viewBox="0 0 40 40"><path fill="currentColor" fill-rule="evenodd" d="${gearPath()}"/></symbol>
  <symbol id="ico-play" viewBox="0 0 24 24"><path d="M8.5 5.5L18.5 12L8.5 18.5Z" fill="#fff" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></symbol>
  <symbol id="ico-paw" viewBox="0 0 100 100">${PATTERNS.paw.replace(/class="pf"/g, 'fill="currentColor"')}</symbol>
</svg>`;
}

export const use = (id: string, cls = ''): string =>
  `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#${id}"/></svg>`;
