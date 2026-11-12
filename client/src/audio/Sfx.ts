import { tuning } from '@hearthgate/shared/config/tuning';
import { entryOf, type GearItem } from '@hearthgate/shared/sim/catalogue';
import type { SimEvent, SimState } from '@hearthgate/shared/sim/types';
import { telegraphColour, type TelegraphColour } from '@hearthgate/shared/sim/roles';

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

  handle(events: SimEvent[], localId: string, world?: SimState): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || events.length === 0) return;
    this.master!.gain.value = tuning.hitFeel.sfxVolume * tuning.audio.masterVolume;
    let hits = 0;
    for (const ev of events) {
      switch (ev.kind) {
        case 'embers':
          // Rune of Embers: the fire bursting where the shot stopped.
          this.whoomph();
          break;
        case 'whip':
          // Rune of the Whip: the crack of the lash over the heavy's swoosh.
          this.whoomph();
          break;
        case 'swing':
          this.swoosh(ev.heavy ? 0.32 : 0.2, ev.heavy ? 700 : 1100, 0.5);
          break;
        case 'fire':
          if (ev.projectile === 'arrow') this.twang(ev.heavy);
          else if (ev.projectile === 'bolt') this.zap();
          // Rune of Blades: a thin, high swoosh for the spectral blades.
          else if (ev.projectile === 'blade') this.swoosh(0.16, 1500, 0.35);
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
        case 'guarded':
          // Wood and iron turning a blade (E1b): a dull knock with a short ring.
          this.impact(false);
          this.tone('square', 600, 540, 0.1, 0.05, 0.002);
          break;
        case 'guardBroken':
          this.impact(true);
          this.tone('square', 200, 120, 0.18, 0.08, 0.002);
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
        case 'door':
          this.door(ev.playerId === localId ? 1 : 0.4);
          break;
        case 'enemyTelegraph': {
          // A sound a colour (E1a), so a tell is heard as well as seen: the enemy as the drawn world has it.
          const e = world?.enemies.find((en) => en.id === ev.enemyId);
          this.tell(e ? telegraphColour(e) : 'strike');
          break;
        }
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
          if (ev.thorns) {
            // A Thorn Ring: a woody crack and a rustle, where the frost ring cracks ice.
            this.tone('triangle', 200, 110, 0.3, 0.1, 0.005);
            this.noiseBurst('bandpass', 1800, 700, 2, 0.4, 0.09);
            break;
          }
          if (ev.element) {
            // An Elemental Nova: Fire a roaring whump, Earth a deep thud, Air a rushing gust, where the frost ring cracks.
            if (ev.element === 'fire') this.noiseBurst('lowpass', 1200, 200, 1, 0.5, 0.12);
            else if (ev.element === 'earth') this.tone('sine', 120, 50, 0.4, 0.14, 0.005);
            else this.noiseBurst('bandpass', 600, 2400, 1, 0.45, 0.1);
            break;
          }
          if (ev.curse) {
            // A Curse Ring: a deep falling groan under a hush, where the frost ring cracks.
            this.tone('sawtooth', 260, 70, 0.6, 0.05, 0.02);
            this.noiseBurst('lowpass', 900, 200, 1, 0.5, 0.08);
            break;
          }
          this.crackle();
          this.tone('sine', 1600, 500, 0.5, 0.12, 0.01);
          break;
        case 'tileCracked':
          // A collapsing tile (G5) starts to give: stone grinding and a crack.
          this.crackle(0.3);
          this.noiseBurst('lowpass', 300, 120, 1, 0.5, 0.18);
          break;
        case 'tileFell':
          // It goes: a deep rumble and the slab breaking far below.
          this.rumble(0.45);
          this.later(0.35, () => this.noiseBurst('lowpass', 900, 200, 1, 0.4, 0.25));
          break;
        case 'circleLanded':
          // A Wraith's circle lands (E1d): a cold thump and a hiss of frost, its own sound so a miss is heard too.
          this.noiseBurst('lowpass', 500, 160, 1, 0.3, 0.3);
          this.tone('sine', 520, 260, 0.35, 0.1, 0.005);
          this.noiseBurst('highpass', 4000, 7000, 1, 0.35, 0.12);
          break;
        case 'taunt':
          // A Paladin's Shield Rush took hold (the builds pass): a bright bell over the impact, softer for a teammate's.
          this.tone('sine', 1320, 1300, 0.6, ev.playerId === localId ? 0.16 : 0.07, 0.005);
          this.tone('sine', 1980, 1950, 0.4, ev.playerId === localId ? 0.08 : 0.035, 0.005);
          break;
        case 'shadowstep':
          // A Rogue's Shadowstep (the builds pass): a short breathy whoosh, falling, softer for a teammate's.
          this.noiseBurst('bandpass', 2400, 600, 2, 0.22, ev.playerId === localId ? 0.14 : 0.06);
          break;
        case 'rooted':
          // A Ranger's Thornshot roots (the builds pass): a woody creak and a rustle, softer for a teammate's.
          this.tone('triangle', 180, 120, 0.25, ev.playerId === localId ? 0.12 : 0.05, 0.005);
          this.noiseBurst('bandpass', 1800, 900, 3, 0.2, ev.playerId === localId ? 0.08 : 0.035);
          break;
        case 'smokeBomb':
          // A Smoke Bomb: a soft pop and a long hiss.
          this.tone('sine', 300, 120, 0.12, ev.playerId === localId ? 0.1 : 0.04, 0.003);
          this.noiseBurst('lowpass', 2000, 500, 1, 0.8, ev.playerId === localId ? 0.08 : 0.03);
          break;
        case 'galeStep':
          // Gale Step's second roll: a quick rising gust, softer for a teammate's.
          this.noiseBurst('bandpass', 700, 2600, 1.5, 0.22, ev.playerId === localId ? 0.12 : 0.05);
          break;
        case 'blink':
          // A Warlock's Shadow Swap (the builds pass): a hollow thud under the Blink's shimmer as the two trade places.
          // A Druid's Wild Growth: a soft rustle of leaves where they stood.
          if (ev.grove) this.noiseBurst('bandpass', 1800, 3400, 2, 0.35, ev.playerId === localId ? 0.08 : 0.03);
          // A Sorcerer's Elemental Step: a low whoosh as the trail catches along the way.
          if (ev.trail) this.noiseBurst('lowpass', 900, 300, 1, 0.4, ev.playerId === localId ? 0.1 : 0.04);
          if (!ev.swap) break;
          this.tone('sine', 140, 60, 0.25, ev.playerId === localId ? 0.14 : 0.05, 0.005);
          break;
        case 'hexed':
          // A Warlock's hex takes (the builds pass): a low falling murmur, only for the Warlock.
          if (ev.playerId !== localId) break;
          this.tone('sawtooth', 220, 110, 0.22, 0.03, 0.01);
          this.noiseBurst('lowpass', 700, 250, 1, 0.2, 0.04);
          break;
        case 'venom':
          // Venom Volley takes (the builds pass): a short wet hiss, rising a little with the stacks, only for the Assassin.
          if (ev.playerId !== localId) break;
          this.noiseBurst('bandpass', 1400 + ev.stacks * 160, 700, 4, 0.16, 0.06);
          break;
        case 'attune': {
          // Attunement: a voice an element, softer for a teammate's. Fire a dull whump, Frost a glassy tick, Earth a thud, Air a crackle.
          const v = ev.playerId === localId ? 1 : 0.4;
          if (ev.element === 'fire' && ev.radius > 0) this.noiseBurst('lowpass', 900, 200, 1, 0.25, 0.1 * v);
          else if (ev.element === 'frost') this.tone('triangle', 1900, 2400, 0.08, 0.03 * v, 0.002);
          else if (ev.element === 'earth') this.tone('sine', 140, 70, 0.14, 0.07 * v, 0.003);
          else if (ev.element === 'air') this.noiseBurst('highpass', 3000, 6000, 1, 0.1, 0.06 * v);
          break;
        }
        case 'stormChain':
          // Storm Volley's arc: a short electric crackle, softer for a teammate's.
          this.noiseBurst('highpass', 3000, 6000, 1, 0.12, ev.playerId === localId ? 0.1 : 0.04);
          this.tone('square', 220, 90, 0.08, ev.playerId === localId ? 0.03 : 0.012, 0.002);
          break;
        case 'scoutMarked':
          // A Scout's arrow marks (the builds pass): a high airy ping, only for the Scout who marked it.
          if (ev.playerId !== localId) break;
          this.tone('sine', 1760, 2200, 0.1, 0.05, 0.003);
          break;
        case 'shadowPrimed':
          // From the shadows: a low hush and a soft tick, only for the Rogue whose next hit is now a crit.
          if (ev.playerId !== localId) break;
          this.noiseBurst('lowpass', 900, 300, 1, 0.25, 0.08);
          this.tone('triangle', 880, 1100, 0.12, 0.06, 0.005);
          break;
        case 'bloom':
          // A Druid's bolt heals in passing (the builds pass): a soft rising chime, for the Druid and whoever it healed.
          if (ev.playerId !== localId && ev.healedId !== localId) break;
          this.tone('sine', 880, 1320, 0.25, 0.06, 0.01);
          break;
        case 'holyPulse':
          // Bulwark's pulse on a Paladin's perfect parry: a rising chord, louder when it healed someone.
          this.tone('sine', 660, 990, 0.5, ev.healed > 0 ? 0.14 : 0.07, 0.01);
          this.tone('sine', 990, 1480, 0.45, ev.healed > 0 ? 0.08 : 0.04, 0.02);
          break;
        case 'chilled':
          // Caught in it: a brittle crack for the Chilled hero, quieter for a teammate.
          this.crackle(ev.playerId === localId ? 0.35 : 0.12);
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
          } else if (ev.combo === 'fan') {
            // A gust catching the fire: a rising whoosh.
            this.noiseBurst('bandpass', 400, 2200, 0.8, 0.45, 0.3);
          } else if (ev.combo === 'uproot') {
            // Roots tearing: a low crack and a woody snap.
            this.noiseBurst('bandpass', 900, 300, 0.6, 0.35, 0.25);
            this.tone('square', 180, 70, 0.22, 0.12, 0.002);
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
        case 'enemyRose':
          this.groan(false, 0.3);
          this.tone('sine', 180, 120, 0.5, 0.1, 0.05);
          break;
        case 'lootTaken':
          // Coin chinks; lumber and stone knock, wood lower than stone.
          if (ev.loot === 'coin') {
            this.tone('triangle', 1760, 2200, 0.12, 0.14, 0.005);
            setTimeout(() => this.tone('triangle', 2350, 2600, 0.1, 0.1, 0.005), 50);
          } else this.tone('sine', ev.loot === 'stone' ? 520 : 300, ev.loot === 'stone' ? 380 : 220, 0.18, 0.08, 0.005);
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

  /** Ready to play a sound now that isn't a fight's event (a menu's): unlocked, running, the volume set. */
  private ready(): boolean {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return false;
    this.master!.gain.value = tuning.hitFeel.sfxVolume * tuning.audio.masterVolume;
    return true;
  }

  /**
   * An item handled (Michael, 29 Oct): dropped at your feet, put in the stash or taken out, bought or
   * sold. It sounds like what it is made of: metal clanks, hide thumps, cloth rustles, wood knocks,
   * a trinket chimes, arrows rattle. Setting something down is a little heavier than picking it up,
   * and a two-handed weapon heavier still.
   */
  item(item: GearItem, putDown: boolean): void {
    if (!this.ready()) return;
    const entry = entryOf(item);
    const weight = (putDown ? 1 : 0.7) * (entry.shape.twoHanded ? 1.25 : 1);
    switch (entry.material.family) {
      case 'metal':
        this.tone('triangle', 1250, 1180, 0.32, 0.16 * weight, 0.002);
        this.tone('sine', 2730, 2650, 0.22, 0.08 * weight, 0.002);
        this.noiseBurst('highpass', 4000, 2500, 0.8, 0.05, 0.25 * weight);
        if (putDown) this.tone('sine', 180, 90, 0.12, 0.3 * weight);
        break;
      case 'hide':
        this.noiseBurst('lowpass', 700, 150, 0.7, 0.16, 0.6 * weight);
        this.tone('sine', 120, 70, 0.1, 0.25 * weight);
        break;
      case 'cloth':
        this.noiseBurst('bandpass', 2600, 1800, 0.9, 0.22, 0.22 * weight);
        this.noiseBurst('bandpass', 1500, 1100, 0.9, 0.14, 0.12 * weight);
        break;
      case 'wood':
        this.tone('triangle', 330, 260, 0.09, 0.4 * weight, 0.002);
        this.noiseBurst('bandpass', 900, 600, 3, 0.06, 0.4 * weight);
        break;
      case 'fletch':
        for (let i = 0; i < 3; i++) this.later(i * 0.035, () => this.noiseBurst('bandpass', 2400, 1900, 4, 0.025, 0.3 * weight));
        break;
      default:
        // Trinkets and dyes: a small glassy chime.
        this.tone('sine', 1760, 1740, 0.4, 0.12 * weight, 0.002);
        this.later(0.06, () => this.tone('sine', 2350, 2330, 0.35, 0.08 * weight, 0.002));
        break;
    }
  }

  /** Coins changing hands: a trade went through (bought or sold). A few bright clinks, a little apart. */
  coins(): void {
    if (!this.ready()) return;
    const clinks = [0, 0.06, 0.11, 0.19];
    clinks.forEach((at, i) =>
      this.later(at, () => {
        this.tone('sine', 2900 + i * 230, 2850 + i * 230, 0.18, 0.09, 0.001);
        this.tone('sine', 4700 + i * 310, 4650 + i * 310, 0.12, 0.05, 0.001);
      }),
    );
  }

  /** A building raised a tier (the upgrade ceremony; Michael, 30 Oct): a short rising horn call and a held chord. */
  fanfare(): void {
    if (!this.ready()) return;
    const call = [392, 523, 659];
    call.forEach((f, i) => this.later(i * 0.16, () => this.tone('sawtooth', f, f, 0.2, 0.06, 0.01)));
    this.later(0.5, () => {
      for (const f of [523, 659, 784]) this.tone('triangle', f, f * 1.003, 1.1, 0.08, 0.03);
      this.tone('sawtooth', 1046, 1046, 0.9, 0.035, 0.03);
    });
  }

  private later(seconds: number, fn: () => void): void {
    if (seconds <= 0) fn();
    else setTimeout(fn, seconds * 1000);
  }

  /** A door opening (Michael, 29 Oct): a low creak of the hinge, then the latch and the thump of it swinging to. */
  private door(level: number): void {
    this.tone('sawtooth', 150, 95, 0.35, 0.07 * level, 0.04);
    this.tone('triangle', 420, 310, 0.3, 0.05 * level, 0.03);
    this.noiseBurst('bandpass', 1800, 900, 2, 0.05, 0.3 * level);
    this.noiseBurst('lowpass', 900, 120, 0.7, 0.22, 0.45 * level);
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

  /** A telegraph's sound by its colour: the slice's growl for a strike, lower and longer for a heavy, a rising whistle for a projectile or charge, a shimmer for magic. */
  private tell(colour: TelegraphColour): void {
    if (colour === 'strike') this.growl();
    else if (colour === 'heavy') {
      this.tone('sawtooth', 70, 110, 0.5, 0.16, 0.08);
      this.rumble(0.2);
    } else if (colour === 'projectile') this.tone('triangle', 600, 1300, 0.28, 0.09, 0.02);
    else {
      this.tone('sine', 900, 1400, 0.45, 0.08, 0.1);
      this.tone('sine', 1350, 2100, 0.45, 0.05, 0.12);
    }
  }
}
