// v61aj: DEBUG HELPER — window._debugResetBurn(). Defined at the TOP of the
// script so it attaches to window even if a later init error halts execution.
// Resets all state required to re-trigger the burn sequence on next Ashenmoor
// entry. Function body references globals (worldState, QS, owBurnedScene,
// _burnedSmokeMeshes/_Materials, ZONE_CORPSES, _syncAshenmoorZoneEntry) which
// are declared later in the script — but those references are resolved at
// CALL time, not at definition time, so this ordering is safe.
window._debugResetBurn = function(){
  try{
    worldState.ashenmoorBurned  = false;
    worldState.ashenmoorPending = true;
    worldState.bramBodyRead     = false;
    if(QS.q7_the_rubbing){
      // v61ak: reset state to 'active' (not 'locked'). Q7 is now given by
      // Aldwyn at Q6 completion, so by the time the player walks into
      // Ashenmoor in-fiction, Q7 is already active. For the burn trigger's
      // enter_zone event to have an objective to tick, Q7 must be active.
      // Setting 'active' simulates "as if Q6 just completed and the player
      // is about to walk home."
      QS.q7_the_rubbing.state = 'active';
      if(Array.isArray(QS.q7_the_rubbing.objectives)){
        QS.q7_the_rubbing.objectives.forEach(o=>{ if(o) o.current=0; });
      }
    }
    owBurnedScene = null;
    if(typeof _burnedSmokeMeshes    !== 'undefined') _burnedSmokeMeshes.length    = 0;
    if(typeof _burnedSmokeMaterials !== 'undefined') _burnedSmokeMaterials.length = 0;
    if(typeof ZONE_CORPSES !== 'undefined'){
      for(let i=ZONE_CORPSES.length-1;i>=0;i--){
        if(ZONE_CORPSES[i].bramBody) ZONE_CORPSES.splice(i,1);
      }
    }
    if(typeof _syncAshenmoorZoneEntry === 'function') _syncAshenmoorZoneEntry();
    console.log('%cBurn state reset. Walk into Ashenmoor to trigger.', 'color:#ffd700;font-weight:600');
    console.log('Current state: ashenmoorBurned=false, ashenmoorPending=true, q7=active');
    return 'OK';
  }catch(e){
    console.error('_debugResetBurn failed:',e);
    return 'ERROR: '+e.message;
  }
};
// Confirm attachment — should log once on page load if script executes this far.
console.log('%c_debugResetBurn() is ready. Type it in the console to reset the burn state.', 'color:#88ccff');

const G=document.getElementById('g'),CV=document.getElementById('c');
let REN;
try {
  REN=new THREE.WebGLRenderer({canvas:CV,antialias:true,powerPreference:'high-performance'});
} catch(e) {
  document.getElementById('ov').innerHTML='<h2 style="color:#ff8844">⚠ WebGL Required</h2><p style="color:#c8b880;margin-top:12px;font-size:13px;text-align:center;max-width:300px">This game requires WebGL which is not available here.<br><br>Save the HTML file and open it in <b style="color:#c8e88a">Chrome</b> or <b style="color:#c8e88a">Firefox</b> on your desktop.</p>';
  document.getElementById('sb').style.display='none';
  console.error('WebGL init failed:',e);
  // Don't re-throw — let the overlay message show cleanly
}
REN.setPixelRatio(Math.min(devicePixelRatio,1.5));
// v80 — shadow maps for the streamed world's sun. Other scenes have no
// shadow-casting lights, so this costs nothing outside the world.
REN.shadowMap.enabled=true;REN.shadowMap.type=THREE.PCFSoftShadowMap;
// v80 — far plane raised from 200 so the far-terrain mesh and sky dome are visible.
const CAM=new THREE.PerspectiveCamera(75,1,0.05,3400);
CAM.rotation.order='YXZ';
// Viewmodel — separate scene rendered on top, no depth conflict with world
const VM_SCENE=new THREE.Scene();
const VM_CAM=new THREE.PerspectiveCamera(55,1,0.01,10);
VM_SCENE.add(new THREE.AmbientLight(0xffffff,.8));
const VM_SUN=new THREE.DirectionalLight(0xffd080,1.2);VM_SUN.position.set(1,2,1);VM_SCENE.add(VM_SUN);
function resize(){const w=G.clientWidth,h=G.clientHeight;REN.setSize(w,h,false);CAM.aspect=w/h;CAM.updateProjectionMatrix();VM_CAM.aspect=w/h;VM_CAM.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();

let started=false,dead=false,won=false,invOpen=false,shopOpen=false,lootOpen=false,stashOpen=false;
// v61b0: pauses the main game tick during the character-creator intro
// fade. Player was getting attacked / killed by skeletons during the
// ~12s intro because enemies kept ticking AI and dealing damage while
// the overlay was up. Set true in ccBegin before the fade starts,
// cleared in the showIntroFade() resolve callback.
let _introFadeActive=false;
let _locTimer=null;
function showZoneName(text){
  const el=document.getElementById('loc');
  if(!el)return;
  clearTimeout(_locTimer);
  el.textContent=text;
  el.style.display='block';
  el.style.opacity='1';
  _locTimer=setTimeout(()=>{
    el.style.opacity='0';
    setTimeout(()=>{el.style.display='none';el.style.opacity='1';},650);
  },2200);
}
let lid='overworld',scene=null;
let px=15,pz=20,yaw=0,pitch=0;
// S468 — co-op rule (CLAUDE.md): a foe picks its target through targetOf(e), never by reading px/pz. Solo it is you.
// PLAYER_TARGET reads the live position through getters, so a call allocates nothing; a co-op build returns the nearest
// of the party here, and every foe tick follows.
const PLAYER_TARGET={get x(){return px;},get z(){return pz;},player:true};
function targetOf(e){return PLAYER_TARGET;}
let velY=0,onGround=true,jumpY=0,landShake=0; // jump physics
let fwdX=0,fwdZ=-1,rgtX=1,rgtZ=0;
let PHP=100,maxHP=100,mana=100,maxMana=100,stamina=100,maxStamina=100,staminaCD=0;
let atkCd=0,spCd=0,hurtT=0;
let xp=0,level=1,xpNext=200,kills=0,gold=0;
let swingT=0; // viewmodel swing animation timer
// v65.6 — Swing direction is now randomized per swing across three variants
// (UR→LL, UL→LR, overhead chop), latched onto vmSword.userData.swingVariant
// at swing-start. The old _lastSwingDir alternation flag is RETIRED — kept
// as a dead variable to preserve the declaration block, but no longer read
// or written. Safe to delete in a future cleanup pass.
let _lastSwingDir = -1;
const seenEnemyTypes=new Set(); // for first-kill log entries

// ── BLOCKING STATE ───────────────────────────────────────────
let blocking=false;      // is right-click held
let blockT=0;            // how long we've been blocking this press
let lastHitT=-99;        // game time when last hit landed (for late-block window)
// ── POWER ATTACK STATE (v62) ─────────────────────────────────
// Tracks whether LMB is held and how long it's been held. Set on mousedown,
// ticked in the render loop, consumed on mouseup. powerArmed is the latched
// "we crossed the threshold" flag — set once charging hits POWER_CHARGE_THRESHOLD,
// cleared on release. We track armed-state separately from charge-time so that
// (a) the "charge complete" SFX/feedback fires exactly once per charge, and
// (b) any mid-charge cancel (RMB block, hit-stun) can clear armed without recomputing.
let powerCharging=false; // LMB currently held
let powerCharge=0;       // seconds LMB has been held this press
let powerArmed=false;    // crossed POWER_CHARGE_THRESHOLD this press
// v62.5 — Screen-edge gold tint while a power attack is armed. While
// powerArmed is held, the render block writes the tint directly each frame.
// When the player releases (powerArmed flips back to false), this timer
// catches the fade-out so the gold doesn't snap off abruptly. The block-
// flash system (`blockFlashT`) is intentionally separate — block flashes
// are short-lived single events, this is a held-state indicator.
let powerFlashFadeT=0;   // fade-out timer after release, decays toward 0
// v62.7 — Forward lunge on power-attack release. A 0.4s window where the
// player's forward movement speed is multiplied to close distance during
// the swing. Fires only on a power-attack release where W (or ArrowUp) was
// held at release time, per design: tap = positionless, power = committed
// lunge. Lunge cancels on hit (hurtT > 0) — taking damage interrupts the
// commitment, matching the rest of the combat-redesign's "commitment carries
// risk" theme. Lunge also auto-cancels if W is released mid-lunge: the speed
// multiplier is applied to the existing W-driven movement vector, so letting
// go of W leaves nothing for the multiplier to act on. Player gets free
// bailout for "I changed my mind."
let lungeT=0;            // remaining lunge duration in seconds (0 = inactive)
const LUNGE_DURATION = 0.4;   // seconds of boosted forward speed
// v62.9 — Reduced from 2.4 → 1.8 after playtest found the player was
// overshooting enemies. Total lunge distance is now ~25% shorter while the
// "rush forward" feel is preserved. Tuned in tandem with the absence of mob
// collision (v63 ship) — without enemy bodies stopping the lunge, every bit
// of overshoot becomes a clean pass-through and miss. Once mob collision
// ships, this can probably bump back up since the wall-stop will handle the
// "I went too far" case naturally.
const LUNGE_SPEED_MULT = 1.8; // forward-speed multiplier during lunge (≈ 1.5× sprint)
const LUNGE_FOV = 92;         // FOV target during lunge (vs sprint's 85, idle 75)
// v62.8 — Deferred power-attack swing. Set in the mouseup handler on a
// power-attack release; ticked down each frame in the render loop. When it
// crosses zero, the actual swing-tween + hit-check fires via attack(true,true).
// During the windup, the sword stays in its cocked pose (the chargeT gate in
// the viewmodel block reads (powerArmed || powerSwingDelayT > 0)) so the
// player visually sees "rushing in with blade ready" rather than "blade
// flailing during the rush". Cancelled by death or block — NOT by hit
// (taking damage during the lunge doesn't cancel the swing per design;
// the blade is committed). Routing info cached at release time so the
// deferred fire knows whether to call attack() or attackZoneEnemies().
let powerSwingDelayT = 0;          // time remaining until deferred swing fires
let powerSwingDelayPower = false;  // whether the deferred swing is a power attack (always true in v62.8 since only power attacks are deferred)
// ── BOW DRAW STATE (v64) ─────────────────────────────────────
// LMB-hold routing diverges by weapon class. With a bow equipped, mousedown
// starts a draw (instead of a power-charge); mouseup releases an arrow if the
// draw is past BOW_DRAW_MIN. The draw is gated on having both a bow equipped
// AND ammo in EQ.ammo (otherwise mousedown falls through to the normal
// power-charge path with the bow's modest atk values as a defensive fallback
// — the bow's weight is its real weakness without arrows).
//
// Architectural pattern: weapon class determines mouse grammar. Same hook
// future weapon classes will reuse — staves (channel), crossbows (tap-fire,
// no draw). The branch site is the mousedown handler, and the predicate is
// _isBowEquipped(). Add new predicates alongside as new classes ship.
let _bowDrawing = false;     // LMB currently held with bow equipped + ammo
let _bowDrawT = 0;           // seconds of current draw (0 → BOW_DRAW_MAX)
function _isBowEquipped(){
  const w = EQ.weapon;
  return !!(w && w.weaponShape === 'bow');
}
function _hasArrows(){
  return !!(EQ.ammo && (EQ.ammo.qty||0) > 0);
}
// Draw strength normalized 0..1, clamped. Damage multiplier is a linear
// interpolation BOW_DAMAGE_MULT_MIN → BOW_DAMAGE_MULT_MAX over BOW_DRAW_MIN
// → BOW_DRAW_MAX. Below BOW_DRAW_MIN, release is rejected entirely (cancel).
function _bowDrawStrength(){
  const span = BOW_DRAW_MAX - BOW_DRAW_MIN;
  return Math.max(0, Math.min(1, (_bowDrawT - BOW_DRAW_MIN) / span));
}
// v64 — Two-handed weapon helper. Called from the equip site when a weapon
// with twoHand:true is being equipped. Moves the offhand slot's contents
// (shield/torch/etc.) to the inventory bag, clears EQ.offhand, refreshes the
// shield viewmodel. The bow ship is the first user; the claymore/great
// axe/war hammer ship reuses this verbatim — DO NOT inline the body.
//
// Returns the displaced item (or null) for the equip path to message about.
function _clearOffhandForTwoHander(reason){
  const off = EQ.offhand;
  if(!off) return null;
  EQ.offhand = null;
  bagAdd({...off, qty:1});
  // buildShieldViewmodel handles the null case (clears any existing mesh).
  if(typeof buildShieldViewmodel === 'function') buildShieldViewmodel();
  return off;
}
// ── POINTER LOCK MENU RELEASE (v62.4) ────────────────────────
// Module-scope helper so every open* function can call it. Chrome's pointer-
// lock heuristics silently reject programmatic exitPointerLock() calls that
// happen on a delayed/decoupled callback — but accept the call cleanly when
// invoked synchronously from the user-gesture handler that opened the menu.
// Calling this AT THE TOP OF every open* function ensures the release happens
// inside that gesture's tick (player presses I → openHub fires → exit fires →
// menu shows). The reconciler still calls exit as a defense-in-depth fallback
// for any code paths that didn't go through an open* function. Cursor-toggle
// trick in pointerlockchange handler forces the OS cursor cache to invalidate.
function _releasePointerLockForMenu(){
  if(document.pointerLockElement){
    try{ document.exitPointerLock(); }catch(_){}
  }
}
// v61c6 — Tracks when blocking was last engaged. Set when the block input
// fires (right-click mousedown). The "late block" branch in executeStrike
// gates on this so the player must actually have attempted to block for
// the forgiveness window to apply. Pre-v61c6 the late-block fired purely
// on hit-recency, which auto-treated every back-to-back hit as blocked
// even if the player never raised guard — produced false "Blocked!"
// messages during multi-attacker fights (boss + lessers).
let lastBlockAttemptT=-99;
// S368 — the play clock: seconds of play, the loop's capped dt summed (the clock a foe's wind-up runs on). The parry window
// is read on it, so a slow frame between the block and the blow cannot close the window (the critic, s321)
let playClockS=0,lastBlockAttemptG=-99;
// S408 — when the player last began a blow (a swing, an arrow, a cast), on playClockS: the duel's yield checks a blow begun within 0.4 s of it
let _offenceS=-1e9;
// S275 — the roll (combat, Michael's B: A's first piece). Q rolls you (keys: the held-key map, which lives in the loop's scope) the way you are moving, or back if you are
// standing. Light: 0.45 s over 2.6 units, untouchable from 0.08 to 0.30 s. Carrying over 70% of what you can: 0.6 s
// over 1.8 units, untouchable 0.08–0.24 s. 18 stamina either way. Distance and window read performance.now(), so a
// dropped frame changes neither.
const ROLL_LIGHT={dur:.45,dist:2.6,i0:.08,i1:.30},ROLL_HEAVY={dur:.6,dist:1.8,i0:.08,i1:.24},ROLL_STAM=18,ROLL_HEAVY_AT=.7;
let ROLL=null;
function rollUntouchable(nowS){if(nowS<FINISHER_SAFE_UNTIL)return true;if(!ROLL)return false;const t=nowS-ROLL.t0;return t>=ROLL.i0&&t<=ROLL.i1;}
function startRoll(nowS,keys){
  const K=keys||{};
  if(!ROLL&&!dead&&started&&!onGround)FALL.qAt=FALL.clock; // S429 — pressed in the air: rolled on landing if it is within FALL_ROLL_WIN
  if(ROLL||dead||!started||!onGround||playerStaggered(nowS))return false;
  if(typeof WORLD!=='undefined'&&activeZoneId==='world'&&WORLD.isSwimming())return false;
  if(typeof spellLevitating==='function'&&spellLevitating())return false;
  const enc=encumbranceState();if(enc==='immobile')return false;
  if(stamina<ROLL_STAM||staminaCD>0){showMsg('Too winded to roll.','#dd8844');flashStamina();return false;}
  let mx=0,mz=0;
  if(K['KeyW']||K['ArrowUp']){mx+=fwdX;mz+=fwdZ;}
  if(K['KeyS']||K['ArrowDown']){mx-=fwdX;mz-=fwdZ;}
  if(K['KeyA']){mx-=rgtX;mz-=rgtZ;}
  if(K['KeyD']){mx+=rgtX;mz+=rgtZ;}
  if(!mx&&!mz){mx=-fwdX;mz=-fwdZ;}
  const l=Math.hypot(mx,mz)||1;mx/=l;mz/=l;
  const heavy=totalCarryWeight()/maxCarry()>ROLL_HEAVY_AT,sp=heavy?ROLL_HEAVY:ROLL_LIGHT;
  blocking=false;powerCharging=false;powerCharge=0;powerArmed=false;lungeT=0;
  stamina=Math.max(0,stamina-_stamCost(ROLL_STAM));if(stamina===0){staminaCD=2;lvAct.staminaDepleted++;}
  ROLL={t0:nowS,dur:sp.dur,dist:sp.dist,i0:sp.i0,i1:sp.i1,dx:mx,dz:mz,done:0,heavy,fwd:(mx*fwdX+mz*fwdZ)>=-.01?1:-1};
  if(FALL.pend)fallSettle(true); // S429 — a roll within 0.2 s of landing halves the fall
  try{sndJump();}catch(err){}
  return true;
}
// the roll's move this frame, {dx,dz,p}, or null; the way you go eases out, fast off the mark and slowing to your feet
function tickRoll(nowS){
  if(!ROLL)return null;
  const p=Math.min(1,Math.max(0,(nowS-ROLL.t0)/ROLL.dur)),want=ROLL.dist*(1-(1-p)*(1-p)),step=want-ROLL.done;ROLL.done=want;
  const r={dx:ROLL.dx*step,dz:ROLL.dz*step,p};
  if(p>=1)ROLL=null;
  return r;
}
// S429 — falls hurt (platforming, Michael's B on the designer's page, 2 Oct 2026): free up to FALL_FREE units, then
// FALL_PER of your health a unit beyond, so about 21 units from full is death. The drop is from the highest point of
// the time in the air to where you land. The blow waits FALL_ROLL_WIN after landing: a roll begun in that window (or
// pressed in the air that long before) halves it. The clock is the loop's dt, so a dropped frame changes nothing.
// A change of place (a door, a zone, a dungeon) or a jump of more than 3 units in a frame (travel) starts the count again.
// Water and Levitate are not landings. Acrobatics' Cat's fall and Éan's Wingless wait for the skills build.
const FALL_FREE=4,FALL_PER=.06,FALL_ROLL_WIN=.2;
const FALL={top:null,key:'',x:0,z:0,clock:0,qAt:-9,pend:null,last:null};
function fallKey(){return lid+'|'+activeZoneId+'|'+(isInterior()&&currentHouse?currentHouse.id:'');}
// called by the loop once a frame, after the jump physics
function fallTrack(dt){
  FALL.clock+=dt;
  if(FALL.pend){FALL.pend.t-=dt;if(FALL.pend.t<=0)fallSettle(false);}
  if(onGround||dead){FALL.top=null;return;}
  const k=fallKey(),lev=typeof spellLevitating==='function'&&spellLevitating();
  if(FALL.top==null||lev||k!==FALL.key||Math.hypot(px-FALL.x,pz-FALL.z)>3){FALL.top=jumpY;FALL.key=k;}
  else FALL.top=Math.max(FALL.top,jumpY);
  FALL.x=px;FALL.z=pz;
}
// called where the loop lands you; y is the ground you landed on. Returns the drop.
function fallLand(y){
  const top=FALL.top;FALL.top=null;
  if(top==null||fallKey()!==FALL.key||Math.hypot(px-FALL.x,pz-FALL.z)>3)return 0;
  const drop=top-y;
  if(drop>FALL_FREE&&!dead){
    const dmg=Math.max(1,Math.round(maxHP*FALL_PER*(drop-FALL_FREE)));
    FALL.pend={dmg,drop,t:FALL_ROLL_WIN};
    landShake=Math.min(.3,.06+.02*(drop-FALL_FREE));
    if(FALL.clock-FALL.qAt<=FALL_ROLL_WIN&&typeof window!=='undefined'&&window._K)startRoll(performance.now()/1000,window._K);
  }
  return drop;
}
function fallSettle(rolled){
  const p=FALL.pend;FALL.pend=null;if(!p||dead)return;
  const dmg=rolled?Math.max(1,Math.round(p.dmg/2)):p.dmg;
  FALL.last={drop:+p.drop.toFixed(2),dmg,rolled};
  PHP=Math.max(0,PHP-dmg);lvAct.damageTaken+=dmg;updateHUD();
  showMsg(rolled?`You roll with the fall. ${dmg} damage.`:`A hard landing. ${dmg} damage.`,'#ff6060');
  if(PHP<=0&&!dead)playerDead();
}
// S281 — the player's posture (combat, Michael's B: A's third piece). 100 + 2 an armour point. An unblocked blow
// drains its damage ×1.5, one taken on a held block its damage ×1, a perfect parry nothing. Empty, you are staggered
// 0.8 s and open: the guard drops, and you can't swing, block, roll or step. You come out of it with it full; otherwise
// it refills as an enemy's does (5 a second, 1.5 s after the last blow; POSTURE_REGEN). The stagger reads performance.now().
const PPOST={posture:100,maxPosture:100,lastHitAt:0,stagUntil:0},PLAYER_STAGGER_S=.8;
function playerMaxPosture(){return 100+2*Object.values(EQ).reduce((a,v)=>a+(v&&v.def?v.def:0),0);}
function playerStaggered(nowS){return nowS<PPOST.stagUntil;}
function playerPostureHit(amount,nowS,guard){
  PPOST.maxPosture=playerMaxPosture();
  PPOST.lastHitAt=nowS;
  if(playerStaggered(nowS))return false;
  PPOST.posture=Math.max(0,Math.min(PPOST.posture,PPOST.maxPosture)-amount);
  if(PPOST.posture>0)return false;
  PPOST.stagUntil=nowS+PLAYER_STAGGER_S;PPOST.broke=true;
  blocking=false;powerCharging=false;powerCharge=0;powerArmed=false;lungeT=0;powerSwingDelayT=0;_bowDrawing=false;ROLL=null;
  landShake=.14;
  showMsg(guard?'Your guard breaks!':'You are knocked off balance!','#ff9040');
  return true;
}
function tickPlayerPosture(dt,nowS){
  PPOST.maxPosture=playerMaxPosture();
  if(!playerStaggered(nowS)){
    if(PPOST.broke){PPOST.broke=false;PPOST.posture=PPOST.maxPosture;}
    else if(nowS-PPOST.lastHitAt>=POSTURE_REGEN_DELAY)PPOST.posture=Math.min(PPOST.maxPosture,PPOST.posture+POSTURE_REGEN*dt);
  }
  PPOST.posture=Math.min(PPOST.posture,PPOST.maxPosture);
  const b=document.getElementById('psb'),w=document.getElementById('psw');
  if(b&&w){const f=PPOST.posture/PPOST.maxPosture;b.style.width=(f*100)+'%';b.style.background=playerStaggered(nowS)?'#c04030':'#c8a84a';w.style.opacity=f<.999||playerStaggered(nowS)?'1':'0';}
}
// S297 — lock-on (combat, Michael's B). The middle mouse button locks the nearest foe you are looking towards, within
// 14 units and 60° of your view; pressed again, it lets go. While locked the view turns to hold the foe (yaw and pitch
// eased, the mouse set aside), in both views; A/D then circle it, since strafing runs across the view, and the roll
// already goes the way you press. It lets go by itself when the foe dies, leaves the fight (another floor, another zone)
// or is more than 20 units off. A small gold diamond marks the foe.
const LOCK_RANGE=14,LOCK_CONE=Math.cos(Math.PI/3),LOCK_BREAK=20;
const LOCK={t:null,h:1,hid:0,chk:0};
// S311 — the lock needs a clear line: a foe behind a wall can't be locked, and one that stays behind a wall for
// LOCK_HIDDEN seconds is let go. The same solids the foes' own sight uses (the dungeon's walls; in the open world the
// camera's solids, so trunks and posts don't hide a foe), stepped every 0.4 units, sparing the half-unit at either end.
const LOCK_HIDDEN=1.5,LOCK_CHECK=.15;
function lockSolidFn(){
  if(activeZoneId==='dungeon')return dSolid;
  if(activeZoneId==='world'&&typeof WORLD!=='undefined'&&WORLD.camSolid)return WORLD.camSolid;
  return currentZoneSolid;
}
function lockSight(e){
  if(typeof isInterior==='function'&&isInterior()&&typeof WORLD!=='undefined'&&WORLD.intSightLine)return WORLD.intSightLine(px,pz,e.x,e.z); // S314 — in a room, its walls and shut doors (the witnesses' line), not the world's solids at room coordinates
  const sol=lockSolidFn(),dx=e.x-px,dz=e.z-pz,d=Math.hypot(dx,dz);if(d<1.2)return true;
  const n=Math.ceil((d-1)/.4);
  for(let i=0;i<=n;i++){const r=(.5+(d-1)*i/n)/d;if(sol(px+dx*r,pz+dz*r))return false;}
  return true;
}
function lockPool(){
  if(activeZoneId==='dungeon')return ENEMIES.filter(e=>!e.dead&&e.hp>0&&e.floor===currentFloor&&!e.disguised&&e.mesh);
  return ZE.filter(e=>!e.dead&&e.hp>0&&!e.locked&&e.mesh);
}
function lockPick(){
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw);let best=null,bs=1e9;
  for(const e of lockPool()){
    const dx=e.x-px,dz=e.z-pz,d=Math.hypot(dx,dz);if(d>LOCK_RANGE||d<1e-3)continue;
    const c=(dx*fx+dz*fz)/d;if(c<LOCK_CONE)continue;
    const s=d*(2-c);if(s<bs&&lockSight(e)){bs=s;best=e;}
  }
  return best;
}
function lockOn(e){
  LOCK.t=e;LOCK.h=1;LOCK.hid=0;LOCK.chk=0;LOCK.blind=false;
  try{const b=new THREE.Box3().setFromObject(e.mesh);if(isFinite(b.max.y))LOCK.h=Math.max(.3,Math.min(3,(b.max.y-e.mesh.position.y)*.6));}catch(err){}
}
function lockRelease(){LOCK.t=null;const m=document.getElementById('lockmk');if(m)m.style.display='none';}
function toggleLock(){
  if(LOCK.t){lockRelease();return false;}
  if(dead||!started)return false;
  const e=lockPick();
  if(!e){showMsg('Nothing to lock on to.','#aaa');return false;}
  lockOn(e);return true;
}
// S312 — switching foes while locked: a sideways flick of the mouse (LOCK_FLICK pixels within LOCK_FLICK_MS) moves the
// lock to the next foe on that side of the one held, the nearest by angle as seen from you; the same reach, cone-free,
// and the same clear line as a fresh lock. Nothing on that side, the lock stays. After a switch the mouse is ignored
// for a moment so one flick moves the lock once.
const LOCK_FLICK=90,LOCK_FLICK_MS=200,LOCK_FLICK_REST=250;
const LFL={sum:0,t0:0,rest:0};
function lockSwitch(dir){
  const cur=LOCK.t;if(!cur)return false;
  const bx=cur.x-px,bz=cur.z-pz,bd=Math.hypot(bx,bz)||1,fx=bx/bd,fz=bz/bd,rx=-fz,rz=fx;
  let best=null,ba=1e9;
  for(const e of lockPool()){
    if(e===cur)continue;const dx=e.x-px,dz=e.z-pz,d=Math.hypot(dx,dz);if(d>LOCK_RANGE||d<1e-3)continue;
    const a=Math.atan2(dx*rx+dz*rz,dx*fx+dz*fz)*dir;if(a<=.03)continue;
    if(a<ba&&lockSight(e)){ba=a;best=e;}
  }
  if(!best)return false;
  lockOn(best);return true;
}
function lockFlick(mx,now){
  if(!LOCK.t)return;
  if(now<LFL.rest){LFL.sum=0;return;}
  if(now-LFL.t0>LOCK_FLICK_MS||Math.sign(mx)!==Math.sign(LFL.sum)){LFL.sum=0;LFL.t0=now;}
  LFL.sum+=mx;
  if(Math.abs(LFL.sum)>=LOCK_FLICK){const dir=Math.sign(LFL.sum);LFL.sum=0;LFL.rest=now+LOCK_FLICK_REST;lockSwitch(dir);}
}
function lockValid(e){
  if(!e||e.dead||!(e.hp>0)||!e.mesh||dead)return false;
  if(lockPool().indexOf(e)<0)return false;
  return Math.hypot(e.x-px,e.z-pz)<=LOCK_BREAK;
}
// turns the view to the foe; run before the frame's facing (fwdX…) is taken from yaw
function tickLock(dt){
  if(!LOCK.t)return;
  if(!lockValid(LOCK.t)){lockRelease();return;}
  const e=LOCK.t,dx=e.x-px,dz=e.z-pz,d=Math.hypot(dx,dz);
  LOCK.chk-=dt;
  if(LOCK.chk<=0){LOCK.chk=LOCK_CHECK;LOCK.blind=!lockSight(e);}
  if(LOCK.blind){LOCK.hid+=dt;if(LOCK.hid>=LOCK_HIDDEN){lockRelease();return;}}else LOCK.hid=0;
  if(d>.05){let dy=Math.atan2(-dx,-dz)-yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));yaw+=dy*Math.min(1,dt*12);}
  const ty=e.mesh.position.y+LOCK.h,ey=CAM.position.y,hd=Math.hypot(e.x-CAM.position.x,e.z-CAM.position.z)||d||1;
  const wp=Math.max(-.7,Math.min(.5,Math.atan2(ty-ey,hd)-.06));
  pitch+=(wp-pitch)*Math.min(1,dt*8);
}
const _lockV=new THREE.Vector3();
function drawLockMark(){
  const m=document.getElementById('lockmk');if(!m)return;
  const e=LOCK.t;if(!e||!e.mesh){m.style.display='none';return;}
  _lockV.set(e.mesh.position.x,e.mesh.position.y+LOCK.h,e.mesh.position.z).project(CAM);
  if(_lockV.z>1||_lockV.z<-1){m.style.display='none';return;}
  m.style.display='block';m.style.left=((_lockV.x+1)/2*100)+'%';m.style.top=((1-_lockV.y)/2*100)+'%';
}
let staggered=[];       // enemies currently staggered {e, t}
let vmShield=null;       // shield viewmodel mesh group
let blockFlashT=0;       // blue/gold vignette timer
let blockFlashCol='';    // '#4488ff' normal, '#ffd700' parry
// v61gj-a2 — Parry timing window. Perfect parry now requires the block to have
// been raised within this window before the hit lands. Holding-block-and-waiting
// no longer auto-parries. Scales with Finesse (+10ms per point per redesign doc).
const PARRY_WINDOW_BASE = 0.20;     // 200ms base window
const PARRY_WINDOW_FINESSE = 0.01;  // +10ms per Finesse point
// v61gj-a2 — Impact recoil state. Set by shieldImpact() when a hit lands, decays
// to zero each frame in the viewmodel animation block. Sword has its own state so
// bare-hand blocking can recoil even without a shield equipped.
let shieldImpactX = 0, shieldImpactZ = 0, shieldImpactRot = 0;
let shieldImpactT = 0, shieldImpactMax = 0;
let swordImpactX = 0, swordImpactZ = 0, swordImpactRot = 0;
let swordImpactT = 0, swordImpactMax = 0;
// shieldImpact(kind, rawDmg, attackerWorldX, attackerWorldZ): triggers a recoil
// impulse on the shield viewmodel (and the sword as fallback for bare-hand blocks).
// `kind` is 'parry' (forward kick — you shoved the strike outward) or 'block'
// (backward push — you absorbed it). Magnitude scales with rawDmg so a 32-dmg bite
// recoils harder than a 5-dmg nick. Direction is converted from world-space to
// camera-local using the player's fwd/right vectors, so hits from the player's
// flank jostle the shield laterally — meaningful during pack fights, near-zero
// during 1v1 with the enemy dead-ahead.
function shieldImpact(kind, rawDmg, ax, az){
  const sh = EQ.offhand;
  const hasShield = sh && sh.shieldType === 'shield';
  // Normalise damage to a 0..1 magnitude. 30 damage = full kick; weaker hits scale
  // down linearly. Clamp at 1.0 so a Faolchú phase-3 bite doesn't break the model.
  const mag = Math.min(1.0, Math.max(0.15, rawDmg / 30));
  // Convert world-relative attack vector to camera-local. `localRight` is +1 for
  // an attacker to the player's right, -1 for left. `localForward` is +1 for
  // dead-ahead, -1 for directly behind.
  const dx = ax - px, dz = az - pz;
  const dist = Math.hypot(dx, dz) || 1;
  const wx = dx / dist, wz = dz / dist;
  const localRight   = wx * rgtX + wz * rgtZ;
  const localForward = wx * fwdX + wz * fwdZ;
  if(hasShield){
    if(kind === 'bash'){
      // v71 — BASH. A deliberate forward thrust INTO the enemy, not a recoil.
      // Dominated by a large forward translation (−Z = away from camera, toward
      // the target); only a touch of outward rotation so it reads as a punch, not
      // a twist. localForward is ~1.0 for the dead-ahead synthetic target doBash
      // passes, so the shield drives straight out and snaps back.
      shieldImpactX = 0.02 * mag * localRight;
      shieldImpactZ = -0.42 * mag;                   // big shove forward into the enemy
      shieldImpactRot = -0.18 * mag;                 // slight outward cant, not a spin
      shieldImpactT = 0.26; shieldImpactMax = 0.26;  // fast, punchy
    } else if(kind === 'parry'){
      // Parry — sharp forward shove (you deflected the strike outward toward the
      // attacker). Direction component: shield kicks toward the threat's side.
      shieldImpactX = 0.06 * mag * localRight;       // jostle toward attacker side
      shieldImpactZ = -0.08 * mag * Math.max(0.4, localForward); // forward toward threat
      shieldImpactRot = -0.55 * mag;                 // rotate as if punching outward
      shieldImpactT = 0.35; shieldImpactMax = 0.35;  // sharp, fast recovery
    } else {
      // Held block — backward absorption. You got pushed back.
      shieldImpactX = -0.03 * mag * localRight;      // small lateral jostle opposite to attacker
      shieldImpactZ = 0.10 * mag * Math.max(0.4, localForward); // pushed back toward player
      shieldImpactRot = 0.35 * mag;                  // rotate as if shoved
      shieldImpactT = 0.50; shieldImpactMax = 0.50;  // slower, heavier settle
    }
  } else {
    if(kind === 'bash'){
      // v71 — Weapon/bare bash. A pommel strike / weapon shove: thrust the sword
      // forward into the enemy. Same punch-out shape as the shield bash, on the
      // sword viewmodel. Strong −Z translation, minimal rotation.
      swordImpactX = 0.02 * mag * localRight;
      swordImpactZ = -0.40 * mag;                    // shove forward
      swordImpactRot = -0.12 * mag;                  // slight cant
      swordImpactT = 0.26; swordImpactMax = 0.26;
    } else {
      // Bare-hand: sword recoils backward regardless of branch. There's no real
      // bare-hand "parry" in the physical sense — you're catching the blow on your
      // sword arm, not deflecting it outward. The mechanic still rewards timing
      // (parry zeros damage + staggers); the visual just sells "this hit landed."
      swordImpactX = -0.04 * mag * localRight;
      swordImpactZ = 0.07 * mag * Math.max(0.4, localForward);
      swordImpactRot = 0.30 * mag;
      swordImpactT = 0.40; swordImpactMax = 0.40;
    }
  }
}

// ── POSTURE SYSTEM (v61gj) ──────────────────────────────────
// Hidden posture meter on every melee enemy. Drains with hits, regens out of
// combat. Empty → forced stagger window. Parry-into-staggered-crit chain is
// the highest-DPS option in melee. The applyPostureDamage helper is intentionally
// generalised — works on any entity with a `posture` field — so player-stagger
// can drop in cleanly in a later ship by just adding the field to the player.
const POSTURE_REGEN = 5.0;          // posture/sec regen when not hit for 1.5s
const POSTURE_REGEN_DELAY = 1.5;    // seconds after last hit before regen begins
const POSTURE_DRAIN_NORMAL = 8;     // normal melee swing drains this much posture
const POSTURE_DRAIN_POWER = 25;     // power attack drains this much (3.1× normal)
const POSTURE_BREAK_STUN = 1.5;     // stagger duration on posture break (seconds)
const POSTURE_CRIT_MULT = 1.5;      // damage multiplier when striking a staggered enemy
// S298 — the counters (combat, Michael's B). A perfect parry drains 40% of the foe's posture and opens a riposte for 0.8 s:
// the first swing begun in it lands ×2.5 and goes through a raised shield, however late its blade arrives. A broken
// posture opens a finisher from the front for as long as the stagger lasts: the first blow from the foe's front half is
// ×3 and leaves you untouchable for 1.2 s (rollUntouchable reads it). Other blows on a staggered foe keep today's ×1.5.
const RIPOSTE_S=.8,RIPOSTE_MULT=2.5,RIPOSTE_POSTURE=.4,FINISHER_MULT=3,FINISHER_SAFE_S=1.2;
let _swingStartS=-1e9,FINISHER_SAFE_UNTIL=0;
function riposteOpen(e){return !!e&&typeof e._ripUntil==='number'&&_swingStartS>=e._ripAt&&_swingStartS<=e._ripUntil;}
function finisherOpen(e,nowS){
  if(!e||!(e._finUntil>nowS)||!isStaggered(e))return false;
  if(typeof e.combatYaw!=='number')return true;
  const dx=px-e.x,dz=pz-e.z,d=Math.hypot(dx,dz)||1;
  return (Math.sin(e.combatYaw)*dx+Math.cos(e.combatYaw)*dz)/d>=0;
}
// v71 — Bash (block-bash). Hold RMB (blocking) + click LMB → a guard-bash that
// staggers nearby enemies. NO damage — pure control, parallel to the player-side
// parry → enemy-stagger loop. Two strengths per the v71 design (D):
//   • With a shield equipped → FULL force-break (drains max posture, instant
//     stagger on any breakable enemy). The shield is a real bashing surface.
//   • Bare / weapon-only ("pommel strike / weapon shove") → a big posture chunk
//     (BASH_BARE_POSTURE) that breaks weak enemies outright but only dents a
//     brute. Matches the v65 "no real absorbing surface" register.
// A raised Shieldbearer guard (shieldUp) is IMMUNE to bash (design call G) — the
// shield is exactly the thing a bash can't crack; flank it or power-attack it.
const BASH_BARE_POSTURE = 20;       // posture drained by a bare/weapon-only bash (2.5× a normal swing)
const BASH_RANGE = 2.0;             // slightly shorter than a swing's 2.2 — it's a shove, not a reach
const BASH_CONE_COS = 0.45;         // same front cone as a swing (~117°)
const BASH_STAM_BARE = 10;          // flat stamina for a weapon-only/bare bash

// v65 — Two-handed weapon constants. Per-weapon postureMult is a multiplier on
// the existing POSTURE_DRAIN_* values, applied at the call site in attack() and
// attackZoneEnemies(). A weapon's postureMult comes from its WEAPON_TYPES entry
// (1H weapons have no field → 1.0 fallback). Cleave is the new cap on
// how many enemies a single swing hits — defaults to 1 for 1H, overridden per
// 2H WEAPON_TYPES entry (claymore 3, great axe 2, war hammer 1 + dmg comp).
const CLEAVE_DEFAULT = 1;           // 1H weapons hit exactly one target per swing
// Block reduction tier. Shields ~0.65, steel 2H ~0.50, wooden 2H ~0.40, bare/1H 0.35.
// Encoded on WEAPON_TYPES entries via blockReduce; falls back to 0.35 if absent.
const BLOCK_REDUCE_NO_SHIELD = 0.35;  // default bare-hand / 1H-no-shield rate
// ── BACKSTAB SYSTEM (Combat Redesign Session 2) ─────────────
// Backstab is POSITIONAL: the player must be physically behind the enemy
// when the strike lands. "Behind" is measured against the enemy's combatYaw —
// a stored facing that captures where the enemy was looking at the moment
// they committed to their current action. Idle enemies update combatYaw
// every tick (they pivot freely to face the player; their back is always
// away from you). Mid-attack enemies (telegraphT > 0 windup, or atkCd > 0
// recovery) have combatYaw FROZEN at the start of windup — the player can
// sidestep their swing and circle into their back arc during their
// commitment window. Unaware enemies (e.alert false) use their last
// patrol/idle yaw, naturally exposing their back to a stealth approach.
//
// Daggers are the dedicated backstab weapon and carry a substantially higher
// multiplier; other weapons get a modest bonus so positioning matters even
// for sword/mace builds. Backstab and the staggered-crit are DISTINCT
// bonuses — a backstab on a staggered enemy stacks multiplicatively
// (×3.0 × ×1.5 = ×4.5 for dagger) but the player must EARN both: parry
// to stagger, then sprint around to land the strike from behind.
//
// Bosses, dormant enemies (Gargoyle statue form already gets ×2 dormant),
// slimes (no clear facing), and ranged enemies (Phantom/Wraith/Fire Elemental —
// no melee telegraph yet, will revisit in Bow session) are all excluded.
const BACKSTAB_DAGGER_MULT = 3.0;   // dagger-type weapon backstab multiplier
const BACKSTAB_OTHER_MULT = 1.5;    // all other weapon types backstab multiplier
const BACKSTAB_CONE_COS = -0.259;   // cos(105°). Player is "behind" enemy when
                                    // dot(enemyForward, enemy→player) < this.
                                    // Per the locked design call: 150° back cone
                                    // = ±75° from dead-rear. cos(180°−75°) =
                                    // cos(105°) = -0.259. Generous to player
                                    // without trivializing — they still have to
                                    // clear the side arcs into true rear.
// Player-from-enemy facing test. Returns true if the player is in the
// enemy's rear arc per BACKSTAB_CONE_COS. Uses combatYaw (stored facing
// frozen during attacks, live during idle) rather than the visual mesh
// rotation, which always lookAt's the player.
function isPlayerBehind(e){
  if(typeof e.combatYaw !== 'number') return false; // no stored facing yet
  // Enemy's forward direction in world XZ.
  const fX = Math.sin(e.combatYaw);
  const fZ = Math.cos(e.combatYaw);
  // Vector from enemy to player, normalized in XZ.
  const dx = px - e.x;
  const dz = pz - e.z;
  const dist = Math.hypot(dx, dz) || 1;
  const nx = dx / dist;
  const nz = dz / dist;
  // Dot product: 1 = directly in front, -1 = directly behind.
  const dot = fX * nx + fZ * nz;
  return dot < BACKSTAB_CONE_COS;
}
// Returns the backstab multiplier to apply to the given enemy. Returns 1.0
// (no bonus) when the enemy is excluded, the player isn't behind the enemy
// per its combatYaw, or no eligible state. Otherwise returns the dagger or
// other-weapon multiplier.
function applyBackstab(e){
  if(!e) return 1.0;
  // Exclusion list — bosses and slimes don't have a stable "back," dormant
  // enemies already get a dormant ×2 multiplier we don't want to compound,
  // ranged enemies don't enter the telegraph state that gives backstab a
  // window (revisit in Bow session).
  if(e.isBoss) return 1.0;
  if(e.dormant) return 1.0;
  if(e.ranged) return 1.0;
  if(enemyPostureFamily(e) === 'slime') return 1.0;
  // Positional check — is the player actually behind the enemy?
  if(!isPlayerBehind(e)) return 1.0;
  // Weapon type — daggers are the dedicated backstab weapon. We check
  // weaponShape (the authoritative field; pierce-type covers daggers but
  // could theoretically apply to future spears, so shape is the right gate).
  if(EQ.weapon && EQ.weapon.weaponShape === 'dagger') return BACKSTAB_DAGGER_MULT;
  // Non-dagger weapon (or bare hand) — the other-weapon bonus still applies
  // to reward positioning on swords/maces. Bare hand (no EQ.weapon) still
  // counts — you snuck up on them, you get the bonus.
  return BACKSTAB_OTHER_MULT;
}
// v71 — Shieldbearer frontal block. A raised guard (shieldUp:true) reduces
// FRONTAL melee damage to this fraction until the guard is broken. Flanking /
// rear-cone hits bypass it entirely (the player is behind → no block), so the
// v63 positional system is the alternative answer to a power-attack guard break.
const SHIELDBEARER_FRONT_BLOCK = 0.35;  // frontal hits do 35% until guard breaks
// Returns the damage multiplier a shielded enemy imposes on an incoming melee
// hit. 1.0 (no reduction) unless the enemy currently has shieldUp AND the hit
// is from the front (player not in the rear cone). Power attacks never reach
// here — they branch to the force-break path before damage resolves.
function shieldFrontMult(e){
  if(!e || !e.shieldUp) return 1.0;
  if(isPlayerBehind(e)) return 1.0;   // flanked — shield doesn't cover the back
  return SHIELDBEARER_FRONT_BLOCK;
}
// ── SNEAK SYSTEM (Combat Redesign Session 2 — Stealth Approach) ───────
// Sneak is a movement state toggled with Ctrl. While active:
//   1. Enemy detection radius is multiplied by _sneakDetectMult() — base
//      0.7 (30% reduction) with -1% per Finesse point. At Finesse 0 = 0.7×;
//      at Finesse 10 = 0.6× (40% reduction). Conservative scaling keeps the
//      baseline useful without making high-Finesse builds invisible.
//   2. Movement speed is multiplied by SNEAK_MOVE_MULT (0.7×). A gentle
//      penalty — sneaking is slightly slower walking, not a crawl.
//   3. The HUD shows a "SNEAKING" indicator (bottom-left) and a subtle
//      dark vignette fades in around the screen edges.
//
// Sneak STACKS multiplicatively with the existing detectReduce potion buff
// (Muirfhear Shroud at 0.70×). At Finesse 10 with the potion active, total
// detection multiplier is 0.6 × 0.70 = 0.42× — substantial stealth synergy.
//
// Toggle (not hold) because sneak is a sustained movement state, not an
// instantaneous action. Ctrl press flips _sneaking; persists through
// inventory/dialog. Excluded from input handling while modals are open.
//
// Design note: sneak does NOT break stealth automatically on attack. A
// successful backstab from sneak alerts enemies normally via their post-
// damage alert flag — the player gets ONE big hit, then combat begins.
// Sneaking during active combat still reduces detection radius for
// re-detection windows but doesn't make alert enemies forget the player.
const SNEAK_DETECT_BASE = 0.7;        // base sneak detection multiplier
const SNEAK_DETECT_PER_FINESSE = 0.01;// each Finesse point reduces by this
const SNEAK_MOVE_MULT = 0.7;          // movement speed multiplier while sneaking
// v63 — Vision cone + hearing. Detection is now directional: enemies see in
// a forward arc (150° total, 75° each side of their combatYaw) AND have a
// small omnidirectional "hearing" radius. The player can sneak behind an
// enemy at sight-detection ranges and not be seen; getting within 1.5u
// alerts regardless of facing (you brushed past them). Together with the
// existing LOS check (walls block sight in both zone + dungeon), this
// makes flanking and stealth approach actually viable.
// cos(VISION_CONE_HALF) is the dot-product threshold; 75° → cos = 0.259.
// Player is "in vision cone" when dot(forward, toPlayer) > VISION_CONE_COS.
const VISION_CONE_COS = 0.259;        // cos(75°) — half-angle of vision cone
const HEARING_RADIUS = 0.5;           // omnidirectional detection radius (units)
// Directional detection predicate. Returns true if the enemy can detect
// the player given current distance, sneak state, and facing. Detection
// fires when EITHER:
//   1. Distance < HEARING_RADIUS (omnidirectional; you brushed past them)
//   2. Distance < sightRadius AND player is in forward vision cone
// sightRadius is passed in (different for zone vs dungeon — 9u vs 3.5u
// historically) and is modulated by both detectReduce buffs and sneak.
// LOS is NOT checked here — caller does that with its own solid function.
// Uses e.combatYaw which is the canonical facing field (frozen during
// attacks, live during idle alert, randomized at spawn for unaware enemies).
function canSeePlayer(e, dist, baseSightRadius){
  const sightMult = _buffMult('detectReduce', 1) * _sneakDetectMult();
  const sightRadius = baseSightRadius * sightMult;
  // Hearing: omnidirectional, NOT modulated by sneak. The player is
  // literally next to them — facing irrelevant. This is the "you can't
  // sneak through someone" guarantee.
  if(dist < HEARING_RADIUS) return true;
  // Sight: requires distance AND forward cone. If combatYaw isn't set
  // (shouldn't happen post-spawn-init, but defensive), fall back to
  // omnidirectional at the sight radius.
  if(dist >= sightRadius) return false;
  if(typeof e.combatYaw !== 'number') return true;
  const fX = Math.sin(e.combatYaw);
  const fZ = Math.cos(e.combatYaw);
  const dx = px - e.x, dz = pz - e.z;
  const nx = dx / dist, nz = dz / dist;
  const dot = fX * nx + fZ * nz;
  return dot > VISION_CONE_COS;
}
// v63 — Crouch visuals. Eye height lowers from EYE_STAND (0.92) to EYE_CROUCH
// (0.60) while sneaking, smoothed via exponential lerp at CROUCH_LERP_RATE.
// Rate ≈ 10 gives ~95% completion in 0.30s (weighted-but-responsive transition).
// Headbob is halved while sneaking via SNEAK_BOB_MULT — subtler movement
// completes the body-state visual without needing skeletal animation.
const EYE_STAND = 0.92;               // standing eye height (legacy EYE_HEIGHT)
const EYE_CROUCH = 0.60;              // crouched eye height (~35% drop)
const CROUCH_LERP_RATE = 10;          // exponential lerp k for camera height
const SNEAK_BOB_MULT = 0.5;           // headbob amplitude multiplier while sneaking
let _sneaking = false;                // sneak state — toggled by Ctrl
let _eyeHeightCur = EYE_STAND;        // smoothed current eye height (lerps each frame)
// Combined sneak detection multiplier. Returns 1.0 when not sneaking
// (no effect on detection); otherwise base minus Finesse scaling, clamped
// to a floor of 0.25 so even very high Finesse doesn't go to zero.
function _sneakDetectMult(){
  if(!_sneaking) return 1.0;
  const fin = attrEff('finesse');
  const mult = SNEAK_DETECT_BASE - SNEAK_DETECT_PER_FINESSE * fin;
  return Math.max(0.25, mult);
}
// Toggle sneak. Called from the Ctrl keydown handler. No-ops if a modal
// is open (handler-level guard handles that, but defensive here too).
function toggleSneak(){
  _sneaking = !_sneaking;
  // Drive the HUD vignette + indicator. Defensive guards in case DOM
  // isn't loaded yet (shouldn't happen post-boot, but cheap).
  const _vig = document.getElementById('sneakVignette');
  const _ind = document.getElementById('sneakInd');
  if(_vig) _vig.classList.toggle('on', _sneaking);
  if(_ind) _ind.style.display = _sneaking ? 'block' : 'none';
  if(_sneaking){
    showMsg('Sneaking', '#aaccaa');
    // Sound cue: a soft fabric/cloth shift — reuse footstep with quiet params.
    if(typeof sfxNoise === 'function') sfxNoise(0.04, 1, 1, 0.08, 280);
  } else {
    showMsg('Walking', '#888');
  }
}
// ── POWER ATTACK SYSTEM (v62) ───────────────────────────────
// Skyrim-style click-and-hold. Hold LMB past the threshold → power attack on release.
// Release before threshold → normal attack. Per Session 47 design pivot, this REPLACES
// the original `combat_redesign.md` three-stance system. The two combat tools that
// system was offering map cleanly elsewhere: backstab × 2.5 becomes the dagger
// weapon-type-native bonus in Session 2; anti-shield becomes the power-attack rule.
// v62.5 — Threshold raised from 0.35 → 0.5 after playtest found that swing-while-
// moving clicks were crossing the original threshold incidentally. 0.5s reads
// as "I'm holding deliberately" without being so long that intentional power
// attacks feel sluggish. Sits in the Skyrim/Soulslike range (~0.4-0.5s).
const POWER_CHARGE_THRESHOLD = 0.5;   // seconds LMB must be held to arm a power attack
const POWER_DMG_MULT = 1.8;           // damage multiplier on a power-attack hit
const POWER_STAM_MULT = 2.0;          // stamina cost multiplier vs a normal swing
const POWER_MOVE_MULT = 0.4;          // movement speed multiplier while charging
const POWER_SWING_T = 0.65;           // swingT for the longer, heavier power swing arc (v65.5: bumped from 0.55 alongside normal 0.38→0.50; threshold check stays robust)
// v65.7 — ANIM_PARAMS: live-tunable animation parameter object. Exposes every
// magnitude, target, and phase boundary used by the swing and block tweens so
// the in-game debug panel (toggled with backtick) can mutate them at runtime.
// The render loop reads from this object each frame; sliders in the panel write
// to it. NOT serialized to save — this is purely a development/tuning surface.
// When values feel right, dump via panel's "Copy values" button and bake into
// the defaults below in a follow-up commit.
//
// Conventions:
//   - posX/posY in viewmodel-space units (rest pose is ~0.28, -0.28, -0.55)
//   - rotX/rotY/rotZ in radians
//   - Phase boundaries in [0, 1] progress through a swing
//   - antX/antY = anticipation offset (where weapon moves DURING windup)
//   - tgtX/tgtY/tgtZ/tgtPitch = swing extreme target pose
//
// Variant codes used by swing.variantLock: -1 = random (default), 0 = UR→LL,
//   1 = UL→LR, 2 = overhead chop.
const ANIM_PARAMS = {
  swing: {
    // Phase boundaries (progress 0→1)
    // v65.8: tuned values. holdEnd < sweepEnd intentionally — produces a
    // "long windup, fast snap, then drift back" curve that feels punchier
    // than the canonical hold-then-settle.
    antEnd:    0.44,
    sweepEnd:  0.79,
    holdEnd:   0.60,
    // Swing durations
    normalDur: 0.55,
    powerDur:  0.46,
    // v66.1 — Impact sync. Damage + swing audio fire when swing progress p
    // crosses impactPoint (not at click). 0.55 sits just before the visual
    // sweepEnd (0.79) — the blade is most of the way to its target pose, and
    // audio/damage landing a hair early reads as "on time" to the ear. Tunable
    // live via the debug panel.
    impactPoint: 0.55,
    // v66.1 — Weight→speed scaling. swingDur and atkCd both scale by
    // factor = clamp(weightA + weightB*weapon.weight, weightMin, weightMax).
    // Calibrated so a Sword (weight 3) = 1.0× (the unchanged baseline):
    //   weightA + weightB*3 = 1.0. Dagger(1.5)≈0.84×, Hammer(7)=1.40× (capped).
    // Partial scaling — bounded so daggers don't blur and hammers don't freeze.
    weightA:   0.67,
    weightB:   0.11,
    weightMin: 0.72,
    weightMax: 1.40,
    // Variant 0: UR→LL diagonal slash. v65.8 tuned.
    v0_antX:    0.50, v0_antY: -0.08,
    v0_tgtX:   -2.00, v0_tgtY: -0.46, v0_tgtZ:  1.25, v0_tgtPitch: -2.20,
    // Variant 1: UL→LR diagonal slash. v65.8 tuned (mirror with own feel).
    v1_antX:   -1.00, v1_antY:  0.19,
    v1_tgtX:    2.00, v1_tgtY: -0.06, v1_tgtZ:  0,    v1_tgtPitch: -2.80,
    // Variant 2: overhead chop. v65.8 tuned.
    v2_antX:   -0.02, v2_antY:  0.50,
    v2_tgtX:    0.02, v2_tgtY: -1.48, v2_tgtZ:  1.30, v2_tgtPitch: -2.75,
    // v65.8 — Z push. Pushes the weapon AWAY from the camera during the
    // sweep+hold phases so it doesn't visually collide with the player's
    // shield/body. Negative = further from camera (deeper into scene).
    // Eases in during sweep, holds through hold phase, eases out during settle.
    // Anticipation has no push — windup happens at rest depth.
    swingPushZ: -1.00,
    // Variant chances — explicit weights for V0/V1/V2. Normalized at runtime,
    // so absolute values don't matter, only ratios. v65.9: V2 promoted from
    // implicit remainder to explicit weight so overhead chops can fire on
    // normal swings (previous "1, 1" defaults gave V2 zero weight). Default
    // 1, 1, 0.2 → roughly 45/45/9 V0/V1/V2.
    v0_chance: 1.00,
    v1_chance: 1.00,
    v2_chance: 0.20,
    // Variant override: -1 = random, 0/1/2 = locked to that variant.
    // Wins over power-attack binding — useful for debug/tuning sessions.
    variantLock: -1,
    // v65.9 — Power-attack variant binding. Power attacks default to the
    // big committed variant for the weapon class:
    //   1H weapons → V0 (UR→LL slash, the heaviest tuned committed swing)
    //   2H weapons → V2 (overhead chop, the natural heavy-weapon power feel)
    // -1 = no bind (use random weights instead). variantLock takes precedence
    // over both — if a developer locks V1 in the panel for tuning, power
    // attacks honor that lock rather than overriding it.
    powerVariant1H: 0,
    powerVariant2H: 2,
  },
  block: {
    // Position targets per weapon class. v65.8 tuned.
    posX_1h:  0.21, posX_2h:  0.40, posX_bow: -0.05,
    posY_1h: -0.05, posY_2h: -0.08, posY_bow: -0.10,
    posZ_1h: -0.50, posZ_2h: -0.55, posZ_bow: -0.50,
    // Rotation targets per weapon class (radians). v65.8 tuned.
    rotX_1h:  0,    rotX_2h: -0.05, rotX_bow:  0.25,
    rotY_1h:  0,    rotY_2h:  0,    rotY_bow:  0,
    rotZ_1h:  1.55, rotZ_2h:  1.50, rotZ_bow:  1.50,
  },
};
// v66.1 — Weapon weight → swing-speed factor. Drives BOTH swing animation
// duration and attack cooldown so they stay locked (a slow weapon animates
// slow AND can't be re-swung until the slow animation would finish). Bare hand
// (no weapon) uses weight 2. Returns a clamped multiplier; Sword (w3) = 1.0.
function _weaponSwingFactor(){
  const _SP = ANIM_PARAMS.swing;
  const w = (EQ.weapon && EQ.weapon.weight) || FISTS.weight;
  return Math.min(_SP.weightMax, Math.max(_SP.weightMin, _SP.weightA + _SP.weightB * w)) / _buffMult('atkSpeed', 1);
}
// v66.1 — Pending melee strike. Set by attack()/attackZoneEnemies() at click;
// fired by the swing render loop when progress crosses ANIM_PARAMS.swing
// .impactPoint. Decouples the visual swing from the damage+audio moment so the
// hit lands when the blade visually arrives, not at the instant of the click.
// resolveFn gathers candidates AND resolves damage at fire time (impact-gather
// per design decision — an enemy that walked into range during the windup is
// hit; one that left is not). isPow carried so the impact resolution knows
// whether to run power-attack rules.
let _pendingStrike = null;
// v62.8 — Power attacks now run a windup → swing sequence instead of firing
// hit detection immediately on release. POWER_WINDUP_DELAY is the time between
// the LMB-release moment and the swing-tween + hit-check actually firing.
// Sequenced with LUNGE_DURATION (0.4): lunge carries player 0→0.4s, swing
// fires at 0.30s, hit lands at swing peak ~0.575s. Net effect: the player
// rushes in during 0-0.3s with the sword still in the cocked pose, the
// strike connects at the end of the lunge instead of at the start. Earlier
// v62.7 behaviour (swing immediately, lunge after) felt mechanically wrong —
// stamina was paid up front but the blade was waving uselessly while the
// lunge closed the gap. POWER_ATK_CD_MULT bumped 1.4 → 1.7 to cover the
// extended commitment cycle (windup 0.30 + swing 0.55 = 0.85s end-to-end).
const POWER_WINDUP_DELAY = 0.30;      // seconds between release and swing firing
const POWER_ATK_CD_MULT = 1.7;        // attack cooldown multiplier after a power hit
// v64 — Bow / arrow constants. Bows use the same LMB-hold input grammar as
// power attacks but route to a draw-and-release path instead. Mousedown
// branches on EQ.weapon weaponShape: 'bow' → start draw; else → power-charge.
// See _isBowEquipped() and the mousedown handler. Two-handed flag on
// WEAPON_TYPES (twoHand:true) triggers _clearOffhandForTwoHander() at equip
// time — same hook claymores will reuse in the two-hander ship.
const BOW_DRAW_MIN = 0.25;            // seconds of minimum draw before release fires an arrow
const BOW_DRAW_MAX = 1.10;            // seconds at which draw is fully maxed
const BOW_DAMAGE_MULT_MIN = 0.45;     // damage multiplier at BOW_DRAW_MIN (releasing early = weak)
const BOW_DAMAGE_MULT_MAX = 1.40;     // damage multiplier at BOW_DRAW_MAX (full draw = punchy)
const BOW_STAM_DRAIN_PER_SEC = 8;     // stamina drained per second while holding draw
const BOW_RELEASE_STAM_COST = 6;      // flat stamina paid at release on top of drain
const ARROW_SPEED = 28;               // u/s arrow flight speed at FULL draw (was uniform pre-v64.1)
const ARROW_LIFE = 2.2;               // seconds before arrow despawns mid-air
const ARROW_HIT_RADIUS = 0.55;        // arrow-vs-enemy collision radius (matches spell orbs)
// v64.1 — Arrow speed also scales with draw strength. Mirrors the damage
// spread (BOW_DAMAGE_MULT_MIN/MAX): a weak shot is both weaker AND slower,
// reading as a low-energy release; a full draw is fast and punchy. Speed
// multiplier interpolates ARROW_SPEED_MULT_MIN → ARROW_SPEED_MULT_MAX over
// strength 0..1, then multiplied with ARROW_SPEED. Min is intentionally not
// as low as the damage min — even a weak arrow needs to feel like it left
// the bow with intent; a 28% speed arrow would just lob and feel broken.
const ARROW_SPEED_MULT_MIN = 0.55;    // speed multiplier at BOW_DRAW_MIN release
const ARROW_SPEED_MULT_MAX = 1.0;     // speed multiplier at BOW_DRAW_MAX release
// v64.2 — Arrow gravity. Low value (4 u/s²) so close-range shots feel
// point-and-click but long-range shots demonstrably arc. Real-world gravity
// ≈ 9.8 m/s². At 4 u/s² and ARROW_SPEED 28, a flat shot drops ~0.5u over a
// 1-second flight (~28u horizontal range) — barely visible at melee range,
// clearly visible at distance. Weak draws fly slower so they arc more for
// the same range (emergent skill gradient).
const ARROW_GRAVITY = 4.0;            // u/s² downward acceleration on in-flight arrows
// v64.2 — Stuck arrows persist for STUCK_ARROW_LIFE seconds after landing.
// Stuck-in-enemy arrows are reparented to the enemy body mesh so they
// follow movement. When the enemy dies, killE/killZoneEnemy removes the
// body mesh which takes parented arrows with it (despawn-with-corpse).
const STUCK_ARROW_LIFE = 30;          // seconds a planted arrow remains visible
// v64.2 — Per-frame arrow motion helper. Called from both projectile loops
// (tickZoneBalls and the dungeon BALLS loop). Handles three states:
//
//   'flying'      — apply gravity + motion, update orientation, check
//                   geometry-stick. Caller should then run enemy-hit logic.
//   'stuck-geom'  — arrow planted in a wall/floor/terrain. Just count down
//                   its stuckLife; despawn at zero. Caller should skip
//                   enemy-collision check. Returns 'flying' once stuck so
//                   the caller knows whether to look for enemies.
//   'stuck-enemy' — arrow attached to an enemy body mesh. Tick down its
//                   stuckLife; despawn at zero. Caller should skip
//                   everything else.
//   'expired'     — arrow's lifetime exceeded (whether in-flight life or
//                   stuck life). Caller should remove from scene + array.
//
// Returns the arrow's NEW state after the tick. The caller decides what to
// do based on the return value:
//   - 'expired'     → remove arrow from scene + ZB/BALLS, continue
//   - 'stuck-geom'  → leave alone (it's been planted), continue (no enemy check)
//   - 'stuck-enemy' → leave alone (parented to enemy), continue
//   - 'flying'      → run enemy collision check next
//
// The geometry-stick detection uses dSolid() for dungeons and a combined
// wall+terrain check for overworld. Both are existing helpers.
function tickArrowMotion(arrow, dt, isOW){
  const ud = arrow.userData;
  // ── STUCK PATHS — tick down lifetime and bail ─────────────────
  if(ud.stuck){
    ud.stuckLife -= dt;
    if(ud.stuckLife <= 0) return 'expired';
    return ud.stuckType; // 'stuck-geom' or 'stuck-enemy', stable across frames
  }
  // ── FLIGHT PATH ───────────────────────────────────────────────
  // Lifetime countdown for in-flight arrows (separate from stuckLife).
  ud.life -= dt;
  if(ud.life <= 0) return 'expired';
  // Apply gravity to vy (in-place; vy on the userData is the live velocity).
  ud.vy = (ud.vy || 0) - ARROW_GRAVITY * dt;
  // Sub-step motion to catch fast arrows through thin walls. ARROW_SPEED 28
  // × dt 0.016 ≈ 0.45u per frame; tile walls are 1.0u thick so single-step
  // is normally fine, but a 60fps drop or a fast-moving arrow could tunnel.
  // 3 sub-steps brings the per-step distance to ~0.15u — safely below any
  // wall thickness. The geometry check runs after each sub-step.
  const STEPS = 3;
  const sdt = dt / STEPS;
  let stuckThisFrame = false;
  for(let s = 0; s < STEPS && !stuckThisFrame; s++){
    arrow.position.x += ud.vx * sdt;
    arrow.position.y += ud.vy * sdt;
    arrow.position.z += ud.vz * sdt;
    // Re-apply gravity proportionally to each sub-step is NOT done here —
    // it was already applied once for the whole frame above. Sub-stepping
    // for collision detection only; the velocity change is per-frame.
    //
    // Geometry-stick check. Two cases:
    //   1. Hit a wall (overworld zone solid or dungeon dSolid)
    //   2. Hit the ground (overworld terrain or dungeon floor Y)
    if(isOW){
      if(currentZoneSolid(arrow.position.x, arrow.position.z)){
        // Hit a wall. Back the arrow up a fraction so it visually plants
        // ON the wall surface rather than inside the geometry.
        arrow.position.x -= ud.vx * sdt * 0.5;
        arrow.position.z -= ud.vz * sdt * 0.5;
        stuckThisFrame = true;
        break;
      }
      const gy = activeTerrainH(arrow.position.x, arrow.position.z);
      if(arrow.position.y <= gy){
        // Hit ground. Plant the arrow at the terrain surface, angled
        // downward (the velocity vector at impact already points down so
        // the orientation update below will pose it naturally).
        arrow.position.y = gy + 0.02;
        stuckThisFrame = true;
        break;
      }
    } else {
      if(dSolid(arrow.position.x, arrow.position.z)){
        arrow.position.x -= ud.vx * sdt * 0.5;
        arrow.position.z -= ud.vz * sdt * 0.5;
        stuckThisFrame = true;
        break;
      }
      const gy = (currentFloor === 2 ? FLOOR2_Y : 0);
      if(arrow.position.y <= gy){
        arrow.position.y = gy + 0.02;
        stuckThisFrame = true;
        break;
      }
    }
  }
  // ── Orientation update — arrow always points along its velocity vector ──
  // Without this, gravity makes the arrow descend while staying horizontal,
  // which reads "broken." Recompute yaw + pitch from the live velocity each
  // frame so the arrow nose tracks the arc properly.
  const spdNow = Math.hypot(ud.vx, ud.vy, ud.vz) || 1;
  arrow.rotation.y = Math.atan2(ud.vx, ud.vz);
  arrow.rotation.x = -Math.asin(Math.max(-1, Math.min(1, ud.vy / spdNow)));
  // ── Convert to stuck-geometry state if we hit something this frame ──
  if(stuckThisFrame){
    ud.stuck = true;
    ud.stuckType = 'stuck-geom';
    ud.stuckLife = STUCK_ARROW_LIFE;
    // Zero out velocity so any future code that reads it gets a sane value.
    ud.vx = 0; ud.vy = 0; ud.vz = 0;
    return 'stuck-geom';
  }
  return 'flying';
}
// v64.2 — Attach a flying arrow to an enemy body mesh on hit. Called from
// the arrow-vs-enemy hit branches in both projectile loops. Reparents the
// arrow to the enemy's body mesh so it follows movement/rotation. The
// arrow's WORLD position at impact must be converted to the enemy's LOCAL
// coordinate space; otherwise the arrow would snap to the enemy origin.
//
// Uses Three.js parent.worldToLocal() which handles the matrix inversion
// internally. Both the arrow and the body's world matrices must be up to
// date — call updateMatrixWorld(true) on the body first as a defense
// against parent transforms that haven't been baked yet.
function _stickArrowToEnemy(arrow, body, scene){
  if(!body){
    // No body mesh available — fall back to geometry-stick at current pos
    arrow.userData.stuck = true;
    arrow.userData.stuckType = 'stuck-geom';
    arrow.userData.stuckLife = STUCK_ARROW_LIFE;
    arrow.userData.vx = 0; arrow.userData.vy = 0; arrow.userData.vz = 0;
    return;
  }
  // Capture world transforms before reparenting.
  body.updateMatrixWorld(true);
  arrow.updateMatrixWorld(true);
  // Convert arrow's world position to the body's local space.
  const localPos = body.worldToLocal(arrow.position.clone());
  // Also convert the orientation: world rotation → local rotation. Easiest
  // way: compose matrices. Save world rotation as quaternion, then after
  // reparenting, compute the inverse of the body's world quaternion times
  // the saved world quaternion.
  const worldQuat = arrow.getWorldQuaternion(new THREE.Quaternion());
  const bodyWorldQuat = body.getWorldQuaternion(new THREE.Quaternion());
  const localQuat = bodyWorldQuat.invert().multiply(worldQuat);
  // Remove from current parent (scene) and attach to body.
  if(arrow.parent) arrow.parent.remove(arrow);
  body.add(arrow);
  arrow.position.copy(localPos);
  arrow.quaternion.copy(localQuat);
  // Mark stuck. Velocity zeroed since the arrow no longer flies.
  arrow.userData.stuck = true;
  arrow.userData.stuckType = 'stuck-enemy';
  arrow.userData.stuckLife = STUCK_ARROW_LIFE;
  arrow.userData.vx = 0; arrow.userData.vy = 0; arrow.userData.vz = 0;
}
// Finesse contribution to bow damage. Mirrors Might’s melee scaling but
// rebases on finesse. The bow build identity: Finesse is the primary stat.
// v80 S173: attributes are a small buff on damage, 1% a point (Michael, 27 Sep);
// the weapon, and later its skill, carries the damage. Might (melee), Finesse (bow)
// and Intelligence (spells) all read this.
const ATTR_DMG_PER_POINT = 0.01;
const BOW_FINESSE_DMG = ATTR_DMG_PER_POINT;
// Family multipliers on posture max (brutes are sturdier, light enemies break faster).
// Resolved from enemy build-family field (`buildFn` for dungeon enemies; `shape` for
// zone enemies; bosses keyed on `bossId`). Default 1.0 covers anything unrecognised.
const POSTURE_FAMILY_MULT = {
  brute:1.5, golem:1.5, troll:1.5,
  humanoid:1.0, bandit:1.0, goblin:1.0, kobold:1.0, skeleton:1.0,
  wraith:0.9, phantom:0.9,
  slime:0.8, elemental:1.0, mimic:1.2,
  spider:0.7, wolf:0.8,
  faolchu:2.5 // boss — posture-break is meaningful but not trivial to achieve
};
// Resolve a family key for any enemy. buildFn (dungeon), shape (zone), bossId (boss).
function enemyPostureFamily(e){
  if(!e) return 'humanoid';
  if(e.bossId) return e.bossId; // 'faolchu'
  // Dungeon enemies carry buildFn on their EM def; zone enemies on shape. We don't
  // store buildFn on the spawned entity directly today, so fall back via name match
  // for the common cases. Bosses + slimes + zone-shape entries we can read directly.
  if(e.isWraith) return 'wraith';
  if(e.shape) return e.shape;          // zone enemy (wolf/spider/brute/humanoid)
  if(e.buildFn) return e.buildFn;      // future-proof if we start stamping it
  const n = (e.name||e.baseType||'').toLowerCase();
  if(n.includes('troll')||n.includes('golem')||n.includes('gargoyle')) return 'brute';
  if(n.includes('wraith')) return 'wraith';
  if(n.includes('phantom')) return 'phantom';
  if(n.includes('slime')) return 'slime';
  if(n.includes('elemental')) return 'elemental';
  if(n.includes('mimic')) return 'mimic';
  if(n.includes('spider')) return 'spider';
  if(n.includes('wolf')) return 'wolf';
  return 'humanoid';
}
// Compute and stamp the posture fields on an entity. Idempotent — defensive default
// for save-load on entries that don't have posture yet.
function initPosture(e){
  if(!e) return;
  if(typeof e.posture==='number' && typeof e.maxPosture==='number') return; // already stamped
  const fam = enemyPostureFamily(e);
  const mult = POSTURE_FAMILY_MULT[fam] || 1.0;
  // Base posture = half maxHp scaled by family. Mirrors enemy HP scaling so high-HP
  // enemies are also sturdier on posture (doesn't reduce all fights to posture-spam
  // on tanks). The 0.5 coefficient keeps a typical enemy at ~4-6 normal hits to break
  // (e.g. 30 HP skeleton → 15 posture / 8 drain → 2 hits; 80 HP troll → 60 → 8 hits).
  const baseHp = e.maxHp || e.hp || 30;
  e.maxPosture = Math.max(10, Math.round(baseHp * 0.5 * mult));
  e.posture = e.maxPosture;
  e.lastHitAt = 0;
}
// Is this entity currently in the global staggered[] list? Generalised lookup that
// works for any entity (enemy or future player). Cheap — staggered[] is rarely >2.
function isStaggered(target){
  if(!target) return false;
  for(let i=0;i<staggered.length;i++){ if(staggered[i].e===target) return true; }
  return false;
}
// Drain posture from any entity. Returns true if this drain broke posture (caller
// can fire stagger feedback). Generalised so future player-stagger ship just adds
// a posture field to the player and calls this same function.
function applyPostureDamage(target, amount, now){
  if(!target || typeof target.posture!=='number') return false;
  // Already staggered? Don't break twice. Refresh the regen-delay clock so posture
  // can't instantly start regenning under sustained pressure, but don't re-stagger.
  if(isStaggered(target)) { target.lastHitAt = now; return false; }
  target.lastHitAt = now;
  target.posture = Math.max(0, target.posture - amount);
  if(target.posture <= 0){
    target._finUntil = now + POSTURE_BREAK_STUN;
    // Caller pushes to staggered[] and fires flash. Posture refills automatically
    // when the stagger entry expires (handled in the enemy tick — see tickPostureRegen
    // call site, which detects expired stagger and refills before regenning).
    return true;
  }
  return false;
}
// Regen tick — called per-frame in the enemy update path. Only ticks if the entity
// has a posture field, hasn't been hit recently, and isn't currently staggered.
// On stagger expiry, refills posture to max (recovery beat — you got staggered,
// you recover with a full posture pool, but you took the HP hits along the way).
// S431 — `now` is the loop's clock in ms (both enemy ticks pass it so); lastHitAt is stamped in seconds. The two were
// compared raw, so the 1.5 s delay never held: posture regenerated 5/s straight after every hit. A foe out of its
// stagger now refills at once, whoever is still hitting it (Session 47's rule, and the player's own in tickPlayerPosture).
function tickPostureRegen(target, dt, now){
  if(!target || typeof target.posture!=='number') return;
  if(isStaggered(target)) return;
  // Just out of a stagger (posture 0, no longer in staggered[]): the recovery beat, a full pool.
  if(target.posture <= 0){
    target.posture = target.maxPosture;
    return;
  }
  if(target.posture >= target.maxPosture) return;
  if(now/1000 - (target.lastHitAt||0) < POSTURE_REGEN_DELAY) return;
  target.posture = Math.min(target.maxPosture, target.posture + POSTURE_REGEN * dt);
}
