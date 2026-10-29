import { BUILDINGS, type BuildingId, type VillageView } from '@hearthgate/shared/game/villageSave';

const NAMES: Record<BuildingId, string> = { shrine: 'Shrine', store: 'Store', storehouse: 'Storehouse', tavern: 'Tavern' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Whose village this is and what it holds (P2), in the top-left corner while in one: the host's
 * lumber and stone and each building's tier, the same for everyone there, so a visitor watches the
 * host's village grow on the run they shared.
 */
export class VillagePanel {
  private readonly el = document.createElement('div');

  constructor() {
    this.el.className = 'hud-village';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  show(village: { view: VillageView; host: string; yours: boolean } | null): void {
    if (!village) {
      this.el.style.display = 'none';
      return;
    }
    const v = village.view;
    const whose = village.yours ? 'Your village' : `${escape(village.host) || 'The host'}’s village`;
    const tiers = BUILDINGS.map((b) => `${NAMES[b]} ${ROMAN[v.tiers[b]] ?? v.tiers[b]}`).join('  ·  ');
    this.el.innerHTML = `<b>${whose}</b><span>${v.lumber} lumber  ·  ${v.stone} stone</span><small>${tiers}</small>`;
    this.el.style.display = 'block';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
