import { MODIFIERS } from '@hearthgate/shared/game/portalChoice';
import { tuning } from '@hearthgate/shared/config/tuning';
import type { FloorSpec } from '@hearthgate/shared/level/generate';
import { FINAL_WAVE } from '@hearthgate/shared/sim/run';
import type { SimEvent, SimState } from '@hearthgate/shared/sim/types';

const BANNER_MS = 2600;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Run UI: wave banners, the Warden's health bar, the run timer, the
 * antechamber prompt and the victory / defeat card. On a generated floor (T4)
 * the same pieces speak of rooms and floors instead of waves.
 */
/** How long "Dungeon cleared" stays once the ring home has opened. */
const CLEARED_AFTER_S = 4;

export class RunUi {
  private banner = document.createElement('div');
  private bannerTitle = document.createElement('div');
  private bannerSub = document.createElement('div');
  private bannerUntil = 0;
  private boss = document.createElement('div');
  private bossFill = document.createElement('div');
  private bossName = document.createElement('div');
  private timer = document.createElement('div');
  private prompt = document.createElement('div');
  /** "Dungeon cleared" in the corner after the Warden's fall on a floor, with the ring's count (Michael, 31 Oct). */
  private cleared = document.createElement('div');
  private end = document.createElement('div');
  private endTitle = document.createElement('div');
  private endBody = document.createElement('div');
  private again = document.createElement('div');
  /** The end card's way home on a generated floor (D10): a button, F or A. */
  private home = document.createElement('button');
  /** What the home button (and F, A) asks for; Game sends the server a 'home' message. */
  onHome: () => void = () => {};
  private now = 0;
  /** The generated floor this run is on, or null in the arena; and when it was entered (the prompt shows a while). */
  private floor: FloorSpec | null = null;
  private floorSince = 0;

  constructor() {
    this.banner.className = 'run-banner';
    this.bannerTitle.className = 'run-banner-title';
    this.bannerSub.className = 'run-banner-sub';
    this.banner.append(this.bannerSub, this.bannerTitle);

    this.boss.className = 'boss-bar';
    this.bossName.className = 'boss-name';
    this.bossName.textContent = 'The Warden';
    const track = document.createElement('div');
    track.className = 'boss-track';
    this.bossFill.className = 'boss-fill';
    const mark = document.createElement('div');
    mark.className = 'boss-mark';
    track.append(this.bossFill, mark);
    this.boss.append(this.bossName, track);

    this.timer.className = 'run-timer';
    this.prompt.className = 'run-prompt';
    this.prompt.textContent = 'Step through the gate when you are ready  ·  I for gear';

    this.end.className = 'run-end';
    const card = document.createElement('div');
    card.className = 'run-end-card';
    this.endTitle.className = 'run-end-title';
    this.endBody.className = 'run-end-body';
    this.again.className = 'run-end-again';
    this.home.className = 'run-end-home';
    this.home.type = 'button';
    this.home.innerHTML = 'Return to the village <kbd>F</kbd>';
    this.home.addEventListener('click', () => this.onHome());
    card.append(this.endTitle, this.endBody, this.again, this.home);
    this.end.appendChild(card);

    this.cleared.className = 'run-cleared';
    document.body.append(this.banner, this.boss, this.timer, this.prompt, this.end, this.cleared);
  }

  /** In the village (T3) there is no run: no banner, timer, prompt or end card. */
  hide(): void {
    this.banner.style.opacity = '0';
    for (const el of [this.boss, this.timer, this.prompt, this.end, this.cleared]) el.style.display = 'none';
  }

  setFloor(spec: FloorSpec | null): void {
    this.floor = spec;
    this.floorSince = this.now;
  }

  handle(events: SimEvent[]): void {
    if (this.floor) return this.handleFloor(events);
    for (const ev of events) {
      if (ev.kind === 'waveStart') this.showBanner(ev.boss ? 'Final wave' : `Wave ${ev.wave} of ${FINAL_WAVE}`, ev.title);
      else if (ev.kind === 'waveCleared' && ev.wave < FINAL_WAVE) this.showBanner('Wave cleared', `Catch your breath  +${Math.round(tuning.run.healOnWaveClear * 100)}% health`);
      else if (ev.kind === 'roar') this.showBanner('The Warden roars', 'It calls for help');
      else if (ev.kind === 'reinforcements') this.showBanner('More are coming', 'Reinforcements');
    }
  }

  private handleFloor(events: SimEvent[]): void {
    for (const ev of events) {
      if (ev.kind === 'waveStart') this.showBanner(ev.boss ? 'The last hall' : tuning.dungeon.shutDoors ? `Room ${ev.wave}  ·  the doors are shut` : `Room ${ev.wave}`, ev.title);
      else if (ev.kind === 'waveCleared') {
        // No heal after a room since D7, so the banner names none unless the panel turns it back on.
        const heal = Math.round(tuning.dungeon.healOnClear * 100);
        this.showBanner('Room cleared', heal > 0 ? `+${heal}% health` : 'Potions and revives are the only heal');
      }
      else if (ev.kind === 'rested') {
        // Michael, 31 Oct: the rest room is the way out; what the run carries banks only at home.
        const heal = Math.round(tuning.dungeon.restHeal * 100);
        const head = tuning.loop.bankAtRest ? 'Your finds are banked' : heal > 0 ? `+${heal}% health  ·  nothing is banked yet` : 'A way out  ·  nothing is banked yet';
        this.showBanner(head, `Gold ring home banks the run  ·  violet ring deeper, for ${Math.round(tuning.loop.depthBonus * 100)}% more, all of it at stake`);
      }
      else if (ev.kind === 'roar') this.showBanner('The Warden roars', 'It calls for help');
      else if (ev.kind === 'reinforcements') this.showBanner('More are coming', 'Reinforcements');
    }
  }

  update(sim: SimState, dt: number, role: 'host' | 'client', carried = 0): void {
    this.now += dt;
    if (this.floor) return this.updateFloor(sim, this.floor, carried);
    const r = sim.run;
    this.banner.style.opacity = this.now < this.bannerUntil ? '1' : '0';

    const boss = sim.enemies.find((e) => e.id === r.bossId && e.ai !== 'dead');
    this.boss.style.display = boss && r.phase === 'wave' ? 'block' : 'none';
    if (boss) {
      this.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
      this.bossFill.classList.toggle('staggered', boss.ai === 'stagger');
      this.bossName.textContent = boss.phase >= 2 ? 'The Warden — enraged' : 'The Warden';
    }

    const running = r.phase === 'intro' || r.phase === 'wave' || r.phase === 'rest';
    this.timer.style.display = running ? 'block' : 'none';
    if (running) this.timer.textContent = `${formatTime(r.elapsed)}  ·  wave ${Math.max(1, r.wave)}/${FINAL_WAVE}`;

    this.prompt.style.display = r.phase === 'ante' ? 'block' : 'none';
    if (r.phase === 'ante') {
      // Co-op: someone's gone in and the gate is waiting for the rest.
      this.prompt.textContent =
        r.gateWait >= 0
          ? `Waiting for the party  ·  the gate closes in ${Math.max(0, Math.ceil(tuning.run.gateWaitMs / 1000 - r.gateWait))}`
          : 'Step through the gate when you are ready  ·  I for gear';
    }
    this.again.textContent =
      role === 'host' ? 'Step into the ring by the gate to go home  ·  F (or A) to run again  ·  I for gear' : 'Waiting for the host to start again  ·  I for gear';

    const over = r.phase === 'won' || r.phase === 'lost';
    this.end.style.display = over ? 'flex' : 'none';
    this.home.style.display = 'none';
    if (over) {
      this.endTitle.textContent = r.phase === 'won' ? 'Victory' : 'Defeated';
      this.endTitle.className = `run-end-title ${r.phase}`;
      this.endBody.textContent =
        r.phase === 'won' ? `The Warden falls. Run time ${formatTime(r.elapsed)}.` : `Fell on wave ${r.wave} of ${FINAL_WAVE} after ${formatTime(r.elapsed)}.`;
    }
  }

  private updateFloor(sim: SimState, spec: FloorSpec, carried: number): void {
    const r = sim.run;
    this.banner.style.opacity = this.now < this.bannerUntil ? '1' : '0';
    const boss = sim.enemies.find((e) => e.id === r.bossId && e.ai !== 'dead');
    this.boss.style.display = boss && r.phase === 'wave' ? 'block' : 'none';
    if (boss) {
      this.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
      this.bossFill.classList.toggle('staggered', boss.ai === 'stagger');
      this.bossName.textContent = boss.phase >= 2 ? 'The Warden — enraged' : 'The Warden';
    }
    const where = `floor ${spec.floor} of ${spec.floors}${spec.modifier ? `  ·  ${MODIFIERS[spec.modifier].name}` : ''}`;
    this.timer.style.display = 'block';
    // What a wipe would cost (P1): finds carried since the run left the village (Michael, 31 Oct),
    // and the party's picked-up lumber, stone and coin with the floors before's, lost the same way.
    const fl = sim.floor;
    const f = fl ? { coin: fl.found.coin + (fl.purse?.coin ?? 0), lumber: fl.found.lumber + (fl.purse?.lumber ?? 0), stone: fl.found.stone + (fl.purse?.stone ?? 0) } : null;
    const found = f ? [f.coin ? `${f.coin} coin` : '', f.lumber ? `${f.lumber} lumber` : '', f.stone ? `${f.stone} stone` : ''].filter(Boolean).join(', ') : '';
    const risk = [carried > 0 ? `${carried} unbanked` : '', found].filter(Boolean).join(', ');
    this.timer.textContent = `${formatTime(r.elapsed)}  ·  ${where}${risk ? `  ·  carrying ${risk}` : ''}`;
    // The way on, for a while after arriving; the doors' wait whenever one is holding for the party.
    const waiting = r.phase === 'ante' && r.gateWait >= 0;
    const arriving = r.phase === 'ante' && this.now - this.floorSince < 8;
    this.prompt.style.display = waiting || arriving ? 'block' : 'none';
    if (waiting) this.prompt.textContent = `Waiting for the party  ·  the doors close in ${Math.max(0, Math.ceil(tuning.run.gateWaitMs / 1000 - r.gateWait))}`;
    else if (arriving) this.prompt.textContent = `${where[0].toUpperCase()}${where.slice(1)}  ·  ${spec.floor >= spec.floors ? 'the Warden waits at the far end' : 'a place to rest at the far end'}  ·  M for the map`;
    // A win is a line in the corner, not a card over the hall (Michael, 31 Oct): the drops are there
    // to pick up, the gold ring opens after a count, and the run's summary waits for the village.
    const won = r.phase === 'won';
    const ringIn = won ? Math.max(0, tuning.loop.homeRingDelayS - r.timer) : 0;
    const showCleared = won && (ringIn > 0 || r.timer - tuning.loop.homeRingDelayS < CLEARED_AFTER_S);
    this.cleared.style.display = showCleared ? 'block' : 'none';
    if (showCleared) this.cleared.textContent = ringIn > 0 ? `Dungeon cleared  ·  ${formatTime(r.elapsed)}  ·  the way home opens in ${Math.ceil(ringIn)}` : `Dungeon cleared  ·  the gold ring home is open`;
    const over = r.phase === 'lost';
    this.end.style.display = over ? 'flex' : 'none';
    this.home.style.display = over ? '' : 'none';
    if (over) {
      // A wipe (D10): the party lies where it fell, and each player goes home from here.
      const solo = sim.players.length <= 1;
      this.endTitle.textContent = r.phase === 'won' ? 'Victory' : solo ? 'You died' : 'Your party was defeated';
      this.endTitle.className = `run-end-title ${r.phase}`;
      this.endBody.textContent = r.phase === 'won' ? `The Warden falls. Run time ${formatTime(r.elapsed)}.` : `Fell on ${where} after ${formatTime(r.elapsed)}.`;
      this.again.textContent = r.phase === 'won' ? 'Step into the gold ring to go home together, or' : '';
    }
  }

  private showBanner(sub: string, title: string): void {
    this.bannerSub.textContent = sub;
    this.bannerTitle.textContent = title;
    this.bannerUntil = this.now + BANNER_MS / 1000;
  }
}
