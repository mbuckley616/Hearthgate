import { STYLES, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { tavernHenchmen } from '@hearthgate/shared/game/villageSave';
import { HIRES } from '@hearthgate/shared/sim/henchman';
import { CATALOGUE } from '@hearthgate/shared/sim/catalogue';
import type { ActionFrame } from '../input/actions';
import { gearIconUrl } from './gearIcons';
import { roman } from './villageWords';

/** Each kit's colour on its card, as the mockup's: a sellsword's red, an archer's green, a mage's violet. */
const KIT_COLOUR: Record<Style, string> = { sword: '#e05a4a', bow: '#7ac860', staff: '#a07aff' };
const KIT_WORDS: Record<Style, string> = {
  sword: 'Closes in and keeps at it; guards when a blow is coming.',
  bow: 'Shoots from ten paces and steps back from anything close.',
  staff: 'Casts from eight paces; sets enemies up for combos.',
};

/** A weapon of the kit's for the card's picture, as the bag draws it. */
function kitIcon(kit: Style): string {
  for (const e of CATALOGUE.values()) {
    if (e.slot !== 'weapon' || e.shape.style !== kit || e.tier !== 1) continue;
    const url = gearIconUrl(e);
    if (url) return `<img class="pixel-art" src="${url}" alt="">`;
  }
  return '';
}

/**
 * Old Fenn's hiring board at the Rusted Stag (P10; Michael's mockup): the hires stand in the room
 * behind, each with a card along the bottom, its name, kit, picture and price. As many may follow the
 * party at once as the Tavern's tier allows. Keys and pad first: left and right choose, F or A hires,
 * X or Q lets one go, Esc, Tab or B leave. Clicking works too. The village's room says yes.
 */
export class HireScreen {
  private root = document.createElement('div');
  private body = document.createElement('div');
  private at = 0;
  private hired = new Set<Style>();
  private tier = 1;
  private coin = 0;
  private note = '';
  private repeat = 0;
  private lastDir = '';
  visible = false;

  constructor(
    private onHire: (kit: Style) => void,
    private onDismiss: (kit: Style) => void,
  ) {
    this.root.className = 'hire';
    const head = document.createElement('div');
    head.className = 'hire-head';
    head.innerHTML = '<h2>The Rusted Stag</h2><span>Hire companions</span>';
    this.root.append(head, this.body);
    this.root.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.root);
    this.setVisible(false);
  }

  /** Open with who is already in the party, the Tavern's tier and the coin the player holds. */
  open(hired: readonly Style[], tier: number, coin: number): void {
    this.update(hired, tier, coin);
    this.note = '';
    this.setVisible(true);
  }

  update(hired: readonly Style[], tier: number, coin: number): void {
    this.hired = new Set(hired);
    this.tier = tier;
    this.coin = coin;
    if (this.visible) this.render();
  }

  say(text: string): void {
    this.note = text;
    if (this.visible) this.render();
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
    if (v) this.render();
  }

  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    const x = actions.move.x + (Math.abs(actions.look.x) > 0.001 ? Math.sign(actions.look.x) : 0);
    const dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      this.at = (this.at + (dir === 'right' ? 1 : STYLES.length - 1)) % STYLES.length;
      this.render();
      this.repeat = dir === this.lastDir ? 0.15 : 0.35;
    }
    this.repeat -= dt;
    this.lastDir = dir;
    if (actions.pressed.has('interact')) this.hire(STYLES[this.at]);
    else if (actions.pressed.has('attack') || actions.pressed.has('ability1')) this.dismiss(STYLES[this.at]);
  }

  private hire(kit: Style): void {
    if (this.hired.has(kit)) return this.say(`${HIRES[kit].name} is with you already. X or Q lets them go.`);
    const room = tavernHenchmen(this.tier);
    if (this.hired.size >= room) return this.say(`A tier ${roman(this.tier)} tavern sends ${room} at a time. Raise it with Old Fenn for more.`);
    if (this.coin < tuning.village.hireCoin) return this.say(`${HIRES[kit].name} asks ${tuning.village.hireCoin} coin; you have ${this.coin}.`);
    this.onHire(kit);
  }

  private dismiss(kit: Style): void {
    if (this.hired.has(kit)) this.onDismiss(kit);
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-kit]');
    if (!el) return;
    const kit = el.dataset.kit as Style;
    this.at = STYLES.indexOf(kit);
    if (el.dataset.act === 'dismiss') this.dismiss(kit);
    else this.hire(kit);
    this.render();
  }

  private render(): void {
    const room = tavernHenchmen(this.tier);
    const cards = STYLES.map((kit, i) => {
      const h = HIRES[kit];
      const with_ = this.hired.has(kit);
      const action = with_
        ? `<button class="hire-act" data-kit="${kit}" data-act="dismiss">With you · let go <kbd>X</kbd></button>`
        : `<button class="hire-act" data-kit="${kit}">Hire · ${tuning.village.hireCoin} coin <kbd>F</kbd></button>`;
      return `<div class="hire-card${i === this.at ? ' chosen' : ''}${with_ ? ' with' : ''}" data-kit="${kit}">
          <b>${h.name}</b>
          <span class="hire-kit" style="color:${KIT_COLOUR[kit]}">${h.title}</span>
          <span class="hire-icon">${kitIcon(kit)}</span>
          <small>${KIT_WORDS[kit]}</small>
          ${action}
        </div>`;
    }).join('');
    this.body.innerHTML = `
      <div class="hire-cards">${cards}</div>
      <div class="hire-foot">
        <span>Tavern tier ${roman(this.tier)}: ${room} at a time · ${this.hired.size} with you · you have <b>${this.coin}</b> coin</span>
        <span class="store-note">${this.note}</span>
        <span class="muted">Left and right to choose · F or A: hire · X or Q: let go · Esc to leave · they follow you through every ring and take no loot</span>
      </div>`;
  }
}
