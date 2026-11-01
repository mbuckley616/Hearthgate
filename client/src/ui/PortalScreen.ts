import { DIFFICULTIES, MAX_FLOORS, MODIFIERS, MODIFIER_IDS, SIZES, SIZE_IDS, STORY, maxDifficulty, randomOpen, type ModifierId, type PortalChoice, type SizeId, type StoryDungeon } from '@hearthgate/shared/game/portalChoice';
import { BODY_SLOT_NAMES, CATALOGUE, type BodySlot } from '@hearthgate/shared/sim/catalogue';
import { tuning, type EnemyKind } from '@hearthgate/shared/config/tuning';
import type { HandDungeon } from '@hearthgate/shared/level/handmade';
import type { ActionFrame } from '../input/actions';
import { gearIconUrl } from './gearIcons';
import { roman } from './villageWords';

type Tab = 'story' | 'random';
/** The Random tab's rows, in order; the theme is shown but locked until dungeon types arrive. */
const ROWS = ['floors', 'size', 'theme', 'difficulty', 'modifier'] as const;
/** The modifier row's choices (P8): none, then each twist. */
const MODIFIER_CHOICES: readonly (ModifierId | null)[] = [null, ...MODIFIER_IDS];

const ENEMY_NAMES: Record<EnemyKind, string> = { grunt: 'Grunts', archer: 'Archers', brute: 'Brutes', warden: 'The Warden' };
/** Themes to come (Michael's mockup), shown locked: today every dungeon is the crypt. */
const THEMES = ['Crypt', 'Caves', 'Ruins', 'Forest', 'Tombs', 'Volcanic', 'Frost', 'Swamp', 'Arcane'];

/** One icon for each reward slot: its first catalogue entry, as the bag would draw it. */
function slotIcon(slot: BodySlot): string {
  for (const e of CATALOGUE.values()) {
    if (e.slot !== slot) continue;
    const url = gearIconUrl(e);
    if (url) return `<img class="pixel-art" src="${url}" alt="">`;
  }
  return '';
}

/**
 * Keeper Wren's portal menu (P7; Michael's mockup, 28 Oct): two tabs. Story lists the curated dungeons
 * in order, each opening when the one before is cleared, with its levels, words, rewards and key
 * enemies; the player's own hand-built dungeons follow. Random shapes a run: floors, size and a
 * difficulty the shrine's tier caps; themes wait, locked. Keys and pad first (rule 4): Q and E (LB, RB)
 * change tab, up and down choose, left and right change a setting, F or A opens the portal, Esc, Tab
 * or B leave. Clicking works too.
 */
export class PortalScreen {
  private root = document.createElement('div');
  private body = document.createElement('div');
  private tab: Tab = 'story';
  private storyAt = 0;
  private row = 0;
  private floors = 3;
  private size: SizeId = 'medium';
  private difficulty = 1;
  private modifier: ModifierId | null = null;
  private repeat = 0;
  private lastDir = '';
  private cleared = new Set<string>();
  private shrineTier = 1;
  private own: HandDungeon[] = [];
  visible = false;

  constructor(
    private onChoose: (choice: PortalChoice) => void,
    private onHand: (dungeon: HandDungeon) => void,
  ) {
    this.root.className = 'equip portal-menu';
    const card = document.createElement('div');
    card.className = 'equip-card portal-card';
    const keeper = document.createElement('div');
    keeper.className = 'portal-keeper';
    keeper.innerHTML = '<h2>The Portal Keeper</h2><p>“Every gate leads somewhere. Tell me where you seek to go.”</p>';
    card.append(keeper, this.body);
    this.root.appendChild(card);
    this.root.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.root);
    this.setVisible(false);
  }

  /** Open with what the player has cleared, the shrine's tier, and their own hand-built dungeons. */
  open(cleared: readonly string[], shrineTier: number, own: readonly HandDungeon[]): void {
    this.cleared = new Set(cleared);
    this.shrineTier = shrineTier;
    this.own = own.filter((d) => !STORY.some((s) => 'hand' in s.run && s.run.hand.name === d.name));
    this.difficulty = Math.min(this.difficulty, maxDifficulty(shrineTier));
    // Start on the first story dungeon not yet cleared.
    const next = STORY.findIndex((s) => !this.cleared.has(s.id));
    this.storyAt = next < 0 ? 0 : next;
    this.setVisible(true);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
    if (v) this.render();
  }

  private isOpen(i: number): boolean {
    return i === 0 || this.cleared.has(STORY[i - 1].id);
  }

  private entries(): number {
    return STORY.length + this.own.length;
  }

  handle(actions: ActionFrame, dt: number): void {
    if (!this.visible) return;
    if (actions.pressed.has('ability1') || actions.pressed.has('ability2')) {
      this.tab = this.tab === 'story' ? 'random' : 'story';
      this.render();
      return;
    }
    const x = actions.move.x + (Math.abs(actions.look.x) > 0.001 ? Math.sign(actions.look.x) : 0);
    const y = actions.move.y + (Math.abs(actions.look.y) > 0.001 ? Math.sign(actions.look.y) : 0);
    const dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : Math.abs(y) > 0.5 ? (y > 0 ? 'up' : 'down') : '';
    if (dir && (dir !== this.lastDir || this.repeat <= 0)) {
      this.step(dir);
      this.render();
      this.repeat = dir === this.lastDir ? 0.12 : 0.35;
    }
    this.repeat -= dt;
    this.lastDir = dir;
    if (actions.pressed.has('interact')) this.choose();
  }

  private step(dir: string): void {
    if (this.tab === 'story') {
      if (dir === 'up') this.storyAt = Math.max(0, this.storyAt - 1);
      if (dir === 'down') this.storyAt = Math.min(this.entries() - 1, this.storyAt + 1);
      return;
    }
    if (dir === 'up') this.row = Math.max(0, this.row - 1);
    if (dir === 'down') this.row = Math.min(ROWS.length - 1, this.row + 1);
    if (dir === 'left' || dir === 'right') this.change(ROWS[this.row], dir === 'right' ? 1 : -1);
  }

  private change(row: (typeof ROWS)[number], by: 1 | -1): void {
    if (row === 'floors') this.floors = Math.max(1, Math.min(MAX_FLOORS, this.floors + by));
    if (row === 'size') this.size = SIZE_IDS[Math.max(0, Math.min(SIZE_IDS.length - 1, SIZE_IDS.indexOf(this.size) + by))];
    if (row === 'difficulty') this.difficulty = Math.max(0, Math.min(maxDifficulty(this.shrineTier), this.difficulty + by));
    if (row === 'modifier') this.modifier = MODIFIER_CHOICES[Math.max(0, Math.min(MODIFIER_CHOICES.length - 1, MODIFIER_CHOICES.indexOf(this.modifier) + by))];
  }

  /** F or A: open the chosen portal (a locked story dungeon stays shut). */
  private choose(): void {
    if (this.tab === 'random') {
      if (!randomOpen(this.shrineTier)) return;
      this.onChoose({ kind: 'random', floors: this.floors, size: this.size, difficulty: this.difficulty, modifier: this.modifier });
      return;
    }
    if (this.storyAt >= STORY.length) {
      this.onHand(this.own[this.storyAt - STORY.length]);
      return;
    }
    if (this.isOpen(this.storyAt)) this.onChoose({ kind: 'story', id: STORY[this.storyAt].id });
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el) return;
    const act = el.dataset.act!;
    if (act === 'tab') this.tab = el.dataset.tab as Tab;
    if (act === 'story') this.storyAt = Number(el.dataset.i);
    if (act === 'set') {
      this.row = ROWS.indexOf(el.dataset.row as (typeof ROWS)[number]);
      const row = ROWS[this.row];
      if (row === 'size') this.size = el.dataset.value as SizeId;
      if (row === 'difficulty' && Number(el.dataset.value) <= maxDifficulty(this.shrineTier)) this.difficulty = Number(el.dataset.value);
      if (row === 'floors') this.change('floors', el.dataset.value === '+' ? 1 : -1);
      if (row === 'modifier') this.modifier = el.dataset.value ? (el.dataset.value as ModifierId) : null;
    }
    if (act === 'open') this.choose();
    this.render();
  }

  private storyRow(s: StoryDungeon, i: number): string {
    const open = this.isOpen(i);
    const done = this.cleared.has(s.id);
    const mark = done ? '✓' : open ? '' : '🔒';
    return `<button class="portal-entry${i === this.storyAt ? ' chosen' : ''}${open ? '' : ' locked'}" data-act="story" data-i="${i}">
        <span class="portal-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="portal-entry-name"><b>${s.name}</b><small>Lv. ${s.levels[0]}–${s.levels[1]}</small></span>
        <span class="portal-mark">${mark}</span>
      </button>`;
  }

  private storyDetail(): string {
    if (this.storyAt >= STORY.length) {
      const d = this.own[this.storyAt - STORY.length];
      return `<h3>${d.name}</h3><div class="muted">Your own dungeon, from the editor · ${d.floors.length} floor${d.floors.length === 1 ? '' : 's'}</div>
        <p>Laid out by your hand. Every floor as you left it.</p>
        <button class="portal-open" data-act="open">Open portal <kbd>F</kbd></button>`;
    }
    const s = STORY[this.storyAt];
    const open = this.isOpen(this.storyAt);
    const floors = 'hand' in s.run ? s.run.hand.floors.length : s.run.floors;
    const rewards = s.rewards.map((slot) => `<span class="portal-reward" title="${BODY_SLOT_NAMES[slot]}">${slotIcon(slot)}<small>${BODY_SLOT_NAMES[slot]}</small></span>`).join('');
    const enemies = s.enemies.map((k) => `<span class="portal-enemy">${ENEMY_NAMES[k]}</span>`).join('');
    const action = open
      ? `<button class="portal-open" data-act="open">Open portal <kbd>F</kbd></button>`
      : `<div class="portal-locked">Clear ${STORY[this.storyAt - 1].name} to open this one.</div>`;
    const twist = s.run.modifier ? ` · <span class="portal-twist">${MODIFIERS[s.run.modifier].name}: ${MODIFIERS[s.run.modifier].words}</span>` : '';
    return `<h3>${s.name}</h3><div class="muted">Lv. ${s.levels[0]}–${s.levels[1]} · ${floors} floor${floors === 1 ? '' : 's'} · ${DIFFICULTIES[s.run.difficulty].name}${twist}</div>
      <p>${s.blurb}</p>
      <h4>Potential rewards</h4><div class="portal-rewards">${rewards}</div>
      <h4>Key enemies</h4><div class="portal-enemies">${enemies}</div>
      ${action}`;
  }

  private randomHtml(): string {
    const cap = maxDifficulty(this.shrineTier);
    const chosen = (r: (typeof ROWS)[number]) => (ROWS[this.row] === r ? ' chosen' : '');
    const sizes = SIZE_IDS.map(
      (id) => `<button class="portal-opt${this.size === id ? ' on' : ''}" data-act="set" data-row="size" data-value="${id}">${SIZES[id].name}<small>${SIZES[id].rooms}</small></button>`,
    ).join('');
    const themes = THEMES.map((t, i) => `<span class="portal-theme${i === 0 ? ' on' : ' locked'}">${t}${i === 0 ? '' : '<small>later</small>'}</span>`).join('');
    const mods = MODIFIER_CHOICES.map(
      (m) => `<button class="portal-opt${this.modifier === m ? ' on' : ''}" data-act="set" data-row="modifier" data-value="${m ?? ''}">${m ? MODIFIERS[m].name : 'None'}<small>${m ? MODIFIERS[m].words : 'as it comes'}</small></button>`,
    ).join('');
    const diffs = DIFFICULTIES.map((d, i) => {
      const locked = i > cap;
      const pct = Math.round((d.mult - 1) * 100);
      return `<button class="portal-opt${this.difficulty === i ? ' on' : ''}${locked ? ' locked' : ''}" data-act="set" data-row="difficulty" data-value="${i}">${d.name}<small>${locked ? `shrine tier ${i}` : pct === 0 ? 'as it comes' : `${pct > 0 ? '+' : ''}${pct}%`}</small></button>`;
    }).join('');
    return `<p class="muted">Let the portal reshape itself. No two runs the same.</p>
      <div class="portal-row${chosen('floors')}"><h4>1. Floor count</h4><div class="portal-floors">
        <button class="portal-step" data-act="set" data-row="floors" data-value="-">◀</button><b>${this.floors}</b><button class="portal-step" data-act="set" data-row="floors" data-value="+">▶</button><small>1 – ${MAX_FLOORS}</small></div></div>
      <div class="portal-row${chosen('size')}"><h4>2. Dungeon size</h4><div class="portal-opts">${sizes}</div></div>
      <div class="portal-row${chosen('theme')}"><h4>3. Theme</h4><div class="portal-themes">${themes}</div></div>
      <div class="portal-row${chosen('difficulty')}"><h4>4. Difficulty <span class="muted">stronger enemies, better rewards</span></h4><div class="portal-opts">${diffs}</div></div>
      <div class="portal-row${chosen('modifier')}"><h4>5. Modifier <span class="muted">a twist on the run</span></h4><div class="portal-opts">${mods}</div></div>
      <button class="portal-open" data-act="open">Reshape portal <kbd>F</kbd></button>`;
  }

  private render(): void {
    const tabs = `<div class="portal-tabs">
        <button class="portal-tab${this.tab === 'story' ? ' on' : ''}" data-act="tab" data-tab="story">Story dungeons</button>
        <button class="portal-tab${this.tab === 'random' ? ' on' : ''}${randomOpen(this.shrineTier) ? '' : ' locked'}" data-act="tab" data-tab="random">Random dungeon</button>
        <span class="muted">Q / E to switch · Esc to leave</span>
      </div>`;
    if (this.tab === 'random') {
      // Locked until the Portal's third tier (Michael, 31 Oct, A): the tab says when, the story list stays open.
      const shut = `<div class="portal-random portal-shut"><p><b>Opens at Portal tier ${roman(tuning.village.randomFromTier)}</b></p><p class="muted">Raise the Portal Shrine at Keeper Wren's to let the portal reshape itself. Until then, the story dungeons.</p></div>`;
      this.body.innerHTML = `${tabs}${randomOpen(this.shrineTier) ? `<div class="portal-random">${this.randomHtml()}</div>` : shut}`;
      return;
    }
    const list = STORY.map((s, i) => this.storyRow(s, i)).join('');
    const own = this.own
      .map(
        (d, n) =>
          `<button class="portal-entry${STORY.length + n === this.storyAt ? ' chosen' : ''}" data-act="story" data-i="${STORY.length + n}"><span class="portal-num">✎</span><span class="portal-entry-name"><b>${d.name}</b><small>your own</small></span></button>`,
      )
      .join('');
    this.body.innerHTML = `${tabs}<div class="portal-story">
        <div class="portal-list">${list}${own ? `<h4>Your dungeons</h4>${own}` : ''}</div>
        <div class="portal-detail">${this.storyDetail()}</div>
      </div>`;
    this.body.querySelector('.portal-entry.chosen')?.scrollIntoView({ block: 'nearest' });
  }
}
