export interface HudData {
  myName: string;
  /** "Iron Claymore": what you picked on the join screen. */
  weapon: string;
  myHp: number;
  myMaxHp: number;
  dead: boolean;
  /** Centre banner while downed or dead ("" when standing). */
  banner: string;
  /** The nearest living enemy's bar; label such as "Goblin, 3 of 4 left" or "Room clear". */
  enemyLabel: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemiesLeft: number;
  enemiesTotal: number;
  players: number;
  rtt: number;
  pending: number;
  corrections: number;
  roomId: string;
  events: string[];
  /** Revive Draughts left, and the dead teammate one would reach now ("" when none). */
  draughts: number;
  reviveTarget: string;
  /** The village: no enemy bar; the villager in reach ("" when none), and what the last one said. */
  village: boolean;
  talkTo: string;
  speech: { who: string; line: string } | null;
  /** Our posture, and whether the guard is up or we are off balance. */
  posture: number;
  postureMax: number;
  guarding: boolean;
  staggered: boolean;
  /** One entry per ability slot: its name ("" when empty) and seconds until ready. */
  slots: { name: string; readyIn: number }[];
}

/** Minimal DOM HUD. Lives in the corners; the centre of the screen stays clear. */
export class Hud {
  private root: HTMLElement;
  private status: HTMLElement;
  private name: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private enemyLabel: HTMLElement;
  private enemyFill: HTMLElement;
  private enemyText: HTMLElement;
  private draught: HTMLElement;
  private talk: HTMLButtonElement;
  private speech: HTMLElement;
  private enemyRow: HTMLElement;
  private weaponEl: HTMLElement;
  private posture: HTMLElement;
  private party: HTMLElement;
  private net: HTMLElement;
  private log: HTMLElement;
  private respawn: HTMLElement;
  private slotEls: HTMLElement[];
  private lastEvents = "";

  constructor(root: HTMLElement, onTalk: () => void = () => {}) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-status" id="hud-status"></div>
      <div class="hud-panel hud-top-left">
        <div class="hud-name" id="hud-name"></div>
        <div class="hud-sub hud-weapon" id="hud-weapon"></div>
        <div class="hud-bar"><div class="hud-fill hud-fill-player" id="hud-hp-fill"></div><span id="hud-hp-text"></span></div>
        <div class="hud-sub hud-posture" id="hud-posture"></div>
        <div class="hud-sub" id="hud-enemy-label">Goblin</div>
        <div class="hud-bar" id="hud-enemy-row"><div class="hud-fill hud-fill-enemy" id="hud-enemy-fill"></div><span id="hud-enemy-text"></span></div>
        <div class="hud-sub hud-draught" id="hud-draught"></div>
        <button class="hud-talk" id="hud-talk" type="button"></button>
        <div class="hud-speech" id="hud-speech"></div>
      </div>
      <div class="hud-panel hud-top-right">
        <div id="hud-party"></div>
        <div id="hud-net" class="hud-sub"></div>
      </div>
      <div class="hud-log" id="hud-log"></div>
      <div class="hud-respawn" id="hud-respawn"></div>
      <div class="hud-bottom-right hud-slots" id="hud-slots">
        ${[1, 2, 3].map((k) => `<div class="hud-slot" data-slot="${k}"><b>${k}</b><span class="hud-slot-name"></span><span class="hud-slot-cd"></span></div>`).join("")}
      </div>
      <div class="hud-panel hud-bottom-left hud-controls">
        <span><b>WASD</b> move</span>
        <span><b>J</b> or <b>Space</b> attack</span>
        <span><b>Shift</b> dodge</span>
        <span><b>1 2 3</b> abilities</span>
        <span><b>L</b> or <b>Q</b> block (hold; just before a hit to parry)</span>
        <span><b>E</b> talk, revive draught</span>
        <span><b>Tab</b> bow lock-on</span>
        <span>Gamepad: stick, X, A; Y B RB; LB; LT block</span>
      </div>
    `;
    this.status = root.querySelector("#hud-status")!;
    this.name = root.querySelector("#hud-name")!;
    this.hpFill = root.querySelector("#hud-hp-fill")!;
    this.hpText = root.querySelector("#hud-hp-text")!;
    this.enemyLabel = root.querySelector("#hud-enemy-label")!;
    this.enemyFill = root.querySelector("#hud-enemy-fill")!;
    this.enemyText = root.querySelector("#hud-enemy-text")!;
    this.draught = root.querySelector("#hud-draught")!;
    this.talk = root.querySelector("#hud-talk")!;
    this.speech = root.querySelector("#hud-speech")!;
    this.enemyRow = root.querySelector("#hud-enemy-row")!;
    // A tap or a click talks; the button never takes focus, so Space and Enter stay the game's.
    this.talk.tabIndex = -1;
    this.talk.addEventListener("click", () => {
      onTalk();
      this.talk.blur();
    });
    this.weaponEl = root.querySelector("#hud-weapon")!;
    this.posture = root.querySelector("#hud-posture")!;
    this.party = root.querySelector("#hud-party")!;
    this.net = root.querySelector("#hud-net")!;
    this.log = root.querySelector("#hud-log")!;
    this.respawn = root.querySelector("#hud-respawn")!;
    this.slotEls = [...root.querySelectorAll<HTMLElement>(".hud-slot")];
  }

  setStatus(text: string) {
    this.status.textContent = text;
    this.status.style.display = text ? "block" : "none";
  }

  update(d: HudData) {
    this.name.textContent = d.myName;
    if (this.weaponEl.textContent !== d.weapon) this.weaponEl.textContent = d.weapon;
    this.hpFill.style.width = `${(100 * d.myHp) / d.myMaxHp}%`;
    this.hpText.textContent = `${d.myHp} / ${d.myMaxHp}`;
    this.enemyLabel.textContent = d.enemyLabel;
    this.enemyLabel.setAttribute("data-left", String(d.enemiesLeft));
    const noEnemy = d.enemiesLeft === 0 || d.enemyMaxHp === 0;
    this.enemyFill.style.width = noEnemy ? "0%" : `${(100 * d.enemyHp) / d.enemyMaxHp}%`;
    this.enemyText.textContent = noEnemy ? "returning soon" : `${d.enemyHp} / ${d.enemyMaxHp}`;
    this.draught.textContent =
      d.draughts > 0 && d.reviveTarget
        ? `E or LB: revive ${d.reviveTarget} (${d.draughts} draught${d.draughts === 1 ? "" : "s"})`
        : `Revive Draughts: ${d.draughts}`;
    this.draught.classList.toggle("is-ready", d.draughts > 0 && !!d.reviveTarget);
    this.draught.setAttribute("data-draughts", String(d.draughts));
    this.enemyRow.style.display = d.village ? "none" : "";
    const talkText = d.talkTo ? `E or LB: talk to ${d.talkTo}` : "";
    if (this.talk.textContent !== talkText) this.talk.textContent = talkText;
    this.talk.style.display = talkText ? "block" : "none";
    const speechText = d.speech ? `${d.speech.who}: ${d.speech.line}` : "";
    if (this.speech.textContent !== speechText) this.speech.textContent = speechText;
    this.speech.style.display = speechText ? "block" : "none";
    this.posture.textContent = `Posture ${Math.ceil(d.posture)} / ${d.postureMax}${d.staggered ? ", off balance" : d.guarding ? ", guard up" : ""}`;
    this.posture.classList.toggle("is-staggered", d.staggered);
    this.posture.setAttribute("data-posture", String(Math.ceil(d.posture)));
    this.party.textContent = `${d.players} in the party`;
    this.party.setAttribute("data-players", String(d.players));
    this.net.textContent = `${Math.round(d.rtt)} ms ping, ${d.pending} unconfirmed, ${d.corrections} corrections, room ${d.roomId.slice(0, 6)}`;
    this.respawn.textContent = d.banner;
    this.respawn.style.display = d.banner ? "block" : "none";
    const joined = d.events.join("\n");
    if (joined !== this.lastEvents) {
      this.lastEvents = joined;
      this.log.innerHTML = d.events.map((e) => `<div>${escapeHtml(e)}</div>`).join("");
    }
    this.root.classList.toggle("is-dead", d.dead);
    d.slots.forEach((s, i) => {
      const el = this.slotEls[i];
      if (!el) return;
      (el.children[1] as HTMLElement).textContent = s.name || "empty";
      (el.children[2] as HTMLElement).textContent = s.name && s.readyIn > 0 ? String(Math.ceil(s.readyIn)) : "";
      el.classList.toggle("is-empty", !s.name);
      el.classList.toggle("is-cooling", !!s.name && s.readyIn > 0);
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
