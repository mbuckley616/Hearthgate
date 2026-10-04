        dScene.add(kObj);dScene.add(kGl);
        dScene.remove(kObj);if(kGl)dScene.remove(kGl); // v80 — no floating key; locked doors are picked
      }
      lockedSeen++;
    }
  });

  const EM={
    // v59: minLevel gates which player levels an enemy can spawn at. Prevents early-game rug-pulls
    // (Mimic, Gargoyle) and "stat-check" enemies the player can't kill without the right tools
    // (Wraith, Golem). Skeleton/Goblin/Slime/Kobold stay level 1 — baseline content for any dungeon.
    Skeleton:    {minLevel:1, col:0xc8c0a8,hp:35,spd:1.35,scale:1.0, buildFn:'humanoid',dmgMult:2.0,ranged:false,eyeCol:0x4488ff,light:0x4466cc, def:2, resist:{solas:1.5, scath:0.7, cloch:1.35, slash:0.7, pierce:0.5, blunt:1.35}},
    Goblin:      {minLevel:1, col:0x6a8a40,hp:28,spd:2.02,scale:0.72,buildFn:'humanoid',dmgMult:2.0,ranged:false,eyeCol:0xff4400,light:0xff4400, def:1, resist:{tine:1.35}},
    'Cave Troll':{minLevel:2, col:0x4a5a38,hp:70,spd:0.68,scale:1.5, buildFn:'brute',   dmgMult:4.4,ranged:false,eyeCol:0xff2200,light:0xff3300, def:4, resist:{tine:1.5, cloch:0.7, blunt:1.2}},
    Golem:       {minLevel:3, col:0x707878,hp:90,spd:0.42,scale:1.7, buildFn:'brute',   dmgMult:5.2,ranged:false,eyeCol:0x22aaff,light:0x2266ff, def:6, resist:{cloch:0.5, uisce:1.4, tine:1.2, slash:0.4, pierce:0.4, blunt:1.35}},
    Phantom:     {minLevel:3, col:0x3030a0,hp:40,spd:1.28,scale:1.0, buildFn:'wraith',  dmgMult:2.4,ranged:true, eyeCol:0xaaaaff,light:0x6666ff, def:0, resist:{solas:1.4, cloch:0.5, scath:0.7, slash:0.3, pierce:0.3, blunt:0.3}},
    // Wraith is the most punishing for pure-melee: 0.25 slash/pierce/blunt resist means a level-1
    // warrior with no magic *cannot* kill it in practice. Gated to 5 so players have time to
    // touch a sigil or acquire a scroll before the wall appears.
    Wraith:      {minLevel:5, col:0x1a1a3a,hp:45,spd:1.20,scale:1.1, buildFn:'wraith',  dmgMult:2.6,ranged:true, eyeCol:0xff22aa,light:0xff22aa, def:0, resist:{solas:1.5, scath:0.5, slash:0.25, pierce:0.25, blunt:0.25}},
    // ── New in Session 2 ──
    // Slime — low-tier elemental trash mob. Splits into 2 Small Slimes on death (once).
    Slime:       {minLevel:1, col:0x32cd32,hp:22,spd:0.65,scale:0.7, buildFn:'slime',   dmgMult:1.6,ranged:false,eyeCol:0xffdd44,light:0x44ff44, def:1, resist:{cloch:1.35, tine:1.5, uisce:0.7, slash:0.3, pierce:0.3, blunt:0.6}, splitsOnDeath:true},
    // Small Slime spawns from Slime split — gate doesn't matter (it's a derived spawn), but keep at 1 for consistency.
    'Small Slime':{minLevel:1, col:0x5fd85f,hp:10,spd:0.75,scale:0.42,buildFn:'slime',   dmgMult:1.2,ranged:false,eyeCol:0xffdd44,light:0x44ff44, def:0, resist:{cloch:1.35, tine:1.5, uisce:0.7, slash:0.3, pierce:0.3, blunt:0.6}},
    // Kobold Thief — fast humanoid that flees at low HP. Reuses humanoid build at small scale with reptilian coloring.
    'Kobold Thief':{minLevel:1, col:0x8a6a3a,hp:20,spd:1.9,scale:0.75,buildFn:'humanoid',dmgMult:1.8,ranged:false,eyeCol:0xcc2200,light:0xaa5522, def:1, resist:{}, canFlee:true},
    // Fire Elemental — ranged enemy that fires fire orbs. Resistant to tine, weak to uisce. Reuses ranged AI.
    'Fire Elemental':{minLevel:3, col:0xff5522,hp:55,spd:1.1,scale:0.9,buildFn:'elemental',dmgMult:3.2,ranged:true,eyeCol:0xffff66,light:0xff7733, def:1, resist:{tine:0.3, uisce:1.75, cloch:1.2, slash:0.2, pierce:0.2, blunt:0.6}},
    // Gargoyle — dormant until player within 4u. Deals no damage and takes 2× damage while dormant. Reuses brute mesh with stone tint.
    // Gated at 4 alongside Mimic — both are "ambush" enemies that betray trust (statues/chests look safe).
    Gargoyle:    {minLevel:4, col:0x6a6a70,hp:85,spd:1.0, scale:1.35,buildFn:'brute',   dmgMult:3.8,ranged:false,eyeCol:0x880000,light:0x444444, def:5, resist:{cloch:0.5, uisce:1.2, slash:0.4, pierce:0.4, blunt:1.3}, dormant:true},
    // Mimic — disguised as a chest until player within 1.5u. First-reveal hit has burst damage. Wooden chest mesh.
    // Gated at 4 so players have opened several real chests and are comfortable with the loot loop
    // before the first fake one appears.
    Mimic:       {minLevel:4, col:0x8b5a2b,hp:60,spd:1.5, scale:0.75,buildFn:'mimic',   dmgMult:3.0,ranged:false,eyeCol:0xff2222,light:0xaa6622, def:3, resist:{tine:0.85, scath:1.3}, disguise:true},
    // ── New in v71 (Session 53) ──
    // Shieldbearer — humanoid that holds a frontal shield (shieldUp:true). The
    // shield is its defense, not innate toughness: neutral physical resists, but
    // FRONTAL melee hits are reduced to SHIELDBEARER_FRONT_BLOCK (0.35×) until the
    // guard is broken. Two clean answers for the player: (1) power-attack the front
    // → the v65 power-vs-shield rule force-breaks the guard (1.5s stagger, then the
    // shield is DOWN — shieldUp flips false on break, so follow-ups land full); or
    // (2) flank/backstab the rear cone, which bypasses the block entirely (v63
    // positional system pays off). A plain frontal bash CANNOT crack it (v71 design
    // call G) — bashing a raised guard is exactly the thing the shield is for.
    // minLevel:2 alongside Cave Troll — a "you now need a tool/position for this"
    // gate, the melee-side analogue to Wraith's magic gate.
    Shieldbearer:{minLevel:2, col:0x5a5550,hp:48,spd:1.15,scale:1.0, buildFn:'humanoid',dmgMult:2.6,ranged:false,eyeCol:0xffcc55,light:0xbb9933, def:3, resist:{}, shieldUp:true},
  };
  _dungeonBuildEnemy=(d,name)=>buildEnemy(d,name); // S253 — killE's slime split builds its Small Slimes outside this function
  function buildEnemy(d,name){
    const g=new THREE.Group();const mat=new THREE.MeshLambertMaterial({color:d.col});const sc=d.scale;const limbs={};
    // S196 — the dungeon's skeletons, goblins and kobold thieves on the people's body, as in the open world (H.4);
    // the rest of the humanoid roster (the Shieldbearer and its shield) keeps the box for now
    // S208 — the Cave Troll (a brute) is a person too
    // S212 — and the dungeon's Wraith and Phantom on the open world's wraith (S176): robed, hooded, see-through, gliding
    if((d.buildFn==='humanoid'||d.buildFn==='brute'||d.buildFn==='wraith')&&name&&FOE_DRESS[name]){const pr=buildFoe(name,Math.random()*999,Math.random()*999,null,d.eyeCol);pr.root.scale.multiplyScalar(sc);g.add(pr.root);
      if(d.buildFn==='wraith'){const au=new THREE.PointLight(d.light,.5,2.8);au.position.set(0,.6*sc,0);g.add(au);}
      limbs.torso=pr.mesh;limbs.armR=pr.B.shR;limbs.person=pr;if(d.shieldUp)limbs.armL=pr.B.shL; // S199 — the shield goes on the left shoulder bone
      const eyeGl=new THREE.PointLight(d.eyeCol,.35,1.4);eyeGl.position.set(0,1.1*sc,.25*sc);g.add(eyeGl);}
    else if(d.buildFn==='humanoid'){
      const legH=0.32*sc;
      [-1,1].forEach((s,i)=>{const pivot=new THREE.Group();pivot.position.set(s*.08*sc,legH,0);const leg=new THREE.Mesh(new THREE.BoxGeometry(.11*sc,legH,.11*sc),mat);leg.position.y=-legH/2;pivot.add(leg);g.add(pivot);limbs[i===0?'legL':'legR']=pivot;});
      const torso=new THREE.Mesh(new THREE.BoxGeometry(.28*sc,.38*sc,.18*sc),mat);torso.position.set(0,legH+.19*sc,0);g.add(torso);
      // v61d1 — Register torso in limbs so enemyBodyMesh() resolves to the
      // actual torso Mesh for telegraph + stagger flash. Pre-v61d1 these
      // effects walked children[0] which is the legL pivot Group (no
      // material property), silently failing across the entire humanoid
      // roster (goblin, kobold, bandit, skeleton). Slime/elemental had this
      // wired correctly via limbs.body; humanoid + brute did not.
      limbs.torso = torso;
      const armH=0.32*sc;
      [-1,1].forEach((s,i)=>{const pivot=new THREE.Group();pivot.position.set(s*.2*sc,legH+.32*sc,0);const arm=new THREE.Mesh(new THREE.BoxGeometry(.09*sc,armH,.09*sc),mat);arm.position.y=-armH/2;pivot.add(arm);g.add(pivot);limbs[i===0?'armL':'armR']=pivot;});
      const hd=new THREE.Mesh(new THREE.BoxGeometry(.22*sc,.22*sc,.2*sc),mat);hd.position.set(0,legH+.57*sc,0);g.add(hd);
      // Glowing eyes — larger + point light
      const ey=new THREE.Mesh(new THREE.BoxGeometry(.16*sc,.05*sc,.025),new THREE.MeshBasicMaterial({color:d.eyeCol}));ey.position.set(0,legH+.58*sc,.11*sc);g.add(ey);
      const eyeGl=new THREE.PointLight(d.eyeCol,0.6,1.8);eyeGl.position.set(0,legH+.58*sc,.18*sc);g.add(eyeGl);
    } else if(d.buildFn==='brute'){
      const legH=0.24*sc;
      [-1,1].forEach((s,i)=>{const pivot=new THREE.Group();pivot.position.set(s*.12*sc,legH,0);const leg=new THREE.Mesh(new THREE.BoxGeometry(.16*sc,legH,.16*sc),mat);leg.position.y=-legH/2;pivot.add(leg);g.add(pivot);limbs[i===0?'legL':'legR']=pivot;});
