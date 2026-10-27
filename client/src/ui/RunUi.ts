import { tuning } from '@hearthgate/shared/config/tuning';
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
 * antechamber prompt and the victory / defeat card.
 */
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
  private end = document.createElement('div');
  private endTitle = document.createElement('div');
  private endBody = document.createElement('div');
  private again = document.createElement('div');
  private now = 0;

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
    card.append(this.endTitle, this.endBody, this.again);
    this.end.appendChild(card);

    document.body.append(this.banner, this.boss, this.timer, this.prompt, this.end);
  }

  /** In the village (T3) there is no run: no banner, timer, prompt or end card. */
  hide(): void {
    this.banner.style.opacity = '0';
    for (const el of [this.boss, this.timer, this.prompt, this.end]) el.style.display = 'none';
  }

  handle(events: SimEvent[]): void {
    for (const ev of events) {
      if (ev.kind === 'waveStart') this.showBanner(ev.boss ? 'Final wave' : `Wave ${ev.wave} of ${FINAL_WAVE}`, ev.title);
      else if (ev.kind === 'waveCleared' && ev.wave < FINAL_WAVE) this.showBanner('Wave cleared', `Catch your breath  +${Math.round(tuning.run.healOnWaveClear * 100)}% health`);
      else if (ev.kind === 'roar') this.showBanner('The Warden roars', 'It calls for help');
      else if (ev.kind === 'reinforcements') this.showBanner('More are coming', 'Reinforcements');
    }
  }

  update(sim: SimState, dt: number, role: 'host' | 'client'): void {
    this.now += dt;
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
    if (over) {
      this.endTitle.textContent = r.phase === 'won' ? 'Victory' : 'Defeated';
      this.endTitle.className = `run-end-title ${r.phase}`;
      this.endBody.textContent =
        r.phase === 'won' ? `The Warden falls. Run time ${formatTime(r.elapsed)}.` : `Fell on wave ${r.wave} of ${FINAL_WAVE} after ${formatTime(r.elapsed)}.`;
    }
  }

  private showBanner(sub: string, title: string): void {
    this.bannerSub.textContent = sub;
    this.bannerTitle.textContent = title;
    this.bannerUntil = this.now + BANNER_MS / 1000;
  }
}
