import * as THREE from 'three';
import { Music, type Mood } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { OrbitCamera } from '../camera/OrbitCamera';
import { tuning } from '@hearthgate/shared/config/tuning';
import { DebugPanel } from '../debug/DebugPanel';
import { HitboxOverlay } from '../debug/HitboxOverlay';
import { GamepadSource } from '../input/GamepadSource';
import { InputManager } from '../input/InputManager';
import { KeyboardMouseSource } from '../input/KeyboardMouseSource';
import { emptyFrame, type ActionFrame } from '../input/actions';
import { nameOf } from '../ui/gearText';
import type { World } from '@hearthgate/shared/level/arena';
import { TALK_RANGE, type Villager } from '@hearthgate/shared/level/village';
import { AmbientView } from '../render/AmbientView';
import { DropView } from '../render/DropView';
import { EnemiesView } from '../render/EnemyView';
import { FxView } from '../render/FxView';
import { HeroView } from '../render/HeroView';
import { Nameplate } from '../render/Nameplate';
import { ProjectileView } from '../render/ProjectileView';
import { Palette } from '../render/props';
import { FloorView } from '../render/FloorView';
import { PropView } from '../render/PropView';
import { RoomView } from '../render/RoomView';
import { PortalView } from '../render/PortalView';
import { VillageView } from '../render/VillageView';
import { setLookMood } from '../render/look';
import { SceneRenderer } from '../render/SceneRenderer';
import { TelegraphView } from '../render/TelegraphView';
import { rollGear } from '@hearthgate/shared/sim/catalogue';
import type { PlayerCommand, PlayerState, SimEvent, SimState } from '@hearthgate/shared/sim/types';
import { slotsOpen } from '@hearthgate/shared/sim/coop';
import { worldNow } from '@hearthgate/shared/sim/world';
import { flowTier } from '@hearthgate/shared/sim/flow';
import { CrtOverlay } from '../ui/CrtOverlay';
import { EquipScreen } from '../ui/EquipScreen';
import { Hud } from '../ui/Hud';
import { Reticle } from '../ui/Reticle';
import { freeAimFrom, type FreeAim } from './aim';
import { Minimap } from '../ui/Minimap';
import { PartyUi } from '../ui/PartyUi';
import { RunUi } from '../ui/RunUi';
import { RunSummary, newTally, type RunTally } from '../ui/RunSummary';
import { VillagePanel } from '../ui/VillagePanel';
import { BUILDING_NAMES, capital, roman } from '../ui/villageWords';
import { tierGives, upgradeCost, upgradeProblem, type BuildingId } from '@hearthgate/shared/game/villageSave';
import { Settings } from '../ui/Settings';
import { TitleScreen } from '../ui/TitleScreen';
import { TalkUi } from '../ui/TalkUi';
import { FINAL_WAVE } from '@hearthgate/shared/sim/run';
import { isServerTuning } from '@hearthgate/shared/config/edits';
import type { Cheat } from '@hearthgate/shared/net/protocol';
import { ClientSession } from './ClientSession';
import { findDungeon, playableDungeons } from '../editor/store';
import { LockOn } from './LockOn';
import { Profile } from './Profile';

/** Another player's hero on screen. */
interface RemoteHero {
  view: HeroView;
  plate: Nameplate;
}

/**
 * Client loop: input -> commands -> session (a joiner's prediction plus the
 * server's snapshots) -> interpolated render. The fight runs on Hearthgate's
 * server, so every player is the slice's joiner; solo is a room of one.
 *
 * Since T3 the session moves between rooms (the village, a dungeon run, home
 * again); whenever it joins one, enterLevel() rebuilds what belongs to a level
 * (its room view, embers and dust, floor telegraphs, the camera's walls and the
 * lighting mood) and drops what was the old room's.
 */
export class Game {
  /** First, so saved settings are in tuning before anything reads it. */
  private readonly settings = new Settings();
  private readonly session: ClientSession;
  private readonly music = new Music();
  private readonly title: TitleScreen;
  /** The controls list, shown from the title screen or the pause menu. */
  private readonly controlsEl: HTMLElement;
  private titleTime = 0;
  /** Button presses waiting for the next sim tick (a frame can run zero ticks). */
  private pending = Game.noPresses();
  private lastTime = performance.now();
  private presentTime = 0;

  private readonly input = new InputManager();
  private readonly kbm: KeyboardMouseSource;
  private readonly cam: OrbitCamera;
  private readonly gfx: SceneRenderer;
  private room: RoomView | VillageView | FloorView;
  private ambient: AmbientView;
  /** Which level's world the views were built for (a new floor is a new world), and the session's room count they last followed. */
  private builtWorld: World;
  private shownLevel = 0;
  /** The open rings: one in the village or the arena, two in a rest room (T4). */
  private readonly portals = [new PortalView(), new PortalView()];
  private readonly minimap = new Minimap();
  private readonly talk = new TalkUi();
  private readonly hero: HeroView;
  private readonly remoteHeroes = new Map<string, RemoteHero>();
  private readonly palette: Palette;
  private readonly projectiles: ProjectileView;
  private readonly enemies: EnemiesView;
  private telegraphs: TelegraphView;
  private readonly runUi = new RunUi();
  private readonly summary = new RunSummary();
  /**
   * Whether the village the party is in, or last set out from, is this browser's own (its room says
   * so, P2): lumber and stone banked on its runs are added to the save here as they are banked.
   */
  private homeIsOurs = false;
  private readonly villagePanel = new VillagePanel();
  private shownVillage = -1;
  /** How long talk has been held at a building's keeper, and whether this hold has already built (P4). */
  private holdS = 0;
  private holdDone = false;
  /** The run's tally so far; null outside a run. */
  private tally: RunTally | null = null;
  private lastKind = '';
  private readonly drops = new DropView();
  /** A generated floor's crates, barrels and urns, and the potions out of them (D4); null elsewhere. */
  private propView: PropView | null = null;
  private readonly profile = new Profile();
  private readonly equip: EquipScreen;
  private readonly party: PartyUi;
  private saveTimer = 0;
  private readonly fx: FxView;
  private readonly hitboxes = new HitboxOverlay();
  private readonly sfx = new Sfx();
  private readonly hud = new Hud();
  private readonly reticle = new Reticle();
  /** Free aim (D12): what the screen's centre pointed at last frame, while a ranged weapon is out unlocked. */
  private aim: FreeAim | null = null;
  private readonly crt = new CrtOverlay();
  private readonly lockOn = new LockOn();
  private readonly debug: DebugPanel;
  private readonly overlay: HTMLElement;
  private endedHandled = false;
  /** The run's phase last frame: a won or lost run going back to the antechamber is a restart. */
  private lastPhase = '';
  /** The party wiped on a generated floor (D10): the mouse is freed for the end card's button. */
  private wiped = false;
  private shownTuning = 0;
  /** When the last animation frame ran (the worker takes over if they stop). */
  private lastFrameAt = performance.now();

  constructor(container: HTMLElement) {
    // A ?join=CODE link joins a friend's room; anything else makes a village of our own on the server (solo until someone joins).
    const params = new URLSearchParams(location.search);
    const join = params.get('join');
    // ?dungeon (with ?play) makes the slice's arena straight away: the lab and the browser tests start in a fight.
    // ?floor makes a generated floor (T4), ?seed=N&pieces=N picking which: the gate's five floors.
    const create = params.has('floor') ? 'floor' : params.has('dungeon') ? 'dungeon' : 'village';
    const num = (k: string) => (params.has(k) ? Number(params.get(k)) : undefined);
    // ?hand=NAME plays a hand-built dungeon from this browser or the game's own (the editor's Play, T4b).
    const hand = params.has('hand') ? findDungeon(params.get('hand')!) : null;
    const floorOptions = { seed: num('seed') ?? Math.floor(Math.random() * 1e9), pieces: num('pieces'), floors: num('floors'), floor: num('at'), ...(hand ? { hand } : {}) };
    this.session = new ClientSession(join ? join.toUpperCase() : null, this.profile.loadout(), undefined, create, create === 'floor' ? floorOptions : {});
    this.session.setVillageSave(this.profile.village);
    this.builtWorld = this.world;
    setLookMood(this.session.kind);

    const level = this.world.level;
    this.cam = new OrbitCamera(window.innerWidth / window.innerHeight, this.world.colliders, (level.spawn.yawDeg * Math.PI) / 180);
    this.gfx = new SceneRenderer(container, this.cam.camera, level.floorSize / 2);
    this.palette = new Palette(this.gfx.envMap);
    this.room = this.buildRoomView();
    this.ambient = new AmbientView(this.room.fireSources, level.floorSize / 2);
    this.buildPropView();
    this.enemies = new EnemiesView(this.palette);
    this.telegraphs = new TelegraphView(this.world);
    this.hero = new HeroView(this.palette);
    this.projectiles = new ProjectileView(this.palette);
    this.fx = new FxView(this.cam.camera);
    this.gfx.scene.add(
      this.room.group,
      this.ambient.group,
      this.hero.root,
      this.hero.effects,
      this.enemies.group,
      this.telegraphs.group,
      this.drops.group,
      this.projectiles.group,
      this.fx.group,
      this.hitboxes.lines,
      this.lockOn.marker,
      ...this.portals.map((p) => p.group),
    );

    const canvas = this.gfx.renderer.domElement;
    this.kbm = new KeyboardMouseSource(canvas);
    this.input.add(this.kbm);
    this.input.add(new GamepadSource());

    // Debug tools change the fight itself, so the server runs them (in a dev build only).
    const cheat = (c: Cheat) => () => this.session.request({ k: 'cheat', cheat: c });
    this.debug = new DebugPanel({
      'Restart run': cheat('restart'),
      'Skip to wave 2': cheat('wave2'),
      'Skip to wave 3': cheat('wave3'),
      'Skip to the Warden': cheat('warden'),
      'Spawn grunt group': cheat('spawnGrunts'),
      'Spawn brute ahead': cheat('spawnBrute'),
      'Spawn archer on ledge': cheat('spawnArcher'),
      '+1000 XP to current hero': () => {
        const p = this.me();
        if (!p) return;
        this.profile.syncFrom(p);
        this.profile.data.xp[p.style] += 1000;
        this.profile.save();
        this.applyProfile(false);
      },
      'Give a rare item': () => {
        this.profile.addItem(rollGear(Math.random, true));
        this.applyProfile(false);
      },
      'Reset saved progress': () => {
        this.profile.reset();
        this.applyProfile(true);
      },
      'Kill all enemies': cheat('killAll'),
    }, (path, value) => this.tune(path, value));
    this.equip = new EquipScreen(
      this.profile,
      () => this.applyProfile(this.session.view().curr.run.phase === 'ante'),
      () => slotsOpen(this.session.view().curr, !!this.world.level.village),
      (item) => this.session.request({ k: 'drop', item }),
    );
    // Every player may invite: the room is the server's, not one player's.
    this.party = new PartyUi(this.profile.data.name, {
      invite: () => (this.session.code ? Promise.resolve(this.session.code) : Promise.reject(new Error('not connected yet'))),
      rename: (name) => {
        this.profile.data.name = name;
        this.profile.save();
        this.applyProfile(false);
      },
      playSolo: () => {
        location.href = `${location.origin}${location.pathname}`;
      },
    });
    this.controlsEl = Game.buildControls();
    this.overlay = this.buildOverlay(container);
    this.sfx.onUnlock = (ctx, noise) => this.music.attach(ctx, noise);
    this.title = new TitleScreen(
      {
        play: () => this.leaveTitle(),
        host: () => {
          this.leaveTitle(false);
          this.party.inviteNow();
        },
        join: (code) => {
          location.href = `${location.origin}${location.pathname}?join=${code}`;
        },
      },
      this.settings.panel,
      this.controlsEl,
    );
    // Following a join link skips the title; so does ?play (the tests and the lag lab).
    if (join || params.has('play')) this.title.setVisible(false);
    // Ctrl is dodge, and browsers never let a page block Ctrl+W: ask before leaving mid-play.
    window.addEventListener('beforeunload', (e) => {
      if (!this.kbm.pointerLocked) return;
      e.preventDefault();
      e.returnValue = '';
    });
    canvas.addEventListener('click', () => this.kbm.requestPointerLock());
    this.runUi.onHome = () => this.session.request({ k: 'home' });
    document.addEventListener('pointerlockchange', () => this.updateOverlay());
    window.addEventListener('resize', () => {
      this.cam.setAspect(window.innerWidth / window.innerHeight);
      this.gfx.resize(window.innerWidth, window.innerHeight);
    });

    // Handy for poking at state from the console; also proves it serializes.
    Object.assign(window, { game: this, tuning });
  }

  start(): void {
    this.lastTime = performance.now();
    this.updateOverlay();
    requestAnimationFrame(this.frame);
    this.keepAliveWhenHidden();
  }

  /**
   * Browsers stop animation frames in background tabs and covered windows,
   * which would freeze the fight for everyone if the host tabs away. A
   * worker's timer isn't paused, so when frames stall it drives the loop
   * (without drawing).
   */
  private keepAliveWhenHidden(): void {
    try {
      const src = 'setInterval(() => postMessage(0), 1000 / 60);';
      const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = () => {
        const now = performance.now();
        if (now - this.lastFrameAt > 100) this.update(now, false);
      };
    } catch {
      // No workers: a hidden host just pauses.
    }
  }

  /** JSON snapshot of the fight as this player sees it. */
  snapshot(): string {
    return JSON.stringify(this.session.view().curr);
  }

  /** The level the session is in now (it changes at each portal). */
  private get world(): World {
    return this.session.world;
  }

  /** The props of the floor the session is on, in place of the last floor's. */
  private buildPropView(): void {
    if (this.propView) {
      this.gfx.scene.remove(this.propView.group);
      disposeTree(this.propView.group);
    }
    const props = this.world.level.dungeon?.props;
    this.propView = props ? new PropView(props) : null;
    if (this.propView) this.gfx.scene.add(this.propView.group);
  }

  private buildRoomView(): RoomView | VillageView | FloorView {
    if (this.world.level.village) return new VillageView(this.world, this.palette);
    return this.world.level.dungeon ? new FloorView(this.world) : new RoomView(this.world);
  }

  /**
   * The session joined a room (the first, or the next through a portal): rebuild the views that
   * belong to a level when it changed, and drop everything that was the old room's (the other
   * heroes, the lock, the gear screen, a villager's words), facing the camera the way the level does.
   */
  private enterLevel(): void {
    this.shownLevel = this.session.levelVersion;
    const kind = this.session.kind;
    const level = this.world.level;
    if (this.world !== this.builtWorld) {
      this.builtWorld = this.world;
      this.gfx.scene.remove(this.room.group, this.ambient.group, this.telegraphs.group);
      for (const g of [this.room.group, this.ambient.group, this.telegraphs.group]) disposeTree(g);
      this.room = this.buildRoomView();
      // A new village view shows its tiers from the village the room last sent.
      this.shownVillage = -1;
      this.ambient = new AmbientView(this.room.fireSources, level.floorSize / 2);
      this.telegraphs = new TelegraphView(this.world);
      this.gfx.scene.add(this.room.group, this.ambient.group, this.telegraphs.group);
      this.buildPropView();
      // A generated floor is too big for one shadow map: the shadows follow the hero over a room's width instead.
      this.gfx.setLevel(level.dungeon ? 26 : level.floorSize / 2);
      if (!level.dungeon) this.gfx.followShadow(0, 0);
      setLookMood(kind);
    }
    this.minimap.setFloor(level.dungeon ?? null);
    this.runUi.setFloor(level.dungeon?.def.spec ?? null);
    this.runTally(kind);
    for (const [id, r] of this.remoteHeroes) {
      this.gfx.scene.remove(r.view.root, r.view.effects);
      r.plate.dispose();
      this.remoteHeroes.delete(id);
    }
    this.lockOn.targetId = -1;
    this.equip.setVisible(false);
    this.talk.clear();
    this.lastPhase = '';
    this.pending = Game.noPresses();
    this.cam.setColliders(this.world.colliders);
    this.cam.yaw = (level.spawn.yawDeg * Math.PI) / 180 + Math.PI;
  }

  /**
   * A run is village to village (P1): leaving a village for a floor starts its tally, and the first
   * village after it shows the summary. Lumber and stone go to our own village, as its room said it was.
   */
  private runTally(kind: string): void {
    if (kind === 'village') {
      if (this.tally && (this.tally.banked > 0 || this.tally.lost > 0 || this.tally.deepest > 0)) this.summary.show(this.tally);
      this.tally = null;
    } else if (kind === 'floor') {
      if (this.lastKind === 'village' || !this.tally) {
        this.tally = newTally();
        this.tally.ownVillage = this.homeIsOurs;
      }
      const spec = this.world.level.dungeon?.def.spec;
      if (spec) {
        this.tally.deepest = Math.max(this.tally.deepest, spec.floor);
        this.tally.floors = spec.floors;
      }
    }
    this.lastKind = kind;
  }

  /**
   * Talking (T3), and Keeper Wren's ring (T4b): asked once she says where the ring opens now; asked
   * again while she is speaking she turns it to the next dungeon (a new generated one, then the
   * hand-built ones this browser can play). The server checks the layout and every ring follows.
   */
  private talkTo(near: Villager | null, pressed: boolean, held: boolean, dt: number): void {
    const hold = this.upgradeHold(near, held, dt);
    if (!near || !pressed) return this.talk.update(near, false, dt, hold);
    const about = near.building && this.session.village ? ` ${this.buildingWords(near.building, near.name)}` : '';
    if (near.id !== 'keeper') {
      this.talk.say(near.name, near.line + about);
      return this.talk.update(near, false, dt, hold);
    }
    const NEW = 'A new dungeon';
    const now = this.session.portals[0]?.label ?? NEW;
    if (!this.talk.showing(near.name)) {
      this.talk.say(near.name, `${near.line} Just now it opens on ${now === NEW ? 'a new dungeon, never walked before' : now}; ask again and I will turn it.${about}`);
    } else {
      const options = [null, ...playableDungeons()];
      const at = options.findIndex((d) => (d?.name ?? NEW) === now);
      const next = options[(at + 1) % options.length];
      this.session.request({ k: 'destination', dungeon: next });
      this.talk.say(near.name, `There: the ring opens on ${next ? next.name : 'a new dungeon, never walked before'}. Ask again for another.`);
    }
    this.talk.update(near, false, dt, hold);
  }

  /**
   * A building's keeper on its tier (P4): what it gives now and what the next would, at what price,
   * and whether its owner can pay. A visitor hears it is the host's to build.
   */
  private buildingWords(building: BuildingId, keeper: string): string {
    const v = this.session.village!;
    const tier = v.view.tiers[building];
    const name = BUILDING_NAMES[building];
    const now = `The ${name} stands at tier ${roman(tier)}: ${tierGives(building, tier)}.`;
    if (tier >= tuning.village.maxTier) return `${now} That is as high as it goes for now.`;
    const c = upgradeCost(tier + 1);
    const next = `Tier ${roman(tier + 1)} would bring ${tierGives(building, tier + 1)}, for ${c.lumber} lumber, ${c.stone} stone and ${c.coin} coin.`;
    if (!v.yours) return `${now} ${next} Only ${v.host || 'the host'} can build here.`;
    const problem = upgradeProblem(v.view, building, this.profile.data.coin);
    return `${now} ${next} ${problem ? `You need ${problem}.` : `Hold F (or A) with ${keeper} and it is done.`}`;
  }

  /**
   * The owner holds talk at a building's keeper to raise its tier (P4): a hold, not a press, so
   * spending is never an accident. Returns the hint for the hold, or null where there is none.
   */
  private upgradeHold(near: Villager | null, held: boolean, dt: number): { text: string; frac: number } | null {
    const v = this.session.village;
    const building = near?.building;
    if (!near || !building || !v?.yours || v.view.tiers[building] >= tuning.village.maxTier) {
      this.holdS = 0;
      return null;
    }
    const text = `build tier ${roman(v.view.tiers[building] + 1)}`;
    if (!held) {
      this.holdS = 0;
      this.holdDone = false;
      return { text, frac: 0 };
    }
    if (this.holdDone) return { text, frac: 0 };
    this.holdS += dt;
    const frac = Math.min(1, (this.holdS * 1000) / Math.max(1, tuning.village.upgradeHoldMs));
    if (frac < 1) return { text, frac };
    this.holdDone = true;
    this.holdS = 0;
    const problem = upgradeProblem(v.view, building, this.profile.data.coin);
    if (problem) this.talk.say(near.name, `Not yet: you need ${problem}.`);
    else this.session.request({ k: 'upgrade', building, coin: this.profile.data.coin });
    return { text, frac: 0 };
  }

  /** The room built what the owner asked for (P4): pay its coin from the save and say so. */
  private payUpgrades(): void {
    for (const u of this.session.upgraded.splice(0)) {
      this.profile.data.coin = Math.max(0, this.profile.data.coin - u.coin);
      this.profile.save();
      const keeper = this.world.level.village?.villagers.find((n) => n.building === u.building);
      this.hud.toast(`<b>${BUILDING_NAMES[u.building]}: tier ${roman(u.tier)}</b><span>${tierGives(u.building, u.tier)}  ·  -${u.coin} coin</span>`, 'level');
      if (keeper) this.talk.say(keeper.name, `Done: the ${BUILDING_NAMES[u.building]} stands at tier ${roman(u.tier)} now. ${capital(tierGives(u.building, u.tier))}.`);
    }
  }

  /** The villager the hero can talk to now: the nearest in reach, in the village. */
  private villagerInReach(me: PlayerState | null): Villager | null {
    const v = this.world.level.village;
    if (!v || !me || me.mode === 'down') return null;
    let best: Villager | null = null;
    let bestD = TALK_RANGE;
    for (const n of v.villagers) {
      const d = Math.hypot(n.x - me.x, n.z - me.z);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  /** The local hero, latest state (predicted on a joiner). */
  private me(): PlayerState | null {
    return this.session.hero()?.curr ?? null;
  }

  private frame = (now: number) => {
    requestAnimationFrame(this.frame);
    this.lastFrameAt = performance.now();
    this.update(now, true);
  };

  private update(now: number, draw: boolean): void {
    // Clamp both ways: long stalls shouldn't teleport, and out-of-order timestamps
    // must never produce a negative dt (it explodes the exponential smoothing).
    const realDt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    let actions = this.input.poll(realDt);
    if (this.session.levelVersion !== this.shownLevel) this.enterLevel();
    if (this.title.visible) {
      this.titleFrame(realDt, draw);
      return;
    }
    this.handleMetaActions(actions);
    // The bag and body take the keys and the pad while they are open (T5b): the hero stands still.
    if (this.equip.visible) {
      this.equip.handle(actions, realDt);
      actions = emptyFrame();
    }

    // Slow motion is the server's (debug.slowMo through the panel or backslash); each snapshot says how fast it runs.
    const timeScale = this.session.timeScale;
    const dt = realDt * timeScale;
    this.presentTime += dt;

    // Lock-on: toggle, validate, flick to switch; then hand the camera its framing point.
    let world = this.session.view().curr;
    const me0 = this.me();
    if (me0) {
      if (actions.pressed.has('lockOn')) {
        const b = this.cam.basis();
        this.lockOn.toggle(world, me0, { x: b.fx, z: b.fz });
      }
      this.lockOn.update(world, me0, actions.look.x, realDt);
    }
    this.cam.setLock(this.lockOn.lookPoint(world));
    this.cam.applyLook(actions.look);
    if (actions.pressed.has('zoomIn')) this.cam.zoomBy(1);
    if (actions.pressed.has('zoomOut')) this.cam.zoomBy(-1);
    if (actions.pressed.has('dodge')) this.pending.dodge = true;
    if (actions.pressed.has('attack')) this.pending.attack = true;
    if (actions.pressed.has('jump')) this.pending.jump = true;
    if (actions.pressed.has('ability1')) this.pending.ability1 = true;
    if (actions.pressed.has('ability2')) this.pending.ability2 = true;
    if (actions.pressed.has('ability3')) this.pending.ability3 = true;
    // The hero screen has the d-pad's left for its first tab.
    if (actions.pressed.has('drink') && !this.equip.visible) this.pending.drink = true;
    // The hero fights with the weapon in hand (T5): after a change on the hero screen, or on joining, follow it.
    // Mid-fight the server holds the change until the fight is over (C3), so it is asked for again each tick.
    const meNow = this.me();
    if (meNow && !this.pending.swapTo && meNow.mode !== 'down' && meNow.style !== this.profile.style) this.pending.swapTo = this.profile.style;
    const cmd = this.buildCommand(actions);

    // Run the fight (host) or predict our hero (joiner); collect what happened.
    const result = this.session.advance({ ...cmd, ...this.pending }, dt);
    if (result.ticks > 0) this.pending = Game.noPresses();
    const localId = this.session.localId;
    // Loot is personal: only our own drops make a beam and a sound.
    const events = result.events.filter((ev) => !(ev.kind === 'dropSpawned' && ev.owner !== localId));

    const view = this.session.view();
    world = view.curr;
    const heroBlend = this.session.hero();
    const curr = heroBlend?.curr ?? null;

    // React to what happened.
    this.cameraFeel(events, localId);
    this.fx.handle(events, world);
    this.sfx.handle(events, localId);
    this.hud.handle(events, localId, world);
    this.runUi.handle(events);
    this.progress(events, realDt);
    // Run over: anyone's F / A asks the server to start again (the slice's host did it itself); the view follows the snapshot.
    const village = !!this.world.level.village;
    // On a generated floor F, A or the end card's button goes home instead (D10).
    if (!village && (world.run.phase === 'won' || world.run.phase === 'lost') && actions.pressed.has('interact')) {
      this.session.request(this.world.level.dungeon ? { k: 'home' } : { k: 'restart' });
    }
    const wiped = !!this.world.level.dungeon && world.run.phase === 'lost';
    if (wiped !== this.wiped) {
      this.wiped = wiped;
      if (wiped) this.kbm.exitPointerLock();
      this.updateOverlay();
    }
    // The run's summary takes the first F (or A, or Escape) home, before any villager does.
    const closeSummary = this.summary.visible && (actions.pressed.has('interact') || actions.pressed.has('menuBack'));
    if (closeSummary) this.summary.hide();
    this.talkTo(this.villagerInReach(this.me()), actions.pressed.has('interact') && !closeSummary, actions.held.has('interact') && !closeSummary, realDt);
    if ((this.lastPhase === 'won' || this.lastPhase === 'lost') && world.run.phase === 'ante') this.restarted();
    this.lastPhase = world.run.phase;

    // Present.
    this.palette.update();
    if (heroBlend) this.hero.update(heroBlend.prev, heroBlend.curr, heroBlend.alpha, dt);
    this.hero.root.visible = !!heroBlend;
    this.updateRemoteHeroes(view.prev, world, view.alpha, dt, localId);
    this.enemies.update(view.prev.enemies, world.enemies, view.alpha, dt, world.time);
    this.projectiles.update(view.prev, world, view.alpha, dt);
    this.fx.update(dt);
    this.ambient.update(dt);
    this.hitboxes.update(world);
    this.telegraphs.update(world.enemies, this.presentTime);
    this.drops.update(
      world.drops.filter((d) => d.owner === localId),
      this.presentTime,
    );
    this.propView?.update(world.floor, this.presentTime);
    this.syncVillage();
    this.payUpgrades();
    if (village) this.runUi.hide();
    else this.runUi.update(world, realDt, 'host', world.floor?.carried[localId]?.length ?? 0);
    this.portals.forEach((v, i) => v.update(this.session.portals[i] ?? null, dt));
    if (actions.pressed.has('map')) this.minimap.toggle();
    this.minimap.update(world, curr, localId, this.session.portals, realDt);
    this.lockOn.updateMarker(world, dt);
    const ended = this.session.ended;
    this.party.update(this.session.status(), world, curr, localId, ended);
    if (ended && !this.endedHandled) {
      this.endedHandled = true;
      this.kbm.exitPointerLock();
    }
    if (curr) {
      const inRun = world.run.phase === 'intro' || world.run.phase === 'wave' || world.run.phase === 'rest';
      this.hud.update(curr, realDt, inRun);
      const mv = tuning.movement;
      const sprint = Math.min(1, Math.max(0, (Math.hypot(curr.vx, curr.vz) - mv.runSpeed) / Math.max(0.1, mv.sprintSpeed - mv.runSpeed)));
      this.cam.setColliders(worldNow(this.world, world).colliders);
      this.cam.update(realDt, this.hero.root.position, sprint);
    }
    // Free aim (D12): over the shoulder, and the reticle pinned to the centre, where the shots go.
    const free = !!curr && tuning.camera.freeAim && curr.style !== 'sword' && !this.lockOn.locked;
    this.cam.setShoulder(free);
    this.aim = free && curr ? freeAimFrom(this.cam.camera, curr, world, worldNow(this.world, world).colliders) : null;
    const aim = this.cam.basis();
    this.reticle.update(this.cam.camera, world, curr, this.hero.root.position, { x: aim.fx, z: aim.fz }, this.lockOn.targetId, !this.equip.visible && !ended && this.overlay.style.display === 'none', realDt, this.aim);
    if (this.room instanceof FloorView) {
      this.room.sync(world.floor && world.run.gateClosed ? world.floor.room : -1, this.hero.root.position);
      this.gfx.followShadow(this.hero.root.position.x, this.hero.root.position.z);
    }
    this.room.update(realDt, this.presentTime, this.cam.occluders, world.run.gateClosed);
    if (draw) this.gfx.render();
    this.crt.update();
    this.music.setMood(Game.moodFor(world));
    this.music.setFlow(flowTier(this.me() ?? undefined));
    this.music.update(realDt);

    this.debug.setExtra(
      `${this.session.status()}\n` +
        (curr
          ? `tick ${world.tick}  speed ${Math.hypot(curr.vx, curr.vz).toFixed(2)} m/s\n` +
            `cam dist ${this.cam.currentDistance.toFixed(2)} m  dodges ${curr.dodgeCharges}/${tuning.dodge.charges}` +
            (curr.invulnerable ? '  [iframes]' : '') +
            `\n${curr.style} ${curr.mode}` +
            (curr.mode === 'attack' ? ` hit ${curr.attackHit + 1}${curr.attackString ? ` ${curr.attackString}` : ''}  ${(curr.attackTime * 1000).toFixed(0)} ms` : '') +
            (curr.grounded ? '' : `  airborne y ${curr.y.toFixed(2)}`) +
            `\nhp ${Math.ceil(curr.hp)}  enemies ${world.enemies.filter((e) => e.ai !== 'dead').length}  run ${world.run.phase} wave ${world.run.wave}`
          : ''),
    );
    if (this.shownTuning !== this.session.tuningVersion) {
      this.shownTuning = this.session.tuningVersion;
      this.debug.refresh();
    }
    this.debug.frame(realDt);
  }

  /** Title screen: the level idles behind a slow camera drift (over the village square, or inside the arena's entrance). */
  private titleFrame(realDt: number, draw: boolean): void {
    this.titleTime += realDt;
    this.presentTime += realDt;
    const idle = this.buildCommand({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, held: new Set(), pressed: new Set() });
    this.session.advance(idle, realDt);
    const view = this.session.view();
    const hero = this.session.hero();
    if (hero) this.hero.update(hero.prev, hero.curr, hero.alpha, realDt);
    this.palette.update();
    this.enemies.update(view.prev.enemies, view.curr.enemies, view.alpha, realDt, view.curr.time);
    this.ambient.update(realDt);
    this.fx.update(realDt);
    this.portals.forEach((v, i) => v.update(this.session.portals[i] ?? null, realDt));
    const sway = Math.sin(this.titleTime * 0.08);
    const cam = this.cam.camera;
    if (this.world.level.village) {
      // Over the square from the south, looking up the path to the shrine and its ring.
      cam.position.set(sway * 5, 4.6 + Math.sin(this.titleTime * 0.13) * 0.3, 19);
      cam.lookAt(sway * 2, 2.4, -12);
    } else if (this.world.level.dungeon) {
      // A generated floor: from behind the way in, looking north into it.
      const sp = this.world.level.spawn;
      cam.position.set(sp.x + sway * 2, 4.5, sp.z + 3);
      cam.lookAt(sp.x, 1.5, sp.z - 10);
    } else {
      // A slow sway just inside the entrance, looking up the arena past the braziers.
      cam.position.set(sway * 3.2, 3.4 + Math.sin(this.titleTime * 0.13) * 0.3, 11.2);
      cam.lookAt(sway * 1.5, 2.3, -6);
    }
    cam.updateMatrixWorld();
    this.room.update(realDt, this.presentTime, new Set(), false);
    if (draw) this.gfx.render();
    this.crt.update();
    this.music.setMood('calm');
    this.music.update(realDt);
  }

  /** Off the title screen into the level; lock the mouse unless a menu should stay up. */
  private leaveTitle(lock = true): void {
    this.title.setVisible(false);
    const me = this.me();
    if (me) this.cam.yaw = me.yaw + Math.PI;
    if (lock) this.kbm.requestPointerLock();
    this.updateOverlay();
  }

  /** Music follows the run: calm between fights, driving in waves, heavier for the Warden. */
  private static moodFor(world: SimState): Mood {
    const r = world.run;
    if (r.phase === 'won') return 'victory';
    if (r.phase === 'lost') return 'defeat';
    if (r.phase === 'wave' || r.phase === 'intro') return r.wave >= FINAL_WAVE ? 'boss' : 'combat';
    return 'calm';
  }

  /** Everyone else's hero, with a nameplate; views come and go with the party. */
  private updateRemoteHeroes(prev: SimState, curr: SimState, alpha: number, dt: number, localId: string): void {
    const live = new Set<string>();
    for (const p of curr.players) {
      if (p.id === localId) continue;
      live.add(p.id);
      let r = this.remoteHeroes.get(p.id);
      if (!r) {
        r = { view: new HeroView(this.palette), plate: new Nameplate() };
        r.view.root.add(r.plate.sprite);
        r.plate.sprite.position.y = 2.25;
        this.gfx.scene.add(r.view.root, r.view.effects);
        this.remoteHeroes.set(p.id, r);
      }
      r.view.update(prev.players.find((o) => o.id === p.id) ?? p, p, alpha, dt);
      r.plate.update(p, tuning.coop.reviveMs);
    }
    for (const [id, r] of this.remoteHeroes) {
      if (live.has(id)) continue;
      this.gfx.scene.remove(r.view.root, r.view.effects);
      r.plate.dispose();
      this.remoteHeroes.delete(id);
    }
  }

  /** Shake and FOV punch on finishers and slams; a small shake when hurt (brief: "Hit feel"). */
  private cameraFeel(events: SimEvent[], localId: string): void {
    const hf = tuning.hitFeel;
    for (const ev of events) {
      if ((ev.kind === 'hit' && ev.heavy && ev.attackerId === localId) || (ev.kind === 'land' && ev.playerId === localId)) {
        this.cam.shake(hf.shakeM, hf.shakeMs / 1000);
        this.cam.punchFov(hf.fovPunchDeg);
      } else if (ev.kind === 'enemySlam') {
        // Brief: shake on boss slams too; a brute's slam a little less.
        this.cam.shake(ev.boss ? hf.shakeM : hf.shakeM * 0.7, hf.shakeMs / 1000);
      } else if (ev.kind === 'parry' && ev.playerId === localId) {
        this.cam.shake(hf.hurtShakeM, 0.12);
        this.cam.punchFov(-hf.fovPunchDeg);
      } else if (ev.kind === 'heroHurt' && ev.playerId === localId) {
        this.cam.shake(ev.heavy ? hf.shakeM : hf.hurtShakeM, 0.12);
      } else if (ev.kind === 'combo') {
        this.cam.shake(hf.shakeM * 0.8, 0.2);
        this.cam.punchFov(hf.fovPunchDeg * 1.5);
      } else if (ev.kind === 'runStart' || ev.kind === 'roar') {
        this.cam.shake(hf.hurtShakeM, 0.4);
      }
    }
  }

  /** Debug: jump straight to a wave (also handy from the console as game.skipToWave(n)); the server does it in a dev build. */
  skipToWave(n: 2 | 3 | 4): void {
    this.session.request({ k: 'cheat', cheat: n === 4 ? 'warden' : n === 2 ? 'wave2' : 'wave3' });
  }

  /** A debug-panel edit: values the fight reads go to the server, which applies them and tells everyone. */
  private tune(path: string, value: number | boolean): void {
    if (isServerTuning(path)) this.session.request({ k: 'tune', edit: { path, value } });
  }

  /** Levels and loot: save what the fight earned (brief: "in co-op each player keeps their own"). */
  private progress(events: SimEvent[], realDt: number): void {
    const p = this.me();
    if (!p) return;
    const localId = this.session.localId;
    let dirty = false;
    for (const ev of events) {
      // On a floor a find is only carried until the rest room banks it (P1); the banked event hands it over.
      if (ev.kind === 'pickup' && ev.playerId === localId && ev.carried) continue;
      if (ev.kind === 'banked' && ev.playerId === localId) {
        let left = 0;
        for (const item of ev.items) if (!this.profile.addItem(item)) left++;
        if (left > 0) this.hud.toast(`<b>Your bag is full</b><span>${left} banked find${left === 1 ? ' was' : 's were'} left behind</span>`, 'common');
        this.profile.data.coin += ev.coin;
        const own = this.tally ? this.tally.ownVillage : false;
        if (own) {
          this.profile.village.lumber += ev.lumber;
          this.profile.village.stone += ev.stone;
        }
        if (this.tally) {
          this.tally.banked += ev.items.length;
          this.tally.coin += ev.coin;
          this.tally.lumber += ev.lumber;
          this.tally.stone += ev.stone;
        }
        this.applyProfile(false);
        dirty = true;
      }
      if (ev.kind === 'findsLost' && ev.playerId === localId && this.tally) this.tally.lost += ev.count;
      if (ev.kind === 'pickup' && ev.playerId === localId) {
        // Found gear goes in the bag, or on the body if that slot is bare; a full bag leaves it behind.
        const worn = JSON.stringify(this.profile.data.worn);
        if (!this.profile.addItem(ev.item)) this.hud.toast(`<b>Your bag is full</b><span>${nameOf(ev.item)} was left behind</span>`, 'common');
        if (JSON.stringify(this.profile.data.worn) !== worn) this.applyProfile(false);
        dirty = true;
      }
      if (ev.kind === 'levelUp' && ev.playerId === localId) dirty = true;
      // The belt is the server's; it is saved as it changes so the next room starts with it (D4).
      if ((ev.kind === 'potionTaken' || ev.kind === 'drank') && ev.playerId === localId) dirty = true;
      if (ev.kind === 'runWon' || ev.kind === 'runLost') {
        this.profile.data.runs++;
        if (ev.kind === 'runWon') this.profile.data.wins++;
        dirty = true;
      }
    }
    // Save XP regularly so a closed tab mid-run keeps most of it.
    this.saveTimer += realDt;
    if (dirty || this.saveTimer > 5) {
      this.saveTimer = 0;
      this.profile.syncFrom(p);
      this.profile.save();
      this.session.keepLoadout(this.profile.loadout());
    }
  }

  /**
   * The village room's word on its village (P2): show it to everyone there, and keep it when it is
   * this browser's own. Its banks were added to the save as they happened; the room's count, which
   * has them too, replaces it.
   */
  private syncVillage(): void {
    if (this.session.villageVersion === this.shownVillage) return;
    this.shownVillage = this.session.villageVersion;
    const v = this.session.village;
    this.villagePanel.show(v);
    if (!v) return;
    if (this.room instanceof VillageView) this.room.setTiers(v.view.tiers);
    this.homeIsOurs = v.yours;
    if (!v.yours) return;
    this.profile.village = { id: this.profile.village.id, lumber: v.view.lumber, stone: v.view.stone, tiers: { ...v.view.tiers } };
    this.profile.save();
    this.session.setVillageSave(this.profile.village);
  }

  /** Re-send saved levels, talents and gear to the fight (refill = full health, between runs). */
  private applyProfile(refill: boolean): void {
    const p = this.me();
    if (p) this.profile.syncFrom(p);
    this.session.setLoadout(this.profile.loadout(), refill);
  }

  /** The server started a fresh run (everyone keeps their heroes): save, close the gear screen, face the gate. */
  private restarted(): void {
    const p = this.me();
    if (p) this.profile.syncFrom(p);
    this.profile.save();
    this.equip.setVisible(false);
    this.lockOn.targetId = -1;
    const me = this.me();
    if (me) this.cam.yaw = me.yaw + Math.PI;
  }

  /** Camera-relative stick/WASD -> world-space command. */
  private buildCommand(actions: ActionFrame): PlayerCommand {
    const b = this.cam.basis();
    const { x, y } = actions.move;
    // Free aim (D12) points from the hand at what the reticle is on; otherwise the camera's heading.
    const free = this.aim;
    return {
      moveX: b.fx * y + b.rx * x,
      moveZ: b.fz * y + b.rz * x,
      sprint: actions.held.has('sprint'),
      aimX: free ? free.aimX : b.fx,
      aimZ: free ? free.aimZ : b.fz,
      ...(free ? { aimPitch: free.aimPitch } : {}),
      dodge: false,
      attack: false,
      jump: false,
      swapTo: null,
      ability1: false,
      ability2: false,
      lockTarget: this.lockOn.targetId,
      block: actions.held.has('block'),
      interact: actions.held.has('interact'),
      // Held, not just pressed: a long enough hold turns the swing into a heavy (C1).
      attackHeld: actions.held.has('attack'),
    };
  }

  private static noPresses(): Pick<PlayerCommand, 'dodge' | 'attack' | 'jump' | 'swapTo' | 'ability1' | 'ability2' | 'ability3' | 'drink'> {
    return { dodge: false, attack: false, jump: false, swapTo: null, ability1: false, ability2: false, ability3: false, drink: false };
  }

  private handleMetaActions(actions: ActionFrame): void {
    if (actions.pressed.has('debugPanel')) {
      this.debug.toggle();
      if (this.debug.visible) this.kbm.exitPointerLock();
      else this.kbm.requestPointerLock();
      this.updateOverlay();
    }
    if (actions.pressed.has('slowMo')) {
      tuning.debug.slowMo = !tuning.debug.slowMo;
      this.tune('debug.slowMo', tuning.debug.slowMo);
    }
    if (actions.pressed.has('hitboxes')) tuning.debug.showHitboxes = !tuning.debug.showHitboxes;
    // The equip screen is for between runs.
    const between = ['ante', 'won', 'lost'].includes(this.session.view().curr.run.phase);
    if (actions.pressed.has('inventory') && (between || this.equip.visible)) {
      this.equip.toggle();
      if (this.equip.visible) this.kbm.exitPointerLock();
      else this.kbm.requestPointerLock();
      this.updateOverlay();
    }
    if (actions.pressed.has('menuBack') && this.equip.visible) {
      this.equip.setVisible(false);
      this.updateOverlay();
    }
    if (!between && this.equip.visible) this.equip.setVisible(false);
  }

  /** The pause menu: resume, settings, controls, the party panel and quitting to the title. */
  private buildOverlay(container: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'overlay';
    const card = document.createElement('div');
    card.className = 'overlay-card';
    card.addEventListener('click', (e) => e.stopPropagation());
    card.innerHTML = '<h1>Paused</h1><p class="cta">Click outside this box, or press Resume, to play</p>';
    const buttons = document.createElement('div');
    buttons.className = 'pause-buttons';
    const drawer = document.createElement('div');
    drawer.className = 'pause-drawer';
    const button = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = 'menu-btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      buttons.appendChild(b);
    };
    const toggle = (panel: HTMLElement) => {
      const same = drawer.firstChild === panel;
      drawer.innerHTML = '';
      if (!same) drawer.appendChild(panel);
    };
    button('Resume', () => this.kbm.requestPointerLock());
    button('Settings', () => toggle(this.settings.panel));
    button('Controls', () => toggle(this.controlsEl));
    button('Quit to title', () => {
      location.href = `${location.origin}${location.pathname}`;
    });
    card.append(buttons, drawer, this.party.panel);
    el.appendChild(card);
    el.addEventListener('click', () => this.kbm.requestPointerLock());
    container.appendChild(el);
    return el;
  }

  /** Every control, keyboard and gamepad. */
  private static buildControls(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'controls-panel';
    el.innerHTML = `
        <table>
          <tr><td>Move</td><td>WASD · left stick</td></tr>
          <tr><td>Sprint</td><td>hold Shift · left stick click</td></tr>
          <tr><td>Walk</td><td>light stick tilt</td></tr>
          <tr><td>Camera</td><td>mouse · arrow keys · right stick</td></tr>
          <tr><td>Attack</td><td>left click · J · X / Square (chains up to 5 hits); hold for a heavy, longer to charge it</td></tr>
          <tr><td>Abilities</td><td>1, 2 (or Q, E) · LB, RB; the off-hand's: 3 (or R) · RT</td></tr>
          <tr><td>Health potion</td><td>G (or 4) · d-pad left</td></tr>
          <tr><td>Zoom</td><td>mouse wheel · - and = · d-pad up and down</td></tr>
          <tr><td>Lock on</td><td>T · middle click · right stick click (flick to switch)</td></tr>
          <tr><td>Weapon</td><td>one for the outing: choose it under Tab, outside a fight</td></tr>
          <tr><td>Dodge</td><td>Ctrl · B / Circle (no direction = backstep; interrupts attacks)</td></tr>
          <tr><td>Guard</td><td>hold right click · hold L · LT / L2 (raise it just before a hit to parry)</td></tr>
          <tr><td>Jump</td><td>Space · Y / Triangle</td></tr>
          <tr><td>Revive an ally</td><td>hold F · hold A / Cross</td></tr>
          <tr><td>Debug panel</td><td>\` (backtick)</td></tr>
          <tr><td>Slow motion</td><td>\\ (backslash)</td></tr>
          <tr><td>Gear &amp; talents</td><td>Tab · View (between runs)</td></tr>
          <tr><td>Map: corner or whole floor</td><td>M · Menu / Start (in a dungeon)</td></tr>
          <tr><td>Hitboxes</td><td>H</td></tr>
          <tr><td>Release mouse / pause</td><td>Esc</td></tr>
        </table>`;
    el.addEventListener('click', (e) => e.stopPropagation());
    return el;
  }

  private updateOverlay(): void {
    const show = !this.kbm.pointerLocked && !this.debug.visible && !this.equip.visible && !this.title?.visible && !this.wiped;
    this.overlay.style.display = show ? 'flex' : 'none';
  }
}

/** Free the GPU side of a level's views when the party leaves it. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
  });
}
