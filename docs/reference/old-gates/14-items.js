
// v61v: Rusty Sword retuned from atk [8,14] to [5,9]. Pre-v61v it out-damaged
// every wooden-tier shop weapon AND matched bronze tier 2 on the low end,
// making the early shop progression meaningless. New range sits between Wooden
// Dagger (4–6) and Wooden Mace (7–9), giving every T1 and T2 weapon a reason
// to exist. Bronze longsword (9–11) becomes the immediate first real upgrade.
// Weight also bumped 2→3 to match the new WEAPON_TYPES scale.
//
// Starter armor (Tattered Tunic, Worn Breeches, Leather Boots) got explicit
// weight fields — pre-v61v they had neither `weight` nor `type`/`slot`, so
// `itemWeight` fell all the way through to the default 0.5 (potion-weight).
// That silent bug meant a fresh character's worn kit registered at ~1.5 total
// instead of 5. Now reads correctly at tunic:2, breeches:2, boots:1.
// v61au: weapon slot starts null. Used to ship a hardcoded "Rusty Sword"
// here, but starter weapons are now picked at character creation
// (STARTER_WEAPONS, applied in ccBegin). Save loads of pre-v61at characters
// (no creator) get a Wooden Sword applied as a fallback in _applyLoadData.
const EQ={head:null,chest:{name:'Tattered Tunic',ico:'👕',def:1,weight:2},hands:null,legs:{name:'Worn Breeches',ico:'👖',def:1,weight:2},feet:{name:'Leather Boots',ico:'👢',def:0,weight:1},weapon:null,offhand:null,ring:null,amulet:null,ammo:null};
const BAG=[];
// v80 S173 — every slot may be empty (Michael, 27 Sep). With no weapon you fight with your fists:
// light, quick and weak. The starter clothes and anything else taken off go to the bag as gear
// that can be put back on (the starter kit never carried a type or slot, so it could not).
const FISTS={name:'Fists',atk:[2,4],weight:1,wType:'blunt'};
function eqBagCopy(it,slot){return {...it,qty:1,type:it.type||'equip',slot:it.slot||slot};}
// v61d4 — Persistent shared stash. Lives in the Caldric Safehouse, accessed
// via the chest on the back wall. Mirrors BAG's structure (array of item
// objects, same _serItem serialization) but has NO weight cap and persists
// across all zones/dungeons. Unique items are allowed in (they need a home),
// and unlike BAG-side sells they retain their unique flag while in stash.
// Migration-safe: loadFromSlot defaults to [] when the saved payload predates
// this field.
const stashBag=[];
function isStackable(it){
  if(!it)return false;
  if(it.type==='potion')return true;
  if(it.type==='herb')return true;
  if(it.type==='ammo')return true;
  if(it.type==='cargo')return true; // S390 — trade goods stack by kind
  if(it.type==='misc'&&it.name==='Mystic Scroll')return true;
  if(it.type==='misc'&&it.name==='Gold Coins')return true;
  if(it.type==='misc'&&it.name==='Lockpick')return true; // v80 S170 — picks stack, so the count on the lock is the whole bag's
  return false;
}
function bagAdd(item){
  // v64 — Honor the incoming item's qty when stackable. Pre-v64 this always
  // added "1 of name" regardless of the item.qty field, so arrow bundles
  // (qty:12 on the template) would only land 1 arrow at a time. The dq
  // ("delta-qty") fallback to 1 preserves all legacy callers that don't set
  // qty explicitly (single drops from corpses, unequip-to-bag, etc.).
  const dq = (item.qty && item.qty > 1) ? item.qty : 1;
  if(isStackable(item)){const ex=BAG.find(b=>b.name===item.name);if(ex){ex.qty += dq;return;}}
  // No weight cap here — callers (buyItem/takeLootItem/harvestHerb) pre-check via canCarry().
  // Unequip also calls bagAdd but the item was already in EQ (same total weight), so no cap check applies.
  BAG.push({...item,qty:dq});
}

// ── ENCUMBRANCE / CARRY WEIGHT ─────────────────────────────────────────
// Pure-weight inventory (no slot cap). Each item has a weight; total is summed across BAG + EQ.
// Thresholds (ratio of total / maxCarry):
//   < 0.80: clear — no penalty
//   0.80..1.00: burdened — -20% stamina regen
//   1.00..1.25: overloaded — can't sprint, -50% move speed
//   >= 1.25: immobile — movement zeroed, pickup blocked
// Per-slot fallback weights for items missing explicit weight (legacy saves, shop stock without it).
// v61v: fallback weights — used for legacy items that don't carry an explicit
// `weight` field. Mirrors ARMOR_TYPES.armorW so new items (which use armorW)
// and legacy items (which fall through here) read the same weight.
const ARMOR_WEIGHT_BY_SLOT = {head:3, chest:8, hands:2, legs:5, feet:2, offhand:4, ring:0.1, amulet:0.2};
function itemWeight(it){
  if(!it) return 0;
  let w = it.weight;
  if(w === undefined){
    if(it.type==='potion') w=0.5;
    else if(it.type==='herb') w=0.2;
    else if(it.type==='misc' && it.name==='Mystic Scroll') w=0.1;
    else if(it.type==='misc') w=0.3;
    else if(it.type==='gold') w=0;
    else if(it.type==='equip') w=ARMOR_WEIGHT_BY_SLOT[it.slot]||2;
    else w=0.5;
  }
  return w * (it.qty || 1);
}
function bagWeight(){let t=0; for(const it of BAG) t+=itemWeight(it); return t;}
function equipWeight(){let t=0; for(const k of Object.keys(EQ)) t+=itemWeight(EQ[k]); return t;}
function totalCarryWeight(){return bagWeight() + equipWeight();}
function maxCarry(){return 50 + attrEff('might') * 5 + ((typeof WORLD!=='undefined'&&activeZoneId==='world')?WORLD.cargoBonus():0) + (typeof fxOn==='function'&&fxOn('feather')?40:0);} // v80 — the ship's hold counts when she's near
function encumbranceState(){
  const r = totalCarryWeight() / maxCarry();
  if(r >= 1.25) return 'immobile';
  if(r >= 1.00) return 'overloaded';
  if(r >= 0.80) return 'burdened';
  return 'clear';
}
function encumbranceColor(s){return s==='immobile'?'#cc4444':s==='overloaded'?'#dd8844':s==='burdened'?'#ccaa44':'#44cc66';}
function encumbranceLabel(s){return s==='immobile'?'IMMOBILE':s==='overloaded'?'Overloaded':s==='burdened'?'Burdened':'';}
// Returns true if adding `item` would keep total carry weight at or below 125% of max (the immobile threshold).
// Used by pickup/buy/harvest paths to prevent getting stuck above the immobile cap.
function canCarry(item){return totalCarryWeight() + itemWeight(item) <= maxCarry() * 1.25;}

// ── VIEWMODEL SWORD ──────────────────────────────────────────
// Weapon tier colours: name fragment → {blade, glow}
// ══════════════════════════════════════════════════════════════
// ITEM SYSTEM — Materials, Types, Enchantments
// ══════════════════════════════════════════════════════════════

// 10 material tiers — col=blade/body colour, guard=guard/trim, glow=enchant-ready light (null if no inherent glow)
const MATERIALS=[
  {tier:1,name:'Wooden',   blade:0x8B5E3C,guard:0x6B3E20,glow:null,        reqAttr:null,reqVal:0,  dropW:40},
  {tier:2,name:'Bronze',   blade:0xCD7F32,guard:0x9B5F12,glow:null,        reqAttr:null,reqVal:0,  dropW:28},
  {tier:3,name:'Iron',     blade:0xA8B0B8,guard:0x787880,glow:null,        reqAttr:'might',reqVal:5, dropW:18},
  {tier:4,name:'Steel',    blade:0xDDE8EC,guard:0xA0B0B8,glow:null,        reqAttr:'might',reqVal:10, dropW:10},
  {tier:5,name:'Mithril',  blade:0x3A5DA8,guard:0x2A3D88,glow:0x4466cc,   reqAttr:'might',reqVal:16, dropW:4},
  {tier:6,name:'Adamant',  blade:0x2D6A2D,guard:0x1D4A1D,glow:0x33aa33,   reqAttr:'might',reqVal:24, dropW:2.0},
  {tier:7,name:'Obsidian', blade:0x1A1A1A,guard:0x0D0D0D,glow:0x440088,   reqAttr:'might',reqVal:32, dropW:1.0},
  {tier:8,name:'Draconic', blade:0xCC2200,guard:0x881100,glow:0xff4400,   reqAttr:'might',reqVal:40, dropW:0.5},
  {tier:9,name:'Demonic',  blade:0x8800CC,guard:0x550088,glow:0xcc00ff,   reqAttr:'might',reqVal:48, dropW:0.2},
  {tier:10,name:'Cosmic',  blade:0x88EEFF,guard:0x44CCDD,glow:0x00ddff,   reqAttr:'might',reqVal:56, dropW:0.08},
];

// Weapon types — shape, slot, weight, base atk range multiplier
const WEAPON_TYPES=[
  // v61v: weights scaled from ~2 to ~3.5 for main weapons. Pre-v61v a sword weighed
  // 2, a potion 0.5 — a full plate loadout was still well under the 40-point burdened
  // threshold. Now weapons anchor at 2–5, armor at 2–8, so a worn kit (weapon +
  // cuirass + greaves + helmet) sits at 15–18 and a bag of 20 items pushes the
  // player toward burdened. Relative weights preserved — dagger still lightest,
  // flail still heaviest of the one-handers. Stamina-per-swing (weight × 7) also
  // goes up proportionally, which tracks with the "heavy weapon = heavier swing"
  // design the system already models.
  {type:'Dagger',    slot:'weapon',weight:1.5,atkMult:[0.55,0.70],shape:'dagger',   wType:'pierce'},
  {type:'Sword',     slot:'weapon',weight:3,  atkMult:[0.75,0.90],shape:'sword',    wType:'slash'},
  {type:'Longsword', slot:'weapon',weight:4,  atkMult:[0.85,1.05],shape:'longsword',wType:'slash'},
  {type:'Scimitar',  slot:'weapon',weight:3,  atkMult:[0.80,0.95],shape:'scimitar', wType:'slash'},
  {type:'Mace',      slot:'weapon',weight:4,  atkMult:[0.90,1.15],shape:'mace',     wType:'blunt'},
  {type:'Flail',     slot:'weapon',weight:5,  atkMult:[0.95,1.25],shape:'flail',    wType:'blunt'},
  // v64 — Bow. Two-handed (clears offhand on equip via _clearOffhandForTwoHander).
  // atkMult is the BOW's contribution; the arrow's arrowDmg stacks on top via
  // applyBowDamage at release time. Bows are deliberately lighter than swords on
  // their atkMult — the arrow is half the damage equation. Finesse, not Might,
  // is the primary stat (BOW_FINESSE_DMG bonus, +4% per point). The hi-end on
  // atkMult is what TIER_VALUE prices off of, so bows cost between sword and
  // dagger tier at the same material — appropriate for an "approach weapon"
  // class that also requires ammo.
  {type:'Bow',       slot:'weapon',weight:3,  atkMult:[0.60,0.80],shape:'bow',      wType:'pierce', twoHand:true},
  // v65 — Two-handed melee weapons. Shipped as the second user of the
  // _clearOffhandForTwoHander() helper (Bow was the first). Defining traits:
  //   - twoHand:true            → auto-stows offhand on equip
  //   - cleaveTargets:N         → single swing hits up to N enemies in arc
  //   - postureMult:M           → multiplier on POSTURE_DRAIN_* per hit
  //   - blockReduce:R           → RMB-held block damage reduction (vs .35 bare/1H)
  //
  // Identity grid:
  //   Claymore   → balanced 2H sword. Cleave 3, block 50%, slash. Pack-clear weapon.
  //   Great Axe  → pure offense, narrower arc. Cleave 2, block 50%, slash. Mid spec.
  //   War Hammer → single-target specialist. Cleave 1, posture 2.25, +damage,
  //                blunt. Best vs brutes / bosses / armored singletons.
  //   Great Club → wooden T1 starter, war-hammer family at entry tier. Cleave 1,
  //                postureMult 1.5, block 40%, blunt. Barnaby stocks it.
  //
  // atkMult numbers calibrated against the 1H baseline: Sword [.75,.90] → Claymore
  // [1.4,1.7]. War Hammer gets +15% over Claymore to compensate for cleave 1.
  {type:'GreatClub', slot:'weapon',weight:4,  atkMult:[0.55,0.75],shape:'greatclub',  wType:'blunt', twoHand:true, cleaveTargets:1, postureMult:1.5,  blockReduce:0.40},
  {type:'Claymore',  slot:'weapon',weight:6,  atkMult:[1.40,1.70],shape:'claymore',   wType:'slash', twoHand:true, cleaveTargets:3, postureMult:1.75, blockReduce:0.50},
  {type:'GreatAxe',  slot:'weapon',weight:7,  atkMult:[1.50,1.85],shape:'greataxe',   wType:'slash', twoHand:true, cleaveTargets:2, postureMult:1.75, blockReduce:0.50},
  {type:'WarHammer', slot:'weapon',weight:7,  atkMult:[1.65,2.00],shape:'warhammer',  wType:'blunt', twoHand:true, cleaveTargets:1, postureMult:2.25, blockReduce:0.50},
];

// Weapon physical damage type inference. New weapons from makeItem carry wType directly; legacy gear
// (Rusty Sword, quest rewards) falls back via weaponShape. Unarmed defaults to blunt.
// Declared here (not near applyMeleeDamage) because itemStatShort/itemDesc reference it and need
// guaranteed visibility — forward-referencing a later `const` was causing ReferenceErrors in some browsers.
const WSHAPE_TO_WTYPE = {dagger:'pierce', sword:'slash', longsword:'slash', scimitar:'slash', mace:'blunt', flail:'blunt', bow:'pierce', claymore:'slash', greataxe:'slash', warhammer:'blunt', greatclub:'blunt'};
function weaponDamageType(w){
  if(!w) return 'blunt';
  if(w.wType) return w.wType;
  if(w.weaponShape && WSHAPE_TO_WTYPE[w.weaponShape]) return WSHAPE_TO_WTYPE[w.weaponShape];
  return 'slash';
}

// ── Pre-attack telegraph tuning ─────────────────────────────────────────────
// Each enemy archetype has a wind-up duration before its strike lands. Brutes take longer
// (telegraphing heavy blows), light/fast enemies telegraph briefly. The player sees a red
// emissive pulse during this window and hears sndTelegraph at the start, giving a legible
// tell for timing a block/parry.
// v61d5 — Roster audit. Phantom + Wraith were missing entries (fell through to the
// 0.35 default) and now have tuned values matching their role: ranged casters with
// brief melee wind-ups when forced into close range. Slime dropped from 0.40 → 0.30
// — a tier-1 trash mob shouldn't telegraph longer than a Skeleton. Vestigial Wolf
// entry removed — the only wolf-shape in the game is the Faolchú boss, which uses
// its own bossDef.telegraphBase path, not this table. No retuning of the existing
// 11 values; that's a playtest-driven pass deferred to a future session now that
// the visuals actually render (v61d1).
// S282 — the tells lengthened to 0.45–0.9 s (combat, Michael's B: A's second piece). At 0.24–0.55 s they sat near a
// human reaction time, so a parry went by rhythm, not by reading. Each value is today's mapped onto the new range
// (0.24 → 0.45, 0.55 → 0.90), so the order is kept: the kobold is still the quickest, the golem the slowest. The tell
// is read from the body now: the shared wind-up pose (e._wind, Session 130) runs the whole tell, and the red glow
// comes only in its last 0.15 s (TELL_GLOW_S).
const TELEGRAPH_BY_NAME = {
  'Cave Troll':0.83, 'Forest Troll':0.83, 'Golem':0.90, 'Gargoyle':0.80,
  'Goblin':0.51, 'Kobold Thief':0.45, 'Spider':0.51,
  'Skeleton':0.60, 'Mimic':0.57, 'Slime':0.54, 'Small Slime':0.54,
  'Bandit':0.57, 'Fire Elemental':0.65,
  'Phantom':0.54, 'Wraith':0.57,
};
const TELL_MIN=.45,TELL_DEFAULT=.61,TELL_GLOW_S=.15;
function telegraphDuration(e){
  if(!e) return TELL_DEFAULT;
  return TELEGRAPH_BY_NAME[e.baseType] ?? TELEGRAPH_BY_NAME[e.name] ?? TELL_DEFAULT;
}
// Pulse the enemy's emissive red during wind-up; reset to black when done/cancelled.
// Shared across dungeon + zone telegraph ticks so visual behavior stays consistent.
// v61d1 — Resolve the primary "body" Mesh on an enemy for telegraph and
// stagger-flash effects. Pre-v61d1 these effects accessed e.mesh.children[0]
// directly, which silently failed on humanoid/brute/wolf-shaped enemies
// where children[0] is a leg-pivot Group (no .material property). Slimes,
// elementals, and wraiths/phantoms had a Mesh at children[0] and worked
// fine. The bug was masked by the audio cue (sndTelegraph) carrying the
// warning signal even when the visual flash didn't render — players
// learned to react to the sound and never noticed the missing visual.
//
// Resolution priority:
//   1. limbs.torso — humanoids, brutes, wolf (Faolchú). Set in buildEnemy
//      and buildFaolchuMesh.
//   2. limbs.body  — slimes, elementals. Set in their respective branches.
//   3. First child with a material — any shape that didn't register
//      torso/body in limbs (mimics, wraiths use this fallback).
//   4. children[0] — legacy last-resort path; same as the old behavior.
//
// Returning null is also safe — both telegraphPulse and the parry stagger
// guard with `if(m && m.material/.emissive)` before mutating.
function enemyBodyMesh(e){
  if(!e || !e.mesh) return null;
  if(e.limbs && e.limbs.torso) return e.limbs.torso;
  if(e.limbs && e.limbs.body) return e.limbs.body;
  if(e.mesh.children){
    const m = e.mesh.children.find(c => c && c.material);
    if(m) return m;
  }
  return e.mesh.children && e.mesh.children[0];
}
function telegraphPulse(e, progress){
  e._wind=progress; // v80 S130 — the shared attack pose reads it
  // S282 — the glow only in the tell's last TELL_GLOW_S seconds; the pose carries the rest
  const left=(1-progress)*(e.telegraphMax||TELL_DEFAULT),k=Math.max(0,Math.min(1,1-left/TELL_GLOW_S));
  const body = enemyBodyMesh(e);
  const m = body && body.material;
  if(m && m.emissive) m.emissive.setRGB(k*0.75, k*0.08, k*0.05);
}
function telegraphReset(e){
  e._wind=0;
  const body = enemyBodyMesh(e);
  const m = body && body.material;
  if(m && m.emissive) m.emissive.setRGB(0,0,0);
}
// v71 — Shieldbearer shield prop. Builds a round wooden shield with an iron rim
// and boss, parents it to the LEFT arm pivot (limbs.armL) so it follows the body,
// and raises that arm across the torso into a guard pose. Stores refs on limbs so
// dropShieldGuard can lower the arm when the guard breaks. Only the humanoid build
// exposes armL/torso; guarded against missing limbs defensively.
function attachShieldProp(g, limbs, sc, kind){
  if(!limbs || !limbs.armL) return;
  const arm = limbs.armL;
  // Round shield — short cylinder (disc) faced forward, wood body + dark rim + boss.
  const shieldG = new THREE.Group();
  // S231 — a person carries the weapon kit's shield (the captain's round, the shieldbearer's tower), its face turned to +z
  if(limbs.person&&typeof buildWeapon==='function'){const k=buildWeapon(kind||'round');k.rotation.y=-Math.PI/2;shieldG.add(k);shieldG.userData.kit=kind||'round';}
  else{
  const wood = new THREE.MeshLambertMaterial({color:0x6b4a2a});
  const iron = new THREE.MeshLambertMaterial({color:0x3a3a40});
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.20*sc,.20*sc,.05*sc,16), wood);
  disc.rotation.x = Math.PI/2;            // face the disc forward (+Z)
  shieldG.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.20*sc,.025*sc,8,18), iron);
  rim.position.z = .01*sc;
  shieldG.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(.05*sc,8,8), iron);
  boss.position.z = .04*sc;
  shieldG.add(boss);}
  // Position the shield off the forearm, rotated to sit across the front of the body.
  shieldG.position.set(0, -0.20*sc, 0.12*sc);
  arm.add(shieldG);
  limbs.shieldProp = shieldG;
  // Raised-guard pose: rotate the left arm forward + inward so the shield covers
  // the torso front. Stored as the "up" pose; dropShieldGuard lerps toward armDownX.
  limbs.shieldArm = arm;
  limbs.shieldArmUpX = -1.15;   // arm raised forward
  limbs.shieldArmUpZ = 0.5;     // swung inward across the body
  limbs.shieldArmDownX = 0.0;
  limbs.shieldArmDownZ = 0.0;
  arm.rotation.x = limbs.shieldArmUpX;
  arm.rotation.z = limbs.shieldArmUpZ;
}
// v71 — Lower a broken Shieldbearer's guard: snap the shield arm down to its
// rest pose. Called from the guard-break branch in both strike resolvers. Cheap
// and idempotent — no-op if the enemy has no shield prop.
function dropShieldGuard(e){
  const L = e && e.limbs;
  if(!L || !L.shieldArm) return;
  L.shieldArm.rotation.x = L.shieldArmDownX || 0;
  L.shieldArm.rotation.z = L.shieldArmDownZ || 0;
}
// v71.1 — Re-raise a Shieldbearer's guard after it recovers from a stagger.
// Called at the stagger-expiry point in both enemy ticks. Only acts on an enemy
// that HAS a shield prop but whose guard is currently down (broken) — so it's a
// no-op for everything else, and for a Shieldbearer whose guard never broke.
// Makes a drawn-out fight require re-breaking the guard rather than being a
// one-and-done: power-attack/flank to break, kill it before it recovers, or
// break it again. The brief flash + toast tells the player the window closed.
function reraiseGuard(e){
  const L = e && e.limbs;
  if(!L || !L.shieldArm || !L.shieldProp) return;   // not a Shieldbearer
  if(e.shieldUp) return;                             // guard already up
  if(e.dead) return;
  e.shieldUp = true;
  L.shieldArm.rotation.x = (typeof L.shieldArmUpX==='number') ? L.shieldArmUpX : -1.15;
  L.shieldArm.rotation.z = (typeof L.shieldArmUpZ==='number') ? L.shieldArmUpZ : 0.5;
  // Brief cyan-white flash to read "guard back up" — distinct from the orange
  // stagger/telegraph flash so it doesn't read as another break.
  const body = enemyBodyMesh(e);
  const m = body && body.material;
  if(m && m.emissive){
    m.emissive.setHex(0x66aaff);
    setTimeout(()=>{ if(m && m.emissive) m.emissive.setHex(0); }, 200);
  }
  showMsg(`🛡️ ${e.name} raises its guard again.`, '#88bbff');
}

// Armor types
const ARMOR_TYPES=[
  // v61v: armorW scaled up alongside WEAPON_TYPES weights. Cuirass is the clear
  // anchor at 8 (was 5) — a decision to wear heavy chest is now a real trade with
  // carry capacity. Accessories (ring/amulet) kept at trivial weight — they're
  // not the encumbrance lever. Shield bumped to 4 so dual-wielding trades against
  // equip weight, not just stamina cost.
  {type:'Helmet',    slot:'head',   defMult:0.8, armorW:3},
  {type:'Amulet',    slot:'amulet', defMult:0.3, armorW:0.2},  // small def (2 at tier 5) + enchants
  {type:'Cuirass',   slot:'chest',  defMult:2.0, armorW:8},
  {type:'Buckler',   slot:'offhand',defMult:1.0, shieldType:'shield',blockMult:1.0, armorW:4},
  {type:'Ring',      slot:'ring',   defMult:0.15,armorW:0.1},  // very slight def (1) + enchants
  {type:'Gauntlets', slot:'hands',  defMult:0.6, armorW:2},
  {type:'Greaves',   slot:'legs',   defMult:0.9, armorW:5},
  {type:'Boots',     slot:'feet',   defMult:0.5, armorW:2},
];

// ── BOOKS ────────────────────────────────────────────────────────
// Read-once skill books (Oblivion model). First read: +1 to the attribute + book is consumed.
// Book title stays in `booksRead` Set so if another copy appears, reading it shows the lore
// but skips the bonus (with a message). 6 books — one per attribute. Lore is tied to the
// Three Registers and to existing NPCs where possible.
//
// Each book has: id, name, ico, attr (which attribute key gets +1), pages (array of strings).
// Pages are rendered one at a time in the book reader UI.
const BOOKS=[
  {id:'aldrics_third', name:"The Forge-Man's Third Treatise", ico:'📕', attr:'might',
   pages:[
     "THE FORGE-MAN'S THIRD TREATISE ON THE BLADE\n\nBeing a short accounting of what the first two treatises got wrong, written in the thirty-seventh year at the forge. As is the custom of the forge-men of Ashenmoor, the author's name is not given — only the work.",
     "A sword is heavier than you think and lighter than you fear. The mistake of the young arm is to swing from the shoulder. The mistake of the old arm is to swing from the hip. A proper strike comes from the foot planted in the earth, travels the spine, and leaves at the wrist. The shoulder is only the path.",
     "Against a larger man, never meet steel with steel. Let his blow pass. Let the weight of his own swing pull him. He will step where you were, and you will not be there.\n\nAgainst a smaller man, never chase. A smaller man who will not stand is not a smaller man — he is a man you have not yet caught. Plant. Wait. He must come.",
     "The old argument says the blade is a tool. I have never agreed. A tool does what the hand asks. A blade does what the blade was made for, and the hand is only permitted to hold it for a while.\n\n— the forge-man of Ashenmoor, year thirty-seven."
   ]},
  {id:'stoics_rampart', name:"The Stoic's Rampart", ico:'📗', attr:'fortitude',
   pages:[
     "THE STOIC'S RAMPART\n\nA soldier's collection. Author unknown. Copied from a garrison manuscript at Mur Pierre in an unremembered year.",
     "You will be struck. Accept this before you walk the road. The blow is coming; the only question is what shape it arrives in, and what shape you are in when it does.\n\nFear is not the blow. Fear is the arriving. The blow itself is nothing — it is over before you know it has begun.",
     "The shield does not save you. The shield buys you a breath. A breath is enough to remember your footing. Footing is enough to remember the blade. The blade is enough to answer.\n\nSo: the shield saves you, after all. Just not in the way the young think."
   ]},
  {id:'fletchers_hand', name:"The Fletcher's Hand", ico:'📘', attr:'finesse',
   pages:[
     "THE FLETCHER'S HAND\n\nNotes on precision work. For the apprentice who has passed the first year and still wishes to continue.",
     "A crooked arrow is not an arrow. It is a short stick with feathers. Do not loose it — it will embarrass the bow, the fletcher, and the target, in that order.",
     "The mistake beginners make is to work quickly. The mistake masters make is to work slowly. Neither is precision. Precision is a single correct motion done without pause because the hand has already done it ten thousand times.\n\nWork until the motion thinks for you. Then, and only then, work faster."
   ]},
  {id:'winds_account', name:"The Wind's Account", ico:'📙', attr:'swiftness',
   pages:[
     "THE WIND'S ACCOUNT\n\nFrom the journals of a courier of the northern roads. The author's name is lost; the route is not.",
     "The first thing a runner learns is that the road is longer than the map. The map promises a straight line. The road gives you a river to cross, a landowner to argue with, and a hill the cartographer was too polite to draw.\n\nLearn your roads by foot. Maps are for men who sit.",
     "The second thing a runner learns is that the body will lie to you. It will tell you to stop at mile four. It is wrong. Stop at mile nine, and only if there is water.\n\nThe third thing a runner learns is never tell anyone what the second thing was. Let them find out. They will run faster for having been fooled."
   ]},
  {id:'of_binding_stones', name:"Of Binding Stones", ico:'📔', attr:'intelligence',
   pages:[
     "OF BINDING STONES\n\nA commentary on the deep carvings. Academic draft — not for circulation outside the Royal Herald's office. Aldwyn of Ironhaven, revised.",
     "It is a common error to call the sigils decorative. They are not. Decoration is a later language's word for something whose purpose has been forgotten. The sigils had a purpose when they were cut.\n\nThe purpose was to hold something still. The something is not in the stone. The something is the stone — the world itself, at that point, at that moment.",
     "The three registers are not interchangeable. A sigil carved in the deep tongue binds. The same figure copied in the common tongue is a drawing of a sigil, which is a different object entirely. The academies know this and pretend otherwise.\n\nWhen you see a sigil that has been overwritten in a later hand, you are looking at an act of war.",
     "I have not yet told Lord Caldric the extent of my findings. I am not yet sure whether that is prudence or cowardice. The two often look the same from inside.\n\n— A., Royal Herald's Office, spring."
   ]},
  {id:'letters_from_ashwold', name:"Letters from Ashwold", ico:'📓', attr:'resolve',
   pages:[
     "LETTERS FROM ASHWOLD\n\nCorrespondence recovered from a cottage on the southern moor. Written during the Long Winter. The addressee is a young healer; the writer is her teacher.",
     "My dear girl,\n\nYou asked me how I keep going. I will tell you honestly, because you have asked honestly. I do not keep going. I stop, every evening, and do not believe I will begin again. And every morning, against my better judgment, I begin again.\n\nThis is all there is. The trick is that the stopping is real and the beginning is also real, and the world does not ask you to pretend otherwise. It only asks you to do the beginning part, one more time.",
     "You will lose patients. You will lose the ones you were sure you could save. You will find yourself at a table after, drinking something you usually don't, and you will think: I am not made for this.\n\nYou are. You are made for this precisely because you thought you weren't. The ones who never doubt themselves are the ones I refuse to teach.",
     "The winter will end. I know this because it always has, and because I have counted. Seventy-one winters. The last one, I think, will end too, though I will not be there to see it.\n\nKeep writing. The letters help me more than you know.\n\n— M."
   ]},
];

// Runtime Set of book ids the player has read. Persisted in saves.
const booksRead=new Set();

// v80 S470 — co-op rules (Michael's A on #119): a roll that decides an outcome comes from a seeded stream keyed by place
// and id. Every loot roll below draws from lootRand(): Math.random unless a stream is set, which rollContainerLoot does when
// its caller gives the container a key, so two machines that agree on the key and the clock roll the same contents.
function seededRng(place,id){let h=2166136261>>>0;const s=String(place)+'|'+String(id);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}let a=h||1;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
let LOOT_RNG=null;
function lootRand(){return LOOT_RNG?LOOT_RNG():Math.random();}
function withLootRng(rng,fn){const was=LOOT_RNG;LOOT_RNG=rng;try{return fn();}finally{LOOT_RNG=was;}}
// the day of the world's clock, for a container that refills: the same key rolls the same contents within one game day
function lootDay(){return Math.floor(((typeof worldState!=='undefined'&&worldState&&worldState.gameTimeAbsMinutes)||0)/1440);}

function makeBookItem(def){
  // Build a bag-ready copy. weight: 0.5, worth small sell value (books are for reading, not selling).
  return {name:def.name, ico:def.ico, type:'book', bookId:def.id, weight:0.5,
          buyPrice:0, sellMult:0.1};
}
function randomBookItem(){
  return makeBookItem(BOOKS[Math.floor(lootRand()*BOOKS.length)]);
}

// Pick a random herb suitable for loot drops. Strategy: pick from all herbs whose zone isn't
// the special 'dungeon' marker. HERB_DEF values have an `item` field ready to pocket.
function randomLootHerb(){
  const keys=Object.keys(HERB_DEF);
  if(!keys.length)return null;
  // Filter out any dungeon-only herbs so adventurers/barrels don't cough up rare underground flora.
  const pool=keys.filter(k=>HERB_DEF[k].zone!=='dungeon');
  const k=pool.length?pool[Math.floor(lootRand()*pool.length)]:keys[Math.floor(lootRand()*keys.length)];
  return {...HERB_DEF[k].item, qty:1};
}

// Weapon enchantments
const WEAPON_ENCHANTS=[
  {id:'fire',    name:'of Flames',    col:0xff4400,light:0xff6600,
    effect:(dmg)=>({extraDmg:Math.floor(dmg*0.25),extraType:'fire',   msg:'🔥 Fire'})},
  {id:'frost',   name:'of Frost',     col:0x88ddff,light:0x44aaff,
    effect:(dmg)=>({extraDmg:Math.floor(dmg*0.20),extraType:'frost',  msg:'❄ Frost', stagger:0.8})},
  {id:'shock',   name:'of Shock',     col:0xffee22,light:0xddcc00,
    effect:(dmg)=>({extraDmg:Math.floor(dmg*0.22),extraType:'shock',  msg:'⚡ Shock'})},
  {id:'absorb_hp',  name:'of Life Drain', col:0xff2244,light:0xdd0033,
    effect:(dmg)=>({extraDmg:0,extraType:'absorb_hp',  healPlayer:Math.floor(dmg*0.20),msg:'🩸 Drain'})},
  {id:'absorb_st',  name:'of Fatigue',    col:0xaaff44,light:0x88dd22,
    effect:(dmg)=>({extraDmg:0,extraType:'absorb_st',  stealStam:Math.floor(dmg*0.15), msg:'💪 Fatigue'})},
  {id:'absorb_mp',  name:'of Soul Tap',   col:0xaa44ff,light:0x8822dd,
    effect:(dmg)=>({extraDmg:0,extraType:'absorb_mp',  gainMana:Math.floor(dmg*0.18),  msg:'✦ Soul Tap'})},
];

// Armor enchantments
const ARMOR_ENCHANTS=[
  {id:'stamina_boost', name:'of Endurance',  apply:(it)=>({maxStaminaBonus:(it.tier||1)*8})},
  {id:'magic_boost',   name:'of the Mage',   apply:(it)=>({maxManaBonus:(it.tier||1)*10})},
  {id:'health_boost',  name:'of Vitality',   apply:(it)=>({maxHPBonus:(it.tier||1)*12})},
  {id:'hp_regen',      name:'of Mending',    apply:(it)=>({hpRegen:(it.tier||1)*0.08})},
  {id:'st_regen',      name:'of Vigor',      apply:(it)=>({stRegen:(it.tier||1)*0.12})},
  {id:'mp_regen',      name:'of Clarity',    apply:(it)=>({mpRegen:(it.tier||1)*0.10})},
  {id:'fortify_might', name:'of Might',      apply:(it)=>({mightBonus:Math.ceil((it.tier||1)/3)})},
  {id:'fortify_fort',  name:'of Fortitude',  apply:(it)=>({fortitudeBonus:Math.ceil((it.tier||1)/3)})},
  {id:'fortify_fin',   name:'of Finesse',    apply:(it)=>({finesseBonus:Math.ceil((it.tier||1)/3)})},
  {id:'fortify_swift', name:'of Swiftness',  apply:(it)=>({swiftnessBonus:Math.ceil((it.tier||1)/3)})},
  {id:'fortify_int',   name:'of Intellect',  apply:(it)=>({intBonus:Math.ceil((it.tier||1)/3)})},
  // v61c8 — Unique boss-drop enchants. Flagged _unique:true so the random
  // armor enchant roller (line ~1697) skips them — only spawn via explicit
  // attachment in boss death code. Must live in this array so save/load
  // reconstruction can find them by id (_restoreEnchant searches this
  // array). Stats are tier-fixed (don't scale by item.tier) since these
  // enchants aren't applied to procedurally-tiered loot.
  {id:'faolchu_mark', name:'of the Sigil-Reader', _unique:true,
   apply:(it)=>({intBonus:3, maxManaBonus:30, mpRegen:0.30})},
];

// Base atk values per tier (before weapon type multiplier)
// v56 rebalance: softened from old curve [0, 8, 14, 20, 28, 38, 50, 64, 82, 104, 130] (~1.4×/tier)
// to ~1.29×/tier. New weapons are still meaningfully better per tier, but the jump from e.g. Iron
// to Mithril is "10 vs 15 hits" not "3 vs 1 hit". Paired with level-scaled enemy HP so combat
// stays engaging as the player progresses.
const TIER_BASE_ATK=[0, 8, 10, 13, 17, 22, 28, 36, 47, 61, 80]; // index=tier

// Base def per tier (before armor type multiplier)
const TIER_BASE_DEF=[0, 1, 2, 3, 5, 7, 10,14,19,25, 32]; // index=tier

// v57 price curve — base gold value per tier. Weapons scale by atkMult[1]; armor scales by
// (0.5 + defMult*0.3). Designed so Mithril longsword ≈ 290g, Adamant ≈ 790g — matching the
// user's "mundane tiers cheap, magical tiers expensive" progression. Big jumps at T5 (Mithril —
// first magical tier with glow) and T7 (Obsidian — endgame-tier).
const TIER_VALUE=[0, 5, 20, 40, 75, 275, 750, 2000, 5000, 12000, 30000];

// v57 armor fortitude requirements — mirrors MATERIALS.reqVal (the weapon might curve).
// Kept as a table instead of a formula so the curve is obvious at a glance.
const ARMOR_FORT_REQ=[0, 0, 0, 5, 10, 16, 24, 32, 40, 48, 56];

// Shield block% per tier
const TIER_BLOCK=[0,.20,.30,.40,.50,.60,.68,.75,.82,.88,.94];

// Build an item object from components
function makeItem(matTier, typeObj, enchant, isArmor){
  const mat=MATERIALS[matTier-1]||MATERIALS[0];
  const t=matTier;
  let item={type:'equip', tier:t, material:mat.name, slot:typeObj.slot};

  if(!isArmor){
    // Weapon
    const lo=Math.round(TIER_BASE_ATK[t]*typeObj.atkMult[0]);
    const hi=Math.round(TIER_BASE_ATK[t]*typeObj.atkMult[1]);
    item.name=`${mat.name} ${typeObj.type}`;
    item.ico=typeObj.shape==='dagger'?'🗡':typeObj.shape==='mace'?'🔨':typeObj.shape==='flail'?'⛓':typeObj.shape==='bow'?'🏹':'⚔️';
    item.atk=[lo,hi];
    item.weight=typeObj.weight;
    item.weaponType=typeObj.type;
    item.weaponShape=typeObj.shape;
    item.wType=typeObj.wType;
    // v64 — twoHand is set on the WEAPON_TYPES def for two-handed classes (bow,
    // future claymore/great axe/war hammer). Equip path reads this to clear
    // the offhand slot via _clearOffhandForTwoHander().
    if(typeObj.twoHand) item.twoHand = true;
    // v65.1 — Propagate the 2H combat fields onto the item itself so the
    // combat call sites read them at swing time. Pre-v65.1 these lived on
    // the WEAPON_TYPES def only; makeItem dropped them, so a freshly-made
    // Claymore had cleaveTargets=undefined → CLEAVE_DEFAULT (1) at runtime.
    // Looking up the WEAPON_TYPES def from the item every swing would also
    // work, but inlining the fields is simpler and matches the pattern
    // already used for wType/twoHand.
    if(typeObj.cleaveTargets) item.cleaveTargets = typeObj.cleaveTargets;
    if(typeObj.postureMult)   item.postureMult   = typeObj.postureMult;
    if(typeObj.blockReduce)   item.blockReduce   = typeObj.blockReduce;
    item.matCol=mat.blade;
    item.matGuard=mat.guard;
    item.matGlow=mat.glow;
    if(enchant){
      item.name+=` ${enchant.name}`;
      item.enchant=enchant;
      item.enchantId=enchant.id;
    }
    item.reqAttr=mat.reqAttr;
    item.reqVal=mat.reqVal;
    // v57 pricing: TIER_VALUE baseline × weapon's hi-end atkMult. Heavier/punchier weapons cost more.
    item.buyPrice=Math.max(3, Math.round(TIER_VALUE[t]*typeObj.atkMult[1]));
    item.sellMult=0.45;
  } else {
    // Armor
    const isShield=typeObj.shieldType==='shield';
    const isAccessory=typeObj.defMult<0.2&&!isShield; // rings/amulets — very low defMult but still nonzero now
    item.name=`${mat.name} ${typeObj.type}`;
    item.ico=typeObj.slot==='head'?'🪖':typeObj.slot==='amulet'?'📿':
             typeObj.slot==='chest'?'🛡':typeObj.slot==='offhand'?'🛡':
             typeObj.slot==='ring'?'💍':typeObj.slot==='hands'?'🧤':
             typeObj.slot==='legs'?'👖':'👢';
    if(isShield){item.shieldType='shield';item.block=Math.min(0.94,TIER_BLOCK[t]);}
    // Def applies to everything with a nonzero defMult now — shields, accessories, plate.
    if(typeObj.defMult>0){item.def=Math.max(1,Math.round(TIER_BASE_DEF[t]*typeObj.defMult));}
    item.weight=typeObj.armorW||ARMOR_WEIGHT_BY_SLOT[typeObj.slot]||2;
    item.matCol=mat.blade;
    if(enchant){
      item.name+=` ${enchant.name}`;
      item.enchant=enchant;
      item.enchantId=enchant.id;
      item.enchantStats=enchant.apply(item);
    }
    // v57 armor gating: fortitude reqs mirror the weapon might curve (0, 0, 5, 10, 16, 24, 32, 40, 48, 56).
    item.reqAttr=t>=3?'fortitude':null;
    item.reqVal=t>=3?ARMOR_FORT_REQ[t]:0;
    // v57 pricing: TIER_VALUE × (0.5 + defMult*0.3). Cuirasses more expensive than rings.
    item.buyPrice=Math.max(5, Math.round(TIER_VALUE[t]*(0.5 + (typeObj.defMult||0.3)*0.3)));
    item.sellMult=0.45;
  }
  return item;
}

// Check if player can equip an item
function canEquip(item){
  if(!item.reqAttr||!item.reqVal)return{ok:true};
  const have=ATTRS[item.reqAttr]||0;
  if(have>=item.reqVal)return{ok:true};
  return{ok:false,msg:`Requires ${ATTR_DEF[item.reqAttr]?.label||item.reqAttr} ${item.reqVal} (you have ${have})`};
}

// v61c0: gold drop roll. Three knobs:
//   - tier : 'barrel' | 'corpse' | 'chest' — scales the base range
//   - level : current player level — adds a small flat bonus per level
//   - fortune : ATTRS.fortune — multiplies total by 5% per point
//   - goldFind : `goldFind` buff multiplier (Goldenrod's herb passive, etc.)
// Result is clamped to >=1 so a Fortune 0 / Level 1 player can't roll
// 0 gold from a barrel and feel cheated. Pre-v61c0 ranges were
// 5-19/12-35/8-27 (barrel/chest/corpse). New base ranges are 1-6/4-12/2-8
// — meaningfully smaller at level 1, but the level+fortune additive
// scaling keeps mid-game gold drops in the same neighborhood as before
// while letting Fortune characters genuinely outpace them.
//
// At Level 1, Fortune 0: barrel 1-6 (avg 3), corpse 2-8 (avg 5), chest 4-12 (avg 8)
// At Level 5, Fortune 5: barrel ~3-13 (avg 8), corpse ~6-18 (avg 12), chest ~13-31 (avg 22)
// At Level 10, Fortune 10: barrel ~8-26 (avg 17), corpse ~13-34 (avg 24), chest ~28-66 (avg 47)
// At Level 1, Fortune 0: similar to a single small treasure drop in a
// classic JRPG opening hour. By late game with Fortune commitment the
// drops scale meaningfully but don't break economy (a single greater
// potion still costs 40g, a tier 3 weapon hundreds).
function rollGold(tier){
  const t = (tier==='treasure') ? {min:8, max:18, lvBonus:1.5}
          : (tier==='chest') ? {min:4, max:12, lvBonus:1.0}
          : (tier==='corpse') ? {min:2, max:8, lvBonus:0.7}
          : {min:1, max:6, lvBonus:0.5};
  const base = Math.floor(lootRand()*(t.max - t.min + 1)) + t.min;
  const lv = (typeof level==='number') ? level : 1;
  const fortune = (typeof ATTRS!=='undefined' && ATTRS && ATTRS.fortune) ? ATTRS.fortune : 0;
  const lvAdd = Math.floor(lv * t.lvBonus);
  const fortuneMult = 1 + fortune * 0.05;
  const buffMult = (typeof _buffMult==='function') ? _buffMult('goldFind', 1) : 1;
  return Math.max(1, Math.round((base + lvAdd) * fortuneMult * buffMult));
}

// Procedural loot roller — called on enemy death
// Weights drop chances by dungeon difficulty and tier caps
// Per-container-kind consumable pools. Each entry: {w: weight, roll: () => item}
// Weights are relative within each pool. The `roll` fn is deferred so we can re-randomise
// gold, herbs, books on each call.
// Mystic Scrolls are intentionally absent — vestigial from the pre-sigil magic system.
const LOOT_POOLS={
  barrel:[
    {w:40, roll:()=>randomLootHerb()||{name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5}},
    {w:20, roll:()=>({name:'Torch',ico:'🔦',type:'equip',slot:'offhand',torchType:'torch',def:0,tier:1,material:'Wooden',matCol:0x6a3e12,weight:1,sellMult:.3,buyPrice:8})},
    {w:15, roll:()=>({name:'Stamina Draught',ico:'🥤',type:'potion',stam:40,weight:0.5,sellMult:.5,buyPrice:22})},
    {w:10, roll:()=>({name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5,sellMult:.4,buyPrice:18})},
    {w:10, roll:()=>({name:'Gold Coins',ico:'🪙',type:'gold',value:rollGold('barrel')})},
    {w: 5, roll:()=>({name:'Mana Draught',ico:'💧',type:'potion',mana:40,weight:0.5,sellMult:.5,buyPrice:30})},
  ],
  chest:[
    {w:25, roll:()=>({name:'Gold Coins',ico:'🪙',type:'gold',value:rollGold('chest')})},
    {w:15, roll:()=>({name:'Greater Potion',ico:'🫙',type:'potion',heal:60,weight:0.5,sellMult:.5,buyPrice:40})},
    {w:12, roll:()=>({name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5,sellMult:.4,buyPrice:18})},
    {w:10, roll:()=>({name:'Mana Draught',ico:'💧',type:'potion',mana:40,weight:0.5,sellMult:.5,buyPrice:30})},
    {w:10, roll:()=>({name:'Stamina Draught',ico:'🥤',type:'potion',stam:40,weight:0.5,sellMult:.5,buyPrice:22})},
    {w:12, roll:()=>({name:'Lockpick',ico:'🗝',type:'misc',buyPrice:12,sellMult:.4,weight:.05,qty:3})},
    {w:10, roll:()=>({name:'Torch',ico:'🔦',type:'equip',slot:'offhand',torchType:'torch',def:0,tier:1,material:'Wooden',matCol:0x6a3e12,weight:1,sellMult:.3,buyPrice:8})},
    {w: 8, roll:()=>randomLootHerb()||{name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5}},
    {w: 5, roll:()=>randomBookItem()}, // rare — books only appear in chests
  ],
  // v61c1: treasure pool — mirrors chest but the gold roll calls rollGold('treasure')
  // for the higher base range (8-18 + 1.5/level + Fortune scaling). Required because
  // rollLoot now passes 'treasure' through to rollConsumable; without this entry the
  // fallback in rollConsumable (`LOOT_POOLS[kind] || LOOT_POOLS.corpse`) would land
  // on corpse loot from a treasure chest. Same item mix as chest so treasure feels
  // like "premium chest" rather than a different category.
  treasure:[
    {w:25, roll:()=>({name:'Gold Coins',ico:'🪙',type:'gold',value:rollGold('treasure')})},
    {w:15, roll:()=>({name:'Greater Potion',ico:'🫙',type:'potion',heal:60,weight:0.5,sellMult:.5,buyPrice:40})},
    {w:12, roll:()=>({name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5,sellMult:.4,buyPrice:18})},
    {w:10, roll:()=>({name:'Mana Draught',ico:'💧',type:'potion',mana:40,weight:0.5,sellMult:.5,buyPrice:30})},
    {w:10, roll:()=>({name:'Stamina Draught',ico:'🥤',type:'potion',stam:40,weight:0.5,sellMult:.5,buyPrice:22})},
    {w:10, roll:()=>({name:'Torch',ico:'🔦',type:'equip',slot:'offhand',torchType:'torch',def:0,tier:1,material:'Wooden',matCol:0x6a3e12,weight:1,sellMult:.3,buyPrice:8})},
    {w: 8, roll:()=>randomLootHerb()||{name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5}},
    {w: 5, roll:()=>randomBookItem()},
  ],
  // v61ga: library chest pool. Books are the centerpiece (heavy weight),
  // worn tomes are flavor junk (sellable but no read effect — unlike BOOKS
  // entries which are read-once skill bonuses). Torches and herbs round
  // out the pool with the period-appropriate "what's actually in a library"
  // register: light sources for reading and dried herbs as bookmarks /
  // herbarium specimens. No potions, no gold piles — libraries are
  // scholarly spaces, not treasuries.
  library_chest:[
    {w:35, roll:()=>randomBookItem()},
    {w:20, roll:()=>({name:'Worn Tome',ico:'📕',type:'junk',weight:0.6,sellMult:.4,buyPrice:0,desc:'Pages too damaged to read. The binding still has value to a collector.'})},
    {w:15, roll:()=>randomLootHerb()||{name:'Torch',ico:'🔦',type:'equip',slot:'offhand',torchType:'torch',def:0,tier:1,material:'Wooden',matCol:0x6a3e12,weight:1,sellMult:.3,buyPrice:8}},
    {w:12, roll:()=>({name:'Torch',ico:'🔦',type:'equip',slot:'offhand',torchType:'torch',def:0,tier:1,material:'Wooden',matCol:0x6a3e12,weight:1,sellMult:.3,buyPrice:8})},
    {w: 8, roll:()=>({name:'Ink Vial',ico:'🖋️',type:'junk',weight:0.2,sellMult:.4,buyPrice:0,desc:'A small glass vial of black ink. Half-evaporated.'})},
    {w: 5, roll:()=>({name:'Quill',ico:'🪶',type:'junk',weight:0.1,sellMult:.4,buyPrice:0,desc:'A goose-feather quill, the nib worn smooth.'})},
    {w: 5, roll:()=>({name:'Gold Coins',ico:'🪙',type:'gold',value:rollGold('chest')})},
  ],
  corpse:[
    {w:30, roll:()=>({name:'Gold Coins',ico:'🪙',type:'gold',value:rollGold('corpse')})},
    {w:20, roll:()=>({name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5,sellMult:.4,buyPrice:18})},
    {w:15, roll:()=>({name:'Stamina Draught',ico:'🥤',type:'potion',stam:40,weight:0.5,sellMult:.5,buyPrice:22})},
    {w:12, roll:()=>({name:'Greater Potion',ico:'🫙',type:'potion',heal:60,weight:0.5,sellMult:.5,buyPrice:40})},
    {w:10, roll:()=>({name:'Mana Draught',ico:'💧',type:'potion',mana:40,weight:0.5,sellMult:.5,buyPrice:30})},
    {w:13, roll:()=>randomLootHerb()||{name:'Health Potion',ico:'🧪',type:'potion',heal:25,weight:0.5}},
    // NOTE: no torches, no books — adventurers don't carry either in the field
  ],
};

function rollConsumable(kind){
  const pool=LOOT_POOLS[kind]||LOOT_POOLS.corpse;
  const total=pool.reduce((a,p)=>a+p.w,0);
  let r=lootRand()*total;
  for(const p of pool){r-=p.w; if(r<=0)return p.roll();}
  return pool[0].roll();
}

function rollLoot(diffScale, theme, kind){
  // v80 S472 — the world's containers pass the difficulty as a number (1 a town barrel, 1.4 a wreck, 2.4 a hoard); read it as {hp}
  if(typeof diffScale==='number')diffScale={hp:diffScale};
  // Chance of getting an equip vs consumable/gold — scales up with difficulty
  const equipChance=0.28+(diffScale?diffScale.hp*0.08:0);
  const roll=lootRand();
  if(roll>equipChance){
    // Consumable path — use kind-aware pool (defaults to corpse table if kind is missing)
    return rollConsumable(kind||'corpse');
  }
  // Pick material tier — weighted, skewed by player level AND difficulty.
  // v57: previously `round(3 + diffScale.hp*5)` gave too-generous drops at low level (Obsidian at L5).
  // New cap blends player level (0.4/level) with difficulty (1.2/diffScale.hp), floored at T1.
  // At L5 normal → cap T4 (Steel). L10 normal → T6 (Adamant). L15 hard → T9 (Demonic).
  const playerLv = typeof level!=='undefined'?level:1;
  const diffFactor = diffScale ? diffScale.hp : 1.0;
  const maxTier = Math.min(10, Math.max(1, Math.floor(1 + playerLv*0.4 + diffFactor*1.2)));
  const weights=MATERIALS.map(m=>m.dropW*(m.tier<=maxTier?1:0));
  const totalW=weights.reduce((a,b)=>a+b,0);
  let r2=lootRand()*totalW,t=1;
  for(let i=0;i<weights.length;i++){r2-=weights[i];if(r2<=0){t=i+1;break;}}
  const isWeapon=lootRand()<0.45;
  const typeObj=isWeapon?WEAPON_TYPES[Math.floor(lootRand()*WEAPON_TYPES.length)]
                        :ARMOR_TYPES[Math.floor(lootRand()*ARMOR_TYPES.length)];
  // Enchantment — rare, scales with tier
  const enchChance=Math.min(0.55,(t-1)*0.065);
  let enchant=null;
  if(lootRand()<enchChance){
    // v61c8 — Filter out _unique enchants (boss-drop signatures) so they
    // can't roll on procedurally-generated loot. Unique enchants must
    // exist in the table for save/load id-lookup, but should never
    // attach to anything outside their authored drop site.
    const pool=(isWeapon?WEAPON_ENCHANTS:ARMOR_ENCHANTS).filter(e=>!e._unique);
    enchant=pool[Math.floor(lootRand()*pool.length)];
  }
  return makeItem(t,typeObj,enchant,!isWeapon);
}

// Roll a pre-filled loot array for a container. Called at spawn so contents are fixed per seed/run.
// Count distribution per kind:
//   chest    — up to 5 items. First roll 90%, each subsequent roll ½ the previous. Breaks on first miss.
//              So P(empty) = 10%, P(1) ≈ 45%, P(2) ≈ 22%, P(3) ≈ 11%, P(4) ≈ 6%, P(5) ≈ 6% (cap).
//   treasure — same as chest but first roll 100% (never empty) and gold is tripled.
//   barrel   — up to 2 items. First 40%, second 20% of that. P(empty) = 60%.
//   corpse   — up to 2 items. First uses passed baseChance (existing fortune+difficulty roll); second 25% bonus.
function rollContainerLoot(kind, diffScale, theme, baseChance, key){
  if(key!=null&&!LOOT_RNG)return withLootRng(seededRng('loot',key),()=>rollContainerLoot(kind, diffScale, theme, baseChance));
  const items=[];
  if((kind==='chest'||kind==='treasure')&&typeof spellbookItem==='function'&&lootRand()<.07){const rare=['suil_oiche','eitilt','sciath','siul_uisce'];items.push(spellbookItem(rare[Math.floor(lootRand()*rare.length)],1));} // v80 — rare spells live in chests
  if(kind==='chest' || kind==='treasure'){
    const maxItems=5;
    let p = kind==='treasure' ? 1.0 : 0.9;
    for(let i=0;i<maxItems;i++){
      if(lootRand() >= p) break;
      // v61c1: pass 'treasure' through so the gold roll fires `rollGold('treasure')`
      // (its own tier with higher base + level scaling), not `rollGold('chest')`
      // multiplied by 3. The flat ×3 made treasure feel oversized in the new
      // post-v61c0 economy — a regular chest's max-of-12 became 36 in a
      // treasure chest, well above the design ask of "1-12 base." Treasure
      // is now its own clean tier (8-18 base, 1.5/level), still meaningfully
      // better than a regular chest but proportional.
      const it = rollLoot(diffScale, theme, kind==='treasure'?'treasure':'chest');
      items.push(it);
      p *= 0.5;
    }
  } else if(kind==='library_chest'){
    // v61ga: library chests skip rollLoot entirely — no equipment drops.
    // Roll 1-3 items from the library_chest pool directly. P(1) ≈ 50%,
    // P(2) ≈ 30%, P(3) ≈ 15%, P(4) ≈ 5% (capped).
    let p = 0.95;
    for(let i = 0; i < 4; i++){
      if(lootRand() >= p) break;
      items.push(rollConsumable('library_chest'));
      p *= 0.55;
    }
    if(items.length === 0) items.push(rollConsumable('library_chest'));
  } else if(kind==='library_shelf'){
    // v61gh: per-shelf loot for the 6 bookshelves in a library. Thin —
    // most shelves are empty (well-read register). Shares the
    // library_chest item pool. Math: P(any loot) = 0.17; given any,
    // P(2nd item) = 0.25. Expected items per shelf ≈ 0.21. Expected items
    // per library across 6 shelves ≈ 1.3 (canon "scholarly, picked over").
    if(lootRand() < 0.17){
      items.push(rollConsumable('library_chest'));
      if(lootRand() < 0.25) items.push(rollConsumable('library_chest'));
    }
  } else if(kind==='barrel'){
    if(lootRand() < 0.40) items.push(rollLoot(diffScale, theme, 'barrel'));
    if(items.length && lootRand() < 0.20) items.push(rollLoot(diffScale, theme, 'barrel'));
  } else if(kind==='corpse'){
    if(lootRand() < (baseChance!=null?baseChance:0.5)) items.push(rollLoot(diffScale, theme, 'corpse'));
    if(items.length && lootRand() < 0.25) items.push(rollLoot(diffScale, theme, 'corpse'));
  }
  return items;
}
