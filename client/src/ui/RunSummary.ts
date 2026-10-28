/** What one run, village to village, came to (P1): the browser adds up the server's banked and lost events. */
export interface RunTally {
  deepest: number;
  floors: number;
  banked: number;
  lost: number;
  coin: number;
  lumber: number;
  stone: number;
  /** Whether this browser opened the village the run set out from, and so kept its lumber and stone. */
  ownVillage: boolean;
}

export function newTally(): RunTally {
  return { deepest: 0, floors: 0, banked: 0, lost: 0, coin: 0, lumber: 0, stone: 0, ownVillage: false };
}

/**
 * The card that greets a party home from a run (P1): how deep they went, what was banked and what was
 * lost, the coin each earned and what the village gained. F or A, Escape or the button closes it.
 */
export class RunSummary {
  private readonly root = document.createElement('div');
  private readonly body = document.createElement('div');
  visible = false;

  constructor() {
    this.root.className = 'run-summary';
    const card = document.createElement('div');
    card.className = 'run-summary-card';
    const title = document.createElement('div');
    title.className = 'run-summary-title';
    title.textContent = 'Home again';
    const close = document.createElement('button');
    close.className = 'run-summary-close';
    close.textContent = 'Carry on  ·  F';
    close.addEventListener('click', () => this.hide());
    card.append(title, this.body, close);
    this.root.appendChild(card);
    document.body.appendChild(this.root);
    this.hide();
  }

  show(t: RunTally): void {
    const row = (k: string, v: string, cls = '') => `<div class="run-summary-row ${cls}"><span>${k}</span><b>${v}</b></div>`;
    const village = t.ownVillage
      ? row('Your village', `+${t.lumber} lumber  ·  +${t.stone} stone`)
      : row('The host’s village', `+${t.lumber} lumber  ·  +${t.stone} stone`, 'muted');
    this.body.innerHTML =
      row('Deepest floor', t.floors ? `${t.deepest} of ${t.floors}` : `${t.deepest}`) +
      row('Finds banked', `${t.banked}`) +
      (t.lost > 0 ? row('Finds lost in a wipe', `${t.lost}`, 'lost') : '') +
      row('Coin', `+${t.coin}`) +
      village;
    this.visible = true;
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }
}
