import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { WEAPON_CLASSES, jumpAirMs, type WeaponClass } from "@hearthgate/shared";
import type { Figure } from "./figures";

/**
 * The KayKit figures (decisions.md 2026-10-14: an asset pack instead of a commission). Every
 * player is the Knight, whatever the weapon, since Hearthgate has no classes; villagers are the
 * pack's other bodies. Loaded once before anyone joins (`loadModels`), then each figure is its own
 * `SkeletonUtils.clone` with one `AnimationMixer` driven by `RigAnimator` from the timers render.ts
 * already has. Draw-only: the clips never move the figure, and the swing's hit frame need not
 * line up with the server's hit.
 */

const BASE = `${import.meta.env.BASE_URL}models/kaykit/`;
const BODIES = ["Knight", "Barbarian", "Mage", "Ranger", "Rogue"] as const;
type Body = (typeof BODIES)[number];
/** The villagers' bodies, in the order the level lists its villagers. */
const VILLAGER_BODIES: readonly Body[] = ["Barbarian", "Mage", "Ranger", "Rogue"];
const WEAPON_MODELS = ["sword_1handed", "sword_2handed", "axe_2handed", "bow_withString"] as const;
export type WeaponModel = (typeof WEAPON_MODELS)[number];
/** The Dungeon Pack pieces the Warrens are dressed with (dungeon.ts); all share one texture. */
const KIT_PIECES = ["wall", "wall_endcap", "floor_tile_large", "torch_mounted", "pillar", "barrel_large", "crates_stacked"] as const;
export type KitPiece = (typeof KIT_PIECES)[number];
/** The Rig_Medium clip files the clips below come from; the pack's other files are not loaded. */
const CLIP_FILES = ["General", "MovementBasic", "MovementAdvanced", "CombatMelee", "CombatRanged"] as const;

/** Each figure state and the pack clip that draws it. */
const CLIPS = {
  idle: "Idle_A",
  idle2H: "Melee_2H_Idle",
  idleBow: "Ranged_Bow_Idle",
  walk: "Walking_A",
  run: "Running_A",
  runBow: "Running_HoldingBow",
  block: "Melee_Blocking",
  crawl: "Crawling",
  death: "Death_A",
  swing1H: "Melee_1H_Attack_Chop",
  swing2H: "Melee_2H_Attack_Chop",
  shoot: "Ranged_Bow_Release",
  dodge: "Dodge_Forward",
  jump: "Jump_Full_Short",
  hit: "Hit_A",
  revive: "Spawn_Ground"
} as const;
type ClipKey = keyof typeof CLIPS;

/** The Knight stands this tall, metres: the old figure's height, so tags and bars sit where they did. */
export const KNIGHT_HEIGHT_M = 1.8;
/** The party-colour outline's width, metres. */
const OUTLINE_M = 0.022;
/** Walking_A covers about this much ground a second at time scale 1, Running_A this much. */
const WALK_CLIP_MPS = 1.6;
const RUN_CLIP_MPS = 4.5;
/** Below this drawn speed a figure stands; below RUN_FROM_MPS it walks. */
const STAND_BELOW_MPS = 0.3;
const RUN_FROM_MPS = 2.6;
/** Fades, seconds: between base clips, into a one-shot (swing, dodge) and back out of it. */
const BASE_FADE_S = 0.15;
const SHOT_IN_S = 0.06;
const SHOT_OUT_S = 0.15;
/**
 * A new figure starts no one-shot for this long: the first patch of a join or a hand-off puts the
 * predicted time a few ticks before zero for a frame, which reads as a dodge and a swing in progress.
 */
const SETTLE_S = 0.3;

interface Loaded {
  bodies: Record<Body, THREE.Object3D>;
  weapons: Record<WeaponModel, THREE.Object3D>;
  clips: Map<string, THREE.AnimationClip>;
  /** Rig units to metres, from the Knight's bind-pose height. */
  scale: number;
  /** Each kit piece's geometry, its node transforms baked in. */
  kit: Record<KitPiece, THREE.BufferGeometry>;
  /** The one material every kit piece draws with: the pack's `dungeon_texture.png`. */
  kitMaterial: THREE.MeshStandardMaterial;
}

let loaded: Loaded | null = null;
let loading: Promise<void> | null = null;

/** Load every model and clip the figures use; resolves once, and later calls share it. */
export function loadModels(): Promise<void> {
  loading ??= load();
  return loading;
}

export function modelsReady(): boolean {
  return loaded !== null;
}

/** Every clip name in the loaded files, for the devlog and the debug handle. */
export function clipNames(): string[] {
  return loaded ? [...loaded.clips.keys()] : [];
}

async function load() {
  const loader = new GLTFLoader();
  const [bodies, weapons, clipFiles, kitFiles] = await Promise.all([
    Promise.all(BODIES.map((b) => loader.loadAsync(`${BASE}adventurers/characters/${b}.glb`))),
    Promise.all(WEAPON_MODELS.map((w) => loader.loadAsync(`${BASE}adventurers/weapons/${w}.gltf`))),
    Promise.all(CLIP_FILES.map((f) => loader.loadAsync(`${BASE}animations/Rig_Medium_${f}.glb`))),
    Promise.all(KIT_PIECES.map((k) => loader.loadAsync(`${BASE}dungeon/${k}.gltf`)))
  ]);
  let kitMaterial: THREE.MeshStandardMaterial | null = null;
  const kit = {} as Record<KitPiece, THREE.BufferGeometry>;
  KIT_PIECES.forEach((k, i) => {
    const scene = kitFiles[i].scene;
    scene.updateMatrixWorld(true);
    let mesh: THREE.Mesh | null = null;
    scene.traverse((o) => {
      if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error(`KayKit piece ${k} has no mesh`);
    const m = mesh as THREE.Mesh;
    kit[k] = m.geometry.clone().applyMatrix4(m.matrixWorld);
    kitMaterial ??= m.material as THREE.MeshStandardMaterial;
  });
  const clips = new Map<string, THREE.AnimationClip>();
  for (const file of clipFiles) for (const clip of file.animations) clips.set(clip.name, rootInPlace(clip));
  for (const key of Object.keys(CLIPS) as ClipKey[]) if (!clips.has(CLIPS[key])) throw new Error(`KayKit clip ${CLIPS[key]} is missing`);
  const knight = bodies[0].scene;
  const box = new THREE.Box3().setFromObject(knight);
  const scale = KNIGHT_HEIGHT_M / (box.max.y - box.min.y);
  loaded = {
    bodies: Object.fromEntries(BODIES.map((b, i) => [b, bodies[i].scene])) as unknown as Record<Body, THREE.Object3D>,
    weapons: Object.fromEntries(WEAPON_MODELS.map((w, i) => [w, weapons[i].scene])) as unknown as Record<WeaponModel, THREE.Object3D>,
    clips,
    scale,
    kit,
    kitMaterial: kitMaterial!
  };
}

/**
 * The server places the figure: a clip that slides the rig's root (the dodge does, 0.25 units)
 * would draw it somewhere the server never put it, so the root's translation is dropped.
 */
function rootInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter((t) => t.name !== "root.position");
  return clip;
}

/** One outline material per figure: the party colour, pushed out along the normals and drawn back faces only. */
function outlineMaterial(color: THREE.Color, width: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\ntransformed += normal * ${width.toFixed(5)};`);
  };
  m.customProgramCacheKey = () => `outline${width.toFixed(5)}`;
  return m;
}

/** Give every mesh of a cloned body an outline twin on the same skeleton. */
function addOutline(root: THREE.Object3D, mat: THREE.Material) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    let twin: THREE.Mesh;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      const sk = mesh as THREE.SkinnedMesh;
      const s = new THREE.SkinnedMesh(sk.geometry, mat);
      s.bind(sk.skeleton, sk.bindMatrix);
      twin = s;
    } else {
      twin = new THREE.Mesh(mesh.geometry, mat);
    }
    twin.position.copy(mesh.position);
    twin.quaternion.copy(mesh.quaternion);
    twin.scale.copy(mesh.scale);
    twin.frustumCulled = false;
    mesh.parent!.add(twin);
  }
}

/** A bone by its name as three's loader keeps it: the pack's dots are dropped ("handslot.r" is "handslotr"). */
function bone(root: THREE.Object3D, name: string): THREE.Object3D {
  const b = root.getObjectByName(name);
  if (!b) throw new Error(`KayKit rig has no ${name}`);
  return b;
}

/** A cloned body as a `Figure`: the scaled rig under a root at the feet, facing +z. */
function bodyFigure(body: Body, outline: THREE.Color | null): Figure {
  if (!loaded) throw new Error("loadModels() has not finished");
  const root = new THREE.Group();
  const rig = cloneSkinned(loaded.bodies[body]);
  rig.scale.setScalar(loaded.scale);
  rig.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      // A mixer moves the bones past the bind pose's bounds (a crawl, a fall).
      o.frustumCulled = false;
    }
  });
  root.add(rig);
  // The flashing colour is the outline's; villagers get none and keep a material nobody draws.
  const skin = outline ? outlineMaterial(outline, OUTLINE_M / loaded.scale) : new THREE.MeshBasicMaterial();
  if (outline) addOutline(rig, skin);
  const figure: Figure = {
    root,
    legs: [bone(rig, "upperlegl"), bone(rig, "upperlegr")],
    arms: [bone(rig, "upperarml"), bone(rig, "upperarmr")],
    hand: bone(rig, "handslotr"),
    skin,
    hunch: 0,
    height: KNIGHT_HEIGHT_M
  };
  figure.rig = new RigAnimator(rig, loaded.clips);
  return figure;
}

/** A player: the Knight, outlined in the party colour. */
export function knightFigure(partyColor: THREE.Color): Figure {
  return bodyFigure("Knight", partyColor);
}

/** The i-th villager of a level: the pack's other bodies in turn, standing in its idle. */
export function villagerFigure(i: number): Figure {
  const f = bodyFigure(VILLAGER_BODIES[i % VILLAGER_BODIES.length], null);
  // Each starts its idle at a different point, so a square of them does not breathe in step.
  f.rig!.offsetIdle(i * 0.37);
  return f;
}

/** The pack weapon for a weapon class (and, for two-handers, the type: an axe or a hammer reads as an axe). */
export function weaponModelFor(cls: WeaponClass, type: string): WeaponModel {
  if (cls === "bow") return "bow_withString";
  if (cls === "twoHand") return type === "claymore" ? "sword_2handed" : "axe_2handed";
  return "sword_1handed";
}

/** A Dungeon Pack piece's geometry and the kit's one shared material. */
export function kitPiece(k: KitPiece): { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  if (!loaded) throw new Error("loadModels() has not finished");
  return { geometry: loaded.kit[k], material: loaded.kitMaterial };
}

/** A fresh copy of a pack weapon with its own materials, so a per-player tint never leaks. */
export function weaponMesh(model: WeaponModel): THREE.Object3D {
  if (!loaded) throw new Error("loadModels() has not finished");
  const w = loaded.weapons[model].clone();
  w.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.material = (m.material as THREE.Material).clone();
  });
  return w;
}

/** What a figure is doing this frame, from the drawn state render.ts already keeps. */
export interface RigState {
  /** Drawn ground speed, m/s. */
  speed: number;
  cls: WeaponClass;
  attacking: boolean;
  guarding: boolean;
  dodging: boolean;
  jumping: boolean;
  /** A blow landed this frame. */
  hit: boolean;
  downed: boolean;
  dead: boolean;
}

const IDLE_STATE: RigState = { speed: 0, cls: "oneHand", attacking: false, guarding: false, dodging: false, jumping: false, hit: false, downed: false, dead: false };

/**
 * One mixer per figure. A base clip loops (idle, walk, run, block, crawl, or the fall held at its
 * end) and cross-fades when the state changes; a one-shot (swing, dodge, flinch, the stand-up
 * after a revive) plays over it and hands back. Weights are set by hand each frame, since three's
 * mixer averages weights rather than layering them. Nothing is allocated per frame.
 */
export class RigAnimator {
  readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<ClipKey, THREE.AnimationAction>;
  private readonly bases: THREE.AnimationAction[];
  private readonly baseW = new Map<THREE.AnimationAction, number>();
  private base: THREE.AnimationAction;
  private shot: THREE.AnimationAction | null = null;
  private was: RigState = { ...IDLE_STATE };
  private age = 0;

  constructor(root: THREE.Object3D, clips: Map<string, THREE.AnimationClip>) {
    this.mixer = new THREE.AnimationMixer(root);
    const a = {} as Record<ClipKey, THREE.AnimationAction>;
    for (const key of Object.keys(CLIPS) as ClipKey[]) a[key] = this.mixer.clipAction(clips.get(CLIPS[key])!);
    this.actions = a;
    this.bases = [a.idle, a.idle2H, a.idleBow, a.walk, a.run, a.runBow, a.block, a.crawl, a.death];
    for (const b of this.bases) {
      b.play();
      b.setEffectiveWeight(0);
      this.baseW.set(b, 0);
    }
    for (const once of [a.death, a.swing1H, a.swing2H, a.shoot, a.dodge, a.jump, a.hit, a.revive]) {
      once.setLoop(THREE.LoopOnce, 1);
      once.clampWhenFinished = true;
    }
    this.base = a.idle;
    this.baseW.set(a.idle, 1);
    a.idle.setEffectiveWeight(1);
  }

  offsetIdle(seconds: number) {
    this.actions.idle.time = seconds % this.actions.idle.getClip().duration;
  }

  /** The current base clip's name and the one-shot's, if any: the e2e checks read them. */
  playing(): string {
    return this.shot ? `${this.base.getClip().name}+${this.shot.getClip().name}` : this.base.getClip().name;
  }

  private startShot(key: ClipKey, fitS = 0) {
    const act = this.actions[key];
    if (this.shot && this.shot !== act) this.shot.setEffectiveWeight(0);
    const d = act.getClip().duration;
    act.reset();
    // Fit a swing into the time the player is committed to it, never slower than the clip.
    act.timeScale = fitS > 0 ? Math.max(1, d / fitS) : 1;
    act.play();
    this.shot = act;
  }

  private chooseBase(s: RigState): THREE.AnimationAction {
    const a = this.actions;
    if (s.dead) return a.death;
    if (s.downed) return a.crawl;
    if (s.guarding) return a.block;
    if (s.speed < STAND_BELOW_MPS) return s.cls === "bow" ? a.idleBow : s.cls === "twoHand" ? a.idle2H : a.idle;
    if (s.speed < RUN_FROM_MPS) return a.walk;
    return s.cls === "bow" ? a.runBow : a.run;
  }

  update(dtS: number, s: RigState = IDLE_STATE) {
    const a = this.actions;
    const w = this.was;
    const lying = s.dead || s.downed;
    this.age += dtS;
    if (this.age < SETTLE_S) {
      // Take the state as it stands, without the edges into it.
      w.attacking = s.attacking;
      w.dodging = s.dodging;
      w.jumping = s.jumping;
      w.downed = s.downed;
      w.dead = s.dead;
    }
    if (s.dead && !w.dead) {
      this.shot = null;
      a.death.reset().play();
    } else if (!lying && (w.dead || w.downed)) this.startShot("revive");
    else if (!lying && s.dodging && !w.dodging) this.startShot("dodge");
    else if (!lying && s.jumping && !w.jumping) this.startShot("jump", jumpAirMs() / 1000);
    else if (!lying && s.attacking && !w.attacking) {
      const fit = (WEAPON_CLASSES[s.cls].durationMs + 300) / 1000;
      this.startShot(s.cls === "bow" ? "shoot" : s.cls === "twoHand" ? "swing2H" : "swing1H", fit);
    } else if (!lying && s.hit && this.age >= SETTLE_S && (this.shot === null || this.shot === a.hit)) this.startShot("hit");
    if (lying && this.shot) this.shot = null;
    w.speed = s.speed;
    w.cls = s.cls;
    w.attacking = s.attacking;
    w.guarding = s.guarding;
    w.dodging = s.dodging;
    w.jumping = s.jumping;
    w.downed = s.downed;
    w.dead = s.dead;

    this.base = this.chooseBase(s);
    // Walk and run keep their feet on the ground: the clip runs at the drawn speed.
    if (this.base === a.walk) a.walk.timeScale = s.speed / WALK_CLIP_MPS;
    else if (this.base === a.run || this.base === a.runBow) this.base.timeScale = s.speed / RUN_CLIP_MPS;
    else if (this.base === a.crawl) a.crawl.timeScale = 0.25 + s.speed;

    let shotW = 0;
    if (this.shot) {
      const act = this.shot;
      const left = (act.getClip().duration - act.time) / act.timeScale;
      if (left <= 0) {
        act.setEffectiveWeight(0);
        this.shot = null;
      } else shotW = Math.min(1, act.time / act.timeScale / SHOT_IN_S, left / SHOT_OUT_S);
    }
    const k = 1 - Math.exp(-dtS / BASE_FADE_S);
    for (const b of this.bases) {
      const cur = this.baseW.get(b)!;
      const next = cur + ((b === this.base ? 1 : 0) - cur) * k;
      this.baseW.set(b, next < 0.001 ? 0 : next);
      b.setEffectiveWeight(next * (1 - shotW));
    }
    if (this.shot) this.shot.setEffectiveWeight(shotW);
    this.mixer.update(dtS);
  }
}
