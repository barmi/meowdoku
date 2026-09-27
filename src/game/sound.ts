/** 효과음은 파일 없이 WebAudio 로 합성한다. 첫 탭 이후에만 소리가 난다(브라우저 정책). */
export class Sound {
  enabled = true;
  vibrate = true;
  private ctx: AudioContext | null = null;

  private audio(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number; lowpass?: number } = {},
  ): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const peak = opts.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.015, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (opts.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private buzz(ms: number | number[]): void {
    if (this.vibrate && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* 지원 안 함 */
      }
    }
  }

  mark(): void {
    this.tone(880, 0.05, { type: 'triangle', gain: 0.07 });
    this.buzz(8);
  }

  /** 마커 — X 보다 부드러운 소리 */
  note(): void {
    this.tone(660, 0.06, { gain: 0.06 });
    this.buzz(6);
  }

  erase(): void {
    this.tone(520, 0.05, { type: 'triangle', gain: 0.06 });
  }

  /** "냐옹" 비슷하게 — 톱니파를 저역통과로 굴린다 */
  meow(): void {
    const ctx = this.audio();
    if (ctx) {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620, t0);
      osc.frequency.linearRampToValueAtTime(980, t0 + 0.09);
      osc.frequency.linearRampToValueAtTime(700, t0 + 0.3);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1400, t0);
      f.frequency.linearRampToValueAtTime(2600, t0 + 0.1);
      f.frequency.linearRampToValueAtTime(900, t0 + 0.32);
      f.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      osc.connect(f).connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.36);
    }
    this.tone(1568, 0.12, { gain: 0.05, delay: 0.05 });
    this.buzz(15);
  }

  wrong(): void {
    this.tone(220, 0.16, { type: 'square', gain: 0.06, to: 150, lowpass: 900 });
    this.tone(180, 0.2, { type: 'square', gain: 0.06, to: 110, delay: 0.14, lowpass: 900 });
    this.buzz([60, 40, 90]);
  }

  magic(): void {
    [988, 1319, 1568, 1976].forEach((f, i) => this.tone(f, 0.18, { gain: 0.06, delay: i * 0.06 }));
  }

  squeak(): void {
    this.tone(2200, 0.07, { type: 'triangle', gain: 0.05, to: 2900 });
    this.tone(2400, 0.07, { type: 'triangle', gain: 0.05, to: 3100, delay: 0.1 });
  }

  step(): void {
    this.tone(1200, 0.03, { type: 'triangle', gain: 0.03 });
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.28, { type: 'triangle', gain: 0.09, delay: i * 0.1 }));
    this.buzz([30, 50, 30]);
  }

  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', gain: 0.08, delay: i * 0.16 }));
  }

  coin(): void {
    this.tone(1319, 0.08, { type: 'square', gain: 0.04, lowpass: 3000 });
    this.tone(1976, 0.16, { type: 'square', gain: 0.04, lowpass: 3000, delay: 0.07 });
  }
}
