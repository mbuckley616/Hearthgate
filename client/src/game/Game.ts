import { Music, type Mood } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { OrbitCamera } from '../camera/OrbitCamera';
import { STYLES, tuning, type Style } from '@hearthgate/shared/config/tuning';
import { DebugPanel } from '../debug/DebugPanel';
import { HitboxOverlay } from '../debug/HitboxOverlay';
import { GamepadSource } from '../input/GamepadSource';
import { InputManager } from '../input/InputManager';
import { KeyboardMouseSource } from '../input/KeyboardMouseSource';
import type { ActionFrame } from '../input/actions';
import { arena, buildWorld, type World } from '@hearthgate/shared/level/arena';
import { AmbientView } from '../render/AmbientView';
import { DropView } from '../render/DropView';
import { EnemiesView } from '../render/EnemyView';
import { FxView } from '../render/FxView';
import { HeroView } from '../render/HeroView';
import { Nameplate } from '../render/Nameplate';
import { ProjectileView } from '../render/ProjectileView';
import { Palette } from '../render/props';
import { RoomView } from '../render/RoomView';
import { SceneRenderer } from '../render/SceneRenderer';
import { TelegraphView } from '../render/TelegraphView';
import { rollItem } from '@hearthgate/shared/sim/gear';
import type { PlayerCommand, PlayerState, SimEvent, SimState } from '@hearthgate/shared/sim/types';
import { CrtOverlay } from '../ui/CrtOverlay';
import { EquipScreen } from '../ui/EquipScreen';
import { Hud } from '../ui/Hud';
import { PartyUi } from '../ui/PartyUi';
import { RunUi } from '../ui/RunUi';
import { Settings } from '../ui/Settings';
import { StyleBar } from '../ui/StyleBar';
import { TitleScreen } from '../ui/TitleScreen';
import { FINAL_WAVE } from '@hearthgate/shared/sim/run';
import { isServerTuning } from '@hearthgate/shared/config/edits';
import type { Cheat } from '@hearthgate/shared/net/protocol';
import { ClientSession } from './ClientSession';
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
 */
export class Game {
  /** First, so saved settings are in tuning before anything reads it. */
  private readonly settings = new Settings();
  private readonly world: World;
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
  private readonly room: RoomView;
  private readonly ambient: AmbientView;
  private readonly hero: HeroView;
  private readonly remoteHeroes = new Map<string, RemoteHero>();
  private readonly palette: Palette;
  private readonly projectiles: ProjectileView;
  private readonly enemies: EnemiesView;
  private readonly telegraphs: TelegraphView;
  private readonly runUi = new RunUi();
  private readonly drops = new DropView();
  private readonly profile = new Profile();
  private readonly equip: EquipScreen;
  private readonly party: PartyUi;
  private saveTimer = 0;
  private readonly fx: FxView;
  private readonly hitboxes = new HitboxOverlay();
  private readonly sfx = new Sfx();
  private readonly hud = new Hud();
  private readonly crt = new CrtOverlay();
  private readonly styleBar = new StyleBar();
  private readonly lockOn = new LockOn();
  private readonly debug: DebugPanel;
  private readonly overlay: HTMLElement;
  private endedHandled = false;
  /** The run's phase last frame: a won or lost run going back to the antechamber is a restart. */
  private lastPhase = '';
  private shownTuning = 0;
  /** When the last animation frame ran (the worker takes over if they stop). */
  private lastFrameAt = performance.now();

  constructor(container: HTMLElement) {
    this.world = buildWorld(arena);
    // A ?join=CODE link joins a friend's fight; anything else starts one on the server (solo until someone joins).
    const params = new URLSearchParams(location.search);
    const join = params.get('join');
    this.session = new ClientSession(this.world, join ? join.toUpperCase() : null, this.profile.loadout());

    this.cam = new OrbitCamera(window.innerWidth / window.innerHeight, this.world.colliders, (arena.spawn.yawDeg * Math.PI) / 180);
    this.gfx = new SceneRenderer(container, this.cam.camera, arena.floorSize / 2);
    this.room = new RoomView(this.world);
    this.ambient = new AmbientView(this.room.fireSources, arena.floorSize / 2);
    this.palette = new Palette(this.gfx.envMap);
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
        this.profile.addItem(rollItem(Math.random, true));
        this.applyProfile(false);
      },
      'Reset saved progress': () => {
        this.profile.reset();
        this.applyProfile(true);
      },
      'Kill all enemies': cheat('killAll'),
    }, (path, value) => this.tune(path, value));
    this.equip = new EquipScreen(this.profile, () => this.applyProfile(this.session.view().curr.run.phase === 'ante'));
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

    const actions = this.input.poll(realDt);
    if (this.title.visible) {
      this.titleFrame(realDt, draw);
      return;
    }
    this.handleMetaActions(actions);

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
    if (actions.pressed.has('dodge')) this.pending.dodge = true;
    if (actions.pressed.has('attack')) this.pending.attack = true;
    if (actions.pressed.has('jump')) this.pending.jump = true;
    if (actions.pressed.has('ability1')) this.pending.ability1 = true;
    if (actions.pressed.has('ability2')) this.pending.ability2 = true;
    const swap = this.requestedStyle(actions);
    if (swap) this.pending.swapTo = swap;
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
    // Run over: anyone's F / A (held interact in the command) makes the server start again; here the view follows.
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
    this.runUi.update(world, realDt, 'host');
    this.lockOn.updateMarker(world, dt);
    const ended = this.session.ended;
    this.party.update(this.session.status(), world, curr, localId, ended);
    if (ended && !this.endedHandled) {
      this.endedHandled = true;
      this.kbm.exitPointerLock();
    }
    if (curr) {
      this.styleBar.update(curr.style, curr.xp, curr.talents);
      const inRun = world.run.phase === 'intro' || world.run.phase === 'wave' || world.run.phase === 'rest';
      this.hud.update(curr, realDt, inRun);
      const mv = tuning.movement;
      const sprint = Math.min(1, Math.max(0, (Math.hypot(curr.vx, curr.vz) - mv.runSpeed) / Math.max(0.1, mv.sprintSpeed - mv.runSpeed)));
      this.cam.setColliders(world.run.gateClosed ? this.world.colliders : this.world.collidersOpen);
      this.cam.update(realDt, this.hero.root.position, sprint);
    }
    this.room.update(realDt, this.presentTime, this.cam.occluders, world.run.gateClosed);
    if (draw) this.gfx.render();
    this.crt.update();
    this.music.setMood(Game.moodFor(world));
    this.music.update(realDt);

    this.debug.setExtra(
      `${this.session.status()}\n` +
        (curr
          ? `tick ${world.tick}  speed ${Math.hypot(curr.vx, curr.vz).toFixed(2)} m/s\n` +
            `cam dist ${this.cam.currentDistance.toFixed(2)} m  dodges ${curr.dodgeCharges}/${tuning.dodge.charges}` +
            (curr.invulnerable ? '  [iframes]' : '') +
            `\n${curr.style} ${curr.mode}` +
            (curr.mode === 'attack' ? ` hit ${curr.attackHit + 1}  ${(curr.attackTime * 1000).toFixed(0)} ms` : '') +
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

  /** Title screen: the fight idles behind a slow camera drift around the arena. */
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
    // A slow sway just inside the entrance, looking up the arena past the braziers.
    const sway = Math.sin(this.titleTime * 0.08);
    const cam = this.cam.camera;
    cam.position.set(sway * 3.2, 3.4 + Math.sin(this.titleTime * 0.13) * 0.3, 11.2);
    cam.lookAt(sway * 1.5, 2.3, -6);
    cam.updateMatrixWorld();
    this.room.update(realDt, this.presentTime, new Set(), false);
    if (draw) this.gfx.render();
    this.crt.update();
    this.music.setMood('calm');
    this.music.update(realDt);
  }

  /** Off the title screen into the antechamber; lock the mouse unless a menu should stay up. */
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
      if (ev.kind === 'pickup' && ev.playerId === localId) {
        // Found gear is kept; an empty slot equips it straight away.
        const before = Object.keys(this.profile.data.equipped).length;
        this.profile.addItem(ev.item);
        if (Object.keys(this.profile.data.equipped).length !== before) this.applyProfile(false);
        dirty = true;
      }
      if (ev.kind === 'levelUp' && ev.playerId === localId) dirty = true;
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
    }
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
    return {
      moveX: b.fx * y + b.rx * x,
      moveZ: b.fz * y + b.rz * x,
      sprint: actions.held.has('sprint'),
      aimX: b.fx,
      aimZ: b.fz,
      dodge: false,
      attack: false,
      jump: false,
      swapTo: null,
      ability1: false,
      ability2: false,
      lockTarget: this.lockOn.targetId,
      block: actions.held.has('block'),
      interact: actions.held.has('interact'),
    };
  }

  private static noPresses(): Pick<PlayerCommand, 'dodge' | 'attack' | 'jump' | 'swapTo' | 'ability1' | 'ability2'> {
    return { dodge: false, attack: false, jump: false, swapTo: null, ability1: false, ability2: false };
  }

  /** 1/2/3 pick a style; wheel and d-pad cycle from the current one. */
  private requestedStyle(actions: ActionFrame): Style | null {
    if (actions.pressed.has('style1')) return 'sword';
    if (actions.pressed.has('style2')) return 'bow';
    if (actions.pressed.has('style3')) return 'staff';
    const step = (actions.pressed.has('styleNext') ? 1 : 0) - (actions.pressed.has('stylePrev') ? 1 : 0);
    if (!step) return null;
    const current = STYLES.indexOf(this.pending.swapTo ?? this.me()?.style ?? 'sword');
    return STYLES[(current + step + STYLES.length) % STYLES.length];
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
          <tr><td>Camera</td><td>mouse · right stick</td></tr>
          <tr><td>Attack</td><td>left click · X / Square (chains up to 5 hits)</td></tr>
          <tr><td>Abilities</td><td>Q, E · LB, RB</td></tr>
          <tr><td>Lock on</td><td>Tab · middle click · right stick click (flick to switch)</td></tr>
          <tr><td>Swap hero</td><td>1 knight · 2 archer · 3 mage · wheel · D-pad</td></tr>
          <tr><td>Dodge</td><td>Ctrl · B / Circle (no direction = backstep; interrupts attacks)</td></tr>
          <tr><td>Guard</td><td>hold right click · LT / L2 (raise it just before a hit to parry)</td></tr>
          <tr><td>Jump</td><td>Space · Y / Triangle</td></tr>
          <tr><td>Revive an ally</td><td>hold F · hold A / Cross</td></tr>
          <tr><td>Debug panel</td><td>\` (backtick)</td></tr>
          <tr><td>Slow motion</td><td>\\ (backslash)</td></tr>
          <tr><td>Gear &amp; talents</td><td>I · View (between runs)</td></tr>
          <tr><td>Hitboxes</td><td>H</td></tr>
          <tr><td>Release mouse / pause</td><td>Esc</td></tr>
        </table>`;
    el.addEventListener('click', (e) => e.stopPropagation());
    return el;
  }

  private updateOverlay(): void {
    const show = !this.kbm.pointerLocked && !this.debug.visible && !this.equip.visible && !this.title?.visible;
    this.overlay.style.display = show ? 'flex' : 'none';
  }
}
