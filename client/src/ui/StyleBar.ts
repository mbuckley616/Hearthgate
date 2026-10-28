import { STYLES, type Style } from '@hearthgate/shared/config/tuning';
import { levelFor, levelProgress } from '@hearthgate/shared/sim/gear';
import { ICONS, iconUrl } from './pixelArt';
import { pointsEarned, pointsSpent, type TalentRanks } from '@hearthgate/shared/sim/talents';

const LABELS: Record<Style, string> = { sword: 'Knight', bow: 'Archer', staff: 'Mage' };

/** Active-hero indicator (the brief's HUD "active style icon"), with each hero's level and XP. */
export class StyleBar {
  private root = document.createElement('div');
  private chips = new Map<Style, { chip: HTMLDivElement; level: HTMLSpanElement; xp: HTMLDivElement }>();
  private shown: Style | null = null;

  constructor() {
    this.root.className = 'style-bar';
    STYLES.forEach((style) => {
      const chip = document.createElement('div');
      chip.className = 'style-chip';
      // No key on the chip (C3): the weapon is chosen on the hero screen, not swapped mid-fight.
      chip.innerHTML = `<img class="pixel-art style-icon" src="${iconUrl(ICONS[style])}" alt=""><span class="style-name">${LABELS[style]}</span>`;
      chip.title = LABELS[style];
      const level = document.createElement('span');
      level.className = 'style-level';
      const bar = document.createElement('div');
      bar.className = 'style-xp';
      const xp = document.createElement('div');
      bar.appendChild(xp);
      chip.append(level, bar);
      this.chips.set(style, { chip, level, xp });
      this.root.appendChild(chip);
    });
    document.body.append(this.root);
  }

  update(style: Style, xp: Record<Style, number>, talents: Record<Style, TalentRanks>): void {
    if (style !== this.shown) {
      for (const [s, c] of this.chips) c.chip.classList.toggle('active', s === style);
      this.shown = style;
    }
    for (const [s, c] of this.chips) {
      const unspent = pointsEarned(xp[s]) - pointsSpent(talents[s]);
      c.level.textContent = `Lv ${levelFor(xp[s])}${unspent > 0 ? ' +' : ''}`;
      c.level.title = unspent > 0 ? `${unspent} talent point${unspent > 1 ? 's' : ''} to spend (I between runs)` : '';
      c.xp.style.width = `${Math.round(levelProgress(xp[s]) * 100)}%`;
    }
  }
}
