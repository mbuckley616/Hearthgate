function enemyArm(e){const L=e&&e.limbs;if(!L)return null;if(!Array.isArray(L))return L.armR||L.tail||L.armL||null;const a=L[0];return a?(a.rotation?a:a[0]):null;}
function attackPose(e,inDungeon){
  const w=e._wind||0;const st=inDungeon?(e.atkAnim>0?e.atkAnim/.35:0):(e._lunge!=null?Math.max(0,e._lunge)/.3:0);const s=Math.sin(st*Math.PI);
  const arm=enemyArm(e);const isTail=e.limbs&&!Array.isArray(e.limbs)&&arm===e.limbs.tail;
  if(arm&&arm.rotation){if(isTail){arm.rotation.x=(e._tailBase!=null?e._tailBase:(e._tailBase=arm.rotation.x))-w*.45+s*1.1;}else{arm.rotation.x=w*1.4-s*1.3;}}
  if(e.mesh&&(!arm||isTail)&&!(e.limbs&&e.limbs.wolf)){const lean=-w*.22+s*.18;if(inDungeon)e.mesh.rotateX(lean);else e.mesh.rotation.x=lean;}
  if(e.mesh&&e.mesh._hover){const t=performance.now()*.003;e.mesh.position.y=(e.baseY||e.mesh.position.y-Math.sin(t-.05)*.08)+Math.sin(t)*.08;e.mesh.children.forEach(c=>{if(c._mote!=null){c.position.x=Math.cos(t+c._mote)*.3*(e.mesh.scale.x||1);c.position.z=Math.sin(t+c._mote)*.3;}});}
}
function buildZoneEnemy(sc,sol,x,z,type,variantKey,zOpts){
  const ZDEF={
    // v59: minLevel gates zone enemies the same way dungeon enemies are gated. Below-gate enemies
    // still spawn their full data structure, but are flagged `locked` — mesh hidden, AI + collision
    // skipped — until the player reaches minLevel. On first tick past the gate, they unlock and appear.
    // This lets a zone built at level 1 still produce Forest Trolls and Bandits once the player grows.
    Wolf:           {minLevel:1, col:0x706058,eyeCol:0xddaa44,hp:18, maxHp:18, spd:1.6,dmg:5, atk:1.4, xpVal:12, scale:.75,shape:'wolf',     def:1, resist:{tine:1.35}},
    Spider:         {minLevel:1, col:0x282030,eyeCol:0xff2200,hp:12, maxHp:12, spd:1.4,dmg:4, atk:1.2, xpVal:8,  scale:.60,shape:'spider',   def:0, resist:{tine:1.5, scath:0.7, pierce:1.2, blunt:1.1}},
    'Forest Troll': {minLevel:2, col:0x3a5030,eyeCol:0xff4400,hp:35, maxHp:35, spd:.7, dmg:9, atk:1.6, xpVal:30, scale:1.2,shape:'brute',    def:3, resist:{tine:1.5, cloch:0.7, blunt:1.2}},
    Bandit:         {minLevel:2, col:0x604828,eyeCol:0xcc8822,hp:25, maxHp:25, spd:1.2,dmg:7, atk:1.3, xpVal:20, scale:1.0,shape:'humanoid', def:2, resist:{}},
    // v80 — regional encounter types for the streamed world.
    'Cave Bear':    {minLevel:4, col:0x4a3a2a,eyeCol:0xffc860,hp:60, maxHp:60, spd:.9, dmg:12,atk:1.8, xpVal:55, scale:1.35,shape:'brute',   def:4, resist:{blunt:0.8, pierce:1.15}},
    'Ash Hound':    {minLevel:4, col:0x5a5048,eyeCol:0xff5020,hp:28, maxHp:28, spd:1.9,dmg:8, atk:1.2, xpVal:26, scale:.8, shape:'wolf',    def:2, resist:{tine:0.6, scath:1.3}},
    'Hollowed':     {minLevel:5, col:0x8a8478,eyeCol:0xa0ffe0,hp:40, maxHp:40, spd:.8, dmg:10,atk:1.5, xpVal:40, scale:1.0,shape:'humanoid',def:3, resist:{tine:0.7, blunt:0.85, pierce:1.2}},
    // v80 S5 — dungeon-familiar faces in the open country, away from settlements.
    'Goblin':       {minLevel:1, col:0x5a7a2a,eyeCol:0xffe040,hp:14, maxHp:14, spd:1.5,dmg:5, atk:1.0, xpVal:12, scale:.72,shape:'humanoid',def:1, resist:{}},
    'Skeleton':     {minLevel:3, col:0xd8d0c0,eyeCol:0x80c0ff,hp:26, maxHp:26, spd:1.0,dmg:8, atk:1.4, xpVal:24, scale:.95,shape:'humanoid',def:2, resist:{pierce:0.5, blunt:1.4}},
    'Ogre':         {minLevel:6, col:0x7a6a4a,eyeCol:0xff9040,hp:90, maxHp:90, spd:.8, dmg:16,atk:2.0, xpVal:80, scale:1.6,shape:'brute',   def:5, resist:{blunt:0.8}},
    'Rogue Mage':   {minLevel:1, col:0x3a2a5a,eyeCol:0xc080ff,hp:45, maxHp:45, spd:1.1,dmg:12,atk:1.6, xpVal:60, scale:1.0,shape:'humanoid',def:2, resist:{scath:0.5}},
    'Shore Wisp':   {minLevel:1, col:0x80d0ff,eyeCol:0xffffff,hp:38, maxHp:38, spd:1.7,dmg:9, atk:1.1, xpVal:50, scale:.6, shape:'spider',  def:1, resist:{pierce:0.4, blunt:0.4, tine:1.5}},
    'Shark':        {minLevel:1, col:0x5a6a74,eyeCol:0x202020,hp:55, maxHp:55, spd:2.4,dmg:14,atk:1.6, xpVal:70, scale:1.2,shape:'shark',   def:3, resist:{blunt:0.8}},
    // v80 combat pass — the wider overworld bestiary
    'Boar':         {minLevel:1, col:0x5a4030,eyeCol:0xe0c080,hp:16, maxHp:16, spd:1.7,dmg:5, atk:1.3, xpVal:10, scale:.7, shape:'wolf',    def:1, resist:{}},
    'Dragon':       {minLevel:8, col:0x5a2a1a,eyeCol:0xff8020,hp:160,maxHp:160,spd:1.3,dmg:22,atk:1.8,xpVal:400,scale:1.8,shape:'wolf',def:6, resist:{fire:0,slash:.7,pierce:.6}},
    'Bandit Archer':{minLevel:2, col:0x4a3a2a,eyeCol:0xd0a050,hp:20, maxHp:20, spd:1.4,dmg:6, atk:1.6, xpVal:24, scale:1.0,shape:'humanoid',def:1, resist:{}},
    'Goblin Slinger':{minLevel:1,col:0x5a6a30,eyeCol:0xffe080,hp:14, maxHp:14, spd:1.5,dmg:4, atk:1.6, xpVal:12, scale:.8, shape:'humanoid',def:0, resist:{}},
    'Highwayman':   {minLevel:2, col:0x3a3028,eyeCol:0xd0a050,hp:22, maxHp:22, spd:1.5,dmg:8, atk:1.2, xpVal:22, scale:1.0,shape:'humanoid',def:1, resist:{}},
    'Deserter':     {minLevel:3, col:0x505058,eyeCol:0xc0c0a0,hp:34, maxHp:34, spd:1.1,dmg:9, atk:1.4, xpVal:28, scale:1.0,shape:'humanoid',def:3, resist:{}},
    'Bandit Captain':{minLevel:5,col:0x6a2a20,eyeCol:0xffc060,hp:62, maxHp:62, spd:1.3,dmg:13,atk:1.3, xpVal:70, scale:1.08,shape:'humanoid',def:4, resist:{}},
    'Kobold':       {minLevel:1, col:0x7a5a30,eyeCol:0xffe080,hp:14, maxHp:14, spd:1.6,dmg:4, atk:1.1, xpVal:9,  scale:.75,shape:'humanoid',def:1, resist:{}},
    'Cultist':      {minLevel:4, col:0x3a2a4a,eyeCol:0xc080ff,hp:30, maxHp:30, spd:1.2,dmg:10,atk:1.4, xpVal:38, scale:1.0,shape:'humanoid',def:2, resist:{scath:0.6}},
    'Ghoul':        {minLevel:3, col:0x6a7a5a,eyeCol:0xe0ff80,hp:30, maxHp:30, spd:1.8,dmg:8, atk:1.1, xpVal:30, scale:.95,shape:'humanoid',def:1, resist:{tine:1.3, pierce:0.8}},
    'Wraith':       {minLevel:6, col:0x8090b0,eyeCol:0xa0e0ff,hp:48, maxHp:48, spd:1.4,dmg:12,atk:1.5, xpVal:75, scale:1.05,shape:'humanoid',def:2, resist:{pierce:0.4, blunt:0.5, scath:1.4}},
    'Dire Wolf':    {minLevel:4, col:0x3a3230,eyeCol:0xffb030,hp:40, maxHp:40, spd:1.9,dmg:10,atk:1.3, xpVal:40, scale:.95,shape:'wolf',    def:2, resist:{tine:1.2}},
    'Snow Wolf':    {minLevel:3, col:0xdcdce0,eyeCol:0x80c0ff,hp:34, maxHp:34, spd:1.9,dmg:9, atk:1.3, xpVal:34, scale:.9, shape:'wolf',    def:2, resist:{cloch:0.6}},
    'Bog Crawler':  {minLevel:3, col:0x2a3a28,eyeCol:0xa0ff60,hp:26, maxHp:26, spd:1.5,dmg:7, atk:1.2, xpVal:24, scale:.8, shape:'spider',  def:1, resist:{tine:1.4}},
    'Sand Scorpion':{minLevel:3, col:0xb89a50,eyeCol:0x202020,hp:30, maxHp:30, spd:1.3,dmg:9, atk:1.4, xpVal:30, scale:.85,shape:'spider',  def:3, resist:{pierce:0.7}},
    'Frost Troll':  {minLevel:6, col:0xd8e0e8,eyeCol:0x60a0ff,hp:95, maxHp:95, spd:.75,dmg:16,atk:1.9, xpVal:95, scale:1.55,shape:'brute',   def:5, resist:{cloch:0.5, tine:1.5}},
    'Marsh Hag':    {minLevel:5, col:0x4a6a3a,eyeCol:0xffff80,hp:44, maxHp:44, spd:1.3,dmg:11,atk:1.5, xpVal:60, scale:1.0,shape:'humanoid',def:2, resist:{scath:0.7, tine:1.2}},
    'Ash Wight':    {minLevel:7, col:0x3a3634,eyeCol:0xff6020,hp:70, maxHp:70, spd:1.2,dmg:15,atk:1.5, xpVal:110,scale:1.1,shape:'humanoid',def:4, resist:{tine:0.4, cloch:1.4}},
    'Pirate':       {minLevel:1, col:0x3a2a2a,eyeCol:0xffd080,hp:32, maxHp:32, spd:1.3,dmg:9, atk:1.3, xpVal:34, scale:1.0,shape:'humanoid',def:2, resist:{}},
  };
  const baseDef=ZDEF[type]||ZDEF.Wolf;
  // Apply variant overlay if one was selected upstream. Zones pass diff='normal' to pickVariant so only Greater can apply.
  const vr=applyVariantToDef(baseDef, type, variantKey);
  const d={...vr.def};
  // v56 rebalance: scale zone enemy HP/dmg with player level, mirroring dungeon spawn path.
  const _hpLvl=enemyHpScale();
  const _dmgLvl=enemyDmgScale();
  if(d.hp){d.hp=Math.max(1,Math.round(d.hp*_hpLvl));}
  if(d.maxHp){d.maxHp=Math.max(1,Math.round(d.maxHp*_hpLvl));}
  if(d.dmg){d.dmg=Math.max(1,Math.round(d.dmg*_dmgLvl));}
  const displayName=vr.displayName;
