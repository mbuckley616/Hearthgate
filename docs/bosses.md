# Bosses

The boss document (Session 202, the deep-work session's boss design pass; Michael's A, 15 Nov, `decisions.md` "Bosses first, before E1i"). It is a proposal until Michael approves it in `decisions.md` ("The boss document: approve it?"). Nothing here is built. Where it changes what exists, it says what the code does today.

Michael's notes it answers (playtest with Nick, 15 Nov): bosses come first and the rest of the game fills in around them; every boss is designed for three; an early boss is beaten by any one hero and crushed by two; a boss's loot helps against that boss; a tanky boss with two kinds of adds, one weak to magic and one to ranged, dropping a shield against blunt damage and a staff that casts faster; attacks colour-coded by type; a floating-hand boss in the spirit of Smash Bros' Master Hand; a tank built on damage reduction; specializing rewarded over switching. And his calls that bound it: self-heals only, a slow regen out of a fight (15 Nov, A), so no boss may assume a healer; bosses and Brutes armoured after a stagger (G1, 2 Nov), so a party cannot hold a boss down by spamming.

## 1. The rules every boss follows

### 1.1 Designed for three

Every boss is drawn for a party of three: a melee hero in front of it, a ranged hero at the edge, a magic hero between. Each phase gives each of the three a **job** (1.6) that its style does best, and a boss's attention moves between them so no one is safe standing still. One and two players meet the same boss with the same jobs; they do them in turn instead of at once, and the numbers in 1.2 make that fair.

Henchmen are party members (they stand in for the trio's missing jobs), but a boss is never tuned around them: every gate below is measured with no henchmen first.

### 1.2 The solo and duo bar for early bosses

"Early" is a boss a run of difficulty Normal or Easy can end on: today the Old Cellar, Mossgate Barrow and the Saltmarsh Warrens (all Normal, `game/portalChoice.ts`).

- **Solo:** one hero at their style's level for that dungeon, no henchmen, a belt of potions, beats it in **3 to 5 minutes** with at least one potion left most tries; a mistake costs health, not the fight.
- **Duo:** two heroes beat it in **under half the solo time** with nobody downed, which is what "crush" means here.
- **Trio:** the boss is at its intended pressure: every job matters and a fight lasts 2 to 3 minutes.

**How party size scales a boss today.** Only health: `createEnemy` multiplies every enemy's `maxHp` by `1 + (players - 1) × run.extraPlayerHealth` (0.6), where *players* is `state.players.length`, henchmen included. Damage, attack rate and telegraph speed do not scale. So against a solo hero's health of 1, a duo's boss has 1.6, a trio's 2.2 and a full party's 2.8. A party's damage grows about linearly, so the time to kill is solo 1.00, duo 0.80, trio 0.73, four 0.70: a duo is barely faster than a solo hero, which misses "crush". And a solo hero with three henchmen fights a boss of 2.8 while bringing four heroes' damage and four bodies to split its attention, which is the bullying Michael saw on 2 Nov.

**What would change** (behind `bosses.partyScaling`, off in the parity test, which keeps the slice's 0.6):

- A boss's health scales by `bosses.extraPlayerHealth` (about **0.35** a player, on the panel), not the 0.6 every other enemy keeps. Time to kill becomes solo 1.00, duo 0.68, trio 0.57. The rest of "crush" comes from the boss's attention halving on each hero and a partner to revive them.
- A henchman counts **half a player** for a boss's health (`bosses.henchmanWeight` 0.5), so a solo hero with three henchmen meets a boss of 1.5 rather than 2.8, and the boss's attack rate goes up a step instead (1.4) so it still threatens.
- **Attention.** A boss picks its next target from the heroes that have hit it in the last few seconds and the one that taunted it (1.5), never the same one more than three attacks running unless only one is standing. With one hero it attacks them all the time, so a solo fight is slower on the boss's side too: its cooldowns are `bosses.soloCooldownScale` (about 1.3) longer when one hero stands, so the solo bar is met without making the trio fight dull.
- Difficulty (G3) still multiplies health and damage on top; a boss is tuned at Normal and the solo bar is a Normal bar.

These are starting numbers: the build cut's first session (3, item B0) makes a bench that measures them and sets them.

### 1.3 Adds weak to one style

A boss's adds come in kinds, and each kind is weak to one style in the triangle's sense (the design doc's Combat triangle): **melee** beats ranged (closes the gap, staggers), **ranged** beats magic (interrupts casts from a distance), **magic** beats melee (ignores armour). An add's weakness is a rule of its kind, said by its look before the fight teaches it:

- **Armoured** (weak to magic): takes `bosses.armourTaken` (about 0.35) of melee and ranged damage; magic ignores it. A plated look, a dull grey rim.
- **Warded or far** (weak to ranged): channels from somewhere melee cannot reach in time, a gallery, the far side of a pit, or blinks away from a hero who closes; any arrow breaks its channel and arrows hit it for 1.5×. Magic reaches it too but its ward turns a spell aside (a deflect spark), so the archer's arrow is the answer.
- **Skirmisher** (weak to melee): quick, low health, keeps away from an archer's line and dodges a slow projectile; a melee hero catching it staggers it in one blow.

Any style can kill any add, slower: a solo hero is never locked out, they just take the wrong add longer. Adds are dressings of today's roles (a Shieldbearer with plate for armoured, a Wraith for warded, a Hound for skirmisher), so they ride the role brains (`sim/roles.ts`) and need only their dressing and a `weakTo` on the kind. Today no enemy takes more or less from one style; `damageEnemy` sees the style through the hit, so the rule is a multiplier there.

### 1.4 A drop that helps against its own boss

Every boss drops, besides today's rares (`bossDrops`, one a player a difficulty step, at most three), **one signature item a player**, chosen from the boss's list of two or three, each answering one of that boss's jobs. A signature item is a real piece of gear in a slot, made of a material, with one boss-shaped property:

- **Resist a damage type** (1.5's types): a shield or armour that takes `resist` (about 20%) off one type.
- **A faster cast or swing**: a weapon whose chain and abilities wind up `castSpeed` (about 15%) faster.
- **A bane**: a weapon that deals 1.25× to one boss's kind and its adds.

So a second clear is easier than the first, and the drops send the party back to the boss they came from. They stack only one deep (two pieces against blunt damage give one resist), so a party farms one piece each, not a wall of resist. Today a drop's power is its material and a perk (`gear.ts`: bleed, chainBolt, dodgeRefund, hunter); `resist`, `castSpeed` and `bane` are new properties on `Mods`, behind `bosses.signatureDrops`, off in the parity test.

### 1.5 Damage types and their colours

Every hit a boss or add deals gets a **damage type**: **blunt** (fists, slams, maces, falling things), **edge** (blades, claws), **pierce** (arrows, bolts, thrown things) and **magic** (spells, curses, states). Blunt and edge are melee, pierce is ranged, magic is magic. Today a `HeroHit` has no type: worn armour (`Mods.armour`) takes its share off everything alike.

**Colour.** Today's telegraphs are coloured by what the attack does (E1a, `telegraphColour`): red a strike, orange heavy or unblockable, yellow a projectile or a charge, violet magic or a state. Michael asked for colour by attack type. The two disagree in three places: a charge is melee but yellow; a slam is melee but orange; an armoured enemy's swing turns orange whatever it is.

**Recommendation (asked as its own question in `decisions.md`, A):** the hue says the type, and orange becomes a **rim** that says "cannot be blocked or parried: dodge or jump".

| Type | Hue | Today |
| --- | --- | --- |
| Melee (blunt, edge) | red | red strike; orange slam; yellow charge |
| Ranged (pierce) | yellow | yellow |
| Magic | violet | violet |
| Unblockable, any type | an orange rim and a slow pulse on the shape | its own orange fill |

The shapes keep meaning what they mean (a cone a swing, a circle a slam or a landing, a line a charge or a shot), and the sound follows the type, as `Sfx` follows the colour today. So a red circle with an orange rim is "a blunt slam, do not block it", which is the one read the shield against blunt damage needs: the player sees which hits their gear answers.

### 1.6 What a tank's kit must answer

"Tank should be centered around damage reduction." Today the tank's tools are the Paladin (Shield Rush's taunt, Consecrate, Bulwark), worn `armour`, the shield's block and parry, and Charge's dash and Whirlwind's 0.4 (`meleeGuard`). None is damage reduction a tank chooses to stand in. The rule every boss keeps so a tank has a job:

- **One string per phase is the tank's.** A boss's close single-target string (the Warden's sweeps, the King's sword) is meant to be **taken**, not dodged: blocked on a shield, or soaked under a reduction. It is red without a rim, blockable, and hits hard enough that a non-tank who stands in it should dodge.
- **Taunt holds attention** (the Paladin's Shield Rush today, widened by its tree) for a few seconds; a boss's attention rule (1.2) honours it before anything else.
- **The tank cannot answer everything.** Unblockable hits (the orange rim) and magic land on a tank like anyone; a tank's reduction is against blunt and edge first. So the tank is busy, not immune.
- **What the kit needs that is missing:** a held guard stance (a shield up, moving slowly) that takes `tank.guardTaken` (about 0.5) of blunt and edge damage taken from the front, and is not broken by a heavy (a heavy pushes it back instead); and the Paladin's tree reshaped toward reduction (Bulwark's pulse, a self-heal now (15 Nov, A), gives the Paladin a short reduction too). These are the builds pass's, cut in 3 as one (design) item, since a tank is a rule of play Michael should see first.

### 1.7 Specializing over switching

"Do you want people to specialize, or do you want people to switch? Give benefits to when people specialize." Today the weapon set is one per outing (C3, `combo.swapInFight` off), a specialization is chosen at 10 and reshapes a style, and combo mastery ranks a payer's combos. A test switch is coming that lets Michael swap mid-fight (backlog, 15 Nov), for testing only.

**Recommendation (asked as its own question, A): jobs, not checks.** Bosses reward specializing by what each phase asks, not by locking anyone out:

- Each phase's three jobs (1.1) are done fastest by the matching style and fastest of all by a hero specialized in it: a specialization's signature mechanic is the tool for its job (the Paladin's taunt for the tank's string, a Ranger's or Scout's interrupt for the warded add, a Sorcerer's or Warlock's armour-piercing for the armoured add). Any hero can do any job, at about half the speed.
- **A boss's signature drops go to the job a hero did** (the drop list is per job, 1.4, and a hero is offered the piece of the job they did most in that fight: the most damage to that add kind, or the most of the tank's string blocked). So a specialist farms gear for their specialty.
- **Staying in one style through a run** is worth a small, visible bonus: `focus`, +3% damage a floor in the same style, up to +9%, lost on a swap; shown in the corner. It answers "give benefits" without forbidding a switch.
- The weapon set stays one per outing (C3), and the test switch stays a dev-build switch.

## 2. The bosses, in the order to build them

Where each one goes. The five story dungeons are all the Crypt today (E1a, 3 Nov, A), each ending on the Warden but the last, which ends on the Hollow King. Proposed: the **Old Cellar** keeps the Warden (the first boss, Michael: "Warden is great as a first boss"); **Mossgate Barrow** gets the hand; **Emberhall** (Hard, haunted) gets the tanky boss; the **Hollow Crown** keeps the King; the **Saltmarsh Warrens** becomes the Goblin Warrens' type once E1i's roster exists and ends on its boss. Random runs end on the Warden until a type's roster has a boss, then on that type's.

### 2.1 The Gravehand (the hand boss; working name)

A floating hand the size of a cart, grey bone wrapped in grave-cloth, iron rings on three fingers, hanging over the Barrow's hall and drifting around it at head height: it is a boss of big readable gestures, in the spirit of a giant floating hand, and our own design. Not taken from the game that inspired it: no white glove, no finger-gun pose, no drill, no walking on its fingers, no partner hand, and none of its names. An early boss: the solo bar of 1.2 applies.

Its weakness is where it touches down: after every slam or grab its palm rests on the floor for a beat (`recoverMs`), and hits on the resting hand do 1.5× and build poise; while it floats only arrows and spells reach it (it hovers 3.5 m up). So melee punishes its landings, ranged and magic chip it in the air: the trio's jobs.

**Phase 1 (100% to 60%): the gestures.**
- **Palm slam** (blunt, red circle, orange rim, 1.1 s): it rises over a hero and drops flat; jump does not clear it, a dodge out does. Rests 1.4 s after. Its main punish window.
- **Backhand sweep** (blunt, red cone along the ground, low, 0.9 s): it lies on its side and sweeps across the floor. A **low** attack (M1): a jump clears it. The tank can block it (no rim) and is pushed back.
- **Flick** (pierce, three yellow lines, 0.7 s): three fingers flick bone shards at one hero, a fan. A dodge sideways or a shield takes them.

**Phase 2 (60% to 30%): the rings come off.** A roar (`roar`), and it twists its three iron rings off; each falls as an add, the **Ringwardens**, one of each weakness (1.3) at trio size (a solo hero gets one, a duo two):
- **Iron Ring** (armoured, weak to magic): a rolling ring of iron that chases slowly, blunt hits on contact.
- **Silver Ring** (warded, weak to ranged): floats at the hall's edge and channels a violet ward on the hand: while it channels, the hand takes half damage. An arrow breaks it.
- **Bone Ring** (skirmisher, weak to melee): small, quick, darts at the archer and the mage.
And the **Grab** (edge, a red ring around one hero, orange rim, 1.0 s): it reaches for the hero who hit it most lately. Caught, they are held 3 s and squeezed (light damage a second); a partner's heavy hit or 40 damage to the hand drops them at once; alone, three on-the-beat dodge presses wriggle free (a solo hero is never just held). The trio's mechanic: free each other.

**Phase 3 (30% to 0): the clench.** It closes into a fist (the punish window shortens, rest 0.9 s). **Knuckle chain** (blunt, three red circles with orange rims rolling along a line, the Warden's phase 3 chain in its own shape) and **Shatter flick** (the flick's three shards split in two where they land, so a dodge must be wide). The rings it has left rise once more if their phase-2 adds are not all down (the party is told by a ring glow).

**Drops** (its signature list, one a player, by job, 1.4 and 1.7):
- **Ringward Buckler** (off-hand, iron): 20% less blunt damage (the slam, the sweep, the knuckles).
- **Knucklebone Bow** (shortbow, bone): 1.25× against the Gravehand and its rings (its bane).
- **Grave-cloth Wraps** (gloves, cloth): a grab lets go after 1.5 s (the hero's own escape).

### 2.2 The Ossuary Mason (the tanky boss with two adds)

Michael's boss: very tanky, two kinds of adds, one weak to magic and one to ranged; drops a shield against blunt damage and a staff that casts faster. A mid boss for Emberhall (Hard, haunted): trio pressure, a solo hero can win with time, it is not held to the solo bar's five minutes.

A hulking skeleton three heads tall, a mason's maul in one hand and a hod of skulls on its back, that builds and rebuilds itself. **Tanky by rule, not by health:** it takes 25% damage while it is **Bound**, and it is Bound while any of its **Wardstones** stand. So the party's damage goes into the adds first, then into the Mason in a window.

**The adds, for the whole fight:**
- **Mortar Guards** (armoured, weak to magic; dressing: a plated Shieldbearer): two at trio size, standing between the party and the Wardstones, bashing (blunt). Melee and arrows do 35% to them; magic ignores the plate. The mage's job.
- **Bone Chanters** (warded, weak to ranged; dressing: a Wraith): two at trio size on the hall's gallery, out of melee reach, each channelling a **Wardstone** back up when one falls (5 s violet circle on the stone). An arrow breaks the channel and does 1.5×; a spell is turned aside by their ward. The archer's job.
- **Wardstones**: three pillars in the hall; anyone breaks them, any style (they are scenery with health). The Mason is Bound while one stands.

**Phase 1 (100% to 60%).** The Mason fights the front hero: **Maul string** (blunt, red cone, two swings and an overhead, blockable: the tank's string, 1.6) and **Hod throw** (blunt, a red circle with an orange rim where a skull-load lands, at the far heroes). The party breaks the stones, the Chanters raise them, and the window is the time between.

**Phase 2 (60% to 30%).** He **mortars the floor**: each slam leaves a ridge of bone (a short wall, the collapsing tile's rule turned up) that splits the hall, so the archer must move to keep a Chanter in line. Two more Guards. **Grout** (magic, violet circles under each hero, the King's circles in his own colour): a hero standing in one at the end is Slowed (Chill's rule) 2 s.

**Phase 3 (30% to 0).** The stones go out for good, the Chanters flee to the gallery's ends, and he is never Bound again but **enrages**: his string gains a fourth swing and his maul's slam leaves a shockwave (low, blunt: jump it). The tank's reduction and the party's punish windows decide it.

**Drops:**
- **Mortarward Shield** (shield, iron): 20% less blunt damage (Michael's: the maul, the hod, the shockwave). The tank's.
- **Chanter's Staff** (staff, bone): its chain and abilities wind up 15% faster (Michael's: a staff that casts faster). The mage's, for the Guards.
- **Gallery Longbow** (shortbow, yew; offered for the trio's third job, Michael may cut it): an arrow that breaks a channel stuns the caster 1 s.

### 2.3 The Warden, under the rules

Today: three phases (E1g), sweeps and slams, raised dead at 60%, a quicker chain of slams at 30%, armour after a stagger (G1), its rares on the fall. Under the rules:
- **Types and colour:** its sweep is edge (red, blockable: the tank's string); its slams blunt with an orange rim; its far slam the same; its chain slams the same. The raised dead are fodder.
- **Adds weak to a style:** phase 2's raised dead become one of each weakness at trio size: a plated warrior (magic), a skeleton archer on the hall's edge (melee: it is the skirmisher's other face, an archer the melee hero closes on), and a priest at the back (ranged).
- **Party scaling** (1.2) and **attention**: this is the fix for "the Warden basically never gets an attack off". With henchmen at half weight its health falls, its attack rate rises, and G1's armour keeps its swings coming.
- **Signature drops:** **Warden's Tower** (shield: 20% less blunt), **Sweepbreaker Greaves** (boots: a jump clears low attacks from 0.2 m less high), **Ward-iron Mace** (1.25× against the Warden).
- The Old Cellar's boss, so it is held to the solo bar.

### 2.4 The Hollow King, under the rules

Today: three phases (G4b): a sword string and a thrown crown, two Barrow Knights and violet circles at 60%, a dim hall, a quicker King and a 240-degree crown sweep at 30%.
- **Types and colour:** the sword string is edge (red: the tank's string); the thrown crown pierce (yellow); the circles magic (violet); the crown sweep edge with an orange rim.
- **Adds:** phase 2's two Barrow Knights stay (elites: shield and charger, weak to a flank); add one **Crownbearer** (warded, weak to ranged; a Wraith dressing) that, while it channels, makes the King's crown return to his hand after a throw so it can be thrown again at once.
- **Signature drops:** **Kingsbane** (sword: 1.25× against the King and his Knights), **Hollow Circlet** (helm: 20% less magic, the circles), **Crown-catcher Buckler** (off-hand: a perfect parry of the thrown crown sends it back).
- The last story dungeon on Hard: trio pressure, no solo bar.

### 2.5 The Goblin Warrens' boss, for E1i

E1i is the Warrens' roster, its boss designed first. **Chief Grubnose and his Pig** (working name): a goblin chieftain riding the war pig of the roster (the charger) into the Warrens' loot-pile hall. Its jobs:
- **Phase 1, mounted:** the Pig's **charges** (melee, blunt; a red line, no rim: the tank can take it on a shield and stops the Pig, a stagger, the punish window) and the Chief's **slings from the saddle** (pierce, yellow) at the far heroes. Arrows to the Pig's legs (it is the skirmisher, weak to melee, so the melee hero's stop is what counts).
- **Phase 2 (60%), unhorsed:** the Pig is down to a stun; the Chief blows his horn: **Slinger nests** on the hall's piles (warded by sacks, weak to ranged) and a **Pot-lid crew** (armoured, weak to magic) rush the mage. The Chief fights on foot with a **looted string** (edge, red: the tank's), and his loot pile at the hall's centre **pays the goblins**: each 10 s it stands, a nest refills. The party may smash it (it is a prop, D4's spray).
- **Phase 3 (30%):** the Pig gets up enraged and the Chief remounts: charges in threes, each turning at a wall, the last with an orange rim.
- **Signature drops:** **Pot-lid Shield** (20% less blunt: the Pig's charges), **Slingshot Bracer** (gloves: arrows 1.25× against goblins, the bane for the type), **Grubnose's Horn** (a consumable slot item: a hero's next three charges against them are taken without a stagger).
- The Saltmarsh Warrens is Normal: the solo bar applies.

Each boss above is its own figure, telegraphs in the colours of 1.5, a sound per type, a unit test of its tells and its weakness, and a bench run (B0) against the bar.

## 3. The build cut

One line a builder session unless marked. Each line's gate is its test; anything the arena would see is behind a switch the parity test turns off (named per line), so `golden.json` never moves. The order is the order to build; nothing in the hand boss's lines waits on the tanky boss's.

**Rules first**
- **B0, the boss bench.** A headless test (`tests/bosses.ts`, beside `tests/snapshot-size.ts`) that puts 1, 2 and 3 scripted heroes (the bot harness's, no henchmen; then one hero with three henchmen) against a named boss on its story floor at Normal and reports time to kill, damage taken, potions used and downs over ten seeds. Gate: it runs on today's Warden and prints the numbers that 1.2's "today" predicts. No switch (a test).
- **B1, party scaling for bosses** (`bosses.partyScaling`): `bosses.extraPlayerHealth` (0.35), henchmen at `bosses.henchmanWeight` (0.5), the solo cooldown scale. Gate: on the bench, the Warden's solo and duo numbers meet 1.2's bar (tune on the panel, record the numbers in the commit).
- **B2, attention** (`bosses.attention`): a boss's target from who hit it lately and who taunted it, never one hero more than three attacks running while another stands. Gate: a unit test, two heroes hitting, the boss alternates; a taunt overrides.
- **B3, damage types on hits** (`bosses.damageTypes`): `HeroHit.type` (blunt, edge, pierce, magic) on every enemy's hit, filled in from its attack; nothing reads it yet but the HUD's damage numbers. Gate: unit tests that each enemy's attack carries its type. Parity-safe on its own (the field is optional and read by nothing in the arena).
- **B4, the colours by type** (only if Michael answers A or B to the colour question): `telegraphColour` by type, the orange rim on unblockable shapes in `TelegraphView`, `Sfx` by type. Gate: each enemy's telegraph seen in the debug room in its new hue (a screenshot per role in the commit), the colourblind check against the background.
- **B5, add weaknesses** (`bosses.addWeakness`): `weakTo` on a kind, the armoured and warded rules (1.3) in `damageEnemy`. Gate: unit tests: an armoured add takes 35% from a sword, full from a staff; a warded add's channel breaks on an arrow and turns a spell aside.
- **B6, signature drops** (`bosses.signatureDrops`): `resist`, `castSpeed` and `bane` on `Mods`, `hurtHero` reading `resist` by `HeroHit.type`, a boss's drop list by job. Gate: unit tests: 20% off a blunt hit with a blunt resist, nothing off an edge one; two pieces give one resist; the job's piece is the one offered.
- **B7, focus** (only if Michael answers A to the specializing question; `bosses.focus`): +3% a floor in one style, up to +9%, shown in the corner, lost on a swap. Gate: a unit test over three floors and a swap.
- **(design) B8, the tank's guard stance and the Paladin's reduction** (1.6): asked first, since it changes how a shield plays.

**The Gravehand** (behind `gravehand.enabled`; the boss is a new `EnemyKind`, which the arena never rolls)
- **H1:** the kind, its figure (a placeholder hand of boxes), hovering, phase 1's palm slam, sweep and flick with their telegraphs and the resting palm's 1.5×; Mossgate Barrow ends on it. Gate: unit tests of each tell's timing, the jump clearing the sweep and not the slam; seen in a browser.
- **H2:** phase 2's three rings (dressings of today's brains with B5's weaknesses) and the grab, with its three ways out. Gate: unit tests: a partner's heavy frees a held hero; a solo hero's three on-beat dodges do; the Silver Ring's ward halves the hand's damage.
- **H3:** phase 3's clench, the knuckle chain and the shatter flick, the rings' second rise; its three signature drops. Gate: one bench fight shows all three phases; the bench's solo and duo numbers meet the bar.
- **(Michael)** a playtest of the Gravehand, solo and with a friend.

**The Ossuary Mason** (behind `mason.enabled`)
- **M1:** the kind, its figure, the Wardstones as props with health and the Bound rule, the maul string and hod throw; Emberhall ends on it. Gate: unit tests: 25% while a stone stands, full once all fall.
- **M2:** the Mortar Guards and Bone Chanters (B5's armoured and warded, dressings of the Shieldbearer and Wraith), the Chanters' rebuild channel. Gate: unit tests of the rebuild and its break by an arrow.
- **M3:** phase 2's bone ridges and grout, phase 3's enrage and shockwave, its drops (the Mortarward Shield and Chanter's Staff; the bow if Michael keeps it). Gate: one bench fight, all three phases, trio under 3 minutes.

**The Warden and the King under the rules** (behind `warden.underRules`, `king.underRules`)
- **W1:** the Warden's types and drops, its phase 2's three adds by weakness. Gate: the bench's Warden solo and duo numbers meet the bar with henchmen at half weight.
- **K1:** the King's types, the Crownbearer, his drops. Gate: unit tests of the crown's return while the Crownbearer channels.

**Then E1i, the Goblin Warrens, its boss first** (the existing (design) line stays; these replace "its boss")
- **(design) E1i's roster** as its line says, then **G1b to G3b**, Grubnose and his Pig in three sessions as the Gravehand's, its drops, and the Saltmarsh Warrens turned to the Warrens' type.

## What stays true

The server decides every boss's attacks, targets, adds and drops; prediction never steps an enemy. `shared/src/sim/` stays deterministic: every random choice is `state.rng`, every timer the tick count. Every new behaviour is behind a switch the parity test turns off, and `golden.json` is not re-recorded by any line above. Keyboard and pad first: the grab's escape is the dodge button, nothing needs a mouse or hover. No Phase 3 content: signature drops live in the browser's save like every item until the ledger.
