import type { VillageView } from '@hearthgate/shared/game/villageSave';

/**
 * Whose village this is and what it holds (P2), the same for everyone there, so a visitor watches the
 * host's village grow on the run they shared. One line in the top-right corner (P14; Michael, 29 Oct):
 * the buildings' tiers and what the next costs are on the village map, M or Start.
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
      this.hide();
      return;
    }
    const v = village.view;
    const whose = village.yours ? 'Your village' : `${escape(village.host) || 'The host'}’s village`;
    this.el.innerHTML = `<b>${whose}</b><span>${v.lumber} lumber  ·  ${v.stone} stone</span><kbd>M</kbd>`;
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
