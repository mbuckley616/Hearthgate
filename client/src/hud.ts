export interface HudData {
  myName: string;
  myHp: number;
  myMaxHp: number;
  dead: boolean;
  /** Centre banner while downed or dead ("" when standing). */
  banner: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPhase: string;
  players: number;
  rtt: number;
  pending: number;
  corrections: number;
  roomId: string;
  events: string[];
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
  private enemyFill: HTMLElement;
  private enemyText: HTMLElement;
  private party: HTMLElement;
  private net: HTMLElement;
  private log: HTMLElement;
  private respawn: HTMLElement;
  private slotEls: HTMLElement[];
  private lastEvents = "";

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-status" id="hud-status"></div>
      <div class="hud-panel hud-top-left">
        <div class="hud-name" id="hud-name"></div>
        <div class="hud-bar"><div class="hud-fill hud-fill-player" id="hud-hp-fill"></div><span id="hud-hp-text"></span></div>
        <div class="hud-sub">Goblin</div>
        <div class="hud-bar"><div class="hud-fill hud-fill-enemy" id="hud-enemy-fill"></div><span id="hud-enemy-text"></span></div>
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
        <span>Gamepad: stick, X, A; Y B RB</span>
      </div>
    `;
    this.status = root.querySelector("#hud-status")!;
    this.name = root.querySelector("#hud-name")!;
    this.hpFill = root.querySelector("#hud-hp-fill")!;
    this.hpText = root.querySelector("#hud-hp-text")!;
    this.enemyFill = root.querySelector("#hud-enemy-fill")!;
    this.enemyText = root.querySelector("#hud-enemy-text")!;
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
    this.hpFill.style.width = `${(100 * d.myHp) / d.myMaxHp}%`;
    this.hpText.textContent = `${d.myHp} / ${d.myMaxHp}`;
    this.enemyFill.style.width = `${(100 * d.enemyHp) / d.enemyMaxHp}%`;
    this.enemyText.textContent = d.enemyPhase === "dead" ? "returning soon" : `${d.enemyHp} / ${d.enemyMaxHp}`;
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
