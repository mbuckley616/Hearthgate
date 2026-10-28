import { tuning } from '@hearthgate/shared/config/tuning';

export type Mood = 'calm' | 'combat' | 'boss' | 'victory' | 'defeat';

/** D minor: note names to semitones above D. */
const D = 146.83;
const hz = (semi: number) => D * Math.pow(2, semi / 12);

/** Chord progressions as root offsets (semitones from D) with minor/major thirds. */
const CALM_CHORDS = [
  { root: 0, third: 3 }, // Dm
  { root: -4, third: 4 }, // Bb
  { root: 5, third: 3 }, // Gm
  { root: 7, third: 4 }, // A
];
const COMBAT_CHORDS = [
  { root: 0, third: 3 }, // Dm
  { root: -4, third: 4 }, // Bb
  { root: -2, third: 4 }, // C
  { root: 7, third: 4 }, // A
];

/**
 * Our own soundtrack, synthesised live (no recordings): a slow, dark theme
 * between fights and on the title, a driving 80s-style minor-key track in
 * combat with an extra layer for the Warden, and short stings for victory
 * and defeat. A lookahead scheduler keeps the timing tight.
 */
export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private echo: DelayNode | null = null;
  private noise: AudioBuffer | null = null;
  private mood: Mood = 'calm';
  private pending: Mood | null = null;
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private fade = 1;
  /** The local hero's Flow tier (C2): each adds a layer to the fight's music. */
  private flow = 0;

  /** Called once audio is unlocked (Sfx owns the context). */
  attach(ctx: AudioContext, noise: AudioBuffer): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    // A soft echo for the bells and leads.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    this.echo.connect(tone);
    tone.connect(fb);
    fb.connect(this.echo);
    tone.connect(this.out);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** Ask for a mood; changes land on the next bar with a short fade. */
  setMood(mood: Mood): void {
    if (mood === this.mood && this.pending === null) return;
    if (mood === this.pending) return;
    this.pending = mood;
  }

  setFlow(tier: number): void {
    this.flow = tier;
  }

  /** Keep the volume in step with settings (call per frame). */
  update(dt: number): void {
    if (!this.ctx || !this.out) return;
    this.fade = Math.min(1, this.fade + dt * 1.5);
    const target = tuning.audio.masterVolume * tuning.audio.musicVolume * 0.55 * this.fade;
    this.out.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  private bpm(): number {
    return this.mood === 'calm' ? 66 : this.mood === 'boss' ? 144 : 132;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const sixteenth = 60 / this.bpm() / 4;
      // Mood changes wait for a bar line.
      if (this.pending && this.step % 16 === 0) {
        const from = this.mood;
        this.mood = this.pending;
        this.pending = null;
        this.step = 0;
        if (from !== this.mood) this.fade = 0.25;
        if (this.mood === 'victory') this.victory(this.nextTime);
        if (this.mood === 'defeat') this.defeat(this.nextTime);
      }
      this.playStep(this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(t: number, s: number): void {
    const m = this.mood;
    if (m === 'victory' || m === 'defeat') {
      // Stings play once, then drift back to the calm theme.
      if (this.step >= 48) this.pending = 'calm';
      return;
    }
    const bar = Math.floor(this.step / 16);
    const i = this.step % 16;
    if (m === 'calm') {
      const chord = CALM_CHORDS[Math.floor(bar / 2) % CALM_CHORDS.length];
      if (i === 0 && bar % 2 === 0) this.pad(t, chord.root, chord.third, s * 32);
      // Sparse bell arpeggio, an octave up.
      if (i % 4 === 0 && pseudo(this.step) > 0.35) {
        const notes = [0, chord.third, 7, 12];
        this.bell(t, chord.root + 12 + notes[(i / 4 + bar) % 4]);
      }
      if (i === 0) this.lowDrone(t, chord.root - 12, s * 16);
      return;
    }
    // Combat and boss.
    const chord = COMBAT_CHORDS[bar % COMBAT_CHORDS.length];
    const bassPattern = [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 7, 0, 10, 12];
    this.bass(t, chord.root - 12 + bassPattern[i], s * 0.9);
    if (i % 4 === 0) this.kick(t);
    if (i === 4 || i === 12) this.snare(t);
    if (i % 2 === 0) this.hat(t, i % 4 === 2 ? 0.08 : 0.04);
    // Arpeggiated lead.
    const arp = [0, chord.third, 7, 12, 7, chord.third];
    if (bar % 4 >= 2 || m === 'boss') this.lead(t, chord.root + 12 + arp[i % arp.length], s * 0.8, m === 'boss' ? 0.07 : 0.05);
    if (i === 0) this.pad(t, chord.root, chord.third, s * 16, 0.05);
    if (m === 'boss' && (i === 14 || i === 15)) this.tom(t, i === 14 ? 120 : 90);
    // Flow (C2): I fills the hats in, II keeps the lead going every bar, III adds a bell on the off-beats.
    if (this.flow >= 1 && i % 2 === 1) this.hat(t, 0.03);
    if (this.flow >= 2 && bar % 4 < 2 && m !== 'boss') this.lead(t, chord.root + 12 + arp[i % arp.length], s * 0.8, 0.04);
    if (this.flow >= 3 && i % 4 === 2) this.bell(t, chord.root + 24 + arp[(i / 2) % arp.length]);
  }

  // --- Voices ---

  private voice(type: OscillatorType, f: number, t: number, dur: number, peak: number, attack: number, cutoff: number, toEcho = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(filt);
    filt.connect(g);
    g.connect(this.out!);
    if (toEcho > 0) {
      const send = ctx.createGain();
      send.gain.value = toEcho;
      g.connect(send);
      send.connect(this.echo!);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(t: number, root: number, third: number, dur: number, peak = 0.07): void {
    for (const semi of [root, root + third, root + 7]) {
      this.voice('sawtooth', hz(semi) * 0.995, t, dur, peak / 3, dur * 0.3, 700);
      this.voice('sawtooth', hz(semi) * 1.005, t, dur, peak / 3, dur * 0.3, 700);
    }
  }

  private lowDrone(t: number, semi: number, dur: number): void {
    this.voice('triangle', hz(semi), t, dur, 0.09, 0.4, 400);
  }

  private bell(t: number, semi: number): void {
    this.voice('triangle', hz(semi), t, 1.4, 0.06, 0.005, 5000, 0.6);
    this.voice('sine', hz(semi) * 2.01, t, 0.6, 0.02, 0.005, 6000, 0.3);
  }

  private bass(t: number, semi: number, dur: number): void {
    this.voice('sawtooth', hz(semi), t, dur, 0.11, 0.004, 520);
    this.voice('square', hz(semi) / 2, t, dur, 0.05, 0.004, 300);
  }

  private lead(t: number, semi: number, dur: number, peak: number): void {
    this.voice('square', hz(semi), t, dur, peak, 0.004, 2600, 0.35);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(this.out!);
    o.start(t);
    o.stop(t + 0.25);
  }

  private noiseHit(t: number, type: BiquadFilterType, f: number, dur: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.out!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number): void {
    this.noiseHit(t, 'bandpass', 1800, 0.16, 0.22);
    this.voice('triangle', 190, t, 0.1, 0.08, 0.002, 2000);
  }

  private hat(t: number, peak: number): void {
    this.noiseHit(t, 'highpass', 7000, 0.04, peak);
  }

  private tom(t: number, f: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(this.out!);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** Rising D major fanfare. */
  private victory(t: number): void {
    [0, 4, 7, 12, 16, 19, 24].forEach((semi, k) => this.voice('square', hz(semi), t + k * 0.11, 0.5 + (k === 6 ? 1.2 : 0), 0.06, 0.005, 3000, 0.4));
    this.pad(t + 0.77, 0, 4, 2.4, 0.09);
  }

  /** Low, falling minor sting. */
  private defeat(t: number): void {
    [12, 10, 8, 7, 3, 0].forEach((semi, k) => this.voice('triangle', hz(semi - 12), t + k * 0.22, 0.6, 0.08, 0.01, 1200, 0.3));
    this.lowDrone(t + 1.3, -12, 3);
  }
}

/** Stable pseudo-random 0..1 per step, so the calm bells have a pattern rather than noise. */
function pseudo(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
