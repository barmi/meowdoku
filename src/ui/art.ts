/**
 * 게임 그림은 전부 SVG 로 직접 그린다 (원본 앱 이미지를 쓰지 않음).
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

/* ───────────── 턱시도 고양이 ───────────── */

const HEAD =
  'M11.5 41C9 30 13 17 20.5 10.5Q22.5 8.8 24.3 10.3L40 24.5Q50 21.5 60 24.5L75.7 10.3Q77.5 8.8 79.5 10.5' +
  'C87 17 91 30 88.5 41C93 48 94.5 57 92.5 64C89.5 80 72 88.5 50 88.5C28 88.5 10.5 80 7.5 64C5.5 57 7 48 11.5 41Z';
const EAR_L = 'M17.5 36C16.5 28 18.5 20 22.5 15.5L36 26C28 28 21.5 31.5 17.5 36Z';
const EAR_R = 'M82.5 36C83.5 28 81.5 20 77.5 15.5L64 26C72 28 78.5 31.5 82.5 36Z';
const MASK =
  'M8.2 62C12 56 20 54.5 27 57.5C33 60 39.5 60.5 43 56.5C45.5 52 46 44 47 36C47.6 31 48.6 28.5 50 28.5' +
  'C51.4 28.5 52.4 31 53 36C54 44 54.5 52 57 56.5C60.5 60.5 67 60 73 57.5C80 54.5 88 56 91.8 62' +
  'C90 79.5 72 88.5 50 88.5C28 88.5 10 79.5 8.2 62Z';

function catDefs(id: string): string {
  return `
    <radialGradient id="${id}f" cx="50%" cy="28%" r="72%">
      <stop offset="0" stop-color="#4d4d52"/><stop offset=".5" stop-color="#252528"/><stop offset="1" stop-color="#0c0c0e"/>
    </radialGradient>
    <radialGradient id="${id}w" cx="50%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#f2f0ef"/><stop offset="1" stop-color="#cbc6c4"/>
    </radialGradient>
    <linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a3b42"/><stop offset="1" stop-color="#bf8f97"/>
    </linearGradient>`;
}

const WHISKERS = `
  <g fill="none" stroke="#f3f0ef" stroke-width=".9" stroke-linecap="round" opacity=".95">
    <path d="M20 63.5L2.5 60"/><path d="M20 66.5L2 67.5"/><path d="M21 69.5L4 74.5"/>
    <path d="M80 63.5L97.5 60"/><path d="M80 66.5L98 67.5"/><path d="M79 69.5L96 74.5"/>
  </g>`;

function catBase(id: string): string {
  return `${WHISKERS}
    <path d="${HEAD}" fill="url(#${id}f)" stroke="#0d0d0f" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="${EAR_L}" fill="url(#${id}e)"/><path d="${EAR_R}" fill="url(#${id}e)"/>
    <ellipse cx="50" cy="30" rx="16" ry="6" fill="#fff" opacity=".07"/>
    <path d="${MASK}" fill="url(#${id}w)"/>
    <path d="M46.2 59.8Q50 58.2 53.8 59.8Q53.2 63 50 64.3Q46.8 63 46.2 59.8Z" fill="#f29cb2"/>`;
}

function openEye(id: string, side: 'L' | 'R'): string {
  const cx = side === 'L' ? 34.5 : 65.5;
  return `
    <g class="eye eye-${side === 'L' ? 'l' : 'r'}">
      <circle cx="${cx}" cy="50" r="10.3" fill="#fdfdfd"/>
      <g class="pupil">
        <circle cx="${cx}" cy="50.4" r="6.8" fill="#1d1515"/>
        <circle cx="${cx - 2.3}" cy="47.7" r="2.1" fill="#fff"/>
        <circle cx="${cx + 2.1}" cy="52.6" r=".9" fill="#fff" opacity=".8"/>
      </g>
      <g clip-path="url(#${id}${side})"><rect class="lid" x="${cx - 11}" y="39" width="22" height="22.5" fill="#19191b"/></g>
      <circle cx="${cx}" cy="50" r="10.3" fill="none" stroke="#131314" stroke-width="1.2"/>
    </g>`;
}

const MOUTH = `<path d="M50 64.3V65.8M45.8 66.4Q48 68.4 50 66.2Q52 68.4 54.2 66.4" fill="none" stroke="#5d4548" stroke-width="1.1" stroke-linecap="round"/>`;

let uid = 0;

/** 판 위 고양이 — 눈동자(.pupil)와 눈꺼풀(.lid)을 CSS 로 움직인다 */
export function catFace(extraClass = ''): string {
  const id = `cf${++uid}`;
  return `<svg class="catface ${extraClass}" viewBox="1.5 3 97 97" aria-hidden="true">
    <defs>${catDefs(id)}
      <clipPath id="${id}L"><circle cx="34.5" cy="50" r="10.3"/></clipPath>
      <clipPath id="${id}R"><circle cx="65.5" cy="50" r="10.3"/></clipPath>
    </defs>
    ${catBase(id)}${openEye(id, 'L')}${openEye(id, 'R')}${MOUTH}
  </svg>`;
}

/** 아이템 버튼용 — 윙크하며 혀를 내민 고양이 */
function winkCat(id: string): string {
  return `${catBase(id)}
    <circle cx="34.5" cy="50" r="10" fill="#fdfdfd" stroke="#131314" stroke-width="1.2"/>
    <circle cx="35" cy="50.5" r="6.6" fill="#1d1515"/><circle cx="32.6" cy="47.6" r="2.2" fill="#fff"/>
    <path d="M57.5 51.5Q65.5 44.5 73.5 51.5" fill="none" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M43 64.2Q50 78 57 64.2Q50 66.6 43 64.2Z" fill="#7a2233"/>
    <path d="M45.6 69Q50 79.5 54.4 69Q50 71 45.6 69Z" fill="#f07b94"/>`;
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
    <clipPath id="scL"><circle cx="34.5" cy="50" r="10.3"/></clipPath>
    <clipPath id="scR"><circle cx="65.5" cy="50" r="10.3"/></clipPath>
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
    <g fill="#fff">
      <rect x="39" y="15.5" width="22" height="69" rx="7.5" transform="rotate(45 50 50)"/>
      <rect x="39" y="15.5" width="22" height="69" rx="7.5" transform="rotate(-45 50 50)"/>
    </g>
  </symbol>
  <symbol id="cat-static" viewBox="0 0 100 100">${catBase('sc')}${openEye('sc', 'L')}${openEye('sc', 'R')}${MOUTH}</symbol>
  <symbol id="cat-wink" viewBox="0 0 100 100">${winkCat('wk')}</symbol>
  <symbol id="cat-head" viewBox="0 0 100 100">
    <path fill="currentColor" d="M13 5.5Q15.5 3.5 18.5 5.8L37 20.5Q50 17.5 63 20.5L81.5 5.8Q84.5 3.5 87 5.5Q89.5 20 91 37Q98.5 50 96.5 66Q93 93 50 93.5Q7 93 3.5 66Q1.5 50 9 37Q10.5 20 13 5.5Z"/>
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
