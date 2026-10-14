import {
  GEAR,
  MATERIALS,
  PICKABLE_WEAPONS,
  STARTER_WEAPON,
  WEAPON_CLASSES,
  WEAPON_TYPES,
  gearName,
  materialOf,
  weaponClassOf,
  weaponFromPick,
  weaponStats,
  type WeaponGear
} from "@hearthgate/shared";
import { firstGamepad } from "./input";

/**
 * The join screen (Michael, A, 2026-10-05): pick a weapon type and a material tier, then
 * join. A stand-in for the Phase 2 village loadout. Keyboard first (arrows or WASD to move,
 * Enter or Space to join), then gamepad (d-pad or stick, A to join), then pointer and touch:
 * every choice is a real button at least 48 px, nothing needs hover. The server checks the
 * pick; this screen only asks.
 */

const STORE_KEY = "hearthgate.pick";
/** The bow's lock-on reach, for the line under the pick. */
const BOW_RANGE = WEAPON_CLASSES.bow.range;
/** Stick travel that counts as a press on the join screen. */
const STICK_PRESS = 0.6;

/** Ask the player for a weapon; resolves when they join. */
export function pickWeapon(): Promise<WeaponGear> {
  return new Promise((resolve) => {
    const saved = loadPick();
    let typeIdx = Math.max(0, PICKABLE_WEAPONS.indexOf(saved.type));
    let tierIdx = saved.tier - 1;
    /** 0 the weapon row, 1 the material row, 2 the join button. */
    let row = 0;
    let done = false;

    const root = document.createElement("div");
    root.className = "join";
    root.innerHTML = `
      <div class="join-panel" role="dialog" aria-label="Choose your weapon">
        <h1 class="join-title">Hearthgate</h1>
        <div class="join-label" id="join-weapon-label">Weapon</div>
        <div class="join-row" data-row="0" role="radiogroup" aria-labelledby="join-weapon-label"></div>
        <div class="join-label" id="join-tier-label">Material</div>
        <div class="join-row" data-row="1" role="radiogroup" aria-labelledby="join-tier-label"></div>
        <p class="join-detail" aria-live="polite"></p>
        <button class="join-go" data-row="2" type="button">Join</button>
        <p class="join-help">Arrows or WASD to choose, Enter to join. Gamepad: d-pad, A to join.</p>
      </div>`;
    document.body.appendChild(root);
    const weaponRow = root.querySelector<HTMLElement>('[data-row="0"]')!;
    const tierRow = root.querySelector<HTMLElement>('[data-row="1"]')!;
    const detail = root.querySelector<HTMLElement>(".join-detail")!;
    const go = root.querySelector<HTMLButtonElement>(".join-go")!;

    const weaponButtons = PICKABLE_WEAPONS.map((id, i) => {
      const b = choiceButton(WEAPON_TYPES[id].name);
      b.addEventListener("click", () => {
        typeIdx = i;
        row = 0;
        render();
      });
      weaponRow.appendChild(b);
      return b;
    });
    const tierButtons = MATERIALS.map((m, i) => {
      const b = choiceButton(m.name);
      b.style.setProperty("--swatch", `#${m.color.toString(16).padStart(6, "0")}`);
      b.classList.add("join-material");
      b.addEventListener("click", () => {
        tierIdx = i;
        row = 1;
        render();
      });
      tierRow.appendChild(b);
      return b;
    });
    go.addEventListener("click", () => finish());

    const pick = (): WeaponGear => weaponFromPick(PICKABLE_WEAPONS[typeIdx], tierIdx + 1);

    function render() {
      weaponButtons.forEach((b, i) => b.setAttribute("aria-checked", String(i === typeIdx)));
      tierButtons.forEach((b, i) => b.setAttribute("aria-checked", String(i === tierIdx)));
      weaponRow.classList.toggle("is-focus", row === 0);
      tierRow.classList.toggle("is-focus", row === 1);
      go.classList.toggle("is-focus", row === 2);
      detail.textContent = describePick(pick());
    }

    function move(dRow: number, dCol: number) {
      row = Math.max(0, Math.min(2, row + dRow));
      if (row === 0) typeIdx = wrap(typeIdx + dCol, PICKABLE_WEAPONS.length);
      if (row === 1) tierIdx = wrap(tierIdx + dCol, MATERIALS.length);
      render();
    }

    function onKey(e: KeyboardEvent) {
      const c = e.code;
      if (c === "ArrowUp" || c === "KeyW") move(-1, 0);
      else if (c === "ArrowDown" || c === "KeyS") move(1, 0);
      else if (c === "ArrowLeft" || c === "KeyA") move(0, -1);
      else if (c === "ArrowRight" || c === "KeyD") move(0, 1);
      else if (c === "Enter" || c === "NumpadEnter" || c === "Space") finish();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);

    // The gamepad has no events for buttons: poll each frame and act on the press, not the hold.
    let held = new Set<string>();
    let seenPad = false;
    function pollPad() {
      if (done) return;
      const pad = firstGamepad();
      if (pad) {
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const now = new Set<string>();
        if (pad.buttons[12]?.pressed || ay < -STICK_PRESS) now.add("up");
        if (pad.buttons[13]?.pressed || ay > STICK_PRESS) now.add("down");
        if (pad.buttons[14]?.pressed || ax < -STICK_PRESS) now.add("left");
        if (pad.buttons[15]?.pressed || ax > STICK_PRESS) now.add("right");
        if (pad.buttons[0]?.pressed) now.add("a");
        // Anything already down when the screen opened is not a choice: the first poll only records it.
        const pressed = (k: string) => seenPad && now.has(k) && !held.has(k);
        if (pressed("up")) move(-1, 0);
        if (pressed("down")) move(1, 0);
        if (pressed("left")) move(0, -1);
        if (pressed("right")) move(0, 1);
        if (pressed("a")) finish();
        held = now;
        seenPad = true;
      }
      requestAnimationFrame(pollPad);
    }
    requestAnimationFrame(pollPad);

    function finish() {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      const w = pick();
      savePick(w);
      root.remove();
      resolve(w);
    }

    render();
  });
}

/** "Claymore, two-handed: hits up to 3 in front. 41 a hit in a tier-1 portal." */
export function describePick(w: WeaponGear): string {
  const t = WEAPON_TYPES[w.type];
  const cls = weaponClassOf(w);
  const how =
    cls === "bow"
      ? `a bow: locks on to the nearest enemy in sight out to ${BOW_RANGE} m; no ability yet`
      : cls === "twoHand"
        ? `two-handed: slower, hits up to ${t.cleaveTargets} in front; Cleave on 1`
        : "one-handed: quick, hits the nearest in front; Cleave on 1";
  const s = weaponStats(w, 1);
  const held = s.capped ? `, held to ${materialOf(s.tier).name} (a tier-1 portal allows up to tier ${GEAR.materialsPerPortalTier})` : "";
  return `${gearName(w)}, ${how}. ${s.damage} a hit in a tier-1 portal${held}.`;
}

function choiceButton(label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "join-choice";
  b.setAttribute("role", "radio");
  b.textContent = label;
  // Arrows and Enter are the screen's own; a focused button must not also act on Space.
  b.tabIndex = -1;
  return b;
}

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

function loadPick(): WeaponGear {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return weaponFromPick(v?.type, v?.tier);
    }
  } catch {
    // Private windows and blocked storage start from the sword.
  }
  return { ...STARTER_WEAPON };
}

function savePick(w: WeaponGear) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ type: w.type, tier: w.tier }));
  } catch {
    // Remembering the pick is a convenience only.
  }
}
