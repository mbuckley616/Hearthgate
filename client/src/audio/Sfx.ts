import { tuning } from '@hearthgate/shared/config/tuning';
import type { SimEvent } from '@hearthgate/shared/sim/types';

/**
 * Our own sound, synthesised with Web Audio (no recordings; Michael's call in
 * M6 to keep assets home-made). Each hit layers a swoosh, an impact and an
 * enemy groan with a little pitch variation (brief: "Sound"); finishers get a
 * heavier impact.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** Called once audio is unlocked, so the music can share the context. */
  onUnlock: ((ctx: AudioContext, noise: AudioBuffer) => void) | null = null;

  constructor() {
    // Browsers only allow audio after a user gesture.
    const unlock = () => this.ensure();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.onUnlock?.(this.ctx, this.noise);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  handle(events: SimEvent[], localId: string): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || events.length === 0) return;
    this.master!.gain.value = tuning.hitFeel.sfxVolume * tuning.audio.masterVolume;
    let hits = 0;
    for (const ev of events) {
      switch (ev.kind) {
        case 'swing':
          this.swoosh(ev.heavy ? 0.32 : 0.2, ev.heavy ? 700 : 1100, 0.5);
          break;
        case 'fire':
          if (ev.projectile === 'arrow') this.twang(ev.heavy);
          else if (ev.projectile === 'bolt') this.zap();
          else this.whoomph();
          break;
        case 'hit':
          // Many simultaneous hits (fans, novas, bursts) shouldn't stack into a roar.
          if (hits++ < 3) {
            this.impact(ev.heavy);
            if (ev.killed) this.groan(true);
            else if (Math.random() < 0.6) this.groan(false);
          }
          break;
        case 'land':
          this.impact(true);
          this.rumble();
          break;
        case 'stagger':
          this.warble();
          break;
        case 'parry':
          // Ringing clang: two bright partials over a sharp hit.
          this.impact(true);
          this.tone('triangle', 1760, 1700, 0.5, 0.22, 0.002);
          this.tone('sine', 2640, 2600, 0.35, 0.12, 0.002);
          break;
        case 'block':
          this.impact(ev.broke);
          this.tone('square', ev.broke ? 220 : 520, ev.broke ? 140 : 480, 0.12, 0.06, 0.002);
          break;
        case 'heroHurt':
          if (ev.playerId === localId) {
            this.hurt();
            if (ev.heavy) this.rumble(0.4);
          }
          break;
        case 'heroDown':
          if (ev.playerId === localId) this.groan(true, 0.6);
          break;
        case 'enemyTelegraph':
          this.growl();
          break;
        case 'enemySwing':
          this.swoosh(0.18, 900, 0.3);
          break;
        case 'enemySpawn':
          this.rumble(0.25);
          break;
        case 'ability':
          if (ev.ability === 'charge') {
            this.swoosh(0.35, 500, 0.6);
            this.rumble(0.35);
          } else if (ev.ability === 'disengage') {
            this.swoosh(0.3, 900, 0.45);
          } else if (ev.ability === 'blink') {
            this.tone('sine', 400, 1800, 0.22, 0.25);
            this.noiseBurst('highpass', 3000, 7000, 0.7, 0.18, 0.15);
          }
          break;
        case 'whirlTick':
          this.swoosh(0.16, 1000, 0.35);
          break;
        case 'frostRing':
          this.crackle();
          this.tone('sine', 1600, 500, 0.5, 0.12, 0.01);
          break;
        case 'freeze':
          if (hits++ < 3) this.crackle(0.25);
          break;
        case 'enemyShot':
          this.tone('triangle', 220, 150, 0.2, 0.25);
          this.noiseBurst('highpass', 2500, 1200, 0.8, 0.08, 0.15);
          break;
        case 'enemySlam':
          this.impact(true);
          this.rumble(ev.boss ? 0.9 : 0.6);
          if (ev.boss) this.tone('sine', 70, 30, 0.6, 0.9, 0.01);
          break;
        case 'roar':
          this.tone('sawtooth', 90, 60, 1.4, 0.35, 0.15);
          this.tone('sawtooth', 135, 80, 1.3, 0.2, 0.2);
          this.noiseBurst('lowpass', 800, 200, 0.5, 1.2, 0.3);
          break;
        case 'waveStart':
          this.horn(ev.boss);
          break;
        case 'combo':
          // Each combo has its own sound (brief).
          if (ev.combo === 'shatter') {
            this.noiseBurst('highpass', 6000, 2500, 1, 0.45, 0.4);
            [1568, 2093, 2637].forEach((f, i) => setTimeout(() => this.tone('triangle', f, f * 0.98, 0.3, 0.14, 0.002), i * 35));
          } else if (ev.combo === 'skewer') {
            this.tone('sawtooth', 300, 1400, 0.18, 0.18, 0.002);
            this.tone('triangle', 1400, 1300, 0.35, 0.16, 0.01);
          } else {
            this.impact(true);
            this.rumble(0.7);
            this.noiseBurst('lowpass', 2400, 200, 0.7, 0.7, 0.6);
          }
          break;
        case 'revived':
          [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone('sine', f, f, 0.4, 0.18, 0.02), i * 110));
          break;
        case 'playerJoined':
          this.tone('triangle', 660, 880, 0.25, 0.15, 0.01);
          break;
        case 'levelUp':
          [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone('triangle', f, f, 0.35, 0.2, 0.01), i * 80));
          break;
        case 'dropSpawned':
          this.tone('sine', 1200, 1800, 0.5, 0.12, 0.05);
          this.tone('sine', 1800, 2400, 0.4, 0.06, 0.08);
          break;
        case 'pickup':
          this.tone('triangle', 880, 1320, 0.25, 0.22, 0.01);
          if (ev.item.rarity === 'rare') setTimeout(() => this.tone('triangle', 1320, 1760, 0.3, 0.2, 0.01), 90);
          break;
        case 'smashed':
          // Wood crunches; an urn shatters higher.
          if (ev.propKind === 'urn') this.noiseBurst('highpass', 2600, 1400, 0.8, 0.22, 0.45);
          else this.noiseBurst('lowpass', 900, 260, 1.2, 0.28, 0.6);
          this.impact(false);
          if (ev.potion) setTimeout(() => this.tone('sine', 900, 1500, 0.3, 0.12, 0.02), 120);
          break;
        case 'potionTaken':
          this.tone('triangle', 660, 990, 0.22, 0.2, 0.01);
          break;
        case 'drank':
          [330, 300, 360].forEach((f, i) => setTimeout(() => this.tone('sine', f, f * 0.8, 0.09, 0.16, 0.01), i * 90));
          setTimeout(() => this.tone('triangle', 520, 880, 0.35, 0.14, 0.02), 300);
          break;
        case 'perk':
          this.tone('sine', ev.perk === 'bleed' ? 300 : 1500, ev.perk === 'bleed' ? 200 : 900, 0.12, 0.08);
          break;
        case 'reinforcements':
          this.horn(false);
          break;
        case 'runWon':
          [392, 494, 587, 784].forEach((f, i) => setTimeout(() => this.tone('triangle', f, f, 0.5, 0.25, 0.02), i * 140));
          break;
        case 'runLost':
          [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone('triangle', f, f * 0.98, 0.7, 0.22, 0.03), i * 260));
          break;
        case 'runStart':
          this.rumble(0.6);
          this.impact(true);
          break;
      }
    }
  }

  /** Pitch multiplier with the brief's ±5% variation. */
  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * tuning.hitFeel.pitchJitter;
  }

  private env(gain: GainNode, t: number, attack: number, peak: number, release: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  private noiseBurst(type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, peak: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = this.jitter();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    const j = this.jitter();
    filter.frequency.setValueAtTime(f0 * j, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * j), t + dur);
    const gain = ctx.createGain();
    this.env(gain, t, Math.min(0.03, dur * 0.3), peak, dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.1);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    const j = this.jitter();
    osc.frequency.setValueAtTime(f0 * j, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * j), t + dur);
    const gain = ctx.createGain();
    this.env(gain, t, attack, peak, dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + attack + dur + 0.05);
  }

  private swoosh(dur: number, freq: number, peak: number): void {
    this.noiseBurst('bandpass', freq * 0.6, freq * 2.2, 1.2, dur, peak);
  }

  private impact(heavy: boolean): void {
    this.tone('sine', heavy ? 140 : 210, heavy ? 45 : 70, heavy ? 0.28 : 0.15, heavy ? 0.9 : 0.6);
    this.noiseBurst('lowpass', heavy ? 2200 : 3200, 300, 0.7, heavy ? 0.18 : 0.09, heavy ? 0.7 : 0.45);
  }

  private groan(death: boolean, peak = 0.22): void {
    this.tone('sawtooth', death ? 210 : 260, death ? 90 : 170, death ? 0.45 : 0.14, peak, 0.02);
  }

  private twang(heavy: boolean): void {
    this.tone('triangle', heavy ? 260 : 330, heavy ? 180 : 240, 0.22, 0.35);
    this.noiseBurst('highpass', 3000, 1500, 0.8, 0.08, 0.2);
  }

  private zap(): void {
    this.tone('sine', 1400, 600, 0.18, 0.18);
    this.tone('triangle', 2100, 900, 0.12, 0.08);
    this.noiseBurst('highpass', 5000, 2500, 0.7, 0.12, 0.12);
  }

  private whoomph(): void {
    this.tone('sine', 90, 40, 0.5, 0.8, 0.02);
    this.noiseBurst('lowpass', 1800, 200, 0.6, 0.45, 0.5);
    this.tone('sine', 1200, 1800, 0.4, 0.06, 0.05);
  }

  private rumble(peak = 0.5): void {
    this.noiseBurst('lowpass', 400, 60, 0.5, 0.6, peak);
  }

  private warble(): void {
    this.tone('square', 900, 500, 0.25, 0.06);
    this.tone('square', 700, 1100, 0.25, 0.05);
  }

  private hurt(): void {
    this.tone('sine', 160, 70, 0.2, 0.7);
    this.noiseBurst('lowpass', 1500, 300, 0.6, 0.12, 0.4);
  }

  /** Brass-ish call for a new wave; lower and longer for the boss. */
  private horn(boss: boolean): void {
    const f = boss ? 110 : 147;
    this.tone('sawtooth', f, f, boss ? 1.3 : 0.8, 0.16, 0.08);
    this.tone('sawtooth', f * 1.5, f * 1.5, boss ? 1.1 : 0.6, 0.1, 0.12);
  }

  /** Ice: a bright noisy crack. */
  private crackle(peak = 0.4): void {
    this.noiseBurst('highpass', 6000, 2500, 1.5, 0.25, peak);
    this.noiseBurst('bandpass', 2500, 1200, 3, 0.12, peak * 0.6);
  }

  private growl(): void {
    this.tone('sawtooth', 120, 180, 0.3, 0.12, 0.05);
  }
}
