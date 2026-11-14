import { hasCoarsePointer, isPhoneLandscape } from './orientation';

/**
 * 디자인 기준 428×790 (스크린샷 폭, 광고 영역을 뺀 높이)을 화면에 맞춘다.
 * 모든 치수는 CSS 에서 calc(N * var(--px)) 로 쓰므로 --px 하나만 바꾸면 된다.
 */
const DESIGN_W = 428;
const DESIGN_H = 790;

export function fitLayout(): void {
  const probe = document.querySelector<HTMLElement>('.safe-probe');
  let safeTop = 0;
  let safeRight = 0;
  let safeBottom = 0;
  let safeLeft = 0;
  if (probe) {
    const cs = getComputedStyle(probe);
    safeTop = parseFloat(cs.paddingTop) || 0;
    safeRight = parseFloat(cs.paddingRight) || 0;
    safeBottom = parseFloat(cs.paddingBottom) || 0;
    safeLeft = parseFloat(cs.paddingLeft) || 0;
  }
  const physicalW = window.innerWidth;
  const physicalH = window.visualViewport?.height ?? window.innerHeight;
  const landscape = isPhoneLandscape(window.innerWidth, window.innerHeight, hasCoarsePointer());
  const logicalW = landscape ? physicalH : physicalW;
  const logicalH = landscape ? physicalW : physicalH;
  const verticalSafe = landscape ? safeLeft + safeRight : safeTop + safeBottom;
  const px = Math.max(0.5, Math.min(logicalW / DESIGN_W, (logicalH - verticalSafe) / DESIGN_H, 1.35));
  const root = document.documentElement.style;
  root.setProperty('--px', `${px.toFixed(4)}px`);
  root.setProperty('--app-vw', `${logicalW}px`);
  root.setProperty('--app-vh', `${logicalH}px`);
}

export function watchLayout(): void {
  fitLayout();
  let raf = 0;
  const again = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fitLayout);
  };
  window.addEventListener('resize', again);
  window.visualViewport?.addEventListener('resize', again);
  window.addEventListener('orientationchange', again);
}

/** 기기 설정의 "동작 줄이기" — 켜져 있으면 고양이 눈을 더 드물게, 탭마다 쳐다보는 동작은 끈다 (#14) */
export function calmMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
