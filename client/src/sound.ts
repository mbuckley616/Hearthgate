/**
 * Hit sounds, synthesised with WebAudio so there are no assets to load.
 * Browsers only allow audio after a user gesture, so the context starts on the first
 * key, gamepad button or touch; until then hits are silent, never queued.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  constructor(target: Window = window) {
    const unlock = () => this.unlock();
    target.addEventListener("keydown", unlock);
    target.addEventListener("pointerdown", unlock);
    target.addEventListener("gamepadconnected", unlock);
  }

  private unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor() as AudioContext;
      // One shared buffer of white noise; each hit plays a filtered slice of it.
      const len = Math.floor(this.ctx.sampleRate * 0.2);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** A bright, short thwack: you (or a friend) connected with the goblin. */
  hitDealt(volume = 1) {
    this.thump(volume * 0.5, 1800, 220, 0.09);
  }

  /** A low, heavier thud: the goblin connected with a player. */
  hitTaken(volume = 1) {
    this.thump(volume * 0.7, 600, 90, 0.16);
  }

  private thump(gain: number, filterHz: number, toneHz: number, seconds: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || ctx.state !== "running" || gain <= 0) return;
    const t = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.setValueAtTime(gain, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    out.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterHz, t);
    src.connect(filter).connect(out);
    src.start(t, 0, seconds);

    // A falling tone under the noise gives the hit its body.
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(toneHz, t);
    osc.frequency.exponentialRampToValueAtTime(toneHz * 0.5, t + seconds);
    osc.connect(out);
    osc.start(t);
    osc.stop(t + seconds);
  }
}
