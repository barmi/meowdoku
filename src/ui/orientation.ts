/** 휴대폰으로 볼 크기인지 판별한다. 태블릿·터치 노트북의 넓은 창은 제한하지 않는다. */
export function isPhoneViewport(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && Math.min(width, height) <= 600;
}

/** 세로 전용 안내를 띄워야 하는 휴대폰 가로 화면인지 판별한다. */
export function isPhoneLandscape(width: number, height: number, coarsePointer: boolean): boolean {
  return isPhoneViewport(width, height, coarsePointer) && width > height;
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'portrait') => Promise<void>;
};

function hasCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

let lockPending = false;

/**
 * 설치형 웹앱·전체 화면처럼 허용된 환경에서는 운영체제의 세로 방향 잠금을 요청한다.
 * 일반 브라우저는 보안 정책으로 거절할 수 있으므로 실패는 안내 화면으로 보완한다.
 */
async function requestPortraitLock(): Promise<void> {
  if (lockPending || !isPhoneViewport(window.innerWidth, window.innerHeight, hasCoarsePointer())) return;
  const orientation = (window.screen as Screen & { orientation?: LockableOrientation }).orientation;
  if (!orientation || typeof orientation.lock !== 'function') return;
  lockPending = true;
  try {
    await orientation.lock('portrait');
  } catch {
    // Safari 탭 등 방향 잠금이 허용되지 않는 환경에서는 portrait-guard가 가로 조작을 막는다.
  } finally {
    lockPending = false;
  }
}

/** 휴대폰을 세로 전용으로 유지하고, 잠금 미지원 브라우저에는 가로 화면 안내를 보여 준다. */
export function watchPortraitOrientation(): void {
  const guard = document.getElementById('portrait-guard');
  const app = document.getElementById('app');

  const updateGuard = () => {
    const landscape = isPhoneLandscape(window.innerWidth, window.innerHeight, hasCoarsePointer());
    if (guard) guard.hidden = !landscape;
    if (app) {
      app.toggleAttribute('inert', landscape);
      app.toggleAttribute('aria-hidden', landscape);
    }
    document.body.classList.toggle('phone-landscape', landscape);
  };

  const update = () => {
    updateGuard();
    void requestPortraitLock();
  };

  update();
  window.addEventListener('resize', updateGuard);
  window.visualViewport?.addEventListener('resize', updateGuard);
  window.addEventListener('orientationchange', update);
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) update();
  });
}
