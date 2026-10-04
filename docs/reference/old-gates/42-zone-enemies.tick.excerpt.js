function tickZoneEnemies(dt,now,sc){
  try{tickZoneArrows(dt,now);}catch(err){}
  // v59: unlock any latent enemies the player has grown into. Cheap — runs once per tick.
  ZE.forEach(e=>{
    if(e.locked && (e.minLevel||1)<=level){
      e.locked=false;
      if(e.mesh)e.mesh.visible=true;
    }
  });
  ZE.forEach(e=>{
    if(e.dead||e.locked)return;
    if(e._duelHold)return; /* S373 — Rowe holds: talking, or on one knee */
    // v61gj — Defensive lazy init for pre-ship saves (enemies in ZONES[id].enemies
    // that predate v61gj). Idempotent — no-op if already stamped. Then regen tick.
    if(typeof e.posture!=='number') initPosture(e);
    tickPostureRegen(e, dt, now);
    const T=targetOf(e); /* S468 — co-op rule: the foe's target, never px/pz */
    const dist=Math.hypot(T.x-e.x,T.z-e.z);
    // v61c2 — Boss-specific tick block. Runs alongside the standard enemy
    // tick path so the boss inherits chase/AI/HP-bar updates. Adds:
    //   (1) sigil-trace pulse — emissive red on the seams, breathing in/out
    //       at ~1.5 Hz. Independent of telegraph; signals "this is alive."
    //   (2) phase machine — checks current HP fraction against bossDef
    //       phase thresholds, advances e.phaseId on cross. Phase 1→2→3 are
    //       descending thresholds (1.0/0.66/0.33). Session A logs the
    //       transition + adjusts telegraphMult; Session B will wire adds,
    //       AOE roar, and ember trails to the entry hooks.
    if(e.isBoss && e.bossDef){
      // Sigil pulse — animate emissive intensity by scaling color brightness.
      // sigilTrace is a MeshBasicMaterial whose color is shared by 5 strip
      // meshes; mutating .color on the material updates all of them at once.
      e.sigilPulseT = (e.sigilPulseT||0) + dt;
      const baseR = 0.92 + Math.sin(e.sigilPulseT*1.5)*0.30; // 0.62 to 1.22
      // Phase 3 throbs harder — frenzied, almost angry.
      const phaseBoost = (e.phaseId>=3) ? 0.15 : 0;
      if(e.limbs && e.limbs.sigilTrace && e.limbs.sigilTrace.color){
        e.limbs.sigilTrace.color.setRGB(
          Math.min(1.0, (baseR + phaseBoost)),
          Math.max(0.05, 0.10 - phaseBoost*0.5),
          Math.max(0.0, 0.04 - phaseBoost*0.3)
        );
      }
      // Phase machine — check thresholds top-down (descending). The first
      // phase whose threshold the current HP fraction is BELOW becomes the
      // active phase. Crossing into a new phase fires the entry hook ONCE.
      const hpFrac = e.hp / e.maxHp;
      const phases = e.bossDef.phases || [];
      let newPhaseId = 1;
      for(const ph of phases){
        if(hpFrac <= ph.threshold) newPhaseId = ph.id;
      }
      if(newPhaseId !== e.phaseId){
        const oldPhaseId = e.phaseId;
        e.phaseId = newPhaseId;
        // Phase entry hook. Session A: log the transition + brief HUD
        // signal (a stronger sigil pulse for ~0.5s). Session B will fire
        // the actual mechanic — add-spawn for Phase 2, ember-trail for
        // Phase 3, and a knockback roar AOE on each transition.
        if(typeof console!=='undefined' && console.log){
          console.log('[Faolchú] Phase transition:', oldPhaseId, '→', newPhaseId, 'at HP', e.hp+'/'+e.maxHp);
        }
        if(typeof addLog==='function'){
          if(newPhaseId===2) addLog('🐺','The Faolchú\u2019s seams tear wider.');
          else if(newPhaseId===3) addLog('🔥','The Faolchú\u2019s sigils burn white-hot.');
        }
        // v61c3 — Phase transition roar. Plays the full multi-voice scream-
        // roar so the transition lands audibly. Fires for any phase advance
        // (1→2, 2→3, theoretically 1→3 if a single hit blew past 66%); the
        // single sound is appropriate for either since it's "the boss
        // escalating," not phase-specific text.
        if(e.isBoss && e.bossId==='faolchu' && typeof sndFaolchuRoar==='function'){
          sndFaolchuRoar();
        }
        // v61c4 — Phase entry mechanic: spawn a Lesser Faolchú add on
        // entry to phase 2 and again on entry to phase 3. The boss has
        // company. Lessers are tagged isLesserFaolchu and despawn when
        // the boss dies, so the fight always resolves with the boss kill.
        // If the boss skips phase 2 entirely (single huge hit lands at
        // <33% HP), spawn TWO lessers since we missed the phase 2 spawn.
        if(e.isBoss && e.bossId==='faolchu' && typeof spawnLesserFaolchu==='function'){
          if(newPhaseId===2){
            spawnLesserFaolchu(e);
            if(typeof addLog==='function') addLog('🐺','A second wolf-shape splits from its flank.');
          } else if(newPhaseId===3){
            spawnLesserFaolchu(e);
            // Catch-up spawn — if we jumped 1→3 without firing the phase 2
            // hook, spawn the missed lesser too.
            if(oldPhaseId<2) spawnLesserFaolchu(e);
            if(typeof addLog==='function') addLog('🐺','Another tears free of the seams.');
          }
        }
        // Visible feedback: brief flash on the sigil-trace material so the
        // player sees the transition land. Session B will replace this with
        // the proper roar VFX + add-spawn.
        if(e.limbs && e.limbs.sigilTrace && e.limbs.sigilTrace.color){
          e.limbs.sigilTrace.color.setRGB(1.0, 0.85, 0.6);
        }
      }
      // v61c4 — Caor fireball special attack on cooldown. Conditions:
      //   - boss is alert (player is engaged)
      //   - player is in 4-15u range (close enough to aim, far enough
      //     that the attack adds value over melee)
      //   - cooldown elapsed (caorCd <= 0)
      //   - not currently charging or melee-telegraphing
      // Wind-up: 1.0s during which sigils flare bright. Player can see
      // it coming and dodge by sprinting laterally. Fires from the snout
      // at the player's position (locked at telegraph end, so a moving
      // player can sidestep).
      const _bossDist = Math.hypot(T.x-e.x, T.z-e.z);
      if(e.alert && e.caorChargeT>0){
