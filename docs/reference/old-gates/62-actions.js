// v71 — Bash (block-bash). Fired from the mousedown handler when LMB is clicked
// while RMB is held (blocking) and a weapon or shield is equipped. Costs stamina
// like a swing, shares the swing cooldown (atkCd), deals NO damage — it staggers.
//
//   • Shield equipped → FULL force-break (drain max posture) on any breakable
//     enemy in the front cone.
//   • Bare / weapon-only → drain BASH_BARE_POSTURE; breaks weak enemies, dents brutes.
//
// A raised Shieldbearer guard (shieldUp) is IMMUNE (design call G) — bashing the
// thing whose entire job is to absorb a bash does nothing. Flank it or power it.
// Hits all eligible enemies in the cone (it's a shove, not a single-target poke);
// cleave caps don't apply since there's no damage to balance.
function doBash(){
  // Gate: must be in combat context, off cooldown, and have stamina. Mirrors the
  // attack() stamina-min gate so bash can't be spammed when gassed.
  if(isInterior()) return;
  const sh = EQ.offhand;
  const hasShield = sh && sh.shieldType === 'shield';
  const stCost = hasShield ? ((sh.armorW||4) * 1.5 + 4) : BASH_STAM_BARE;
  const stMin = stCost * 0.7;
  if(atkCd > 0 || stamina < stMin) return;
  const _swFactor = _weaponSwingFactor();
  atkCd = 0.5 * (1 - attrEff('swiftness')*0.01) * _swFactor;   // shares the swing recovery
  stamina = Math.max(0, stamina - _stamCost(stCost));
  // Visual: punch the shield/sword forward INTO the enemy (the 'bash' kind is a
  // big −Z thrust, not the parry's small jostle-and-twist). Pass a synthetic
  // attacker point dead-ahead so localForward ≈ 1 and the shove drives straight out.
  shieldImpact('bash', 30, px + fwdX, pz + fwdZ);
  sndBash(hasShield);
  // Resolve against the active enemy list.
  const list = isOverworldZone() ? ZE : ENEMIES;
  let landed = false, anyGuard = false;
  for(const e of list){
    if(!e || e.dead || e.locked) continue;
    if(!isOverworldZone() && (e.floor !== currentFloor || e.disguised)) continue;
    const ex = e.x - px, ez = e.z - pz;
    const dist = Math.hypot(ex, ez);
    if(dist >= BASH_RANGE) continue;
    if((ex*fwdX + ez*fwdZ)/(dist||1) <= BASH_CONE_COS) continue;  // front cone only
    e.alert = true;
    // Shieldbearer with guard up — immune. Flag for a one-shot feedback toast.
    if(e.shieldUp){ anyGuard = true; continue; }
    landed = true;
    if(typeof e.posture === 'number' && !isStaggered(e)){
      const now = performance.now()/1000;
      const broke = hasShield
        ? (applyPostureDamage(e, (e.maxPosture||999), now), true)   // shield = force-break
        : applyPostureDamage(e, BASH_BARE_POSTURE, now);            // weapon = chunk
      if(broke){
        staggered.push({e, t: POSTURE_BREAK_STUN});
        const body = enemyBodyMesh(e);
        const m = body && body.material;
        if(m && m.emissive){
          m.emissive.setHex(0xffaa00);
          setTimeout(()=>{ if(m && m.emissive) m.emissive.setHex(0); }, 220);
        }
      }
    }
  }
  if(landed) showMsg(hasShield ? '🛡️ Shield bash!' : '🛡️ Bash!', '#ffcc66');
  else if(anyGuard) showMsg("Bash glances off the raised shield.", '#cc8844');
  else showMsg('Bash!', '#888');
}
function attack(isPower, _isDeferred){
  if(playerStaggered(performance.now()/1000))return; // S281
  if(isOverworldZone()){attackZoneEnemies(isPower, _isDeferred);return;}
  // v62 — Power attack: hold LMB past POWER_CHARGE_THRESHOLD before release.
  // Requires a weapon equipped (bare-hand is the fallback path; no power
  // attack with empty hands). Falls through to normal attack if no weapon.
  // v62.8 — When called with _isDeferred=true, this is the second-phase fire
  // of a power attack that was committed in mouseup (stamina + cooldown were
  // already paid up front). Skip the cost gates and bookkeeping; jump
  // straight to swing-tween + sound + hit detection. Lets the visible swing
  // align with the end of the forward lunge instead of firing at release.
  const _w=EQ.weapon;
  const _isPow = !!(isPower && _w);
  // v66.1 — weight→speed factor scales swing duration AND cooldown together.
  const _swFactor = _weaponSwingFactor();
  if(!_isDeferred){
    const _wt=(_w&&_w.weight)||FISTS.weight;
    const _stMul = _isPow ? POWER_STAM_MULT : 1.0;
    const _stCost=_wt*7*_stMul;const _stMin=_wt*5*_stMul;
    if(atkCd>0)return;
    _exhaustedStrike=stamina<_stMin; if(_exhaustedStrike)flashStamina(); // v80 S9
    // Cooldown now scales with weapon weight (heavy = longer recovery), kept
    // in lockstep with the slower animation so a hammer can't be re-swung
    // before its longer swing would have finished.
    atkCd=.5*(1-attrEff('swiftness')*0.01)*(_isPow?POWER_ATK_CD_MULT:1)*_swFactor;
    stamina=Math.max(0,stamina-_stamCost(_stCost));
  }
  // Weight-scaled swing animation duration (Sword w3 = 1.0× baseline).
  swingT=(_isPow?(ANIM_PARAMS.swing.powerDur):(ANIM_PARAMS.swing.normalDur))*_swFactor;
  // v69.1 — Whoosh of air fires NOW (swing start); the contact sound + hit
  // resolution fire at impact via _pendingStrike. "whoooosh-THUNK".
  sndWhoosh();
  // v66.1 — Defer audio + hit resolution to the swing's impact frame instead
  // of firing now. The render loop fires _pendingStrike when progress crosses
  // ANIM_PARAMS.swing.impactPoint. Candidates are gathered AT impact.
  _pendingStrike = { resolveFn: _resolveDungeonStrike, isPow: _isPow, fired: false }; _swingStartS=performance.now()/1000;_offenceS=playClockS;
}
// v66.1 — Dungeon melee resolution, extracted from attack() and fired at the
// swing impact frame. Gathers candidates at call time (impact-gather), plays
// the swing audio, and resolves cleave/damage/posture/kill.
function _resolveDungeonStrike(_isPow){
  sndSwing();
  let hit=false;
  const _cleaveCap = (EQ.weapon && EQ.weapon.cleaveTargets) || CLEAVE_DEFAULT;
  const _wPostMult = (EQ.weapon && EQ.weapon.postureMult) || 1.0;
  const _candidates = [];
  ENEMIES.forEach(e=>{
    if(e.dead||e.floor!==currentFloor||e.disguised)return;
    const ex=e.x-px,ez=e.z-pz,dist=Math.sqrt(ex*ex+ez*ez);
    // v65.2 — Cone tightened from .35 (140°) to .45 (~117°). The wider cone
    // was catching enemies at the player's hips/peripheral and reading as
    // "I hit something behind me." The new threshold corresponds to roughly
    // a 58° half-angle each side of forward — front-and-slightly-flank only,
    // not peripheral. Same threshold for 1H and 2H; cleave differentiates 2H
    // via target count, not cone width.
    if(dist<2.2&&(ex*fwdX+ez*fwdZ)/(dist||1)>.45){
      _candidates.push({e,dist});
    }
  });
  _candidates.sort((a,b)=>a.dist-b.dist);
  let _hitsLanded = 0;
  for(const _c of _candidates){
    if(_hitsLanded >= _cleaveCap) break;
    const e = _c.e;
    _hitsLanded++;
    // v65 — Power-attack-vs-shielded enemy: pure stagger, zero damage, free
    // follow-up window. The shieldUp branch fires BEFORE damage resolution so
    // raw attack power doesn't bleed through a "broken guard." Mirrors the
    // player-side parry → enemy-staggered loop, just from the other side.
    // Forecast: Shieldbearer (Session 5) ships with shieldUp:true and a "guard
    // raised" telegraph — this rule fires for free at that point. shieldUp is
    // currently a no-op canon flag; setting it on any enemy enables the rule.
    if(_isPow && e.shieldUp && !riposteOpen(e)){
      if(typeof e.posture==='number' && !isStaggered(e)){
        // Force-break by draining max posture; pushes the enemy onto the
        // staggered list with the standard POSTURE_BREAK_STUN window.
        applyPostureDamage(e, (e.maxPosture||999), performance.now()/1000);
        staggered.push({e, t: POSTURE_BREAK_STUN});
        const body = enemyBodyMesh(e);
        const m = body && body.material;
        if(m && m.emissive){
          m.emissive.setHex(0xffaa00);
          setTimeout(()=>{ if(m && m.emissive) m.emissive.setHex(0); }, 220);
        }
      }
      // v71 — Guard is now down: follow-up hits land full, and the raised-shield
      // pose drops (dropShieldGuard lowers the arm mesh if this is a Shieldbearer).
      e.shieldUp = false;
      dropShieldGuard(e);
      e.alert = true; hit = true;
      if(_isPow) sndPowerHit(); else sndHitEnemy((typeof wType!=='undefined'?wType:(typeof wt!=='undefined'?wt:undefined)),((typeof physResistMult!=='undefined'&&physResistMult<.8)||(typeof resistMult!=='undefined'&&resistMult<.8)));
      showMsg(`💥 ${e.name}'s guard breaks!`, '#ffcc66');
      continue; // no damage on the breaking swing; skip resist/kill resolution
    }
    {
      const w=EQ.weapon,lo=w?w.atk[0]:FISTS.atk[0],hi=w?w.atk[1]:FISTS.atk[1];
      const mightMult=1+(attrEff('might')*ATTR_DMG_PER_POINT);
      const powerMult=_isPow?POWER_DMG_MULT:1.0;
      // v71 — Frontal shield block. A Shieldbearer hit from the front (not the
      // rear cone) takes SHIELDBEARER_FRONT_BLOCK of the damage. shieldFrontMult
      // returns 1.0 for everything else and for flanking hits.
      const shMult=riposteOpen(e)?1:shieldFrontMult(e);
      const rawDmg=Math.floor((lo+Math.floor(foeRand(e)*(hi-lo))+Math.floor(level*1.5))*mightMult*_buffMult('meleeDmg',1)*_buffMult('dmgBurst',1)*powerMult*shMult); // S322 — Firemoss and Caor Dubh underground too
      const info=applyMeleeDamage(e, rawDmg);
      const dmg=info.dmg;
      e.hp=Math.max(0,e.hp-dmg);
      e.hpFg.scale.x=e.hp/e.maxHp;e.hpFg.position.x=(e.hp/e.maxHp-1)*.275;
      e.alert=true;hit=true;
      if(_isPow)sndPowerHit();else sndHitEnemy((typeof wType!=='undefined'?wType:(typeof wt!=='undefined'?wt:undefined)),((typeof physResistMult!=='undefined'&&physResistMult<.8)||(typeof resistMult!=='undefined'&&resistMult<.8)));
      // v61gj — Posture drain. Only if still alive (no point staggering a corpse)
      // and not already staggered (applyPostureDamage guards this too, but skipping
      // the call entirely is cheaper). v62: power attacks drain POSTURE_DRAIN_POWER (25)
      // vs normal POSTURE_DRAIN_NORMAL (8). Two power hits will break most non-brute
      // enemies; brutes (1.5× familyMult) still take 3-4 power hits to break.
      // v65: postureMult from WEAPON_TYPES (2H weapons) scales the drain on top.
      // War hammers (2.25×) break a normal enemy in one power hit; brutes in two.
      if(e.hp>0 && typeof e.posture==='number' && !isStaggered(e)){
        const drain = (_isPow ? POSTURE_DRAIN_POWER : POSTURE_DRAIN_NORMAL) * _wPostMult;
        const broke = applyPostureDamage(e, drain, performance.now()/1000);
        if(broke){
          staggered.push({e, t: POSTURE_BREAK_STUN});
          // Stagger flash — reuses the v61d1 enemyBodyMesh helper that already
          // powers parry-stagger and telegraph pulse. Same yellow tint.
          const body = enemyBodyMesh(e);
          const m = body && body.material;
          if(m && m.emissive){
            m.emissive.setHex(0xffaa00);
            setTimeout(()=>{ if(m && m.emissive) m.emissive.setHex(0); }, 220);
          }
          showMsg(`💥 ${e.name} staggered!`, '#ffcc66');
        }
      }
      // v63 — Compose combat-decoration tag (see zone branch comment).
      // v71 — (GUARDED) appended when a frontal shield reduced the hit, so the
      // player reads WHY the number is small and learns to flank or power-attack.
      const _guardTag = (shMult<1.0) ? ' (GUARDED)' : '';
      const _killTag = `${_isPow?' (POWER)':''}${info.backstab?' (BACKSTAB)':''}${info.finisher?' (FINISHER)':info.riposte?' (RIPOSTE)':info.crit?' (CRIT)':''}${_guardTag}${dmgTag(info,e)}`;
      if(e.hp<=0){killE(e,_killTag);}else{
        const enc=applyWeaponEnchant(dmg,e);
        if(e.hp<=0){
          killE(e,_killTag);
          if(enc)showMsg(enc.tag,enc.col);
        } else showMsg(`Hit ${e.name} for ${dmg}!${_isPow?' (POWER)':''}${info.backstab?' (BACKSTAB)':''}${info.finisher?' (FINISHER)':info.riposte?' (RIPOSTE)':info.crit?' (CRIT)':''}${_guardTag}${dmgTag(info,e)}${enc?' · '+enc.tag:''}`,'#ff9944');
      }
    }
  }
  if(!hit)showMsg('Swing!','#888');
  document.getElementById('df').style.boxShadow='inset 0 0 28px rgba(220,160,60,.4)';
  setTimeout(()=>document.getElementById('df').style.boxShadow='',150);
}
// v64 — fireArrow: spawn an arrow projectile and consume one from EQ.ammo.
//
// Routing: rides the existing BALLS[] (dungeon) / ZB[] (zone) projectile
// arrays alongside spells. The tickBalls / tickZoneBalls loops gain new
// branches that detect userData.isArrow and apply ranged damage via
// applyMeleeDamage with wType:'pierce' (or arrow-override).
//
// strength is the normalized 0..1 draw strength at release time.
// Final damage = (bow.atk roll + arrow.arrowDmg roll) × drawMult × finesseMult × resists,
// where drawMult interpolates BOW_DAMAGE_MULT_MIN → BOW_DAMAGE_MULT_MAX.
//
// Arrow geometry: small elongated box with a sub-cone tip + tail fletching.
// Built fresh per shot (no template caching yet — defer to Session 4 if perf
// becomes an issue; arrows are sparse compared to enemy orbs).
// S480 — an arrow's damage at the hit: a keyed foe (keyFoe) rolls the bow's and the arrow's spread from its own stream, as a
// swing does; anything else takes the roll made at release
function arrowRawFor(u,e){const R=u&&u.roll;if(!R||!e||!e.rng)return u.arrowDmg;
  const b=R.bLo+Math.floor(foeRand(e)*Math.max(1,R.bHi-R.bLo)),a=R.aLo+Math.floor(foeRand(e)*Math.max(1,R.aHi-R.aLo));return Math.max(1,Math.floor((b+a+R.lv)*R.m));}
function fireArrow(strength){
  const ammo = EQ.ammo;
  const bow = EQ.weapon;
  if(!ammo || !bow) return; // defensive — caller already checked
  _offenceS=playClockS; /* S408 */
  // ── Consume one arrow ─────────────────────────────────────────
  ammo.qty = Math.max(0, (ammo.qty||0) - 1);
  const arrowsLeft = ammo.qty;
  if(arrowsLeft <= 0){
    // Empty stack — clear the slot. Player keeps the (now zero-qty) item
    // out of view; future arrows must be re-equipped from BAG.
    EQ.ammo = null;
  }
  // ── Damage roll ───────────────────────────────────────────────
  // Bow contribution (atk roll, scales with material tier).
  const bowLo = bow.atk ? bow.atk[0] : 6;
  const bowHi = bow.atk ? bow.atk[1] : 10;
  const bowRoll = bowLo + Math.floor(Math.random() * Math.max(1, bowHi - bowLo));
  // Arrow contribution (per-arrow type).
  const aLo = (ammo.arrowDmg && ammo.arrowDmg[0]) || 0;
  const aHi = (ammo.arrowDmg && ammo.arrowDmg[1]) || 0;
  const arrowRoll = aLo + Math.floor(Math.random() * Math.max(1, aHi - aLo));
  // Draw scaling — linear MIN..MAX over strength 0..1.
  const drawMult = BOW_DAMAGE_MULT_MIN + (BOW_DAMAGE_MULT_MAX - BOW_DAMAGE_MULT_MIN) * strength;
  // Finesse — bow's primary attribute, mirrors Might’s melee scaling (ATTR_DMG_PER_POINT).
  const finesseMult = 1 + attrEff('finesse') * BOW_FINESSE_DMG;
  // Per-level component (matches melee's level×1.5 floor).
  const lvlFloor = Math.floor(level * 1.0);
  const rawDmg = Math.max(1, Math.floor((bowRoll + arrowRoll + lvlFloor) * drawMult * finesseMult));
  // ── Resolve damage type ───────────────────────────────────────
  // Arrow overrides bow's wType (per lore: silver/broadhead arrows). Iron
  // arrows omit wType → falls through to bow's 'pierce'.
  const wTypeResolved = ammo.wType || bow.wType || 'pierce';
  // ── Arrow mesh ────────────────────────────────────────────────
  const arrowGroup = new THREE.Group();
  const shaftMat = new THREE.MeshLambertMaterial({color:0x886040});
  const tipMat = new THREE.MeshLambertMaterial({color:ammo.matCol||0xa8b0b8});
  const fletchMat = new THREE.MeshLambertMaterial({color:0xddd8c0});
  // Shaft — slender box, long Z-axis (orientation handled after spawn)
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.6), shaftMat);
  arrowGroup.add(shaft);
  // Arrowhead (tip) at +Z end
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.04,.12,4), tipMat);
  tip.rotation.x = Math.PI/2;
  tip.position.z = .36;
  arrowGroup.add(tip);
  // Fletching at -Z end (three small fins)
  for(let f=0;f<3;f++){
    const ang = f * (Math.PI*2/3);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.005,.05,.10), fletchMat);
    fin.position.set(Math.cos(ang)*.04, Math.sin(ang)*.04, -.28);
    fin.rotation.z = ang;
    arrowGroup.add(fin);
  }
  // ── Spawn position + velocity ────────────────────────────────
  const isOW = isOverworldZone();
  const sc = isOW ? scene : dScene;
  const groundY = isOW ? activeTerrainH(px,pz) : (currentFloor===2?FLOOR2_Y:0);
  // Spawn at eye-height in front of player, slightly to right of camera
  // (matches the bow viewmodel's right-hand grip).
  const spawnY = groundY + (_eyeHeightCur||0.92);
  const spawnX = px + fwdX*0.5 + rgtX*0.15;
  const spawnZ = pz + fwdZ*0.5 + rgtZ*0.15;
  arrowGroup.position.set(spawnX, spawnY, spawnZ);
  const _tpShot = tpShotFrom('L', sc);
  if(_tpShot) arrowGroup.position.copy(_tpShot.from);
  const cosPitch = Math.cos(pitch);
  // v64.1 — Speed scales with draw strength (mirrors damage scaling). A weak
  // shot fires slower (more readable, more arc-feeling); a full draw snaps.
  const speedMult = ARROW_SPEED_MULT_MIN + (ARROW_SPEED_MULT_MAX - ARROW_SPEED_MULT_MIN) * strength;
  const arrowSpd = ARROW_SPEED * speedMult;
  const vx = _tpShot ? _tpShot.dir.x * arrowSpd : fwdX * arrowSpd * cosPitch;
  const vz = _tpShot ? _tpShot.dir.z * arrowSpd : fwdZ * arrowSpd * cosPitch;
  const vy = _tpShot ? _tpShot.dir.y * arrowSpd : Math.sin(pitch) * arrowSpd;
  // Orient arrow group so its +Z axis points along the velocity vector.
  // We use the same yaw-based lookAt as enemies — three-point trig.
  arrowGroup.rotation.y = Math.atan2(vx, vz);
  arrowGroup.rotation.x = -Math.asin(vy / arrowSpd);
  arrowGroup.userData = {
    vx, vy, vz,
    life: ARROW_LIFE,
    isArrow: true,
    arrowDmg: rawDmg,
    // S480 — the roll's terms, so the hit rolls the spread on the struck foe's stream (arrowRawFor); arrowDmg is the roll
    // for a target with no id
    roll: {bLo: bowLo, bHi: bowHi, aLo, aHi, lv: lvlFloor, m: drawMult * finesseMult},
    wType: wTypeResolved,
    // Carry source-bow ref for hit-message attribution (no need to retain
    // ammo ref — damage was already rolled).
    bowName: bow.name,
  };
  sc.add(arrowGroup);
  if(isOW) ZB.push(arrowGroup); else BALLS.push(arrowGroup);
  // ── Audio + feedback ─────────────────────────────────────────
  sndBowRelease(strength);
  // Light HUD feedback — strength readout + arrows-remaining nudge so the
  // player learns the rhythm. Shorter than melee hit messages because the
  // arrow flight itself is the primary feedback channel.
  const pct = Math.round(strength*100);
  showMsg(`🏹 Fired (${pct}% draw) — ${arrowsLeft} arrows left`,'#c8a878');
  // Stats tracking — reuse the existing arrowsFired counter if present,
  // otherwise add it. lvAct is per-life stats; lifetime stats go elsewhere.
  if(typeof lvAct.arrowsFired === 'number') lvAct.arrowsFired++;
  else lvAct.arrowsFired = 1;
}
function killE(e,tag=''){
  if(typeof WORLD!=='undefined'&&!e._guildCounted){e._guildCounted=true;WORLD.guild.onKill(e,'dungeon');} // v80 S12
  e.dead=true;e.el.intensity=0;
  if(e._slamRing)e._slamRing.visible=false;
  sndEnemyDeath();kills++;lvAct.kills++;xp+=Math.round(e.maxHp*_buffMult('xpBoost',1));chkLvl();
  // Quest progress — dungeon kill events
  if(currentPortal){
    checkQuestProgress('kill_in_dungeon',{seed:currentPortal.seed});
    checkQuestProgress('kill_on_dungeon_floor',{seed:currentPortal.seed,floor:currentFloor});
    checkQuestProgress('kill_in_zone',{zone:(currentPortal.zone==='world'?((WORLD_DUNGEONS.find(d=>d.seed===currentPortal.seed)||{}).zone||'world'):currentPortal.zone)||'overworld'}); // v80 S240 — a world door counts as its canonical dungeon's zone (Q6: Ironhaven's dungeons)
  }
  // Notable kill logging
  const isBrute=e.name==='Cave Troll'||e.name==='Golem';
  const firstKill=!seenEnemyTypes.has(e.name);
  if(firstKill){seenEnemyTypes.add(e.name);addLog('⚔','First blood — slew a '+e.name);}
  else if(isBrute){addLog('⚔','Slew a '+e.name+' in '+(currentPortal?currentPortal.name:'the old gate'));}
  else if(kills===10||kills===25||kills===50||kills===100){addLog('⚔',kills+' enemies slain');}
  // Slump mesh — rotate to lie flat, tint dark
  // Floor base: wraith baseY includes float offset, so use the floor's ground Y
  const floorGroundY=e.floor===2?FLOOR2_Y:0;
  // S419 — a people-bodied foe falls as a ragdoll on the floor (Michael's C on #102); the rest slump as before
  if(!(typeof ragdollFoe==='function'&&ragdollFoe(e,tag,()=>floorGroundY,(x,z)=>dSolid(x,z)))){
  e.mesh.rotation.z=Math.PI/2;
  e.mesh.position.y=floorGroundY+0.15;}
  e.mesh.traverse(c=>{if(c.isMesh&&c.material){c.material=c.material.clone();c.material.color.multiplyScalar(.35);}});
  // Hide HP bar
  e.hpFg.visible=false;if(e.hpFg.parent)e.hpFg.parent.children.forEach(c=>{if(c.geometry&&c.geometry.type==='PlaneGeometry')c.visible=false;});
  // Loot glow — small pulsing light over corpse, at correct floor height
  const lootY=floorGroundY+0.5;
  const lootGl=new THREE.PointLight(0xffcc44,1.2,3);lootGl.position.set(e.x,lootY,e.z);dScene.add(lootGl);
  const lootSparkTmpl=SPELL_ORB_TEMPLATES['lootSpark'];
  const lootSpark=lootSparkTmpl?lootSparkTmpl.clone():new THREE.Mesh(new THREE.SphereGeometry(.06,5,5),new THREE.MeshBasicMaterial({color:0xffdd66}));
  lootSpark.position.set(e.x,lootY,e.z);dScene.add(lootSpark);
  // Roll corpse loot — uses lootDropChance for first item roll, then 25% bonus roll for a second.
  // Items array (possibly empty) — panel displays and the prompt hides once items.length===0.
  const ds = currentPortal?currentPortal.diffScale:null;
  const th = currentPortal?currentPortal.theme:null;
  const items = rollContainerLoot('corpse', ds, th, lootDropChance(e), e.id?`${e.id}:corpse:${lootDay()}`:undefined); // S478 — a keyed foe's corpse rolls on its id
  const drops = items.length > 0;
  CORPSES.push({x:e.x,z:e.z,name:e.name,looted:false,items,gl:lootGl,spark:lootSpark,age:0,floorY:floorGroundY,displayName:e.name,body:e.mesh});
  if(drops){showMsg(`${e.name} slain!${tag} Press E to loot.`,'#c8a84a');}
  else{showMsg(`${e.name} slain!${tag}`,'#888');lootGl.intensity=0;lootSpark.visible=false;}
  // Slime split — spawns 2 Small Slimes at the kill point. Flag is on the base def and copied via baseType check.
  // Small Slimes are themselves regular enemies (no further splitting since base def lacks splitsOnDeath).
  if(e.baseType === 'Slime' && e.variant !== 'small'){
    // Skip if this is already a Small Slime that got here somehow
    const smallDef = {col:0x5fd85f,hp:10,spd:0.75,scale:0.42,buildFn:'slime',dmgMult:1.2,ranged:false,eyeCol:0xffdd44,light:0x44ff44,def:0,resist:{cloch:1.35,tine:1.5,uisce:0.7}};
    for(let s=0; s<2&&_dungeonBuildEnemy; s++){
      // S481 — where the two fall is the slain slime's own roll, and each is keyed by it: <slime's id>:s<k> (co-op rules)
      const offX = (foeRand(e)-0.5) * 1.2;
      const offZ = (foeRand(e)-0.5) * 1.2;
      const sx = e.x + offX, sz = e.z + offZ;
      const nb = _dungeonBuildEnemy(smallDef);
      const byE = (0)+floorGroundY; // slimes sit on floor
      nb.g.position.set(sx, byE, sz);
      dScene.add(nb.g);
      const el = new THREE.PointLight(smallDef.light, 0.5, 3); el.position.set(sx, byE+0.5, sz); dScene.add(el);
      ENEMIES.push({x:sx, z:sz, hp:smallDef.hp, maxHp:smallDef.hp, mesh:nb.g, hpFg:nb.hpFg, limbs:nb.limbs, el,
        name:'Small Slime', spd:smallDef.spd, dead:false, alert:true, atkCd:0.5, ph:Math.random()*Math.PI*2,
        path:[], pathT:0, _origCol:smallDef.col, baseY:byE, isWraith:false, atkAnim:0, atkDir:{x:0,z:0},
        walkT:Math.random()*Math.PI*2, ranged:false, rangedCd:0, dmgMult:smallDef.dmgMult, hasCried:true,
        floor:e.floor, def:smallDef.def, resist:smallDef.resist, baseType:'Slime', variant:'small',
        drainCd:0, disguised:false, dormant:false, fleeT:0, telegraphT:0, telegraphMax:0,
        buildFn:'slime', combatYaw:Math.random()*Math.PI*2});
      if(e.id)keyFoe(ENEMIES[ENEMIES.length-1],e.id+':s'+s);
      // v61gj — Posture init for split-spawned Small Slime
      initPosture(ENEMIES[ENEMIES.length-1]);
    }
    showMsg(`The Slime splits!`, '#88ff88');
  }
}
// v80 S9 — experience banks; the level is taken when you sleep (inn, home, camp bedroll, fort cot).
let _lvlReadyShown=false;
function chkLvl(){
  try{const b=document.getElementById('lvready');if(b)b.style.display=(xp>=xpNext)?'inline-block':'none';}catch(e){}
  if(xp>=xpNext&&!_lvlReadyShown){_lvlReadyShown=true;showMsg('You feel ready to advance — find a bed and rest.','#e8d8a0');addLog('✨','Ready to level. Rest in a bed.');}
}
function takeLevelIfReady(){
  if(xp<xpNext||luOpen)return false;
  xp-=xpNext;level++;xpNext=Math.floor(xpNext*1.4);maxStamina+=10;stamina=Math.min(stamina+10,maxStamina);_lvlReadyShown=false;try{const b=document.getElementById('lvready');if(b)b.style.display=(xp>=xpNext)?'inline-block':'none';}catch(e){}
  sndLevelUp();openLevelUp();return true;
}
function castSpell(){
  if(typeof WORLD!=='undefined'&&isInterior())WORLD.guild.onCast(); // v80 S12 — hearth task
  // Empty-knownSpells hint — one of the two signals (along with HUD dimming) that there are carvings to find.
  if(!activeSpellId||Object.keys(knownSpells).length===0){
    showMsg('You know no magic. Sigils are carved into the walls of dungeon lower floors.','#a8a8d4');
    return;
  }
  const sp=SPELLS.find(s=>s.id===activeSpellId);
  if(!sp){showMsg('Spell not learned!','#6688cc');return;}
  const tier=getSpellTier(sp.id);
  if(!tier){showMsg('Spell not learned!','#6688cc');return;}

  // Block re-cast while hand animation is in flight — prevents double-spawns and tangled state
  if(isCasting()){return;}

  const actualCost=Math.round(spellCost(sp,tier)*_buffMult('spellCost',1));
  if(mana<actualCost){showMsg(`Not enough mana! (need ${actualCost})`,'#6688cc');return;}
  if(spCd>0){showMsg('Cooling down...','#6688cc');return;}
  mana-=actualCost;_offenceS=playClockS; /* S408 */
  spCd=spellCooldown(sp,tier);

  const dispName=spellDisplayName(sp,tier);

  // ── Wild effects at Impression tier ───────────────────────────
  // Tier 1 spells have a chance to roll a pattern from the spell's `wild` list.
  // Effect is applied BEFORE the normal cast body — fizzle short-circuits the cast,
  // scatter perturbs aim, backlash deals self-damage after resolution.
  let wildPattern=null;
  let selfDmgOnResolve=0;
  let aimJitter=0; // radians added to yaw for scatter
  if(tier===1 && sp.wild && sp.wild.length && Math.random()<IMPRESSION_WILD_CHANCE){
    wildPattern=sp.wild[Math.floor(Math.random()*sp.wild.length)];
    if(wildPattern==='fizzle'){
      // Half-refund mana, nothing else happens. Brief hand-raise with no orb release.
      mana=Math.min(effMaxMana(),mana+Math.round(actualCost*0.5));
      showMsg(`${sp.ico} ${sp.nameIr} fizzles — the shape will not hold.`,'#8a8ac8');
      // Still show the hand animation to hint at the failed cast — but mark type so no projectile spawns
      startCastAnim(sp, 'fizzle');
      return;
    } else if(wildPattern==='scatter'){
      aimJitter=(Math.random()*2-1)*(20*Math.PI/180); // ±20°
      showMsg(`${sp.ico} ${sp.nameIr} wavers in the casting...`,'#a8a8d4');
    } else if(wildPattern==='backlash'){
      // Telegraph; actual damage applied after cast body runs.
      selfDmgOnResolve=0.15;
      showMsg(`${sp.ico} ${sp.nameIr} bites back at you...`,'#d48a8a');
    } else if(wildPattern==='reversal'){
      // For Leigheas: brief inverse before the heal — 1s light damage.
      PHP=Math.max(1,PHP-Math.round(spellHealMag(sp,tier)*0.3));
      showMsg(`${sp.nameIr} stings before it soothes...`,'#d48a8a');
    }
  }

  // Animation type: projectile spells use the forward-thrust curve; heal/self uses the raise-up curve
  if(sp.role==='buff'){startCastAnim(sp,'self');applySpellBuff(sp,tier);if(typeof WORLD!=='undefined'&&isInterior())WORLD.guild.onCast();return;} // v80 — self spells
  const animType = sp.role==='heal' ? 'self' : 'projectile';
  startCastAnim(sp, animType);
  // Charge-up sound — per-school ambient buildup that plays during the cast animation.
  // Fizzle is the one case where the charge still plays (the shape almost held) — reinforces the failed-cast fiction.
  sndSpellCharge(sp.school);

  // Delay the actual projectile/heal resolution to the release frame of the animation (60% through).
  // This creates the classic telegraph-then-release rhythm players expect from spellcasting.
  const releaseDelayMs = Math.floor(CAST_ANIM_DURATION * 1000 * 0.6);
  // Snapshot aim state at the moment of release so the spell follows where you WERE looking when you pressed F,
  // NOT wherever you've moved the camera during the 330ms animation. This prevents late-frame yaw changes from
  // making wild-looking misfires feel like bugs. Right vector snapped too so weapon-tip spawn position is stable.
  const snapFwdX=fwdX, snapFwdZ=fwdZ, snapRgtX=rgtX, snapRgtZ=rgtZ;
  const snapPitch=pitch, snapPx=px, snapPz=pz;
  const snapIsOW=isOverworldZone(), snapScene=snapIsOW?scene:dScene, snapFloor=currentFloor;
  const snapAim=thirdPerson?tpAimPoint():null; // S175 — the crosshair's point at the click, as the rest is snapped

  setTimeout(()=>{
    // Main cast SFX fires at release so the sound lines up with the visual release and projectile spawn.
    sndSpell(sp.id, tier);
    // ── Projectile spells ────────────────────────────────────────
    if(sp.speed>0){
      const template=SPELL_ORB_TEMPLATES[sp.id];
      const fb=template?template.clone():new THREE.Group();
      if(!template){
        fb.add(new THREE.Mesh(new THREE.SphereGeometry(.1,8,8),new THREE.MeshBasicMaterial({color:sp.col})));
        fb.add(new THREE.Mesh(new THREE.SphereGeometry(.2,8,8),new THREE.MeshBasicMaterial({color:sp.glowCol,transparent:true,opacity:.3})));
      }
      const TIER_SCALE=[1.0, 1.35, 1.75][tier-1];
      const TIER_LIGHT=[2.5, 3.8, 5.5][tier-1];
      const TIER_RANGE=[6, 8, 11][tier-1];
      fb.scale.setScalar(TIER_SCALE);
      fb.add(new THREE.PointLight(sp.glowCol, TIER_LIGHT, TIER_RANGE));
      if(tier===3){
        const halo=new THREE.Mesh(
          new THREE.TorusGeometry(0.32,0.035,6,20),
          new THREE.MeshBasicMaterial({color:sp.glowCol,transparent:true,opacity:0.75,side:THREE.DoubleSide})
        );
        halo.rotation.x=Math.PI/2;
        fb.add(halo);
        fb.userData._halo=halo;
      }
      // Weapon-tip spawn approximation — offsets from player center using the snapped right + forward vectors.
      // Right: ~0.3u (weapon is in right hand); Forward: ~0.7u (extended at peak of thrust); Up: ~1.0u (shoulder height).
      // Matches the visual position of the cast orb on the sword tip during the release frame.
      const groundY = snapIsOW?activeTerrainH(snapPx,snapPz):(snapFloor===2?FLOOR2_Y:0);
      const spellBaseY = groundY + 1.0;
      const spawnX = snapPx + snapRgtX*0.3 + snapFwdX*0.7;
      const spawnZ = snapPz + snapRgtZ*0.3 + snapFwdZ*0.7;
      fb.position.set(spawnX, spellBaseY, spawnZ);
      const _tpShot=tpShotFrom('R',snapScene,snapAim);
      if(_tpShot)fb.position.copy(_tpShot.from);
      const cosPitch=_tpShot?Math.hypot(_tpShot.dir.x,_tpShot.dir.z):Math.cos(snapPitch);
      const cj=Math.cos(aimJitter), sj=Math.sin(aimJitter);
      const _fx=_tpShot?_tpShot.dir.x/(cosPitch||1):snapFwdX, _fz=_tpShot?_tpShot.dir.z/(cosPitch||1):snapFwdZ;
      const aimFwdX = _fx*cj - _fz*sj;
      const aimFwdZ = _fx*sj + _fz*cj;
      const vx=aimFwdX*sp.speed*cosPitch;
      const vz=aimFwdZ*sp.speed*cosPitch;
      const vy=_tpShot?_tpShot.dir.y*sp.speed:Math.sin(snapPitch)*sp.speed;
      fb.userData={vx,vy,vz,life:3,spell:sp,tier,_halo:fb.userData._halo};
      snapScene.add(fb);
      if(snapIsOW)ZB.push(fb); else BALLS.push(fb);

      // Cast flash at release — at the weapon tip, not the player center
      const flash=new THREE.PointLight(sp.glowCol, TIER_LIGHT*0.9, TIER_RANGE*0.7);
      flash.position.copy(fb.position);
      snapScene.add(flash);
      let fLife=0.18;
      const flashTick=()=>{
        fLife-=1/60;
        if(fLife<=0){ snapScene.remove(flash); return; }
        flash.intensity = TIER_LIGHT*0.9 * (fLife/0.18);
        requestAnimationFrame(flashTick);
      };
      requestAnimationFrame(flashTick);

      if(!wildPattern)showMsg(`${sp.ico} ${dispName}!`,'#88ccff');
    }
    // ── Heal spells (Leigheas) ───────────────────────────────────
    else if(sp.role==='heal'){
      const heal=Math.round(spellHealMag(sp,tier)+level*(sp.healLvl||0));
      PHP=Math.min(effMaxHP(),PHP+heal);
      const TIER_LIGHT=[2.5, 3.8, 5.5][tier-1];
      const TIER_RANGE=[5, 7, 9][tier-1];
      const flash=new THREE.PointLight(sp.glowCol, TIER_LIGHT, TIER_RANGE);
      const spellBaseY=snapIsOW?activeTerrainH(snapPx,snapPz)+0.9:(snapFloor===2?FLOOR2_Y:0)+0.9;
      flash.position.set(snapPx, spellBaseY, snapPz);
      snapScene.add(flash);
      let fLife=0.55;
      const flashTick=()=>{
        fLife-=1/60;
        if(fLife<=0){ snapScene.remove(flash); return; }
        flash.intensity = TIER_LIGHT * (fLife/0.55);
        requestAnimationFrame(flashTick);
      };
      requestAnimationFrame(flashTick);
      showMsg(`${sp.ico} ${dispName} — restored ${heal} HP`,'#aaffaa');
    }

    // Backlash resolves AFTER the cast body so the player sees the spell go off, then feels the rebound
    if(selfDmgOnResolve>0){
      const selfDmg=Math.max(1,Math.round(spellMag(sp,tier)*selfDmgOnResolve));
      PHP=Math.max(0,PHP-selfDmg);
      showMsg(`Backlash! ${selfDmg} damage.`,'#e88a8a');
      if(PHP<=0)playerDead();
    }
  }, releaseDelayMs);
}

// Kick off the cast animation. Called at the start of castSpell once the cast is committed.
// animType: 'projectile' (forward thrust), 'self' (raise overhead), 'fizzle' (brief flutter, no orb bloom)
// The animation and orb are both driven from the vmSword tick (see render loop).
function startCastAnim(sp, animType){
  if(!vmSword)return;
  castT = CAST_ANIM_DURATION;
  castAnimType = animType;
  castSpellSchoolCol = sp.glowCol || 0xffffff;
  // Initialize the orb at the weapon tip — color matches the spell's school
  const orb = vmSword.userData.castOrb;
  const halo = vmSword.userData.castOrbHalo;
  const lightTip = vmSword.userData.castOrbLight;
  if(orb){orb.material.color.setHex(castSpellSchoolCol); orb.material.opacity=0;}
  if(halo){halo.material.color.setHex(castSpellSchoolCol); halo.material.opacity=0;}
  if(lightTip){lightTip.color.setHex(castSpellSchoolCol); lightTip.intensity=0;}
}

// Spell button: shows active spell display name, or dimmed placeholder if no magic known.
function updateSpellButton(){
  const btn=document.getElementById('fbtn');
  if(!btn)return;
  const nKnown=Object.keys(knownSpells).length;
  if(!nKnown||!activeSpellId){
    btn.textContent='◯ No magic (F)';
    btn.style.opacity='.55';
    btn.style.fontStyle='italic';
    return;
  }
  const sp=SPELLS.find(s=>s.id===activeSpellId);
  if(!sp){btn.textContent='◯ No magic (F)';return;}
  const tier=getSpellTier(sp.id);
  btn.textContent=`${sp.ico} ${spellDisplayName(sp,tier)} (F)`;
  btn.style.opacity='1';
  btn.style.fontStyle='normal';
}

// ═══════════════════════════════════════════════════════════════════
// v61x: POTION ELIXIR SYSTEM
// ═══════════════════════════════════════════════════════════════════
// Fifteen potions generated from 5 lines × 3 tiers. Each line has a family
// name (Regeneration, Focus, Energy, Warding, Swiftness) plus a per-tier
// scaling of mult/rate/duration/price. Rarity drives both loot weight and
// shop availability. Potions use the same `effect:{type,...}` shape as herbs
// so they route through _applyBuff and appear in ACTIVE_BUFFS like herb effects.
//
// Tier comparison model: when a potion is consumed, we check ACTIVE_BUFFS for
// the same buff type. If a higher-tier buff is active, the new potion is rejected
// (not consumed, toast explains). If equal or lower tier is active, the new one
// replaces it — upgrading if higher, refreshing if equal. Matches Michael's
// v61x design: "can't waste Mild on top of Strong, but upgrade path exists."

const POTION_LINES = [
  {base:'regen_hp', family:'Regeneration', ico:'❤️', buffType:'hpRegen', buffCol:'#44cc44',
   tiers:[
     {tier:1,label:'Mild',   rate:0.5, duration:60, price:30,  sellMult:0.4, lootW:4,   lootTables:['easy','medium','hard']},
     {tier:2,label:'Strong', rate:1.2, duration:60, price:90,  sellMult:0.4, lootW:2,   lootTables:['medium','hard']},
     {tier:3,label:'Master', rate:2.5, duration:60, price:240, sellMult:0.4, lootW:0.8, lootTables:['hard']},
   ]},
  {base:'regen_mp', family:'Focus', ico:'✦', buffType:'mpRegen', buffCol:'#4a8ad4',
   tiers:[
     {tier:1,label:'Mild',   rate:0.5, duration:60, price:35,  sellMult:0.4, lootW:4,   lootTables:['easy','medium','hard']},
     {tier:2,label:'Strong', rate:1.1, duration:60, price:100, sellMult:0.4, lootW:2,   lootTables:['medium','hard']},
     {tier:3,label:'Master', rate:2.2, duration:60, price:270, sellMult:0.4, lootW:0.8, lootTables:['hard']},
   ]},
  {base:'regen_st', family:'Energy', ico:'⚡', buffType:'stRegen', buffCol:'#40a040',
   tiers:[
     {tier:1,label:'Mild',   rate:0.6, duration:60, price:28,  sellMult:0.4, lootW:4,   lootTables:['easy','medium','hard']},
     {tier:2,label:'Strong', rate:1.3, duration:60, price:85,  sellMult:0.4, lootW:2,   lootTables:['medium','hard']},
     {tier:3,label:'Master', rate:2.8, duration:60, price:220, sellMult:0.4, lootW:0.8, lootTables:['hard']},
   ]},
  {base:'ward', family:'Warding', ico:'🛡', buffType:'dmgReduce', buffCol:'#ccaa44',
   // For dmgReduce the buff `mult` is <1 (damage multiplier). pct is the display form.
   tiers:[
     {tier:1,label:'Mild',   mult:0.85, pct:15, duration:45, price:40,  sellMult:0.4, lootW:4,   lootTables:['easy','medium','hard']},
     {tier:2,label:'Strong', mult:0.75, pct:25, duration:60, price:120, sellMult:0.4, lootW:2,   lootTables:['medium','hard']},
     {tier:3,label:'Master', mult:0.60, pct:40, duration:75, price:320, sellMult:0.4, lootW:0.8, lootTables:['hard']},
   ]},
  {base:'swift', family:'Swiftness', ico:'💨', buffType:'sprintSpeed', buffCol:'#aaccaa',
   // For sprintSpeed the buff `mult` is >1. pct is how much extra above 100%.
   tiers:[
     {tier:1,label:'Mild',   mult:1.10, pct:10, duration:30, price:32,  sellMult:0.4, lootW:4,   lootTables:['easy','medium','hard']},
     {tier:2,label:'Strong', mult:1.18, pct:18, duration:45, price:95,  sellMult:0.4, lootW:2,   lootTables:['medium','hard']},
     {tier:3,label:'Master', mult:1.28, pct:28, duration:60, price:255, sellMult:0.4, lootW:0.8, lootTables:['hard']},
   ]},
];

// Generated potion registry — id → item template. Use makePotion(id) to stamp a
// fresh copy for drops/shops. Also used by the buff-compare logic to know a
// potion's tier given just its effect-type match.
const POTIONS = {};
(function generatePotions(){
  POTION_LINES.forEach(line=>{
    line.tiers.forEach(t=>{
      const id = `${line.base}_${t.label.toLowerCase()}`;
      const name = `Elixir of ${line.family} (${t.label})`;
      // Effect payload — matches the herb hiddenEffect shape so _applyBuff can consume it
      const eff = {type:line.buffType, duration:t.duration, label:`${line.family} (${t.label})`, col:line.buffCol, _potionTier:t.tier};
      if(line.buffType==='hpRegen'||line.buffType==='mpRegen'||line.buffType==='stRegen'){
        eff.rate = t.rate;
      } else {
        eff.mult = t.mult;
        eff.pct = t.pct;
      }
      POTIONS[id] = {
        potionId:id,
        name, ico:line.ico, type:'potion',
        effect:eff,
        weight:0.5,
        buyPrice:t.price, sellMult:t.sellMult,
        _tier:t.tier, _line:line.base,
      };
    });
  });
})();

// Stamp a fresh copy for drops/shops — never mutate POTIONS[id] directly.
function makePotion(id){
  const tpl = POTIONS[id];
  if(!tpl) return null;
  // Deep-ish copy — effect object is small, no nested mutation expected
  return {...tpl, effect:{...tpl.effect}};
}

// v61x: append potion entries to the existing LOOT_POOLS. Each tier has a
// pool-specific weight — Mild is common filler, Strong uncommon, Master rare.
// Appended rather than replacing existing entries so the familiar drop mix
// (health potions, herbs, torches) is preserved alongside the new tonics.
(function wirePotionsIntoLoot(){
  if(typeof LOOT_POOLS==='undefined')return;
  // Per-pool weights keyed by tier. Chest is slightly skewed toward higher tiers
  // (they're the "reward" container); barrels/corpses lean common.
  const WEIGHTS = {
    barrel: {1:3,  2:1,   3:0.3},
    chest:  {1:3,  2:2,   3:1},
    corpse: {1:3,  2:1,   3:0.4},
  };
  Object.entries(WEIGHTS).forEach(([poolKey, tierW])=>{
    POTION_LINES.forEach(line=>{
      line.tiers.forEach(t=>{
        const id = `${line.base}_${t.label.toLowerCase()}`;
        LOOT_POOLS[poolKey].push({w:tierW[t.tier], roll:()=>makePotion(id)});
      });
    });
  });
})();

// v61x: extend shop potion stock.
//   Mira's Apothecary (Ashenmoor) — all 5 Mild tonics
//   Edna's Cottage (Ashenmoor)   — all 5 Mild tonics at slightly cheaper prices
//   Ironhaven's War Supplies     — 5 Strong + 1-2 Master (rotating curio stock)
// Both Ashenmoor shops share SHOP_STOCK.potion, so to differentiate them we'd
// need a per-keeper stock table. For now, simplest thing that works: everyone
// in Ashenmoor sees the same Mild lineup; Ironhaven gets Strong/Master upgrades.
(function wirePotionsIntoShops(){
  if(typeof SHOP_STOCK==='undefined' || typeof IH_SHOP_STOCK==='undefined') return;
  // Ashenmoor potion shop — all 5 Mild tier
  POTION_LINES.forEach(line=>{
    const mild = POTIONS[`${line.base}_mild`];
    if(mild) SHOP_STOCK.potion.push({...mild, effect:{...mild.effect}});
  });
  // Ironhaven War Supplies — Strong tier full set + Master HP regen + Master Warding
  POTION_LINES.forEach(line=>{
    const strong = POTIONS[`${line.base}_strong`];
    if(strong) IH_SHOP_STOCK.potion.push({...strong, effect:{...strong.effect}});
  });
  // Master tier — only the two most combat-useful lines as rotating endgame stock
  ['regen_hp','ward'].forEach(base=>{
    const master = POTIONS[`${base}_master`];
    if(master) IH_SHOP_STOCK.potion.push({...master, effect:{...master.effect}});
  });
})();

// Tier-aware buff application. Returns:
//   'applied'  — new or equal-tier buff applied (refresh or upgrade)
//   'blocked'  — existing buff is higher tier, nothing happens (potion not consumed)
// Non-potion callers (herbs, etc.) should keep using _applyBuff directly; this
// wrapper is what useItem calls for effects that carry _potionTier.
function _applyPotionBuff(eff){
  const existing = ACTIVE_BUFFS.find(b=>b.type===eff.type);
  if(existing && (existing._potionTier||0) > (eff._potionTier||0)){
    return 'blocked';
  }
  _applyBuff(eff);
  return 'applied';
}

function openInv(){_releasePointerLockForMenu();invOpen=true;document.getElementById('ip').style.display='block';renderInv();}
function closeInv(){invOpen=false;document.getElementById('ip').style.display='none';G.focus();}
function renderInv(){[['head','🪖'],['chest','👕'],['hands','🧤'],['legs','👖'],['feet','👢'],['weapon','⚔️'],['offhand','🛡']].forEach(([k,def])=>{const el1=document.getElementById('qi-'+k),el2=document.getElementById('qn-'+k);if(!el1)return;const it=EQ[k];if(it)el1.innerHTML=iconHTML(it).replace('margin-right:6px','margin:0');else el1.textContent=def;el2.textContent=it?it.name:'—';});const w=EQ.weapon,lo=w?w.atk[0]:FISTS.atk[0],hi=w?w.atk[1]:FISTS.atk[1];document.getElementById('sa').textContent=`${lo+Math.floor(level*1.5)}–${hi+Math.floor(level*1.5)}`;const def2=Object.values(EQ).reduce((a,v)=>a+(v&&v.def?v.def:0),0);document.getElementById('sd').textContent=def2;document.getElementById('sl').textContent=level;document.getElementById('sk').textContent=kills;document.getElementById('sg').textContent=gold;const _tw=totalCarryWeight(),_mx=maxCarry();document.getElementById('si').textContent=_tw.toFixed(1);document.getElementById('bc').textContent=`(${_tw.toFixed(1)}/${_mx.toFixed(0)} wt)`;const grid=document.getElementById('bgrid');grid.innerHTML='';const cellCount=Math.max(20,BAG.length);for(let i=0;i<cellCount;i++){const div=document.createElement('div');if(i<BAG.length){const it=BAG[i];div.className='bi';div.innerHTML=`<span class="bo">${iconHTML(it)}</span><span class="bn">${it.name}</span>${it.qty>1?`<span class="bq">x${it.qty}</span>`:''}`;div.onclick=()=>useItem(i);}else{div.className='be';}grid.appendChild(div);}}
function useItem(i){
  const it=BAG[i];if(!it)return;
  if(it.type==='herb'){useHerb(i);return;}
  if(it.type==='spellbook'){readSpellbook(i);return;} // v80
  if(it.type==='rubbing'){(worldState.rubbings||(worldState.rubbings={}))[it.seed]=it.gate;showMsg(`${it.gate} is marked on your map.`,'#c0e0ff');it.qty=(it.qty||1)-1;if(it.qty<=0)BAG.splice(i,1);if(typeof renderInv==='function')renderInv();return;} // v80 — a rubbing marks a sigil gate
  // v61x: potions with an `effect` field use the buff system (regen, warding, swiftness).
  // Tier-aware: a lower-tier potion doesn't overwrite a higher-tier active buff — instead
  // the potion is NOT consumed and the player gets a message. Equal or higher tier replaces.
  if(it.type==='potion' && it.effect){
    const result = _applyPotionBuff(it.effect);
    if(result==='blocked'){
      showMsg(`A stronger ${it.effect.label.split(' (')[0]} is already active.`, '#cc8844');
      return; // Don't consume
    }
    sndUsePotion();
    it.qty = (it.qty||1) - 1;
    if(it.qty<=0) BAG.splice(i,1);
    return;
  }
  if(it.type==='potion'&&it.heal){sndUsePotion();PHP=Math.min(effMaxHP(),PHP+it.heal);showMsg('Used '+it.name+'! +'+it.heal+' HP','#44ee44');it.qty--;if(it.qty<=0)BAG.splice(i,1);}
  else if(it.type==='potion'&&it.mana){sndUsePotion();mana=Math.min(effMaxMana(),mana+it.mana);showMsg('Used '+it.name+'! +'+it.mana+' Mana','#88aaff');it.qty--;if(it.qty<=0)BAG.splice(i,1);}
  else if(it.type==='potion'&&it.stam){sndUsePotion();stamina=Math.min(effMaxStamina(),stamina+it.stam);staminaCD=0;showMsg('Used '+it.name+'! +'+it.stam+' Stamina','#88ff88');it.qty--;if(it.qty<=0)BAG.splice(i,1);}
  else if(it.type==='book'){openBookReader(i);}
  else if(it.type==='misc'&&it.name==='Mystic Scroll'){/* Mystic Scrolls are vestigial from the old magic system — silently consumed, no effect. Old saves may still have some in bags. */it.qty--;if(it.qty<=0)BAG.splice(i,1);showMsg('The scroll crumbles to dust. Its meaning is lost to a dead tradition.','#888');}
  // v64 — Ammo equip path. Mirrors the type==='equip' branch but skips
  // canEquip (no attribute reqs on arrows currently) and routes to the ammo
  // slot specifically. If an existing stack of the same arrow type is
  // already equipped, MERGE quantities rather than swapping — the player
  // should be able to top up their quiver from a fresh purchase. If the
  // equipped ammo is a DIFFERENT arrow type, fall through to the swap path:
  // displaced ammo goes to the bag, new ammo gets equipped.
  else if(it.type==='ammo'){
    const cur = EQ.ammo;
    if(cur && cur.name === it.name){
      // Same arrow type — merge stacks.
      cur.qty = (cur.qty||0) + (it.qty||1);
      BAG.splice(i,1);
      showMsg(`+${it.qty||1} ${it.name} — ${cur.qty} in quiver`,'#c8a878');
    } else {
      // Different arrow type or empty slot — swap.
      EQ.ammo = {...it};
      BAG.splice(i,1);
      if(cur && cur.name){
        bagAdd({...cur, qty:cur.qty||1});
        showMsg(`Equipped ${it.name}. ${cur.name} returned to bag.`,'#c8a84a');
      } else {
        showMsg('Equipped '+it.name+'!','#c8a84a');
      }
    }
    renderInv();
  }
  else if(it.type==='equip'){
    // v61ar: equip-block uses showMsgLong (5.5s) rather than the standard
    // 2.8s showMsg. The message — "Requires Might 5 (you have 3)" — needs
    // a beat to parse: the player has to register what attribute is
    // gating, what value is needed, and what they've got. 2.8s was tight
    // for that. Combined with the z-index bump on #msg (now 210, was 5),
    // the warning is also no longer hidden behind the hub overlay (z 55).
    const req=canEquip(it);if(!req.ok){showMsgLong(`⚠ ${req.msg}`,'#cc8844');return;}
    // v64 — Inverse two-hander guard: can't equip an offhand while a
    // two-handed weapon is in the weapon slot. Player must unequip the
    // two-hander first. We do this as a soft refusal (showMsgLong) rather
    // than auto-unequipping the weapon, because the auto path could surprise
    // players mid-combat (e.g. mis-click a torch and lose your bow).
    if(it.slot==='offhand' && EQ.weapon && EQ.weapon.twoHand){
      showMsgLong(`⚠ Can't equip ${it.name} — ${EQ.weapon.name} is two-handed. Unequip it first.`,'#cc8844');
      return;
    }
    // v64 — Two-handed weapons (bow now; claymore/great axe/war hammer ship
    // will reuse this hook). Equipping a two-hander auto-stows the offhand to
    // the bag. Done BEFORE the EQ[it.slot]=it line so the displaced item
    // doesn't get tangled with weapon-replacement bookkeeping.
    let _displacedOff = null;
    if(it.slot==='weapon' && it.twoHand){
      _displacedOff = _clearOffhandForTwoHander('two-hander equipped');
    }
    const old=EQ[it.slot];EQ[it.slot]=it;BAG.splice(i,1);if(old&&old.name)bagAdd(eqBagCopy(old,it.slot));
    if(_displacedOff){
      showMsg(`Equipped ${it.name}! (${_displacedOff.name} stowed — two-handed weapon)`,'#c8a84a');
    } else {
      showMsg('Equipped '+it.name+'!','#c8a84a');
    }
    invalidateArmorCache();
    if(it.slot==='weapon'){sndEquipWeapon();buildViewmodel();}
    else if(it.slot==='offhand'){sndEquipShield();buildShieldViewmodel();}
    else if(it.slot==='hands' || it.slot==='chest'){
      // v70/v70.1 — gauntlets drive the FPV hand colour; the chestplate drives
      // the arm (sleeve) colour. Either changing rebuilds both viewmodels so
      // the weapon hand(s) AND the shield/torch hand+arm recolour.
      sndEquipArmor(it.slot);
      buildViewmodel(); buildShieldViewmodel();
    }
    else{sndEquipArmor(it.slot);}}renderInv();}

function updateHUD(){
  const emHP=effMaxHP(),emMana=effMaxMana(),emSt=effMaxStamina();
  document.getElementById('hb').style.width=(PHP/emHP*100)+'%';document.getElementById('hv').textContent=Math.floor(PHP);
  document.getElementById('mb').style.width=(mana/emMana*100)+'%';document.getElementById('mv').textContent=Math.floor(mana);
  document.getElementById('stb').style.width=(stamina/emSt*100)+'%';
  document.getElementById('stb').style.background=staminaCD>0?'#a03030':'#40a040';document.getElementById('sv').textContent=Math.floor(stamina);document.getElementById('lv').textContent=level;document.getElementById('xv').textContent=xp;document.getElementById('xn').textContent=xpNext;document.getElementById('bh').textContent=BAG.length?BAG.slice(-2).map(b=>b.ico+' '+b.name).join(' · '):'';
  // Active buffs line
  const buffEl=document.getElementById('buff-bar');
  if(buffEl){
    // v61x: icon-based Active Effects. Each buff type maps to a symbolic glyph; the
    // pill shows the glyph + remaining seconds. Hovering reveals the full label via
    // native title. Unknown buff types fall through to a generic ✧ so the system
    // stays forward-compatible with new buff flavors without breaking the display.
    const BUFF_ICONS = {
      hpRegen:'❤️', mpRegen:'✦', stRegen:'⚡',
      dmgReduce:'🛡', physResist:'🛡',
      sprintSpeed:'💨',
      spellDmg:'🔮', magicDmg:'🔮', spellCost:'💠',
      meleeDmg:'⚔️', dmgBurst:'⚔️',
      goldFind:'🪙', xpBoost:'⭐',
      minimapPulse:'🗺', detectReduce:'👁',
      maxStamBuff:'⚡',
    };
    if(ACTIVE_BUFFS.length){
      buffEl.classList.add('has-buffs');
      buffEl.innerHTML = ACTIVE_BUFFS.map(b=>{
        const ico = BUFF_ICONS[b.type] || '✧';
        const secs = Math.ceil(b.remaining);
        const lbl = (b.label||b.type).replace(/"/g,'');
        return `<span class="buff-pill" title="${lbl} — ${secs}s remaining"><span class="bp-ico">${ico}</span><span class="bp-time">${secs}s</span></span>`;
      }).join('');
    } else {
      buffEl.classList.remove('has-buffs');
      buffEl.innerHTML='';
    }
  }
  const ob=document.getElementById('ob');if(lid==='overworld'){ob.style.color='#88cc44';
  const _shipHint=(activeZoneId==='world'&&typeof WORLD!=='undefined')?WORLD.shipPrompt():null; // v80 C — the ship comes first
  if(_shipHint){ob.style.color='#c8b880';ob.textContent=_shipHint;}else
  if(activeZoneId==='world'&&ZONES.world&&ZONES.world.beds&&ZONES.world.beds.some(b=>Math.hypot(px-b.x,pz-b.z)<1.5)){ob.style.color='#c8b880';ob.textContent="A bedroll — Press 'E' to rest"+(level<(typeof levelFor==='function'?levelFor(xp):level)?' and take your level':'');}else
  if(activeZoneId==='forest'){const alive=ZE.filter(e=>!e.dead&&!e.locked).length;ob.textContent=alive?`${alive} creature${alive>1?'s':''} nearby · Stay on the path`:'Deep in the Deepwood Forest · E near gate to travel';}
  else if(activeZoneId==='ironhaven'){ob.textContent='Press E near a soldier or gate · Press E near a building to enter';}
  else{ob.textContent='Press E near a villager to talk · Press E near a door or cave to enter';}
}else if(lid==='overworld'&&activeZoneId==='world'&&typeof WORLD!=='undefined'&&WORLD.shipPrompt()){ob.style.color='#c8b880';ob.textContent=WORLD.shipPrompt();}else if(lid&&isInterior()){ob.style.color='#c8b880';const _nb=INT_BEDS.find(b=>Math.hypot(px-b.x,pz-b.z)<1.6&&Math.abs(jumpY-(b.y||0))<.9);const _hp=(typeof WORLD!=='undefined')?(WORLD.guestPrompt()||WORLD.hatchPrompt()||WORLD.lootPrompt()||WORLD.boxPrompt()):null;ob.textContent=_hp?_hp:_nb?((typeof WORLD!=='undefined'&&WORLD.bedPrompt(_nb))||"Someone else's bed")+' · Walk south to exit':(intNPCMesh?'Press E near the keeper to talk · Walk south to exit':'No one is in · Walk south to exit');}else{const a=ENEMIES.filter(e=>!e.dead).length;const uk=KEYS.filter(k=>!k.collected).length;const ud=DOORS.filter(d=>!d.open&&d.locked).length;const sh=EQ.offhand&&EQ.offhand.shieldType==='shield';ob.style.color=blocking?'#88aaff':'#c8a84a';ob.textContent=a+' enemies'+(uk?' · '+uk+' key'+(uk>1?'s':'')+(ud?' to find':''):'')+(ud&&!uk?' · '+ud+' locked door'+(ud>1?'s':''):'')+(blocking?' · 🛡 '+(sh?'Blocking':'Guarding'):'');}}

const mmC=document.getElementById('mm').getContext('2d');
function drawMM(){
  if(activeZoneId==='world'&&lid==='overworld'&&typeof WORLD!=='undefined'){WORLD.drawMinimap(mmC,104);return;} // v80 S12 — local map
  mmC.clearRect(0,0,104,104);mmC.fillStyle='rgba(0,0,0,.78)';mmC.fillRect(0,0,104,104);
  let sc=1;
  if(lid==='overworld'){
    const zSz=activeZoneId==='forest'?FOREST_SIZE:activeZoneId==='ironhaven'?IH_SIZE:activeZoneId==='bealach_south'?BEALACH_SOUTH_SIZE:activeZoneId==='hearthwick'?HEARTHWICK_SIZE:OW;
    sc=104/zSz;
    const bgCol=activeZoneId==='forest'?'#1a3010':activeZoneId==='ironhaven'?'#4a4858':activeZoneId==='bealach_south'?'#5a7030':activeZoneId==='hearthwick'?'#3a5020':'#2a5018';
    mmC.fillStyle=bgCol;mmC.fillRect(0,0,104,104);
    if(activeZoneId==='overworld'){
      PORTALS.forEach(p=>{mmC.fillStyle='#9988ff';mmC.fillRect(p.x*sc-3,p.z*sc-3,6,6);});
      OW_NPCS.forEach(n=>{mmC.fillStyle='#44ff44';mmC.fillRect(n.g.position.x*sc-2,n.g.position.z*sc-2,4,4);});
      ASHENMOOR_GATES.forEach(g=>{mmC.fillStyle='#c8a84a';mmC.fillRect(g.x*sc-3,g.z*sc-3,6,6);});
    } else if(activeZoneId==='ironhaven'){
      // Draw fortress clearing as lighter square
      const fcx=(100)*sc,fcz=(100)*sc,fr=55*sc;
      mmC.fillStyle='#6a8070';mmC.fillRect(fcx-fr,fcz-fr,fr*2,fr*2);
      // Fortress perimeter
      const fsx=(65)*sc,fsy=(65)*sc,fsz=70*sc;
      mmC.strokeStyle='#888888';mmC.lineWidth=2;mmC.strokeRect(fsx,fsy,fsz,fsz);
      // Buildings as small squares
      mmC.fillStyle='#707878';
      IRONHAVEN_HOUSES.forEach(h=>{mmC.fillRect(h.doorX*sc-4,h.doorZ*sc-4,8,8);});
      IRONHAVEN_NPCS.forEach(n=>{mmC.fillStyle='#44ff44';mmC.fillRect(n.g.position.x*sc-2,n.g.position.z*sc-2,4,4);});
      IRONHAVEN_GATES.forEach(g=>{mmC.fillStyle='#c8a84a';mmC.fillRect(g.x*sc-3,g.z*sc-3,6,6);});
      // Portals in outer ring
      if(PORTALS&&PORTALS.length){PORTALS.forEach(p=>{mmC.fillStyle='#9988ff';mmC.fillRect(p.x*sc-3,p.z*sc-3,6,6);});}
    } else if(activeZoneId==='forest'){
      // Draw path as lighter line
      mmC.strokeStyle='#887060';mmC.lineWidth=Math.max(2,FOREST_PATH_W*2*sc);
      const wp=[{x:150,z:10},{x:150,z:70},{x:90,z:70},{x:90,z:140},{x:180,z:140},{x:180,z:210},{x:120,z:210},{x:120,z:270},{x:150,z:290}];
      mmC.beginPath();mmC.moveTo(wp[0].x*sc,wp[0].z*sc);
      wp.slice(1).forEach(p=>mmC.lineTo(p.x*sc,p.z*sc));
      mmC.stroke();
      FOREST_GATES.forEach(g=>{mmC.fillStyle='#c8a84a';mmC.fillRect(g.x*sc-3,g.z*sc-3,6,6);});
      ZE.forEach(e=>{if(!e.dead&&!e.locked){mmC.fillStyle='#cc3322';mmC.fillRect(e.x*sc-2,e.z*sc-2,5,5);}});
      if(PORTALS&&PORTALS.length){PORTALS.forEach(p=>{mmC.fillStyle='#9988ff';mmC.fillRect(p.x*sc-3,p.z*sc-3,6,6);});}
    } else if(activeZoneId==='bealach_south'){
      // v61: plains path (sandy color), wolves + bandits, two gates
      mmC.strokeStyle='#b8a068';mmC.lineWidth=Math.max(2,FOREST_PATH_W*2*sc);
      const wp=BEALACH_SOUTH_CONFIG.pathWaypoints;
      mmC.beginPath();mmC.moveTo(wp[0].x*sc,wp[0].z*sc);
      wp.slice(1).forEach(p=>mmC.lineTo(p.x*sc,p.z*sc));
      mmC.stroke();
      BEALACH_SOUTH_GATES.forEach(g=>{mmC.fillStyle='#c8a84a';mmC.fillRect(g.x*sc-3,g.z*sc-3,6,6);});
      ZE.forEach(e=>{if(!e.dead&&!e.locked){mmC.fillStyle='#cc3322';mmC.fillRect(e.x*sc-2,e.z*sc-2,5,5);}});
    } else if(activeZoneId==='hearthwick'){
      // v61: small inn-village. Building, NPCs, gates
      HEARTHWICK_HOUSES.forEach(h=>{mmC.fillStyle='#707060';mmC.fillRect(h.doorX*sc-4,h.doorZ*sc-4,8,8);});
      HEARTHWICK_NPCS.forEach(n=>{mmC.fillStyle='#44ff44';mmC.fillRect(n.g.position.x*sc-2,n.g.position.z*sc-2,4,4);});
      HEARTHWICK_GATES.forEach(g=>{mmC.fillStyle='#c8a84a';mmC.fillRect(g.x*sc-3,g.z*sc-3,6,6);});
    }
  }
  else if(lid&&isInterior()){
    // Room dims by type — must match DIMS in buildInterior
    const _mmDims={weapon:{W:11,D:10},armor:{W:11,D:10},potion:{W:9,D:9},misc:{W:10,D:9},inn:{W:13,D:11},church:{W:10,D:16},castle:{W:18,D:22}};
    const itype=currentHouse?currentHouse.type:'misc';
    const {W:iW,D:iD}=_mmDims[itype]||{W:10,D:9};
    const mmSZ=96; const mmOff=4;
    const scX=mmSZ/iW, scZ=mmSZ/iD;
    sc=mmSZ/Math.max(iW,iD);
    // Background
    mmC.fillStyle='#1a1208';mmC.fillRect(0,0,104,104);
    // Room floor
    mmC.fillStyle='#3a2a10';mmC.fillRect(mmOff,mmOff,iW*scX,iD*scZ);
    // Walls (slightly lighter border)
    mmC.strokeStyle='#6a4820';mmC.lineWidth=2;mmC.strokeRect(mmOff,mmOff,iW*scX,iD*scZ);
    // Exit door on south wall
    mmC.fillStyle='#c8a84a';
    mmC.fillRect(mmOff+(iW/2-0.5)*scX, mmOff+iD*scZ-4, scX, 4);
    // Counter position by type
    const _counterX={weapon:iW/2,armor:iW/2,potion:iW/2,misc:iW/2,inn:iW/2,church:iW/2};
    const _counterZ={weapon:2.5,armor:2.5,potion:2.8,misc:2.5,inn:1.0,church:iD*.1};
    const _counterW={weapon:iW*.55,armor:iW*.55,potion:iW*.43,misc:iW*.55,inn:iW*.7,church:2.2};
    if(itype!=='church'){
      mmC.fillStyle='#6a3a10';
      const cW=_counterW[itype]||iW*.5;
      const cX=mmOff+(_counterX[itype]-cW/2)*scX;
      const cZ=mmOff+_counterZ[itype]*scZ;
      mmC.fillRect(cX, cZ, cW*scX, 0.5*scZ);
    }
    // NPC dot
    mmC.fillStyle='#ffdd00';
    mmC.beginPath();mmC.arc(mmOff+intNPCPos.x*scX, mmOff+intNPCPos.z*scZ, 3, 0, Math.PI*2);mmC.fill();
  }
  else{sc=104/Math.max(dR,dC);
    // Update fog of war — reveal cells within sight radius
    const pr=Math.round(pz),pc=Math.round(px),rev=5;
    const mmRev=currentFloor===2?mmRevealed2:mmRevealed;
    for(let r=Math.max(0,pr-rev);r<=Math.min(dR-1,pr+rev);r++)
      for(let c=Math.max(0,pc-rev);c<=Math.min(dC-1,pc+rev);c++)
        if(Math.hypot(c-px,r-pz)<=rev)mmRev[r][c]=1;
    const curMap=activeMap();
    for(let r=0;r<dR;r++)for(let c=0;c<dC;c++){
      if(!mmRev[r][c]){mmC.fillStyle='#0a0908';mmC.fillRect(c*sc,r*sc,sc,sc);continue;}
      const mv=curMap[r][c];
      mmC.fillStyle=mv===0?'#1e1a14':mv===5?'#8a4a10':mv===6?'#3a3020':mv===3?'#7a6840':'#4a4438';
      mmC.fillRect(c*sc,r*sc,sc-.5,sc-.5);}
    // S329 (Michael's A on #58) — Ashwort's pulse: for its 5 s, every undisguised foe on this floor within 20 units shows, seen or not
    // S364 — a disguised mimic is never drawn, seen or not: the map drew it as a foe on any revealed cell, beside no chest
    const _pulse=_hasBuff('minimapPulse');
    ENEMIES.forEach(e=>{if(!e.dead&&!e.disguised&&e.floor===currentFloor&&(mmRev[Math.round(e.z)]?.[Math.round(e.x)]||(_pulse&&!e.disguised&&Math.hypot(e.x-px,e.z-pz)<20))){mmC.fillStyle='#cc3322';mmC.fillRect(e.x*sc-2,e.z*sc-2,5,5);}});
    KEYS.forEach(k=>{if(!k.collected&&k.floor===currentFloor&&mmRev[Math.round(k.z)]?.[Math.round(k.x)]){mmC.fillStyle='#ffd700';mmC.fillRect(k.x*sc-2,k.z*sc-2,5,5);}});
    // Sigils — gold ✦ glyph on cells that have been revealed.
    (typeof SIGILS!=='undefined'?SIGILS:[]).forEach(s=>{
      if(s.floor!==currentFloor)return;
      if(!mmRev[Math.round(s.z)]?.[Math.round(s.x)])return;
      mmC.fillStyle='#daa520';
      mmC.font='bold 10px sans-serif';
      mmC.textAlign='center';
      mmC.textBaseline='middle';
      mmC.fillText('✦',s.x*sc,s.z*sc);
    });
    // Show staircase on minimap
    if(dStairC!==null&&mmRev[dStairR]?.[dStairC]){mmC.fillStyle=currentFloor===1?'#ffcc66':'#dd88ff';mmC.fillRect(dStairC*sc-3,dStairR*sc-3,7,7);}
    // Dungeon exit (back to overworld) — only meaningful on floor 1. Drawn on every minimap update
    // regardless of fog, since the player entered through this cell and it's their emergency out.
    if(currentFloor===1 && typeof dEntranceX!=='undefined'){
      mmC.fillStyle='#66cc66';
      mmC.font='bold 11px sans-serif';
      mmC.textAlign='center';
      mmC.textBaseline='middle';
      mmC.fillText('↑',dEntranceX*sc,dEntranceZ*sc);
    }
    // Floor label
    if(currentFloor===2){mmC.fillStyle='#cc88ff';mmC.font='bold 9px sans-serif';mmC.fillText('B2',2,10);}
  }
  const mx=px*sc,mz=pz*sc;
  mmC.save();
  mmC.translate(mx,mz);
  // ── FIXED ARROW: use -yaw so left turn on screen = left turn on minimap
  mmC.rotate(-yaw);
  mmC.fillStyle='#e8d4a0';mmC.beginPath();mmC.moveTo(0,-6);mmC.lineTo(4,4);mmC.lineTo(-4,4);mmC.closePath();mmC.fill();
  mmC.restore();
}
