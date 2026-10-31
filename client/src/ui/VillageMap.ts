import { tuning } from '@hearthgate/shared/config/tuning';
import { BUILDINGS, tierGives, upgradeCost, type BuildingId, type VillageView } from '@hearthgate/shared/game/villageSave';
import type { VillageDef } from '@hearthgate/shared/level/village';
import type { ActionFrame } from '../input/actions';
import { BUILDING_NAMES, capital, roman } from './villageWords';

export interface VillageMapData {
  def: VillageDef;
  /** Half the square's side, metres. */
  half: number;
  view: VillageView;
  yours: boolean;
  host: string;
  coin: number;
  party: { x: number; z: number; me: boolean }[];
}

/**
 * The village from above (P14; Michael, 29 Oct): M or Start in the village. The square as a plan,
 * each building with its tier, and beside it the one chosen: what it gives, what the next tier brings
 * and costs against what the village holds, and whose keeper builds it. Building stays at the keeper
 * (P11): this is for knowing what the next run is for without walking round. Any direction moves
 * between buildings; M, Start, Esc, Tab or B close it; a click on a building chooses it.
 */
export class VillageMap {
  private root = document.createElement('div');
  private plan = document.createElement('div');
  private side = document.createElement('div');
  private at = 0;
  private data: VillageMapData | null = null;
  private shown = '';
  private repeat = 0;
  private lastDir = '';
  visible = false;

  constructor(private onClose: () => void) {
    this.root.className = 'village-map';
    const card = document.createElement('div');
    card.className = 'village-map-card';
    const head = document.createElement('div');
    head.className = 'village-map-head';
    head.innerHTML = '<h2>The village</h2><span>Arrows or stick: choose a building  ·  M, Start, Esc or B to close</span>';
    const body = document.createElement('div');
    body.className = 'village-map-body';
    this.plan.className = 'village-map-plan';
    this.side.className = 'village-map-side';
    body.append(this.plan, this.side);
    card.append(head, body);
    this.root.appendChild(card);
    this.plan.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<SVGElement>('[data-b]');
      if (!el) return;
      this.at = BUILDINGS.indexOf(el.dataset.b as BuildingId);
      this.render();
    });
    document.body.appendChild(this.root);
    this.root.style.display = 'none';
  }

  open(data: VillageMapData): void {
    this.visible = true;
    this.root.style.display = 'flex';
    this.shown = '';
    this.update(data);
  }

  close(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }

  /** Per frame while open: redrawn only when something it shows has changed. */
  update(data: VillageMapData | null): void {
    if (!data) return;
    this.data = data;
    this.render();
  }

  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    // M or Start again, or B on a pad (the dodge button).
    if (actions.pressed.has('map') || actions.pressed.has('dodge')) return this.onClose();
    const x = actions.move.x + (Math.abs(actions.look.x) > 0.001 ? Math.sign(actions.look.x) : 0);
    const y = actions.move.y + (Math.abs(actions.look.y) > 0.001 ? Math.sign(actions.look.y) : 0);
    const fwd = x > 0.5 || y < -0.5 || actions.pressed.has('zoomOut');
    const back = x < -0.5 || y > 0.5 || actions.pressed.has('zoomIn');
    const dir = fwd ? 'next' : back ? 'prev' : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      const n = BUILDINGS.length;
      this.at = (this.at + (dir === 'next' ? 1 : n - 1)) % n;
      this.render();
      this.repeat = dir === this.lastDir ? 0.2 : 0.4;
    }
    this.repeat -= dt;
    this.lastDir = dir;
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    // Party positions move every frame; rounding keeps the redraws to real steps.
    const key = JSON.stringify([this.at, d.view.lumber, d.view.stone, d.view.tiers, d.coin, d.yours, d.party.map((p) => [Math.round(p.x * 2), Math.round(p.z * 2), p.me])]);
    if (key === this.shown) return;
    this.shown = key;
    const chosen = BUILDINGS[this.at];
    const h = d.half;
    const buildings = d.def.buildings
      .map((b) => {
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        const tier = d.view.tiers[b.id];
        return `<g class="vm-building${b.id === chosen ? ' chosen' : ''}" data-b="${b.id}">
          <rect x="${b.minX}" y="${b.minZ}" width="${b.maxX - b.minX}" height="${b.maxZ - b.minZ}" rx="0.4"/>
          <text x="${cx}" y="${cz - 0.4}" class="vm-name">${BUILDING_NAMES[b.id]}</text>
          <text x="${cx}" y="${cz + 1.6}" class="vm-tier">${tier < 1 ? 'plot' : roman(tier)}</text>
        </g>`;
      })
      .join('');
    const p = d.def.portal;
    const party = d.party.map((m) => `<circle class="vm-hero${m.me ? ' me' : ''}" cx="${m.x}" cy="${m.z}" r="${m.me ? 0.9 : 0.7}"/>`).join('');
    this.plan.innerHTML = `<svg viewBox="${-h - 1} ${-h - 1} ${2 * h + 2} ${2 * h + 2}" role="img" aria-label="The village from above">
        <rect class="vm-ground" x="${-h}" y="${-h}" width="${2 * h}" height="${2 * h}"/>
        <circle class="vm-ring" cx="${p.x}" cy="${p.z}" r="${p.radius}"/>
        <circle class="vm-well" cx="${d.def.well.x}" cy="${d.def.well.z}" r="${d.def.well.radius}"/>
        ${buildings}${party}
      </svg>`;
    this.side.innerHTML = this.details(chosen, d);
  }

  private details(b: BuildingId, d: VillageMapData): string {
    const tier = d.view.tiers[b];
    const keeper = d.def.villagers.find((v) => v.building === b)?.name ?? 'its keeper';
    const now = tier < 1 ? `<p>${capital(tierGives(b, tier))}.</p>` : `<p>Tier <b>${roman(tier)}</b>: ${tierGives(b, tier)}.</p>`;
    const stock = `<p class="vm-stock">The village holds <b>${d.view.lumber}</b> lumber and <b>${d.view.stone}</b> stone; you carry <b>${d.coin}</b> coin.</p>`;
    if (tier >= tuning.village.maxTier) return `<h3>${BUILDING_NAMES[b]}</h3>${now}<p>As high as it goes for now.</p>${stock}`;
    const c = upgradeCost(tier + 1);
    const need = (have: number, cost: number, what: string) => `<li class="${have >= cost ? 'ok' : 'short'}">${cost} ${what}${have >= cost ? '' : ` <small>(${cost - have} more)</small>`}</li>`;
    const ready = d.view.lumber >= c.lumber && d.view.stone >= c.stone && d.coin >= c.coin;
    const who = !d.yours ? `Only ${d.host || 'the host'} can build here.` : ready ? `Ready: see ${keeper} to build it.` : `Built at ${keeper}, once there is enough.`;
    return `<h3>${BUILDING_NAMES[b]}</h3>${now}
      <p>Tier <b>${roman(tier + 1)}</b> brings ${tierGives(b, tier + 1)}.</p>
      <ul class="vm-cost">${need(d.view.lumber, c.lumber, 'lumber')}${need(d.view.stone, c.stone, 'stone')}${need(d.coin, c.coin, 'coin')}</ul>
      <p class="vm-who${ready && d.yours ? ' ready' : ''}">${capital(who)}</p>${stock}`;
  }
}
