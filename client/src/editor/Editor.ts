import { DUNGEONS } from '@hearthgate/shared/level/dungeons';
import type { Piece } from '@hearthgate/shared/level/generate';
import { checkHandDungeon, HAND_EXTENT, HAND_MAX_FLOORS, HAND_MAX_LEVEL, readDungeon, type DungeonCheck, type HandDungeon, type HandDungeonCheck, type HandPiece } from '@hearthgate/shared/level/handmade';
import { KIT, OPPOSITE, SIDE_DIR, rotSide, rotSize, rotSocket, type PieceKind, type Side } from '@hearthgate/shared/level/kit';
import { deleteDungeon, saveDungeon, savedDungeons } from './store';

/** The palette, in the order Q and E step through it (and 1 to 9, 0 pick directly). */
const PALETTE: PieceKind[] = ['entrance', 'hall', 'hallLong', 'corner', 'tee', 'cross', 'stair', 'small', 'medium', 'large', 'arena', 'rest', 'boss'];
const NAMES: Record<PieceKind, string> = {
  entrance: 'Entrance',
  hall: 'Hall',
  hallLong: 'Long hall',
  corner: 'Corner',
  tee: 'Junction',
  cross: 'Crossing',
  stair: 'Staircase',
  small: 'Small room',
  medium: 'Medium room',
  large: 'Large room',
  arena: 'Arena',
  rest: 'Rest room',
  boss: 'Warden’s hall',
};
const DRAFT_KEY = 'hearthgate.editor.draft';
/** Held buttons and keys repeat after this long, this often (s). */
const REPEAT_DELAY = 0.35;
const REPEAT_EVERY = 0.12;

/**
 * The dungeon editor (T4b): Michael lays out the kit's pieces by hand on a top-down grid and saves a
 * dungeon Keeper Wren can offer. Keyboard first (rule 4): arrows or WASD move the cursor, Q / E pick
 * the piece, R turns it, Z / X lower and raise it, Space places, Backspace removes, F copies the
 * piece under the cursor, U undoes, P plays. A gamepad does the same (d-pad, A, B, X, Y, bumpers,
 * triggers, View, Start); the mouse is an extra (click places, right click removes, the wheel zooms).
 * Every button is at least 48 px, and nothing needs a hover (rule 5).
 *
 * A dungeon has one to five floors, each its own layout, shown as tabs ([ and ] or the stick clicks
 * switch, N adds one); a run through it is exactly those floors (Michael's playtest, 27 Oct). The
 * dungeon is checked as it changes (checkHandDungeon, the same check the server makes), and the
 * panel says in words what keeps it from being played.
 */
export class Editor {
  private dungeon: HandDungeon;
  private cursor = { x: 0, z: -1 };
  private view = { x: 0, z: 0 };
  private kind = 1;
  private rot = 0;
  private level = 0;
  private zoom = 30;
  /** The floor being edited (0-based). */
  private floor = 0;
  private history: { floors: HandDungeon['floors']; floor: number }[] = [];
  private full: HandDungeonCheck;
  private check: DungeonCheck;
  private readonly tabs = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly panel = document.createElement('aside');
  private readonly nameInput = document.createElement('input');
  private readonly palette = new Map<PieceKind, HTMLButtonElement>();
  private readonly turnText = document.createElement('span');
  private readonly heightText = document.createElement('span');
  private readonly status = document.createElement('div');
  private readonly saved = document.createElement('div');
  private readonly toast = document.createElement('div');
  private toastUntil = 0;
  private now = 0;
  private pad = { prev: new Set<number>(), held: new Map<number, number>() };

  constructor(root: HTMLElement) {
    this.dungeon = this.loadDraft();
    this.full = checkHandDungeon(this.dungeon);
    this.check = this.full.floors[0];
    root.className = 'editor';
    this.canvas.className = 'editor-canvas';
    this.toast.className = 'editor-toast';
    root.append(this.canvas, this.panel, this.toast);
    this.buildPanel();
    this.bindKeys();
    this.bindMouse();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.changed(false);
    const frame = (t: number) => {
      const dt = Math.min(0.1, t / 1000 - this.now || 0);
      this.now = t / 1000;
      this.pollPad(dt);
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // Handy for poking at it from the console, and for the browser test.
    Object.assign(window, { editor: this });
  }

  // ---------------------------------------------------------------- actions

  /** The floor being edited. */
  private get pieces(): HandPiece[] {
    return this.dungeon.floors[this.floor].pieces;
  }

  private set pieces(list: HandPiece[]) {
    this.dungeon.floors[this.floor].pieces = list;
  }

  /** Edit another floor (wrapping round). */
  toFloor(i: number): void {
    const n = this.dungeon.floors.length;
    this.floor = ((i % n) + n) % n;
    this.centreOnEntrance();
    this.changed(false);
  }

  /** A new floor after the last, with an entrance to start from. */
  addFloor(): void {
    if (this.dungeon.floors.length >= HAND_MAX_FLOORS) return this.say(`A dungeon has at most ${HAND_MAX_FLOORS} floors.`);
    this.remember();
    this.dungeon.floors.push({ pieces: [{ kind: 'entrance', gx: 0, gz: 0, rot: 0, level: 0 }] });
    this.floor = this.dungeon.floors.length - 1;
    this.centreOnEntrance();
    this.changed();
    this.say(`Floor ${this.floor + 1} added. The floor before it needs a rest room: its violet ring leads here.`);
  }

  /** Take the floor being edited out of the dungeon (undo brings it back). */
  removeFloor(): void {
    if (this.dungeon.floors.length === 1) return this.say('A dungeon needs at least one floor.');
    if (!confirm(`Remove floor ${this.floor + 1}? (Undo brings it back.)`)) return;
    this.remember();
    this.dungeon.floors.splice(this.floor, 1);
    this.floor = Math.min(this.floor, this.dungeon.floors.length - 1);
    this.centreOnEntrance();
    this.changed();
  }

  private centreOnEntrance(): void {
    const e = this.pieces.find((p) => p.kind === 'entrance');
    this.cursor = e ? { x: e.gx, z: e.gz - 1 } : { x: 0, z: 0 };
    this.view = { ...this.cursor };
  }

  move(dx: number, dz: number): void {
    this.cursor.x = Math.max(-HAND_EXTENT, Math.min(HAND_EXTENT, this.cursor.x + dx));
    this.cursor.z = Math.max(-HAND_EXTENT, Math.min(HAND_EXTENT, this.cursor.z + dz));
  }

  pick(step: number): void {
    this.kind = (this.kind + step + PALETTE.length) % PALETTE.length;
    this.refreshPanel();
  }

  choose(kind: PieceKind): void {
    this.kind = PALETTE.indexOf(kind);
    this.refreshPanel();
  }

  turn(): void {
    this.rot = (this.rot + 1) % 4;
    this.refreshPanel();
  }

  raise(step: number): void {
    this.level = Math.max(0, Math.min(HAND_MAX_LEVEL, this.level + step));
    this.refreshPanel();
  }

  /** Put the chosen piece down at the cursor (its north-west cell), if it fits there. */
  place(): void {
    const piece: HandPiece = { kind: PALETTE[this.kind], gx: this.cursor.x, gz: this.cursor.z, rot: this.rot, level: this.level };
    if (!this.fits(piece)) return this.say('That spot is taken: remove what is there first (Backspace).');
    if (this.pieces.length >= 50) return this.say('A floor holds at most 50 pieces.');
    this.remember();
    this.pieces.push(piece);
    this.changed();
  }

  /** Take away the piece under the cursor. */
  remove(): void {
    const i = this.pieceAt(this.cursor.x, this.cursor.z);
    if (i < 0) return this.say('Nothing here to remove.');
    this.remember();
    this.pieces.splice(i, 1);
    this.changed();
  }

  /** Take the kind, turn and height of the piece under the cursor, to place more like it. */
  copy(): void {
    const i = this.pieceAt(this.cursor.x, this.cursor.z);
    if (i < 0) return this.say('Nothing here to copy.');
    const p = this.pieces[i];
    this.kind = PALETTE.indexOf(p.kind);
    this.rot = p.rot;
    this.level = p.level;
    this.refreshPanel();
    this.say(`Copied: ${NAMES[p.kind]}, height ${p.level}.`);
  }

  undo(): void {
    const last = this.history.pop();
    if (!last) return this.say('Nothing to undo.');
    this.dungeon.floors = last.floors;
    this.floor = Math.min(last.floor, last.floors.length - 1);
    this.changed();
  }

  clear(): void {
    if (!confirm('Start a new, empty dungeon? (Undo brings this one back.)')) return;
    this.remember();
    this.dungeon = { name: 'My dungeon', floors: [{ pieces: [{ kind: 'entrance', gx: 0, gz: 0, rot: 0, level: 0 }] }] };
    this.floor = 0;
    this.nameInput.value = this.dungeon.name;
    this.changed();
  }

  save(): void {
    this.dungeon.name = this.nameInput.value.trim() || 'My dungeon';
    const clean = readDungeon(this.dungeon)!;
    this.nameInput.value = clean.name;
    this.dungeon.name = clean.name;
    saveDungeon(clean);
    this.refreshSaved();
    this.say(this.full.playable ? `Saved “${clean.name}”. Keeper Wren can offer it in your village.` : `Saved “${clean.name}”; it cannot be played until every floor’s list is clear.`);
  }

  /** Save, then walk it: the game makes a floor of it on the server. */
  play(): void {
    if (!this.full.playable) return this.say('Not playable yet: see the list in the panel, on every floor.');
    this.save();
    // Starts on the floor being edited, to try it without walking the ones before.
    location.href = `./?floor&play&hand=${encodeURIComponent(this.dungeon.name)}&at=${this.floor + 1}`;
  }

  exportFile(): void {
    const clean = readDungeon({ ...this.dungeon, name: this.nameInput.value })!;
    const blob = new Blob([JSON.stringify(clean, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${clean.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dungeon'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.say('Exported. Committed to shared/src/level/dungeons/, it ships to everyone.');
  }

  importFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const d = readDungeon(JSON.parse(await file.text()));
        if (!d) throw new Error('not a dungeon');
        this.load(d);
        this.say(`Opened “${d.name}”.`);
      } catch {
        this.say('That file is not a dungeon exported from here.');
      }
    };
    input.click();
  }

  load(d: HandDungeon): void {
    this.remember();
    this.dungeon = structuredClone(d);
    this.floor = 0;
    this.nameInput.value = d.name;
    this.centreOnEntrance();
    this.changed();
  }

  /** What keeps the dungeon from play, every floor's and the whole's, for the browser test. */
  get errors(): string[] {
    return [...this.full.errors, ...this.full.floors.flatMap((c) => c.errors)];
  }

  // ---------------------------------------------------------------- state

  private loadDraft(): HandDungeon {
    try {
      const d = readDungeon(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'));
      if (d) return d;
    } catch {
      // A broken draft starts over.
    }
    return { name: 'My dungeon', floors: [{ pieces: [{ kind: 'entrance', gx: 0, gz: 0, rot: 0, level: 0 }] }] };
  }

  private remember(): void {
    this.history.push({ floors: structuredClone(this.dungeon.floors), floor: this.floor });
    if (this.history.length > 200) this.history.shift();
  }

  /** The layout changed: check it again, keep the draft, show the panel. */
  private changed(keep = true): void {
    this.full = checkHandDungeon(this.dungeon);
    this.check = this.full.floors[this.floor];
    if (keep) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...this.dungeon, name: this.nameInput.value || this.dungeon.name }));
      } catch {
        // A full or blocked storage only loses the draft.
      }
    }
    this.refreshPanel();
  }

  private footprint(p: HandPiece): { x0: number; z0: number; x1: number; z1: number } {
    const size = rotSize(KIT[p.kind], p.rot);
    return { x0: p.gx, z0: p.gz, x1: p.gx + size.w, z1: p.gz + size.d };
  }

  private pieceAt(x: number, z: number): number {
    return this.pieces.findIndex((p) => {
      const f = this.footprint(p);
      return x >= f.x0 && x < f.x1 && z >= f.z0 && z < f.z1;
    });
  }

  private fits(p: HandPiece): boolean {
    const f = this.footprint(p);
    if (f.x0 < -HAND_EXTENT || f.z0 < -HAND_EXTENT || f.x1 > HAND_EXTENT + 1 || f.z1 > HAND_EXTENT + 1) return false;
    for (let x = f.x0; x < f.x1; x++) for (let z = f.z0; z < f.z1; z++) if (this.pieceAt(x, z) >= 0) return false;
    return true;
  }

  private say(text: string): void {
    this.toast.textContent = text;
    this.toastUntil = this.now + 4;
  }

  // ---------------------------------------------------------------- input

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const keys: Record<string, () => void> = {
        ArrowUp: () => this.move(0, -1),
        KeyW: () => this.move(0, -1),
        ArrowDown: () => this.move(0, 1),
        KeyS: () => (ctrl ? this.save() : this.move(0, 1)),
        ArrowLeft: () => this.move(-1, 0),
        KeyA: () => this.move(-1, 0),
        ArrowRight: () => this.move(1, 0),
        KeyD: () => this.move(1, 0),
        KeyQ: () => this.pick(-1),
        KeyE: () => this.pick(1),
        KeyR: () => this.turn(),
        KeyX: () => this.raise(1),
        PageUp: () => this.raise(1),
        KeyZ: () => (ctrl ? this.undo() : this.raise(-1)),
        PageDown: () => this.raise(-1),
        Space: () => this.place(),
        Enter: () => this.place(),
        Backspace: () => (e.shiftKey ? this.removeFloor() : this.remove()),
        Delete: () => this.remove(),
        KeyF: () => this.copy(),
        KeyU: () => this.undo(),
        KeyP: () => this.play(),
        BracketLeft: () => this.toFloor(this.floor - 1),
        BracketRight: () => this.toFloor(this.floor + 1),
        KeyN: () => this.addFloor(),
        Minus: () => this.zoomBy(-4),
        Equal: () => this.zoomBy(4),
      };
      const digit = /^Digit(\d)$/.exec(e.code);
      const fn = digit ? () => this.choose(PALETTE[(Number(digit[1]) + 9) % 10]) : keys[e.code];
      if (!fn) return;
      e.preventDefault();
      fn();
    });
  }

  private bindMouse(): void {
    const cellAt = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: Math.floor(this.view.x + (e.clientX - r.left - r.width / 2) / this.zoom), z: Math.floor(this.view.z + (e.clientY - r.top - r.height / 2) / this.zoom) };
    };
    this.canvas.addEventListener('mousemove', (e) => {
      const c = cellAt(e);
      this.cursor = { x: Math.max(-HAND_EXTENT, Math.min(HAND_EXTENT, c.x)), z: Math.max(-HAND_EXTENT, Math.min(HAND_EXTENT, c.z)) };
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.place();
      if (e.button === 2) this.remove();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 4 : -4);
    });
  }

  private zoomBy(step: number): void {
    this.zoom = Math.max(12, Math.min(64, this.zoom + step));
  }

  /** The gamepad: the d-pad and left stick move (repeating while held), the face buttons act once per press. */
  private pollPad(dt: number): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g);
    if (!pad) return;
    const down = new Set<number>();
    pad.buttons.forEach((b, i) => b.pressed && down.add(i));
    const [lx, ly] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
    if (ly < -0.6) down.add(12);
    if (ly > 0.6) down.add(13);
    if (lx < -0.6) down.add(14);
    if (lx > 0.6) down.add(15);
    const once: Record<number, () => void> = {
      0: () => this.place(),
      1: () => this.remove(),
      2: () => this.turn(),
      3: () => this.copy(),
      4: () => this.pick(-1),
      5: () => this.pick(1),
      6: () => this.raise(-1),
      7: () => this.raise(1),
      8: () => this.undo(),
      9: () => this.play(),
      10: () => this.toFloor(this.floor - 1),
      11: () => this.toFloor(this.floor + 1),
    };
    const moves: Record<number, [number, number]> = { 12: [0, -1], 13: [0, 1], 14: [-1, 0], 15: [1, 0] };
    for (const i of down) {
      const fresh = !this.pad.prev.has(i);
      if (fresh) once[i]?.();
      const mv = moves[i];
      if (!mv) continue;
      let t = this.pad.held.get(i) ?? 0;
      if (fresh) {
        this.move(mv[0], mv[1]);
        t = -REPEAT_DELAY;
      }
      t += dt;
      if (t >= REPEAT_EVERY) {
        this.move(mv[0], mv[1]);
        t = 0;
      }
      this.pad.held.set(i, t);
    }
    for (const i of this.pad.prev) if (!down.has(i)) this.pad.held.delete(i);
    this.pad.prev = down;
  }

  // ---------------------------------------------------------------- panel

  private buildPanel(): void {
    const p = this.panel;
    p.className = 'editor-panel';
    const h = (text: string) => {
      const el = document.createElement('h2');
      el.textContent = text;
      p.appendChild(el);
    };
    const button = (label: string, fn: () => void, parent: HTMLElement = p, cls = 'menu-btn') => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.addEventListener('click', () => {
        fn();
        b.blur();
      });
      parent.appendChild(b);
      return b;
    };
    const row = (cls = 'editor-row') => {
      const r = document.createElement('div');
      r.className = cls;
      p.appendChild(r);
      return r;
    };

    const title = document.createElement('h1');
    title.textContent = 'Dungeon editor';
    p.appendChild(title);
    this.nameInput.className = 'editor-name';
    this.nameInput.maxLength = 32;
    this.nameInput.value = this.dungeon.name;
    this.nameInput.setAttribute('aria-label', 'Dungeon name');
    this.nameInput.addEventListener('input', () => this.changed());
    p.appendChild(this.nameInput);

    h('Floors  ·  [ and ], N adds one');
    this.tabs.className = 'editor-tabs';
    p.appendChild(this.tabs);
    const fr = row();
    button('Add floor  N', () => this.addFloor(), fr, 'editor-btn');
    button('Remove floor  ⇧⌫', () => this.removeFloor(), fr, 'editor-btn');

    h('Piece  ·  Q / E, 1 to 0');
    const pal = row('editor-palette');
    PALETTE.forEach((kind, i) => {
      const b = button(`${i < 10 ? `${(i + 1) % 10} ` : ''}${NAMES[kind]}`, () => this.choose(kind), pal, 'editor-btn');
      this.palette.set(kind, b);
    });

    h('Turn and height');
    const th = row();
    button('Turn  R', () => this.turn(), th, 'editor-btn');
    th.appendChild(this.turnText);
    const hh = row();
    button('Lower  Z', () => this.raise(-1), hh, 'editor-btn');
    button('Raise  X', () => this.raise(1), hh, 'editor-btn');
    hh.appendChild(this.heightText);

    h('Build');
    const b1 = row();
    button('Place  Space', () => this.place(), b1, 'editor-btn');
    button('Remove  ⌫', () => this.remove(), b1, 'editor-btn');
    const b2 = row();
    button('Copy  F', () => this.copy(), b2, 'editor-btn');
    button('Undo  U', () => this.undo(), b2, 'editor-btn');
    button('New', () => this.clear(), b2, 'editor-btn');

    this.status.className = 'editor-status';
    p.appendChild(this.status);

    const s1 = row();
    button('Save  Ctrl+S', () => this.save(), s1, 'editor-btn');
    button('Play  P', () => this.play(), s1, 'editor-btn primary');
    const s2 = row();
    button('Export file', () => this.exportFile(), s2, 'editor-btn');
    button('Import file', () => this.importFile(), s2, 'editor-btn');

    h('Dungeons');
    this.saved.className = 'editor-saved';
    p.appendChild(this.saved);
    this.refreshSaved();

    const back = document.createElement('a');
    back.className = 'editor-btn editor-back';
    back.href = './';
    back.textContent = 'Back to the game';
    p.appendChild(back);
    const help = document.createElement('p');
    help.className = 'editor-help';
    help.textContent =
      'Arrows or WASD move · Space places · Backspace removes · F copies the piece under the cursor · [ and ] change floor, N adds one, Shift+Backspace removes it · Pad: d-pad, A place, B remove, X turn, Y copy, LB/RB piece, LT/RT height, stick clicks change floor, View undo, Start play. A piece is placed by its north-west corner.';
    p.appendChild(help);
  }

  private refreshPanel(): void {
    for (const [kind, b] of this.palette) b.classList.toggle('chosen', kind === PALETTE[this.kind]);
    this.turnText.textContent = `facing ${['north', 'east', 'south', 'west'][this.rot]}`;
    this.heightText.textContent = `height ${this.level}`;
    // A tab a floor: its number, and a mark for whether it can be played.
    this.tabs.innerHTML = '';
    this.dungeon.floors.forEach((_, i) => {
      const t = document.createElement('button');
      const ok = this.full.floors[i]?.def !== null;
      t.className = `editor-btn editor-tab${i === this.floor ? ' chosen' : ''}`;
      t.textContent = `Floor ${i + 1} ${ok ? '✓' : '!'}`;
      t.title = ok ? 'Ready' : 'Not ready yet';
      t.addEventListener('click', () => {
        this.toFloor(i);
        t.blur();
      });
      this.tabs.appendChild(t);
    });
    const c = this.check;
    const n = this.dungeon.floors.length;
    const lines: string[] = [];
    const last = this.floor === n - 1;
    lines.push(`<p class="note">Floor ${this.floor + 1} of ${n}: ${last ? 'the last; the Warden’s hall ends the run, or a rest room leads home' : 'ends in a rest room, whose violet ring leads to floor ' + (this.floor + 2)}.</p>`);
    if (this.full.playable) lines.push(`<p class="ok">Ready to play: ${n} floor${n === 1 ? '' : 's'}, ${this.dungeon.floors.reduce((t, fl) => t + fl.pieces.length, 0)} pieces.</p>`);
    else if (c.def) lines.push(`<p class="ok">This floor is ready (${this.pieces.length} pieces, ${c.def.pieces.filter((p) => p.fight).length} fight rooms).</p>`);
    for (const e of this.full.errors) lines.push(`<p class="err">${escape(e)}</p>`);
    for (const e of c.errors) lines.push(`<p class="err">${escape(e)}</p>`);
    for (const n of c.notes) lines.push(`<p class="note">${escape(n)}</p>`);
    this.status.innerHTML = lines.join('');
  }

  private refreshSaved(): void {
    this.saved.innerHTML = '';
    const entry = (d: HandDungeon, ships: boolean) => {
      const r = document.createElement('div');
      r.className = 'editor-row';
      const name = document.createElement('span');
      name.className = 'editor-saved-name';
      const fl = d.floors.length > 1 ? `, ${d.floors.length} floors` : '';
      name.textContent = ships ? `${d.name} (ships${fl})` : `${d.name}${fl ? ` (${fl.slice(2)})` : ''}`;
      const open = document.createElement('button');
      open.className = 'editor-btn';
      open.textContent = 'Open';
      open.addEventListener('click', () => this.load(d));
      r.append(name, open);
      if (!ships) {
        const del = document.createElement('button');
        del.className = 'editor-btn';
        del.textContent = 'Delete';
        del.addEventListener('click', () => {
          if (!confirm(`Delete “${d.name}” from this browser?`)) return;
          deleteDungeon(d.name);
          this.refreshSaved();
        });
        r.appendChild(del);
      }
      this.saved.appendChild(r);
    };
    for (const d of DUNGEONS) entry(d, true);
    for (const d of savedDungeons()) entry(d, false);
  }

  // ---------------------------------------------------------------- drawing

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
  }

  private draw(): void {
    const g = this.canvas.getContext('2d')!;
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth);
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The view follows the cursor once it nears an edge.
    const marginX = W / this.zoom / 2 - 3;
    const marginZ = H / this.zoom / 2 - 3;
    if (this.cursor.x + 0.5 - this.view.x > marginX) this.view.x = this.cursor.x + 0.5 - marginX;
    if (this.view.x - (this.cursor.x + 0.5) > marginX) this.view.x = this.cursor.x + 0.5 + marginX;
    if (this.cursor.z + 0.5 - this.view.z > marginZ) this.view.z = this.cursor.z + 0.5 - marginZ;
    if (this.view.z - (this.cursor.z + 0.5) > marginZ) this.view.z = this.cursor.z + 0.5 + marginZ;
    const Z = this.zoom;
    const X = (cx: number) => W / 2 + (cx - this.view.x) * Z;
    const Y = (cz: number) => H / 2 + (cz - this.view.z) * Z;

    g.fillStyle = '#0d0815';
    g.fillRect(0, 0, W, H);
    // The grid, and its edge.
    g.strokeStyle = 'rgba(164, 147, 184, 0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = -HAND_EXTENT; x <= HAND_EXTENT + 1; x++) g.moveTo(X(x), Y(-HAND_EXTENT)), g.lineTo(X(x), Y(HAND_EXTENT + 1));
    for (let z = -HAND_EXTENT; z <= HAND_EXTENT + 1; z++) g.moveTo(X(-HAND_EXTENT), Y(z)), g.lineTo(X(HAND_EXTENT + 1), Y(z));
    g.stroke();
    g.strokeStyle = 'rgba(185, 120, 46, 0.6)';
    g.strokeRect(X(-HAND_EXTENT), Y(-HAND_EXTENT), (HAND_EXTENT * 2 + 1) * Z, (HAND_EXTENT * 2 + 1) * Z);
    g.fillStyle = 'rgba(164, 147, 184, 0.6)';
    g.font = '12px monospace';
    g.fillText('N', X(this.view.x) - 4, 14);
    g.fillStyle = '#ffcf6a';
    g.font = 'bold 16px Georgia, serif';
    g.textAlign = 'left';
    g.fillText(`Floor ${this.floor + 1} of ${this.dungeon.floors.length}`, 14, 24);

    const top = Math.max(1, ...this.pieces.map((p) => p.level + (p.kind === 'stair' ? 1 : 0)));
    this.check.joined.forEach((piece) => this.drawPiece(g, piece, X, Y, top, 1));

    // The piece to place, where it would go.
    const ghost: HandPiece = { kind: PALETTE[this.kind], gx: this.cursor.x, gz: this.cursor.z, rot: this.rot, level: this.level };
    const fits = this.fits(ghost);
    const gp = this.ghostPiece(ghost);
    this.drawPiece(g, gp, X, Y, Math.max(top, this.level + 1), 0.5);
    const f = this.footprint(ghost);
    g.strokeStyle = fits ? '#8fe38a' : '#ff5a4a';
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.strokeRect(X(f.x0), Y(f.z0), (f.x1 - f.x0) * Z, (f.z1 - f.z0) * Z);
    g.setLineDash([]);
    // Its doorways: green where they would join a neighbour, amber where one meets it at another height.
    for (const sk of gp.sockets) {
      const d = SIDE_DIR[sk.side];
      const n = this.pieces[this.pieceAt(sk.cx + d.x, sk.cz + d.z)];
      if (!n) continue;
      const joined = this.check.joined[this.pieces.indexOf(n)];
      const facing = joined?.sockets.find((o) => o.cx === sk.cx + d.x && o.cz === sk.cz + d.z && o.side === OPPOSITE[sk.side]);
      if (!facing) continue;
      g.fillStyle = facing.level === sk.level ? '#8fe38a' : '#ffb347';
      const p = doorPoint(sk.cx, sk.cz, sk.side);
      dot(g, X(p.x), Y(p.z), Math.max(4, Z * 0.18));
    }
    // The cursor cell.
    g.strokeStyle = '#ffcf6a';
    g.lineWidth = 2;
    g.strokeRect(X(this.cursor.x) + 1, Y(this.cursor.z) + 1, Z - 2, Z - 2);

    this.toast.style.opacity = this.now < this.toastUntil ? '1' : '0';
  }

  /** A hand piece as a Piece with its doorways (none joined), for drawing the ghost. */
  private ghostPiece(h: HandPiece): Piece {
    const def = KIT[h.kind];
    const size = rotSize(def, h.rot);
    return {
      id: -1,
      kind: h.kind,
      gx: h.gx,
      gz: h.gz,
      rot: h.rot,
      w: size.w,
      d: size.d,
      level: h.level,
      fight: def.room,
      sockets: def.sockets.map((sk) => {
        const rs = rotSocket(def, sk, h.rot);
        return { cx: h.gx + rs.x, cz: h.gz + rs.z, side: rs.side, level: h.level + sk.rise, link: -1, linkSocket: -1 };
      }),
    };
  }

  private drawPiece(g: CanvasRenderingContext2D, p: Piece, X: (x: number) => number, Y: (z: number) => number, top: number, alpha: number): void {
    const Z = this.zoom;
    const inset = Z * 0.09;
    g.globalAlpha = alpha;
    const x0 = X(p.gx);
    const z0 = Y(p.gz);
    const w = p.w * Z;
    const d = p.d * Z;
    g.fillStyle = '#05030a';
    g.fillRect(x0, z0, w, d);
    const fill = p.kind === 'rest' ? '#d9b46a' : p.kind === 'boss' ? '#b0453c' : shade(p.level, top);
    if (p.kind === 'stair') {
      const up = rotSide('n', p.rot);
      const [ax, ay, bx, by] = up === 'n' ? [0, z0 + d, 0, z0] : up === 's' ? [0, z0, 0, z0 + d] : up === 'w' ? [x0 + w, 0, x0, 0] : [x0, 0, x0 + w, 0];
      const grad = g.createLinearGradient(ax, ay, bx, by);
      grad.addColorStop(0, shade(p.level, top));
      grad.addColorStop(1, shade(p.level + 1, top));
      g.fillStyle = grad;
    } else g.fillStyle = fill;
    g.fillRect(x0 + inset, z0 + inset, w - inset * 2, d - inset * 2);
    // Doorways: a gap through the wall where joined, a dim mark where walled up.
    for (const sk of p.sockets) {
      const pt = doorPoint(sk.cx, sk.cz, sk.side);
      const ns = sk.side === 'n' || sk.side === 's';
      const len = Z * 0.66;
      g.fillStyle = sk.link >= 0 ? shade(sk.level, top) : 'rgba(255, 207, 106, 0.35)';
      const thick = sk.link >= 0 ? inset * 2.2 : inset * 0.9;
      g.fillRect(X(pt.x) - (ns ? len / 2 : thick / 2), Y(pt.z) - (ns ? thick / 2 : len / 2), ns ? len : thick, ns ? thick : len);
    }
    const cx = x0 + w / 2;
    const cz = z0 + d / 2;
    g.fillStyle = '#1a1420';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (p.kind === 'stair') arrow(g, cx, cz, rotSide('n', p.rot), Math.min(w, d) * 0.32);
    const word = p.kind === 'entrance' ? 'IN' : p.kind === 'rest' ? 'REST' : p.kind === 'boss' ? 'WARDEN' : '';
    if (word) {
      g.font = `bold ${Math.max(10, Z * 0.42)}px monospace`;
      g.fillText(word, cx, cz);
    } else if (p.fight && Z >= 18) {
      g.fillStyle = 'rgba(200, 50, 40, 0.85)';
      dot(g, cx, cz, Z * 0.14);
    }
    if (Z >= 22) {
      g.fillStyle = 'rgba(26, 20, 32, 0.8)';
      g.font = `${Math.max(9, Z * 0.32)}px monospace`;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(`${p.level}`, x0 + inset * 1.6, z0 + inset * 1.3);
    }
    g.globalAlpha = 1;
  }
}

/** Where a doorway sits on its cell's edge, in cells. */
function doorPoint(cx: number, cz: number, side: Side): { x: number; z: number } {
  const d = SIDE_DIR[side];
  return { x: cx + 0.5 + d.x * 0.5, z: cz + 0.5 + d.z * 0.5 };
}

/** Low floors slate blue, high ones pale sand, as on the minimap. */
function shade(level: number, top: number): string {
  const t = Math.min(1, level / top);
  return `rgb(${Math.round(70 + t * 150)}, ${Math.round(78 + t * 125)}, ${Math.round(110 + t * 50)})`;
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, up: Side, size: number): void {
  const d = SIDE_DIR[up];
  g.strokeStyle = '#1a1420';
  g.lineWidth = Math.max(2, size * 0.18);
  g.beginPath();
  g.moveTo(x - d.x * size, y - d.z * size);
  g.lineTo(x + d.x * size, y + d.z * size);
  g.moveTo(x + d.x * size * 0.4 - d.z * size * 0.5, y + d.z * size * 0.4 + d.x * size * 0.5);
  g.lineTo(x + d.x * size, y + d.z * size);
  g.lineTo(x + d.x * size * 0.4 + d.z * size * 0.5, y + d.z * size * 0.4 - d.x * size * 0.5);
  g.stroke();
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
