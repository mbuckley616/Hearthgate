import { tuning } from '@hearthgate/shared/config/tuning';
import type { PlayerState, SimState } from '@hearthgate/shared/sim/types';

export interface PartyActions {
  /** Host: open a room and return its code. */
  invite: () => Promise<string>;
  /** Save the player's name. */
  rename: (name: string) => void;
  /** Leave a dead co-op session for solo. */
  playSolo: () => void;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * Co-op UI: the party panel on the pause card (name, invite link, status),
 * the other heroes' health frames, and the revive prompt.
 */
export class PartyUi {
  /** Goes inside the pause overlay card. */
  readonly panel = document.createElement('div');
  private status = document.createElement('div');
  private link = document.createElement('div');
  private inviteBtn = document.createElement('button');
  private soloBtn = document.createElement('button');
  private frames = document.createElement('div');
  private prompt = document.createElement('div');
  private promptText = document.createElement('div');
  private promptFill = document.createElement('div');
  private endedBanner = document.createElement('div');
  private shownFrames = '';

  constructor(
    name: string,
    private readonly actions: PartyActions,
  ) {
    this.panel.className = 'party-panel';
    // Clicks here mustn't fall through to "click to play".
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    const nameRow = document.createElement('label');
    nameRow.className = 'party-name';
    nameRow.innerHTML = '<span>Your name</span>';
    const input = document.createElement('input');
    input.maxLength = 16;
    input.placeholder = 'Player';
    input.value = name;
    input.addEventListener('change', () => this.actions.rename(input.value.trim().slice(0, 16)));
    nameRow.appendChild(input);

    this.inviteBtn.className = 'party-btn';
    this.inviteBtn.textContent = 'Invite friends';
    this.inviteBtn.addEventListener('click', () => this.invite());
    this.soloBtn.className = 'party-btn';
    this.soloBtn.textContent = 'Play solo instead';
    this.soloBtn.addEventListener('click', () => this.actions.playSolo());
    this.link.className = 'party-link';
    this.status.className = 'party-status';

    const title = document.createElement('div');
    title.className = 'party-title';
    title.textContent = 'Co-op';
    // On the server every player may invite, and anyone whose connection ended may start afresh.
    this.panel.append(title, nameRow, this.status, this.link, this.inviteBtn, this.soloBtn);
    this.soloBtn.style.display = 'none';

    this.frames.className = 'party-frames';
    this.prompt.className = 'revive-prompt';
    this.promptFill.className = 'revive-fill';
    const track = document.createElement('div');
    track.className = 'revive-track';
    track.appendChild(this.promptFill);
    this.prompt.append(this.promptText, track);

    this.endedBanner.className = 'party-ended';
    document.body.append(this.frames, this.prompt, this.endedBanner);
  }

  /** Start hosting now (the title screen's "Host a party"). */
  inviteNow(): void {
    void this.invite();
  }

  private async invite(): Promise<void> {
    this.inviteBtn.disabled = true;
    try {
      const code = await this.actions.invite();
      const url = `${location.origin}${location.pathname}?join=${code}`;
      // A localhost link only works on this computer (fine for a two-tab test).
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      const note = local
        ? '<div class="party-note">This link only works on this computer. For a friend, invite from the hosted build.</div>'
        : '';
      this.link.innerHTML = `<div>Send this link to a friend:</div><input readonly value="${esc(url)}"><button class="party-btn small">Copy</button>${note}`;
      const field = this.link.querySelector('input')!;
      const copy = this.link.querySelector('button')!;
      field.addEventListener('focus', () => field.select());
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          copy.textContent = 'Copied';
        } catch {
          field.select();
        }
      });
      this.inviteBtn.style.display = 'none';
    } catch {
      this.inviteBtn.disabled = false;
    }
  }

  /** Per frame: status line, party frames, revive prompt. */
  update(statusText: string, sim: SimState, me: PlayerState | null, localId: string, ended: boolean): void {
    this.status.textContent = statusText;
    this.soloBtn.style.display = ended ? 'inline-block' : 'none';
    if (ended) this.inviteBtn.style.display = 'none';
    this.endedBanner.style.display = ended ? 'block' : 'none';
    if (ended) this.endedBanner.textContent = `${statusText}. "Play solo instead" is in the menu.`;

    // Everyone else in the party: name, health, down.
    const others = sim.players.filter((p) => p.id !== localId);
    const html = others
      .map((p) => {
        const frac = Math.max(0, p.hp / p.maxHp);
        const down = p.mode === 'down';
        return `<div class="party-frame ${down ? 'down' : ''}"><div class="party-frame-name">${esc(p.name || 'Player')}${down ? ' · down' : ''}</div><div class="party-frame-hp"><div style="width:${Math.round(frac * 100)}%"></div></div></div>`;
      })
      .join('');
    if (html !== this.shownFrames) {
      this.frames.innerHTML = html;
      this.shownFrames = html;
    }

    // Revive prompt: helping someone, or being helped.
    const c = tuning.coop;
    let text = '';
    let progress = 0;
    if (me && me.mode === 'down' && others.some((p) => p.mode !== 'down')) {
      text = me.reviveProgress > 0 ? 'Being revived…' : 'You are down. An ally can revive you (hold F next to you).';
      progress = me.reviveProgress;
    } else if (me && me.mode !== 'down') {
      const near = others.find((p) => p.mode === 'down' && Math.hypot(p.x - me.x, p.z - me.z) <= c.reviveRadius && Math.abs(p.y - me.y) < 1.2);
      if (near) {
        text = `Hold F (or A) to revive ${esc(near.name || 'your ally')}`;
        progress = near.reviveProgress;
      }
    }
    this.prompt.style.display = text ? 'block' : 'none';
    if (text) {
      this.promptText.textContent = text;
      this.promptFill.style.width = `${Math.min(100, ((progress * 1000) / c.reviveMs) * 100)}%`;
    }
  }
}
