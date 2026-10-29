import { buyPrice, sellPrice } from '@hearthgate/shared/game/store';
import { entryOf, type GearItem } from '@hearthgate/shared/sim/catalogue';
import type { ActionFrame } from '../input/actions';
import type { Profile } from '../game/Profile';
import { gearIconUrl } from './gearIcons';
import { gearLine, nameOf } from './gearText';

type Column = 'shelf' | 'bag';

/**
 * The General Store (P5): Aldous's shelves today on the left, the bag on the right, each with its
 * price. Keyboard and pad first, like the hero screen (rule 4): up and down to choose, left and right
 * to change side, F or A to buy or sell, Esc, Tab or B to leave. Clicking works too. Game asks the
 * village's room; the bag and the coin change when the room answers.
 */
export class StoreScreen {
  private root = document.createElement('div');
  private body = document.createElement('div');
  private col: Column = 'shelf';
  private row = 0;
  private repeat = 0;
  private lastDir = '';
  private stock: GearItem[] = [];
  private note = '';
  visible = false;

  constructor(
    private profile: Profile,
    private onBuy: (item: GearItem) => void,
    private onSell: (item: GearItem) => void,
  ) {
    this.root.className = 'equip store';
    const card = document.createElement('div');
    card.className = 'equip-card';
    const head = document.createElement('div');
    head.className = 'equip-head';
    head.innerHTML = '<h2>Aldous’s General Store</h2><span>Esc, Tab or B to leave</span>';
    card.append(head, this.body);
    this.root.appendChild(card);
    this.root.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.root);
    this.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
    if (v) {
      this.note = '';
      this.render();
    }
  }

  /** Today's shelves, as the village's room last sent them. */
  setStock(stock: readonly GearItem[]): void {
    this.stock = [...stock];
    if (this.visible) this.render();
  }

  /** Something to say under the lists (a purchase, a sale, why one cannot be made). */
  say(text: string): void {
    this.note = text;
    if (this.visible) this.render();
  }

  refresh(): void {
    if (this.visible) this.render();
  }

  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    const x = actions.move.x + (Math.abs(actions.look.x) > 0.001 ? Math.sign(actions.look.x) : 0);
    const y = actions.move.y + (Math.abs(actions.look.y) > 0.001 ? Math.sign(actions.look.y) : 0);
    const dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : Math.abs(y) > 0.5 ? (y > 0 ? 'up' : 'down') : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      if (dir === 'left') this.col = 'shelf';
      else if (dir === 'right') this.col = 'bag';
      else this.row += dir === 'down' ? 1 : -1;
      this.clamp();
      this.render();
      this.repeat = dir === this.lastDir ? 0.12 : 0.35;
    }
    this.repeat -= dt;
    this.lastDir = dir;
    if (actions.pressed.has('interact')) this.act();
  }

  private bagItems(): GearItem[] {
    return this.profile.data.bag.filter((i): i is GearItem => !!i);
  }

  private clamp(): void {
    const n = this.col === 'shelf' ? this.stock.length : this.bagItems().length;
    this.row = Math.max(0, Math.min(Math.max(0, n - 1), this.row));
  }

  private act(): void {
    this.clamp();
    if (this.col === 'shelf') {
      const item = this.stock[this.row];
      if (!item) return;
      const price = buyPrice(item);
      if (this.profile.data.coin < price) return this.say(`${nameOf(item)} costs ${price} coin; you have ${this.profile.data.coin}.`);
      if (this.profile.data.bag.every((i) => i)) return this.say('Your bag is full: sell something first.');
      this.onBuy(item);
    } else {
      const item = this.bagItems()[this.row];
      if (item) this.onSell(item);
    }
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-col]');
    if (!el) return;
    this.col = el.dataset.col as Column;
    this.row = Number(el.dataset.row);
    this.act();
    this.render();
  }

  private rowHtml(item: GearItem, i: number, col: Column, price: number, verb: string): string {
    const e = entryOf(item);
    const icon = gearIconUrl(e);
    const chosen = this.col === col && this.row === i ? ' chosen' : '';
    const cant = col === 'shelf' && price > this.profile.data.coin ? ' dear' : '';
    return `<button class="store-row ${item.rarity}${chosen}${cant}" data-col="${col}" data-row="${i}">
        ${icon ? `<img class="pixel-art gear-icon" src="${icon}" alt="">` : '<span class="gear-swatch"></span>'}
        <span class="store-name"><b class="item-name ${item.rarity}">${nameOf(item)}</b><small>${gearLine(item)}</small></span>
        <span class="store-price">${verb} ${price}</span>
      </button>`;
  }

  private render(): void {
    this.clamp();
    const shelf = this.stock.length
      ? this.stock.map((it, i) => this.rowHtml(it, i, 'shelf', buyPrice(it), 'Buy')).join('')
      : '<div class="muted">Sold out until tomorrow.</div>';
    const bag = this.bagItems();
    const mine = bag.length ? bag.map((it, i) => this.rowHtml(it, i, 'bag', sellPrice(it), 'Sell')).join('') : '<div class="muted">Nothing in your bag to sell.</div>';
    this.body.innerHTML = `
      <div class="store-coin">You have <b>${this.profile.data.coin}</b> coin</div>
      <div class="store-cols">
        <section><h3>On the shelves today</h3>${shelf}</section>
        <section><h3>Your bag</h3>${mine}</section>
      </div>
      <div class="store-note">${this.note}</div>
      <div class="muted talent-note">Up and down to choose · left and right to change side · F or A: buy or sell · new stock each day, more as the store grows</div>`;
    this.body.querySelector('.store-row.chosen')?.scrollIntoView({ block: 'nearest' });
  }
}
