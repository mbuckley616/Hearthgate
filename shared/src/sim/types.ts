import type { BagRoom } from './bagRoom';
import type { ChampionState } from './champion';
import type { ComboMastery } from './mastery';
import type { AbilityKind, EnemyKind, Style } from '../config/tuning';
import type { Item, Mods, Perk } from './gear';
import type { GearItem } from './catalogue';
import type { FloorRunState } from './floorRun';
import type { FlowState } from './flow';
import type { HenchmanBrain } from './henchman';
import type { PropKind } from '../level/floor';
import type { TalentRanks } from './talents';
import type { Element, SpecElements, Specs, SpecTree } from './specs';

/**
 * Simulation state. Everything here must stay plain, serializable data
 * (JSON-safe numbers, strings, booleans, arrays, plain objects) so a host can
 * snapshot it and send it to peers in M5.
 */

/** Yaw convention: facing direction is (sin yaw, 0, cos yaw); yaw 0 faces +Z. */
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  /** 'down' = at zero health; 'hurt' = interrupted by a heavy enemy attack (or a broken guard). */
  mode: 'move' | 'dodge' | 'attack' | 'ability' | 'guard' | 'hurt' | 'down';
  /** Seconds elapsed in the current dodge. */
  dodgeTime: number;
  dodgeDirX: number;
  dodgeDirZ: number;
  /** Metres this dodge covers; a neutral dodge is a shorter backstep (no roll). */
  dodgeDist: number;
  dodgeBackstep: boolean;
  /** Dodge pressed during hitstop: taken as soon as it ends. */
  dodgeBuffered: boolean;
  /** Seconds the guard has been up (mode 'guard'). */
  guardTime: number;
  /** Sim time the guard was last raised, for the parry re-arm rule. */
  guardRaisedAt: number;
  /** This raise opened a parry window. */
  parryOpen: boolean;
  /** Increments per parry / blocked hit, so views can react. */
  parrySeq: number;
  blockSeq: number;
  /** Guard was held last tick (a fresh press can interrupt an attack; holding doesn't). */
  blockWasHeld: boolean;
  /** Shown above the hero to other players. */
  name: string;
  /** While down: seconds an ally has held revive on them (brief: 3 s brings them back). */
  reviveProgress: number;
  /**
   * Hearthgate's downs (T5, coop.bleedOut): while down, seconds of bleed-out left; at 0 the hero is out
   * until the room is cleared or a Revive Draught brings them back. Absent when up, and always with
   * the slice's downs, so the slice's state never carries it.
   */
  bleed?: number;
  /** Revive Draughts this hero carries on this floor (T5; absent with the slice's downs). */
  draughts?: number;
  /** Seconds enemy hits on this hero wait before landing (remote players; see coop.lagGraceMs). */
  lagGrace: number;
  dodgeCharges: number;
  /** Seconds accumulated toward the next dodge charge. */
  dodgeRecharge: number;
  /** Seconds until another dodge is allowed. */
  dodgeCooldown: number;
  invulnerable: boolean;
  /** Active combat style: sword, bow or staff. */
  style: Style;
  /** Current attack of the active style's chain (0-based). */
  attackHit: number;
  /** Seconds into the current attack. */
  attackTime: number;
  /** The projectile or burst for this attack has been spawned. */
  attackFired: boolean;
  /** A buffered click waiting for the chain window. */
  attackQueued: boolean;
  /** Increments every time a swing starts, so views can tell a re-swing from a continuation. */
  attackSeq: number;
  /** Enemies the current swing has already hit (each takes one hit per swing). */
  attackHitIds: number[];
  /**
   * Light and heavy strings (C1), absent in the slice: the presses of this chain so far (L and H),
   * the string move playing if it has one (its key), its charge level (1 or 2 once a hold made it a
   * heavy), and how long attack has been held.
   */
  attackString?: string;
  attackMove?: string;
  attackCharge?: number;
  attackHold?: number;
  /** The hold belongs to a press made during this attack, so it is for the next one, not this. */
  attackHoldNext?: boolean;
  /** The Flow meter (C2), absent in the slice. */
  flow?: FlowState;
  /** Seconds until the off-hand's ability is ready again (C4). */
  offhandCooldown?: number;
  /** A henchman (P3): the server plays it (henchman.ts); portals, banking and loot pass it by. */
  henchman?: true;
  brain?: HenchmanBrain;
  /** Health potions on the hero's belt (D4), up to loop.potionMax; absent in the slice. */
  potions?: number;
  /** Room in the browser's bag for lumber, stone and finds (Michael, 31 Oct, A: sim/bagRoom.ts), from the loadout; absent in the slice. */
  bagRoom?: BagRoom;
  /** Seconds until another potion can be drunk (D4). */
  potionCooldown?: number;
  /** The step of a weapon family's chain (C5); attackHit is then the style's step whose pose it borrows. */
  attackStep?: number;
  /** A tome's ward on this hero (C5): hits it will absorb, until sim time. */
  ward?: { hits: number; until: number };
  /** Standing in lava (D6): seconds to the next burn. Absent off it. The server's alone (sim/lava.ts). */
  burn?: number;
  /**
   * Chilled (E1d, Michael's A, 4 Nov): seconds left. Moves `chill.slow` slower and cannot sprint;
   * attacks, dodges and abilities are untouched. Set by the server (a Wraith's circle), counted down in
   * stepPlayer, so prediction runs it down the same way. Absent when not chilled.
   */
  chill?: number;
  hp: number;
  /** Seconds frozen by hitstop. */
  hitstop: number;
  /** Seconds until getting back up while down. */
  downTime: number;
  /** Seconds of invulnerability left after getting up. */
  invulnTime: number;
  /** Soft-target enemy id for the current attack, or -1. */
  attackTarget: number;
  /** The last command's free-aim pitch (D12), for the shot that leaves later in the attack; absent without free aim. */
  aimPitch?: number;
  /** Lunge distance for the current swing (stretched toward a soft target). */
  attackLunge: number;
  /** Ability being performed (mode 'ability'). */
  ability: AbilityKind;
  abilityTime: number;
  /** The ability's main effect has fired. */
  abilityFired: boolean;
  /** Whirlwind ticks dealt so far. */
  abilityTicks: number;
  /** Increments per ability use, so views can restart animations. */
  abilitySeq: number;
  /** Enemies the current ability has already hit (charge stops at the first). */
  abilityHitIds: number[];
  /** Seconds left on each style's Q and E. */
  cooldowns: Record<Style, [number, number]>;
  /** Blink primes the next bolt to crit. */
  nextBoltCrit: boolean;
  /** Q/E pressed during a windup: fires as soon as recovery starts (-1 = none). */
  queuedAbility: number;
  /** Hero swap pressed mid-attack or mid-ability: applied as soon as it can be. */
  queuedSwap: Style | null;
  /** Experience per style (brief: use-based levels). Levels derive from it. */
  xp: Record<Style, number>;
  /** Max health, including gear and (healthPerLevel) the level of the weapon in hand. */
  maxHp: number;
  /**
   * Max health before the level's share: what the loadout brings, Vitality included. Set only while
   * progression.healthPerLevel is on, so the slice's state never carries it.
   */
  hpBase?: number;
  /** What equipped gear adds (stats and perks). The items themselves live in the client's saved profile. */
  mods: Mods;
  /**
   * What the hero wears (T5c): catalogue ids, one a slot, from the loadout. Only the views read it;
   * absent in the slice, so its state never carries it.
   */
  look?: string[];
  /** The player's champion points (T6b), shared by their characters; absent in the slice. */
  champion?: ChampionState;
  /** Their specializations (the builds pass), one a style from level 10; absent in the slice and below it. */
  spec?: Specs;
  /** The element each of those specializations was given, where it offers a choice (the Spellblade's four); absent, its first. */
  elements?: SpecElements;
  /** The tree nodes picked for each of those specializations (Michael's A, 8 Nov); absent, none. */
  tree?: SpecTree;
  /** Payoffs landed per combo (combo mastery): the player's, from the loadout, counted by the server. */
  mastery?: ComboMastery;
  /** A Rogue's roll went through an enemy: their next hit crits from behind until this sim time (From the shadows). */
  shadowUntil?: number;
  /** The parrying dagger's Riposte parried a hit: the next blow before this sim time crits. Absent otherwise. */
  riposteUntil?: number;
  /** The focus orb's Focus: seconds left of faster, harder casts. Absent otherwise. */
  focusTime?: number;
  /** Gale Step (the Scout's Disengage): a second press before this sim time rolls, free. Absent otherwise. */
  galeUntil?: number;
  /** Smoke Bomb (the Assassin's Disengage): no enemy targets this hero before this sim time. Absent otherwise. */
  hiddenUntil?: number;
  /** Talent ranks per hero, from the saved profile. */
  talents: Record<Style, TalentRanks>;
  /** Sim time this hero last landed a finisher (heavy hit), for the dodge-refund perk. */
  lastFinisherAt: number;
  /** Seconds left in a heavy-hit interrupt, and the shove that comes with it. */
  hurtTime: number;
  kbx: number;
  kbz: number;
}

export type EnemyAi =
  | 'spawn'
  | 'chase'
  | 'windup'
  | 'slash1'
  | 'between'
  | 'slash2'
  | 'aim'
  | 'shoot'
  | 'slamWindup'
  | 'slam'
  | 'sweepWindup'
  | 'sweep'
  | 'roar'
  | 'chargeWindup'
  | 'charge'
  | 'chant'
  | 'recover'
  | 'stagger'
  | 'dead';

/** A telegraphed danger zone on the ground (or an aim line), shared by sim hit checks and the view. */
export interface Telegraph {
  shape: 'none' | 'circle' | 'cone' | 'line';
  x: number;
  z: number;
  /** Circle/cone radius; for a line, its length. */
  radius: number;
  /** Cone/line direction. */
  yaw: number;
  arcDeg: number;
}

/** Enemy of any kind. Same yaw convention as players. */
export interface EnemyState {
  id: number;
  kind: EnemyKind;
  x: number;
  /** Ground height under it (the ledge, ramps). */
  y: number;
  z: number;
  yaw: number;
  /** Steering velocity. */
  vx: number;
  vz: number;
  /** Knockback velocity, decays with friction. */
  kbx: number;
  kbz: number;
  hp: number;
  poise: number;
  ai: EnemyAi;
  /** Seconds in the current AI state. */
  aiTime: number;
  /** Seconds frozen by hitstop. */
  hitstop: number;
  /** Seconds of flinch (AI paused) from light hits. */
  flinch: number;
  /** Seconds of burst slow left. */
  slowTime: number;
  /** Seconds frozen solid (frost ring): no AI, no movement. */
  frozen: number;
  /** Bleed perk: ticks left, seconds to the next tick, and who applied it. */
  bleedTicks: number;
  bleedTimer: number;
  bleedOwner: string;
  /** Holds one of the target's attack tokens (brief: at most two attackers per player). */
  hasToken: boolean;
  /** Seconds before this grunt may take a token again. */
  cooldown: number;
  /** Seconds before poise starts regenerating. */
  poiseWait: number;
  /** Sim time of the last damage taken, or -1. Drives the white flash. */
  lastHitAt: number;
  /** +1 or -1: which way it circles while waiting for a token. */
  strafeDir: number;
  /** Health at spawn (scaled for party size). */
  maxHp: number;
  /** Haunted (P8): has fallen once and got up again; the next fall is for good. */
  risen?: true;
  /** A mini-boss (G4): its name, over the boss bar and under its crown. Absent on every other enemy. */
  named?: string;
  /** A treasure room's guard (G5's C): that room's id. It holds no fight room from clearing. */
  guard?: number;
  /** Launched corpse (K1): who killed it, what it deals, and the enemies it has already met. */
  launched?: { by: string; damage: number; struck: number[] };
  tele: Telegraph;
  /** Recovery length for the attack just made (s). */
  recoverTime: number;
  /** Warden: 1, or 2 after the roar (and 3 after the second, E1g). */
  phase: number;
  /** Warden: has roared and summoned. */
  summoned: boolean;
  /** Warden: which attack the current windup is ('sweep' | 'slam' | 'farSlam' | 'chainSlam'). */
  attack: string;
  /** Warden, phase 3's rolling slam (E1g): circles already landed; absent outside one. */
  chain?: number;
  /**
   * The Hollow King's crown in flight (G4b): how far along its line, whether it is on its way back,
   * and the heroes it has struck this way (each once out and once back). Absent unless thrown.
   */
  crown?: { d: number; length: number; back: boolean; struck: string[] };
  /** The Hollow King's violet circles (G4b, phase 2): one under each hero standing as he cast. */
  circles?: { x: number; z: number }[];
  /** Cross-style combo windows: sim time each setup lasts until (-1 = none). */
  shatterUntil: number;
  skewerUntil: number;
  detonateUntil: number;
  /**
   * Seconds of hyper-armour left after getting up from a broken stagger (G1; Michael, 2 Nov): hits
   * still hurt but neither build poise nor interrupt. Brutes and bosses only; absent otherwise.
   */
  armour?: number;
  /** The remains a Bone Priest is chanting over (E1e). Leader role only, while it chants. */
  raiseId?: number;
  /** A Shieldbearer's guard is down until this sim time (E1b): a heavy broke it. Shield role only. */
  guardDownUntil?: number;
  /** What its hits are multiplied by: a harder portal's (G3). Absent means 1, as in the slice. */
  hitMult?: number;
  /** A Paladin's Shield Rush holds it to them until this sim time (the builds pass). The server's alone. */
  taunt?: { by: string; until: number };
  /** A Ranger's Thornshot holds it to the spot until this sim time (the builds pass): it turns and strikes but does not walk. */
  rootUntil?: number;
  /** A Scout's mark (the builds pass): party hits on it deal more and fill the Scout's Flow until `until`. */
  scoutMark?: { by: string; until: number };
  /** An Assassin's Venom Volley poison (the builds pass): `stacks` each tick for `specs.venomDamage` at `next`, until `until`. The server's alone. */
  venom?: { by: string; stacks: number; until: number; next: number };
  /** A Warlock's hex (the builds pass): every hit on it deals more, and the Warlock's drain them, until `until`. */
  hex?: { by: string; until: number };
  /** A Frost Sorcerer's Chill (Attunement, the builds pass): bolts landed while it holds, until `until`; the next that reaches the count freezes. The server's alone. */
  attuneChill?: { hits: number; until: number };
  /** Who made each setup, for Teamwork (T6c); kept only for heroes with champion points, so never in the slice. */
  shatterBy?: string;
  skewerBy?: string;
  detonateBy?: string;
}

/** Arrows, magic bolts and bursts. Bursts sit still and expand. */
export interface ProjectileState {
  id: number;
  kind: 'arrow' | 'bolt' | 'burst' | 'blade';
  owner: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds alive. */
  age: number;
  /** Seconds until removal. */
  life: number;
  /** Arrow embedded in a wall or the floor. */
  stuck: boolean;
  /** Power or piercing shot (gold streak; heavier damage from M1). */
  charged: boolean;
  /** Burst radius in metres; 0 for arrows and bolts. */
  radius: number;
  /** Combat payload from the attack that fired it. */
  damage: number;
  poise: number;
  knockback: number;
  heavy: boolean;
  /** Enemies it can still pass through. */
  pierce: number;
  /** Enemies already hit (a projectile hits each enemy once). */
  hitIds: number[];
  /** The heroes a Druid's bolt has healed passing through them (Bloom), each once. */
  healedIds?: string[];
  /** Rune of Draining: a staff heavy's orb, giving its caster back a share of what it deals. */
  drains?: boolean;
  /** Burst only: slow applied to enemies caught in it (seconds). */
  slowTime: number;
  /** Burst damage has been applied. */
  resolved: boolean;
  /** Bolts: enemy to curve toward, or -1; and how much turning (rad) is left. */
  targetId: number;
  homingLeft: number;
  /** Primed by Blink: shows as a crit. */
  crit: boolean;
  /** Fired by an enemy: hits heroes, not enemies. */
  hostile: boolean;
  /** The hero style that fired it (XP and damage bonuses). */
  style: Style;
  /** A bolt spawned by the chain perk (doesn't chain again). */
  chained: boolean;
  /** Volley arrows mark what they hit for Detonate. */
  marks: boolean;
  /** Already called out a combo (one callout per projectile). */
  comboed: boolean;
}

/** A gear drop on the floor, waiting to be walked over. */
export interface DropState {
  id: number;
  /** Loot is personal: each hero gets their own drop and only they see and take it. */
  owner: string;
  x: number;
  y: number;
  z: number;
  age: number;
  /** The slice's loot, or (T5b, gear.catalogue) a catalogue item. */
  item: Item | GearItem;
  /** Put down from the owner's bag (D13), not found: never banked or lost, taken back as it was. */
  dropped?: true;
  /** A dropped item waits until its owner has stepped away, or it would be picked straight back up. */
  waitAway?: true;
}

export type RunPhase = 'ante' | 'intro' | 'wave' | 'rest' | 'won' | 'lost';

/** The run (brief: grunts, then grunts and archers, then a brute with a mixed group, then the Warden). */
export interface RunState {
  phase: RunPhase;
  /** Current wave, 1-based; 0 before the first. */
  wave: number;
  /** Seconds in the current phase. */
  timer: number;
  /** Seconds since the run started. */
  elapsed: number;
  /** The antechamber gate is down. */
  gateClosed: boolean;
  /** Seconds the gate has been waiting for the rest of the party since the first hero went in (-1 = not waiting). */
  gateWait: number;
  /** The Warden's enemy id, or -1. */
  bossId: number;
  /** Enemies spawned at the start of the current wave, and whether its second group has come. */
  waveSize: number;
  reinforced: boolean;
  /** Where the latest kill happened (the Warden's spot sticks): drops appear there. */
  dropX: number;
  dropZ: number;
  bossDown: boolean;
}

/** One-shot things that happened during a tick, for views, sound and (M5) peers. */
export type SimEvent =
  | { kind: 'hit'; x: number; y: number; z: number; enemyId: number; attackerId: string; damage: number; heavy: boolean; bonus: boolean; crit: boolean; killed: boolean; dirX: number; dirZ: number; local: boolean }
  | { kind: 'stagger'; enemyId: number; x: number; z: number }
  | { kind: 'heroHurt'; playerId: string; damage: number; x: number; z: number; heavy: boolean }
  | { kind: 'heroDown'; playerId: string }
  /** Through a village door (the server's alone): the sound of it opening, where the hero came out. */
  | { kind: 'door'; playerId: string; x: number; z: number }
  | { kind: 'parry'; playerId: string; x: number; y: number; z: number; enemyId: number }
  /** A jump cleared a low attack (M1): the server's alone, as every hit on a hero is. */
  | { kind: 'cleared'; playerId: string; x: number; y: number; z: number; ground: number }
  /** A hero was Chilled (E1d): the frost tint and the corner's icon start from the state, this is for the sound. */
  | { kind: 'chilled'; playerId: string; x: number; z: number }
  | { kind: 'rooted'; playerId: string; enemyId: number; x: number; z: number }
  | { kind: 'scoutMarked'; playerId: string; enemyId: number; x: number; z: number }
  /** A player's mastery of a combo reached a new rank, I to V (the builds pass: combo mastery). */
  | { kind: 'masteryRank'; playerId: string; combo: Combo; rank: number }
  | { kind: 'bloom'; playerId: string; healedId: string; x: number; y: number; z: number; healed: number }
  /** A Sorcerer's bolt lands in its element (Attunement): Fire's burst `radius` wide, Air's arc on to `toX`, `toZ`. */
  | { kind: 'attune'; playerId: string; element: Element; x: number; y: number; z: number; radius: number; toX?: number; toZ?: number }
  | { kind: 'hexed'; playerId: string; enemyId: number; x: number; y: number; z: number }
  | { kind: 'venom'; playerId: string; enemyId: number; stacks: number; x: number; y: number; z: number }
  | { kind: 'smokeBomb'; playerId: string; x: number; y: number; z: number }
  | { kind: 'galeStep'; playerId: string; x: number; y: number; z: number }
  | { kind: 'stormChain'; playerId: string; fromX: number; fromZ: number; toX: number; toZ: number; y: number }
  /** A Paladin's Shield Rush taunted an enemy (the builds pass): for its sound and the holy flash. */
  | { kind: 'taunt'; playerId: string; enemyId: number; x: number; z: number }
  /** A Rogue's Shadowstep (the builds pass): from where it left to where it stands, for the smoke and its sound. */
  /** A Rogue's roll went through an enemy and primed their next hit (From the shadows): a cue it is ready. */
  | { kind: 'shadowPrimed'; playerId: string; x: number; y: number; z: number }
  | { kind: 'shadowstep'; playerId: string; fromX: number; fromZ: number; x: number; y: number; z: number }
  /** A Paladin's perfect parry pulsed light (Bulwark): `healed` heroes were healed. For its sound and flash. */
  | { kind: 'holyPulse'; playerId: string; x: number; y: number; z: number; healed: number }
  /** A Wraith's circle landed (E1d), whoever it caught: for its sound, heard as it lands rather than as the channel's tell. */
  | { kind: 'circleLanded'; enemyId: number; x: number; z: number; caught: number }
  /** A collapsing tile (G5): a hero stepped on it and it starts to shake; then it falls, taking `caught` with it. */
  | { kind: 'tileCracked'; x: number; z: number }
  | { kind: 'tileFell'; x: number; z: number; caught: number; put: string[] }
  | { kind: 'block'; playerId: string; x: number; y: number; z: number; broke: boolean }
  | { kind: 'swing'; playerId: string; heavy: boolean; x: number; z: number; yaw: number; range: number; arcDeg: number }
  | { kind: 'fire'; playerId: string; projectile: 'arrow' | 'bolt' | 'burst' | 'blade'; heavy: boolean }
  | { kind: 'land'; playerId: string; x: number; z: number; radius: number }
  /** Rune of the Whip: a sword heavy's fire whip, from the hero along `yaw` for `length` metres (stopped by a wall). */
  | { kind: 'whip'; playerId: string; x: number; z: number; yaw: number; length: number }
  /** Rune of Draining: a heavy's orb gave its caster back `amount` health, drawn from (x, y, z). */
  | { kind: 'runeDrain'; playerId: string; x: number; y: number; z: number; amount: number }
  | { kind: 'enemyTelegraph'; enemyId: number }
  | { kind: 'enemySwing'; enemyId: number }
  | { kind: 'enemySpawn'; enemyId: number; x: number; z: number }
  /** Haunted (P8): a fallen enemy got up again, at half its health. */
  | { kind: 'enemyRose'; enemyId: number; x: number; z: number }
  | { kind: 'ability'; playerId: string; ability: AbilityKind; x: number; z: number; yaw: number }
  | { kind: 'frostRing'; playerId: string; x: number; z: number; radius: number; curse?: boolean; thorns?: boolean; element?: Element }
  | { kind: 'blink'; playerId: string; fromX: number; fromZ: number; toX: number; toZ: number; swap?: boolean; grove?: boolean; trail?: boolean }
  | { kind: 'whirlTick'; playerId: string }
  | { kind: 'freeze'; enemyId: number }
  | { kind: 'enemyShot'; enemyId: number }
  | { kind: 'enemySlam'; enemyId: number; x: number; z: number; radius: number; boss: boolean }
  /** A Shieldbearer's shield met a hit (E1b): a deflect spark and sound, no damage. */
  | { kind: 'guarded'; enemyId: number; x: number; y: number; z: number }
  /** A heavy broke a Shieldbearer's guard (E1b). */
  | { kind: 'guardBroken'; enemyId: number }
  | { kind: 'roar'; enemyId: number; /** E1g: the phase this roar begins (absent in the slice's two). */ phase?: number; /** The Hollow King's (G4b), not the Warden's. */ king?: true }
  | { kind: 'runStart' }
  /** A generated floor's party reached its rest room together: their drops are banked (T4). */
  | { kind: 'rested' }
  | { kind: 'waveStart'; wave: number; title: string; boss: boolean }
  | { kind: 'waveCleared'; wave: number }
  | { kind: 'reinforcements'; wave: number }
  | { kind: 'runWon'; time: number }
  | { kind: 'runLost'; wave: number }
  | { kind: 'levelUp'; playerId: string; style: Style; level: number }
  | { kind: 'championPoint'; playerId: string; points: number }
  | { kind: 'dropSpawned'; owner: string; x: number; z: number; rarity: Item['rarity'] }
  | { kind: 'combo'; combo: Combo; playerId: string; x: number; y: number; z: number }
  | { kind: 'revived'; playerId: string; by: string; draught?: boolean }
  /** A downed hero's bleed-out ran out: out of the fight until the room is cleared (T5). */
  | { kind: 'bledOut'; playerId: string }
  | { kind: 'playerJoined'; playerId: string; name: string }
  | { kind: 'playerLeft'; playerId: string; name: string }
  /** Walked over, or handed over when a run ends. On a generated floor it is only carried until banked (P1). */
  | { kind: 'pickup'; playerId: string; item: Item | GearItem; carried?: boolean }
  /** A hero's blow broke a crate, barrel or urn (D4): what it sprayed onto the floor, and whether a potion rolled out. */
  | { kind: 'smashed'; playerId: string; prop: number; propKind: PropKind; x: number; y: number; z: number; lumber: number; stone: number; coin: number; potion: boolean }
  /** A player picked up a piece of a smashed prop's spray (Michael, 29 Oct): it is the party's, carried until the floor banks. */
  | { kind: 'lootTaken'; playerId: string; loot: 'lumber' | 'stone' | 'coin'; amount: number; x: number; y: number; z: number }
  /** A hero picked up a potion (D4); potions is how many they now carry. */
  | { kind: 'potionTaken'; playerId: string; potions: number }
  /** A hero drank a potion (D4). */
  | { kind: 'drank'; playerId: string; potions: number }
  /** A string move fired (C1): its key, and its charge level (0 for a light string's own move). */
  | { kind: 'stringMove'; playerId: string; move: string; charge: number }
  /**
   * A rest room or the Warden's fall banked a player's finds (P1): the items, their coin, and the
   * village's lumber and stone for the run (the same in every player's event; the browser that opened
   * the village keeps them).
   */
  | {
      kind: 'banked';
      playerId: string;
      /** Finds still on the ground for the player, handed over now. */
      items: (Item | GearItem)[];
      /** Carried finds the browser already holds in the bag (D3), now banked and safe. */
      kept: number;
      coin: number;
      lumber: number;
      stone: number;
      floor: number;
      /** The henchmen's XP now banked (P12), by kit: the village keeps it, and so does its owner's browser. */
      hench?: { style: Style; xp: number }[];
    }
  /** A wipe lost a player's unbanked finds (P1). */
  | { kind: 'findsLost'; playerId: string; count: number }
  /**
   * A wipe takes a player's bag (D5; Michael, 28 Oct, extraction-style): all but its safe pocket.
   * The bag is the browser's until Phase 3, so the server says so and the browser empties it.
   */
  | { kind: 'bagLost'; playerId: string }
  | { kind: 'perk'; playerId: string; perk: Perk; x: number; z: number };

export type Combo = 'shatter' | 'skewer' | 'detonate' | 'uproot' | 'fan';

/** An enemy attack reaching a hero. */
export interface HeroHit {
  damage: number;
  /** Heavy hits interrupt the hero and break a guard. */
  heavy?: boolean;
  /** Metres of shove on a heavy hit. */
  push?: number;
  /** Where it comes from (the enemy, a slam's centre, an arrow's tail): decides blocking and shove direction. */
  fromX: number;
  fromZ: number;
  /** The enemy that dealt it, so a parry can stagger it. */
  enemyId?: number;
  /** An enemy arrow: a parry sends one back. */
  arrow?: boolean;
  /** Already waited out the remote player's lag grace. */
  late?: boolean;
  /**
   * A low attack (M1: a sweep, a slam's shockwave) runs along the ground at this height, the enemy's
   * feet as it swung; a hero whose feet are `jump.clearHeight` above it when the hit lands clears it.
   */
  low?: number;
}

/** A hit on a remote player, waiting out their lag grace. */
export interface PendingHit {
  playerId: string;
  at: number;
  hit: HeroHit;
}

/** A holy ring a Paladin's Whirlwind leaves (the builds pass): allies inside take less damage until it fades. */
export interface ConsecratedGround {
  by: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  until: number;
}

/** A Ranger's Bramble Rain patch (the builds pass): roots light enemies standing in it while it lasts. */
export interface BrambleGround extends ConsecratedGround {
  /** The Ranger's element, for its colour. */
  element: Element;
}

/** A Spellblade's Blazing Charge or a Sorcerer's Elemental Step trail (the builds pass): a strip along the dash or Blink that burns enemies standing in it. */
export interface TrailGround {
  by: string;
  /** The Charge it came from (`PlayerState.abilitySeq`), so the dash lengthens its own trail and no other. */
  seq: number;
  /** The style that laid it (a Spellblade's sword, a Sorcerer's staff), credited with its damage. */
  style: 'sword' | 'staff';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  width: number;
  until: number;
  /** Damage each tick deals an enemy in it, fixed as the Charge's damage was when it ran. */
  tickDamage: number;
  /** When it next deals damage. */
  next: number;
  element: Element;
}

export interface SimState {
  tick: number;
  /** Simulated seconds since start. */
  time: number;
  players: PlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  drops: DropState[];
  pendingHits: PendingHit[];
  /** Events from the last tick only; cleared at the start of each step. */
  events: SimEvent[];
  nextId: number;
  /** Deterministic RNG state (LCG), so the sim stays reproducible and serializable. */
  rng: number;
  run: RunState;
  /** A generated floor's run (T4, floorRun.ts); never set in the arena, so its state is the slice's to the byte. */
  floor?: FloorRunState;
  /** A Paladin's Consecrate rings on the ground (the builds pass), one a Paladin; absent in the slice. */
  consecrated?: ConsecratedGround[];
  /** A Ranger's Bramble Rain patches (the builds pass), one a Ranger; absent in the slice. */
  brambles?: BrambleGround[];
  /** A Ranger's Snare Traps (the builds pass), one a Ranger, each sprung by the first enemy in it; absent in the slice. */
  snares?: BrambleGround[];
  /** A Druid's Wild Growth groves (the builds pass), one a Druid, healing allies inside; absent in the slice. */
  groves?: BrambleGround[];
  /** A Spellblade's Blazing Charge trails (the builds pass), one a Spellblade; absent in the slice. */
  trails?: TrailGround[];
  /**
   * The village's buildings still an empty plot (Michael, 31 Oct, A), by id: their front doors stay
   * shut. The village room sets it from the save; absent everywhere else.
   */
  plots?: string[];
}

/**
 * One player's input for one tick, already resolved into world space by the
 * client (camera-relative movement is a client concern). Serializable so it
 * can be sent to a host.
 */
export interface PlayerCommand {
  /** Desired move direction in world XZ, magnitude 0..1. */
  moveX: number;
  moveZ: number;
  /** Sprint held. Walking is light analog tilt (move magnitude below the run threshold). */
  sprint: boolean;
  /** Dodge pressed since the last tick. */
  dodge: boolean;
  /** Attack pressed since the last tick. */
  attack: boolean;
  /** Attack held this tick (C1): a long enough hold turns the step into a heavy. Absent in the slice. */
  attackHeld?: boolean;
  /**
   * The server's alone (never read from a player's message): how many ticks of hold this tick counts,
   * absent meaning one. The browser counts one a command; the server's input slots set this when a
   * tick stood for no input (0), or when late or folded inputs owe the count ticks (bow backflip, 9 Nov).
   */
  holdTicks?: number;
  /** Camera forward on the ground plane: attacks face it when there's no move input. */
  aimX: number;
  aimZ: number;
  /**
   * Free aim (D12): the shot's pitch through the reticle, radians up from level, with aimX/aimZ the
   * heading from the hand to the aim point. Sent only with a ranged weapon out and no lock-on; a
   * ranged attack then skips soft targeting and flies along it. Absent in the slice.
   */
  aimPitch?: number;
  /** Style to swap to, or null for no swap. */
  swapTo: Style | null;
  /** Q / E pressed since the last tick. */
  ability1: boolean;
  ability2: boolean;
  /** The off-hand's ability pressed (C4: 3, R or RT). Absent in the slice. */
  ability3?: boolean;
  /** Drink a health potion pressed (D4: G, 4 or d-pad left). Absent in the slice. */
  drink?: boolean;
  /** Locked-on enemy id, or -1. Soft targeting prefers it. */
  lockTarget: number;
  /** Jump pressed since the last tick. */
  jump: boolean;
  /** Guard held. */
  block: boolean;
  /** Interact held (revive a downed ally). */
  interact: boolean;
}

export const idleCommand = (): PlayerCommand => ({
  moveX: 0,
  moveZ: 0,
  sprint: false,
  dodge: false,
  attack: false,
  aimX: 0,
  aimZ: 1,
  swapTo: null,
  ability1: false,
  ability2: false,
  lockTarget: -1,
  jump: false,
  block: false,
  interact: false,
});
