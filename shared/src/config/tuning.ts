/**
 * Every tuning value in the game lives here (see CLAUDE.md). The debug panel
 * edits this object live; use its "Copy tuning" button and paste the result
 * back here to keep values you like.
 *
 * Units: metres, seconds (ms where the name says so), degrees for angles.
 */
export const tuning = {
  sim: {
    /** Fixed simulation rate. */
    tickRate: 60,
    /**
     * Max sim steps per rendered frame before we drop time (avoids spiral of death). Half a second, as
     * the server catches up: the server ticks on wall time, so a slow page that dropped a long frame's
     * ticks sent fewer commands than it ticked and was corrected for the held buttons it stood in with.
     */
    maxStepsPerFrame: 30,
  },

  movement: {
    walkSpeed: 2.0,
    runSpeed: 5.5,
    /** Hold Shift / left stick click. */
    sprintSpeed: 8.0,
    /** Stick tilt (0..1) above which the hero runs instead of walks. */
    runThreshold: 0.6,
    acceleration: 40,
    deceleration: 30,
    /** How fast the hero turns to face the move direction. */
    turnRateDeg: 900,
    /**
     * Strafe movement: the hero always faces where the camera looks; S backpedals
     * and A/D sidestep instead of turning (Michael's call). Off = turn to run.
     */
    faceCamera: true,
    /** How fast the body follows the camera's facing. */
    faceTurnRateDeg: 1080,
    /** Speed multipliers relative to running forward. */
    strafeSpeedFrac: 0.9,
    backpedalSpeedFrac: 0.72,
    /** Collision radius of the hero in the XZ plane. */
    radius: 0.4,
    /** Collision height of the hero. */
    height: 1.8,
  },

  /** Placeholder dodge; M1 revisits timing alongside the combo. */
  dodge: {
    durationMs: 420,
    distance: 4.0,
    /** 0 = linear, higher = more front-loaded burst that eases out. */
    easeOutPower: 2.0,
    /** Invulnerability window from dodge start (not used until enemies exist). */
    iframesMs: 300,
    charges: 2,
    chargeRechargeMs: 1200,
    /** Min time between dodges even with charges left. */
    minGapMs: 80,
    /** Michael's call: a dodge interrupts an attack at any point (the brief only allows it in recovery). */
    cancelsAttacks: true,
    /** Dodge with no direction held: a hop backward, this fraction of the roll's distance. */
    backstepDistanceFrac: 0.7,
    /**
     * From this point the roll's slow tail can be cut short: moving, attacking,
     * an ability, guard, jump or another dodge ends it at once (Michael: no
     * dodge recovery). Attacks and Q/E pressed earlier in the roll are kept and fire here.
     * 240 in the slice; 170 since D9 (Michael 28 Oct: recovery too long).
     */
    cancelAfterMs: 170,
    /** A roll cut short keeps the rest of its i-frames (D9); the slice ended them with the roll. */
    keepIframesOnCancel: true,
    /** Second wind and Light step bring cancelAfterMs down (D9), never below this. */
    cancelFloorMs: 110,
  },

  /**
   * Guard (not in the brief; added at Michael's request after M4). Hold right
   * click / LT to guard. Raising it opens a short parry window: a hit in that
   * window is parried (no damage, the attacker is staggered, enemy arrows fly
   * back). After that, light hits from the front are blocked down to chip
   * damage and heavy hits break the guard.
   */
  guard: {
    /** Movement while guarding, as a fraction of run speed. */
    moveSpeedFrac: 0.45,
    /** Hits from within this arc in front are blocked or parried. */
    arcDeg: 160,
    parryWindowMs: 200,
    /** Raising the guard again sooner than this after the last raise gives no parry window (stops mashing). A parry resets it. */
    parryRearmMs: 600,
    /** Light hits blocked: this fraction of the damage gets through. */
    blockDamageFrac: 0.15,
    /** Heavy hits blocked (not parried): this fraction gets through and the guard breaks. */
    heavyBlockDamageFrac: 0.5,
    guardBreakMs: 650,
    /** Small shove from a blocked light hit. */
    blockPushM: 0.35,
    /** Freeze on both sides of a parry. */
    parryHitstopMs: 140,
    /** Poise damage a parry deals to the Warden (everything else is staggered outright). */
    parryWardenPoise: 6,
    /** Parried enemy arrows fly back with this damage multiplier. */
    reflectDamageMult: 2,
    /** Guard can be raised in the middle of an attack (like the dodge). */
    cancelsAttacks: true,
  },

  /** Not in the brief's control table; added at Michael's request after M0. */
  jump: {
    /** Apex height of a standing jump. */
    height: 1.0,
    gravity: 24,
    /** Fraction of ground acceleration available in the air. */
    airControl: 0.45,
  },

  /**
   * Rules shared by every style's chain (brief: "Chain rules"). Chains are 5
   * hits (Michael's call; the brief has 3): hits 1-3 follow the brief's table,
   * 4-5 are the showier spins and leaps.
   */
  combo: {
    /** Multiplies every windup/active/recovery below. Above 1 = slower, weightier attacks. */
    durationScale: 1.3,
    /** A click this long before the chain window opens is queued. */
    inputBufferMs: 200,
    /** Max snap toward the move input (camera forward when idle) when an attack starts. */
    maxTurnDeg: 90,
    /** Ranged and magic allow walking during attacks at this fraction of run speed. */
    castMoveSpeedFrac: 0.6,
    /**
     * Light and heavy strings (C1; Michael, 28 Oct). A tap is the chain's light hit as ever; holding
     * attack this long turns the step into the heavy for the string so far, and holding chargeMs more
     * reaches charge level 2. Off in the parity test: the slice's chain has no heavies.
     */
    /**
     * One weapon set per outing (C3; Michael, 28 Oct): the weapon changes on the hero screen, and only
     * outside a fight. The slice swapped mid-fight with 1, 2 and 3; the parity test turns this back on.
     */
    swapInFight: false,
    heavies: true,
    heavyHoldMs: 250,
    chargeMs: 450,
    charge2Damage: 1.5,
    charge2Poise: 1.5,
  },

  /**
   * Knight (sword) chain. Damage is a multiplier on combat.baseDamage; poise is
   * stagger damage; heavy hits get the long hitstop, shake and FOV punch.
   * Range and arc describe the swing's hit area in front of the knight.
   */
  meleeCombo: {
    // 1 · left slash
    hit1WindupMs: 120,
    hit1ActiveMs: 80,
    hit1RecoveryMs: 220,
    hit1LungeM: 0.6,
    hit1Damage: 1.0,
    hit1Poise: 1.0,
    hit1KnockbackM: 0.0,
    hit1Heavy: 0,
    hit1RangeM: 2.0,
    hit1ArcDeg: 120,
    // 2 · right slash
    hit2WindupMs: 110,
    hit2ActiveMs: 80,
    hit2RecoveryMs: 240,
    hit2LungeM: 0.6,
    hit2Damage: 1.1,
    hit2Poise: 1.0,
    hit2KnockbackM: 0.0,
    hit2Heavy: 0,
    hit2RangeM: 2.0,
    hit2ArcDeg: 120,
    // 3 · low sweep
    hit3WindupMs: 220,
    hit3ActiveMs: 140,
    hit3RecoveryMs: 420,
    hit3LungeM: 1.0,
    hit3Damage: 1.8,
    hit3Poise: 4.0,
    hit3KnockbackM: 3.0,
    hit3Heavy: 1,
    hit3RangeM: 2.4,
    hit3ArcDeg: 180,
    // 4 · spinning slash
    hit4WindupMs: 100,
    hit4ActiveMs: 300,
    hit4RecoveryMs: 380,
    hit4LungeM: 1.4,
    hit4Damage: 1.3,
    hit4Poise: 1.5,
    hit4KnockbackM: 0.8,
    hit4Heavy: 0,
    hit4RangeM: 2.3,
    hit4ArcDeg: 360,
    // 5 · leaping overhead slam
    hit5WindupMs: 140,
    hit5ActiveMs: 320,
    hit5RecoveryMs: 250,
    hit5LungeM: 2.0,
    hit5Damage: 2.4,
    hit5Poise: 5.0,
    hit5KnockbackM: 2.5,
    hit5Heavy: 1,
    hit5RangeM: 2.8,
    hit5ArcDeg: 360,
  },

  /** Warhammer (C5): two hands, three slow heavy blows a chain, huge stagger. Borrows the sword's sweep, spin and slam. */
  warhammerCombo: {
    // 1 · sweeping blow
    hit1WindupMs: 260,
    hit1ActiveMs: 160,
    hit1RecoveryMs: 460,
    hit1LungeM: 0.8,
    hit1Damage: 2.2,
    hit1Poise: 6,
    hit1KnockbackM: 3,
    hit1Heavy: 1,
    hit1RangeM: 2.6,
    hit1ArcDeg: 160,
    // 2 · wheeling blow
    hit2WindupMs: 200,
    hit2ActiveMs: 340,
    hit2RecoveryMs: 420,
    hit2LungeM: 1,
    hit2Damage: 1.8,
    hit2Poise: 4,
    hit2KnockbackM: 2,
    hit2Heavy: 1,
    hit2RangeM: 2.6,
    hit2ArcDeg: 360,
    // 3 · crushing slam
    hit3WindupMs: 240,
    hit3ActiveMs: 360,
    hit3RecoveryMs: 380,
    hit3LungeM: 1.6,
    hit3Damage: 3.2,
    hit3Poise: 9,
    hit3KnockbackM: 3.5,
    hit3Heavy: 1,
    hit3RangeM: 3,
    hit3ArcDeg: 360,
  },

  /** Crossbow (C5): one hand, two quick bolts and a piercing shot, then a long reload. Borrows the bow's shots. */
  crossbowCombo: {
    // 1 · quick bolt
    hit1WindupMs: 140,
    hit1ActiveMs: 60,
    hit1RecoveryMs: 180,
    hit1LungeM: 0,
    hit1Damage: 1.3,
    hit1Poise: 1.2,
    hit1KnockbackM: 0,
    hit1Heavy: 0,
    // 2 · quick bolt
    hit2WindupMs: 140,
    hit2ActiveMs: 60,
    hit2RecoveryMs: 180,
    hit2LungeM: 0,
    hit2Damage: 1.3,
    hit2Poise: 1.2,
    hit2KnockbackM: 0,
    hit2Heavy: 0,
    // 3 · piercing bolt, then the reload
    hit3WindupMs: 120,
    hit3ActiveMs: 60,
    hit3RecoveryMs: 620,
    hit3LungeM: 0,
    hit3Damage: 2,
    hit3Poise: 2.5,
    hit3KnockbackM: 0.5,
    hit3Heavy: 1,
  },

  /** Wand (C5): one hand, five fast small bolts, walking all the while. Borrows the staff's bolts. */
  wandCombo: {
    // 1 · bolt
    hit1WindupMs: 90,
    hit1ActiveMs: 50,
    hit1RecoveryMs: 140,
    hit1LungeM: 0,
    hit1Damage: 0.55,
    hit1Poise: 0.4,
    hit1KnockbackM: 0,
    hit1Heavy: 0,
    // 2 · bolt
    hit2WindupMs: 90,
    hit2ActiveMs: 50,
    hit2RecoveryMs: 140,
    hit2LungeM: 0,
    hit2Damage: 0.55,
    hit2Poise: 0.4,
    hit2KnockbackM: 0,
    hit2Heavy: 0,
    // 3 · bolt
    hit3WindupMs: 90,
    hit3ActiveMs: 50,
    hit3RecoveryMs: 140,
    hit3LungeM: 0,
    hit3Damage: 0.6,
    hit3Poise: 0.4,
    hit3KnockbackM: 0,
    hit3Heavy: 0,
    // 4 · bolt
    hit4WindupMs: 90,
    hit4ActiveMs: 50,
    hit4RecoveryMs: 140,
    hit4LungeM: 0,
    hit4Damage: 0.6,
    hit4Poise: 0.4,
    hit4KnockbackM: 0,
    hit4Heavy: 0,
    // 5 · bolt
    hit5WindupMs: 90,
    hit5ActiveMs: 50,
    hit5RecoveryMs: 220,
    hit5LungeM: 0,
    hit5Damage: 0.8,
    hit5Poise: 0.8,
    hit5KnockbackM: 0,
    hit5Heavy: 0,
  },

  /** A family's string moves (C1) are its style's, scaled: a warhammer's heavies hit harder and come slower. */
  families: {
    warhammerHeavyDamage: 1.4,
    warhammerHeavyWindup: 1.3,
    crossbowHeavyDamage: 1.15,
    crossbowHeavyWindup: 1,
    wandHeavyDamage: 0.8,
    wandHeavyWindup: 0.7,
  },

  /** Archer (bow) chain. Projectile attacks fire at the end of the windup; active is the release. */
  rangedCombo: {
    // 1 · quick shot
    hit1WindupMs: 150,
    hit1ActiveMs: 60,
    hit1RecoveryMs: 200,
    hit1LungeM: 0,
    hit1Damage: 0.8,
    hit1Poise: 0.5,
    hit1KnockbackM: 0.0,
    hit1Heavy: 0,
    // 2 · quick shot
    hit2WindupMs: 150,
    hit2ActiveMs: 60,
    hit2RecoveryMs: 200,
    hit2LungeM: 0,
    hit2Damage: 0.8,
    hit2Poise: 0.5,
    hit2KnockbackM: 0.0,
    hit2Heavy: 0,
    // 3 · power shot (no hold)
    hit3WindupMs: 320,
    hit3ActiveMs: 60,
    hit3RecoveryMs: 320,
    hit3LungeM: 0,
    hit3Damage: 2.0,
    hit3Poise: 3.0,
    hit3KnockbackM: 1.0,
    hit3Heavy: 1,
    // 4 · spin and loose a fan of arrows
    hit4WindupMs: 380,
    hit4ActiveMs: 80,
    hit4RecoveryMs: 320,
    hit4LungeM: 0,
    hit4Damage: 0.7,
    hit4Poise: 0.8,
    hit4KnockbackM: 0.0,
    hit4Heavy: 0,
    // 5 · piercing shot, then backflip away
    hit5WindupMs: 300,
    hit5ActiveMs: 380,
    hit5RecoveryMs: 420,
    hit5LungeM: -2.5,
    hit5Damage: 2.6,
    hit5Poise: 4.0,
    hit5KnockbackM: 1.5,
    hit5Heavy: 1,
    arrowSpeed: 34,
    /** Power shot (hit 3) and piercing shot (hit 5). */
    powerArrowSpeed: 50,
    fanArrows: 3,
    fanSpreadDeg: 26,
    /** Power and piercing shots pass through this many enemies. */
    powerPierce: 3,
    arrowGravity: 3,
    arrowLifeMs: 1500,
    /** How long an arrow stays stuck in a wall or the floor. */
    stuckArrowLifeMs: 4000,
  },

  /** Mage (staff) chain. */
  magicCombo: {
    // 1 · frost bolt
    hit1WindupMs: 180,
    hit1ActiveMs: 60,
    hit1RecoveryMs: 220,
    hit1LungeM: 0,
    hit1Damage: 0.9,
    hit1Poise: 0.5,
    hit1KnockbackM: 0.0,
    hit1Heavy: 0,
    // 2 · frost bolt
    hit2WindupMs: 180,
    hit2ActiveMs: 60,
    hit2RecoveryMs: 220,
    hit2LungeM: 0,
    hit2Damage: 0.9,
    hit2Poise: 0.5,
    hit2KnockbackM: 0.0,
    hit2Heavy: 0,
    // 3 · frost burst ahead
    hit3WindupMs: 300,
    hit3ActiveMs: 60,
    hit3RecoveryMs: 450,
    hit3LungeM: 0,
    hit3Damage: 1.6,
    hit3Poise: 3.5,
    hit3KnockbackM: 1.5,
    hit3Heavy: 1,
    // 4 · twirl and release a ring of bolts
    hit4WindupMs: 420,
    hit4ActiveMs: 100,
    hit4RecoveryMs: 380,
    hit4LungeM: 0,
    hit4Damage: 0.6,
    hit4Poise: 0.8,
    hit4KnockbackM: 0.3,
    hit4Heavy: 0,
    // 5 · levitate and slam a great burst
    hit5WindupMs: 480,
    hit5ActiveMs: 140,
    hit5RecoveryMs: 600,
    hit5LungeM: 0,
    hit5Damage: 2.4,
    hit5Poise: 5.0,
    hit5KnockbackM: 2.5,
    hit5Heavy: 1,
    boltSpeed: 20,
    boltLifeMs: 1300,
    /** No targets yet, so bursts land this far ahead (or short of a wall). */
    burstRange: 7,
    burstRadius: 3,
    burstLifeMs: 650,
    novaBolts: 8,
    greatBurstRange: 5,
    greatBurstRadius: 4.5,
    /** Bursts slow enemies (brief: 40% for 2 s). */
    burstSlowFrac: 0.4,
    burstSlowMs: 2000,
  },

  /**
   * Each weapon's string moves (C1): a key is the string of light (L) and heavy (H) presses that ends
   * in it. Anim is the chain step whose pose, reach and projectiles it borrows until it has its own;
   * the rest overrides that step. A heavy string with no entry plays H.
   */
  swordStrings: {
    // H · Overhead cleave
    hAnim: 4,
    hWindupMs: 120,
    hDamage: 2.2,
    hPoise: 5,
    hKnockbackM: 1.5,
    hHeavy: 1,
    // L H · Rising cut
    lhAnim: 2,
    lhWindupMs: 110,
    lhDamage: 1.6,
    lhPoise: 6,
    lhKnockbackM: 0.5,
    lhHeavy: 1,
    // L L H · Sweeping arc
    llhAnim: 2,
    llhWindupMs: 140,
    llhDamage: 1.8,
    llhPoise: 3,
    llhKnockbackM: 3.5,
    llhHeavy: 1,
    // L L L H · Pommel break
    lllhAnim: 0,
    lllhWindupMs: 100,
    lllhDamage: 1.2,
    lllhPoise: 9,
    lllhKnockbackM: 1,
    lllhHeavy: 1,
    // L L L L H · Blade spin
    llllhAnim: 3,
    llllhWindupMs: 120,
    llllhDamage: 2,
    llllhPoise: 3,
    llllhKnockbackM: 1.5,
    llllhHeavy: 1,
    // H H · Ground slam
    hhAnim: 4,
    hhWindupMs: 160,
    hhDamage: 2.8,
    hhPoise: 7,
    hhKnockbackM: 3,
    hhHeavy: 1,
    // H H H · Earthsplitter
    hhhAnim: 4,
    hhhWindupMs: 200,
    hhhDamage: 3.6,
    hhhPoise: 9,
    hhhKnockbackM: 4,
    hhhHeavy: 1,
    // H L L · Whirling counter
    hllAnim: 3,
    hllWindupMs: 100,
    hllDamage: 1.6,
    hllPoise: 2,
    hllKnockbackM: 1,
    hllHeavy: 0,
  },
  bowStrings: {
    // H · Charged shot
    hAnim: 2,
    hWindupMs: 160,
    hDamage: 2,
    hPoise: 2.5,
    hKnockbackM: 0.5,
    hHeavy: 1,
    // L H · Pinning shot
    lhAnim: 4,
    lhWindupMs: 140,
    lhDamage: 1.6,
    lhPoise: 4,
    lhKnockbackM: 0,
    lhHeavy: 1,
    // L L H · Fan
    llhAnim: 3,
    llhWindupMs: 150,
    llhDamage: 1.3,
    llhPoise: 1.5,
    llhKnockbackM: 0.5,
    llhHeavy: 1,
    // L L L H · Point blank
    lllhAnim: 2,
    lllhWindupMs: 90,
    lllhDamage: 1.8,
    lllhPoise: 3,
    lllhKnockbackM: 3,
    lllhHeavy: 1,
    // H H · Longshot
    hhAnim: 4,
    hhWindupMs: 220,
    hhDamage: 2.6,
    hhPoise: 3,
    hhKnockbackM: 0.5,
    hhHeavy: 1,
    // H H H · Deadeye
    hhhAnim: 4,
    hhhWindupMs: 260,
    hhhDamage: 3.4,
    hhhPoise: 4,
    hhhKnockbackM: 0.5,
    hhhHeavy: 1,
    // H L L · Quick volley
    hllAnim: 3,
    hllWindupMs: 100,
    hllDamage: 1,
    hllPoise: 1,
    hllKnockbackM: 0,
    hllHeavy: 0,
  },
  staffStrings: {
    // H · Charged orb
    hAnim: 2,
    hWindupMs: 160,
    hDamage: 2,
    hPoise: 2.5,
    hKnockbackM: 1.5,
    hHeavy: 1,
    // L H · Nova
    lhAnim: 3,
    lhWindupMs: 120,
    lhDamage: 1,
    lhPoise: 2,
    lhKnockbackM: 1.5,
    lhHeavy: 1,
    // L L H · Great burst
    llhAnim: 4,
    llhWindupMs: 150,
    llhDamage: 2.2,
    llhPoise: 3,
    llhKnockbackM: 2,
    llhHeavy: 1,
    // L L L H · Twin nova
    lllhAnim: 3,
    lllhWindupMs: 110,
    lllhDamage: 1.3,
    lllhPoise: 2.5,
    lllhKnockbackM: 2,
    lllhHeavy: 1,
    // H H · Elemental storm
    hhAnim: 4,
    hhWindupMs: 220,
    hhDamage: 2.8,
    hhPoise: 4,
    hhKnockbackM: 2.5,
    hhHeavy: 1,
    // H H H · Cataclysm
    hhhAnim: 4,
    hhhWindupMs: 260,
    hhhDamage: 3.6,
    hhhPoise: 5,
    hhhKnockbackM: 3,
    hhhHeavy: 1,
    // H L L · Arcane flurry
    hllAnim: 3,
    hllWindupMs: 100,
    hllDamage: 0.9,
    hllPoise: 1,
    hllKnockbackM: 0.5,
    hllHeavy: 0,
  },

  /** Shared combat numbers (brief: "Hit feel", "Enemies and the room"). */
  combat: {
    /** Damage of a 1.0x hit. */
    baseDamage: 10,
    heroMaxHp: 100,
    /** Seconds down at zero health before getting back up (revives come in M5). */
    downMs: 3000,
    /** Invulnerability after getting up. */
    reviveInvulnMs: 2000,
    /** Poise broken: stagger length and extra damage taken (brief: 1.5 s, +25%). */
    staggerMs: 1500,
    staggerDamageBonus: 0.25,
    poiseRegenDelayMs: 2000,
    poiseRegenPerSec: 4,
    /** Light hits make light enemies flinch: their AI pauses this long. */
    flinchMs: 200,
    /** Heavy enemy attacks interrupt the hero for this long (brief: only heavy attacks interrupt). */
    heroHurtMs: 450,
    /** Ledges and ramp sides taller than this can't be stepped up. */
    stepHeight: 0.35,
    /** Knockback slides with this exponential friction (1/s). */
    knockbackFriction: 9,
    /** Sword slam (hit 5) lands in the last part of its active phase. */
    slamHitFrom: 0.75,
    /** Combo counter resets after this long without a hit. */
    comboResetMs: 2000,
  },

  /**
   * Launched corpses (K1; Michael, 30 Oct, A): a grunt or archer killed by a melee heavy (a heavy,
   * the chain's last hit, a slam) flies along the blow, and the first time it meets each enemy that
   * one takes a share of the killing blow and is staggered. The slice's dead just fall; the parity
   * test turns it off.
   */
  launch: {
    enabled: true,
    /** Metres a launched corpse slides along the blow. */
    distanceM: 5,
    /** The warhammer launches this much farther. */
    warhammerMult: 1.5,
    /** Share of the killing blow's damage each enemy it meets takes. */
    damageShare: 1 / 3,
    /** Knockback (m) on an enemy a corpse meets. */
    impactKnockbackM: 1,
    /** Below this speed (m/s) a corpse has landed and hurts nothing. */
    minSpeed: 2.5,
    /** The arc the views draw it on: peak height (m) and time in the air (s). */
    arcHeightM: 0.8,
    arcSeconds: 0.45,
  },

  /** Volumes (the player's settings override these on their machine). */
  audio: {
    masterVolume: 0.8,
    musicVolume: 0.5,
  },

  hitFeel: {
    /** Attacker and target freeze on contact (brief: 60 ms light, 110 ms finishers). */
    hitstopLightMs: 60,
    hitstopHeavyMs: 110,
    flashMs: 80,
    /**
     * How bright a struck enemy glows for flashMs. At 0.9 the glow cleared the bloom's threshold and a
     * chain on pale skeletons was a stream of white flashes (playtest, 29 Oct); the sparks carry the hit.
     */
    flashStrength: 0.25,
    /** Camera shake on heavy hits only (brief: at most 0.15 m for 150 ms) plus an FOV punch. */
    shakeM: 0.15,
    shakeMs: 150,
    fovPunchDeg: 2,
    /** Smaller shake when the hero is hurt. */
    hurtShakeM: 0.06,
    sparkCount: 14,
    sparkSpeed: 5,
    trailLifeMs: 160,
    damageNumbers: true,
    sfxVolume: 0.5,
    /** Multiplies every camera shake and FOV punch (a player setting). */
    screenShake: 1,
    /** Random pitch variation on every sound so repeats don't drone (brief: 5%). */
    pitchJitter: 0.05,
  },

  /** Grunt: melee fodder in groups of 3-5 (brief). */
  grunt: {
    maxHp: 60,
    maxPoise: 6,
    radius: 0.42,
    height: 1.55,
    moveSpeed: 3.4,
    turnRateDeg: 420,
    /** Turn rate while winding up, so side-stepping the telegraph works. */
    windupTurnRateDeg: 110,
    /** Grunts without an attack token hold at this distance and circle. */
    holdDistance: 4.2,
    /** Token holders close to this range, then start the windup. */
    attackRange: 1.7,
    /** Brief: at most two enemies attack the same player at once. */
    maxAttackers: 2,
    /** Brief: 600 ms raised weapon and red glint. */
    telegraphMs: 600,
    slashActiveMs: 140,
    betweenSlashesMs: 320,
    recoveryMs: 750,
    attackCooldownMs: 900,
    damage: 10,
    reach: 2.0,
    arcDeg: 110,
    spawnMs: 700,
    deathMs: 1600,
    groupMin: 3,
    groupMax: 5,
    respawnDelayMs: 2500,
    /** Fraction of knockback this enemy actually takes. */
    knockbackTaken: 1,
  },

  /** Archer: keeps distance on the ledge; 800 ms visible aim line, then a shot (brief). */
  archer: {
    maxHp: 45,
    maxPoise: 4,
    radius: 0.4,
    height: 1.55,
    moveSpeed: 2.4,
    turnRateDeg: 360,
    aimMs: 800,
    /** The aim follows you for this fraction of the aim time, then locks: side-step late to dodge. */
    aimTrackFrac: 0.7,
    shootRecoverMs: 450,
    cooldownMs: 2600,
    arrowSpeed: 24,
    damage: 8,
    /** Backs away along the ledge when you get this close. */
    fleeDistance: 4.5,
    /**
     * On a generated floor an archer that cannot see its hero, or stands further than this, comes after
     * them through the doorways (found in play, 29 Oct: the slice's ledge archer drifted along x, out of
     * sight, and its room never cleared). The arena keeps the slice's.
     */
    floorRange: 14,
    spawnMs: 700,
    deathMs: 1600,
    knockbackTaken: 1,
  },

  /** Brute: tanky, high poise; telegraphed overhead slam (brief: 1,000 ms ground circle). */
  brute: {
    maxHp: 320,
    maxPoise: 22,
    radius: 0.7,
    height: 2.3,
    moveSpeed: 2.7,
    turnRateDeg: 200,
    slamRange: 2.8,
    /** Slam lands this far in front of the brute, in a circle of slamRadius. */
    slamOffset: 1.7,
    slamRadius: 2.2,
    telegraphMs: 1000,
    /** The brute keeps turning toward you for this fraction of the telegraph. */
    trackFrac: 0.4,
    slamActiveMs: 160,
    recoveryMs: 1400,
    cooldownMs: 1500,
    damage: 28,
    knockbackDealt: 2.2,
    spawnMs: 900,
    deathMs: 2000,
    knockbackTaken: 0.25,
  },

  /** The Warden: two-phase mini-boss; sweep, slam, and a roar that summons at 50% health (brief). */
  warden: {
    maxHp: 2000,
    maxPoise: 40,
    radius: 1.0,
    height: 3.1,
    moveSpeed: 2.4,
    turnRateDeg: 150,
    sweepRange: 4.6,
    sweepRadius: 5.2,
    sweepArcDeg: 130,
    sweepTelegraphMs: 900,
    sweepActiveMs: 220,
    sweepRecoveryMs: 750,
    sweepDamage: 22,
    slamOffset: 2.6,
    slamRadius: 3.2,
    slamTelegraphMs: 1200,
    slamActiveMs: 160,
    slamRecoveryMs: 1100,
    slamDamage: 32,
    /** Beyond this distance it slams where you stand instead of walking over. */
    farSlamDistance: 8,
    farSlamMaxRange: 11,
    cooldownMs: 1100,
    phase2CooldownMs: 550,
    phase2TelegraphScale: 0.85,
    phase2SpeedScale: 1.25,
    roarMs: 1600,
    summonCount: 3,
    knockbackDealt: 2.8,
    spawnMs: 1500,
    deathMs: 3000,
    knockbackTaken: 0.1,
  },

  /**
   * Style levels (brief: "Progression taste"): damage dealt with a hero earns
   * that hero XP. Cumulative XP per level; level 3 in one hero should take
   * about one run (a run is roughly 4,000 damage in total).
   *   2: second ability (E)   3: combo step 4   4: combo step 5 and +10% damage   5: weapon glow
   * Hearthgate (T6, plan 3a): levels run to 50; the flat bonus at 4 became two ranks of Might, so
   * every raw gain is a point the player chose; the glow moves to 25 and turns gold at 50.
   */
  progression: {
    xpPerDamage: 1,
    level2Xp: 400,
    level3Xp: 2000,
    level4Xp: 4500,
    level5Xp: 8000,
    /** The slice's +10% at level 4 (0 here: it is Might's top two ranks; the parity test sets 0.1). */
    level4DamageBonus: 0,
    /** Levels carry on past 5 (each one is a talent point). Each level after 5 costs this much more than the one before. */
    levelGapGrowthXp: 500,
    maxLevel: 50,
    /** The weapon glow lights at this level (the slice's was 5); at maxLevel it burns gold. */
    glowLevel: 25,
    /**
     * Max health gained each level of the weapon in hand, flat, on top of the hero's base (gear and
     * Vitality): 190 at level 10 and 590 at 50 from 100 (Michael, 29 Oct: a flat gain, "+1.5% feels
     * kind of pathetic"). Damage, armour and speed stay with talents and gear. The slice's heroes
     * gain nothing; the parity test sets 0.
     */
    healthPerLevel: 10,
  },

  /**
   * Talents (added at Michael's request after M4): every level after the first
   * gives that hero a point to spend on their own board. Respec is free
   * between runs. Per-rank values; Q and E upgrades are per ability below.
   */
  talents: {
    pointsPerLevel: 1,
    mightDamagePerRank: 0.05,
    /** Seven, not the slice's five: the top two are its old flat +10% at level 4. */
    mightMaxRanks: 7,
    /** Attack speed: every attack's windup, active and recovery shrink by this per rank. */
    hasteSpeedPerRank: 0.04,
    hasteMaxRanks: 5,
    armourReductionPerRank: 0.04,
    armourMaxRanks: 5,
    fleetSpeedPerRank: 0.04,
    fleetMaxRanks: 3,
    focusCooldownPerRank: 0.07,
    focusMaxRanks: 3,
    /** Ranks for each ability upgrade (Q and E). */
    abilityMaxRanks: 3,
    chargeDamagePerRank: 0.25,
    chargeDistancePerRank: 1,
    whirlwindDamagePerRank: 0.2,
    whirlwindRadiusPerRank: 0.3,
    volleyArrowsPerRank: 1,
    volleyDamagePerRank: 0.1,
    disengageDamagePerRank: 0.3,
    disengageSlowMsPerRank: 600,
    frostRingRadiusPerRank: 0.6,
    frostFreezeMsPerRank: 300,
    blinkDistancePerRank: 1,
    blinkCritPerRank: 0.25,
    /**
     * Milestone rows (T6, plan 3a): one talent opens at each of levels 10, 20, 30, 40 and 50, so the
     * slice's 29 ranks and these 20 make 49, a point for every level after the first.
     */
    rowMaxRanks: 4,
    /** Weight (10): more poise damage, so staggers come sooner. */
    weightPoisePerRank: 0.1,
    /** Finisher (20): more damage on this weapon's combo payoffs (Shatter, Skewer, Detonate). */
    finisherDamagePerRank: 0.1,
    /** Riposte (30): a longer parry window while this weapon is in hand. */
    riposteParryMsPerRank: 25,
    /** Second wind (40): dodge charges come back sooner. */
    windRechargePerRank: 0.08,
    /** Second wind also cuts a roll's recovery (D9; Michael, 28 Oct): ms off dodge.cancelAfterMs a rank. */
    windCancelMsPerRank: 10,
    /** Mastery (50): a little more damage. */
    masteryDamagePerRank: 0.03,
  },

  /**
   * Champion points (T6b, plan 3a; Michael, 27 Oct): past the top level, XP from any weapon buys
   * points, each pointXpGrowth dearer than the last. Small ranked perks in three constellations;
   * all of them together give at most the ceilings' damage and health (Michael: +15% each).
   */
  champion: {
    pointXp: 20000,
    pointXpGrowth: 250,
    ceilingDamage: 0.15,
    ceilingHealth: 0.15,
    /** Most perks take five ranks; Precision and Vitality take enough to reach their ceiling. */
    smallMaxRanks: 5,
    precisionDamagePerRank: 0.01,
    precisionMaxRanks: 15,
    heftPoisePerRank: 0.03,
    exploitComboPerRank: 0.03,
    vitalityHealthPerRank: 0.015,
    vitalityMaxRanks: 10,
    toughnessReductionPerRank: 0.01,
    steadyReviveCutPerRank: 0.06,
    willCooldownPerRank: 0.015,
    lightstepRechargePerRank: 0.03,
    /** Light step also cuts a roll's recovery (D9): ms off dodge.cancelAfterMs a rank. */
    lightstepCancelMsPerRank: 4,
    strideSpeedPerRank: 0.01,
    /**
     * Slotted perks (T6c; Michael, 28 Oct): four active at once, changed in the village or a rest room.
     * A constellation's slotted perks open in turn at this many, twice and three times as many points spent in it.
     */
    slots: 4,
    slotUnlockStep: 5,
    wideShatterRadiusMult: 2,
    teamworkBonus: 0.2,
    deepWoundsTicksMult: 2,
    bulwarkChipMult: 0.5,
    lifelineHpMult: 2,
    longFuseWindowMult: 1.5,
    momentumCooldownMs: 2000,
    magnetRadiusMult: 2,
  },

  /** Gear drops (brief: three per run, one guaranteed from the Warden). */
  gear: {
    rareChance: 0.3,
    /**
     * Drops come from the item catalogue (T5b: a bag and a body). Off is the slice's loot, which the
     * parity test plays (loot is rolled in the fight, so it must be the slice's there).
     */
    catalogue: true,
    /** Armour a piece gives per tier and per unit of its shape's weight (a platebody weighs 2). */
    armourPerTierWeight: 0.012,
    /** Hide and cloth give less armour than metal. */
    hideArmourFactor: 0.75,
    clothArmourFactor: 0.5,
    /** No amount of armour takes off more than this. */
    armourCap: 0.6,
    /** Each worn armour piece of another kind than the weapon in hand costs this much damage (Michael: per piece). */
    mismatchDamagePerPiece: 0.05,
    /** A weapon adds this much damage per tier above the first. */
    weaponDamagePerTier: 0.05,
    amuletHpPerTier: 5,
    ringCooldownPerTier: 0.02,
    capeDodgePerTier: 0.02,
    /** Walk within this distance of a drop to pick it up. */
    pickupRadius: 1.4,
    /** Items one player may leave on the floor of a room at once (D13); past it the oldest goes. */
    maxDropped: 12,
    // Perks.
    bleedTicks: 4,
    bleedTickMs: 500,
    /** A two-handed weapon (C4) takes no off-hand and hits this much harder for it. */
    twoHandDamage: 0.2,
    /** Frost arrows (C4, the ammo slot) slow what they hit this long. */
    frostArrowSlowS: 1.5,
    bleedDamage: 3,
    chainBoltRange: 8,
    chainBoltDamageFrac: 0.6,
    /** Dodging this soon after landing a finisher refunds the dodge charge. */
    dodgeRefundWindowMs: 600,
    hunterSlowMs: 1500,
  },

  /**
   * Drop-in co-op (brief: "Co-op"). The host runs the fight; every other
   * player predicts their own hero and sees the rest slightly in the past.
   */
  coop: {
    maxPlayers: 4,
    /**
     * Hearthgate's downs (decision 5A, T5): a downed hero crawls and bleeds out over bleedOutMs, then is
     * out of the fight; a friend holding interact brings back the downed for free and the out with a
     * Revive Draught; clearing the room brings everyone back. Off is the slice's downs (down until
     * revived), which the parity test plays so it still compares every other rule with the slice.
     */
    bleedOut: true,
    bleedOutMs: 30000,
    /** A downed hero drags themselves along this fast (m/s). 0 since D10 (Michael 28 Oct: down is still); T5 had 1.1. */
    crawlSpeed: 0,
    /** Revive Draughts each player starts a floor with: a counter until Phase 3's items (decisions.md, 4 Oct). */
    draughtsPerFloor: 1,
    /** Hold interact this long next to a downed ally to bring them back (brief: 3 s). */
    reviveMs: 3000,
    reviveRadius: 1.6,
    /** Health a revived hero gets back, as a fraction of max. */
    reviveHpFrac: 0.4,
    /** A friend joining mid-run spawns beside the host with this much invulnerability (brief: 2 s). */
    joinInvulnMs: 2000,
    /**
     * Hits on a remote player wait this long before landing, so a dodge or
     * parry that was on time on their screen (which runs behind the host's)
     * still counts. Favours the defender.
     */
    lagGraceMs: 150,
    /**
     * The host keeps this many of a joiner's input ticks in hand before using
     * them, so network jitter doesn't leave gaps (gaps make the joiner's
     * prediction and the host disagree). Costs the host's view of them this
     * many ticks; the joiner's own feel is unaffected.
     */
    inputBufferTicks: 2,
    /** The host sends a snapshot every this many ticks (2 = 30 per second). */
    snapshotEveryTicks: 2,
    /**
     * Joiners draw everything but their own hero this far in the past, between snapshots: the
     * whole delay on a clean link. On a late or lossy one it grows to what the worst recent
     * snapshot needed, up to interpDelayMaxMs (shared/src/net/clock.ts, T2).
     */
    interpDelayMs: 80,
    /** Capped by lagGraceMs as well, so an enemy is never drawn later than the grace that keeps a dodge fair. */
    interpDelayMaxMs: 200,
    /** The server clock is the least-delayed snapshot in this window; the delay follows its longest wait. */
    clockWindowMs: 20000,
    /** Fastest the drawn clock and the delay move, ms per second, so the drawn world never skips. */
    clockSlewMsPerS: 10,
    /** A clock this far off is taken at once (the first snapshot, a tab that slept). */
    clockSnapMs: 250,
    /** When a snapshot disagrees with a joiner's prediction, the visible hero eases over this long. */
    correctionBlendMs: 120,
    /** Debug: fake one-way network delay added to every message this browser sends. */
    fakeLatencyMs: 0,
  },

  /**
   * Cross-style combos (brief): each setup opens a 2 s window on the enemy,
   * and any hero (or a solo player who swaps in time) can cash it in.
   */
  combos: {
    windowMs: 2000,
    /** Shatter: magic slows/freezes, then a melee finisher. */
    shatterDamageBonus: 0.5,
    shatterRadius: 2.5,
    /** Enemies around the shattered one take this fraction of the finisher. */
    shatterSplashFrac: 0.5,
    /** Skewer: melee staggers, then a charged shot through them. */
    skewerDamageBonus: 0.5,
    /** Detonate: volley marks, then a magic burst. */
    detonateRadiusBonus: 0.5,
    detonateDamageBonus: 0.3,
  },

  /**
   * The loop's stakes and rewards (P1; design doc: Core loop, Rest rooms). On a generated floor finds
   * are carried until a rest room or the Warden's fall banks them, and a wipe loses them. Banking pays
   * for the fight rooms cleared on that floor: coin to each player, lumber and stone to the village
   * the run set out from. Each floor deeper pays depthBonus more, and makes a rare drop that much likelier.
   */
  /**
   * Flow (C2; Michael, 28 Oct): a rhythm meter. Presses as the chain's next step opens are on the beat;
   * the attack's earnings land with its first hit. Off in the parity test: the slice has no meter.
   */
  flow: {
    enabled: true,
    max: 300,
    beatEarlyMs: 120,
    beatLateMs: 160,
    lightOnBeat: 8,
    lightOffBeat: 3,
    heavyOnBeat: 14,
    heavyOffBeat: 5,
    /** The same chain a third time running earns this share. */
    repeatFrac: 0.5,
    /** A perfect parry, or a dodge that slips a hit. */
    perfectGain: 20,
    /** A combo payoff: a whole tier. */
    comboGain: 100,
    idleMs: 2500,
    drainPerSec: 40,
    /** Flow I and up: attacks this much faster. */
    tier1Speed: 0.05,
    /** Two players at Flow III: a combo payoff gains this. */
    harmonyBonus: 0.2,
    /** A Crescendo (a charged heavy at a full meter) hits this much harder again. */
    crescendoDamage: 2,
  },

  /** The host's village (P2, P4): its four starting buildings go up to this tier in Phase 2. */
  village: {
    maxTier: 4,
    /**
     * Raising a building to tier 2 costs this (P4; Michael, 28 Oct: lumber, stone and coin); each
     * tier after costs upgradeGrowth times the one before. About a run buys tier 2 of one building.
     */
    upgradeLumber: 40,
    upgradeStone: 30,
    upgradeCoin: 80,
    upgradeGrowth: 2.4,
    /** What a tier gives (P5, P9, P10 use these): the store's daily stock and the storehouse's stash. */
    stockBase: 4,
    stockPerTier: 2,
    /** Marta's stash (P9; Michael, 28 Oct: 10 to 20 spaces to begin, growing with the Storehouse). */
    stashBase: 16,
    stashPerTier: 8,
    /** The bag's first spaces are its safe pocket (D5): never lost on a wipe; more with the Storehouse. */
    pocketBase: 3,
    pocketPerTier: 1,
    /**
     * The General Store (P5): a common of tier 1 costs priceBase, each tier priceTierGrowth more, a
     * rare rarePriceMult more; Aldous pays sellShare of what he would ask.
     */
    priceBase: 20,
    priceTierGrowth: 1.8,
    rarePriceMult: 3,
    sellShare: 0.3,
    /** A champion point taken back costs this much coin (P5; decisions.md 27 Oct: free until coin came). */
    respecCoinPerPoint: 15,
    /** Hiring a henchman at the Tavern (P10), paid once; they stay with the party until dismissed. */
    hireCoin: 60,
    /**
     * A henchman's level is capped by the Tavern (P12; Michael, 29 Oct): this many levels a tier, and
     * the top tier lets them reach progression.maxLevel.
     */
    henchmanCapPerTier: 12,
  },

  loop: {
    depthBonus: 0.3,
    coinPerRoom: 12,
    lumberPerRoom: 4,
    stonePerRoom: 3,
    /** The Warden's hall pays this on top of its room. */
    bossCoin: 60,
    bossLumber: 12,
    bossStone: 12,
    /**
     * Things to smash (D4; Michael, 28 Oct): a crate or barrel sprays out lumber, an urn stone, a
     * piece at a time, between these many each (Michael, 29 Oct: "in random quantities"). What is
     * picked up is carried until the floor banks (and the deeper floors' bonus with it).
     */
    smashLumberMin: 1,
    smashLumberMax: 3,
    smashStoneMin: 1,
    smashStoneMax: 3,
    /** Crates and barrels hold coin too (Michael, 29 Oct): this often, between these many, in up to three piles. */
    smashCoinChance: 0.5,
    smashCoinMin: 2,
    smashCoinMax: 8,
    /**
     * How far the spray throws a piece from the prop (m), at most, out into the room; a piece can
     * be taken once it lands, smashSettleMs after the break, by a hero within lootRadius.
     */
    smashSpray: 1.4,
    smashSettleMs: 450,
    lootRadius: 0.9,
    /** The chance a smashed prop holds a health potion, the heal between rest rooms since D7. */
    potionChance: 0.12,
    /** A potion gives back this share of max health at once. */
    potionHeal: 0.4,
    potionMax: 3,
    /** Between one potion and the next, so a held key drinks one. */
    potionCooldownMs: 1000,
  },

  /** The run (brief: "A run"): antechamber, then waves, then the Warden. */
  run: {
    introMs: 1500,
    /**
     * Co-op: once one hero steps into the arena, the gate waits this long for
     * the rest of the party, then closes and brings anyone still outside in.
     * It closes at once when everyone is through (and always solo).
     */
    gateWaitMs: 10000,
    restMs: 5000,
    wave1Grunts: 4,
    wave1Archers: 0,
    wave1Brutes: 0,
    wave2Grunts: 3,
    wave2Archers: 2,
    wave2Brutes: 0,
    wave3Grunts: 2,
    wave3Archers: 1,
    wave3Brutes: 1,
    /** Clearing a wave restores this fraction of max health to every hero still standing. */
    healOnWaveClear: 0.4,
    /** A second group joins each wave once the first is down to this fraction. */
    reinforceAt: 0.35,
    wave1ReinforceGrunts: 3,
    wave1ReinforceArchers: 0,
    wave1ReinforceBrutes: 0,
    wave2ReinforceGrunts: 3,
    wave2ReinforceArchers: 1,
    wave2ReinforceBrutes: 0,
    wave3ReinforceGrunts: 2,
    wave3ReinforceArchers: 1,
    wave3ReinforceBrutes: 1,
    /** Brief: each extra player adds 60% enemy health and one enemy per wave. */
    extraPlayerHealth: 0.6,
  },

  /**
   * Generated dungeons (T4, decisions.md 27 Oct): a run of 3 to 5 floors, each 10 to 50 pieces,
   * growing with the floor, the dungeon's tier and the party's level. The server reads these when
   * it makes a floor; the layout itself comes from the seed, so browsers never need them.
   */
  /**
   * Henchmen (P3; Michael, 28 Oct): heroes the server plays. Slower to read a telegraph than a player
   * and not always quick enough to dodge, so a friend is still the better partner.
   */
  hirelings: {
    /** How long a henchman stands in a telegraph before it notices (a player takes about 250 ms). */
    reactMs: 450,
    /** Once it notices, the chance it dodges out; otherwise it raises its guard. */
    dodgeChance: 0.55,
    guardMs: 700,
    /** It fights enemies this near itself or its leader, and keeps this near its leader otherwise. */
    aggroRange: 12,
    followDistance: 3,
    /** It steps apart from another hero nearer than this, so three never stand as one figure. */
    spacing: 1.3,
    /**
     * A henchman that has tried to walk for stuckMs without getting stuckMoveM from where it started
     * (a tight corner, the far side of a counter) is put beside its player (playtest, 29 Oct).
     */
    stuckMs: 3000,
    stuckMoveM: 1,
    /** Its reach to start swinging, and how often it presses attack (a player mashes faster). */
    reach: 1.8,
    attackEveryTicks: 9,
    /** The bow and staff henchmen (P6) shoot from this far, and step back from anything nearer than rangedMin. */
    bowRange: 10,
    staffRange: 8,
    rangedMin: 4.5,
    /** Every abilityCheckTicks a henchman with a ready ability and a target in reach uses it on this chance. */
    abilityCheckTicks: 40,
    abilityChance: 0.4,
    /** The share of the time it turns on an enemy someone has set up for a combo, to pay it off. */
    comboChance: 0.5,
    /** A top-tier Tavern's hires read telegraphs in this share of the time (P10). */
    quickReact: 0.7,
    /**
     * Damage a henchman gains each level (P12): it has no talents to spend, so its level is its build.
     * Its health grows with the level as any hero's does (progression.healthPerLevel).
     */
    damagePerLevel: 0.02,
  },

  dungeon: {
    /** The dungeon's difficulty until the portal offers a choice: floors per run are 2 + tier (3 to 5). */
    tier: 1,
    /** Pieces on a tier-1 run's first floor with new heroes. */
    basePieces: 14,
    piecesPerFloor: 6,
    piecesPerTier: 8,
    /** Per style level of the party's best hero, averaged over the party. */
    piecesPerLevel: 0.5,
    /**
     * A fight room's enemy budget (a grunt costs 1, an archer 2, a brute 4) per 6 m cell of floor.
     * Doubled and more after the feel pass (D1, Michael 28 Oct: three or four a room was easy), then
     * 1 to 0.6 when D2's rooms grew a size: about D1's counts a room, with twice the room to move.
     */
    budgetPerCell: 0.6,
    /** Each floor deeper adds this fraction of the budget. */
    budgetPerFloor: 0.35,
    /** Each player past the first adds this much budget (the slice: one grunt a wave). */
    budgetPerExtraPlayer: 2,
    /** The rest comes as reinforcements once the first group is mostly down. */
    firstGroupShare: 0.7,
    /**
     * Enemies that may attack each standing hero at once on a generated floor; the arena keeps the
     * slice's grunt.maxAttackers (two). With rooms this full, two at a time left the rest circling.
     */
    attackersPerHero: 3,
    /** Haunted (P8): how long a fallen enemy lies before it gets up, and the share of its health it gets up with. */
    hauntedRiseMs: 1200,
    hauntedHp: 0.5,
    /**
     * A cleared fight room's heal, of max health, on a generated floor (D7, Michael 28 Oct: not
     * after every encounter). The arena keeps run.healOnWaveClear. The rest room heals instead.
     */
    healOnClear: 0,
    /** Of max health, given to every standing hero as the rest room banks the floor. */
    restHeal: 1,
    /**
     * Shut a fight room's doors behind the party, waiting for them and pulling in stragglers (T4).
     * Off since D8 (Michael 28 Oct: locking a party in is annoying with several players); the
     * kit keeps its gates for a room that wants them.
     */
    shutDoors: false,
    /** Debug: 0 = a fresh seed each run; anything else pins the run's seed (the gate's five floors). */
    seed: 0,
    /** Debug: 0 = pieces from the tier, floor and level; 10 to 50 forces every floor's size. */
    pieces: 0,
  },

  /**
   * Style abilities (brief: "Abilities"): Q / E, LB / RB, cooldowns only.
   * The second ability per style unlocks at style level 2 once levels exist
   * (M4); until then all six are available. Damage is x combat.baseDamage.
   */
  abilities: {
    /**
     * Melee abilities that protect (C6; Michael, 29 Oct: they "make you really vulnerable, especially
     * the Whirlwind"): Charge's dash is invulnerable like a roll, and Whirlwind's spin takes
     * whirlwindDamageTaken of each hit and is never staggered. The slice's are bare; the parity test
     * turns it off.
     */
    meleeGuard: true,
    whirlwindDamageTaken: 0.3,
    // Knight Q: dash, staggering the first enemy hit.
    chargeWindupMs: 120,
    chargeDashMs: 300,
    chargeRecoveryMs: 260,
    chargeDistance: 6,
    chargeDamage: 1.2,
    chargeCooldownMs: 8000,
    // Knight E: spin in place (you can drift slowly), hitting everything around repeatedly.
    whirlwindWindupMs: 120,
    whirlwindDurationMs: 1200,
    whirlwindRecoveryMs: 300,
    whirlwindTickMs: 200,
    whirlwindRadius: 2.4,
    whirlwindDamage: 0.5,
    whirlwindMoveFrac: 0.45,
    whirlwindSpinsPerSec: 2.5,
    whirlwindCooldownMs: 14000,
    // Archer Q: five arrows in a cone.
    volleyWindupMs: 360,
    volleyRecoveryMs: 320,
    volleyArrows: 5,
    volleySpreadDeg: 40,
    volleyDamage: 0.8,
    volleyCooldownMs: 10000,
    // Archer E: backflip away and fire a slowing arrow.
    disengageWindupMs: 100,
    disengageDurationMs: 450,
    disengageRecoveryMs: 220,
    disengageDistance: 4,
    disengageDamage: 1.0,
    disengageSlowMs: 2000,
    disengageCooldownMs: 12000,
    // Mage Q: freeze everything nearby.
    frostRingWindupMs: 320,
    frostRingRecoveryMs: 380,
    frostRingRadius: 4,
    frostRingDamage: 0.5,
    frostFreezeMs: 1500,
    frostRingCooldownMs: 14000,
    // Mage E: teleport; the next bolt crits.
    blinkWindupMs: 90,
    blinkRecoveryMs: 160,
    blinkDistance: 7,
    blinkCritMultiplier: 2,
    blinkCooldownMs: 10000,
    // Off-hand (C4): the shield's bash on 3, knocking the nearest enemy in front off its feet.
    bashWindupMs: 100,
    bashDurationMs: 120,
    bashRecoveryMs: 300,
    bashCooldownMs: 6000,
    bashRangeM: 2.2,
    bashArcDeg: 100,
    bashDamage: 0.8,
    bashKnockbackM: 2,
    // The tome's ward (C5): the next hit on you and every ally near you is absorbed, for a while.
    wardWindupMs: 200,
    wardDurationMs: 100,
    wardRecoveryMs: 300,
    wardCooldownMs: 12000,
    wardRadiusM: 5,
    wardSeconds: 8,
    // The buckler's deflect (C5): for a moment every hit on you is parried.
    deflectWindupMs: 0,
    deflectDurationMs: 450,
    deflectRecoveryMs: 150,
    deflectCooldownMs: 5000,
    // The hand crossbow's quick shot (C5): two bolts from the off hand.
    quickShotWindupMs: 100,
    quickShotDurationMs: 60,
    quickShotRecoveryMs: 250,
    quickShotCooldownMs: 4000,
    quickShotDamage: 0.9,
  },

  /** Soft targeting (brief: "Camera and controls"). */
  targeting: {
    /** Cone around the aim (camera forward) that attacks look for a target in. */
    coneDeg: 70,
    meleeRange: 4,
    rangedRange: 25,
    /** Melee lunges stop this far short of the target. */
    lungeStopShort: 0.8,
    /** With a target, a swing's lunge may stretch by up to this much to close the gap. */
    lungeMagnetM: 1.8,
    /** Bolts curve toward their target by at most this much in total. */
    boltHomingDeg: 15,
    boltHomingRateDeg: 180,
  },

  /** Lock-on (Tab, middle click, right stick click). */
  lockOn: {
    range: 25,
    /** Targets within this angle of the camera's view are considered. */
    acquireConeDeg: 70,
    /** How quickly the camera swings to keep the target framed (1/s). */
    cameraYawRate: 8,
    /** How far the camera's look point moves from the hero toward the target (0..1). */
    framing: 0.35,
    /** A mouse/stick flick of this much yaw (deg) within flickWindowMs switches targets. */
    flickDeg: 7,
    flickWindowMs: 250,
    breakDistance: 30,
    /** How fast the aim mark (D11) glides to a new target or point (1/s). */
    reticleRate: 22,
  },

  camera: {
    distance: 5.5,
    /** The player's zoom (the wheel, - and =, the d-pad): a multiple of distance, kept in the browser. */
    zoomMin: 0.5,
    zoomMax: 2,
    /** Each wheel notch or press multiplies or divides the zoom by this. */
    zoomStep: 1.12,
    /** How fast the camera eases to a new zoom (1/s). */
    zoomRate: 12,
    /**
     * Free aim over the shoulder (D12, Michael 28 Oct): with a ranged weapon out and no lock-on, shots
     * go through the reticle at the screen's centre, up and down too, and the camera sits over the
     * right shoulder so the hero is not in the way. Off is the slice's aim at the soft target.
     */
    freeAim: true,
    /** How far right of the hero the camera's pivot moves (m), and how fast it gets there (1/s). */
    shoulderOffset: 0.85,
    shoulderRate: 8,
    /** Over the shoulder, the camera comes in to this share of its distance. */
    shoulderZoom: 0.8,
    /** With nothing under the reticle, shots aim at a point this far along it (m). */
    aimRange: 40,
    pivotHeight: 1.7,
    fovDeg: 60,
    /** Field of view widens this much at full sprint. */
    sprintFovBoostDeg: 5,
    fovBlendRate: 6,
    pitchMinDeg: -30,
    pitchMaxDeg: 60,
    /** Pitch the camera starts at. Positive = camera above the pivot looking down. */
    startPitchDeg: 15,
    minDistance: 1.5,
    /** Radius of the sphere cast that stops the camera at walls and the floor. */
    collisionRadius: 0.25,
    /** Extra radius for the "soft" cast so the camera starts easing in before it touches anything. */
    softMargin: 0.35,
    /** Exponential rate (1/s) when pulling in toward an obstruction. */
    pullInRate: 14,
    /** Exponential rate (1/s) when easing back out after an obstruction clears. */
    pushOutRate: 3,
    /** When walls force the camera closer than minDistance, it cranes upward instead (max extra pitch). */
    craneMaxDeg: 85,
    craneRate: 8,
    /** Collision also checks where the orbit will be this far ahead (s), so fast swings into walls ease in early. */
    anticipationSec: 0.15,
    /** Smoothing (1/s) on the orbit speed estimate used for anticipation. */
    orbitVelocitySmoothing: 20,
    /** How tightly the pivot tracks the hero (1/s). Higher = stiffer. */
    followRate: 25,
    /** Separate, softer vertical tracking so jumps don't yank the camera. */
    verticalFollowRate: 7,
    mouseSensitivity: 0.12,
    invertY: false,
    gamepadYawDegPerSec: 220,
    gamepadPitchDegPerSec: 150,
    /** Pillars between camera and hero fade to this opacity. */
    occluderOpacity: 0.18,
    occluderFadeRate: 10,
    /** Radius of the line-of-sight cast used to detect occluding pillars. */
    occluderProbeRadius: 0.3,
    nearPlane: 0.1,
    farPlane: 200,
  },

  /** Procedural animation for the primitive knight; goes away with real animation clips. */
  heroAnim: {
    /** Metres travelled per full gait cycle (two steps). */
    strideLength: 2.2,
    stepHeight: 0.16,
    bobHeight: 0.05,
    runLeanDeg: 10,
    /** Extra lean and stride length at full sprint. */
    sprintLeanDeg: 8,
    sprintStrideScale: 1.3,
    armSwing: 0.6,
    /** Blend rate (1/s) between locomotion, attacks and air poses. */
    blendRate: 14,
    /** How much attacks sweep through their key poses instead of stopping at each (0..1). */
    attackFlow: 0.55,
    /** Crouch on landing, in metres of hip drop. */
    landCrouch: 0.12,
  },

  input: {
    stickDeadzone: 0.18,
    /** Exponent on look-stick magnitude; >1 gives finer control near center. */
    lookStickCurve: 2.0,
  },

  /**
   * The look. M6 art direction (Michael): dark fantasy in an 80s-90s pixel
   * style on a CRT, purple shadows against orange firelight.
   */
  look: {
    exposure: 1.35,
    /** Device pixel ratio cap, used only when pixelSize is 1 (retro pixels off). */
    maxPixelRatio: 2,
    /** Screen pixels per game pixel: the scene renders this much smaller and is scaled up with hard edges. 1 = off. */
    pixelSize: 3,
    /** The colour grade, palette and fringing below (off = clean modern image). */
    retro: true,
    /** Levels per colour channel after dithering (lower = chunkier palette). */
    colorLevels: 24,
    ditherStrength: 0.85,
    contrast: 1.12,
    saturation: 1.15,
    /** Split tone: shadows pulled toward the first colour, highlights toward the second. */
    shadowTint: 0x6a58b0,
    highlightTint: 0xffae6a,
    splitTone: 0.28,
    /** Colour fringing at the screen's sides, in game pixels. */
    aberration: 0.9,
    vignette: 0.45,
    /** CRT glass over everything (scanlines, aperture mask, rounded screen). */
    crt: true,
    scanlines: 0.3,
    /** Rounded-corner radius of the screen, in CSS pixels. */
    crtCornerPx: 26,
    fogColor: 0x1d1030,
    fogDensity: 0.018,
    backgroundColor: 0x0b0712,
    hemiSkyColor: 0x5c4e86,
    hemiGroundColor: 0x2a1610,
    hemiIntensity: 1.1,
    /** High key light: violet, as if from a moonlit opening. */
    moonColor: 0xc8bcff,
    moonIntensity: 1.6,
    shadowMapSize: 2048,
    shadowRadius: 4,
    torchColor: 0xff8a3a,
    torchIntensity: 40,
    torchRange: 18,
    torchFlicker: 0.22,
    rimColor: 0xb08aff,
    rimIntensity: 0.8,
    /** Strength of the reflection map on the knight's armour. */
    metalEnvIntensity: 1.0,
    bloomStrength: 0.75,
    bloomRadius: 0.55,
    bloomThreshold: 0.7,
    /** Embers drifting up from torches and braziers, and dust hanging in the air. */
    embers: 140,
    dust: 220,
  },

  /**
   * The village's mood (T3; Michael, 27 Oct: a golden afternoon): these replace the matching look
   * values while the party is in the village. Low warm sun from the west, honey light, bluish shade,
   * a clear sky fading to a gold horizon, motes of dust in the light and no embers. The player's own
   * settings (pixel size, the CRT, scanlines) still come from look.
   */
  villageLook: {
    exposure: 1.2,
    contrast: 1.06,
    saturation: 1.12,
    shadowTint: 0x4f5c9c,
    highlightTint: 0xffc47a,
    splitTone: 0.2,
    vignette: 0.3,
    fogColor: 0xe9bf8c,
    fogDensity: 0.006,
    skyTopColor: 0x8fb8e2,
    skyHorizonColor: 0xffd49a,
    hemiSkyColor: 0xffe4b8,
    hemiGroundColor: 0x5e4a32,
    hemiIntensity: 1.25,
    /** The sun: in the look's moon slot (the one shadow-casting light), low in the west. */
    moonColor: 0xffc27a,
    moonIntensity: 3.0,
    sunHeightDeg: 24,
    sunBearingDeg: 250,
    rimColor: 0xffd59a,
    rimIntensity: 0.45,
    bloomStrength: 0.4,
    bloomRadius: 0.5,
    bloomThreshold: 0.82,
    embers: 0,
    dust: 160,
  },

  debug: {
    /** 0.25 when slow motion is on; read by the main loop. */
    slowMoScale: 0.25,
    slowMo: false,
    showColliders: false,
    /** Draw attack hit areas, hurt cylinders and enemy swings (brief: hitbox overlay). */
    showHitboxes: false,
    /** Grunts spawn in waves. */
    enemiesEnabled: true,
    /** Grunts still move and telegraph but never swing. */
    passiveEnemies: false,
    godMode: false,
  },
};

export type Tuning = typeof tuning;

/** Slider ranges for the debug panel: "section.key" -> [min, max, step]. */
export const tuningRanges: Record<string, [number, number, number]> = {
  'sim.tickRate': [20, 120, 1],

  'coop.bleedOutMs': [5000, 90000, 1000],
  'coop.crawlSpeed': [0, 3, 0.1],
  'coop.draughtsPerFloor': [0, 5, 1],

  'dungeon.tier': [1, 3, 1],
  'dungeon.basePieces': [10, 50, 1],
  'dungeon.piecesPerFloor': [0, 15, 1],
  'dungeon.piecesPerTier': [0, 20, 1],
  'dungeon.piecesPerLevel': [0, 3, 0.1],
  'dungeon.budgetPerCell': [0.1, 3, 0.05],
  'dungeon.budgetPerFloor': [0, 1, 0.05],
  'dungeon.budgetPerExtraPlayer': [0, 5, 0.5],
  'dungeon.firstGroupShare': [0.2, 1, 0.05],
  'dungeon.attackersPerHero': [1, 6, 1],
  'hirelings.reactMs': [0, 2000, 10],
  'hirelings.dodgeChance': [0, 1, 0.05],
  'hirelings.guardMs': [0, 3000, 50],
  'hirelings.aggroRange': [2, 40, 1],
  'hirelings.followDistance': [1, 12, 0.5],
  'hirelings.spacing': [0, 4, 0.1],
  'hirelings.stuckMs': [500, 10000, 100],
  'hirelings.stuckMoveM': [0.2, 4, 0.1],
  'hirelings.reach': [0.5, 4, 0.1],
  'hirelings.attackEveryTicks': [1, 60, 1],
  'hirelings.bowRange': [3, 20, 0.5],
  'hirelings.staffRange': [3, 20, 0.5],
  'hirelings.rangedMin': [0, 10, 0.5],
  'hirelings.abilityCheckTicks': [1, 240, 1],
  'hirelings.abilityChance': [0, 1, 0.05],
  'hirelings.comboChance': [0, 1, 0.05],
  'hirelings.quickReact': [0.1, 1, 0.05],
  'hirelings.damagePerLevel': [0, 0.1, 0.005],
  'village.hireCoin': [0, 500, 5],
  'village.henchmanCapPerTier': [1, 50, 1],
  'dungeon.hauntedRiseMs': [0, 5000, 50],
  'dungeon.hauntedHp': [0.1, 1, 0.05],
  'dungeon.healOnClear': [0, 1, 0.05],
  'dungeon.restHeal': [0, 1, 0.05],
  'dungeon.seed': [0, 99999, 1],
  'dungeon.pieces': [0, 50, 1],
  'sim.maxStepsPerFrame': [1, 60, 1],

  'movement.walkSpeed': [0.5, 5, 0.1],
  'movement.runSpeed': [2, 12, 0.1],
  'movement.sprintSpeed': [2, 16, 0.1],
  'movement.runThreshold': [0.1, 1, 0.05],
  'movement.acceleration': [5, 120, 1],
  'movement.deceleration': [5, 120, 1],
  'movement.turnRateDeg': [90, 2000, 10],
  'movement.faceTurnRateDeg': [90, 3000, 10],
  'movement.strafeSpeedFrac': [0.2, 1, 0.01],
  'movement.backpedalSpeedFrac': [0.2, 1, 0.01],
  'movement.radius': [0.2, 0.8, 0.01],
  'movement.height': [1, 3, 0.05],

  'dodge.durationMs': [150, 1000, 10],
  'dodge.distance': [1, 10, 0.1],
  'dodge.easeOutPower': [0, 5, 0.1],
  'dodge.iframesMs': [0, 1000, 10],
  'dodge.charges': [1, 5, 1],
  'dodge.chargeRechargeMs': [100, 5000, 50],
  'dodge.minGapMs': [0, 500, 10],
  'dodge.backstepDistanceFrac': [0.1, 1.5, 0.05],
  'coop.maxPlayers': [1, 4, 1],
  'coop.reviveMs': [0, 10000, 100],
  'coop.reviveRadius': [0.5, 5, 0.1],
  'coop.reviveHpFrac': [0.05, 1, 0.05],
  'coop.joinInvulnMs': [0, 5000, 100],
  'coop.lagGraceMs': [0, 400, 10],
  'coop.snapshotEveryTicks': [1, 6, 1],
  'coop.inputBufferTicks': [0, 8, 1],
  'coop.interpDelayMs': [0, 300, 5],
  'coop.interpDelayMaxMs': [0, 500, 10],
  'coop.clockWindowMs': [1000, 60000, 1000],
  'coop.clockSlewMsPerS': [1, 100, 1],
  'coop.clockSnapMs': [50, 1000, 10],
  'coop.correctionBlendMs': [0, 500, 10],
  'coop.fakeLatencyMs': [0, 300, 5],
  'combos.windowMs': [0, 6000, 100],
  'combos.shatterDamageBonus': [0, 2, 0.05],
  'combos.shatterRadius': [0, 6, 0.1],
  'combos.shatterSplashFrac': [0, 2, 0.05],
  'combos.skewerDamageBonus': [0, 2, 0.05],
  'combos.detonateRadiusBonus': [0, 2, 0.05],
  'combos.detonateDamageBonus': [0, 2, 0.05],
  'dodge.cancelAfterMs': [0, 1000, 10],
  'dodge.cancelFloorMs': [0, 500, 10],
  'guard.moveSpeedFrac': [0, 1, 0.05],
  'guard.arcDeg': [30, 360, 5],
  'guard.parryWindowMs': [0, 600, 10],
  'guard.parryRearmMs': [0, 2000, 10],
  'guard.blockDamageFrac': [0, 1, 0.05],
  'guard.heavyBlockDamageFrac': [0, 1, 0.05],
  'guard.guardBreakMs': [0, 2000, 10],
  'guard.blockPushM': [0, 3, 0.05],
  'guard.parryHitstopMs': [0, 400, 5],
  'guard.parryWardenPoise': [0, 30, 0.5],
  'guard.reflectDamageMult': [0, 5, 0.1],

  'jump.height': [0.2, 3, 0.05],
  'jump.gravity': [5, 60, 0.5],
  'jump.airControl': [0, 1, 0.05],

  'combo.durationScale': [0.5, 3, 0.05],
  'combo.inputBufferMs': [0, 500, 10],
  'combo.heavyHoldMs': [100, 600, 10],
  'combo.chargeMs': [100, 1500, 10],
  'combo.charge2Damage': [1, 3, 0.05],
  'combo.charge2Poise': [1, 3, 0.05],
  'combo.maxTurnDeg': [0, 180, 5],
  'combo.castMoveSpeedFrac': [0, 1, 0.05],

  'meleeCombo.hit1WindupMs': [20, 1200, 5],
  'meleeCombo.hit1ActiveMs': [20, 800, 5],
  'meleeCombo.hit1RecoveryMs': [20, 1500, 5],
  'meleeCombo.hit1LungeM': [-5, 5, 0.05],
  'meleeCombo.hit2WindupMs': [20, 1200, 5],
  'meleeCombo.hit2ActiveMs': [20, 800, 5],
  'meleeCombo.hit2RecoveryMs': [20, 1500, 5],
  'meleeCombo.hit2LungeM': [-5, 5, 0.05],
  'meleeCombo.hit3WindupMs': [20, 1200, 5],
  'meleeCombo.hit3ActiveMs': [20, 800, 5],
  'meleeCombo.hit3RecoveryMs': [20, 1500, 5],
  'meleeCombo.hit3LungeM': [-5, 5, 0.05],
  'meleeCombo.hit4WindupMs': [20, 1200, 5],
  'meleeCombo.hit4ActiveMs': [20, 800, 5],
  'meleeCombo.hit4RecoveryMs': [20, 1500, 5],
  'meleeCombo.hit4LungeM': [-5, 5, 0.05],
  'meleeCombo.hit5WindupMs': [20, 1200, 5],
  'meleeCombo.hit5ActiveMs': [20, 800, 5],
  'meleeCombo.hit5RecoveryMs': [20, 1500, 5],
  'meleeCombo.hit5LungeM': [-5, 5, 0.05],

  'rangedCombo.hit1WindupMs': [20, 1200, 5],
  'rangedCombo.hit1ActiveMs': [20, 800, 5],
  'rangedCombo.hit1RecoveryMs': [20, 1500, 5],
  'rangedCombo.hit1LungeM': [-5, 5, 0.05],
  'rangedCombo.hit2WindupMs': [20, 1200, 5],
  'rangedCombo.hit2ActiveMs': [20, 800, 5],
  'rangedCombo.hit2RecoveryMs': [20, 1500, 5],
  'rangedCombo.hit2LungeM': [-5, 5, 0.05],
  'rangedCombo.hit3WindupMs': [20, 1200, 5],
  'rangedCombo.hit3ActiveMs': [20, 800, 5],
  'rangedCombo.hit3RecoveryMs': [20, 1500, 5],
  'rangedCombo.hit3LungeM': [-5, 5, 0.05],
  'rangedCombo.hit4WindupMs': [20, 1200, 5],
  'rangedCombo.hit4ActiveMs': [20, 800, 5],
  'rangedCombo.hit4RecoveryMs': [20, 1500, 5],
  'rangedCombo.hit4LungeM': [-5, 5, 0.05],
  'rangedCombo.hit5WindupMs': [20, 1200, 5],
  'rangedCombo.hit5ActiveMs': [20, 800, 5],
  'rangedCombo.hit5RecoveryMs': [20, 1500, 5],
  'rangedCombo.hit5LungeM': [-5, 5, 0.05],

  'magicCombo.hit1WindupMs': [20, 1200, 5],
  'magicCombo.hit1ActiveMs': [20, 800, 5],
  'magicCombo.hit1RecoveryMs': [20, 1500, 5],
  'magicCombo.hit1LungeM': [-5, 5, 0.05],
  'magicCombo.hit2WindupMs': [20, 1200, 5],
  'magicCombo.hit2ActiveMs': [20, 800, 5],
  'magicCombo.hit2RecoveryMs': [20, 1500, 5],
  'magicCombo.hit2LungeM': [-5, 5, 0.05],
  'magicCombo.hit3WindupMs': [20, 1200, 5],
  'magicCombo.hit3ActiveMs': [20, 800, 5],
  'magicCombo.hit3RecoveryMs': [20, 1500, 5],
  'magicCombo.hit3LungeM': [-5, 5, 0.05],
  'magicCombo.hit4WindupMs': [20, 1200, 5],
  'magicCombo.hit4ActiveMs': [20, 800, 5],
  'magicCombo.hit4RecoveryMs': [20, 1500, 5],
  'magicCombo.hit4LungeM': [-5, 5, 0.05],
  'magicCombo.hit5WindupMs': [20, 1200, 5],
  'magicCombo.hit5ActiveMs': [20, 800, 5],
  'magicCombo.hit5RecoveryMs': [20, 1500, 5],
  'magicCombo.hit5LungeM': [-5, 5, 0.05],

  'rangedCombo.arrowSpeed': [5, 80, 1],
  'rangedCombo.powerArrowSpeed': [5, 100, 1],
  'rangedCombo.fanArrows': [1, 9, 1],
  'rangedCombo.fanSpreadDeg': [0, 90, 1],
  'rangedCombo.arrowGravity': [0, 20, 0.5],
  'rangedCombo.arrowLifeMs': [200, 4000, 50],
  'rangedCombo.stuckArrowLifeMs': [0, 15000, 250],
  'magicCombo.boltSpeed': [5, 60, 0.5],
  'magicCombo.boltLifeMs': [200, 4000, 50],
  'magicCombo.burstRange': [1, 25, 0.5],
  'magicCombo.burstRadius': [0.5, 8, 0.1],
  'magicCombo.burstLifeMs': [100, 2000, 25],
  'magicCombo.novaBolts': [3, 24, 1],
  'magicCombo.greatBurstRange': [0, 20, 0.5],
  'magicCombo.greatBurstRadius': [0.5, 10, 0.1],

  'meleeCombo.hit1Damage': [0, 5, 0.05],
  'meleeCombo.hit1Poise': [0, 10, 0.1],
  'meleeCombo.hit1KnockbackM': [0, 6, 0.1],
  'meleeCombo.hit1Heavy': [0, 1, 1],
  'meleeCombo.hit1RangeM': [0.5, 5, 0.05],
  'meleeCombo.hit1ArcDeg': [10, 360, 5],
  'meleeCombo.hit2Damage': [0, 5, 0.05],
  'meleeCombo.hit2Poise': [0, 10, 0.1],
  'meleeCombo.hit2KnockbackM': [0, 6, 0.1],
  'meleeCombo.hit2Heavy': [0, 1, 1],
  'meleeCombo.hit2RangeM': [0.5, 5, 0.05],
  'meleeCombo.hit2ArcDeg': [10, 360, 5],
  'meleeCombo.hit3Damage': [0, 5, 0.05],
  'meleeCombo.hit3Poise': [0, 10, 0.1],
  'meleeCombo.hit3KnockbackM': [0, 6, 0.1],
  'meleeCombo.hit3Heavy': [0, 1, 1],
  'meleeCombo.hit3RangeM': [0.5, 5, 0.05],
  'meleeCombo.hit3ArcDeg': [10, 360, 5],
  'meleeCombo.hit4Damage': [0, 5, 0.05],
  'meleeCombo.hit4Poise': [0, 10, 0.1],
  'meleeCombo.hit4KnockbackM': [0, 6, 0.1],
  'meleeCombo.hit4Heavy': [0, 1, 1],
  'meleeCombo.hit4RangeM': [0.5, 5, 0.05],
  'meleeCombo.hit4ArcDeg': [10, 360, 5],
  'meleeCombo.hit5Damage': [0, 5, 0.05],
  'meleeCombo.hit5Poise': [0, 10, 0.1],
  'meleeCombo.hit5KnockbackM': [0, 6, 0.1],
  'meleeCombo.hit5Heavy': [0, 1, 1],
  'meleeCombo.hit5RangeM': [0.5, 5, 0.05],
  'meleeCombo.hit5ArcDeg': [10, 360, 5],
  'rangedCombo.hit1Damage': [0, 5, 0.05],
  'rangedCombo.hit1Poise': [0, 10, 0.1],
  'rangedCombo.hit1KnockbackM': [0, 6, 0.1],
  'rangedCombo.hit1Heavy': [0, 1, 1],
  'rangedCombo.hit2Damage': [0, 5, 0.05],
  'rangedCombo.hit2Poise': [0, 10, 0.1],
  'rangedCombo.hit2KnockbackM': [0, 6, 0.1],
  'rangedCombo.hit2Heavy': [0, 1, 1],
  'rangedCombo.hit3Damage': [0, 5, 0.05],
  'rangedCombo.hit3Poise': [0, 10, 0.1],
  'rangedCombo.hit3KnockbackM': [0, 6, 0.1],
  'rangedCombo.hit3Heavy': [0, 1, 1],
  'rangedCombo.hit4Damage': [0, 5, 0.05],
  'rangedCombo.hit4Poise': [0, 10, 0.1],
  'rangedCombo.hit4KnockbackM': [0, 6, 0.1],
  'rangedCombo.hit4Heavy': [0, 1, 1],
  'rangedCombo.hit5Damage': [0, 5, 0.05],
  'rangedCombo.hit5Poise': [0, 10, 0.1],
  'rangedCombo.hit5KnockbackM': [0, 6, 0.1],
  'rangedCombo.hit5Heavy': [0, 1, 1],
  'magicCombo.hit1Damage': [0, 5, 0.05],
  'magicCombo.hit1Poise': [0, 10, 0.1],
  'magicCombo.hit1KnockbackM': [0, 6, 0.1],
  'magicCombo.hit1Heavy': [0, 1, 1],
  'magicCombo.hit2Damage': [0, 5, 0.05],
  'magicCombo.hit2Poise': [0, 10, 0.1],
  'magicCombo.hit2KnockbackM': [0, 6, 0.1],
  'magicCombo.hit2Heavy': [0, 1, 1],
  'magicCombo.hit3Damage': [0, 5, 0.05],
  'magicCombo.hit3Poise': [0, 10, 0.1],
  'magicCombo.hit3KnockbackM': [0, 6, 0.1],
  'magicCombo.hit3Heavy': [0, 1, 1],
  'magicCombo.hit4Damage': [0, 5, 0.05],
  'magicCombo.hit4Poise': [0, 10, 0.1],
  'magicCombo.hit4KnockbackM': [0, 6, 0.1],
  'magicCombo.hit4Heavy': [0, 1, 1],
  'magicCombo.hit5Damage': [0, 5, 0.05],
  'magicCombo.hit5Poise': [0, 10, 0.1],
  'magicCombo.hit5KnockbackM': [0, 6, 0.1],
  'magicCombo.hit5Heavy': [0, 1, 1],
  'rangedCombo.powerPierce': [1, 10, 1],
  'magicCombo.burstSlowFrac': [0, 1, 0.05],
  'magicCombo.burstSlowMs': [0, 6000, 100],

  'combat.baseDamage': [1, 50, 1],
  'combat.heroMaxHp': [10, 500, 5],
  'combat.downMs': [500, 10000, 100],
  'combat.reviveInvulnMs': [0, 5000, 100],
  'combat.staggerMs': [100, 4000, 50],
  'combat.staggerDamageBonus': [0, 2, 0.05],
  'combat.poiseRegenDelayMs': [0, 6000, 100],
  'combat.poiseRegenPerSec': [0, 20, 0.5],
  'combat.flinchMs': [0, 800, 10],
  'combat.knockbackFriction': [1, 30, 0.5],
  'combat.slamHitFrom': [0, 1, 0.05],
  'combat.comboResetMs': [200, 6000, 100],

  'launch.distanceM': [0, 12, 0.5],
  'launch.warhammerMult': [1, 3, 0.1],
  'launch.damageShare': [0, 1, 0.05],
  'launch.impactKnockbackM': [0, 4, 0.1],
  'launch.minSpeed': [0, 10, 0.5],
  'launch.arcHeightM': [0, 3, 0.1],
  'launch.arcSeconds': [0.1, 1.5, 0.05],

  'hitFeel.hitstopLightMs': [0, 300, 5],
  'hitFeel.hitstopHeavyMs': [0, 400, 5],
  'hitFeel.flashMs': [0, 300, 5],
  'hitFeel.flashStrength': [0, 1, 0.05],
  'hitFeel.shakeM': [0, 0.5, 0.01],
  'hitFeel.shakeMs': [0, 600, 10],
  'hitFeel.fovPunchDeg': [0, 10, 0.1],
  'hitFeel.hurtShakeM': [0, 0.3, 0.01],
  'hitFeel.sparkCount': [0, 60, 1],
  'hitFeel.sparkSpeed': [0, 15, 0.5],
  'hitFeel.trailLifeMs': [0, 600, 10],
  'hitFeel.sfxVolume': [0, 1, 0.05],
  'hitFeel.pitchJitter': [0, 0.3, 0.01],

  'grunt.maxHp': [5, 400, 5],
  'grunt.maxPoise': [1, 40, 0.5],
  'grunt.radius': [0.2, 1, 0.01],
  'grunt.height': [0.8, 3, 0.05],
  'grunt.moveSpeed': [0.5, 10, 0.1],
  'grunt.turnRateDeg': [30, 1000, 10],
  'grunt.windupTurnRateDeg': [0, 720, 10],
  'grunt.holdDistance': [1, 10, 0.1],
  'grunt.attackRange': [0.5, 4, 0.05],
  'grunt.maxAttackers': [1, 6, 1],
  'grunt.telegraphMs': [100, 2000, 10],
  'grunt.slashActiveMs': [20, 500, 10],
  'grunt.betweenSlashesMs': [50, 1000, 10],
  'grunt.recoveryMs': [100, 2500, 10],
  'grunt.attackCooldownMs': [0, 4000, 50],
  'grunt.damage': [0, 60, 1],
  'grunt.reach': [0.5, 4, 0.05],
  'grunt.arcDeg': [10, 360, 5],
  'grunt.spawnMs': [0, 2000, 50],
  'grunt.deathMs': [200, 5000, 50],
  'grunt.groupMin': [1, 10, 1],
  'grunt.groupMax': [1, 12, 1],
  'grunt.respawnDelayMs': [0, 10000, 250],

  'abilities.chargeWindupMs': [0, 4000, 10],
  'abilities.chargeDashMs': [0, 4000, 10],
  'abilities.chargeRecoveryMs': [0, 4000, 10],
  'abilities.chargeDistance': [0, 18, 0.1],
  'abilities.chargeDamage': [0, 5, 0.05],
  'abilities.chargeCooldownMs': [0, 24000, 10],
  'abilities.bashWindupMs': [0, 1000, 10],
  'abilities.bashDurationMs': [0, 1000, 10],
  'abilities.bashRecoveryMs': [0, 1500, 10],
  'abilities.bashCooldownMs': [0, 24000, 100],
  'abilities.bashRangeM': [0.5, 5, 0.1],
  'abilities.bashArcDeg': [10, 360, 5],
  'abilities.bashDamage': [0, 5, 0.05],
  'abilities.bashKnockbackM': [0, 6, 0.1],
  'abilities.wardCooldownMs': [0, 30000, 100],
  'abilities.wardRadiusM': [0, 15, 0.5],
  'abilities.wardSeconds': [0, 30, 0.5],
  'abilities.deflectDurationMs': [0, 1500, 10],
  'abilities.deflectCooldownMs': [0, 20000, 100],
  'abilities.quickShotCooldownMs': [0, 20000, 100],
  'abilities.quickShotDamage': [0, 5, 0.05],
  'families.warhammerHeavyDamage': [0.5, 3, 0.05],
  'families.warhammerHeavyWindup': [0.5, 3, 0.05],
  'families.crossbowHeavyDamage': [0.5, 3, 0.05],
  'families.crossbowHeavyWindup': [0.5, 3, 0.05],
  'families.wandHeavyDamage': [0.5, 3, 0.05],
  'families.wandHeavyWindup': [0.3, 3, 0.05],
  'gear.twoHandDamage': [0, 1, 0.05],
  'gear.frostArrowSlowS': [0, 5, 0.1],
  'abilities.whirlwindWindupMs': [0, 4000, 10],
  'abilities.whirlwindDurationMs': [0, 4000, 10],
  'abilities.whirlwindRecoveryMs': [0, 4000, 10],
  'abilities.whirlwindTickMs': [0, 4000, 10],
  'abilities.whirlwindDamageTaken': [0, 1, 0.05],
  'abilities.whirlwindRadius': [0, 10, 0.1],
  'abilities.whirlwindDamage': [0, 5, 0.05],
  'abilities.whirlwindMoveFrac': [0, 1, 0.05],
  'abilities.whirlwindSpinsPerSec': [0, 10, 0.1],
  'abilities.whirlwindCooldownMs': [0, 42000, 10],
  'abilities.volleyWindupMs': [0, 4000, 10],
  'abilities.volleyRecoveryMs': [0, 4000, 10],
  'abilities.volleyArrows': [1, 15, 1],
  'abilities.volleySpreadDeg': [0, 180, 1],
  'abilities.volleyDamage': [0, 5, 0.05],
  'abilities.volleyCooldownMs': [0, 30000, 10],
  'abilities.disengageWindupMs': [0, 4000, 10],
  'abilities.disengageDurationMs': [0, 4000, 10],
  'abilities.disengageRecoveryMs': [0, 4000, 10],
  'abilities.disengageDistance': [0, 12, 0.1],
  'abilities.disengageDamage': [0, 5, 0.05],
  'abilities.disengageSlowMs': [0, 6000, 10],
  'abilities.disengageCooldownMs': [0, 36000, 10],
  'abilities.frostRingWindupMs': [0, 4000, 10],
  'abilities.frostRingRecoveryMs': [0, 4000, 10],
  'abilities.frostRingRadius': [0, 12, 0.1],
  'abilities.frostRingDamage': [0, 5, 0.05],
  'abilities.frostFreezeMs': [0, 4500, 10],
  'abilities.frostRingCooldownMs': [0, 42000, 10],
  'abilities.blinkWindupMs': [0, 4000, 10],
  'abilities.blinkRecoveryMs': [0, 4000, 10],
  'abilities.blinkDistance': [0, 21, 0.1],
  'abilities.blinkCritMultiplier': [0, 5, 0.05],
  'abilities.blinkCooldownMs': [0, 30000, 10],
  'targeting.coneDeg': [10, 180, 1],
  'targeting.meleeRange': [1, 10, 0.1],
  'targeting.rangedRange': [5, 50, 0.5],
  'targeting.lungeStopShort': [0, 3, 0.05],
  'targeting.lungeMagnetM': [0, 5, 0.05],
  'targeting.boltHomingDeg': [0, 90, 1],
  'targeting.boltHomingRateDeg': [10, 720, 10],
  'lockOn.range': [5, 60, 0.5],
  'lockOn.acquireConeDeg': [10, 180, 1],
  'lockOn.cameraYawRate': [0.5, 30, 0.5],
  'lockOn.framing': [0, 1, 0.01],
  'lockOn.flickDeg': [1, 45, 0.5],
  'lockOn.flickWindowMs': [50, 1000, 10],
  'lockOn.breakDistance': [5, 80, 0.5],
  'lockOn.reticleRate': [1, 60, 1],
  'camera.shoulderOffset': [0, 2, 0.05],
  'camera.shoulderRate': [1, 30, 0.5],
  'camera.shoulderZoom': [0.4, 1.2, 0.05],
  'camera.aimRange': [10, 80, 1],

  'combat.heroHurtMs': [0, 2000, 10],
  'combat.stepHeight': [0, 1, 0.01],
  'grunt.knockbackTaken': [0, 2, 0.05],
  'archer.maxHp': [0, 135, 0.1],
  'archer.maxPoise': [0, 12, 0.1],
  'archer.radius': [0, 10, 0.1],
  'archer.height': [0, 10, 0.1],
  'archer.moveSpeed': [0, 10, 0.1],
  'archer.turnRateDeg': [0, 360, 1],
  'archer.aimMs': [0, 3000, 10],
  'archer.aimTrackFrac': [0, 2, 0.01],
  'archer.shootRecoverMs': [0, 3000, 10],
  'archer.cooldownMs': [0, 7800, 10],
  'archer.arrowSpeed': [0, 72, 0.1],
  'archer.damage': [0, 24, 0.1],
  'archer.fleeDistance': [0, 13.5, 0.1],
  'archer.floorRange': [4, 40, 0.5],
  'archer.spawnMs': [0, 3000, 10],
  'archer.deathMs': [0, 4800, 10],
  'archer.knockbackTaken': [0, 2, 0.01],
  'brute.maxHp': [0, 960, 5],
  'brute.maxPoise': [0, 66, 0.1],
  'brute.radius': [0, 10, 0.1],
  'brute.height': [0, 10, 0.1],
  'brute.moveSpeed': [0, 10, 0.1],
  'brute.turnRateDeg': [0, 360, 1],
  'brute.slamRange': [0, 10, 0.1],
  'brute.slamOffset': [0, 10, 0.1],
  'brute.slamRadius': [0, 10, 0.1],
  'brute.telegraphMs': [0, 3000, 10],
  'brute.trackFrac': [0, 2, 0.01],
  'brute.slamActiveMs': [0, 3000, 10],
  'brute.recoveryMs': [0, 4200, 10],
  'brute.cooldownMs': [0, 4500, 10],
  'brute.damage': [0, 84, 0.1],
  'brute.knockbackDealt': [0, 10, 0.1],
  'brute.spawnMs': [0, 3000, 10],
  'brute.deathMs': [0, 6000, 10],
  'brute.knockbackTaken': [0, 2, 0.01],
  'warden.maxHp': [0, 4200, 5],
  'warden.maxPoise': [0, 120, 0.1],
  'warden.radius': [0, 10, 0.1],
  'warden.height': [0, 10, 0.1],
  'warden.moveSpeed': [0, 10, 0.1],
  'warden.turnRateDeg': [0, 360, 1],
  'warden.sweepRange': [0, 13.8, 0.1],
  'warden.sweepRadius': [0, 15.6, 0.1],
  'warden.sweepArcDeg': [0, 360, 1],
  'warden.sweepTelegraphMs': [0, 3000, 10],
  'warden.sweepActiveMs': [0, 3000, 10],
  'warden.sweepRecoveryMs': [0, 3000, 10],
  'warden.sweepDamage': [0, 66, 0.1],
  'warden.slamOffset': [0, 10, 0.1],
  'warden.slamRadius': [0, 10, 0.1],
  'warden.slamTelegraphMs': [0, 3600, 10],
  'warden.slamActiveMs': [0, 3000, 10],
  'warden.slamRecoveryMs': [0, 3300, 10],
  'warden.slamDamage': [0, 96, 0.1],
  'warden.farSlamDistance': [0, 24, 0.1],
  'warden.farSlamMaxRange': [0, 33, 0.1],
  'warden.cooldownMs': [0, 3300, 10],
  'warden.phase2CooldownMs': [0, 3000, 10],
  'warden.phase2TelegraphScale': [0, 2, 0.01],
  'warden.phase2SpeedScale': [0.5, 3, 0.05],
  'warden.roarMs': [0, 4800, 10],
  'warden.summonCount': [0, 12, 1],
  'warden.knockbackDealt': [0, 10, 0.1],
  'warden.spawnMs': [0, 4500, 10],
  'warden.deathMs': [0, 9000, 10],
  'warden.knockbackTaken': [0, 2, 0.01],
  'flow.max': [30, 900, 30],
  'flow.beatEarlyMs': [0, 400, 10],
  'flow.beatLateMs': [0, 400, 10],
  'flow.lightOnBeat': [0, 50, 1],
  'flow.lightOffBeat': [0, 50, 1],
  'flow.heavyOnBeat': [0, 80, 1],
  'flow.heavyOffBeat': [0, 80, 1],
  'flow.repeatFrac': [0, 1, 0.05],
  'flow.perfectGain': [0, 150, 1],
  'flow.comboGain': [0, 300, 5],
  'flow.idleMs': [0, 10000, 100],
  'flow.drainPerSec': [0, 300, 5],
  'flow.tier1Speed': [0, 0.3, 0.01],
  'flow.harmonyBonus': [0, 1, 0.05],
  'flow.crescendoDamage': [1, 5, 0.1],
  'village.maxTier': [1, 10, 1],
  'village.upgradeLumber': [0, 500, 5],
  'village.upgradeStone': [0, 500, 5],
  'village.upgradeCoin': [0, 1000, 10],
  'village.upgradeGrowth': [1, 5, 0.1],
  'village.stockBase': [1, 20, 1],
  'village.stockPerTier': [0, 10, 1],
  'village.stashBase': [1, 80, 1],
  'village.stashPerTier': [0, 40, 1],
  'village.pocketBase': [0, 28, 1],
  'village.pocketPerTier': [0, 7, 1],
  'village.priceBase': [1, 200, 1],
  'village.priceTierGrowth': [1, 4, 0.1],
  'village.rarePriceMult': [1, 10, 0.5],
  'village.sellShare': [0, 1, 0.05],
  'village.respecCoinPerPoint': [0, 200, 1],
  'loop.depthBonus': [0, 1, 0.05],
  'loop.coinPerRoom': [0, 100, 1],
  'loop.lumberPerRoom': [0, 40, 1],
  'loop.stonePerRoom': [0, 40, 1],
  'loop.bossCoin': [0, 500, 5],
  'loop.bossLumber': [0, 100, 1],
  'loop.bossStone': [0, 100, 1],
  'loop.smashLumberMin': [0, 10, 1],
  'loop.smashLumberMax': [0, 10, 1],
  'loop.smashStoneMin': [0, 10, 1],
  'loop.smashStoneMax': [0, 10, 1],
  'loop.smashCoinChance': [0, 1, 0.05],
  'loop.smashCoinMin': [0, 50, 1],
  'loop.smashCoinMax': [0, 50, 1],
  'loop.smashSpray': [0.3, 3, 0.1],
  'loop.smashSettleMs': [0, 1500, 50],
  'loop.lootRadius': [0.3, 3, 0.1],
  'loop.potionChance': [0, 1, 0.01],
  'loop.potionHeal': [0, 1, 0.05],
  'loop.potionMax': [0, 9, 1],
  'loop.potionCooldownMs': [0, 5000, 50],
  'run.introMs': [0, 4500, 10],
  'run.gateWaitMs': [0, 30000, 500],
  'run.restMs': [0, 15000, 10],
  'run.wave1Grunts': [0, 12, 1],
  'run.wave1Archers': [0, 12, 1],
  'run.wave1Brutes': [0, 12, 1],
  'run.wave2Grunts': [0, 12, 1],
  'run.wave2Archers': [0, 12, 1],
  'run.wave2Brutes': [0, 12, 1],
  'run.wave3Grunts': [0, 12, 1],
  'run.wave3Archers': [0, 12, 1],
  'run.wave3Brutes': [0, 12, 1],
  'run.healOnWaveClear': [0, 1, 0.05],
  'run.reinforceAt': [0, 1, 0.05],
  'run.wave1ReinforceGrunts': [0, 12, 1],
  'run.wave1ReinforceArchers': [0, 3, 1],
  'run.wave1ReinforceBrutes': [0, 4, 1],
  'run.wave2ReinforceGrunts': [0, 12, 1],
  'run.wave2ReinforceArchers': [0, 3, 1],
  'run.wave2ReinforceBrutes': [0, 4, 1],
  'run.wave3ReinforceGrunts': [0, 12, 1],
  'run.wave3ReinforceArchers': [0, 3, 1],
  'run.wave3ReinforceBrutes': [0, 4, 1],
  'run.extraPlayerHealth': [0, 2, 0.01],

  'progression.xpPerDamage': [0, 10, 0.1],
  'progression.healthPerLevel': [0, 50, 1],
  'progression.level2Xp': [10, 20000, 10],
  'progression.level3Xp': [10, 20000, 10],
  'progression.level4Xp': [10, 30000, 10],
  'progression.level5Xp': [10, 40000, 10],
  'progression.level4DamageBonus': [0, 1, 0.01],
  'progression.levelGapGrowthXp': [0, 5000, 50],
  'progression.maxLevel': [5, 50, 1],
  'progression.glowLevel': [2, 50, 1],
  'talents.pointsPerLevel': [0, 5, 1],
  'talents.mightDamagePerRank': [0, 0.3, 0.01],
  'champion.pointXp': [1000, 200000, 1000],
  'champion.pointXpGrowth': [0, 5000, 50],
  'champion.ceilingDamage': [0, 0.5, 0.01],
  'champion.ceilingHealth': [0, 0.5, 0.01],
  'champion.precisionDamagePerRank': [0, 0.05, 0.005],
  'champion.vitalityHealthPerRank': [0, 0.05, 0.005],
  'champion.lightstepCancelMsPerRank': [0, 20, 1],
  'champion.slotUnlockStep': [0, 10, 1],
  'champion.wideShatterRadiusMult': [1, 4, 0.1],
  'champion.teamworkBonus': [0, 1, 0.05],
  'champion.deepWoundsTicksMult': [1, 4, 0.5],
  'champion.bulwarkChipMult': [0, 1, 0.05],
  'champion.lifelineHpMult': [1, 3, 0.1],
  'champion.longFuseWindowMult': [1, 3, 0.1],
  'champion.momentumCooldownMs': [0, 6000, 250],
  'champion.magnetRadiusMult': [1, 4, 0.1],
  'talents.weightPoisePerRank': [0, 0.5, 0.01],
  'talents.finisherDamagePerRank': [0, 0.5, 0.01],
  'talents.riposteParryMsPerRank': [0, 100, 5],
  'talents.windRechargePerRank': [0, 0.2, 0.01],
  'talents.windCancelMsPerRank': [0, 40, 1],
  'talents.masteryDamagePerRank': [0, 0.1, 0.005],
  'talents.hasteSpeedPerRank': [0, 0.2, 0.01],
  'talents.armourReductionPerRank': [0, 0.2, 0.01],
  'talents.fleetSpeedPerRank': [0, 0.2, 0.01],
  'talents.focusCooldownPerRank': [0, 0.2, 0.01],
  'gear.rareChance': [0, 1, 0.05],
  'gear.armourPerTierWeight': [0, 0.05, 0.001],
  'gear.hideArmourFactor': [0, 1, 0.05],
  'gear.clothArmourFactor': [0, 1, 0.05],
  'gear.armourCap': [0, 0.9, 0.05],
  'gear.mismatchDamagePerPiece': [0, 0.2, 0.01],
  'gear.weaponDamagePerTier': [0, 0.2, 0.01],
  'gear.amuletHpPerTier': [0, 30, 1],
  'gear.ringCooldownPerTier': [0, 0.1, 0.01],
  'gear.capeDodgePerTier': [0, 0.1, 0.01],
  'gear.pickupRadius': [0.3, 4, 0.1],
  'gear.maxDropped': [1, 28, 1],
  'gear.bleedTicks': [1, 20, 1],
  'gear.bleedTickMs': [50, 2000, 10],
  'gear.bleedDamage': [0, 30, 0.5],
  'gear.chainBoltRange': [1, 20, 0.5],
  'gear.chainBoltDamageFrac': [0, 2, 0.05],
  'gear.dodgeRefundWindowMs': [0, 2000, 10],
  'gear.hunterSlowMs': [0, 6000, 100],

  'camera.distance': [2, 12, 0.1],
  'camera.zoomMin': [0.2, 1, 0.05],
  'camera.zoomMax': [1, 4, 0.05],
  'camera.zoomStep': [1.01, 1.5, 0.01],
  'camera.zoomRate': [1, 40, 0.5],
  'camera.pivotHeight': [0.5, 3, 0.05],
  'camera.fovDeg': [30, 100, 1],
  'camera.sprintFovBoostDeg': [0, 20, 0.5],
  'camera.fovBlendRate': [0.5, 30, 0.5],
  'camera.pitchMinDeg': [-89, 0, 1],
  'camera.pitchMaxDeg': [0, 89, 1],
  'camera.startPitchDeg': [-30, 60, 1],
  'camera.minDistance': [0.5, 4, 0.05],
  'camera.collisionRadius': [0.05, 1, 0.01],
  'camera.softMargin': [0, 1.5, 0.01],
  'camera.pullInRate': [1, 60, 0.5],
  'camera.pushOutRate': [0.5, 20, 0.1],
  'camera.craneMaxDeg': [60, 89, 1],
  'camera.craneRate': [0.5, 30, 0.5],
  'camera.anticipationSec': [0, 0.5, 0.01],
  'camera.orbitVelocitySmoothing': [1, 60, 0.5],
  'camera.followRate': [1, 60, 0.5],
  'camera.verticalFollowRate': [1, 60, 0.5],
  'camera.mouseSensitivity': [0.01, 0.5, 0.005],
  'camera.gamepadYawDegPerSec': [30, 600, 5],
  'camera.gamepadPitchDegPerSec': [30, 600, 5],
  'camera.occluderOpacity': [0, 1, 0.01],
  'camera.occluderFadeRate': [1, 40, 0.5],
  'camera.occluderProbeRadius': [0, 1.5, 0.01],
  'camera.nearPlane': [0.01, 1, 0.01],
  'camera.farPlane': [20, 500, 1],

  'heroAnim.strideLength': [0.5, 5, 0.05],
  'heroAnim.stepHeight': [0, 0.5, 0.01],
  'heroAnim.bobHeight': [0, 0.3, 0.005],
  'heroAnim.runLeanDeg': [0, 30, 0.5],
  'heroAnim.sprintLeanDeg': [0, 30, 0.5],
  'heroAnim.sprintStrideScale': [1, 2, 0.05],
  'heroAnim.armSwing': [0, 1.5, 0.05],
  'heroAnim.blendRate': [1, 40, 0.5],
  'heroAnim.attackFlow': [0, 1, 0.05],
  'heroAnim.landCrouch': [0, 0.4, 0.01],

  'input.stickDeadzone': [0, 0.5, 0.01],
  'input.lookStickCurve': [1, 4, 0.1],

  'look.exposure': [0.2, 3, 0.01],
  'look.maxPixelRatio': [0.5, 3, 0.25],
  'look.pixelSize': [1, 6, 1],
  'audio.masterVolume': [0, 1, 0.01],
  'audio.musicVolume': [0, 1, 0.01],
  'hitFeel.screenShake': [0, 2, 0.05],
  'look.colorLevels': [4, 64, 1],
  'look.ditherStrength': [0, 2, 0.05],
  'look.contrast': [0.5, 2, 0.01],
  'look.saturation': [0, 2, 0.01],
  'look.splitTone': [0, 1, 0.01],
  'look.aberration': [0, 4, 0.1],
  'look.vignette': [0, 1.5, 0.01],
  'look.scanlines': [0, 1, 0.01],
  'look.crtCornerPx': [0, 80, 1],
  'look.embers': [0, 600, 10],
  'look.dust': [0, 800, 10],
  'look.fogDensity': [0, 0.1, 0.001],
  'look.hemiIntensity': [0, 3, 0.01],
  'look.moonIntensity': [0, 5, 0.01],
  'look.shadowMapSize': [512, 4096, 512],
  'look.shadowRadius': [0, 12, 0.5],
  'look.torchIntensity': [0, 80, 0.5],
  'look.torchRange': [2, 40, 0.5],
  'look.torchFlicker': [0, 1, 0.01],
  'look.rimIntensity': [0, 5, 0.01],
  'look.metalEnvIntensity': [0, 3, 0.01],
  'look.bloomStrength': [0, 3, 0.01],
  'look.bloomRadius': [0, 1, 0.01],
  'look.bloomThreshold': [0, 1.5, 0.01],
  'villageLook.exposure': [0.2, 3, 0.01],
  'villageLook.contrast': [0.5, 2, 0.01],
  'villageLook.saturation': [0, 2, 0.01],
  'villageLook.splitTone': [0, 1, 0.01],
  'villageLook.vignette': [0, 1.5, 0.01],
  'villageLook.fogDensity': [0, 0.1, 0.001],
  'villageLook.hemiIntensity': [0, 3, 0.01],
  'villageLook.moonIntensity': [0, 6, 0.01],
  'villageLook.sunHeightDeg': [5, 85, 1],
  'villageLook.sunBearingDeg': [0, 360, 1],
  'villageLook.rimIntensity': [0, 5, 0.01],
  'villageLook.bloomStrength': [0, 3, 0.01],
  'villageLook.bloomRadius': [0, 1, 0.01],
  'villageLook.bloomThreshold': [0, 1.5, 0.01],
  'villageLook.embers': [0, 600, 10],
  'villageLook.dust': [0, 800, 10],

  'debug.slowMoScale': [0.05, 1, 0.05],
};

/** Snapshot of the shipped values, for the debug panel's reset button. */
export const tuningDefaults: Tuning = structuredClone(tuning);

export type Style = 'sword' | 'bow' | 'staff';
export const STYLES: readonly Style[] = ['sword', 'bow', 'staff'];
/** Full chain length; heroes unlock steps 4 and 5 with levels. */
export const CHAIN_LENGTH = 5;

/** One attack of a style's chain, in seconds and metres (durationScale applied). */
export interface ComboHit {
  windup: number;
  /** Melee: when it can hit. Ranged/magic: the release after the projectile leaves (leaps happen here). */
  active: number;
  recovery: number;
  /** Distance carried along facing during the active phase; negative leaps backward. */
  lunge: number;
  /** Damage in hit points (baseDamage x the hit's multiplier). */
  damage: number;
  poise: number;
  knockback: number;
  heavy: boolean;
  /** Sword only: hit area in front of the knight. */
  range: number;
  arcDeg: number;
}

const COMBO_TABLES: Record<Style, object> = {
  sword: tuning.meleeCombo,
  bow: tuning.rangedCombo,
  staff: tuning.magicCombo,
};

const STRING_TABLES: Record<Style, object> = {
  sword: tuning.swordStrings,
  bow: tuning.bowStrings,
  staff: tuning.staffStrings,
};

/** The string moves each weapon has (C1), by key, and what they are called. */
export const STRING_MOVES: Record<Style, Record<string, string>> = {
  sword: { H: 'Overhead cleave', LH: 'Rising cut', LLH: 'Sweeping arc', LLLH: 'Pommel break', LLLLH: 'Blade spin', HH: 'Ground slam', HHH: 'Earthsplitter', HLL: 'Whirling counter' },
  bow: { H: 'Charged shot', LH: 'Pinning shot', LLH: 'Fan', LLLH: 'Point blank', HH: 'Longshot', HHH: 'Deadeye', HLL: 'Quick volley' },
  staff: { H: 'Charged orb', LH: 'Nova', LLH: 'Great burst', LLLH: 'Twin nova', HH: 'Elemental storm', HHH: 'Cataclysm', HLL: 'Arcane flurry' },
};

/** The move a string of presses plays: its own entry, H for a heavy string without one, or none (the chain's light). */
export function stringMoveFor(style: Style, s: string): string | undefined {
  if (STRING_MOVES[style][s]) return s;
  return s.endsWith('H') ? 'H' : undefined;
}

/** A string move's attack (C1): the chain step it borrows, with its own windup, damage, poise and knockback; charge 2 hits harder. */
const FAMILY_TABLES: Record<WeaponFamily, object> = {
  warhammer: tuning.warhammerCombo,
  crossbow: tuning.crossbowCombo,
  wand: tuning.wandCombo,
};

/** Step i of a weapon family's chain (C5), with its style's borrowed reach where it has none of its own. */
export function familyHit(family: WeaponFamily, i: number, speed = 1): ComboHit {
  const c = FAMILY_TABLES[family] as Record<string, number>;
  const step = Math.max(0, Math.min(FAMILY_ANIM[family].length - 1, i));
  const k = `hit${step + 1}`;
  const scale = tuning.combo.durationScale / 1000 / speed;
  const borrowed = comboHit(FAMILY_STYLE[family], FAMILY_ANIM[family][step], speed);
  return {
    windup: c[`${k}WindupMs`] * scale,
    active: c[`${k}ActiveMs`] * scale,
    recovery: c[`${k}RecoveryMs`] * scale,
    lunge: c[`${k}LungeM`],
    damage: c[`${k}Damage`] * tuning.combat.baseDamage,
    poise: c[`${k}Poise`],
    knockback: c[`${k}KnockbackM`],
    heavy: c[`${k}Heavy`] >= 1,
    range: c[`${k}RangeM`] ?? borrowed.range,
    arcDeg: c[`${k}ArcDeg`] ?? borrowed.arcDeg,
  };
}

export function stringHit(style: Style, key: string, speed = 1, charge = 1, family?: WeaponFamily): ComboHit {
  const t = STRING_TABLES[style] as Record<string, number>;
  const k = key.toLowerCase();
  const base = comboHit(style, Math.max(0, Math.min(4, Math.round(t[`${k}Anim`]))), speed);
  const c = tuning.combo;
  const two = charge >= 2;
  return {
    ...base,
    windup: (t[`${k}WindupMs`] * c.durationScale) / 1000 / speed,
    // Charge 3 is a Crescendo (C2): a charged heavy at a full Flow meter.
    damage: t[`${k}Damage`] * tuning.combat.baseDamage * (two ? c.charge2Damage : 1) * (charge >= 3 ? tuning.flow.crescendoDamage : 1),
    poise: t[`${k}Poise`] * (two ? c.charge2Poise : 1),
    knockback: t[`${k}KnockbackM`],
    heavy: t[`${k}Heavy`] >= 1,
    ...(family ? familyHeavy(family, t[`${k}WindupMs`], t[`${k}Damage`], t[`${k}Poise`], speed, charge) : {}),
  };
}

/** A family's take on its style's string move (C5): its damage, poise and windup scaled. */
function familyHeavy(family: WeaponFamily, windupMs: number, damage: number, poise: number, speed: number, charge: number): Partial<ComboHit> {
  const f = tuning.families as Record<string, number>;
  const c = tuning.combo;
  const dmg = f[`${family}HeavyDamage`];
  return {
    windup: (windupMs * f[`${family}HeavyWindup`] * c.durationScale) / 1000 / speed,
    damage: damage * dmg * tuning.combat.baseDamage * (charge >= 2 ? c.charge2Damage : 1) * (charge >= 3 ? tuning.flow.crescendoDamage : 1),
    poise: poise * dmg * (charge >= 2 ? c.charge2Poise : 1),
  };
}

/** The chain step a string move borrows its pose and projectiles from. */
export function stringAnim(style: Style, key: string): number {
  return Math.max(0, Math.min(4, Math.round((STRING_TABLES[style] as Record<string, number>)[`${key.toLowerCase()}Anim`])));
}

/** Read hit i (0-based) of a style's chain from tuning. speed > 1 shortens every phase (haste talent). */
export function comboHit(style: Style, i: number, speed = 1): ComboHit {
  const c = COMBO_TABLES[style] as Record<string, number>;
  const k = `hit${i + 1}`;
  const scale = tuning.combo.durationScale / 1000 / speed;
  return {
    windup: c[`${k}WindupMs`] * scale,
    active: c[`${k}ActiveMs`] * scale,
    recovery: c[`${k}RecoveryMs`] * scale,
    lunge: c[`${k}LungeM`],
    damage: c[`${k}Damage`] * tuning.combat.baseDamage,
    poise: c[`${k}Poise`],
    knockback: c[`${k}KnockbackM`],
    heavy: c[`${k}Heavy`] >= 1,
    range: c[`${k}RangeM`] ?? 0,
    arcDeg: c[`${k}ArcDeg`] ?? 0,
  };
}

export type AbilityKind = 'charge' | 'whirlwind' | 'volley' | 'disengage' | 'frostRing' | 'blink' | 'bash' | 'ward' | 'deflect' | 'quickShot';

/** What an off-hand is (C4, C5): its ability is the third, on 3. */
export type OffhandKind = 'shield' | 'tome' | 'buckler' | 'handCrossbow';
export const OFFHAND_ABILITY: Record<OffhandKind, AbilityKind> = { shield: 'bash', tome: 'ward', buckler: 'deflect', handCrossbow: 'quickShot' };

/**
 * Weapon families (C5; Michael, 28 Oct): more than one weapon to a style. A family fights its style's
 * fight (its levels, talents and strings) with a chain of its own, each step borrowing the pose and
 * the projectiles of one of its style's chain steps (FAMILY_ANIM).
 */
export type WeaponFamily = 'warhammer' | 'crossbow' | 'wand';
export const FAMILY_STYLE: Record<WeaponFamily, Style> = { warhammer: 'sword', crossbow: 'bow', wand: 'staff' };
export const FAMILY_ANIM: Record<WeaponFamily, readonly number[]> = { warhammer: [2, 3, 4], crossbow: [0, 1, 2], wand: [0, 1, 0, 1, 0] };
/** Arrows in the ammo slot (C4): frost slows, barbed charged shots bleed. */
export type AmmoKind = 'frost' | 'barbed';

/** Q and E for each hero (brief: "Abilities"). */
export const ABILITIES: Record<Style, [AbilityKind, AbilityKind]> = {
  sword: ['charge', 'whirlwind'],
  bow: ['volley', 'disengage'],
  staff: ['frostRing', 'blink'],
};

export const ABILITY_NAMES: Record<AbilityKind, string> = {
  charge: 'Charge',
  whirlwind: 'Whirlwind',
  volley: 'Volley',
  disengage: 'Disengage',
  frostRing: 'Frost ring',
  blink: 'Blink',
  bash: 'Shield bash',
  ward: 'Ward',
  deflect: 'Deflect',
  quickShot: 'Quick shot',
};

/** An ability's phases in seconds: the effect fires at the end of the windup, then active, then recovery. */
export function abilityTiming(kind: AbilityKind): { windup: number; active: number; recovery: number; cooldown: number } {
  const a = tuning.abilities as unknown as Record<string, number>;
  const ms = (k: string) => (a[`${kind}${k}`] ?? 0) / 1000;
  const active = kind === 'charge' ? ms('DashMs') : ms('DurationMs');
  return { windup: ms('WindupMs'), active, recovery: ms('RecoveryMs'), cooldown: ms('CooldownMs') };
}

export type EnemyKind = 'grunt' | 'archer' | 'brute' | 'warden';

/** Stats every enemy kind has, read from its tuning section. */
export interface EnemyStats {
  maxHp: number;
  maxPoise: number;
  radius: number;
  height: number;
  moveSpeed: number;
  turnRateDeg: number;
  spawnMs: number;
  deathMs: number;
  knockbackTaken: number;
}

export function enemyStats(kind: EnemyKind): EnemyStats {
  return tuning[kind];
}

for (const section of ['swordStrings', 'bowStrings', 'staffStrings'] as const) {
  for (const key of Object.keys(tuning[section])) {
    const path = `${section}.${key}`;
    if (key.endsWith('Anim')) tuningRanges[path] = [0, 4, 1];
    else if (key.endsWith('WindupMs')) tuningRanges[path] = [0, 1000, 10];
    else if (key.endsWith('Damage')) tuningRanges[path] = [0, 6, 0.05];
    else if (key.endsWith('Poise')) tuningRanges[path] = [0, 15, 0.1];
    else if (key.endsWith('KnockbackM')) tuningRanges[path] = [0, 8, 0.1];
    else if (key.endsWith('Heavy')) tuningRanges[path] = [0, 1, 1];
  }
}
