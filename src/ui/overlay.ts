import { use } from './art';

export interface SheetAction {
  label: string;
  kind?: 'primary' | 'green' | 'soft';
  icon?: string;
  /** false 를 돌려주면 창을 닫지 않는다 */
  onClick?: () => void | boolean;
}

export interface SheetHandle {
  root: HTMLElement;
  close: () => void;
}

let openCount = 0;

export const isSheetOpen = (): boolean => openCount > 0;

export function openSheet(opts: {
  html: string;
  actions?: SheetAction[];
  dismissible?: boolean;
  onClose?: () => void;
}): SheetHandle {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${opts.html}<div class="actions"></div></div>`;
  const sheet = overlay.firstElementChild as HTMLElement;
  const actions = sheet.querySelector('.actions') as HTMLElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openCount--;
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.dismissible !== false) close();
  };
  for (const a of opts.actions ?? []) {
    const b = document.createElement('button');
    b.className = `btn ${a.kind ?? 'soft'}`;
    b.innerHTML = `${a.icon ? use(a.icon) : ''}<span>${a.label}</span>`;
    b.addEventListener('click', () => {
      if (a.onClick?.() !== false) close();
    });
    actions.appendChild(b);
  }
  if (!actions.childElementCount) actions.remove();
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay && opts.dismissible !== false) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  openCount++;
  return { root: sheet, close };
}

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

export function toast(message: string, ms = 1700): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('show'), ms);
}

/** 물고기·발바닥·고양이 조각이 쏟아진다. parent 로 창(overlay)을 주면 창 뒤·배경 위로 떨어진다. */
export function confetti(count = 36, parent: HTMLElement = document.body): void {
  const kinds = ['art-fish', 'ico-paw', 'cat-static', 'art-fish'];
  const colors = ['#FA9D5C', '#D36F8F', '#8979DA', '#38A9C0', '#2A8C53', '#CDA400'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    const dur = 1.8 + Math.random() * 1.6;
    el.style.left = `${Math.random() * 100}vw`;
    el.style.color = colors[i % colors.length];
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
    el.style.animationDuration = `${dur}s`;
    el.style.animationDelay = `${Math.random() * 0.5}s`;
    el.innerHTML = use(kinds[i % kinds.length]);
    parent.prepend(el);
    setTimeout(() => el.remove(), (dur + 0.6) * 1000);
  }
}
