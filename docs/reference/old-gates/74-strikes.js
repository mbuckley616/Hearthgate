// Tier-scaled spell audio. Tier 1 is the base SFX. Tier 2 adds richer harmonics.
// Tier 3 adds a sub-bass impact + layered overtones, so Mastery casts FEEL physical.
// Gain multipliers (1.0 / 1.3 / 1.7) mirror the damage scalars — audio presence tracks mechanical presence.
// ═══════════════════════════════════════════════════════════════════════
// Monster Overhaul Session 1 — Damage pipeline
// ═══════════════════════════════════════════════════════════════════════
// All spell hits route through applySpellDamage → resist multiplier → buff mults → flat def subtraction → floor at 1.
// Smól Mastery (The Quiet-Sent-Out) bypasses def but respects resist. Other Mastery traits are unaffected by this pipeline.
// Melee hits use applyMeleeDamage — simpler: buff mults → flat def → floor at 1, no resist (no elemental school).

function applySpellDamage(e, sp, tier){
  const baseDmg = spellMag(sp,tier) + Math.floor(foeRand(e)*10) + level*(sp.dmgLvl||3); // S480 — the spread on the struck foe's stream
  const resistMult = (e.resist && e.resist[sp.school] !== undefined) ? e.resist[sp.school] : 1.0;
  // Dormant enemies (Gargoyle statue form) take 2× damage — rewards the player for spotting and attacking first.
  const dormantMult = e.dormant ? 2.0 : 1.0;
  // v61au: Intelligence scales spell damage. +1% per point (S173; was 3%), parallel to
  // Might's melee scaling. Staff weapons add a small passive (spellPower
  // field on EQ.weapon, currently +5% on Wooden Staff). Both stack
  // multiplicatively with the existing buff multipliers.
  const intMult = 1 + attrEff('intelligence') * ATTR_DMG_PER_POINT;
  const weaponSpellMult = (EQ.weapon && EQ.weapon.spellPower) || 1.0;
  const afterMults = baseDmg * resistMult * dormantMult * intMult * weaponSpellMult * _buffMult('spellDmg',1) * _buffMult('magicDmg',1);
  // Smól Mastery — The Quiet-Sent-Out: ignores armor entirely. Resist still applies.
  const defPierced = (sp.id==='smol' && tier===3);
  const effDef = defPierced ? 0 : (e.def || 0);
  const dmg = Math.max(1, Math.round(afterMults) - effDef);
  return {dmg, resistMult, defPierced};
}

function applyMeleeDamage(e, rawDmg){
  if(_exhaustedStrike)rawDmg=Math.max(1,Math.floor(rawDmg*.45)); // v80 S9 — exhausted swings land soft
  const effDef = e.def || 0;
  // Dormant enemies take 2× damage here too — consistent behavior across melee and magic.
  const dormantMult = e.dormant ? 2.0 : 1.0;
  // Physical damage-type resistance. Weapon's wType ('slash'/'pierce'/'blunt') looked up in enemy.resist.
  // Undead resist pierce; stone creatures resist slash; ethereals resist all physical; blunt shatters bones/stone.
  const wType = weaponDamageType(EQ.weapon);
  const physResistMult = (e.resist && e.resist[wType] !== undefined) ? e.resist[wType] : 1.0;
  // v61gj — Staggered-crit bonus. Striking an enemy currently in the staggered[]
  // list applies POSTURE_CRIT_MULT (×1.5) before resist + def. This is the payoff
  // the parry-into-staggered-crit chain delivers, and the reward Bram's dialog
  // ("a perfect parry costs you nothing and staggers the attacker") has been
  // promising since v61c6. Posture-break triggers the same staggered[] entry, so
  // posture-break also unlocks the crit bonus — both routes feel rewarding.
  const _nowS = performance.now()/1000, _fin = finisherOpen(e,_nowS), _rip = !_fin && riposteOpen(e);
  const staggerMult = _fin ? FINISHER_MULT : _rip ? RIPOSTE_MULT : isStaggered(e) ? POSTURE_CRIT_MULT : 1.0;
  if(_fin){ e._finUntil = 0; e._ripUntil = -1e9; FINISHER_SAFE_UNTIL = _nowS + FINISHER_SAFE_S; }
  if(_rip) e._ripUntil = -1e9;
  // v63 — Backstab multiplier (Combat Redesign Session 2). Stacks
  // multiplicatively with staggerMult so dagger + parry-staggered enemy
  // = ×3.0 × ×1.5 = ×4.5, the canonical burst-window combo. See
  // applyBackstab for the trigger rules and exclusion list.
  const backstabMult = applyBackstab(e);
  const luckMult = _fortuneCrit(e);
  const dmg = Math.max(1, Math.round(rawDmg * dormantMult * physResistMult * staggerMult * backstabMult * luckMult) - effDef);
  return {dmg, resistMult: physResistMult, wType, crit: staggerMult > 1.0 || luckMult > 1.0, lucky: luckMult > 1.0, backstab: backstabMult > 1.0, riposte: _rip, finisher: _fin};
}

// Execute a dungeon enemy's melee strike AFTER its telegraph has completed. Re-checks range so
// a player kiting away during the wind-up causes a whiff (lunge animation + swing SFX, no damage).
// Handles perfect-parry / late-block / unblocked-hit branches just like the old inline block.
// Shared strike resolver — handles the parry/late-block/unblocked three-way branch.
// Extracted from executeDungeonStrike in v61l so zone combat can share it. Pre-v61l,
// the zone path in tickZoneEnemies applied straight damage with no `blocking` check,
// so raising guard on the overworld was cosmetic — stamina drained, damage didn't.
// Callers compute their own rawDmg (dungeon and zone have independently tuned formulas)
// and pass it in; this function handles everything downstream of that.
// S275 — an enemy's blow lands in an arc about the way it faced when it wound up (combatYaw, frozen at the wind-up):
// 1.6 units and 90° for most, 2.4 units and 140° for a troll's sweep, a boss's own reach where it has one. Before, it
// hit anyone within 1.4 units (1.3 in a dungeon) whichever way it faced.
const STRIKE_ARC={reach:1.6,deg:90},STRIKE_SWEEP={reach:2.4,deg:140};
function strikeArc(e){
  if(/Troll/.test(e.baseType||e.name||''))return STRIKE_SWEEP;
  if(e.isBoss&&e.bossDef&&e.bossDef.biteRange)return {reach:Math.max(STRIKE_ARC.reach,e.bossDef.biteRange),deg:STRIKE_ARC.deg};
  return STRIKE_ARC;
}
function strikeReaches(e,arc){
  arc=arc||strikeArc(e);
  const dx=px-e.x,dz=pz-e.z,d=Math.hypot(dx,dz);
  if(d>arc.reach)return false;
  if(typeof e.combatYaw!=='number'||d<.35)return true;
  return (dx*Math.sin(e.combatYaw)+dz*Math.cos(e.combatYaw))/d>=Math.cos(arc.deg*Math.PI/360);
}
function executeStrike(e, rawDmg, now){
  // S275 — mid-roll you are not there to be hit
  if(rollUntouchable(now/1000)){sndSwing();e._lunge=.3;showMsg(`${e.name} strikes empty air.`,'#c8b880');return;}
  const sh = EQ.offhand;
  const hasShield = sh && sh.shieldType==='shield';
  // v65 — Block reduction tier (canon order):
  //   Shield equipped              → sh.block or .65 (full defense)
  //   2H weapon w/ blockReduce     → weapon.blockReduce (steel 2H: .50, wood: .40)
  //   1H no shield, or bare hand   → BLOCK_REDUCE_NO_SHIELD (.35)
  // The 2H block tier is unlocked at equip time by WEAPON_TYPES.blockReduce
  // being set. Without the field (1H entries), this falls through to the
  // bare-hand path. Encodes the "half-sword / haft-parry" canon: claymores
  // half-sword to parry, great axes / war hammers parry with their hafts.
  const w2hBlock = (!hasShield && EQ.weapon && EQ.weapon.blockReduce) || 0;
  const shieldBlock = hasShield ? (sh.block||.65) : (w2hBlock || BLOCK_REDUCE_NO_SHIELD);
  const bareBlock = BLOCK_REDUCE_NO_SHIELD;
  // v61c7 — Resolve scaling applied to ALL block-related stamina costs
  // (parry, late block). Mirrors the passive-block-drain Resolve mult:
  // each Resolve point cuts 5% off the cost, floored at 50% at Resolve 10.
  // Pre-v61c7, Resolve only helped passive holding — actual block events
  // (parries, late blocks) ignored Resolve entirely. Sentinel-style builds
  // now get a real defensive payoff in sustained multi-attacker fights.
  const _resolveMult = Math.max(0.5, 1 - (ATTRS.resolve||0)*0.05);
  // v61gj-a2 — Parry window. Pre-v61gj-a2 the parry branch was simply `if(blocking)`,
  // which meant holding the block button locked in a perfect parry on every incoming
  // hit (no timing required, no skill check). Bram's canon dialog ("block early, not
  // late — a perfect parry, blocking BEFORE the blow lands, costs you nothing and
  // staggers the attacker") promised a skill mechanic the implementation didn't
  // deliver. Now: parry only fires if the block was raised within the last N seconds,
  // where N = 200ms base + 10ms per Finesse point. Holding past the window falls
  // through to the held-block branch (the previously-named "late block" branch,
  // which has been dead code since v61c6 because the parry branch always ate first).
  const _parryWindow = PARRY_WINDOW_BASE + attrEff('finesse') * PARRY_WINDOW_FINESSE;
  const _justRaisedBlock = (playClockS - lastBlockAttemptG) < _parryWindow;
  if(blocking && _justRaisedBlock){
    // PERFECT PARRY — block raised within the timing window before the hit landed
    hurtT = 0;
    sndParry(); blockFlashT = 0.55; blockFlashCol = '#ffd700';
    let _parryBroke = false;
    if(typeof e.posture==='number' && !isStaggered(e)) _parryBroke = applyPostureDamage(e, (e.maxPosture||0)*RIPOSTE_POSTURE, now/1000);
    staggered.push({e, t:_parryBroke?POSTURE_BREAK_STUN:1.2});
    e._ripAt = now/1000; e._ripUntil = now/1000 + RIPOSTE_S;
    e.atkCd = 2.0;
    // v61d1 — Route the stagger flash through enemyBodyMesh(e) instead of
    // mesh.children[0]. Pre-v61d1 this was children[0].material assignment,
    // which silently absorbed on humanoid/brute/wolf-shaped enemies (their
    // children[0] is a leg-pivot Group). The yellow flash now actually
    // renders on the torso of every enemy shape — goblins, trolls, the
    // Faolchú, the lessers — bringing the visual into parity with the
    // sndParry audio cue that had been carrying the feedback alone.
    const _staggerBody = enemyBodyMesh(e);
    if(_staggerBody){
      const staggerMat = new THREE.MeshLambertMaterial({color:0xffdd44, emissive:0x664400});
      _staggerBody.material = staggerMat;
      setTimeout(()=>{
        if(e.dead) return;
        const _restoreBody = enemyBodyMesh(e);
        if(_restoreBody) _restoreBody.material = new THREE.MeshLambertMaterial({color:e._origCol||0x909090});
      }, 1200);
    }
    sndParry();
    showMsg(`⚡ Perfect Parry! ${e.name} staggered — riposte!`, '#ffd700');
    lvAct.parries++;
    // v61gj-a2 — Shield/sword recoil. Forward kick — you deflected the strike outward.
    shieldImpact('parry', rawDmg, e.x, e.z);
    // v61c7 — Parry stamina cost rebalanced. WAS rawDmg (100% — meaning a
    // 32-dmg Faolchú bite parried cost 32 stamina, more than a sloppy
    // late-block at 65% of raw). That punished perfect timing. NOW: 20%
    // of raw damage as the base cost, then Resolve scaling on top. So a
    // 32-dmg parry costs 6.4 stamina at Resolve 0, ~3 at Resolve 10.
    // Floor of 1 prevents zero-cost parries against very weak attacks.
    // Math.round before Math.max so the result is always an integer.
    const parryStamCost = Math.max(1, Math.round(rawDmg * 0.20 * _resolveMult));
    stamina = Math.max(0, stamina - parryStamCost);
    if(stamina===0){ staminaCD = 2; lvAct.staminaDepleted++; }
  } else if(blocking || (now/1000 - lastHitT < 0.5 && now/1000 - lastBlockAttemptT < 0.5)){
    // HELD BLOCK — partial damage reduction. v61gj-a2 expanded this branch from
    // "recently-pressed block (within 0.5s of a hit)" to ALSO cover "currently
    // holding block but missed the parry window." Pre-v61gj-a2 this branch was
    // dead code in practice — the parry branch always ate first when `blocking`
    // was true. Now it's the proper "tank" state: shield up, damage reduced,
    // stamina cost based on absorbed damage. Also covers the original case
    // (player pressed-then-released block in the moments around a hit landing).
    // v65 — shieldBlock now encodes the full block tier (shield > 2H > bare/1H),
    // so we use it directly. The old `hasShield ? shieldBlock : bareBlock`
    // ternary collapsed back into shieldBlock for shield wielders and bareBlock
    // for everyone else — the new tier system handles all cases uniformly.
    const reduction = _blockBoost(shieldBlock);
    const blockedDmg = Math.max(1, Math.round(rawDmg*(1-reduction)));
    const absorbed = rawDmg - blockedDmg;
    const finalDmg = _warded(blockedDmg, e);
    PHP = Math.max(0, PHP-finalDmg); hurtT = .3; lvAct.damageTaken += finalDmg;
    // v61c7 — Held block stamina also scales with Resolve (was raw `absorbed`).
    // Held block stays MORE expensive than parry (because 0.65 absorbed beats
    // 0.20 parry baseline at any Resolve level), so perfect timing remains the
    // cheaper choice — incentive to read the telegraph and time the press, not
    // just turtle.
    const lateBlockStamCost = Math.max(1, Math.round(absorbed * _resolveMult));
    stamina = Math.max(0, stamina - lateBlockStamCost);
    if(stamina===0){ staminaCD = 2; lvAct.staminaDepleted++; }
    sndBlock(); blockFlashT = 0.4; blockFlashCol = '#4488ff';
    // v65 — Block-source hint in the toast: shield > 2H weapon > bare-hand/1H.
    // Lets the player feel the tier they're in without opening the hub.
    const _blockHint = hasShield ? '' : (w2hBlock ? ` — ${EQ.weapon.name} hafts the blow` : ' — equip a shield for better protection!');
    showMsg(`🛡 Blocked! ${e.name} hits for ${finalDmg} (reduced)${_blockHint}`, '#88aaff');
    playerPostureHit(rawDmg, now/1000, true); // S281 — after the toast, so a guard that breaks says so
    // v61gj-a2 — Shield/sword recoil. Backward push — you absorbed the blow.
    shieldImpact('block', rawDmg, e.x, e.z);
    if(PHP<=0 && !dead) playerDead();
  } else {
    // Unblocked hit — apply damage reduction buffs
    const finalDmg = _warded(rawDmg, e);
    PHP = Math.max(0, PHP-finalDmg); hurtT = .5;
    sndPlayerHurt(); lvAct.damageTaken += finalDmg;
    lastHitT = now/1000;
    showMsg(`${e.name} hits you for ${finalDmg}!`, '#ff4444');
    playerPostureHit(rawDmg*1.5, now/1000, false); // S281
    e._lunge=.3; // v80 — every strike moves the body
    if(PHP<=0 && !dead) playerDead();
  }
}

function executeDungeonStrike(e, now){
  const dx2 = px - e.x, dz3 = pz - e.z, dd = Math.hypot(dx2, dz3) || 1;
  e.atkCd = 1.0;
  e.atkDir = {x: dx2/dd, z: dz3/dd};
  e.atkAnim = 0.35;
  // Whiff — player stepped out of reach during wind-up, or out of its arc (S275). Enemy still commits to the lunge.
  if(!strikeReaches(e)){ sndSwing(); return; }
  // v61d5 — Mimic burst-pounce branch. The first strike after reveal uses
  // the burst formula (14 + level + dmgMult, scaled by .3 of def) instead
  // of the standard melee roll. This is the "pounced from a chest" hit —
  // higher than normal melee, lower than the pre-v61d5 unblockable burst
  // because executeStrike now runs the full block/parry pipeline. The
  // _burstNext flag is one-shot: cleared after the strike, so subsequent
  // attacks from this revealed mimic are normal melee.
  if(e._burstNext){
    e._burstNext = false;
    const def2 = _armour();
    const burstRaw = Math.max(1, Math.round((14 + level * 1.0) * (e.dmgMult||1.0)));
    const burstDmg = Math.max(1, burstRaw - Math.floor(def2 * 0.3));
    executeStrike(e, burstDmg, now);
    return;
  }
  const def2 = _armour();
  const rawDmg = Math.max(1, Math.round((10 + Math.floor(foeRand(e)*11) - Math.floor(def2*.5)) * (e.dmgMult||1.0)));
  executeStrike(e, rawDmg, now);
}

// v61d5 — Mimic E-press reveal. Replaces the v61c-era proximity landmine.
// Player walks up, sees the "Press E to open chest" prompt (issued from
// the iprEl logic which now finds disguised mimics in addition to real
// chests), presses E, and THIS function fires: reveal visuals, cry, burst
// telegraph. The actual burst hit lands when the telegraph completes via
// the _burstNext branch in executeDungeonStrike. Player has a block
// window between the cry and the strike, matching every other enemy in
// the game. The "betrayal" of opening a chest-that-wasn't is preserved —
// the mimic still gets a high-damage opening hit, but it's fair.
function revealMimic(e){
  if(!e || !e.disguised) return;
  e.disguised = false;
  e.alert = true;
  e.hasCried = true;
  if(typeof sndEnemyCry==='function') sndEnemyCry('Mimic');
  if(e.limbs){
    if(e.limbs.revealEye) e.limbs.revealEye.visible = true;
    if(e.limbs.revealTeeth){ e.limbs.revealTeeth.visible = true; (e.limbs.revealTeeth.userData.rows||[]).forEach(m=>m.visible=true); }
    if(e.limbs.revealEyeGl) e.limbs.revealEyeGl.intensity = 1.4;
    if(e.limbs.hpBg) e.limbs.hpBg.visible = true;
  }
  if(e.hpFg) e.hpFg.visible = true;
  // Restore aura so the revealed monster has presence
  e.el.intensity = 0.7;
  showMsg('The chest was a Mimic!', '#ff4444');
  // Start the burst telegraph. Mimic's existing 0.32 wind-up is enough to
  // give a block-time read, and the _burstNext flag tells executeDungeonStrike
  // to use the burst formula on resolution.
  e.telegraphMax = telegraphDuration(e);
  e.telegraphT = e.telegraphMax;
  e._burstNext = true;
  if(typeof sndTelegraph==='function') sndTelegraph();
}

// S404 — the cavern master's slam (Michael's A on #95). Every 8–10 s, with you within six units, a lair's master
// (lairFinish sets e.master) stops, winds up for 0.9 s in the shared tell (the pose from e._wind, the glow in the last
// .15 s) while a ring of its reach shows on the floor, and strikes the ground. Anyone inside the 3-unit ring takes twice
// its ordinary blow, and no shield, block or parry takes any of it: be out of the ring, or mid-roll in the roll's
// untouchable window, when it lands. A staggered master loses its slam. Returns true while the slam is wound up, so the
// loop holds the master still and starts no other blow.
const SLAM_TELL=.9,SLAM_R=3,SLAM_NEAR=6,SLAM_EVERY=[8,10];
function slamEvery(e){return SLAM_EVERY[0]+foeRand(e)*(SLAM_EVERY[1]-SLAM_EVERY[0]);}
function slamBlow(e){const def2=_armour();return 2*Math.max(1,Math.round((10+Math.floor(foeRand(e)*11)-Math.floor(def2*.5))*(e.dmgMult||1)));}
function slamRing(e){
  if(!e._slamRing){const m=new THREE.Mesh(new THREE.RingGeometry(SLAM_R-.22,SLAM_R,48),new THREE.MeshBasicMaterial({color:0xff5a30,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.visible=false;e._slamRing=m;}
  const r=e._slamRing;if(r.parent!==dScene)dScene.add(r);r.position.set(e.x,(e.floor===2?FLOOR2_Y:0)+.04,e.z);return r;}
function slamCancel(e){e._slamT=0;telegraphReset(e);if(e._slamRing)e._slamRing.visible=false;e._slamCd=slamEvery(e);}
function tickMasterSlam(e,dt,dist,now){
  if(!e.master||e.dead)return false;
  if(e._slamCd==null)e._slamCd=slamEvery(e);
  if(e._slamT>0){
    if(isStaggered(e)){slamCancel(e);return false;}
    e._slamT-=dt;const p=1-Math.max(0,e._slamT)/SLAM_TELL;
    e.telegraphMax=SLAM_TELL;telegraphPulse(e,p);
    const r=slamRing(e);r.visible=true;r.material.opacity=.15+.55*p;
    if(e._slamT>0)return true;
    e._slamT=0;telegraphReset(e);r.visible=false;e.atkCd=Math.max(e.atkCd||0,1.2);e._slamCd=slamEvery(e);e._slams=(e._slams||0)+1;
    if(typeof sfxNoise==='function')sfxNoise(.5,0,0,.32,220);
    const d=Math.hypot(px-e.x,pz-e.z);
    if(d>=SLAM_R){e._slamLast='clear';showMsg('The ground cracks where you stood.','#c8e88a');return false;}
    if(rollUntouchable(now/1000)){e._slamLast='rolled';showMsg('You roll through the blow.','#c8e88a');return false;}
    const dmg=_warded(slamBlow(e),e);PHP=Math.max(0,PHP-dmg);hurtT=.5;lastHitT=now/1000;lvAct.damageTaken+=dmg;e._slamLast=dmg;
    if(typeof sndPlayerHurt==='function')sndPlayerHurt();updateHUD();
    showMsg(`${e.name} slams the ground under you: ${dmg}.`,'#ff6060');
    if(PHP<=0&&!dead)playerDead();
    return false;}
  if(!e.alert||e.disguised||e.dormant)return false;
  e._slamCd-=dt;
  if(e._slamCd>0||dist>=SLAM_NEAR||e.telegraphT>0||isStaggered(e))return false;
  e._slamT=SLAM_TELL;e.telegraphMax=SLAM_TELL;e.path=[];
  if(typeof sndTelegraph==='function')sndTelegraph();
  showMsg(`${e.name} rears up to strike the ground.`,'#ffb060');
  slamRing(e).visible=true;
  return true;}

// Returns a display tag showing notable resist/def interaction, or '' if fully neutral.
// Priority: defPierced (Smól Mastery) > strong weak/resist > mild weak/resist > neutral.
function dmgTag(info, e){
  if(info.defPierced && (e.def||0) > 0) return ' (Armor pierced!)';
  if(info.resistMult >= 1.45) return ' (Very weak!)';
  if(info.resistMult >= 1.25) return ' (Weak!)';
  if(info.resistMult <= 0.55) return ' (Heavily resisted)';
  if(info.resistMult <= 0.75) return ' (Resisted)';
  return '';
}

// ═══════════════════════════════════════════════════════════════════════
// Monster Overhaul Session 2 — Variants + Spawn Gating
// ═══════════════════════════════════════════════════════════════════════
// Variants are runtime overlays applied to base enemy defs at spawn time. Each variant has:
//   - stat multipliers (hp/dmg/scale/xp) and flat additions (def)
//   - color tint (RGB multiplier, clamped 0-1) for visual differentiation
//   - resist overlay merged onto the base enemy's resist map
//   - gating (minLevel + optional minDiff) and spawn chance
// Variants are tested rarest-first so a qualifying Wraith can roll Frost or Shadow before falling through to Greater.
// Name prefix ('Greater Cave Troll', 'Frost Wraith') flows through kill/damage messages AND counts as a separate
// first-kill entry — seenEnemyTypes keys on the full prefixed name.

const DIFF_ORDER = ['veryeasy','easy','normal','hard','veryhard'];
function isDifficultyAtLeast(current, min){
  return DIFF_ORDER.indexOf(current||'normal') >= DIFF_ORDER.indexOf(min);
}

const VARIANTS = {
  greater: {
    label: 'Greater',
    minLevel: 5,
    minDiff: null,
    chance: 0.10,
    eligible: null, // null = any base enemy
    hp: 1.5, dmg: 1.25, scale: 1.15, def: 1, xp: 1.5,
    tintRGB: [0.8, 0.8, 0.8], // darker
    resistOverlay: {},
  },
  frost: {
    label: 'Frost',
    minLevel: 10,
    minDiff: 'hard',
    chance: 0.20,
    eligible: ['Cave Troll','Golem','Wraith','Forest Troll'],
    hp: 1.3, dmg: 1.2, scale: 1.05, def: 2, xp: 1.75,
    tintRGB: [0.7, 0.95, 1.35], // blue shift
    resistOverlay: {uisce: 0.5, tine: 1.5},
  },
  shadow: {
    label: 'Shadow',
    minLevel: 10,
    minDiff: 'hard',
    chance: 0.20,
    eligible: ['Skeleton','Phantom','Wraith'],
    hp: 1.3, dmg: 1.2, scale: 1.0, def: 1, xp: 1.75,
    tintRGB: [1.1, 0.7, 1.35], // purple shift
    resistOverlay: {scath: 0.5, solas: 1.5},
  },
};

// v56 rebalance: enemy HP/dmg scale with player level to keep combat engaging at high tiers.
// Applied at spawn time in both dungeon (spawnFloorEnemies) and zone (buildZoneEnemy) paths.
// - hpScale grows faster than dmgScale so fights get longer, not spikier, as player levels up.
// - Caps exist so level 30+ runs don't become unwinnable.
// - Level 1 player sees 1.0×/1.0× — unscaled base values as the designed-for-baseline.
function enemyHpScale(){
  const lv = (typeof level!=='undefined'?level:1) || 1;
  return Math.min(3.0, 1 + (lv - 1) * 0.15);
}
function enemyDmgScale(){
  const lv = (typeof level!=='undefined'?level:1) || 1;
  return Math.min(2.0, 1 + (lv - 1) * 0.08);
}

// Pick a variant key (or null) for an enemy about to spawn. Rarest (highest minLevel) checked first.
// v56: effective spawn chance now scales with player level above the variant's minLevel. At level 15,
// Greater (minLevel 5) chance is 10% × (1 + 10×0.15) = 25%, up from 10%. Capped at 50% to preserve
// occasional "clean" encounters. This is the "variant density ramp" piece of the balance hybrid.
function pickVariant(baseName, playerLevel, difficultyKey, rnd){
  const candidates = [];
  for(const [key, v] of Object.entries(VARIANTS)){
    if(playerLevel < v.minLevel) continue;
    if(v.minDiff && !isDifficultyAtLeast(difficultyKey, v.minDiff)) continue;
    if(v.eligible && !v.eligible.includes(baseName)) continue;
    const levelOver = Math.max(0, playerLevel - v.minLevel);
    const effChance = Math.min(0.5, v.chance * (1 + levelOver * 0.15));
    candidates.push({key, v, effChance});
  }
  candidates.sort((a,b) => (b.v.minLevel||0) - (a.v.minLevel||0));
  for(const c of candidates){
    if((rnd?rnd():Math.random()) < c.effChance) return c.key;
  }
  return null;
}

// Produce a hex color with tintRGB multiplied channel-wise (clamped 0-1).
function tintHexColor(hexCol, tintRGB){
  const c = new THREE.Color(hexCol);
  c.r = Math.min(1, c.r * tintRGB[0]);
  c.g = Math.min(1, c.g * tintRGB[1]);
  c.b = Math.min(1, c.b * tintRGB[2]);
  return c.getHex();
}

// Returns a NEW def object with variant overlays applied (doesn't mutate the input).
// Also returns a displayName and xpMult to be used by the caller at spawn + kill time.
function applyVariantToDef(baseDef, baseName, variantKey){
  if(!variantKey || !VARIANTS[variantKey]) return {def: baseDef, displayName: baseName, xpMult: 1.0, variant: null};
  const v = VARIANTS[variantKey];
  const def = {...baseDef};
  if(baseDef.hp) def.hp = Math.round(baseDef.hp * v.hp);
  if(baseDef.maxHp) def.maxHp = Math.round(baseDef.maxHp * v.hp);
  if(baseDef.dmg) def.dmg = Math.round(baseDef.dmg * v.dmg);
  if(baseDef.dmgMult) def.dmgMult = baseDef.dmgMult * v.dmg;
  if(baseDef.scale) def.scale = baseDef.scale * v.scale;
  def.def = (baseDef.def || 0) + v.def;
  def.col = tintHexColor(baseDef.col, v.tintRGB);
  def.resist = {...(baseDef.resist || {}), ...v.resistOverlay};
  if(baseDef.xpVal) def.xpVal = Math.round(baseDef.xpVal * v.xp);
  return {def, displayName: `${v.label} ${baseName}`, xpMult: v.xp, variant: variantKey};
}

// Phantom/Wraith life-drain visual — 4 small purple orbs spawning at player, floating toward the drainer over ~500ms.
// Uses RAF like the Caor blast FX so it runs independent of game dt.
function spawnDrainFX(scene, fromX, fromZ, toX, toZ){
  for(let i=0; i<4; i++){
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 5, 5),
      new THREE.MeshBasicMaterial({color: 0xaa44cc, transparent: true, opacity: 0.95})
    );
    const startY = 0.8 + Math.random()*0.4;
    p.position.set(fromX + (Math.random()-0.5)*0.3, startY, fromZ + (Math.random()-0.5)*0.3);
    scene.add(p);
    const delay = i * 70;
    const startTime = performance.now() + delay;
    const DUR = 480;
    const endY = 0.9 + Math.random()*0.4;
    const tick = () => {
      const now = performance.now();
      if(now < startTime){ requestAnimationFrame(tick); return; }
      const t = (now - startTime) / DUR;
      if(t >= 1){ scene.remove(p); return; }
      p.position.x = fromX + (toX - fromX) * t;
      p.position.z = fromZ + (toZ - fromZ) * t;
      p.position.y = startY + (endY - startY) * t + Math.sin(t * Math.PI) * 0.25;
      p.material.opacity = 0.95 * (1 - t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// Drain tick SFX — descending whisper-like tone + subtle noise. Quiet so the per-second tick isn't fatiguing.
function sndDrain(){
  if(!AX || volLevel===0) return;
  sfxTone(380, 180, 0.38, 0.07, 'sine');
  sfxTone(220, 110, 0.42, 0.05, 'sine', -7);
  sfxNoise(0.25, 1, 1, 0.035, 700);
}

// Caor Mastery "Living Ember" — blast on impact. Fires from three places: enemy-contact in zone/dungeon hit handlers
// and wall-contact in the projectile tick. Damages all enemies within BLAST_R of the impact point.
// Visual: expanding ring (torus), impact flash (PointLight), 7 ember sparks on ballistic arcs.
// Damage uses the same roll as a single-target hit — Mastery's 1.30× magnitude is already baked in via TIER_MULT.
const CAOR_BLAST_RADIUS = 2.2;
function triggerCaorBlast(sc, cx, cy, cz, sp, tier, isZone){
  // Visual FX
  spawnCaorBlastFX(sc, cx, cy, cz);
  // Audio
  sndCaorBlast();
  // Damage — every live enemy within radius, using normal per-target damage roll
  const R2 = CAOR_BLAST_RADIUS * CAOR_BLAST_RADIUS;
  const targets = isZone ? ZE : ENEMIES;
  let hitCount = 0;
  const hitNames = [];
  targets.forEach(e=>{
    if(e.dead) return;
    if(e.disguised) return; // Mimics shielded while hidden
    if(!isZone && e.floor !== currentFloor) return;
    const d2 = (e.x-cx)*(e.x-cx) + (e.z-cz)*(e.z-cz);
    if(d2 > R2) return;
    const info = applySpellDamage(e, sp, tier);
    e.hp = Math.max(0, e.hp - info.dmg);
    e.alert = true;
    // Dungeon enemies have visible HP bars; zone enemies have them on the mesh but zone hit handler didn't update them pre-v35.
    // Match the existing hit handlers' behavior per scene.
    if(!isZone){
      e.hpFg.scale.x = e.hp/e.maxHp;
      e.hpFg.position.x = (e.hp/e.maxHp - 1)*.275;
    }
    hitNames.push(e.name);
    hitCount++;
    if(e.hp <= 0){
      const tag = dmgTag(info, e);
      if(isZone) killZoneEnemy(e, sc, tag);
      else killE(e, tag);
    }
  });
  // Summary message — singular for 1 target, count for 2+
  if(hitCount === 1){
    showMsg(`🔥 Living Ember bursts — ${hitNames[0]} caught in the blast!`, '#ff7733');
  } else if(hitCount > 1){
    showMsg(`🔥 Living Ember bursts — ${hitCount} enemies caught in the blast!`, '#ff7733');
  } else {
    // Wall-hit with no enemies nearby — still announce the detonation for feedback
    showMsg(`🔥 Living Ember bursts against the stone.`, '#ff9955');
  }
}

// Visual effect for Caor Mastery blast. Runs independently of the game tick via requestAnimationFrame;
// auto-cleans up after ~550ms. Spawned objects are added to the scene passed in (works in both dungeon and zone).
function spawnCaorBlastFX(sc, cx, cy, cz){
  // Expanding flat ring (torus rotated flat). Scales 0.3 → 2.2 (matches blast radius), fades opacity.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.10, 6, 24),
    new THREE.MeshBasicMaterial({color: 0xff7733, transparent:true, opacity:0.9, side:THREE.DoubleSide})
  );
  ring.rotation.x = Math.PI/2;
  ring.position.set(cx, cy, cz);
  ring.scale.setScalar(0.3);
  sc.add(ring);
  // Impact flash — bright PointLight that decays fast
  const light = new THREE.PointLight(0xff7733, 5.0, 7);
  light.position.set(cx, cy, cz);
  sc.add(light);
  // Ember sparks — 7 small orbs spawning outward with ballistic (gravity) arcs
  const sparks = [];
  for(let i=0;i<7;i++){
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 5),
      new THREE.MeshBasicMaterial({color: 0xffaa44, transparent:true, opacity:1.0})
    );
    sp.position.set(cx, cy, cz);
    const ang = Math.random() * Math.PI * 2;
    const spd = 2.5 + Math.random() * 2.0;
    sparks.push({mesh: sp, vx: Math.cos(ang)*spd, vy: 1.4 + Math.random()*1.6, vz: Math.sin(ang)*spd});
    sc.add(sp);
  }
  // Animation driver — tied to real time via RAF, independent of game dt so fps doesn't affect visual pacing
  const startTime = performance.now();
  const DUR_MS = 550;
  const tick = () => {
    const t = (performance.now() - startTime) / DUR_MS;
    if(t >= 1){
      sc.remove(ring); sc.remove(light);
      for(const s of sparks) sc.remove(s.mesh);
      return;
    }
    // Ring: expand + fade
    ring.scale.setScalar(0.3 + (CAOR_BLAST_RADIUS - 0.3) * t);
    ring.material.opacity = 0.9 * (1 - t);
    // Light: decay over first 60% of duration
    light.intensity = 5.0 * Math.max(0, 1 - t/0.6);
    // Sparks: integrate velocity + gravity, fade opacity
    const dtStep = 1/60;
    for(const s of sparks){
      s.mesh.position.x += s.vx * dtStep;
      s.mesh.position.y += s.vy * dtStep;
      s.mesh.position.z += s.vz * dtStep;
      s.vy -= 6 * dtStep; // gravity
      s.mesh.material.opacity = 1 - t;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Blast SFX — noise burst + low boom + mid sawtooth layer. Louder than a normal Caor hit to signal the AoE.
function sndCaorBlast(){
  if(!AX||volLevel===0)return;
  sfxNoise(.18, 1, 1, 0.38, 900);
  sfxTone(140, 60, .30, 0.32, 'sawtooth');
  sfxTone(250, 110, .20, 0.20, 'sawtooth', 5);
}
