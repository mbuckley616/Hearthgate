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
import { LoadingCard } from '../ui/LoadingCard';
import { RunSummary, newTally, type RunTally } from '../ui/RunSummary';
import { KeeperCard, type KeeperChoice } from '../ui/KeeperCard';
import { VillageMap, type VillageMapData } from '../ui/VillageMap';
import { VillagePanel } from '../ui/VillagePanel';
import { StoreScreen } from '../ui/StoreScreen';
import { BankScreen } from '../ui/BankScreen';
import { PortalScreen } from '../ui/PortalScreen';
import { HireScreen } from '../ui/HireScreen';
import { HIRES } from '@hearthgate/shared/sim/henchman';
import type { Style } from '@hearthgate/shared/config/tuning';
import { STORY, choiceLabel } from '@hearthgate/shared/game/portalChoice';
import { BUILDING_NAMES, capital, roman } from '../ui/villageWords';
import { bankHenchmen, tierGives, upgradeCost, upgradeProblem, type BuildingId } from '@hearthgate/shared/game/villageSave';
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

/** How near Keeper Wren a hero stands to be at the shrine (m): the square in front of it. */
const SHRINE_REACH = 6;

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
  /** Between Play and the room's welcome, which the free server can take a minute to send. */
  private readonly loading = new LoadingCard();
  /** This page has been in a room once: a wait after that is a portal's hand-off, not the server waking. */
  private playedOnce = false;
  /**
   * Whether the village the party is in, or last set out from, is this browser's own (its room says
   * so, P2): lumber and stone banked on its runs are added to the save here as they are banked.
   */
  private homeIsOurs = false;
  private readonly villagePanel = new VillagePanel();
  private shownVillage = -1;
  /** A keeper's card (P11): their menu, building the next tier, leaving. */
  private readonly keeperCard = new KeeperCard((id) => this.keeperChose(id));
  /** What the keeper last said on their card (a tier built, a word on it), under their usual line. */
  private keeperNote = '';
  /** The village from above (P14, M or Start in the village). */
  private readonly villageMap = new VillageMap(() => this.closeVillageMap());
  /** The shot behind Old Fenn's hiring board: the three for hire, in a row before his bar. */
  private hireShot(): { from: THREE.Vector3; at: THREE.Vector3 } | null {
    const tavern = this.world.level.village?.interiors.find((r) => r.building === 'tavern');
    if (!tavern) return null;
    const cx = (tavern.minX + tavern.maxX) / 2;
    const z = tavern.minZ + 8.3;
    return { from: new THREE.Vector3(cx, 2.4, z + 5.2), at: new THREE.Vector3(cx, 1.6, z - 1) };
  }

  /** Where the hero was drawn last frame, to know a door's jump from a step. */
  private lastHeroAt: THREE.Vector3 | null = null;
  /** The run's tally so far; null outside a run. */
  private tally: RunTally | null = null;
  private lastKind = '';
  private readonly drops = new DropView();
  /** A generated floor's crates, barrels and urns, and the potions out of them (D4); null elsewhere. */
  private propView: PropView | null = null;
  private readonly profile = new Profile();
  private readonly equip: EquipScreen;
  /** Aldous's General Store (P5), opened by a second F (or A) to him. */
  private readonly store: StoreScreen;
  /** Marta's stash (P9), opened by a second F (or A) to her, in the village that is yours. */
  private readonly bank: BankScreen;
  /** Keeper Wren's portal menu (P7), opened by a second F (or A) to her. */
  private readonly portalMenu: PortalScreen;
  /** Old Fenn's hiring board (P10), opened by a second F (or A) to him. */
  private readonly hire: HireScreen;
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
  /**
   * The pause card is up because the player let go of the mouse in play (Esc), not merely because
   * the mouse is unlocked: a join-link arrival, a pad player and a browser without pointer lock
   * never locked it, and the fight runs on regardless.
   */
  private paused = false;
  private pausedAt = 0;
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
      'Add a henchman': cheat('henchman'),
    }, (path, value) => this.tune(path, value));
    this.equip = new EquipScreen(
      this.profile,
      () => this.applyProfile(this.session.view().curr.run.phase === 'ante'),
      () => slotsOpen(this.session.view().curr, !!this.world.level.village),
      (item) => {
        this.session.request({ k: 'drop', item });
        this.sfx.item(item, true);
      },
      () => this.atShrine(),
    );
    this.bank = new BankScreen(this.profile, (item) => this.sfx.item(item, true));
    this.hire = new HireScreen(
      (kit) => this.session.request({ k: 'hire', kit, coin: this.profile.data.coin }),
      (kit) => {
        this.session.request({ k: 'dismiss', kit });
        this.hire.say(`${HIRES[kit].name} goes back to the hearth.`);
      },
    );
    this.portalMenu = new PortalScreen(
      (choice) => {
        this.session.request({ k: 'portal', choice });
        this.closeMenu();
        this.talk.say('Keeper Wren', `There: the ring opens on ${choiceLabel(choice).replace(/^A /, 'a ')}. Step in together when you are ready.`);
      },
      (dungeon) => {
        this.session.request({ k: 'destination', dungeon });
        this.closeMenu();
        this.talk.say('Keeper Wren', `There: the ring opens on ${dungeon.name}, as you laid it out.`);
      },
    );
    this.store = new StoreScreen(
      this.profile,
      (item) => this.session.request({ k: 'buy', uid: item.uid, coin: this.profile.data.coin }),
      (item) => this.session.request({ k: 'sell', item }),
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
    document.addEventListener('pointerlockchange', () => {
      if (this.kbm.pointerLocked) this.paused = false;
      else if (!this.panelOpen()) {
        this.paused = true;
        this.pausedAt = performance.now();
      }
      this.updateOverlay();
    });
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
    this.store.setVisible(false);
    this.bank.setVisible(false);
    this.portalMenu.setVisible(false);
    this.hire.setVisible(false);
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
      // Carried finds still marked on reaching a village were never banked (the floor was left early): gone (D3).
      const stale = this.profile.loseCarried();
      if (stale > 0) {
        if (this.tally) this.tally.lost += stale;
        this.applyProfile(false);
        this.hud.toast(`<b>${stale} unbanked find${stale === 1 ? '' : 's'} lost</b><span>The floor was left before a rest room banked them</span>`, 'common');
      }
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
   * Talking (T3): F (or A) by a building's keeper opens their card at once (P11; Michael, 29 Oct: no
   * press-again, no hold), anyone else says their line. While the card is up it has the keys.
   */
  private talkTo(near: Villager | null, pressed: boolean, dt: number): void {
    if (this.keeperCard.visible) {
      const keeper = this.world.level.village?.villagers.find((n) => n.id === this.keeperCard.keeper);
      // The village gone (a ring took the party) or the hero well away (pushed, handed off): the card goes
      // too. The card holds the keys, so the hero stands still; a hero stopped at the very edge of talk range
      // settles a hair past it, and closing on that shut the card under the next F (the smoke test, 29 Oct).
      const me = this.me();
      const away = !me || Math.hypot(me.x - (keeper?.x ?? 0), me.z - (keeper?.z ?? 0)) > TALK_RANGE + 1.5;
      if (!keeper || !this.session.village || away) this.closeKeeper();
      else this.keeperCard.update(keeper.name, this.keeperLine(keeper), this.keeperChoices(keeper));
      return this.talk.update(null, false, dt);
    }
    if (near && pressed && near.building && this.session.village) {
      this.keeperNote = '';
      this.keeperCard.open(near.id, near.name, this.keeperLine(near), this.keeperChoices(near));
      this.talk.clear();
      this.kbm.exitPointerLock();
      this.updateOverlay();
      return;
    }
    this.talk.update(near, pressed, dt, this.doorInReach(this.me()));
  }

  /**
   * What the door the hero stands in leads to, for the hint (a door takes a press, Michael 29 Oct):
   * from the square, into the building whose front it is; from inside, out. The server takes the press.
   */
  private doorInReach(me: PlayerState | null): string | null {
    const v = this.world.level.village;
    if (!v || !me || me.mode === 'down') return null;
    const d = v.doors.find((d) => Math.hypot(d.x - me.x, d.z - me.z) <= d.radius);
    if (!d) return null;
    const h = this.world.level.floorSize / 2;
    if (Math.abs(d.x) > h || Math.abs(d.z) > h) return 'step outside';
    let best = v.buildings[0];
    for (const b of v.buildings) if (Math.hypot(b.door.x - d.x, b.door.z - d.z) < Math.hypot(best.door.x - d.x, best.door.z - d.z)) best = b;
    return `go into the ${best.name}`;
  }

  /** A keeper's words on their card: their line, their building's tier and what it gives, any news. */
  private keeperLine(near: Villager): string {
    const v = this.session.village!;
    const building = near.building!;
    const tier = v.view.tiers[building];
    let line = `${near.line} The ${BUILDING_NAMES[building]} stands at tier ${roman(tier)}: ${tierGives(building, tier)}.`;
    if (building === 'shrine') {
      const NEW = 'A new dungeon';
      const now = this.session.portals[0]?.label ?? NEW;
      line += ` Just now the ring opens on ${now === NEW ? 'a new dungeon, never walked before' : now}. Champion points come back here for ${tuning.village.respecCoinPerPoint} coin each: open your hero (Tab) beside me.`;
    }
    return this.keeperNote ? `${line} ${this.keeperNote}` : line;
  }

  /** A keeper's buttons: their menu, the next tier with its price and whether it can be paid, leaving. */
  private keeperChoices(near: Villager): KeeperChoice[] {
    const v = this.session.village!;
    const building = near.building!;
    const menu: KeeperChoice =
      building === 'shrine'
        ? { id: 'menu', label: 'Choose where the portal leads', detail: 'Story dungeons, or a random one' }
        : building === 'store'
          ? { id: 'menu', label: 'Browse the shelves', detail: 'Buy, and sell from your bag' }
          : building === 'tavern'
            ? { id: 'menu', label: 'Hire companions', detail: `${tuning.village.hireCoin} coin each` }
            : { id: 'menu', label: 'Open the stash', ...(v.yours ? { detail: 'What your bag cannot carry' } : { blocked: 'Your own things are kept in your own village' }) };
    const tier = v.view.tiers[building];
    let build: KeeperChoice;
    if (tier >= tuning.village.maxTier) build = { id: 'upgrade', label: `Tier ${roman(tier)}`, blocked: 'As high as it goes for now' };
    else {
      const c = upgradeCost(tier + 1);
      const problem = upgradeProblem(v.view, building, this.profile.data.coin);
      build = {
        id: 'upgrade',
        label: `Build tier ${roman(tier + 1)}`,
        detail: `${capital(tierGives(building, tier + 1))}  ·  ${c.lumber} lumber, ${c.stone} stone, ${c.coin} coin`,
        ...(!v.yours ? { blocked: `Only ${v.host || 'the host'} can build here` } : problem ? { blocked: `You need ${problem}` } : {}),
      };
    }
    return [menu, build, { id: 'leave', label: 'Leave' }];
  }

  private keeperChose(id: string): void {
    const near = this.world.level.village?.villagers.find((n) => n.id === this.keeperCard.keeper);
    const v = this.session.village;
    if (id === 'leave' || !near?.building || !v) return this.closeKeeper();
    if (id === 'menu') {
      this.keeperCard.close();
      this.openKeeperMenu(near);
      this.updateOverlay();
    } else if (id === 'upgrade' && !upgradeProblem(v.view, near.building, this.profile.data.coin)) {
      this.session.request({ k: 'upgrade', building: near.building, coin: this.profile.data.coin });
    }
  }

  private closeKeeper(): void {
    if (!this.keeperCard.visible) return;
    this.keeperCard.close();
    this.kbm.requestPointerLock();
    this.updateOverlay();
  }

  /** A keeper's menu, from their card: Wren's portal menu (P7), Aldous's shop (P5), Fenn's board (P10), Marta's stash (P9). */
  private openKeeperMenu(near: Villager): void {
    const v = this.session.village;
    if (!v) return;
    if (near.building === 'shrine') {
      this.portalMenu.open(this.profile.data.storyCleared ?? [], v.view.tiers.shrine, playableDungeons());
      this.talk.clear();
      this.kbm.exitPointerLock();
      this.updateOverlay();
    } else if (near.building === 'store') this.openStore();
    else if (near.building === 'tavern') {
      const hired = this.session.view().curr.players.filter((p) => p.henchman).map((p) => p.style);
      this.hire.open(hired, v.view.tiers.tavern, this.profile.data.coin);
      this.talk.clear();
      this.kbm.exitPointerLock();
      this.updateOverlay();
    }
    else if (near.building === 'storehouse') {
      if (v.yours) this.openBank();
      else this.talk.say(near.name, 'Your own things are kept in your own village’s storehouse, not this one.');
    }
  }


  /**
   * The shot behind a keeper's menu: from the room's front, a little to their right, looking past them,
   * so they and their counter stand in the third of the screen the menu leaves open (Michael's mockup).
   * Every keeper faces their door, so one shot fits them all.
   */
  private keeperShot(building: BuildingId): { from: THREE.Vector3; at: THREE.Vector3 } | null {
    const keeper = this.world.level.village?.villagers.find((n) => n.building === building);
    return keeper ? { from: new THREE.Vector3(keeper.x + 1.2, 2.1, keeper.z + 4.6), at: new THREE.Vector3(keeper.x + 2.6, 1.25, keeper.z) } : null;
  }

  /** Near Keeper Wren in the village: where champion points are taken back (P5; Michael, 28 Oct). */
  private atShrine(): boolean {
    const me = this.me();
    const wren = this.world.level.village?.villagers.find((n) => n.building === 'shrine');
    return !!me && !!wren && Math.hypot(me.x - wren.x, me.z - wren.z) < SHRINE_REACH;
  }

  /** Close Keeper Wren's menu and take the hero back. */
  private closeMenu(): void {
    this.portalMenu.setVisible(false);
    this.kbm.requestPointerLock();
    this.updateOverlay();
  }

  private openBank(): void {
    this.bank.setVisible(true);
    this.talk.clear();
    this.kbm.exitPointerLock();
    this.updateOverlay();
  }

  private openStore(): void {
    this.store.setStock(this.session.village?.view.stock ?? []);
    this.talk.clear();
    this.store.setVisible(true);
    this.kbm.exitPointerLock();
    this.updateOverlay();
  }

  private closeStore(): void {
    if (!this.store.visible) return;
    this.store.setVisible(false);
    this.kbm.requestPointerLock();
    this.updateOverlay();
  }

  /** The tavern's room took a hire (P10): pay its coin and say who joins. */
  private payHires(): void {
    for (const h of this.session.hires.splice(0)) {
      this.profile.data.coin = Math.max(0, this.profile.data.coin - h.coin);
      this.profile.save();
      this.hire.say(`${HIRES[h.kit].name} joins you, for ${h.coin} coin.`);
      this.hud.toast(`<b>${HIRES[h.kit].name} joins the party</b><span>${HIRES[h.kit].title}  ·  -${h.coin} coin</span>`, 'level');
    }
  }

  /** What the store's room did with a purchase or a sale (P5): the bag and the coin follow it. */
  private settleTrades(): void {
    for (const t of this.session.trades.splice(0)) {
      if (t.k === 'bought') {
        this.profile.data.coin = Math.max(0, this.profile.data.coin - t.coin);
        const worn = JSON.stringify(this.profile.data.worn);
        if (!this.profile.addItem(t.item)) this.hud.toast(`<b>Your bag is full</b><span>${nameOf(t.item)} was left on the counter</span>`, 'common');
        if (JSON.stringify(this.profile.data.worn) !== worn) this.applyProfile(false);
        this.store.say(`Bought ${nameOf(t.item)} for ${t.coin} coin.`);
        this.sfx.coins();
        this.sfx.item(t.item, false);
      } else {
        const item = this.profile.data.bag.find((i) => i?.uid === t.uid);
        if (!item || !this.profile.removeByUid(t.uid)) continue;
        this.profile.data.coin += t.coin;
        this.store.say(`Sold ${nameOf(item)} for ${t.coin} coin.`);
        this.sfx.coins();
        this.sfx.item(item, true);
      }
      this.profile.save();
      this.store.refresh();
    }
  }

  /** The room built what the owner asked for (P4): pay its coin from the save and say so. */
  private payUpgrades(): void {
    for (const u of this.session.upgraded.splice(0)) {
      this.profile.data.coin = Math.max(0, this.profile.data.coin - u.coin);
      this.profile.save();
      const keeper = this.world.level.village?.villagers.find((n) => n.building === u.building);
      this.hud.toast(`<b>${BUILDING_NAMES[u.building]}: tier ${roman(u.tier)}</b><span>${tierGives(u.building, u.tier)}  ·  -${u.coin} coin</span>`, 'level');
      const words = `Done: the ${BUILDING_NAMES[u.building]} stands at tier ${roman(u.tier)} now.`;
      if (keeper && this.keeperCard.keeper === keeper.id) this.keeperNote = words;
      else if (keeper) this.talk.say(keeper.name, `${words} ${capital(tierGives(u.building, u.tier))}.`);
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
    const frameDt = Math.max(0, (now - this.lastTime) / 1000);
    const realDt = Math.min(0.1, frameDt);
    this.lastTime = now;

    let actions = this.input.poll(realDt);
    if (this.session.levelVersion !== this.shownLevel) this.enterLevel();
    if (this.session.playing) this.playedOnce = true;
    this.loading.update(!this.title.visible && !this.session.playing && !this.session.ended, !this.playedOnce, this.session.status());
    if (this.title.visible) {
      this.titleFrame(realDt, draw);
      return;
    }
    this.handleMetaActions(actions);
    // The bag and body take the keys and the pad while they are open (T5b): the hero stands still.
    if (this.equip.visible) {
      this.equip.handle(actions, realDt);
      actions = emptyFrame();
    } else if (this.store.visible) {
      this.store.handle(actions, realDt);
      actions = emptyFrame();
    } else if (this.bank.visible) {
      this.bank.handle(actions, realDt);
      actions = emptyFrame();
    } else if (this.portalMenu.visible) {
      this.portalMenu.handle(actions, realDt);
      actions = emptyFrame();
    } else if (this.hire.visible) {
      this.hire.handle(actions, realDt);
      actions = emptyFrame();
    } else if (this.keeperCard.visible) {
      this.keeperCard.handle(actions, realDt);
      actions = emptyFrame();
    } else if (this.villageMap.visible) {
      this.villageMap.handle(actions, realDt);
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
    // While a keeper's menu is up the camera holds a shot of them at their counter: the room is the menu's backdrop.
    const carded = this.world.level.village?.villagers.find((n) => n.id === this.keeperCard.keeper)?.building ?? null;
    const framed = this.portalMenu.visible ? 'shrine' : this.store.visible ? 'store' : this.bank.visible ? 'storehouse' : this.keeperCard.visible ? carded : null;
    this.cam.setShot(framed ? this.keeperShot(framed) : this.hire.visible ? this.hireShot() : null);
    // Who is with the party (P10): their figure leaves the tavern's row, and the board keeps up.
    const hiredKits = new Set<Style>(world.players.filter((p) => p.henchman).map((p) => p.style));
    if (this.room instanceof VillageView) this.room.setHired(hiredKits);
    if (this.hire.visible) this.hire.update([...hiredKits], this.session.village?.view.tiers.tavern ?? 1, this.profile.data.coin);
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
    if (actions.pressed.has('drink') && !this.equip.visible) {
      this.pending.drink = true;
      // The sim turns a drink down without a word; a press that did nothing read as a broken key (playtest, 29 Oct).
      const me = this.me();
      if (me && me.mode !== 'down' && !me.potions) this.hud.toast('<b class="potion">No health potions</b><span>Break crates, barrels and urns to find them</span>', 'common');
      else if (me && me.mode !== 'down' && me.hp >= me.maxHp) this.hud.toast('<b class="potion">Already at full health</b><span>The potion stays on your belt</span>', 'common');
    }
    // The hero fights with the weapon in hand (T5): after a change on the hero screen, or on joining, follow it.
    // Mid-fight the server holds the change until the fight is over (C3), so it is asked for again each tick.
    const meNow = this.me();
    if (meNow && !this.pending.swapTo && meNow.mode !== 'down' && meNow.style !== this.profile.style) this.pending.swapTo = this.profile.style;
    const cmd = this.buildCommand(actions);

    // Run the fight (host) or predict our hero (joiner); collect what happened.
    // The session takes the frame's whole time (it drops what passes sim.maxStepsPerFrame): the server
    // ticks on wall time, and every tick a slow page leaves out is one it plays on held buttons.
    const result = this.session.advance({ ...cmd, ...this.pending }, frameDt * timeScale);
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
    this.talkTo(this.villagerInReach(this.me()), actions.pressed.has('interact') && !closeSummary, realDt);
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
    this.settleTrades();
    this.payHires();
    if (village) this.runUi.hide();
    else this.runUi.update(world, realDt, 'host', world.floor?.carried[localId]?.length ?? 0);
    this.portals.forEach((v, i) => v.update(this.session.portals[i] ?? null, dt));
    // M or Start: the village from above in the village (P14), the floor's map in a dungeon.
    if (actions.pressed.has('map') && village) this.openVillageMap();
    else if (actions.pressed.has('map')) this.minimap.toggle();
    if (this.villageMap.visible) this.villageMap.update(this.villageMapData(world));
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
      // Through a door (an interior) the hero is somewhere else at once: so is the camera, facing in.
      if (this.lastHeroAt && this.lastHeroAt.distanceTo(this.hero.root.position) > 6) {
        this.cam.snap();
        this.cam.yaw = curr.yaw + Math.PI;
      }
      (this.lastHeroAt ??= new THREE.Vector3()).copy(this.hero.root.position);
      this.cam.update(realDt, this.hero.root.position, sprint);
    }
    // Free aim (D12): over the shoulder, and the reticle pinned to the centre, where the shots go.
    const free = !!curr && tuning.camera.freeAim && curr.style !== 'sword' && !this.lockOn.locked;
    this.cam.setShoulder(free);
    this.aim = free && curr ? freeAimFrom(this.cam.camera, curr, world, worldNow(this.world, world).colliders) : null;
    const aim = this.cam.basis();
    this.reticle.update(this.cam.camera, world, curr, this.hero.root.position, { x: aim.fx, z: aim.fz }, this.lockOn.targetId, !this.equip.visible && !this.store.visible && !this.bank.visible && !this.portalMenu.visible && !this.hire.visible && !this.keeperCard.visible && !this.villageMap.visible && !ended && this.overlay.style.display === 'none', realDt, this.aim);
    if (this.room instanceof FloorView) {
      this.room.sync(world.floor && world.run.gateClosed ? world.floor.room : -1, this.hero.root.position);
      this.gfx.followShadow(this.hero.root.position.x, this.hero.root.position.z);
    }
    if (this.room instanceof VillageView) this.room.setEye(this.cam.camera.position);
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
      // On a floor a find goes in the bag at once, marked carried (D3): wearable now, lost on a wipe until banked.
      if (ev.kind === 'pickup' && ev.playerId === localId && ev.carried) {
        const worn = JSON.stringify(this.profile.data.worn);
        if (!this.profile.addItem(ev.item, true)) this.hud.toast(`<b>Your bag is full</b><span>${nameOf(ev.item)} was left behind</span>`, 'common');
        if (JSON.stringify(this.profile.data.worn) !== worn) this.applyProfile(false);
        dirty = true;
        continue;
      }
      if (ev.kind === 'banked' && ev.playerId === localId) {
        // What was carried is safe now; what still lay on the ground comes into the bag.
        this.profile.bankCarried();
        let left = 0;
        for (const item of ev.items) if (!this.profile.addItem(item)) left++;
        if (left > 0) this.hud.toast(`<b>Your bag is full</b><span>${left} banked find${left === 1 ? ' was' : 's were'} left behind</span>`, 'common');
        this.profile.data.coin += ev.coin;
        const own = this.tally ? this.tally.ownVillage : false;
        if (own) {
          this.profile.village.lumber += ev.lumber;
          this.profile.village.stone += ev.stone;
          // The village's room keeps the henchmen's XP too, but says so only to those in the village (P12).
          if (ev.hench) bankHenchmen(this.profile.village, ev.hench);
        }
        if (this.tally) {
          this.tally.banked += ev.items.length + ev.kept;
          this.tally.coin += ev.coin;
          this.tally.lumber += ev.lumber;
          this.tally.stone += ev.stone;
        }
        this.applyProfile(false);
        dirty = true;
      }
      if (ev.kind === 'findsLost' && ev.playerId === localId && this.tally) this.tally.lost += ev.count;
      // A wipe takes the bag but its pocket (D5): the server says so, and the bag is this browser's to empty.
      if (ev.kind === 'bagLost' && ev.playerId === localId) {
        // Carried finds go wherever they are, worn or pocketed (D3; findsLost has counted them); then the bag.
        const finds = this.profile.loseCarried();
        const bag = this.profile.loseBag();
        if (this.tally) this.tally.lost += bag;
        const lost = finds + bag;
        this.applyProfile(false);
        if (lost > 0) this.hud.toast(`<b>Your bag was lost: ${lost} item${lost === 1 ? '' : 's'}</b><span>The pocket kept its ${this.profile.pocketSize()}; the stash and what you wear are safe</span>`, 'common');
        dirty = true;
      }
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
      // A story dungeon won opens the next at Keeper Wren's (P7).
      const story = this.world.level.dungeon?.def.spec.story;
      if (ev.kind === 'runWon' && story && !(this.profile.data.storyCleared ?? []).includes(story)) {
        (this.profile.data.storyCleared ??= []).push(story);
        const at = STORY.findIndex((s) => s.id === story);
        const next = STORY[at + 1];
        this.hud.toast(`<b>${STORY[at]?.name ?? 'The dungeon'} cleared</b><span>${next ? `${next.name} is open at Keeper Wren's` : 'Every story dungeon so far is yours'}</span>`, 'level');
      }
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
    this.store.setStock(v.view.stock ?? []);
    this.homeIsOurs = v.yours;
    if (!v.yours) return;
    // The room's count of lumber, stone and tiers; the stash is this browser's alone (P9).
    this.profile.village = { ...this.profile.village, lumber: v.view.lumber, stone: v.view.stone, tiers: { ...v.view.tiers }, ...(v.view.hench ? { hench: { ...v.view.hench } } : {}) };
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
    // Esc, Start or A closes the pause card; the press that opened it is not the one that closes it.
    if (this.paused && performance.now() - this.pausedAt > 250 && (['menuBack', 'map', 'interact'] as const).some((a) => actions.pressed.has(a))) {
      this.resume();
      return;
    }
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
    // The store closes on Tab, Esc or B, and opens only by talking to Aldous.
    if (this.store.visible && (actions.pressed.has('inventory') || actions.pressed.has('menuBack'))) {
      this.closeStore();
      return;
    }
    if (this.keeperCard.visible && (actions.pressed.has('inventory') || actions.pressed.has('menuBack'))) {
      this.closeKeeper();
      return;
    }
    // M, Start and B the map takes itself (VillageMap.handle), so the press that closes it never reopens it.
    if (this.villageMap.visible && (actions.pressed.has('inventory') || actions.pressed.has('menuBack'))) {
      this.closeVillageMap();
      return;
    }
    if (this.hire.visible && (actions.pressed.has('inventory') || actions.pressed.has('menuBack'))) {
      this.hire.setVisible(false);
      this.kbm.requestPointerLock();
      this.updateOverlay();
      return;
    }
    if (this.portalMenu.visible && (actions.pressed.has('inventory') || actions.pressed.has('menuBack'))) {
      this.closeMenu();
      return;
    }
    if (this.bank.visible && (actions.pressed.has('inventory') || actions.pressed.has('menuBack'))) {
      if (this.bank.back()) {
        this.bank.setVisible(false);
        this.kbm.requestPointerLock();
        this.updateOverlay();
        this.applyProfile(false);
      }
      return;
    }
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
    card.innerHTML = '<h1>Paused</h1><p class="cta">Click outside this box, press Resume, Esc, Start or A to play</p>';
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
    button('Resume', () => this.resume());
    button('Settings', () => toggle(this.settings.panel));
    button('Controls', () => toggle(this.controlsEl));
    button('Quit to title', () => {
      location.href = `${location.origin}${location.pathname}`;
    });
    card.append(buttons, drawer, this.party.panel);
    el.appendChild(card);
    el.addEventListener('click', () => this.resume());
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

  /** Close the pause card, taking the mouse back where the browser allows it. */
  private resume(): void {
    this.paused = false;
    this.kbm.requestPointerLock();
    this.updateOverlay();
  }

  /** A screen of its own is up: the hero screen, a keeper's menu, the title or the end card. */
  private panelOpen(): boolean {
    return this.debug.visible || this.equip.visible || !!this.store?.visible || !!this.bank?.visible || !!this.portalMenu?.visible || !!this.hire?.visible || !!this.keeperCard?.visible || !!this.villageMap?.visible || !!this.title?.visible || this.wiped;
  }

  private openVillageMap(): void {
    const data = this.villageMapData(this.session.view().curr);
    if (!data) return;
    this.villageMap.open(data);
    this.kbm.exitPointerLock();
    this.updateOverlay();
  }

  private closeVillageMap(): void {
    if (!this.villageMap.visible) return;
    this.villageMap.close();
    this.kbm.requestPointerLock();
    this.updateOverlay();
  }

  /** What the village map shows (P14): the square, its buildings and their tiers, the party, what there is to spend. */
  private villageMapData(world: SimState): VillageMapData | null {
    const def = this.world.level.village;
    const v = this.session.village;
    if (!def || !v) return null;
    return {
      def,
      half: this.world.level.floorSize / 2,
      view: v.view,
      yours: v.yours,
      host: v.host,
      coin: this.profile.data.coin,
      // Heroes inside a building stand in its room far off the square: only those on it are drawn.
      party: world.players.filter((p) => Math.abs(p.x) <= this.world.level.floorSize / 2 && Math.abs(p.z) <= this.world.level.floorSize / 2).map((p) => ({ x: p.x, z: p.z, me: p.id === this.session.localId })),
    };
  }

  private updateOverlay(): void {
    // A screen opened over the pause card replaces it; closing that screen goes back to play.
    if (this.panelOpen()) this.paused = false;
    this.overlay.style.display = this.paused ? 'flex' : 'none';
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
