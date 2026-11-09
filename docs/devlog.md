# Devlog

Newest entry first. One entry per session: what changed, what was learned, what is next.

## 2026-11-09: Session 167, the sceptre (the builds pass, the rest of the roster)

**What changed**

The last weapon family of the roster. The sceptre is one-handed Magic, so the tome and its Ward go with it. Four casts (`tuning.sceptreCombo`): a bolt (1.1 damage against the staff's 0.9, a little slower), a burst (heavy), a bolt, and a great burst (heavy, 2.4), on the staff's bolt, burst and great burst. Its bursts, the strings' too, reach 1.35 times as wide (`families.sceptreBurstRadiusMult`), in `fireAttack` as the longbow's speed is. String heavies at 1.1 times the damage and the windup. A crowned rod mesh and a bag icon; it drops and sells in every wood. check 541 green, parity identical. Not yet seen in a browser.

**Learned**

With the sceptre each style has four families plus its slice weapon (Melee five), and every family has its character in one number on the panel (poise, bleed, backstab, arrow speed, reach, burst width), applied where the slice's own code already decided that thing. That is what kept seven families to a session each.

**Next**

The two off-hands left of the roster: the focus orb (magic) and the parrying dagger (with daggers). Each needs an ability of its own on 3, so they may want a design call first.

## 2026-11-09: Session 166, throwing knives (the builds pass, the rest of the roster)

**What changed**

The second Ranged family of the rest of the roster. Throwing knives are one-handed and Ranged, so the buckler or the hand crossbow goes with them. Four throws (`tuning.knivesCombo`): three quick throws on the bow's quick shots (290 ms against 410, 0.7 damage, 0.4 poise) and a fan of knives on its fan (three, heavy). A knife falls after 0.45 of an arrow's life (`families.knivesLifeMult`), about 23 m against the bow's 51: close work at a bow's pace and better. Applied in `fireAttack` to whatever the throw spawned, so strings and prediction agree. String heavies at 0.8 times the damage and 0.75 the windup. Three knives in the hand as the mesh, three in the bag icon; they drop and sell in every metal, as a Ranged item. check 540 green, parity identical. Not yet seen in a browser.

**Learned**

A shape's own `kind` beats its material's, so metal knives are Ranged gear and take the buckler, not the shield; the catalogue already allowed it.

**Next**

The sceptre, then the focus orb (a magic off-hand) and the parrying dagger (the daggers' off-hand), one a session.

## 2026-11-09: Session 165, the longbow (the builds pass, the rest of the roster)

**What changed**

The first Ranged family of the rest of the roster. The longbow takes both hands (no buckler, +20%). Three shots (`tuning.longbowCombo`): two long shots on the bow's quick shot (600 ms each against the bow's 410, 1.5 damage against 0.8) and a war shot on its power shot (heavy, piercing, 3.0). Every arrow it looses, its strings' included, flies 1.35 times as fast (`families.longbowArrowSpeedMult`), so in the same 1.5 s life it carries 1.35 times as far, about 69 m for a quick shot. The speed is applied in `fireAttack`, which prediction shares, so a player's own arrow leaves where it will land. String heavies at 1.25 times the damage and 1.2 the windup. A tall stave mesh (it was falling through to the wand's rod) and a bag icon; it drops and sells in every wood. check 539 green, parity identical (the bow multiplies by 1). Not yet seen in a browser.

**Learned**

`buildFamilyWeapon` drew any family it did not know as the wand; each new family needs its branch there or it holds a rod. A test that measures arrows after a chain finds the fast ones already gone into a wall; measure as they leave.

**Next**

Throwing knives, then the sceptre, focus orb and parrying dagger, one a session.

## 2026-11-09: Session 164, daggers (the builds pass, the rest of the roster)

**What changed**

The third family of the rest of the roster, the last Melee one. Daggers are one-handed (a shield now; the parrying dagger, still to come, is their off-hand). Five blows (`tuning.daggersCombo`): four stabs on the sword's two slashes, 280 ms a stab against the sword's 420 ms slash, 0.6 to 0.7 damage and 0.4 poise each, 70° and 1.7 m; then a hamstring slash (heavy, on the sword's low sweep). Any dagger blow, not a bleed's tick or a projectile, on an enemy whose back is to the wielder (a 120° cone behind its facing) lands 1.5 times as hard (`families.daggersBackstabMult`, `daggersBackstabArcDeg`, `fromBehind` in `combat.ts`). String heavies at 0.85 times the damage and 0.8 the windup. A narrow-blade mesh and a bag icon; it drops and sells in every metal. check 538 green, parity identical. Not yet seen in a browser.

**Learned**

The Rogue's Shadowstep already puts a hero behind an enemy, so daggers and the Rogue meet without a rule joining them; whether a dagger's backstab should also stack with From the shadows' crit (it does, multiplied) is for play to judge.

**Next**

Melee has five families. The longbow, then throwing knives, sceptre, focus orb and the parrying dagger, one a session.

## 2026-11-09: Session 163, the axe (the builds pass, the rest of the roster)

**What changed**

The second family of the rest of the roster. The axe is Melee in one hand, so it takes a shield and its bash. Its chain is three blows (`tuning.axeCombo`): a wide chop (170°, on the sword's low sweep), a backhand chop (150°, on its right slash), and a spinning cleave (heavy, 360°, on its spin). Step for step it hits harder than the sword (1.3, 1.4, 2.0 against 1.0, 1.1, 1.8) and breaks less poise (0.8 against 1; the cleave 2.5 against the sweep's 4): the mace staggers, the axe cuts. Its heavies, the cleave and its strings, open the sword's bleed perk's wound without the perk (`gear.bleedTicks`, ticking to the wielder), melee only. String heavies at 1.15 times the damage and 1.05 the windup (`families.axe*`). A bearded-blade mesh and a bag icon; it drops and sells in every metal. check 536 green, parity identical. Not yet seen in a browser.

**Learned**

The bleed was already a sword finisher's state on the enemy (`bleedTicks`, `bleedOwner`), so the axe's identity cost one condition; the family's character lives best in an existing state rather than a new one.

**Next**

Daggers, then longbow, throwing knives, sceptre, focus orb and the parrying dagger, one a session.

## 2026-11-09: Session 162, the mace (the builds pass, Michael's A on the rest of the roster)

**What changed**

The first of the rest of the roster, on the C5 pattern. The mace is a Melee family in one hand, so it takes a shield and its bash on 3. Its chain is four blunt blows (`tuning.maceCombo`): a bash, a backhand and a bash on the sword's two slashes, then an overhead crush on the sword's leaping slam (heavy, 360°). Each blow is a little slower than the sword's and breaks about twice its poise (2.2 to 2.6 against 1; the crush 7 against 5), so a mace staggers where a sword cuts. Its heavies are the sword's strings at 1.2 times the damage and 1.1 times the windup (`families.mace*`), and a corpse it launches flies 1.25 times as far (`launch.maceMult`), the blunt weapons' own launch from K1. It drops and sells in every metal like the warhammer (`bronze-mace` and on), with a flanged-head mesh in `wardrobe.ts` and a bag icon. On the way: the four family chains (warhammer, crossbow, wand, mace) had no panel ranges; they now do, by the same rules as the slice's chains. check 534 green, parity identical (a family counts only when worn). Not yet seen in a browser.

**Learned**

C5's borrowed poses made a family a table and four map entries; the cost is that the mace's bash looks exactly like the sword's slash until it gets poses of its own.

**Next**

The axe, then daggers, longbow, throwing knives, sceptre, focus orb and the parrying dagger, one a session.

## 2026-11-08: Session 161, Detonate as a state; the three states are built (the builds pass, Michael's A)

**What changed**

The third state. Burning (Detonate's setup, the slice's volley-mark window) is now also left by a hero's Fire: their Fire ground (a Fire Spellblade's Blazing Charge strip, a Fire Sorcerer's Elemental Step) and their light Fire bolts and Attunement bursts. The next magic burst to catch a Burning enemy detonates it, the slice's +50% radius and +30% damage with its `combo` event, the Sorcerer's own burst included. A swing, a heavy and a payoff's own hits never light it, so a burst does not set up the next on the enemy it just detonated. `burns` in `combat.ts`, under `combos.elementStates` (off in the parity test). A fix to Session 159 on the way: a ground tick returned from `damageEnemy` before the setups, so Frost ground did not in fact chill (its test checked `chills` alone); the setups now run before a tick returns, and the tests drive `damageEnemy` for both grounds. check 531 green, parity identical. Not yet seen in a browser.

**Learned**

Shatter, Skewer and Detonate all already had their windows, tints (ice-blue, gold, orange in `EnemyView`), sparks and sounds from the slice, so the three states cost no wire or view work: each is one rule for who opens the window. A rule tested only as a predicate can miss the path that never reaches it; drive the real function.

**Next**

Michael's A covered the first three states, all built. What comes next in the builds pass (the remaining states, runes, the rest of the roster, the Necromancer) is asked in `decisions.md` Pending.

## 2026-11-08: Session 160, Skewer as a state (the builds pass, Michael's A on the states)

**What changed**

The second state. Skewer (Staggered, cashed in by the charged shot that runs an enemy through, the slice's payoff and the "thrust" of Michael's A) is now opened by a stagger dealt in a hero's Earth element from any style, as well as by any melee stagger: an Earth Sorcerer's Attunement bolts and Cataclysm, an Earth Spellblade's, Ranger's or Druid's hits. A Fire, Frost or Air stagger from a bow or staff opens nothing, as in the slice. `skewerSets` in `combat.ts`, under the same `combos.elementStates` switch as Session 159 (off in the parity test); parity identical, check 530 green, test:net green. Not yet seen in a browser.

**Learned**

"For a thrust" was read as the slice's own Skewer payoff, a charged shot through the staggered, rather than a new melee thrust: no weapon has a thrust move today, and the daggers and spear that might are in the roster part of the builds pass. If Michael meant a melee lunge (a Charge or Shield Rush cashing it in), `hitWithProjectile`'s `skewer` test is the one to widen.

**Next**

Detonate from Fire's bursts on a Burning enemy, the third state.

## 2026-11-08: Session 159, Shatter as a state (the builds pass, Michael's A on the states)

**What changed**

The first of the three states. Chill (Shatter's setup, the slice's `shatterUntil` window) is now left by any hero's hit that slows or freezes, whatever its style: frost arrows, the Hunter perk's charged shot, a Frost Sorcerer's bolts and Elemental Nova, the frost ring; and by any ground in a hero's Frost element (a Frost Spellblade's Blazing Charge strip, a Frost Sorcerer's Elemental Step). Any style's heavy cashes it in: a sword's or warhammer's heavy, a charged shot, a staff's heavy, each with the slice's +50% and splash and the `combo` event the HUD, sound and sparks already know. A Frost Spellblade's own chain does not chill, so the state still joins two players rather than one. Behind `combos.elementStates`, which the parity test turns off (the slice: a staff's slow, a sword's heavy); parity identical, check 529 green. `chills` and `shatterPays` in `combat.ts` are the two rules, tested in `states.test.ts`. Not yet seen in a browser.

**Learned**

The slice already had Shatter, Skewer and Detonate as cross-style combos with their windows, views and sounds, so the states are a widening of who sets up and who pays off rather than new state on `EnemyState`; nothing new crosses the wire. The ice-blue tint `EnemyView` gives an open Shatter window is the Chilled look. A charged shot on an enemy both Chilled and Staggered pays both Shatter and Skewer in one hit, which seems right for a party but is worth watching.

**Next**

Skewer from Earth's staggers for a thrust (one state a session, Michael's A), then Detonate from Fire's bursts on a Burning enemy.

## 2026-11-08: Session 158, the Sorcerer's tree; every specialization has its tree (the builds pass, Michael's A)

**What changed**

The Sorcerer's six and its Crescendo, numbers on the panel: at staff level 20 Deep Attunement (Fire's burst and Air's arc 1.6x as hard, Earth's bolt poise 1.6x, Frost freezing on the second bolt instead of the third) or Nova Surge (the frost ring, in any element, Frost's too, 1.5x as hard); at 30 Lasting Step (Elemental Step's trail 5 s, Lingering Flame's number) or Wide Step (twice as wide, Wide Wake's); at 40 Searing Step (twice as hot, Searing Path's) or Far Reach (Fire's burst and Air's arc reach 1.5x as far). Cataclysm at 50: as a Flow Crescendo comes out, every standing enemy within 5 m takes a Charge's hit in the Sorcerer's element (Fire 1.5x, Frost freezing 1.2 s, Earth breaking poise as a heavy, Air throwing twice Attunement's push), with an `attune` event of that radius for the views. The Step nodes reuse the Spellblade's trail numbers, as Elemental Step reused Blazing Charge's (Michael's A on the trail). With Sessions 150 to 157, all nine specializations have three rows of two and a Crescendo. check 525 green, parity identical. Not yet seen in a browser: whether `AttuneView` draws a 5 m burst for Frost, Earth and Air as well as Fire is unchecked.

**Learned**

Every Crescendo fires where `stepPlayer` turns a charged heavy at a full meter into a Crescendo, which is true for any style (C2). So a capstone belongs to the style held, not to the specialization's weapon in general, and a Paladin at sword 50 who switches to a bow earns no Judgement; the tests pin that. Nine capstones in one function (`specCrescendo`) also means one place to look if a Crescendo ever does something in prediction it should not: Doom, Stormcaller and Cataclysm touch only enemies, which prediction never steps, and Vanish, Thousand Cuts and the grounds are the hero's own and already predicted for their pieces.

**Next**

The builds pass's next slice is Michael's: decisions.md Pending, "what comes after the trees" (A recommended, the first three states). Until then the builder has nothing left in the current section.

## 2026-11-08: Session 157, the Druid's tree (the builds pass, Michael's A)

**What changed**

The Druid's six and its Crescendo, numbers on the panel: at staff level 20 Rich Bloom (a bolt heals each ally it passes 8% instead of 4%) or Strangling Thorns (Thorn Ring holds 3.5 s instead of 2); at 30 Early Roots (Bloom's root from Flow I instead of II) or Deep Grove (Wild Growth's grove lasts 8 s instead of 4); at 40 Wide Grove (the grove 1.5x as wide) or Lifespring (the Druid's groves heal twice as fast). Heartwood at 50: as a Flow Crescendo comes out, a Wild Growth grove grows where the Druid stands, with Deep Grove's and Wide Grove's if taken. Groves still do not add up: a hero in two is healed by the better one, which is now chosen per grove by its Druid's Lifespring. check green, parity identical. Not yet seen in a browser.

**Learned**

Heartwood replaces the Druid's last grove (one a Druid, as the Blink's), so a Druid who Blinks and then lands a Crescendo moves the grove to where they stand. That keeps the rule simple and the ground readable; if Michael wants both to stand, `wildGrowth`'s one-a-Druid filter is the place.

**Next**

The Sorcerer's tree (Attunement, Elemental Nova, Elemental Step, and its Crescendo), and every specialization has its tree.

## 2026-11-08: Session 156, the Warlock's tree (the builds pass, Michael's A)

**What changed**

The Warlock's six and its Crescendo, numbers on the panel: at staff level 20 Lasting Hex (a staff hit's hex lasts 8 s instead of 4) or Long Curse (Curse Ring's hex 10 s instead of 6); at 30 Deep Hex (everyone's hits on the Warlock's hexed enemies deal 20% more instead of 10%) or Leech (the Warlock's own hits on the hexed drain 20% back instead of 10%); at 40 Binding Swap (Shadow Swap hexes the enemy traded places with) or Far Swap (it reaches 4 m past a Blink instead of 1). Doom at 50: as a Flow Crescendo comes out, every standing enemy within 8 m is hexed, as a staff hit would hex it. Hexing is one function now (`hexOn`), so a bolt, a swap and Doom hex alike with the same cue; a hex's bonus is read from the Warlock who laid it. check green, parity identical. Not yet seen in a browser.

**Learned**

Deep Hex is the party's node and Leech the Warlock's own: with a party of four Deep Hex adds more damage in total than Leech heals, alone Leech keeps a Warlock standing. That reads like the right split for a co-op game; nothing in the tree yet tells the player which is which beyond the line of text.

**Next**

The Druid's tree (Bloom, Thorn Ring, Wild Growth, and its Crescendo), then the Sorcerer's, and every specialization has its tree.

## 2026-11-08: Session 155, the Assassin's tree; Ranged's trees done (the builds pass, Michael's A)

**What changed**

The Assassin's six and its Crescendo, numbers on the panel: at bow level 20 Cold Eye (Deadeye counts a charged shot within 90 degrees of an enemy's facing, its whole back half, instead of 60) or Virulence (venom stacks to eight instead of five); at 30 Thick Smoke (Smoke Bomb hides 4 s instead of 2) or Lingering Venom (a stack keeps it going 8 s instead of 4); at 40 Killing Blow (Deadeye crits 3x instead of 2x) or Toxic Bite (each stack bites twice as hard). Vanish at 50: as a Flow Crescendo comes out, the Assassin drops a Smoke Bomb where they stand (Thick Smoke's time with it). Venom's nodes are read from the Assassin who laid it, as the trap's and the mark's are. All three Ranged specializations have their trees. check green, parity identical. Not yet seen in a browser.

**Learned**

Virulence and Toxic Bite multiply: eight stacks at twice the bite is 3.2 times a full five-stack poison, about 64 damage a second against one enemy before level health, so the venom line is the Assassin's single-target build and Deadeye's the burst one, which is the split the rows were meant to make. `specs.venomDamage` scales both.

**Next**

Magic's trees: the Warlock's (Hex, Curse Ring, Shadow Swap, and its Crescendo), then the Druid's and the Sorcerer's. Then every specialization has its tree and the builds pass's next slice is Michael's to pick.

## 2026-11-08: Session 154, the Scout's tree (the builds pass, Michael's A)

**What changed**

The Scout's six and its Crescendo, numbers on the panel: at bow level 20 Hunter's Mark (marks last 8 s instead of 4) or Forked Lightning (Storm Volley's arc hops on from each enemy it reaches, two hops more, never back to one already struck); at 30 Exposed (party hits on the Scout's marks deal 20% more instead of 10%) or Long Arc (the arc leaps 9 m instead of 5); at 40 Tailwind (Gale Step's second press waits 2.5 s instead of 1.2) or Rising Tempo (hits on the marks fill the Scout's Flow twice as fast). Stormcaller at 50: as a Flow Crescendo comes out, every standing enemy within 10 m is marked, as an arrow would mark it. A mark's nodes are its Scout's, read from whoever laid it, so a teammate's hit on it gets Exposed's bonus. check green, parity identical. Not yet seen in a browser: each hop draws its own `stormChain` event, so the arc's view should show the fork, but nobody has looked.

**Learned**

Rising Tempo and Stormcaller feed each other: a Crescendo that marks a whole room makes every party hit on it fill the Scout's meter toward the next Crescendo. With Rising Tempo at 2x and a party of four that loop could run fast; `specs.markFlowGain` is the brake.

**Next**

The Assassin's tree (Deadeye, Venom Volley, Smoke Bomb, and its Crescendo); then Magic's three.

## 2026-11-08: Session 153, the Ranger's tree (the builds pass, Michael's A)

**What changed**

The Ranger's six and its Crescendo, numbers on the panel: at bow level 20 Deep Roots (Thornshot roots 2.5 s instead of 1.5) or Thicket (Bramble Rain's patch 1.5x as wide); at 30 Overgrowth (the patch lasts 8 s instead of 4) or Iron Jaws (Snare Trap holds 4 s instead of 2); at 40 Twin Snares (two traps wait at once, the newest old one kept) or Grasping Thorns (Thornshot roots every enemy but a boss, where it only slowed the shielded, heavies and elites). Wildwood at 50: as a Flow Crescendo comes out, a bramble patch twice Bramble Rain's width grows at the Ranger's feet (Thicket widens it too). A trap or an arrow already out keeps its Ranger's nodes even if they have since drawn another weapon (`hasStyleNode`, by the style that laid it, where `hasNode` asks the style held). The patch is one function now (`seedBrambles`). check green, parity identical. Not yet seen in a browser.

**Learned**

Grasping Thorns turns the Knight and the Brute into targets that stand still for a charged shot each, which is the strongest of the six against E1h's tier-3 rooms; if it is too much, `specs.treeThornRootS` and the root's 1.5 s are the panel's levers, or the node could root heavies for half.

**Next**

The Scout's tree (Marked, Storm Volley, Gale Step, and its Crescendo), then the Assassin's; then Magic's.

## 2026-11-08: Session 152, the Rogue's tree; Melee's trees done (the builds pass, Michael's A)

**What changed**

The Rogue's six and its Crescendo, numbers on the panel: at sword level 20 Long Shadow (Shadowstep reaches a target 4 m past the Charge instead of 2) or Knife Storm (Fan of Knives throws twelve instead of eight); at 30 Patient Blade (From the shadows waits 6 s instead of 3) or Honed Knives (each knife twice as hard); at 40 Deep Cut (the primed crit is 3x instead of 2x) or Vanishing Step (a Shadowstep primes From the shadows, which the Charge's own hit from behind then spends: a 2x Charge). Thousand Cuts at 50: as a Flow Crescendo comes out, the Rogue throws a Fan of Knives (with Knife Storm and Honed Knives if taken) and is primed. The priming is one function now (`primeShadow`), so a roll, a step and the Crescendo prime alike, with the same cue. All three Melee specializations have their trees. check 501 green, parity identical. Not yet seen in a browser.

**Learned**

A Vanishing Step's priming is spent by the Charge itself: the step primes, then the Charge's hit lands and `damageEnemy` spends it, so the Charge from behind crits 2x. That is a strong pick at 40 against Deep Cut's bigger but rarer crit, and the panel's `specs.shadowCritMult` tunes both.

**Next**

Ranged's trees, the Ranger's first (Thornshot, Bramble Rain, Snare Trap, and its Crescendo), then the Scout's and the Assassin's; then Magic's.

## 2026-11-08: Session 151, the Spellblade's tree (the builds pass, Michael's A)

**What changed**

The Spellblade's six and its Crescendo, on Session 150's frame, numbers on the panel: at sword level 20 Lingering Flame (Blazing Charge's trail lasts 5 s instead of 3) or Third Blade (three spectral blades instead of two); at 30 Wide Wake (the trail twice as wide) or Eye of the Storm (Blade Storm draws light enemies in from 9 m instead of 6); at 40 Searing Path (the trail burns twice as hard) or Keen Edges (each blade hits for 50% of a Whirlwind's hit instead of 30%). Blade Tempest at 50, Michael's own example on the question ("both trail and blades in one burst"): as a Flow Crescendo comes out, a 6 m trail of their element is laid through where they stand along their facing, and every standing enemy within the Whirlwind's reach plus the blades' band takes every blade's hit at once. `bladeCount(p)` is shared by the sim and `SpectralBladesView`, so a third blade is drawn where it hits. The trail nodes touch only a Spellblade's trail: the Sorcerer's Elemental Step keeps its own numbers. check 496 green, parity identical. Not yet seen in a browser.

**Learned**

Searing Path and Wide Wake multiply each other (twice as wide catches more, twice as hot hurts more), but they sit in different rows, so a Spellblade can take both and give up the blades' two; that is the trade the rows were meant to offer, a burning-ground Spellblade or a blade one.

**Next**

The Rogue's tree (Shadowstep, Fan of Knives, From the shadows, and its Crescendo), then the Ranger's.

## 2026-11-08: Session 150, specialization trees and the Paladin's (the builds pass, Michael's A)

**What changed**

Michael's A on the trees (control room, 8 Nov). A specialization's tree is `SpecInfo.tree` (three rows of two `TreeNode`s, opening at sword, bow or staff level 20, 30 and 40, `TREE_LEVELS`) and `SpecInfo.crescendo` (at 50). The picks are `SpecTree` (node ids by style) on `Loadout.tree` and `PlayerState.tree`; `treeProblem` is the one check, used by `readLoadout` (a node of that style's chosen specialization, one a row, its row opened by the style's level) and by the browser's save. They change only where specializations change (`HostSession` keeps the old ones elsewhere, as it does the specialization), and a new specialization drops the old one's picks. The Paladin's six, each strengthening one of its pieces, numbers on the panel (`specs.tree*`): at 20 Long Grudge (Shield Rush's taunt 5 s instead of 3) or Hallowed Ground (Consecrate's ring 1.5x as wide); at 30 Sanctuary (the ring lasts 10 s instead of 6) or Rallying Light (Bulwark's pulse reaches 7 m instead of 4); at 40 Oath of Mercy (the pulse heals twice as much) or Wide Rush (Shield Rush also taunts every enemy within 3 m of the one it hits). Judgement, the Crescendo at sword level 50: as a Flow Crescendo comes out, the Paladin consecrates where they stand and taunts every enemy inside the ring (`specCrescendo`, called in `stepPlayer` where the Crescendo spends the meter, so prediction draws the ring at once). On the Talents tab the tree's rows sit under the specialization, the cursor reaches them, F or A steps through a row's two and Q or X clears it, a shut row says its level, and the Crescendo's line closes the column. check 491 green, parity identical (no hero in the parity test has a tree), test:net green, `tests/spec-tree.e2e.ts` new and green (the rows, A and X, a shut row, a new specialization clearing the picks).

**Learned**

XP is the server's: the browser's profile takes it back from every snapshot (`syncFrom`), so a test that raises a style's level in the page has to save and come back for the hello to carry it; set in place, the next snapshot puts it back and the tree's rows shut again under the cursor. The Crescendo fires as the charged heavy comes out rather than as it lands, so Judgement's ring is laid even when the blow misses; it reads as the Paladin planting their feet, and the taunt still needs enemies in the ring.

**Next**

The Spellblade's tree (Blazing Charge, Blade Storm and the spectral blades, and its Crescendo), then the Rogue's; one a session. Specializations other than the Paladin show no tree rows yet.

## 2026-11-07: Session 149, the HUD names a specialization (the critic's bug)

**What changed**

The ability bar and the hero's title follow a specialization (the critic, 7 Nov). Two helpers in `specs.ts`, `heroTitle(p, style)` and `abilityTitle(p, style, slot)`, read `SPECS`' `name`, `q` and `e`; with no specialization in that style they give the slice's names (`STYLE_TITLES`, `ABILITY_NAMES`). `Hud.ts` uses them for the corner's title, the two slots' names and the level-up toast; `PartyUi.ts` for the party frame's line. A Druid at staff level 26 now reads "Druid · Level 26" over "Thorn Ring" and "Wild Growth" (checked in headless Chromium, `?play&dungeon` with the critic's save); a Knight with no specialization still reads "Knight", "Charge", "Whirlwind". The icons stay the base abilities'. A unit test covers the names; check 481 green, test:net passed. Client and display only: the fight and parity are untouched.

**Learned**

The hero screen lists specializations from `specsFor`, but the HUD and the party frame each kept their own copy of the style titles, so nothing a specialization named reached them. They now share `STYLE_TITLES` beside `SPECS`.

**Next**

Specializations have no icons of their own; if Michael wants them, that is art, not a bug. The builds pass's next slice still waits on his answer in decisions.md.

## 2026-11-07: Session 148, the Sorcerer's Elemental Step; the Sorcerer offered, specializations done (the builds pass)

**What changed**

Elemental Step (`elementalStep` in `specs.ts`, fired with the Blink in `stepAbility`): a Sorcerer's Blink leaves Blazing Charge's strip, its width, seconds and burn, from where they stood to where they landed, in their element. Michael's A on the Spellblade's trail settled this one too (the question named both), so it reuses Session 146's numbers rather than adding its own: it burns 15% of the Charge's damage a second, credited to the staff (`TrailGround.style`), and `TrailView` draws it. The `blink` event carries `trail`, for a low whoosh as it catches. With Sessions 144 and 145 the Sorcerer is whole, and it is offered from staff level 10, Fire, Frost, Earth or Air. All nine specializations are now built and choosable. Check 480 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

Sharing the trail's numbers keeps the panel short, but a Blink's trail is about as long as a Charge's while the Sorcerer's other damage is ranged, so the two may want different burns once played; splitting `specs.blazingTrailDamage` in two is a one-line change if Michael asks.

**Next**

Specializations are done for this pass (trees, runes and states were left for later in Michael's A on the builds pass). The next slice of the builds pass needs Michael's word: what comes after specializations (decisions.md Pending, asked this session).

## 2026-11-07: Session 147, the Spellblade's spectral blades; the Spellblade offered (the builds pass, Michael's A)

**What changed**

Spectral blades (`spectralBlades` and `spectralBladeYaw` in `specs.ts`, stepped each tick of the Whirlwind's spin in `stepAbility`): `specs.spectralBlades` (2) swords circle a spinning Spellblade, evenly spaced, once round over the spin from where they face, in a band from the Whirlwind's reach to `specs.spectralBladeReach` (1 m) past it. Each blade hits every standing enemy its sweep crosses in that band once a spin, for `specs.spectralBladeDamage` (30%) of the Whirlwind's hit, so an enemy at the spin's edge takes 60% from the pair; one inside the reach is the Whirlwind's alone. The hits are kept in `abilityHitIds` (id times eight plus the blade), already on the wire, so no new state. `SpectralBladesView` draws them as ghostly swords in the Spellblade's element, placed by the sim's own `spectralBladeYaw`, fading in and out over the spin's ends. Three numbers on the panel. With Sessions 124, 125 and 146 the Spellblade is whole for this pass, and it is offered from sword level 10, Fire, Frost, Earth or Air: Melee's three are all built. Check 477 green, parity identical. Not yet seen in a browser.

**Learned**

Blade Storm pulls light enemies to 1.4 m, well inside the Whirlwind's 2.4 m reach, so the blades mostly find the heavier enemies Blade Storm leaves standing and light ones still being drawn in through the band. That suits the pair (the pull feeds the spin, the blades reach what it cannot move), but if the blades feel idle against skeleton packs, a smaller `specs.bladeStormRadius` leaves more in the band.

**Next**

The Sorcerer's Elemental Step: the Blink leaves a trail of its element by the same A (Blazing Charge's strip and numbers along the Blink's path), then the Sorcerer is offered and specializations are done for this pass.

## 2026-11-07: Session 146, the Spellblade's Blazing Charge (the builds pass, Michael's A)

**What changed**

Blazing Charge (`blazingTrail` and `stepTrails` in `specs.ts`, laid where the Charge dashes in `stepAbility`, stepped in `stepSim`): a Spellblade's dash leaves a strip `specs.blazingTrailWidth` (1 m) wide along its path, from where the dash began to where it stopped, lasting `specs.blazingTrailSeconds` (3 s) from its last tick; one a Spellblade, a new Charge's replacing their last (`SimState.trails`). Every standing enemy in it takes `specs.blazingTrailDamage` (15%) of the Charge's damage a second, dealt every `specs.blazingTrailTickMs` (500 ms) as damage over time, no flinch or poise, credited to the sword. The element only colours it, as Michael's A says: `TrailView` draws a flickering strip in the element's colour that fades over its last second. Prediction lays its own at once; only the server's burns. Four numbers on the panel. The Spellblade stays "soon" until its spectral blades are in. Check 475 green, parity identical. Not yet seen in a browser.

**Learned**

The Charge's damage is fixed into the trail as it is laid (`tickDamage`), so a talent rank bought mid-trail or a panel edit to the Charge does not change a strip already burning; the panel's trail numbers act on the next Charge.

**Next**

The spectral blades (two swords circling 1 m past the Whirlwind's reach, each hitting an enemy once a spin for 30%), then the Spellblade is offered; then the Sorcerer's Elemental Step, the Blink's trail by the same A, and the Sorcerer is offered.

## 2026-11-06: Session 145, the Sorcerer's Elemental Nova (the builds pass, Michael's A)

**What changed**

Elemental Nova (`novaElement` and `elementalNova` in `specs.ts`, applied to each hit where the frost ring fires in `stepAbility`, both sides): a Sorcerer's frost ring is a ring of their element, doing what Attunement's bolt does and freezing nothing. Fire hits `specs.novaFireDamage` (1.5) times as hard; Earth's poise is multiplied by `specs.attuneEarthPoise`, a stagger the sooner; Air throws what it reaches `specs.attuneAirKnockback` outward. A Frost Sorcerer's ring is the frost ring, freezing as ever. The `frostRing` event carries `element`, so the ring draws in the element's colour with sparks of it and sounds its own (a roaring whump, a deep thud, a rushing gust). One new number on the panel. With Session 144 the Sorcerer has two of its three pieces; it stays "soon" while its Elemental Step waits. Check 471 green, parity identical. Not yet seen in a browser.

**Learned**

The ring's poise of 1 times 2.5 still leaves a Skeleton Warrior (6 poise) standing, so an Earth Nova softens a pack for the next hit rather than staggering it outright; if Michael wants the ring itself to stagger, the panel's `specs.attuneEarthPoise` at 6 does it, for the bolts too.

**Next**

The Sorcerer's Elemental Step and the Spellblade's Blazing Charge trail and spectral blades wait on "The Spellblade's trail and blades" (decisions.md Pending, A recommended); once answered, both are a session each and then offered. Nothing else in the current section is ready for the builder.

## 2026-11-06: Session 144, the Sorcerer's Attunement (the builds pass, Michael's A)

**What changed**

Magic's third specialization, as data and its signature, not yet offered (`built: false`). The Sorcerer (`SPECS` in `specs.ts`): Fire, Frost, Earth or Air, Elemental Nova for the frost ring, Elemental Step for the Blink, from the combat builds page. Its signature, Attunement (`attuneHit` and `attuneAfter`, read where a projectile lands in `hitWithProjectile`, whose hit is now built as a `HitSpec` first so the element can reshape it): a Sorcerer's staff bolt takes their element. Fire bursts, every other standing enemy within `specs.attuneFireRadius` (2 m) taking `specs.attuneFireDamage` (35%) of the bolt; Frost slows `specs.attuneChillS` (2.5 s) and counts on the enemy (`EnemyState.attuneChill`), and the `specs.attuneFreezeHits`th (third) bolt on a still-Chilled enemy freezes it `specs.attuneFreezeS` (1.2 s), a Shatter setup either way; Earth multiplies the bolt's poise by `specs.attuneEarthPoise` (2.5), so a few bolts stagger; Air pushes at least `specs.attuneAirKnockback` (1.2 m) and arcs on to the nearest enemy within `specs.attuneAirRange` (5 m) for `specs.attuneAirDamage` (40%). An `attune` event draws each in the element's colour (Fire's ring, Air's arc) with a sound of its own. All nine numbers on the panel. The Sorcerer stays "soon" while its Elemental Step waits on the Spellblade's trail question. Check 468 green, parity identical. Not yet seen in a browser.

**Learned**

The Sorcerer was not wholly blocked: only its Blink trail is the open question, so its signature and its Nova can go in ahead of the answer, as the Spellblade's Blade Storm did. Attunement touches only the bolts, not the finisher's burst; the builds page says "orbs", and the burst is worth a look once the states pass gives each element a state.

**Next**

Elemental Nova (the Sorcerer's frost ring becomes a ring of their element, doing what Attunement's bolt does), then the Sorcerer and the Spellblade wait only on "The Spellblade's trail and blades" (decisions.md Pending, A recommended).

## 2026-11-06: Session 143, the Druid's Wild Growth; the Druid offered (the builds pass, Michael's A)

**What changed**

Wild Growth (`wildGrowth` and `stepGroves` in `specs.ts`, fired where the Blink goes in `stepAbility`): where a Druid stood as they Blink, a grove `specs.groveRadius` (2.5 m) across grows for `specs.groveSeconds` (4 s), one a Druid, a new one replacing their last (`SimState.groves`). Every standing ally inside, a friend, a henchman or the Druid, heals `specs.groveHealPerS` (3%) of their health a second, never past full; overlapping groves heal once, and a downed hero is not raised. The heal is stepped in `stepSim`, so prediction draws the grove at once but never heals. The Blink still goes and the next bolt still crits; the `blink` event carries `grove`, so leaves spring up where the Druid stood with a soft rustle, and the grove draws as Consecrate's ring in the Druid's element. All three numbers on the panel; at 0 seconds the Blink grows nothing. With Sessions 141 and 142 the Druid is whole for this pass, and it is offered from staff level 10, Nature or Earth. Check 462 green, parity identical. Not yet seen in a browser.

**Learned**

Four heroes' worth of rings, patches, traps and groves now each have their own `ConsecrateView` pool of four; if a fifth ground effect comes, one pooled view with a kind per ring would be tidier than a fifth copy.

**Next**

Magic has two of three; the Sorcerer and the Spellblade both wait on "The Spellblade's trail and blades" (decisions.md Pending, A recommended), since the Sorcerer's Elemental Step trail is the same question. With that unanswered, nothing else in the builds pass is ready.

## 2026-11-06: Session 142, the Druid's Thorn Ring (the builds pass, Michael's A)

**What changed**

Thorn Ring (`isThornRing` and `thornRing` in `specs.ts`, read where the frost ring fires in `stepAbility`, beside Session 139's Curse Ring): a Druid's frost ring is thorns. It still hits for its damage; every light enemy it reaches is rooted for `specs.thornRingRootS` (2 s) and a heavier one slowed as long, and nothing is frozen, so it sets up no Shatter. The `frostRing` event carries `thorns`, so the ring draws green and bark-brown with leaves and sounds a woody crack. On the panel; at 0 the Druid's ring is the frost ring again. Check 458 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

Both reshaped rings trade the freeze for their own state, so a party with a Warlock or a Druid loses the staff's Shatter setup; worth asking about once the states pass comes.

**Next**

Wild Growth (the Blink leaves a healing grove for 4 s), then the Druid is offered. The Sorcerer and the Spellblade once the trail is answered.

## 2026-11-06: Session 141, the Druid's Bloom (the builds pass, Michael's A)

**What changed**

Magic's second specialization, as data and its signature, not yet offered (`built: false`). The Druid (`SPECS` in `specs.ts`): Nature or Earth, Thorn Ring for the frost ring, Wild Growth for the Blink, from the combat builds page. Its signature, Bloom (`isBloomBolt`, `bloomHeal` and `bloomRoot`, read in `stepProjectiles` and `hitWithProjectile`): a Druid's staff bolt heals every standing ally it flies through (a friend or a henchman, never the Druid) `specs.bloomHeal` (4%) of their own health, once a bolt (`ProjectileState.healedIds`), and flies on to its enemy; while the Druid is at Flow tier `specs.bloomRootTier` (II) or above, a bolt that lands roots a light enemy for `specs.bloomRootS` (1 s), as a Thornshot does. A heal raises leaf-green motes and a soft chime for the Druid and whoever it healed. All three numbers on the panel. Check 456 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

The friend-shaped hit test hostile arrows use (`segmentHitsCapsule`) serves a friendly bolt as well; checking allies before enemies means a bolt that stops on its enemy still heals the friend in front of it on that tick.

**Next**

Thorn Ring (the frost ring roots) and Wild Growth (the Blink leaves a healing grove for 4 s), then the Druid is offered. The Sorcerer and the Spellblade once the trail is answered.

## 2026-11-06: Session 140, the Warlock's Shadow Swap; the Warlock offered (the builds pass, Michael's A)

**What changed**

Shadow Swap (`shadowSwap` in `specs.ts`, tried first where the Blink fires in `stepAbility`): a Warlock who Blinks with an enemy targeted (the soft target or the lock, as the Blink starts), no further than the Blink's own reach plus `specs.swapReach` (1 m) and on the same level, trades places with it; the enemy is turned about, the Warlock faces it, and the next bolt still crits as after any Blink. A boss is too heavy to move, and with no target, or one too far, the Blink goes as ever. Both sides step it, so prediction swaps at once. The `blink` event carries `swap`, so the shimmer at both ends gets a hollow thud. On the panel; below 0 the Warlock never swaps. With Sessions 138 and 139 the Warlock is whole for this pass, and it is offered from staff level 10, Shadow alone. Check 453 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

The staff's Blink unlocks with the staff's level, so a test hero needs staff XP before its second ability does anything; the press is simply dropped otherwise.

**Next**

The Druid (Nature or Earth): Bloom (orbs heal allies they pass and root at Flow II and up), Thorn Ring and Wild Growth. The Sorcerer and the Spellblade once the trail is answered.

## 2026-11-06: Session 139, the Warlock's Curse Ring (the builds pass, Michael's A)

**What changed**

Curse Ring (`isCurseRing` and `curseRing` in `specs.ts`, read where the frost ring fires in `stepAbility`): a Warlock's frost ring is the same ring in shadow. It still hits for its damage, and every enemy it reaches is hexed for `specs.curseRingHexS` (6 s, against an orb's 4), past a Shieldbearer's front too; it freezes nothing, since it is shadow and not frost, so it sets up no Shatter. An orb landing later never cuts a ring's longer hex short. The `frostRing` event carries `curse`, so the ring draws violet with dark motes and sounds a deep groan in place of the frost's crack. On the panel; at 0 the Warlock's ring is the frost ring again. Check 450 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

Every staff hit already hexed through `damageEnemy`, so the ring hexed before this session; what made it the Curse Ring was trading the freeze for a longer hex. Losing the freeze means a Warlock's ring no longer sets up a friend's Shatter, a trade worth watching in play.

**Next**

Shadow Swap (the Blink swaps places with the targeted enemy), then the Warlock is offered. Then the Druid; the Sorcerer and the Spellblade once the trail is answered.

## 2026-11-06: Session 138, the Warlock's Hex (the builds pass, Michael's A)

**What changed**

Magic's first specialization, as data and its signature, not yet offered (`built: false`, so the staff's Talents row shows it as soon). The Warlock (`SPECS` in `specs.ts`): Shadow, Curse Ring for the frost ring, Shadow Swap for the Blink, from the combat builds page. Its signature, Hex (`hexedMult` and `warlockHex`, read in `damageEnemy`): every staff hit a Warlock lands hexes its enemy (`EnemyState.hex`) for `specs.hexSeconds` (4 s), after the hit's own damage; everyone's hits on a hexed enemy, a friend's sword or a henchman's included, deal `specs.hexDamageBonus` (10%) more, and the Warlock's own staff hits on it heal them `specs.hexDrain` (10%) of the damage, never past full health. A tick of damage over time neither gains nor drains. A fresh hex puts a violet wisp over the enemy and, for the Warlock alone, a low murmur. All three numbers on the panel. Check 447 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

The Sorcerer's Elemental Step ("Blink leaves a trail of your element") is the same open question as the Spellblade's Blazing Charge trail, so Magic starts with the Warlock, whose three pieces need no answer; whatever Michael picks for the Spellblade's trail will do for the Sorcerer's too.

**Next**

Curse Ring (the frost ring hexes everything inside) and Shadow Swap (the Blink swaps places with the targeted enemy), then the Warlock is offered. Then the Druid; the Sorcerer and the Spellblade once the trail is answered.

## 2026-11-06: Session 137, the Assassin's Venom Volley; the Assassin offered (the builds pass, Michael's A)

**What changed**

Venom Volley (`venomVolley` and `stepVenom` in `specs.ts`): each Volley arrow an Assassin lands adds a stack of poison to its enemy (`EnemyState.venom`), up to `specs.venomMaxStacks` (5), and keeps it going `specs.venomSeconds` (4 s) from the newest arrow; every `specs.venomTickMs` (500 ms) it deals `specs.venomDamage` (2) a stack as damage over time (no hitstop, flinch or poise, as a bleed's), its XP to the bow. A fresh stack keeps the poison's beat, so it never brings a tick early. Five stacks are 20 a second, about a Volley arrow's worth every half second. A `venom` event plays a few green drops (more as it builds) and, for the Assassin alone, a short wet hiss. All four numbers on the panel. The Assassin is now offered from bow level 10, Shadow or Nature, so Ranged's three are whole. Check 444 green, parity identical, test:net passed. Not yet seen in a browser.

**Learned**

The bleed counts its ticks down from a timer; the poison keeps a sim time for its next tick instead, so stacking and refreshing are one assignment and a hitstop only delays a tick, never loses it.

**Next**

The Spellblade's trail and blades once answered (decisions.md Pending, A recommended); then Magic's three, the Sorcerer, Warlock and Druid, one a session.

## 2026-11-06: Session 136, the Assassin's Smoke Bomb (the builds pass, Michael's A)

**What changed**

Smoke Bomb (`smokeBomb` and `isHidden` in `specs.ts`, fired with the Disengage): as an Assassin's Disengage fires, a dark cloud bursts where they stood and they vanish for `specs.smokeSeconds` (2 s, on the panel; `PlayerState.hiddenUntil`): `nearestTarget` passes them by, so every enemy turns to whoever else stands, and stops if no one does. A strike already swinging and the Assassin's own hits still land. A soft pop and a long hiss play for it. Assassin still not offered. Check 439 green, test:net passed. Not yet seen in a browser.

**Learned**

Taking the hero out of `nearestTarget` is all a vanish needs: tokens, chases and archers' aim all start from it, so nothing else in the brains changed.

**Next**

Venom Volley (the Volley leaves stacking poison), which wants a poison of its own beside the bleed; then the Assassin is offered and Ranged is whole. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 135, the Assassin's Deadeye (the builds pass, Michael's A)

**What changed**

The Assassin as data, not yet offered (`built: false`): Shadow or Nature, Venom Volley for the Volley, Smoke Bomb for the Disengage, from the combat builds page. Its signature, Deadeye (`deadeye` in `specs.ts`, read in `hitWithProjectile`): an Assassin's charged shot, which already pierces, that strikes an enemy in the back (flying within `specs.deadeyeBackDeg`, 60 degrees, of the way it faces) deals `specs.deadeyeCritMult` (2x) and shows as a crit; from the front, or a quick shot, it is a plain hit. Both on the panel. Check 437 green. Not yet seen in a browser.

**Learned**

The page says "backs and heads"; Hearthgate's enemies have no head zone yet, so only the back counts. Heads would want a hit height per kind, worth asking for once a player has felt the backs.

**Next**

Venom Volley (stacking poison) and Smoke Bomb (the Disengage drops smoke and the Assassin vanishes 2 s), then the Assassin is offered and Ranged is whole. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 134, the Scout's Gale Step; the Scout offered (the builds pass, Michael's A)

**What changed**

Gale Step (`galeStep` and `galeReady` in `specs.ts`, read in `stepPlayer`): as a Scout's Disengage fires, a second press of the same key stays open until the backflip ends and `specs.galeWindowS` (1.2 s) after (`PlayerState.galeUntil`); pressed then, it is a full roll (`startDodge` with `free`), its i-frames and distance a roll's even with no direction held, and spends no dodge charge. A rising gust plays for it. Stepped in `stepPlayer`, so prediction rolls at once. With Sessions 132 and 133 the Scout is whole for this pass and offered on the Talents tab from bow level 10, Air alone, beside the Ranger. Check 435 green, test:net passed. Not yet seen in a browser.

**Learned**

Ability presses are edges on the command, so a held key cannot roll the second step by itself; the window opens only as the Disengage fires, so a press during its windup never counts.

**Next**

The Assassin (Shadow or Nature): Deadeye (a fully charged shot pierces and crits from behind), Venom Volley (the Volley leaves stacking poison), Smoke Bomb (the Disengage drops smoke and the Assassin vanishes 2 s). The Spellblade's trail and blades once answered.

## 2026-11-06: Session 133, the Scout's Storm Volley (the builds pass, Michael's A)

**What changed**

Storm Volley (`stormChain` in `specs.ts`, called as a Volley arrow lands in `hitWithProjectile`): each Volley arrow a Scout lands arcs lightning on to the nearest other enemy within `specs.stormChainRange` (5 m) that arrow has not already hit, for `specs.stormChainDamage` (half) of its damage, at once, as a bow hit (XP, Marked's bonus and the shield check as any hit). A `stormChain` event draws a pale crackle of sparks along the jump and plays a short electric snap. Both numbers on the panel. Scout still not offered. Check 432 green. Not yet seen in a browser.

**Learned**

The staff's chain-bolt perk sends a second, homing projectile; the page's "chain lightning" reads better instant, so the arc is a hit at once with a drawn line, and nothing new flies.

**Next**

Gale Step (Disengage twice in a row, the second a full dodge), then the Scout is offered; then the Assassin. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 132, the Scout's Marked (the builds pass, Michael's A)

**What changed**

The Scout as data, not yet offered (`built: false`): Air, Storm Volley for the Volley, Gale Step for the Disengage, from the combat builds page. Its signature, Marked (`scoutMark` and `markedMult` in `specs.ts`): every arrow a Scout lands marks its enemy (`EnemyState.scoutMark`) for `specs.markSeconds` (4 s), after the arrow's own damage; any party hit on a marked enemy, the Scout's own and a henchman's included, deals `specs.markDamageBonus` (10%) more and gives the Scout `specs.markFlowGain` (3) Flow. A bleed's tick neither gains nor pays. A fresh mark plays a high ping for the Scout alone. All three numbers on the panel. Check 430 green, test:net passed. Not yet seen in a browser.

**Learned**

The Detonate setup already "marks" with the Volley (`detonateUntil`); the Scout's mark is kept apart, its own field, so a Scout's quick shots do not start setting up Detonate and the combo stays a Volley's.

**Next**

Storm Volley (Volley arrows chain lightning to one more enemy) and Gale Step (Disengage twice in a row, the second a full dodge), then the Scout is offered; then the Assassin. A mark's own look over the enemy is polish. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 131, the Ranger's Snare Trap; the Ranger offered (the builds pass, Michael's A)

**What changed**

Snare Trap (`snareTrap` in `specs.ts`, fired with the Disengage before the backflip moves the hero): where a Ranger stood as they leapt away, a trap `specs.snareRadius` (1 m) across waits `specs.snareSeconds` (12 s), one a Ranger. The first enemy to step in springs it (`stepSnares`, before the enemy step): a light one is rooted for `specs.snareRootS` (2 s), a heavier one slowed as long, with the `rooted` creak, and the trap is spent. Traps are `SimState.snares`, absent in the slice, drawn by a third ring view in the Ranger's element. With Sessions 129 and 130 the Ranger is whole for this pass, so it is offered on the Talents tab from bow level 10 (`built: true`), Nature or Earth; the server takes it and refuses any other element. Check 427 green, test:net passed. Not yet seen in a browser.

**Learned**

Thornshot, Bramble Rain and the trap all land as one effect, a root that stops the walk but not the swing, so the Ranger's whole kit is one new enemy field (`rootUntil`) and three ways to set it; the later trees (Pinned prey, Overgrowth) can read the same field.

**Next**

The Scout (Air): Marked (shots mark; party hits on a marked enemy deal more and fill the Scout's Flow), Storm Volley (Volley arrows chain lightning to one more enemy), Gale Step (Disengage twice in a row). Then the Assassin. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 130, the Ranger's Bramble Rain (the builds pass, Michael's A)

**What changed**

Bramble Rain (`brambleRain` in `specs.ts`, fired with the Volley in `abilities.ts`): as a Ranger's Volley looses, a patch of brambles takes root `specs.brambleRange` (6 m) ahead, short of a wall, `specs.brambleRadius` (2.5 m) across, for `specs.brambleSeconds` (4 s); one a Ranger, a new Volley moving it. Each tick (`stepBrambles`, before the enemy step) a light enemy standing in it is rooted and a heavier one slowed, letting go a tenth of a second after it steps out. The patches are `SimState.brambles`, absent in the slice; prediction seeds its own at once and the snapshot's copy replaces it. Drawn by a second `ConsecrateView`, tinted by the Ranger's element (Nature green, Earth brown). All three numbers on the panel. Ranger still not offered. Check 423 green, test:net passed. Not yet seen in a browser.

**Learned**

The page says the Volley "seeds brambles", not where; a patch ahead of the Ranger, where the Volley's spread is widest, reads as the arrows planting it and needs no per-arrow ground hit.

**Next**

Snare Trap (the Disengage leaves a trap where the Ranger stood), then the Ranger is offered; then the Scout and the Assassin. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 129, the Ranger's Thornshot (the builds pass, Michael's A)

**What changed**

Ranged's first specialization, as data and its signature, not yet offered (`built: false`, so the bow's Talents row shows the Ranger as soon). The Ranger (`SPECS` in `specs.ts`): Nature or Earth, Bramble Rain for the Volley, Snare Trap for the Disengage, from the combat builds page. Thornshot (`thornshot`, called as an arrow lands in `hitWithProjectile`): a Ranger's charged shot roots a light enemy (the roles Blade Storm draws) for `specs.thornRootS` (1.5 s) and slows a heavier one (`slowTime`) for `specs.thornSlowS` (1.5 s), both on the panel. A root is `EnemyState.rootUntil`, the server's alone: `stepEnemies` stops the walk, so the enemy still turns and strikes, and knockback still moves it. A `rooted` event plays a woody creak. The Spellblade still waits on `decisions.md`, so this went ahead to Ranged as the Next lines said. Check 419 green. Not yet seen in a browser.

**Learned**

A root that stops only the walk is a lighter thing than the frost ring's freeze (no thinking at all), which is what the page's "control" role wants: a rooted archer still shoots, a rooted Skeleton still swings at whoever stands close.

**Next**

Bramble Rain (the Volley's arrows seed brambles that root) and Snare Trap (the Disengage leaves a trap), then the Ranger is offered; then the Scout and the Assassin. The Spellblade's trail and blades once answered.

## 2026-11-06: Session 128, the Rogue's From the shadows; the Rogue offered (the builds pass, Michael's A)

**What changed**

The Rogue's signature, and with it the Rogue is offered on the Talents tab from sword level 10 (`built: true`), with its two elements, Shadow or Nature, which colour the sword's trail. From the shadows (`shadowPass` and `shadowStrike` in `specs.ts`): each tick of a Rogue's roll that overlaps a standing enemy's body primes them (`PlayerState.shadowUntil`, `specs.shadowWindowS` 3 s); their next hit on anything, not a bleed's tick, spends it to deal `specs.shadowCritMult` (2x), shows as a crit and counts as from behind, so a Shieldbearer's or Knight's front shield does not take it. A `shadowPrimed` event plays a soft hush for the Rogue alone. Both numbers on the panel. Check 416 green, test:net passed. Not yet seen in a browser.

**Learned**

"A crit from behind" is two things on our side: the damage and the shield check. Taking it as both makes the Rogue the Shieldbearer's answer from the front, which fits the roles page (a flank or backstab beats a shield) without a turn of the body.

**Next**

The Spellblade's Blazing Charge trail and spectral blades, once Michael answers in `decisions.md`; then Melee is whole and the next style's three (Ranged: Ranger, Scout, Assassin) follow. A knife's own look for Fan of Knives is polish.

## 2026-11-06: Session 127, the Rogue's Fan of Knives (the builds pass, Michael's A)

**What changed**

Fan of Knives (`fanOfKnives` in `specs.ts`, fired with the Whirlwind in `abilities.ts`): as a Rogue's spin starts it throws `specs.fanKnives` (8) knives evenly round, each `specs.fanKnifeDamage` (1.5) of a spin tick's hit, as single-pierce arrows that fly the bow's speed and range; the spin itself is unchanged. Both numbers on the panel. Fired with the ability, so the browser throws its own at once as it does a Volley's. The knives are drawn as arrows for now. Rogue still not offered. Check 413 green, test:net passed. Not yet seen in a browser.

**Learned**

The page says only "throws knives in a circle", so whether they replace the spin was a choice: kept the spin, since a Rogue who loses the Whirlwind's close damage would hit less up close than a plain sword. The panel's `fanKnives` at 0 makes it the spin alone if play says otherwise.

**Next**

From the shadows (dodging through an enemy makes the next hit a crit from behind), then the Rogue is offered; a knife's own look after that. The Spellblade's trail and blades wait on `decisions.md`.

## 2026-11-06: Session 126, the Rogue's Shadowstep (the builds pass, Michael's A)

**What changed**

The Rogue's first piece, not yet offered (`built: false`). Shadowstep (`shadowstep` in `specs.ts`, on the Charge's first active tick in `stepAbility`): a Rogue whose Charge has a target within the Charge's length plus `specs.shadowstepReach` (2 m, on the panel) steps to its far side, opposite where it faces and short of any wall (a sphere cast from the enemy), turns to it, and the Charge lands there as its usual hit, now from behind, so a Shieldbearer's front arc no longer takes it. Nothing in reach, and it is the plain dash. A `shadowstep` event carries where it left and where it stands; the browser plays a short falling whoosh for it. Check 411 green, test:net passed. Not yet seen in a browser.

**Learned**

The Charge already chooses its target at the start (`attackTarget`, the soft target or the lock), so the step needs no new aim; prediction steps it against the last snapshot's enemy, and a target that turned since is corrected with the next snapshot, as a Charge that met a moved enemy already was.

**Next**

Fan of Knives (the Rogue's Whirlwind throws knives in a circle) and From the shadows (dodging through an enemy makes the next hit a crit from behind), then the Rogue is offered. The Spellblade's trail and blades wait on `decisions.md`.

## 2026-11-06: Session 125, the Spellblade's element (the builds pass, Michael's A)

**What changed**

A specialization now carries the elements it may be (`SpecInfo.elements`, the first its own): the Spellblade Fire, Frost, Earth or Air, the Rogue Shadow or Nature, the Paladin Holy. The choice rides as `Loadout.elements` and `PlayerState.elements`, one a style; `readLoadout` refuses an element without a specialization that offers it (`elementProblem`), `HostSession` keeps the old ones where specializations are shut, and `elementFor` reads a hero's (a stale one reads as the specialization's first). The sword trail takes it, so a Frost Spellblade's blade streaks pale blue. The Talents tab's specialization row shows a row of element buttons, each edged in its colour, under a specialization with a choice; F or A on the row now steps through every specialization and element in turn, so the keyboard and pad reach all of them. The Spellblade is still `built: false`, so none of it is offered yet. Check 409 green, test:net passed. Not yet seen in a browser.

Blazing Charge's trail and the spectral blades have one line each on the builds page and no numbers, so what they do is asked in `decisions.md` Pending (A recommended: both deal damage now, coloured by the element; the numbers on the panel).

**Learned**

Stepping a single key through (specialization, element) pairs keeps the hero screen to F and Q; with the Sorcerer's four elements to come the same cycle covers it with no new binding.

**Next**

Blazing Charge and the spectral blades once Michael answers, then the Spellblade is offered. Until then, the Rogue (Shadowstep, Fan of Knives, From the shadows), whose three lines say enough to build.

## 2026-11-06: Session 124, the Spellblade's Blade Storm, first part (the builds pass, Michael's A)

**What changed**

The Spellblade's first piece, not yet offered on the hero screen (`built: false`, so `readLoadout` still refuses it). Blade Storm (`bladeStorm` in `specs.ts`, every tick of a Spellblade's Whirlwind spin): light enemies (fodder, archer, caster, leader and charger roles) within `specs.bladeStormRadius` (6 m) are drawn toward the hero at `specs.bladeStormPull` (4 m/s), set as their knockback so the enemy step slides them along walls, and let go `specs.bladeStormHold` (1.4 m) out so the spin's edge still finds them; Shieldbearers, Brutes, Knights and bosses stand their ground. The Spellblade and Rogue now carry their signatures in `SPECS` for the hero screen. Check 406 green, test:net passed.

**Learned**

A knockback set each tick is a velocity, not a push: the guard's shove multiplies by the friction because it is one impulse that decays, a steady draw must not, or it runs at forty metres a second.

**Next**

The rest of the Spellblade before it is offered: its element chosen from Fire, Frost, Earth or Air (the hero screen and `Specs` need a place for it), Blazing Charge's trail and the spectral blades on the spin. What the trail does and what an extra blade hits for are not on the page; if they need a call, ask in decisions.md.

## 2026-11-06: Session 123, the Paladin's Bulwark (the builds pass, Michael's A; the Paladin built)

**What changed**

Bulwark, the Paladin's signature, from the combat builds page Michael kept. A Paladin's raised guard holds against a heavy hit (`guardHoldsHeavy`, `specs.bulwarkHolds`): it takes the heavy's chip (`guard.heavyBlockDamageFrac`), is shoved like a light block and stays up, where anyone else is broken and stumbles. A Paladin's perfect parry pulses light (`holyPulse`, called from `parry`): every standing hero within `specs.bulwarkRadius` (4 m), the Paladin too, heals `specs.bulwarkHeal` (6%) of their own health, with a `holyPulse` event for a rising chord. The hero screen's specialization row now shows the signature over the two abilities. With Session 121's Shield Rush and 122's Consecrate, the Paladin is whole for this pass (its tree at 20, 30, 40 and the Crescendo wait, as Michael's A says). Check 404 green, test:net passed. Not yet seen in a browser.

**Learned**

The champion constellation already has a slotted perk named Bulwark (less chip on a block); the two stack and read alike on screen. Worth a rename of one when the trees come. The parry heal includes the Paladin: the page says "allies", and a tank who heals everyone but themselves on a perfect parry felt like a trap; the panel's numbers make it easy to change.

**Next**

The Spellblade: its element chosen from Fire, Frost, Earth or Air, Blazing Charge, Blade Storm and spectral blades. Then the Rogue.

## 2026-11-06: Session 122, the Paladin's Consecrate (the builds pass, Michael's A)

**What changed**

A Paladin's Whirlwind now leaves a holy ring where the spin ends (`consecrate` in `specs.ts`, called from `stepAbility` as the spin's active time runs out): `specs.consecrateRadius` 3 m, `specs.consecrateSeconds` 6, one a Paladin (a new spin moves it). Every hero standing in a live ring takes `specs.consecrateDamageTaken` (0.85) of a hit, applied in `hurtHero` beside `damageTakenMult`, before the guard; the design page's "allies inside take 15% less" includes the Paladin. The rings ride as an optional `SimState.consecrated` (with `y`, so a ramp's ring sits on the ramp) and leave the state once faded (`fadeConsecrated` in `stepSim`), so the arena and the parity hashes never see them. `client/src/render/ConsecrateView.ts` draws up to four as a gold edge and a faint wash, built once, breathing, fading over the last second. All three numbers on the panel. Check 400 green, test:net passed. Not yet seen in a browser.

**Learned**

The spin's end is the one tick both prediction and the server agree on without a new field: `t0 < windup + active <= t`. A ring prediction places is thrown away with the next snapshot and the server's drawn instead, so nothing doubles.

**Next**

Bulwark, the Paladin's signature (the guard holds against heavy hits; a perfect parry heals allies within 4 m). Then the Spellblade.

## 2026-11-06: Session 121, specializations and the Paladin's Shield Rush (the builds pass, Michael's A)

**What changed**

The first slice of the builds pass, to Michael's A (specializations first, one style a session, Melee's Paladin, Spellblade and Rogue first). `shared/src/sim/specs.ts` holds the nine-to-be as data (`SPECS`: style, element, the two reshaped abilities, built or not; Melee's three today, from the combat builds page Michael kept on 28 Oct) and the checks. A hero's specializations ride as `Loadout.spec` and `PlayerState.spec`, one a style; `readLoadout` refuses one that is not its style's, not built, or below that style's level 10 (`specs.level`), and `HostSession` keeps the old ones anywhere slotted perks are shut (village, a reached rest room, the antechamber are open). The Paladin's Shield Rush: a Charge that lands taunts the enemy it hit for `specs.tauntSeconds` (3), so `nearestTarget` hands every brain the Paladin while it lasts, nearer friends or not; a downed Paladin lets go. The hero screen's Talents tab has a Specialization row under each kind's board (Paladin choosable, Spellblade and Rogue shown as soon; F or A steps through, Q or X takes it off, 48 px buttons), locked with a note where it cannot change. A Paladin's sword trail is holy gold, and a taunt rings a bell. Nothing the parity test sends carries a spec, so the hashes are untouched. Check 398 green, test:net passed. Not yet seen in a browser.

**Learned**

The Charge stops at the first enemy it meets, so "taunts every enemy it hits" is one enemy a Rush; the design page's wording fits Whirlwind better, but its Q is Charge. Taunt state lives on the enemy and only the server steps enemies, so prediction needs nothing.

**Next**

The Paladin's Consecrate (Whirlwind leaves a holy ring; allies inside take less damage), then Bulwark, the signature (the guard holds against heavy hits; a perfect parry heals allies near). Then the Spellblade.

## 2026-11-06: Session 120, the builds pass asked

**What changed**

Docs only. Nothing in the current section was the builder's: G5 and E1a to E1h are built, E1i waits on Michael's call once the Crypt has been played, and the late-deaths item needs a real machine's frame rate. The one open **(design)** item whose condition is met, the builds pass (Phase 2's carry-overs, "to be cut into items once the feel pass has been played"), had never been asked, so it is now in `decisions.md` Pending: specializations first (A, recommended), elements and the first three states first (B), the rest of the weapon roster first (C), or not yet (D).

**Learned**

Elements and states lean on each other (an element is what leaves a state), so the order of the builds pass is really the order of its two loops; the roster is the only part that needs no new design.

**Next**

Build to Michael's answer. Until then the builder has no item; E1i still waits on a play of the Crypt.

## 2026-11-05: Session 119, the treasure room's guard (G5's C, Michael's B, finished)

**What changed**

The rest of G5's C, B: the "elite pack (a mini-boss's numbers, smaller)" guarding a treasure room's chest. With this, G5's C is built.
- **When it rises** (`wakeTreasureGuards`, `sim/floorRun.ts`). Once the room's portcullis is up, the first standing player (not a henchman) to step a metre past the doorway wakes it, once a floor (`SimState.floor.guarded`). Before the key room falls, or from the hall, nothing stirs, so pressing on past the open gate costs nothing.
- **What rises.** A crowned elite a step in front of the chest, facing the door. It is the mini-boss's kind for the floor's tier (a Barrow Knight from `miniboss.knightFromTier`, a Bone Brute below), with a name and `miniboss.guardHealthMult` (1.75) its health against the mini-boss's 3. `miniboss.guardPack` (2) Skeleton Warriors stand across the room halfway to the door. All three numbers and the switch (`miniboss.treasureGuard`) are on the panel.
- **Its own, not a room's.** Each guard carries `EnemyState.guard` (the room's id, optional, so the wire packs it as an extra and the arena never sees it). A fight room's count ignores it, so a guard that follows the party into the next fight never holds that room shut or brings its reinforcements early. A Haunted guard that will still rise is kept when the next fight clears the corpses.
- **Seen.** The elite wears the mini-boss's crown but has no boss bar, so it keeps its own health bar over its head (`EnemyView`).

**Learned**

Tying the guard to the gate and the player's step, not to the run's phases, kept it out of the fight-room machinery entirely: no shut doors, no banner, no `f.room` for a room that is not a piece. The cost is that nothing tells the party the guard is "theirs" to finish; they can walk away mid-fight and it follows.

`secrets.test.ts` (+2): nothing rises from the hall or before the key room falls; stepped into, the elite and two grunts rise once, inside the room, the elite named, by the chest, at 1.75 times its kind's health; a fight room with only guards alive clears; with the switch off nothing rises. check 391, parity identical, test:net passed, the client builds. Not yet seen in a browser.

**Next**

G5's C is done. Nothing else in E1 is the builder's: E1i waits on Michael's call once the Crypt has been played, and the late-deaths item needs a real machine. A browser look at a crack, a treasure room, its guard and their chests is the first thing a play should check.

## 2026-11-05: Session 118, treasure rooms behind a portcullis, first part (G5's C, Michael's B)

**What changed**

The second of G5's C, in Michael's order. This is a tested first part: the room, its gate and its chest. The elite guard is still to come.
- **Where** (`treasureFor`, `level/secrets.ts`). It is a side room one cell wide and two deep (6 x 12 m) off a hall on the main way, from the entrance to the exit by the generator's links (`mainWay`). The hall needs a fight room still ahead of it. At most one a floor. Like the secrets, the room takes a walled-up doorway whose room is clear of every piece and secret and inside the floor's bounding box. Only junctions have a spare doorway on the main way, so over 100 floor-1 seeds of 24 pieces there are 27, 15 off tees and 12 off crossings.
- **The gate.** A portcullis (`TreasureRoom.gate`) stands in the doorway until the main way's next fight room after the hall (`key`) is cleared. Until then `floorWorldNow` adds it for the server, prediction and the camera alike. `FloorView` drops and raises it like a fight room's gates, from the cleared list `sync` now passes. The room is no secret: the minimap draws it from the start, its doorway iron grey until the key room falls.
- **The chest** is a prop (id 20000) in `smashable`, the same as a secret's (`loop.chest*`). Its spray stays inside the room.

**Learned**

A hall or a corner on the main way uses both of its doorways, so treasure rooms only hang off tees and crossings. To have them in more places, a hall would need a spare socket in the kit, which would change every floor a seed builds.

`secrets.test.ts` (+2): over 100 seeds each treasure room is off a non-fight piece on the main way, its key is the first fight room after it on the way, its room overlaps no piece and no secret, the same every time, on 25 to 75 floors of 100; the portcullis is a wall until its key room is cleared, then the doorway and the room are walkable and the chest sprays inside it. check 389, parity identical, test:net passed, the client builds. Not yet seen in a browser.

**Next**

The rest of G5's C, B: the elite guard, a smaller mini-boss's pack waiting in the room (`spawnMiniboss` for the numbers). The design doc's "spend health for the chest or press on" needs it. Then a browser look at a crack, a treasure room and their chests.

## 2026-11-05: Session 117, cracked walls and the chest behind them (G5's C, Michael's A)

**What changed**

The first of G5's C, in Michael's order (C: both, A first): secret rooms behind cracked walls.
- **Where** (`level/secrets.ts`). A fight room (never the boss's hall) rolls one from the floor's seed at 15%, two a floor at most. It takes one of its walled-up doorways on its own floor whose 6 m cell outside is clear of every piece and every other secret and inside the floor's bounding box, with nothing in front of it on the room's side: no lava, spikes, falling tile, tomb, dais or masonry within reach. Over 100 floor-1 seeds of 24 pieces there are 67, on 48 floors, mostly behind guard rooms (29). They are placed after everything else, so a seed builds the same floor round them; only the cracked doorway's wall pieces change.
- **The wall.** That doorway is built as a gap (lintel above, no portcullis), filled by its cracked wall, `crack-<id>`, which `floorWorldNow` adds until it is broken. Server, prediction and camera all read it from there. The cell has its own three walls (`wall-secret-*`, drawn and faded like the rest) and floor.
- **Breaking it.** The crack and the chest are props, ids from 10000, in a new `FloorLayout.smashable` list (the props, then each secret's two). So the sim keeps only `SimState.floor.broken`, and nothing new travels in a snapshot. `smashArc` takes a `heavy` flag. A sword's heavy or slam (`swordHits`) and the shield's bash set it, and only those meet a crack, within most of the doorway's width (`CRACK_REACH`, 1.6 m). Whirlwinds, bursts, frost rings and shots pass it by.
- **The chest** breaks to any blow and sprays a find like a crate, only more: 2 to 3 lumber, 1 to 2 stone, 15 to 30 coin always, and a potion half the time (`loop.chest*`, on the panel). The spray stays inside the cell. It is carried until banked and lost with a wipe, like every other find.
- **Seen.** The crack is the doorway's stone filled in, a shade off the walls, with a jagged hairline down its face (`PropView`). It disappears when broken. The chest is a banded box with a domed lid and a brass lock. The minimap draws the cell, in gold, only once its wall is broken.

**Learned**

Making the crack and chest props, rather than a new kind of thing, meant the break, the event, the spray, the view's hiding, prediction and the snapshot all came for free. The one new rule is that a crack only counts for a heavy blow.

`secrets.test.ts` (4): over 100 seeds every secret is behind a fight room's walled-up doorway, in a cell clear of every piece and inside the floor, the same every time, on 20 to 90 floors of 100; a light swing leaves the wall standing and a held heavy breaks it, after which the gap and the cell are walkable; a whirlwind-sized blow does not break it and a bash does; the chest breaks to any blow and its spray (coin always, at least the minimum) lands inside the cell. check 387, parity identical, test:net passed, the client builds. Not yet seen in a browser.

**Next**

G5's C, B: gated treasure rooms with an elite guard, opened when the main way's next fight room is cleared. After that, a browser look at a crack and its chest.

## 2026-11-05: Session 116, test:net's bots step round a brazier

**What changed**

Session 114's flake: on floor 2 of test:net's fixed seed a brazier stands on the straight line to the great hall's waypoint, and a bot arriving exactly on that line pushed into it head-on, stopped at (-7.75, 9.00) and timed out, about 1 run in 6. `Bot.walkTo` (`tests/bots.ts`) now watches for a dead stop: when the bot has moved less than 0.1 m for 0.6 s while still short of its mark, it steps half sideways, half on, for 0.4 s, alternating sides each time, and walks on. Test code only; the sim and the server are untouched.

**Learned**

A circle pushed exactly through another's centre has no side to slide off to, so any route that runs a straight line through a round obstacle sticks; the nudge is general, so the next brazier or pillar a seed puts on a route is covered too.

test:net passed (one run; the flake was 1 in 6, so one run proves little on its own). check 383.

**Next**

Watch the next runs of test:net for a "never reached" on floor 2.

## 2026-11-05: Session 115, a tile's fall eases instead of snapping

**What changed**

The critic's bug from 5 Nov (24f5783): when a collapsing tile fell under a hero, their own screen jumped them 2.7 to 2.85 m, a snap, in two falls of three. The server puts the hero back a stride off the hole's edge, and prediction cannot know the tile is about to fall (`stepCrumble` runs in `stepSim`, never in prediction), so the walk predicted onto the tile over the last round trip came back as one correction past the 2.5 m snap limit. Same class as the refused dodge (Session 37) and the downing blow (Session 50), whose easing did not survive the transplant.
- **The event names who it put back.** `tileFell` carries `put`, the ids of the heroes and henchmen it moved. Floor-only, so the arena and the parity hashes do not see it.
- **The browser eases it.** `placedBy(events, id)` (`game/Session.ts`) tells `ClientSession` that this snapshot's jump was the server placing our hero. For half a second of server time after one, a correction eases up to `placedEaseM()`: the 2.5 m snap limit plus half a second of sprinting, 6.5 m, from the movement tuning. It reads as a quick pull back to the edge over `coop.correctionBlendMs` instead of a pop. Such a correction counts as placed in the lab's diagnosis, not as a snap. Any other jump over 2.5 m still snaps.

**Learned**

The snap limit applies to the accumulated offset, not to one correction, and an eased 2.8 m offset takes a few snapshots to fade. So the wider limit has to hold for a short window, not only on the snapshot that carried the fall, or the next snapshot snaps it anyway.

`crumble.test.ts` (+2): a fall names the hero it put back (`placedBy` true for them, false for anyone else), and a sprint across the tile and on for a 300 ms round trip is over the snap limit and under the eased one; a tile that falls empty names nobody. check 383, parity identical, test:net passed. Not yet seen in a browser on a slow link: test:net runs on loopback, where a fall's correction is about 1.6 m and never snapped.

**Next**

The critic's lab or a browser on a 150 ms link: walk onto the seed-513 tile and stand, and count snaps (expected 0).

## 2026-11-05: Session 114, snapshots that stay small in a crowd (Fable)

**What changed**

The card `fable/snapshot-size`, from Session 86's measurement: every snapshot is the whole `SimState`, and in a crowd it was the largest thing the server does. Measured first with `tests/snapshot-size.ts` (Session 86's setup kept as a script: the arena, one hero, three henchmen, 55 enemies placed round the hero, god mode, 1200 ticks). It also weighs the snapshot as msgpack, the way Colyseus actually sends it, which Session 86 did not: the JSON figure overstated the wire by about a third.

| Crowd (40+ live enemies), 600 snapshots | median | worst |
|---|---|---|
| As JSON (Session 86's measure) | 46.1 KB | 55.8 KB |
| On the wire before (msgpack, keyed objects) | 30.3 KB | 35.9 KB |
| On the wire now (rows) | 10.8 KB | 17.2 KB |

In the heaviest snapshot the enemies went from 24.5 KB to 8.9 KB, the players from 4.5 to 2.3 and the projectiles from 1.4 to 0.5. The worst case is mostly a burst of events (51 of them, 6 KB), which is unchanged.

- **Rows, not trimming** (`shared/src/net/pack.ts`). An enemy's 37 fields cost their names on every enemy in every snapshot, and most of them sit at rest (no knockback, no bleed, no combo window, no telegraph). Enemies, players and projectiles now travel as rows: the values in a fixed order with no names, a field at its resting value as nil (one byte), trailing nils left off, and any field the list does not name (the optional ones: `risen`, `crown`, `hitMult`, a henchman's `brain`, `flow`, `ward`, ...) in an object at the row's end. A nested telegraph is a row of its own.
- **Lossless.** The browser unpacks exactly the `SimState` the server stepped, so nothing the views or prediction read could go missing, and nothing had to be argued about field by field. The card's option (a), dropping what the browser never reads, would have saved less (the heavy fields are positions, timers and health, which prediction does read) and needed a proof for each field; option (b), deltas against an acked baseline, is not needed at 11 KB and would have cost every snapshot its independence. Joins and hand-offs need nothing special: every snapshot still stands alone.
- **Where it happens.** `HostSession` still hands its room a plain `snap`; the room packs it once (`toWire`) for everyone it goes to, and `ClientSession` (and the test bots) unpack it on arrival (`fromWire`). Every other message travels as before. `PROTOCOL_VERSION` 17.
- **Kept honest by the typecheck.** Each list is checked against its state type: a required field added to `EnemyState`, `PlayerState` or `ProjectileState` and not to its list fails `npm run check` (`Unlisted`). An optional one needs nothing; it rides in the row's tail.

**Learned**

Session 86's 46 KB was JSON; the wire was 30 KB. Most of that was key names and resting values, not state. Pack and unpack together cost 0.57 ms per crowd snapshot here; the server pays half of that once per broadcast, not per player, and msgpack then has a third as much to encode. A null in a field whose resting value is something else (a `queuedSwap`, for instance, rests at null, but an enemy's `attack` rests at '') goes to the row's tail, so nil in a row always means "at rest".

`pack.test.ts` (6): every snapshot of a 900-tick, 40-enemy arena fight with two players and two henchmen mashing buttons comes back equal after packing and a JSON trip; so does a haunted generated floor on difficulty 3 with a named enemy, a thrown crown, armour and a ward on a hero; a null where rest is not null and an absent optional field survive; each row gets its own resting telegraph; prediction stepped 120 ticks from the unpacked snapshot gives the same hero and enemies as from the server's state; a crowd packs to under half its keyed size. check 381 tests, parity IDENTICAL (not re-recorded). test:net passed 9 of 11 runs, 6 of 6 when run alternately with main (also 6 of 6); the two failures are an old flake in the floor walk, not this change (Next). The lag lab, this machine, against main on the same machine: what the server sends one player fell from 113 to 118 KB/s to 48 KB/s in the lab's small fight. Corrections a minute at 0, 50 and 150 ms were 53, 64 and 114 (main 40, 57 and 61). Two more runs of the 150 ms row gave 90 and 141 (main 98 and 182), so it is noise: three-run means 115 against 114. 0 snaps in every row, and every row under the critic's last 100, 125 and 152.

**Next**

The late deaths and drops item stays open for the browser side (frame rate and drawn-clock lag in a crowd on a real machine). Events are now the largest part of a burst; pack them the same way only if a measurement asks for it.

test:net's floor walk is flaky on its fixed seed: floor 2 (seed 1090731875) puts a brazier (`brazier-3-1`, radius 0.45) at (-8.6, 9), right on the straight line from the entrance to the great hall's waypoint (-24, 9). A bot that arrives at exactly z = 9.0 pushes into it head-on and stops at (-7.75, 9.00) for 30 s; any drift off the line slides it round. Seen 2 times in 11 runs here, never on main in 6, which is luck of timing, since the sim is unchanged. The fix belongs in the test route (`walkRoute` steering round braziers, or a nudge off the line), a builder's item.

## 2026-11-04: Session 113, the L-room (G5's B, Michael's C)

**What changed**

The last of G5's B, in Michael's order: the L-room. `ell` is a 4 x 4 cell kit piece (24 m) titled "The crooked hall". Its north-east quarter (unturned) is solid masonry, a 12 m block made with the round chamber's `blocks`, so the room is two arms 12 m wide meeting at a corner. It has four doorways: one at the end of each arm and one on each outer side. One fire stands in the far corner. The generator grows it off a hall at the round chamber's weight (1.4). Over 100 floor-1 seeds of 24 pieces there are 74 of them, on 55 floors.
- **The elbow.** `PieceDef.elbow` (kept on `PieceInfo`) is a point 2.2 m out from the masonry's inside corner, and it can see down both arms. It is the room's middle for `openMiddle`, so the bots' and henchmen's way through goes round the corner and never into the stone.
- **Enemies go round.** In `around` (enemies.ts), an enemy whose straight line to its goal runs within its radius plus 0.3 m of the masonry heads for the elbow first. Walking straight, a grunt slid along the stone at its own radius and arrived a quarter later. Going by the elbow it keeps at least 0.6 m off the stone. The round chamber has no elbow and is unchanged.
- **Everything else keeps clear,** as in the round chamber. Spawn spots stay 1.4 m from the masonry, props, torches, traps and tombs keep off it, lava never picks it, and a dais never fits it (its middle is the corner). The editor's palette has it as "L-room (for four)".
- Adding a piece changes which floor a seed builds. The arena is untouched, so the parity hashes stay the same.
- **test:net's floor walk** now runs with god mode and the lava burn off. Its bots walk straight lines through the doorways and never hop or fight back. On the floor its fixed seed now builds, one burned down crossing a lava strip and the other was felled by the rest room's mini-boss before the cheat cleared the room. The walk tests the hand-offs, not the fight.

**Learned**

Most enemies already reach a hero round a convex corner by sliding along the wall. The elbow matters less for arriving at all than for not grinding along the stone, so the test holds the grunt's distance from the masonry as well as its hit. The smoke test's floor walk had been passing on luck: any floor 2 with lava or a mini-boss on its straight route would have stopped it.

`ellRoom.test.ts` (3): the masonry is one quarter and every doorway opens clear of it; on 80 seeds it turns up with its spots, props and torches clear of the masonry, no lava and no dais, the elbow in view of every doorway and the bots' route never running into the stone; a grunt goes round by the elbow to a hero down the other arm and hits them, never within 0.6 m of the stone (this fails without the elbow). `dais.test.ts`'s grunt now only has to climb the first step, since the floor it picks changed and from that step the top is in reach. check 375, parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G5's B is done. G5's C, secrets and side rooms, has no shape yet, so it is asked in decisions.md Pending.

## 2026-11-04: Session 112, the dais (G5's B, Michael's C)

**What changed**

The third of G5's B, in Michael's order: a raised dais. Some big fight rooms (15 m or more each way inside the walls) now have a square of dressed stone in the middle, raised in two steps of 0.3 m each (`level/setPieces.ts`, `daisesFor`). It is placed from the seed's own stream, so the generator, props, lava, traps and tombs are untouched. The room's banner reads "The raised dais". Over 100 floor-1 seeds of 24 pieces there are 77 of them, on 58 floors.
- **Fits the room.** The lower step is 8 m square, with the top set 1.5 m in from its edge. A room ringed by pillars takes a smaller one inside the ring: 6.5 m, or 5 m in the halls of pillars and the great hall. In the round chamber it stands between the four fires. It is never in the boss's hall, the lava room or a room with tombs. It keeps clear of doorways (3 m), pillars and fires (a stride), the masonry and the traps.
- **Ground, not wall.** Its two steps are flat surfaces (`daisSurfaces`) that `groundHeight` reads, so the server, prediction and telegraphs all put feet on it with no new code. Each step is under the 0.35 m stride, so heroes, henchmen and enemies walk up it from any side without pathing of their own. The top (0.6 m) is inside every attack's reach (enemies' 0.9 m level gap), so it changes how a fight moves, not who can hit whom. Nobody wakes on its steps. Spawn spots within 0.6 m of it are dropped, and every room keeps at least four.
- **Seen.** Two stone steps, a worn slab on top with a darker inlaid border, built once in `FloorView`. On the minimap it is a lighter square with a lighter top.
- No ring of sunken floor round it. `groundHeight` takes the highest surface under a point, so ground can never sit below a room's own floor. The "sunken ring" is the room's floor, a step below the dais. A true moat would need a change to the ground model.

**Learned**

The generator's test holds every spawn spot to its room's floor height. Spots on the steps broke that, and enemies waking on a step edge would have looked wrong anyway, so they are dropped rather than the test loosened. Every big room but the pit has pillars or fires a few metres from its middle, so an 8 m dais alone landed only in guard rooms and round chambers. The smaller sizes are what put it inside the pillar rings.

`dais.test.ts` (3): over 100 seeds it lands only in fight rooms that are not the boss's hall, the lava room or a tomb room, the same from the same seed, inside the walls and clear of doorways, pillars, fires, traps, props and spawn spots, with the ground reading top, step and floor, and the bots' middle on its top; a hero runs up both steps and off the far side; a grunt walks up to a hero on top and hits them. check 372, parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G5's B ends with the L-room (a new kit piece). Then C, secrets and side rooms.

## 2026-11-04: Session 111, the round chamber (G5's B, Michael's C)

**What changed**

The second of G5's B, in Michael's order: a new room shape. `round` is a 4 x 4 cell kit piece (24 m) titled "The round chamber", with four doorways, one on each side. Its corners are filled with stepped masonry (`PieceDef.blocks`, 48 blocks made by `roundBlocks` in `kit.ts`), so its floor is a circle 23 m across. The edge steps out at most 0.8 m past the circle, and each doorway opens straight into it. Four braziers stand round the middle. With no corner to be pinned in, a fight there circles. The generator grows it off a hall, as it grows the other rooms (weight 1.4 beside the hall of pillars' 2.4). Over 100 floor-1 seeds of 24 pieces there are 62 of them, on 48 floors.
- **Masonry is wall.** Its blocks are wall colliders (`wall-<piece>-block-<k>`), so the server, prediction, the camera's fade and `FloorView`'s wall drawing take them with no new code. The minimap draws them dark.
- **Everything else keeps clear.** Spawn spots stay 1.4 m from the masonry, and props, torches, collapsing tiles and tomb rows keep clear of it. Lava never picks a round room, because its walkway at the strip's end could be walled off. The editor's palette has it as "Round chamber (for four)".
- Adding a piece changes which floor a seed builds. The arena is untouched, so the parity hashes stay the same.

**Learned**

The curve is cut into slices along whichever axis it is shallower to. Cutting along one axis only left notches nearly 5 m deep near the walls. A slice that overlaps a doorway is left out whole, so the floor in front of a door can sit up to 1.1 m outside the circle. That is a doorway alcove, not a gap.

`roundRoom.test.ts` (3): no block reaches inside the circle; just outside it, all round, is masonry except in front of a doorway; on 60 seeds it turns up, with its spots inside the circle and clear of the masonry, props and torches out of it, no lava, and the bots' route through the floor never running into it. check 369, parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G5's B continues: the dais (a raised floor ringed by a sunken one), then the L-room. Then C, secrets and side rooms.

## 2026-11-04: Session 110, tomb rows (G5's B, Michael's C)

**What changed**

The first of G5's B, built to Michael's C (control room, 4 Nov). The order is one a session: the sarcophagus rows, then the round chamber, then the dais, then the L-room. Some big fight rooms (15 m or more each way inside the walls, never the boss's hall or the lava room) now have one or two rows of three stone tombs. Each tomb is 1 x 2.2 m and 1.3 m tall, with 1.1 m gaps between them. Over 100 floor-1 seeds of 24 pieces, 127 of 459 big fight rooms have rows, on 78 floors, and such a room's banner reads "A hall of tombs" (`level/setPieces.ts`, placed from the seed's own stream, so the generator, props, lava and traps are untouched).
- **Cover.** The tombs are solid to walking, to an archer's line of sight and to arrows in flight. That includes the heroes' own arrows. A jump (1 m) does not clear them. A hero crouched behind one is out of an archer's line, so it does not draw. The Wraith now casts only at a hero it can see, using the same check the archer uses. A pillar hides a hero from it too, which it did not before.
- **The way stays open.** Rows keep 1.4 m from the walls, 4 m from a doorway and clear of the room's middle. They also stay 1.6 m clear of the straight line from each doorway to the middle, which is the route bots and henchmen take, and clear of pillars, fires, spikes and collapsing tiles. Spawn spots and props near a tomb are dropped.
- **Seen.** A plinth, a stone chest and an overhanging lid with a worn figure carved on it, built once in `FloorView`. Pale blocks on the minimap.

**Learned**

The Wraith never checked its line of sight before casting. With pillars only in some rooms, nobody noticed. With cover added to rooms, a caster that saw through stone would have made the tombs pointless against it.

`tombs.test.ts` (4): over 60 seeds the rows land only in fight rooms that are not the boss's hall or the lava room, the same from the same seed, inside the walls and clear of doorways, spawn spots, props, traps and the middle, and the bots' route from the way in to the way out never crosses one; a tomb is taller than a jump; a Wraith casts at a hero in the open and not at one behind a tomb; an archer draws on a hero in the open and not on one behind a tomb. check 366, parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G5's B continues: the round chamber next (a new kit piece), then the dais, then the L-room, one a session. Then C, secrets and side rooms.

## 2026-11-04: Session 109, collapsing floor tiles (G5, Michael's B)

**What changed**

G5's third trap, built to Michael's B (control room, 4 Nov). Of the fight rooms with neither lava nor spikes, about three in ten get two collapsing tiles: 1.5 tiles in 0.84 rooms a 24-piece floor, on 56 of 100 seeds. They are never in the boss's hall and never in a hall, where a hole could close the way. Each tile is 2 m, on open floor at least 5 m from a doorway and 5 m from the room's other tile, with a stride of floor all round it (`crumbleFor`, from the seed's own stream, so the generator, props and other traps are untouched). Spawn spots on them are dropped.
- **Stepped on.** A hero (not a henchman) on their feet on a tile starts it shaking (`tileCracked`). It falls after `traps.crumbleShakeS` (0.6 s) plus the lag grace, so a step off that was on time on the player's screen counts.
- **Falls.** A hero on it then loses `traps.crumbleHeroFrac` (25%) of their health and is put back a stride off its nearest edge. A hero high enough in the air (the jump's rule) or in a dodge's i-frames is only put back, and so is a henchman. An enemy on it is gone, so a pack lured onto it falls with it. `tileFell` counts who went.
- **The hole stays.** `SimState.floor.fallen` lists it for the rest of the floor, and `floorWorldNow` adds its wall (`crumbleWalls`, made with the layout). Server, prediction and camera all read colliders from there, so nobody walks into it and prediction agrees. The room changes shape as it is fought.
- **Seen and heard.** A pale slab a little proud of the floor. Through the shake it jitters harder and orange cracks (the colour language's heavy) brighten in it. Once fallen it is a black pit. A grind and crack as it gives, and a rumble as it goes.

**Learned**

`floorWorldNow` returned the prebuilt locked set while the floor's exit was shut and no fight was on, which would have dropped the holes. It now builds the set when there are holes, and still allocates nothing on a floor without them.

`crumble.test.ts` (5): tiles only in fight rooms, clear of doorways and spawn spots, the same from the same seed; a hero on it starts the shake, it has not fallen at 0.6 s and has after the grace, a quarter of their health goes and they stand off the edge; a hero who stepped off in time is spared and a grunt left on it dies (`caught: 1`); the hole adds one collider, walking into it ends outside it, and it never shakes again; nothing with traps off. check 362, parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G5's B: room shapes and set pieces, one per builder session, then C (secrets and side rooms). The collapsing tile, the Hollow King and the Wraith all want a first look in a browser.

## 2026-11-04: Session 108, the Hollow King's second and third phases (G4b)

**What changed**

The rest of Michael's A for the Hollow Crown's boss. Each phase now asks for something new: a dodge, then a split party, then reading a wide sweep in the dark.
- **Phase 2, at 60%.** He roars ("The King calls his knights") and two Barrow Knights rise round the hall (`raiseFromEdges` now takes a kind and a radius; the Warden's call is unchanged). From then on, about three turns in ten (`king.circlesChance`) he puts a violet circle (1.8 m) under every standing hero at once. Each circle lands 1.4 s later, after the lag grace, for 14 damage and a Chill, so the whole party has to move. A dodge or a high enough jump slips it, as with the Wraith's. Each circle is heard landing (`circleLanded`), and `TelegraphView` draws the extra circles beside his own telegraph.
- **Phase 3, at 30%.** He roars again ("The hall goes dark"). The hall dims to 60% of its exposure over 1.5 s (`look.kingDim`, `kingDimS`, browser only) until he falls. His wind-ups take 0.75 of their time, he moves 1.3x faster, and his cooldown is 500 ms. Within 7.5 m, four turns in ten, his crown sweeps a 240-degree yellow arc round him (22 damage, `crownSweep`), drawn as the crown flying across the arc's edge.
- **Panel.** Every new number is in `tuning.king` with a range.

**Learned**

The King's circles hit through `hurtHero` with `late: true`. They already waited out the lag grace before landing, so a second grace would let a hero who was caught step out after the fact. Circles that are cast fade if he is staggered mid-channel, just as a thrown crown is dropped.

`king.test.ts` (9, was 6): at 60% the roar names phase 2 and two Knights rise away from him; the circles go under both heroes, are violet, Chill and hurt the one who stayed and spare the one who stepped out (`caught` 1 then 0); at 30% the roar names phase 3, and the yellow 240-degree sweep winds up at 0.75 pace and hits. check 357, parity identical, test:net all passed, the client builds. None of it seen in a browser yet: the dim, the extra circles and the sweeping crown are the things to look at.

**Next**

G4b is built; it needs a look in a browser, at the end of the Hollow Crown (5 floors on Hard) or through a hand-built floor with `?floor&hand=` and story set. Then G5's collapsing tile, as Michael's B.

## 2026-11-04: Session 107, the Hollow King, phase one (G4b part one)

**What changed**

Michael answered G4b on the control room (A, the Hollow King) and the collapsing tile (B, the hole stays for the floor); both answers reach this branch through the control room ahead of the producer's copy into decisions.md. This session is the King's first part.
- **The kind.** `king`, a new `EnemyKind` in the boss role, "The Hollow King" in the Crypt. Its numbers are `tuning.king` (2400 health, 40 poise, a 1.6x figure), with panel ranges for the string, the crown and the cooldown. A boss keeps a brain of its own (`brainFor` picks `kingBrain` before the role's), so the Warden's is untouched.
- **Where.** `bossOf(story)` in `floorRun.ts`: the Hollow Crown's last hall makes the King and every other run's the Warden, behind `king.hollowCrown`. The Hollow Crown's enemy list on Wren's card names him in the Warden's place, and the boss bar reads "The Hollow King".
- **Phase 1.** Up close, a sword string of three cuts, each a red cone (3.8 m, 110 degrees, 16 damage) that turns with the hero for the first half of its wind-up, the first wound up 0.7 s and the next two 0.38 s. At 6 to 15 m with a clear line, his crown thrown down a yellow line that stops at a wall: 0.9 s to wind up, out and back at 16 m/s, striking each hero it passes once each way (20 damage). He stands still until it is back in his hand, and a stagger drops it.
- **Boss rules follow the role, not the name.** The boss's drop spot, `bossDown` and the parry's poise cost (`parryWardenPoise`) now apply to any boss, so the King's fall banks the run as the Warden's does. The arena has only the Warden, so the parity hashes stay the same.
- **Seen as.** A skeleton at 1.6x with a long blade and the gold crown the mini-bosses wear. The thrown crown is a copy drawn 1.8x larger, spinning along the line from the root (`EnemyView.flying`), with its own wind-up and throw poses.

**Learned**

The roles test asked every role for exactly one brain. Bosses now have one each, so the test says that.

`king.test.ts`: the boss role, its own brain, a red string and a yellow crown; `bossOf` picks him for the Hollow Crown only, and the Warden comes back with the switch off; three swings up close hurt the hero in front; the crown flies out past 9 m and back while he stands still; a sidestep after the line locks takes no damage; a stagger drops the crown in flight. check 354 (was 348), parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G4b part two: phase 2 at 60% (two Barrow Knights rise and violet circles under each hero) and phase 3 at 30% (the hall dims, faster, the crown sweeps an arc), each roar's banner naming its phase. Then G5's collapsing tile as Michael's B.

## 2026-11-04: Session 106, the Wraith's circle is heard landing (E1d polish)

**What changed**

The last polish line on E1d. A Wraith's circle had the magic telegraph's shimmer as it was cast and nothing as it landed, so a player who stepped out heard no miss and one who was caught heard nothing either. Now the caster brain pushes a `circleLanded` event (the enemy, where, and how many it caught) as the circle lands, caught or not, and `Sfx` plays it as a cold thump with a hiss of frost. The `chilled` event, which had no sound, now cracks like ice: full for the hero it caught, quieter for a teammate. Server-side events reach every browser in the snapshot as before; the tint (Session 105) and the corner's line still come from the state.

**Learned**

The arena never has a Wraith, so a new sim event from its brain leaves the parity hashes alone. The arrow test now also proves a broken channel lands nothing, so no landing sound plays for a circle that is gone.

`wraith.test.ts`: the landing is one `circleLanded` at the circle with `caught: 1`; a hero who stepped out still hears it land, `caught: 0`; a broken channel pushes none. check 348 green, parity identical, test:net all passed, the client builds. Not yet heard in a browser.

**Next**

E1d is done, polish included. G4b (the Hollow Crown's boss) and G5's collapsing tile wait on their questions; G5's B (room shapes and set pieces) starts once the tile is answered or dropped. Nothing else in E1 is the builder's.

## 2026-11-04: Session 105, frost on a Chilled hero (E1d polish)

**What changed**

The polish Session 104 left on E1d. A Chilled hero now wears frost: a pale blue (`FROST`, the staff's frost colour) additive shell over the whole figure in `HeroView`, built once and shown only while the hero's `chill` lasts. It rises over `look.chillTintFadeS` (0.35 s) as the Chill lands and is held down to the Chill's own fall over its last 0.35 s, so it is gone when the slow is, and a second Chill restarting the clock does not make it blink. A slow shimmer keeps it from reading as a flat colour. Its brightness is `look.chillTint` (0.3); both are on the panel and stay in the browser (the `look` section is local). The frame step is `frostStep` (`client/src/render/frost.ts`), pure. A shell rather than tinting the figure's materials, because those are shared between heroes and swapped by the wardrobe.

**Learned**

The view reads `chill` from the same `PlayerState` the corner's line does, so a teammate's frost follows the snapshot and the player's own follows prediction, which counts Chill down on the server's tick. Nothing in the sim, server or net changed, so parity and test:net are untouched.

`tests/frost-tint.ts` (in `npm run check`): no frost on a warm hero; in to its peak within the fade and never past it; gone when the Chill ends; a second Chill at 2.8 s keeps it above a third of its peak and back to full. check 348 shared tests plus the two client checks green, the client builds. Not yet seen in a browser. The circle's own landing sound is the other polish line and stays open.

**Next**

The Wraith's landing sound (it uses the magic telegraph's today). G4b (the Hollow Crown's boss) and G5's collapsing tile wait on their questions; G5's B (room shapes and set pieces) starts once the tile is answered or dropped.

## 2026-11-04: Session 104, the Wraith (E1d)

**What changed**

The Crypt's caster, the last of its roster bar E1i's second dungeon.
- **The kind.** `wraith` is a new `EnemyKind` in the caster role (`KIND_ROLE`), called "Wraith" in the Crypt. Its numbers are `tuning.wraith`: 45 health, 3 poise, and panel ranges for health, distances, circle, channel, cooldown and the broken stagger. `casterBrain` keeps 9 m from the nearest hero, as the Priest keeps its distance. With a hero within 14 m on an open line and its 3.5 s cooldown spent, it channels a violet circle (2 m) at that hero's feet. The circle stays where it was cast. It lands after `wraith.channelMs` (1.6 s) plus the lag grace, so a step out that was on time on the player's screen counts. Whoever is in it then and on the ground is Chilled (`chillHero`, Session 103: 35% slower, no sprint, 3 s). A dodge's i-frames slip it, and so does a jump high enough.
- **Ranged beats magic.** Any hit that lands breaks the channel (`breakChannel`, in `damageEnemy` after a shield's block): the circle goes and it reels for `wraith.brokenMs` (0.9 s). An arrow is the natural answer from range.
- **In rooms.** The Wraith costs 3 and joins `SPECIALISTS`, standing `back` with the bows and the Priest behind the shields.
- **Seen as.** The Priest's robe and hood, no legs, floating 0.35 m up with a slow bob. It channels with the Priest's raised hands. The circle draws violet through the existing colour language and sound (`telegraphColour`'s magic).

**Learned**

A sixth specialist changes each room's seeded shuffle, so floors compose differently from before. D1's "a deeper floor fills it more" counted bodies. A Knight, a Priest and two Shieldbearers fill floor 3's great hall with 8 bodies against floor 1's 10, at 21 budget against 13. The test now compares budget spent, which is what it meant. The roles test lists the Wraith with the back line. Spawn protection (`invulnTime`) now also covers a landing circle, as it covers a hit.

`wraith.test.ts`: the caster role, a brain, violet; a hero standing in the circle as it lands is Chilled for 3 s; one who stepped out is not; a hit mid-channel breaks it (`recover`, no circle) and nobody is Chilled; a room that draws it stands it at the back. check 348 (was 343), parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

The Crypt's roster is complete. Polish left on E1d: a frost tint on a Chilled hero's figure. G4b (the Hollow Crown's boss) and G5's collapsing tile wait on their questions. G5's B (room shapes and set pieces) can start once the tile is answered or dropped.

## 2026-11-04: Session 103, Chill on a hero (E1d, part one)

**What changed**

Michael answered the Chill question with A: a Chilled hero moves 35% slower for 3 s and cannot sprint, and attacks, dodges and abilities are unchanged. The Wraith is a whole kind (brain, figure, channel, sound), too much for the time left in this run, so this session builds the state it applies. `PlayerState.chill` holds the seconds left, absent when warm. `chillHero` (`sim/chill.ts`) is the server's call. It sets `chill.durationS` (3) and pushes a `chilled` event; a second Chill restarts the clock, it does not stack. `stepPlayer` counts it down, so prediction runs it out on the same tick as the server. `moveSpeedMult` takes `chill.slow` (0.35) off whatever the hero's speed is, which covers running, walking, the guard's strafe and the cast walk. A Chilled sprint is a run. The dodge is untouched. The HUD shows a frost-blue line under the belt while it lasts: "Chilled · slowed, no sprint · 3". Both numbers are on the panel and go through the server. Nothing applies Chill yet, so nothing changes in play until the Wraith arrives.

**Learned**

The snapshot's hero is cloned whole into prediction (`structuredClone`), so a new optional field on `PlayerState` needs nothing in `ClientSession`. The arena's run lane is short: a second of sprint from z = -6 meets geometry, so the test runs half a second.

`chill.test.ts`: a Chilled run covers 0.65 of a warm one, give or take 0.05. A Chilled sprint equals a Chilled run, while a warm sprint beats a warm run. Chill lasts 3 s to the tick and then is gone, and a copy stepped the same way agrees to the bit. A dodge's distance barely changes. check 343 (was 339), parity identical, test:net all passed, the client builds.

**Next**

The Wraith itself: a `wraith` kind in the caster role that floats at range and channels a violet circle at a hero's feet, broken by any hit, calling `chillHero` on whoever stands in it when it lands. With it come the hero's frost tint, the caster in `SPECIALISTS` standing `back`, and its figure and sound. G4b and G5's collapsing tile wait on their questions.

## 2026-11-04: Session 102, swinging blades (G5)

**What changed**

The second trap. A blade hangs from a pivot under the ceiling in some flat straight halls (`hall`, `hallLong`, a third of them, never one with spikes) and swings across the hall, so the walk through is timed. Its arm is 3.4 m, and the steel crescent at its foot sweeps low. Level data from the seed again (`bladesFor`, `FloorLayout.blades`). Over 100 seeds of a 24-piece floor 2, 84 floors have one or more, 1.7 a floor.
- **The swing** is `bladeOffset`, a sine across the hall over `traps.bladePeriodS` (2.6 s there and back), from the sim's clock. Server and browser compute the same swing, and the view sets the arm's angle so its foot is where the sim says.
- **The hit.** A body within the blade's thickness of its line is hit as the blade passes through it, once each way. This is judged from where the blade was last tick and where it is now, so nothing is kept between ticks. A hero takes `traps.bladeHeroFrac` (20%), or clears it in the air by the jump's rule and gets "Cleared". An enemy takes `traps.bladeEnemyDamage` (40) and is thrown `traps.bladePush` (3 m) the way the blade swings, so a hall with a blade is a place to fight in. Server only, henchmen spared, under `traps.enabled`, like the spikes.

**Learned**

A blade has no wind-up, so it needs no warning glow: the swing itself is the tell, which suits a hall you walk through rather than fight in. The pass rule (the blade's offset crossing the body's) gives exactly two hits a swing with no per-player cooldown in the state.

`traps.test.ts` gains three: blades only in straight halls without spikes, reaching inside the walls, the same each time; a hero in its way is hit exactly twice a swing, untouched 1.5 m along the hall or high in the air; an enemy in its way loses 40 and is thrown along the swing. check 339 (was 336), parity identical, test:net not needed (no server or net file), the client builds. Neither trap has been seen in a browser yet. The crescent's shape and hang were worked out on paper, so the critic's run should look at a bladed hall.

**Next**

The collapsing floor tile, the last of G5's A. Then E1d, the Wraith (Chill as Michael's A). G4b waits on its question.

## 2026-11-04: Session 101, spikes (G5, traps first)

**What changed**

Michael answered G5 with D on the control room: traps, then room shapes and set pieces, then secrets, one per builder session. This session builds the first trap, spikes.
- **Where.** Spikes are level data placed from the floor's seed, like the lava and the props (`level/traps.ts`, `spikesFor`, in `FloorLayout.spikes`). Some flat fight rooms get up to three 2 m tiles on open floor, at least 3 m from a doorway, struck in turn. Some long halls get a row across the middle, struck together, so the walk through is timed. Never in the Warden's hall, the rest room, the lava room or a hand-built floor. Spawn spots and props keep off the tiles. Over 100 seeds of a 24-piece floor 2, 98 floors have spikes, about 2.4 rooms and 1 hall each, 9 tiles a floor.
- **When.** Every tile runs one cycle from the sim's clock: an orange glow for `traps.spikeWarnS` (0.9 s; orange is the colour language's heavy, nothing stops it), then the strike, then spikes up for `traps.spikeUpS` (0.7 s), every `traps.spikeCycleS` (3.2 s). Each tile's place in the cycle is a share, so a panel change to the cycle never moves the level.
- **What it does.** The strike lands `coop.lagGraceMs` after the warning ends, so a step off that was on time on the player's screen counts. It takes `traps.spikeHeroFrac` (15%) of a hero's health and `traps.spikeEnemyDamage` (30) from an enemy, so a pack can be lured across. It comes from below: no shield or guard stops it. A hero high enough in the air clears it by the jump's rule (M1) and is told "Cleared". It runs in stepSim only, as lava does. Henchmen are spared, since their brains do not see traps yet. `traps.enabled` switches it off. The arena has none, so parity is unchanged.
- **Seen as.** `TrapView` draws an iron grate, the orange glow brightening and quickening through the warning, and nine spikes that snap up. The minimap marks tiles with an orange edge.

**Learned**

`stepSim` moves `state.time` on at the end of the step, so a step covers time to time + dt. `stepTraps` judges the strike in that window, and the view draws from the snapshot's time, the same clock.

`traps.test.ts`: over 30 seeds the tiles lie only in fight rooms and long halls, inside the walls, clear of doorways, spawn spots and the lava room, and the same each time. None on a hand-built floor. A hero on a tile loses 15% once, on the tick the warning plus the grace runs out. One beside it, or high in the air, is untouched, and the one in the air gets "Cleared". An enemy on it loses 30. The switch stops it. check 336 (was 331), parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G5's other two traps: swinging blades in halls and a collapsing floor tile. Then E1d, the Wraith, with Chill as Michael's A. G4b, the Hollow Crown's boss, waits on the question Session 100 asked.

## 2026-11-04: Session 100, mini-bosses guard the rest room (G4)

**What changed**

Michael answered G4 with A on the control room. This session builds its mini-boss half. Every floor that ends in a rest room now has one named elite. It waits in the fight room fewest doorways from the rest room (`guardRoomOf`, from the layout alone, so the server and every browser agree), and stands at that room's spot nearest the rest room. Below `miniboss.knightFromTier` (1) it is a Bone Brute, so Normal floor 1 gets a Brute. From there up it is a Barrow Knight. It has `miniboss.healthMult` (3) times its kind's health, after the portal's and the party's scaling, and a name drawn from the Crypt's six (`MINIBOSS_NAMES` in `roles.ts`, e.g. "Sir Aldous the Hollow"). Its health shows on the boss bar under that name in place of the small bar over its head. In the browser it wears a gold crown and stands 15% taller than its kind. The Warden's floor has none, and the arena never meets one, so parity is unchanged. `EnemyState.named` is optional and absent on every other enemy. `miniboss.enabled` switches it off. Both numbers are on the panel and go through the server.

**Learned**

`run.bossId` was only ever set, never reset, on a generated floor. Nothing in the sim reads it; the boss bar does. So a non-boss room now sets it to -1 before it spawns, and the mini-boss sets it after. The rooms before still clear the same way: the mini-boss is one more body in the room's count.

`miniboss.test.ts`: over 12 seeds the guard room is a fight room, never the exit or the Warden's hall, and the same each time; floor 3 of 3 has none. Normal floor 1's guard room meets one named Brute at three times a Brute's health, on the boss bar. A Hard floor 2 meets a Knight there and nobody named in another room. The switch keeps it away. check 331 (was 327), parity identical, test:net all passed, the client builds. Not yet seen in a browser.

**Next**

G4b, the Hollow Crown's own boss. Then G5 in Michael's D order: traps first. E1d (the Wraith) is ready now that Chill is answered (A: 35% slower for 3 s, no sprint).

## 2026-11-04: Session 99, a teammate's name plate that keeps its size

**What changed**

A name plate (a teammate's, a henchman's, a villager's) is sized against the camera as it is drawn (`Nameplate`, from the sprite's `onBeforeRender`, so every owner of a plate gets it without passing the camera in). Its height on screen is capped at `camera.nameplateMaxScreen` (0.06 of the viewport, about its size at the usual 5.5 m camera distance), and it fades out between `camera.nameplateFadeNear` (2.5 m) and `camera.nameplateHideNear` (1.2 m) from the camera, so a teammate standing between the camera and your hero no longer covers your hero and the enemy with their name and bar. Further off it keeps its world size and shrinks with distance as before. All three are on the panel, browser-only (the camera section). The math is `client/src/render/plateFit.ts`, pure and allocation-free.

**Learned**

The renderer takes a sprite's model matrix after `onBeforeRender`, so a scale changed there must be followed by `updateMatrixWorld` to show the same frame. At 960 x 600 the old plate was 173 px tall at 1.2 m from the camera; capped, it is at most 36 px tall and 144 px wide.

`tests/nameplate-fit.ts`, now the end of `npm run check`: near the camera (0.3 to 4 m) the plate is never taller than the cap or a fifth of the screen wide, the cap is about the plate at the usual distance, at 20 m it is untouched, and it fades between the two distances. Against the old fixed size the first check fails. check 327 plus the new check, the client builds. Not yet seen in a browser; the critic's two-browser steps will show it.

**Next**

Nothing else in E1 is the builder's: E1d waits on the Chill answer, G4, G5 and E1i are **(design)**, the snapshot item is **(Fable)**, and the late-deaths measurement needs a real machine.

## 2026-11-04: Session 98, test servers that stop when their test does

**What changed**

`bootServer` (`tests/bots.ts`) starts the server in its own process group and takes the whole group down: `kill()` signals the group, not only the tsx wrapper, and the test's exit, SIGINT, SIGTERM and SIGHUP send it SIGKILL. A test that throws, is stopped by a timeout or by Ctrl-C no longer leaves the wrapper and its node ticking on the port. Windows keeps the plain `kill()`, since it has no process groups. `tests/server-exit.ts` is the proof and now ends `npm run test:net`: a child boots the server and ends three ways (`process.exit` without `kill()`, an uncaught throw, SIGTERM from outside), and the port must stop answering within 5 s. Against the old `bots.ts` all three fail; with the fix all three pass and no `src/index.ts` process is left.

**Learned**

The clean path was never the leak: `server.kill()` in `netcode-smoke.ts`'s `finally` does stop it (the tsx wrapper passes SIGTERM on). The leak is every path that skips the `finally`, and Session 97's was one of those. `tests/gate-party.ts`, the other caller of `bootServer`, gets the same cover.

check 327, test:net all passed (smoke and server-exit), 0 server processes after.

**Next**

Nothing else in E1 is the builder's: E1d waits on the Chill answer, G4, G5 and E1i are **(design)**, the snapshot item is **(Fable)**, and the late-deaths item's remaining measurement needs a real machine.

## 2026-11-04: Session 97, Crypt rooms that split a party's attention (E1h)

**What changed**

A generated floor's fight rooms are composed by role now (`sim/roomMix.ts`, `composeRoom`), in place of Session 92 to 95's rolls for each kind.
- **Roles first, then fodder.** A big room draws `dungeon.rolesBase` (1) specialist roles from a seeded shuffle of shield, charger, leader, heavy and archer, plus `dungeon.rolesPerTier` (1) for each tier, up to `dungeon.maxRoles` (4). A room's tier is one for each difficulty past Normal and one for each floor past the first (`roomTier`). From tier 2, Shieldbearers and Hounds come in pairs where the budget allows. Bows come in pairs. The rest of the budget is grunts, with a bow now and then, and never more bows than blades. A room of grunts takes its first bow once two blades can screen it.
- **Each with its reason.** A Bone Priest is added last, and only when the room holds two or more bodies it can raise. The Barrow Knight joins big rooms from tier 1, after the roles, and only if the budget still has a pack's worth left, so a tight room gains a problem before it gains a Knight. Small and guard rooms are fodder and bows, with one Shieldbearer or Hound from tier 2.
- **Where they stand.** Each kind has a place. The front line (grunts, Shieldbearers, Brutes, the Knight) takes the nearer of the room's far spots. Bows and the Priest take the farthest spots, behind it. Hounds take the room's far end. The heroes meet the shields first and the bows behind them, and the Hounds have the room's length to rush.
- **Harder in kind.** Over five seeds' big rooms on floor 1, Normal averages 2.6 roles a room and no Knight, and Nightmare averages 4.8 roles, with a Knight in 5 of 9. Floor 3 on Nightmare averages 5.9, with a Knight in 8 of 9. G3's health and damage multiplier is unchanged. It is the portal's, and Michael's call. The arena never composes, so parity is unchanged.

**Learned**

A first group is small: a pillared room on Normal has about 7 to spend and a guard room 4. A Knight (6) placed first ate whole rooms, so it comes after the roles. The `test:net` harness leaves its server behind: `bootServer`'s `server.kill()` sends SIGTERM to the tsx wrapper, and both processes stay alive and ticking after "all passed". One left from this run's first check had grown to 6 GB in 10 minutes and held port 2599, so the second run failed with EADDRINUSE until it was killed. That is a harness bug in `tests/bots.ts` (spawn detached and kill the group, or SIGKILL after a grace). It is for the critic or the next builder run. It is not in the backlog yet.

`roomMix.test.ts`: five seeds' floors on Normal, where every room with a budget of 4 or more is a mix, a Priest only comes with two raisable bodies, and no room has more bows than blades; every kind in its place; Nightmare's big rooms hold more than one role more than Normal's and the elite, and Normal floor 1 never does; the composition stays within its budget and repeats from the same stream. check 327 (was 323), test:net all passed (after the stale server was killed), the client builds.

**Next**

E1d waits on the Chill question; with the caster in, it joins `SPECIALISTS` and stands `back` behind a shield. After it, E1i (the Warrens) is **(design)**, so the Crypt roster's builder work is done until Chill is answered. The harness leak above wants a line in the backlog.

## 2026-11-04: Session 96, the Warden's three phases (E1g)

**What changed**

The Warden fights in three phases now, behind `warden.threePhases` (on; the parity test turns it off, so the arena's slice Warden still roars once at half health).
- **Phase 2, at 60% (`phase2At`).** It roars, the banner reads "The Warden calls the dead", and skeletons rise from the edges of the hall: `summonCount` plus one a player beyond the first, spread evenly all round it, each as far out as `raiseRadius` (9 m) allows before a wall, with the Bone Priest's rise effect. Its pace stays phase 1's, so the dead are the change.
- **Phase 3, at 30% (`phase3At`).** It roars again ("The Warden rages"). Telegraphs play at 0.75x (`phase3TelegraphScale`), it moves 1.3x, and its cooldown drops to 450 ms. No second raising.
- **The rolling slam.** In phase 3, half its slams (`chainChance`) roll: the first circle is telegraphed and tracks as a normal slam, then two more land `chainStepM` (3.4 m) further along the same locked line, each with its own 500 ms orange circle (`chainTelegraphMs`). They are slams, so low: a jump clears them (M1). A stagger mid-roll ends it.
- **Announced.** The `roar` event carries the phase it begins, and `RunUi` names each one. The slice's roar has no phase and keeps "It calls for help". Every new number has a panel range.

**Learned**

`wardenPace` now gives the telegraph scale, the speed and the cooldown for each phase in one place, and `attackCooldown` reads it, so the two-phase and three-phase Wardens cannot drift apart. The rolling slam's counter is deleted, not set to undefined, when it ends, so the slice's Warden state keeps its shape and its hash.

`wardenPhases.test.ts`: the 60% roar raises the dead more than 4 m out and all round, the 30% roar quickens it without a second raising, and there is no third roar; the rolling slam lands three circles `chainStepM` apart on one line, each telegraphed, then recovers clean; switched off, it is the slice (one roar at half health, no rising, two phases). check 323 (was 320), parity identical, the client builds.

**Next**

E1h, Crypt rooms that split a party's attention. E1d waits on the Chill question. Nobody has seen the three phases in a browser yet; the gate's "one fight shows all three" wants a real Warden fight, or the critic's.

## 2026-11-04: Session 95, the Barrow Knight (E1f)

**What changed**

The elite role's first enemy, built from the Shieldbearer and the Hound. `knight` is an `EnemyKind` dressed as the elite ("Barrow Knight"), with its own numbers in `tuning.knight` (160 health, poise 18, knockback taken 0.4) and panel ranges.
- **The rush.** From 4 to 10 m it winds up a yellow lane (0.9 s, tracking for the first 60%) and rushes it at 11 m/s for up to 12 m: 20 damage and a 4 m shove to the first hero it meets. During the windup and the rush it can be hurt only from the side or behind. From the front, nothing gets through, a held heavy and magic included. A wall stuns it for 2.6 s, as a Hound is stunned.
- **Close in.** It fights as a Shieldbearer: the 130° front block (magic through it, a held heavy breaks it for 2 s) and a 16-damage bash.
- **Shared brains.** The Hound's and the Shieldbearer's brains read their numbers from the kind (`rushOf`, and the shield's section), and `eliteBrain` asks the rush first and otherwise takes the shield's step. Its turn is undone when the rush does not start, so the Knight never turns twice in a tick.
- **The look.** The Shieldbearer's tall shield and helm on a larger skeleton (1.2x), set low into the rush, with a crown of five pale-fire flames round the brow to mark it out.
- **Where it appears.** At most one a room, in bigger rooms, and only on Hard or harder, or from a run's second floor on (budget cost 6), with the same draws as before. It is named among the Hollow Crown's key enemies.

**Learned**

`noUnusedLocals` aside, TypeScript narrows `e.ai` after a `===` check, so a brain that calls another brain and then asks what state it left must cast back to `EnemyAi`.

`knight.test.ts`: the role and the brain; mid-rush, a held heavy and a bolt of magic from the front do nothing while the side and back take full damage; a sidestep after the lock leaves the hero untouched and the Knight stunned against the wall for `wallStunMs`; close in, a light from the front is blocked, magic is not, and its bash lands for `bashDamage`. check 320 (was 316), parity identical, test:net all passed, the client builds.

**Next**

E1g, the Warden's three phases. E1d waits on the Chill question. None of the four new figures has been seen in a browser yet.

## 2026-11-04: Session 94, the Bone Priest (E1e)

**What changed**

The leader role's first enemy. `priest` is an `EnemyKind` dressed as the leader ("Bone Priest"), with its numbers in `tuning.priest` and panel ranges.
- **The raising.** It keeps 8 m from the nearest hero, behind its pack, and fights no one. Every 4 s (`raiseEveryMs`) it picks the nearest fallen skeleton within 12 m (a Skeleton Warrior, Archer or Shieldbearer, not a Hound, a Brute or a boss) and chants for 1.5 s, with its arms raised and a violet circle on the remains (the magic tell and its shimmer). Then the remains stand again at half health (`raiseHp`), with Haunted's rise event and effect. A stagger breaks the chant. Killing the Priest stops it all.
- **Remains.** While a living Priest is in the room, a fallen skeleton is kept past its death time (`raisable`), so it is there to raise. Once the Priest falls, the remains go as usual. A room's clear count is unchanged: it counts the living, so the Priest holds the room and its remains do not. Under Haunted, Haunted's own rise comes first, and one the Priest has raised does not rise again under Haunted (`risen`).
- **The look.** A skeleton in a long dark robe and hood, carrying a staff topped with a skull and a violet light, in place of the warrior's sword and shield.
- **Where it appears.** One a room at most, in bigger rooms that already hold two others (budget cost 3), with the same draws as before. It is named among Emberhall's and the Hollow Crown's key enemies. The arena never spawns one.

**Learned**

The kill already resets `aiTime`, so "dead for half a second" (the Priest waits that long before choosing remains, so a body is seen to fall) is just `aiTime`. A raised skeleton killed again grants its XP again, from damage, so a Priest left alive is a slow XP source. That is worth watching in play: the answer could be no XP from a raised body, or a cap on raisings a Priest has.

`priest.test.ts`: the role, the brain and the violet tell; a warrior killed three times stands again each time at `raiseHp`, and after the Priest falls its next death is its last; the Priest keeps its distance; a raised one is never Haunted's to raise. check 316 (was 312), parity identical, test:net all passed, the client builds.

**Next**

E1f, the Barrow Knight (elite), which is the Shieldbearer and the Hound in one. E1d waits on the Chill question.

## 2026-11-04: Session 93, the Crypt Hound (E1c)

**What changed**

The charger role's first enemy. `hound` is an `EnemyKind` dressed as the charger ("Crypt Hound"), with its numbers in `tuning.hound` and panel ranges for each.
- **The rush.** It keeps 2.5 to 9 m from a hero, circling. With an attack token and a clear line of sight it winds up for 0.8 s and draws a yellow lane 11 m long along where it faces. For the first 60% of the windup the lane follows the hero, then it locks. Then it rushes the lane at 13 m/s, moving its body itself (faster than steering allows) and steering nothing. The first hero it meets takes 14, heavy, and is shoved 3.5 m (mode `hurt`); the rush ends there. A rush that meets nothing runs its 11 m and recovers.
- **The wall.** If the rush is blocked (a wall, a pillar, a step up), the Hound is stunned: a stagger cut to `wallStunMs` (2.2 s), with the stagger's damage bonus and the dizzy stars. That is the punish window, so a sidestep after the lane locks is the answer, ideally with a wall behind you.
- **The look.** A long, low dog skeleton: spine and ribs, four legs, a long skull with the burning eyes and a hanging jaw, a tail. It is built on the body, not on the biped rig, whose limbs are made and hidden so the shared update has something to pose. Its legs do not walk yet.
- **Lines on the ground.** `TelegraphView` now draws a body's own line (the Hound's rush and the Shieldbearer's bash) as a lane on the ground about a body wide, widening as it fires. An archer's line is still the aim line at bow height.
- **Where it appears.** Bigger rooms on generated floors may roll one or two (budget cost 2), with the same draws as before, so seeds build the same floors. It is named among the Saltmarsh Warrens' and the Hollow Crown's key enemies. The arena never spawns one, so parity is unchanged.

**Learned**

A stagger's length is `combat.staggerMs` for everyone. Starting the stagger with `aiTime` set to `staggerMs - wallStunMs` gives the wall stun its own length and reuses everything else the stagger does (poise refill, the views, the damage bonus) without a new state. The arena's middle has pillars, so a test rush is set up along the open edge.

`hound.test.ts`: the role, the brain and the yellow tell; the windup draws a lane `chargeLength` long, and a hero standing in it takes `chargeDamage` and is staggered; a sidestep after the lock leaves the hero untouched and the Hound stunned against the wall for `wallStunMs`; a rush into open floor runs its length and recovers. check 312 (was 308), parity identical, test:net all passed, the client builds.

**Next**

E1d, the Wraith (the caster), which needs Chill, its first state. Neither new figure has been seen in a browser yet (this box draws in software GL); the critic's next run should look at both, and the Hound's legs want a gait.

## 2026-11-04: Session 92, the Skeleton Shieldbearer (E1b)

**What changed**

The Crypt's first new enemy and the first new role brain. `shieldbearer` is an `EnemyKind` dressed as the shield role (`KIND_ROLE`, "Skeleton Shieldbearer" in the Crypt's roster), with its numbers in `tuning.shieldbearer` and panel ranges for each.
- **The shield.** In `damageEnemy` (`shieldTakes`), a hit whose push comes at its face inside `guardArcDeg` (130) is blocked: no damage, no poise, a short hitstop and a `guarded` event, which draws a pale deflect spark and plays a dull knock. That covers swings, arrows and henchmen alike. Its side and back are open. Magic (the staff) goes through the shield. A held heavy (C1, a charged string step) breaks the guard (a `guardBroken` event, an orange spark and a low crack) and lands, and the front stays open for `guardBreakMs` (2.5 s). A light chain's own finisher is still blocked, so tapping at its face does nothing. A staggered or frozen Shieldbearer is open too. Because it is judged in `damageEnemy`, the browser's prediction of its own swing agrees with the server.
- **The bash.** It walks its shield in (2.6 m/s), turning slowly (140°/s against a Skeleton Warrior's 420, and 50°/s while winding up), so a hero who circles it reaches its side. In range, with an attack token, it draws a red line 2.6 m ahead for 0.7 s, then bashes that line: 12 damage, heavy, so the hero is staggered and shoved 2.2 m.
- **The look.** The Skeleton Warrior's figure with its round shield grown into a tall one (shin to skull) and a rusted helm; the shield is held square in front, drawn back in the windup and driven forward in the bash.
- **Where it appears.** Bigger rooms on generated floors may roll one, at most two a room, at a budget cost of 3. That uses the same random draws as before, so a seed builds the same floor and rooms, with some grunts and archers now Shieldbearers. This holds until E1h composes rooms by role. It is named among the key enemies of the Saltmarsh Warrens, Emberhall and the Hollow Crown. The arena never spawns one, so the parity hashes are untouched.

**Learned**

`damageEnemy`'s return value is ignored by every caller, and each swing remembers who it hit (`attackHitIds`), so a blocked hit can return true and still count as contact without the swing hitting again on the next tick. A hit's push direction (`dirX`, `dirZ`) is set for melee and projectiles alike, which made it the simplest measure of "from the front".

`shieldbearer.test.ts`: the role and brain, the Crypt's name and a red tell; a three-hit chain from the front blocked (finisher included) while the same hit from the side and from behind lands; an arrow from the front blocked and a bolt of magic not; a held heavy breaks the guard and lands, the front stays open until `guardBreakMs` runs out, then blocks again; the windup draws its line and the bash takes exactly `bashDamage` and staggers the hero (mode `hurt`). check 308 (was 302), parity identical, test:net all passed, the client builds.

**Next**

E1c, the Crypt Hound. Not looked at in a browser on this box (headless software GL); the critic's next run will see whether the shield reads from the front and the bash's line is clear.

## 2026-11-04: Session 91, a harder portal's enemies hit harder (G3)

**What changed**

A portal's difficulty now makes every enemy on its floors tougher, not only more of them (Michael, 2 Nov: the story dungeons were "very very easy"). `createEnemy` multiplies an enemy's health by the difficulty's own `DIFFICULTIES[].mult` (Easy 0.75, Normal 1, Hard 1.5, Nightmare 2, Legendary 2.5) and keeps it as `EnemyState.hitMult`, which the grunt's slash, every shove (the Bone Brute's slam, the Warden's sweep and slams) and an archer's arrow multiply their damage by. The room budget's scaling stays as it was, so a Nightmare room has twice the enemies, each with twice the health and twice the bite. Floors only (the multiplier comes from the floor's `FloorSpec.difficulty`), set on the server where an enemy is made, and behind `tuning.dungeon.difficultyScalesEnemies`; the arena never sets it and `hitMult` is left off the state at 1, so the parity hashes are untouched. The story dungeons' difficulties are unchanged: the Old Cellar, Mossgate and the Saltmarsh Warrens at Normal, Emberhall and the Hollow Crown at Hard, which already steps up along the list with the first at Normal and the last two at Hard; the Hard two now bite at 1.5x. Raising any of them further would also lock it behind a higher shrine, since the shrine caps a story dungeon's difficulty as it does a random one's.

**Learned**

A freshly joined hero is invulnerable for a moment (`invulnTime`), so a test that wants a hit to land clears it first. `npm run test:net` left its dev server running on 2599 after the setup run, and the next run failed with EADDRINUSE until it was stopped; worth knowing before reading a red test:net as a regression.

`difficultyScale.test.ts`: the same seed's grunt has twice the health and twice the slash on Nightmare as on Normal; Easy, Hard and Legendary follow the list and no difficulty reads as Normal; the switch off scales nothing, and the arena's enemies carry no `hitMult`. check 302 (was 299), parity identical, test:net all passed.

**Next**

E1b, the Skeleton Shieldbearer. Michael may want a story dungeon past Hard (the Hollow Crown at Nightmare); that is a one-number change in `STORY`, but it raises the shrine tier that opens it.

## 2026-11-03: Session 90, E1a's question answered (deep-work session)

**What changed**

Michael answered the one question E1a left (decisions.md, "Which story dungeon is which dungeon type?"): **A**, all five story dungeons are Haunted Crypts for now, with the Old Cellar's and the Saltmarsh Warrens' words rewritten to the dead, which is how Session 89 built it. No code changed; the question moved to Answered with his line, the backlog item says so, and the branch goes to review.

**Learned**

Building the recommended answer before asking cost nothing here: the answer needed no second pass.

**Next**

Review and merge of PR #150. Then E1b, the Skeleton Shieldbearer, the first new brain.

## 2026-11-03: Session 89, enemy roles and dungeon types (E1a, deep-work session)

**What changed**

The groundwork for the Crypt roster (card `fable/e1a-roles`, branch `auto/fable-e1a-roles`). Nothing a player fights changes; the parity hashes are identical, not re-recorded.
- **Roles.** `shared/src/sim/roles.ts`: the eight roles of the design doc plus `boss`, `KIND_ROLE` (grunt fodder, archer archer, brute heavy, Warden boss), and `ROSTERS`, a dungeon type's names for its kinds. `enemies.ts` steps each enemy through `brainFor(kind)`, its role's brain (`ROLE_BRAINS`); the role, not the kind, now decides who gets up armoured (G1), who never rises again under Haunted, and whose body gives way when pushed. Shield, charger, caster, leader and elite have no brain yet: each arrives with its first enemy (E1b to E1f), and the unit test fails if a kind is dressed as a role with none.
- **The colour language.** `telegraphColour(e)`: red a strike (a Skeleton Warrior's cut, the Warden's sweep), orange heavy (the Bone Brute's and the Warden's slams, anything armoured after a stagger), yellow a projectile or charge (the archer's line, which was red), violet magic (nothing uses it yet). `TelegraphView` draws in it and `Sfx` plays a sound a colour: the slice's growl for a strike, a low growl and rumble for a heavy, a rising whistle for a shot, a shimmer for magic. So the Brute's slam circle is orange now and the archer's line yellow.
- **Dungeon types.** `shared/src/level/dungeonTypes.ts`: the design doc's eight, only the Haunted Crypt open. `DungeonType` is optional on `RunPlan`, `FloorSpec` and a random `PortalChoice`, absent meaning the Crypt, so old saves, hand-built dungeons, the arena and a browser from before all read as the Crypt. `readPortalChoice` (so `validate.ts`) refuses a locked or unknown type; `readRunPlan` ignores one. The type names the run and never touches the generator.
- **Wren's tab and the ring.** The Random tab's Theme row (nine made-up themes) is now "Dungeon type": the eight, the Crypt open, the shared three "not yet", the regional four "Verdant Vale only" and so on, dimmed; left and right move among the open ones, a click works too. Each story dungeon has its type (all five the Crypt, decision pending) shown on its card, and its key enemies by the Crypt's names (Skeleton Warriors, Skeleton Archers, Bone Brutes). The ring's words say it: "A small Haunted Crypt, 2 floors, Normal", "Mossgate Barrow, a Haunted Crypt"; arriving on a floor, "Haunted Crypt, floor 1 of 3".

**Learned**

The parity hash is the JSON of the whole state, events included, so a telegraph event cannot carry its colour without moving the golden hashes; the sound looks the enemy up in the drawn world instead, with the growl when it is not there. A `FloorSpec` echoes into the floor it builds (`FloorDef.spec`), so "the same floor" in the test is everything but that echo. `roles.test.ts`: every kind resolves to its role's brain, the Crypt's names, the colours, eight types with one open, three seeds built the same with and without a type, story types carried to every floor and over the ring, a locked type refused from a browser and ignored from create options. check 299 (was 290), parity identical, test:net all passed. The lag lab here (60 s a condition, headless pages at 6 to 7 fps, so the numbers measure this box) against main on the same box: corrections a minute 166 / 179 / 200 / 152 at 0, 50, 150 ms and the loss row (main 154 / 128 / 176 / 165), holds 8 / 5 / 7 / 9 (main 5 / 4 / 10 / 8), view lag within 40 ms of main's; one snap at 0 ms on the branch was Alpha going down (hp 0, a down), none from the network. Nothing in the netcode moved, and the spread between the two is the box's. The first lab run timed out at "Bravo joined", Vite's cold start as before.

**Next**

Michael's answer on which story dungeon is which type (decisions.md, Pending; built as A). Then E1b, the Skeleton Shieldbearer, the first new brain.

## 2026-11-03: Session 88, henchmen harder to get

**What changed**

G2, Michael's call on henchmen (2 Nov: the same strength, harder to get). `tavernHenchmen` is now none at tier I, then one a tier (1, 2, 3 at II, III, IV), and `village.hireCoin` is 150 (was 60, on the panel). At tier I Old Fenn's card shows "Hire companions" blocked with "Hire from tier II", the hire screen says the same if reached, and the tavern's words at tier I are "a fire and a bed; henchmen for hire from tier II". The server's `onHire` already capped by `tavernHenchmen`, so it refuses a hire at tier I with no change of its own. Their fighting is unchanged, and a village saved before keeps the henchmen it has hired: only a new hire is checked.

**Learned**

The netcode smoke's tavern steps now walk the new rule: no hire at tier I, one at II, two at III (tuning tier III's lumber and stone to nothing for that one raise, since the test village has spent its own), and Hale's village, which hires the henchman that follows the party through every ring, starts with its tavern at II. `test:net` all passed.

**Next**

G3, difficulty that hits harder; then the E1 roster once E1a's deep-work session lands.

## 2026-11-03: Session 87, Brutes and the Warden get up armoured

**What changed**

G1, Michael's call on boss poise (2 Nov): a Brute or the Warden getting up from a broken stagger has `combat.postStaggerArmourMs` (4000, panel 0 to 10000) of hyper-armour, `EnemyState.armour` (seconds left, optional, gone when it runs out). While it lasts a hit still does damage but drains no poise, pushes nothing, freezes nothing and cannot flinch it; a parry stops the blow but does not stagger it or drain the Warden's poise; a launched corpse does not stagger it. So an attack it winds up always comes out. Its telegraphs draw orange instead of red while armoured (`TelegraphView`), the colour language's heavy. Grunts and archers are unchanged. `combat.postStaggerArmour` is off in the parity test (hashes unchanged).

**Learned**

The armour counts down only on ticks the enemy is not in hitstop, so a flurry of hits stretches it a little (each heavy adds its hitstop); the panel value is the floor of the window, not the ceiling. `sim/staggerArmour.test.ts`: a Brute and the Warden broken, risen, hit five times (hurt, poise untouched, not staggered, not pushed), then broken again once the armour is gone; a grunt and a switched-off Brute rise without it.

**Next**

G2, henchmen harder to get; G3, difficulty that hits harder.

## 2026-11-03: Session 86, measuring the crowded fight

**What changed**

The gate evening's third bug (Michael, 2 Nov: "slightly delayed death animations and drop spawns after destroying boxes" with henchmen in a crowd) says measure first. Measured the server with a throwaway probe (not committed): the arena, one hero and three henchmen (sword, bow, staff), 24 enemies placed and the waves left to add more, 1200 ticks.
- `HostSession.tick`: 0.8 ms median, 1.8 ms p95, 2.6 ms p99, 10 ms worst, against 16.7 ms a tick. The server keeps up with 55 live enemies.
- The snapshot (`SimState` as JSON): 46 KB, of which enemies are 37 KB (about 670 bytes each) and the four players 6 KB (a henchman about 1.7 KB, its brain included). The netcode notes' "about 5 KB" was a party of four mid-wave in the slice.
Docs only: the numbers are on the backlog item, which stays open, and a new **(Fable)** item asks for snapshots that stay small in a crowd, since a change to what a snapshot carries is netcode.

**Learned**

A death, a smash's spray and a drop are server-only and drawn when the drawn clock reaches them, so on the hosted build they always show a round trip plus 80 to 150 ms after the blow; with 46 KB snapshots on a home connection, any queueing adds to that. Headless Chromium here runs software GL at about 9 fps, so the browser side (frame rate, how far behind the drawn clock runs) needs a real machine.

**Next**

G1, armour after a stagger; then G2 and G3.

## 2026-11-03: Session 85, the d-pad moves in the hero screen

**What changed**

The gate evening's bug (Michael, 2 Nov): on the hero screen the d-pad changed tabs (left, up, right were the three tabs) instead of moving the cursor. Now, on a pad only:
- **The d-pad moves the cursor** in the bag, the worn slots and both boards, with the stick's repeat (`menuUp`/`Down`/`Left`/`Right`, buttons 12 to 15, read as held in `EquipScreen.handle`). Off the screen they are still zoom, drink and the map, which already wait while it is up.
- **LB and RB step through the tabs** (`tabPrev`, `tabNext`), round from the first to the last; they are also ability 1 and 2, so the screen reads them first and nothing else happens on that press.
- **X drops** (or takes a rank off, or unslots) and **Y twice resets a board**, the jobs LB and RB had; the two-press reset of 30 Oct is kept, on Y. The hints and the controls table say so.
The keyboard is unchanged: 1 to 3 for tabs, Q drops, E twice resets. The new pad-only actions have no keys.

**Learned**

`tests/padmenus.e2e.ts` has a new test that presses each pad button through the screen's handler with exactly the actions `gamepadBindings` gives it (imported from Vite in the page). Holding a stand-in pad's button and polling the screen was flaky in headless Chromium here (a press sometimes not seen within 5 s), so the handler is driven directly, as the first pad test does. A cold first run of the file can time out the existing B test too; it passes warm.

**Next**

Late deaths and drops in a crowd (measure first), then G1 to G3.

## 2026-11-03: Session 84, bodies and heroes stay inside the walls

**What changed**

The gate evening's bug (Michael, 2 Nov): skeletons knocked behind a wall rose there on Haunted, and a hero attacking one through the wall snapped out after it. Under one switch, `combat.sweepFastMoves` (on; the parity test turns it off):
- **A knockback or launch slide stops at the wall.** `sweptDistance` (`level/geometry.ts`) casts a probe of half the body's radius along the tick's move and cuts the move at the first movement-blocking collider; `stepEnemies` uses it on `kbx`/`kbz` and drops the slide where it meets stone.
- **So does a hero's lunge**, in `stepPlayer`'s attack step, which prediction runs too, so the server and the browser cut it at the same point.
- **Soft targeting picks only what the hero can see** (`pickSoftTarget`'s chest-to-chest line, walls and pillars blocking), for attacks and abilities alike; a lock-on still takes its target, and its lunge stops at the wall.
`sim/sweptMoves.test.ts` puts a 0.2 m wall in the arena: a warhammer heavy's launch tunnels through it with the switch off and stops short with it on; a sword swing at a grunt behind it takes no soft target, and a locked one never carries the hero past it. The free-aim test's archer had stood in the antechamber with its grunt behind the antechamber's wall; it now stands in the arena.

**Learned**

A launch starts at about 45 m/s (5 m against a friction of 9; 67 m/s with the warhammer), so a corpse moves 0.75 to 1.1 m in its first tick, more than a body's radius plus half a thin wall, and `resolveCircle` then pushes it out of the far side. The probe is half the body's radius so a body resting against a wall after `resolveCircle` is not already touching it and can still slide away. The item's safety net (put back a body found outside the walkable area) was not built: `pieceAt` returns -1 inside a doorway as well as outside the floor, so it cannot tell them apart, and with the cause gone it is only worth adding if a body is seen outside again.

**Next**

The D-pad on the hero screen, then the crowd measurement, then G1 to G3.

## 2026-11-02: local session, the Phase 2 gate evening filed, and the builder's lock on a branch

**What changed**

Michael played the gate evening solo with three henchmen on the hosted build and passed it ("Pass; bugs first"). Filed in `playtest-notes.md` with his notes against the three gate questions. Four of the notes changed rules already built, so they were asked in chat (decisions.md, "After the Phase 2 gate evening"): the gate passes; Brutes and bosses get about 4 s of hyper-armour after a stagger; henchmen keep their strength but are harder to get (none at Tavern tier I, one a tier after, more coin), which was not the recommendation; and each difficulty also multiplies enemy damage and health. The backlog closes Phase 2 and makes the E1 section current. Three bugs are under Found in play (bodies and a hero through walls, the D-pad on the hero screen, late deaths and drops in a crowd), then G1 to G3 for the three calls and G4 and G5 (a boss for every story dungeon, more dungeon styles and features) as design items.

The builder's lock: its tag push had been refused (HTTP 403) on every run since 31 Oct, because the cloud's git proxy refuses tag pushes and lets `auto/*` branch pushes through. The builder routine's prompt now takes the lock as the branch `auto/builder-lock`, a chain of empty commits saying `taken` or `released`, moved only by fast-forward pushes, so of two runs racing, the second is refused as non-fast-forward. CLAUDE.md's builder line says so.

**Learned**

Michael's own diagnosis of the skeleton behind the wall: on Haunted an enemy knocked outside the play area rises there. Reading the code: a dead enemy's knockback slide and a hero's lunge both move a body far in one tick, and `resolveCircle` afterwards can push it out on the far side of a thin wall; the lunge also takes a soft target with no line-of-sight check, which is how he was pulled through after it. Difficulty today only adds enemies (`DIFFICULTIES[].mult` on a room's budget), which with +10 health a level is why story dungeons felt "very very easy".

**Next**

The builder takes the three Found-in-play bugs, then G1 to G3, once this branch is on main (until then it still sees Phase 2 as current and the gate unrecorded). E1a is **(Fable)**: the producer cards it for Michael to start. The builds pass, G4 and G5 are design items to ask.

## 2026-11-02: Session 83, the shut gate's words read whole

**What changed**

The critic's bug (2 Nov, fae1ee7): the words over a shut rest or boss gate sat 0.6 m above the gate, inside the 1.3 m of wall over the 3.2 m doorway, so only "Clear" stood out of the stone. `FloorView` now hangs them inside the doorway, 0.7 m under the lintel, sized to fit nine tenths of the doorway's width (0.45 m tall at most), drawn over the bars rather than cut by them, and shown only within `look.exitLabelRange` (14 m, on the panel) of the gate, since they now draw through walls. Client and look only.

**Learned**

Checked by eye in headless Chromium on seed 4242's floor 1, standing at the gate head-on and turned half a radian: "Clear 1 more fight room" reads in full from both. A sprite in a doorway's plane with the depth test on would fight the bars for every pixel, so depth testing is off and the range keeps it from showing through other rooms.

**Next**

Phase 2's list is the builds pass (waiting on the feel pass being played) and Michael's gate evening.

## 2026-11-02: Session 82, the smoke walk reaches the rest room again

**What changed**

The critic's bug (2 Nov, fae1ee7): the smoke e2e's floor walk ("the rest room's ring home") had timed out at 120 s since Session 71's exit lock, because seed 4242's way to the rest room passes no fight room, so the gate never opened. The test now tunes `dungeon.clearsBeforeExit` to 0 with the small floor and puts it back to 1 afterwards. Test code only.

**Learned**

The walk now passes in 1.4 min on this box. Session 80's note that this test timed out "with or without the change" was this lock, not the box.

**Next**

The locked exit's words that read only "Clear".

## 2026-11-01: Session 81, buildings that look their part

**What changed**

Michael's A on "Buildings that look their part" (1 Nov): a look for each building within today's four tiers, one step at tier III, marble waiting for tiers past IV.
- **Each its trade from the first build** (`VillageView.buildTrade`): the Storehouse sits squat on a 1.5 m stone footing with an iron-banded door, barred windows and a gold coin on a bracket; the General Store has a red-and-cream awning on two posts over its shopfront, a window either side and crates and a barrel out front; the Tavern has the Rusted Stag's hanging sign on an iron arm, lit windows and a chimney.
- **The step at tier III** (`buildingLook` in `game/villageSave.ts`, the one table the views read; `villageLook.stepTier`, 3, on the panel): the Storehouse's timber gives way to dressed stone with pale quoins up each corner; the Store gains dormers (rooms upstairs) and a chimney; the Tavern a stone ground floor with quoins, dormers and a second chimney. The step shows with the tier's reveal, so an upgrade ceremony to III raises the scaffold over the old look and takes it down on the new one.
- Client and look only: no collider, door or server change; the shrine is untouched.

**Learned**

Everything added stays inside each building's footprint (dormers on the slopes, not a wing), so the village's colliders, doors and the scaffold's size need nothing. Checked by eye in headless Chromium at tiers I and III from two angles. A `test:net` run that is killed leaves its server on port 2599, and the next run fails with EADDRINUSE until it is stopped.

**Next**

Phase 2's list is now the builds pass (waiting on the feel pass being played) and Michael's gate evening.

## 2026-11-01: Session 80, the gold ring home pays the browser again

**What changed**

The critic's bug (1 Nov, auto/build 46f3070): the gold ring banks as it fires, so its `banked` event rides the snapshot just ahead of `handoff`, and the browser holds server events until the drawn time reaches them (80 to 150 ms). `ClientSession.leaveRoom` emptied that inbox, so the coin, the banking of carried finds, the bag's lumber and stone and the run tally were all lost, and arriving in the village then threw the still-carried finds away as unbanked. Now `leaveRoom` keeps the old room's undrawn events that the save reads (`keptAcrossHandoff`: banked, findsLost, bagLost, pickup, lootTaken, levelUp, potions, runWon, runLost) with the player's id there; `Game.update` takes them (`takeDeparted`) before it rebuilds for the next room, so the bank lands before the village's arrival forgets unbanked finds. `progress` takes the id and runs without a hero between rooms. Effects (hurts, sounds) of the old room are still dropped. Check 9d in `test:net`: an undrawn `banked` and `heroHurt` at the hand-off leave only the `banked`, once.

**Learned**

The smoke e2e's floor walk ("the rest room's ring home") times out at 120 s on this box with or without the change, so a coin assertion there could not be proven here and was left out; the check sits in `test:net` against the real `ClientSession` instead. The last few seconds of XP before a hand-off are still not synced into the save (the hero is gone by then); the 5 s save timer usually covers it.

**Next**

Phase 2's other items wait on Michael: "Buildings that look their part" and character creation (both pending), then the gate playtest.

## 2026-11-01: Session 79, character creation asked: Phase 2 or Phase 4

**What changed**

Docs only. Phase 2 had nothing buildable: "Buildings that look their part" is still pending, the builds pass waits on the feel pass being played, and the gate is Michael's. The last open item, character creation with the intro and the tutorial (Michael, 30 Oct, marked "likely Phase 4"), had never been asked, so it is now under Pending in `decisions.md` with three options (A, move it to Phase 4, recommended). check 281/281, test:net all passed on the base.

**Learned**

Races would be the first thing to change the fight per hero rather than per weapon or gear, so whichever phase takes them, their numbers go behind a switch the parity test turns off, as gear's did.

**Next**

Build "Buildings that look their part" when it is answered; move or build character creation by the answer. After that Phase 2's list is the gate playtest.

## 2026-10-31: Session 78, drop a stack of lumber or stone, and the bag-full word

**What changed**

The rest of Session 73 (Michael's A on "Lumber, stone and potions in the bag"), and one hole in it closed.
- **The hole:** lumber and stone still lying on the floor banked anyway (`runPurse` counted all the spray on the ground), so a full bag cost nothing. With `loop.materialsInBag` on, only coin left lying banks; lumber and stone go home only in a bag. A deeper ring leaves them too.
- **Drop a stack:** on the hero screen a lumber or stone cell takes Q, LB or the Drop button, as a find does. The browser takes the stack out and sends `dropMats` (kind, 1 to 99, checked in `validate.ts`); `dropMaterials` in `sim/smash.ts` lays it as one pile at the hero's feet, out of the party's found tally (then the purse from the floors before), capped by what the run has found and by a stack. The browser re-sends its loadout so the server knows the room. The one who dropped it takes it back only once they have stepped 1.8 m away (`FloorLoot.waitAway`), and a pile goes into a bag as far as its room allows, the rest staying on the floor.
- **The bag-full word:** standing on lumber or stone the bag has no room for, the floor's prompt says "Your bag is full: the lumber stays on the floor · I to drop a stack or a find". The browser works it out from its own bag; the server still decides every pickup.
- Tests: four in `sim/bagRoom.test.ts` (the drop and the wait, a pile taken in part, the caps, lying lumber not banked, the message's check); `smashLoot.test.ts`'s rest-room case now expects the lying lumber to stay. check 281/281, test:net all passed.

**Learned**

`runPurse` counting the ground's spray was written for D4, when everything picked itself up; Session 73's "a full bag leaves it on the floor" needed that rule turned off with it, and no test caught it because both were right on their own.

**Next**

Phase 2's builder items are done. Left: the builds pass (**(design)**, cut after the feel pass), "Buildings that look their part" (asked this run in `decisions.md`), character creation (likely Phase 4), and the gate playtest.

## 2026-10-31: Session 77, the gamepad's default layout

**What changed**

Input and the screens that name the buttons. Michael's A on "The gamepad's default layout" (control room, 31 Oct): his layout exactly.
- `bindings.ts`: RT attacks (a hold is the heavy, as before); X is the off-hand's ability (RT's until now); Start pauses; d-pad right opens the map (the village from above, or the floor's corner and whole). LT block, LB and RB the abilities, the stick clicks, Y, B, A, View and the d-pad's up, down and left are as they were.
- A new `pause` action (Start; the keyboard's pause stays Esc): Start opens the pause card with its settings when no screen is up, and Start, A or B closes it. The map waits while a screen or the pause card is up, so d-pad right stays the hero screen's third tab there.
- The hero screen's "wear at once" follows attack to RT ("J or RT"), as do the stash's and the tavern's quick actions; the controls list, the village map's header and Fenn's "let go" say so.
- Tests: a pad e2e case (a stand-in pad: Start pauses and resumes, d-pad right opens the village map and B closes it, RT starts a swing); the earlier pad case still passes. check 277/277.

**Learned**

Two actions on one button work when one of them waits for the screen it belongs to: d-pad left was already drink and the first tab, and d-pad right is now the map and the third.

**Next**

Phase 2's builder items are done: what is left is the builds pass and "buildings that look their part" (both **(design)**, not yet asked), and the gate playtest. Left from this run: a Drop for a lumber or stone stack, a "bag full" word over materials left on the floor.

## 2026-10-31: Session 76, Wren's Random tab opens at Portal tier III

**What changed**

Wren's portal menu and the village room. The second half of Michael's A on "The village's start and the Random tab" (control room, 31 Oct).
- `randomOpen` in `game/portalChoice.ts`: the Random tab opens at `village.randomFromTier` (3, panel 1 to 4). `VillageRoom.onPortalChoice` refuses a random choice below it, so the lock is the server's.
- `PortalScreen`: the Random tab is still there to look at, dashed and dimmed, and shows "Opens at Portal tier III" and how to get there; F does nothing on it. The story dungeons are as they were. Every village today has a tier I shrine, so Random is shut for everyone until a shrine is raised twice.
- Tests: `randomOpen` by tier in `game/plots.test.ts`; the netcode smoke test's village has a tier III shrine, and the refused difficulty is now Legendary. check 277/277, test:net all passed.

**Learned**

Nothing new; the shrine's cap on difficulty already showed how the menu and the room share one rule.

**Next**

The gamepad layout (Michael's A: RT attacks, X the off-hand, Start pauses, d-pad right the map).

## 2026-10-31: Session 75, empty plots, part two: the village starts with only the portal

**What changed**

The browser, and `village.startWithPlots` turned on. Michael's A on "The village's start" (control room, 31 Oct).
- A browser with no village yet starts one with Wren's portal and three empty plots; a village saved before today keeps its buildings (`Profile.loadVillage`, and a P1-era save is read as built).
- `VillageView`: each building's meshes are one group, hidden at tier 0, and a plot is drawn in its place: the footprint's turned earth, a stake at each corner with a rope between, and a board on a post by where the door will be ("General Store: a plot"). The ceremony for a first build raises the scaffold over the plot and reveals the building, as any tier does.
- The keeper waits on the plot, 2 m out from where the door will be (`plotSpot` in `level/village.ts`, `VillageView.keeperSpot`), until the first build is revealed, then keeps the counter inside. Talking finds them there.
- Their card says "This is where the General Store will stand. Raise it for 10 lumber and 8 stone, and I'll open: ..." and offers only "Build the General Store" and Leave; the path shows tier I's price; Confirm reads "Confirm: build the General Store". Their menu never opens at a plot. The village map shows "plot" and what tier I brings.
- A Storehouse still a plot keeps the base pocket of 3 (not 0, as part one had it), so a new hero's first wipe never takes the bow and staff they started with.
- Tests: a smoke e2e case (a fresh browser's village is the shrine and three plots, Aldous waits out on the square, his card offers only the build); the netcode smoke test's villages are saved as built, as they walk into the store and the tavern. check 276/276, test:net all passed, the new e2e and the solo e2e passed.

**Learned**

Hiding a building's group and showing a plot's keeps the ceremony as it was: holding the tier on show at 0 until the reveal gives a plot under scaffolding, then the building.

**Next**

The Random tab at Portal tier III (the same answer), then the gamepad layout.

## 2026-10-31: Session 74, empty plots, part one: the rules

**What changed**

Shared village save, the sim's doors, the village room. Michael's A on "The village's start and the Random tab" (control room, 31 Oct): a new village is Wren's portal and empty plots for the other three, each raised by a first build; the Random tab opens at Portal tier III. This session is the plots' rules, behind `village.startWithPlots` (off), so nothing changes in play until part two draws them.
- `villageSave.ts`: tier 0 is an empty plot, allowed for all but the shrine (`minTier`); `emptyVillage` starts the store, storehouse and tavern at 0 with the switch on; a save that leaves a tier out had it built, so an old village keeps its buildings. A plot gives nothing (`storeStock`, `stashSpaces`, `pocketSpaces`, `tavernHenchmen`, `henchmanCap` all 0) and says "an empty plot, waiting to be built"; its first build costs `village.plotLumber` (10), `plotStone` (8) and `plotCoin` (0), on the panel. `plotsOf` lists them.
- `SimState.plots`, set by `VillageRoom.settlePlots` from the save on the first hello and every build: `stepDoors` leaves a plot's front door shut (`doorBuilding` in `level/village.ts` finds a door's building). `VillageRoom` refuses buy and sell at a plot's store; the Tavern's hires were already capped by tier.
- Tests: `game/plots.test.ts` (4: the start, reading saves, the first build's price and what a plot gives, a plot's door). check 276/276; test:net all passed (on the second run; the first lost a bot walking to Wren, with three orphaned smoke servers on the box).

**Learned**

Keeping the building's collider on a plot keeps the world's colliders the same for prediction and the server, so a plot can be a fenced, marked footprint and nothing in movement changes. In this box the smoke test leaves its server running after it passes, so each later run needs another port.

**Next**

Part two, the browser: draw each plot (a fenced footprint and a sign) instead of the building, the keeper waiting on it whose card offers only the build, the map and the store, stash and tavern menus closed at a plot; then turn `village.startWithPlots` on. Then the Random tab at Portal tier III.

## 2026-10-31: Session 73, lumber and stone in the bag

**What changed**

Shared sim, the loadout, the bag and the hero screen. Michael's A on "Lumber, stone and potions in the bag" (control room, 31 Oct): materials in the bag in stacks of 50, picked up by whoever walks over them, a full bag leaves them on the floor; potions stay on the belt, coin stays a count.
- `sim/bagRoom.ts`: `BagRoom` (empty spaces past the pocket, room left in the part-filled lumber and stone stacks), `bagRoomOf`, `roomFor`, `materialSpaces`. The bag is the browser's until Phase 3, so the browser sends its room on the loadout (`Loadout.bagRoom`, checked whole in `readLoadout`: at most `BAG_SIZE` spaces, a stack's room) and the server spends it: `stepLoot` hands a piece of lumber or stone only to a hero whose bag has room (`PlayerState.bagRoom`), and a carried find takes a space (`spaceTaken` in `stepDrops`). Coin is taken as before. A browser that sends no room is not limited, so bots and the arena are unchanged.
- `loop.materialsInBag` (on) and `loop.bagStack` (50, panel 10 to 99).
- The run's count is unchanged: what is picked up still adds to the party's `found`, carried floor to floor and banked into the run's village at the gold ring home; a wipe loses it.
- `Profile.mats`: the lumber and stone the browser was handed (`lootTaken`), filling the bag's last empty spaces past the pocket, a stack a space; finds, a piece taken off and a stash move into the bag count those spaces as full (`gearRoom`). The bank and a lost bag empty them (`takeMaterials`).
- The hero screen draws each stack (wood or grey, its count) and says it goes to the village at the gold ring home; "N of 28 spaces free" counts them.
- Tests: `sim/bagRoom.test.ts` (6: stacks, a full bag leaves lumber, coin still taken, two units of room take two, a new stack of 50, the loadout's check). check 272/272, test:net all passed.

**Learned**

The server never needed the bag itself, only its room: the browser states it, the server spends it piece by piece, so "is there room" stays the server's call within the accepted Phase 2 exception, and a loadout sent mid-floor re-states it from the real bag. The baseline test:net left its dev server running on port 2599 in this box, so the change's test:net ran the same script on 2619.

**Next**

Not in: a Drop for a stack on the hero screen (to make room for a find mid-run), a "bag full" word over lumber left on the floor, and materials left in a save by a tab closed mid-run (they wait for the next bank or wipe and are then dropped uncounted). Then empty plots with Random at Portal tier III, then the gamepad layout.

## 2026-10-31: Session 72, the Warden's drops and the way home

**What changed**

Shared sim and portals, the run's corner. Michael's A on "The boss's drops and the way home" (control room, 31 Oct), with his note: "a small delay on the ring appearing as well, with a countdown timer ... like a 10 second count".
- The Warden's hall drops `bossDropCount` rares a player (Easy and Normal 1, Hard 2, Nightmare and Legendary 3, at most `loop.bossDropsMax`), a step apart, each of a material from `loop.bossDropMinTier` (IV) up: `rollGear` and `spawnDrop` take an optional `minTier`, so every other roll is unchanged. Cursed's extra drop stays.
- The Warden's fall no longer banks at once, which would have swept the drops into the bags (option B). The drops lie on the floor and the gold ring banks the whole run as it is taken (`leaveFloor`), as a rest room's does.
- `portalsFor`: on a won floor the ring waits `loop.homeRingDelayS` (10 s) after the fall, then opens `loop.homeRingOffset` (8 m) from where the Warden fell, toward the hall's middle (or its doorway), kept off the walls. `homeRingIn` gives the count.
- `RunUi`: no Victory card over a won floor. "Dungeon cleared · 4:12 · the way home opens in 7" in the top-right corner under the timer, then "the gold ring home is open" for 4 s. The run's summary still greets the party in the village. A wipe keeps its card and its button home.
- Tests: the Warden test waits out the count, finds the ring in the hall at least 5 m from the fall, and one tier IV+ rare each at Normal; `bossDrops.test.ts` for the count by difficulty. check 266/266, test:net all passed.

**Learned**

Michael's A put the drops on the floor and the old bank at the fall would have quietly made it B; banking at the ring makes the rest room and the Warden's hall the same rule: only the way home banks.

**Next**

Materials in the bag (A: lumber and stone stack to 50 in bag spaces, picked up by whoever walks over them, a full bag leaves them; potions stay on the belt; coin stays a count), then the village's start and Random at Portal tier III (A), his gamepad layout (A).

## 2026-10-31: Session 71, the way out waits for a fight

**What changed**

Shared level and sim, the floor's view. Michael's A on "Clear the floor before the rest or boss room?" (control room, 31 Oct).
- `floorRun.clearsLeft`: fight rooms still owed before the way out (the rest room, or the Warden's hall on the last floor) opens: `dungeon.clearsBeforeExit` (1), `clearsBeforeExitDeep` (2) from floor `clearsDeepFrom` (3), never more than the floor's fight rooms, the Warden's hall not counted. All three on the panel.
- `buildFloorWorld` keeps the exit's doorway gates as `World.exitGates` and the open floor with them shut as `collidersLocked`; `floorWorldNow` adds them while `clearsLeft` is above 0 (to a fight room's shut set too). It reads only `SimState.floor.cleared`, so the server, prediction and the camera agree as they do for a fight room's doors; the arena never has a floor, so the parity hashes are untouched.
- `FloorView`: the exit's portcullis drops while it is locked, and gold words over the doorway say "Clear N more fight rooms", redrawn only when the count changes.
- Tests: `exitLock.test.ts` (3): a hero running at the rest room's door from outside stays out until one room is cleared and walks in after; floor 3 asks two, capped by the floor; the Warden's hall is shut the same way. test:net's bots walk the shortest route, which may pass no fight, so the smoke test tunes the lock to 0 for its walks. check 265/265, test:net all passed.

**Learned**

Every piece already had its doorway gates built (only fight rooms ever used them), so the lock is the rest room's own gates and its portcullis meshes were already in the view.

**Next**

The boss's drops and the way home (A, with Michael's note: a 10 s countdown before the ring opens), then materials in the bag (A), the village's start and Random at Portal tier III (A), his gamepad layout (A).

## 2026-10-31: Session 70, the rest room is the way out

**What changed**

Shared sim, `HostSession`, `FloorRoom`, client words. Michael's A on "The rest room" (control room, 31 Oct): no heal, nothing banks until home.
- `dungeon.restHeal` is 0 and `loop.bankAtRest` (new, off) keeps P1's rest-room bank behind a switch. Reaching the rest room still raises `rested` (the banner now says "A way out · nothing is banked yet" and that the gold ring banks the run, the violet ring putting all of it at stake).
- `floorRun.ts`: `runPurse` (pure) is the run's unbanked pay, the purse the floors before handed on plus this floor's rooms and smashing at its depth bonus; `bank` pays it, so the Warden's fall banks the whole run too; a wipe drops the purse with the finds. `leaveFloor` runs as a ring is taken: home banks (once: `FloorRunState.home`, so a failed hand-off retaken pays nothing twice), deeper picks up each player's finds still on the ground as carried.
- `HostSession.stepPortal` calls it before `onPortal`, keeps the events in the tick's (so `FloorRoom.onEvents` credits the village) and sends a snapshot at once, so the bank reaches the browser ahead of the hand-off. `runPurse()` and `receivePurse()` for the room.
- `FloorRoom` hands the purse to the next floor through a static map keyed by village code and floor, never create options, which a browser can send for itself.
- Henchman XP needed nothing: it travels in the cards and banks with the run's last `banked` event. The browser's carried marks already lasted across floors.
- Words: the wipe's toast, the hero screen's carried note, a room's clear banner ("Potions and revives are the only heal").
- Tests: the five files that pin P1's bank and D7's heal turn the old switches on; `restRoomStakes.test.ts` (4) proves no heal and no bank on arrival, the gold ring's bank in a snapshot sent first and paid once, the purse carried deeper and banked from floor 2, and lost with a wipe. test:net's run now checks the rest room banks nothing and the run banks once, from floor 2 (105 lumber, 84 stone into the village over both floors). check 262/262, test:net all passed.

**Learned**

`HostSession.between` splices its events out of the tick's array, so a bank raised there would never reach `onEvents` and the village would not be credited; `leaveFloor`'s events are copied to the outbox instead and left in the tick. A test:net server outlived its run here (5 GB, still ticking) and held port 2599 for the next run; killing it was enough.

**Next**

"Clear the floor before the rest or boss room" (A: one fight room, two from floor 3, the count on the door), then the boss's drops and the way home (A, with Michael's note: a 10 s countdown before the ring opens), materials in the bag (A), the village's start and Random at Portal tier III (A), his gamepad layout (A).

## 2026-10-31: Session 69, Michael's 30 Oct board notes asked

**What changed**

Docs only. Nothing in Phase 2 was buildable: every open item is (Fable), (Michael) or an unanswered (design). The 30 Oct board notes had been filed as (design) but never asked, so `decisions.md` Pending now holds six questions covering nine of them, each with today's behaviour, lettered options and a recommendation: the rest room (no heal, no bank: A banks only at the gold ring or a win, so the whole run is at stake), clearing the floor (A: one fight room cleared, two from floor 3, before the rest or boss door opens), the boss's drops and the way home (A: 1 to 3 drops by difficulty, a 4 s corner popup, the gold ring 8 m off and 3 s late), materials and potions in the bag (A: lumber and stone stack to 50 in the bag, the belt stays), the village's start and the Random tab (A: empty plots, Random at Portal tier III), the gamepad layout (A: his layout exactly: RT attack, X the off-hand's ability, Start pause, d-pad right the map). Each backlog item says where it was asked.

**Learned**

The rest-room heal is one panel value (`dungeon.restHeal`), so that half of the first question is trivial to build once answered; the banking half moves the `banked` event from arrival to the gold ring and touches the wipe's losses. The gamepad layout differs from today's in only three buttons.

**Next**

Build whichever answers come back. Not asked: buildings that look their part (art, and tiers past IV) and character creation with a tutorial (likely Phase 4), both larger than a builder question; the builds pass waits on the feel pass.

## 2026-10-31: Session 68, pick up and put down on the hero screen

**What changed**

Client only (`ui/EquipScreen.ts`, `game/Profile.ts`, `game/Game.ts`). The rest of Michael's 30 Oct "Menus with an Xbox pad", as he asked it: A picks an item up and drops it in another space, X quick-equips.
- On the bag and body tab, F or A picks up the item under the cursor (its cell marked as held, "Holding Ash shortbow: F or A puts it down here · Esc or B puts it back" over the detail) and a second F or A puts it down: in another bag space, swapping with what is there (the safe pocket's spaces too), or on the worn slot it fits, which wears it. A worn piece goes into an empty bag space, or swaps with a piece for its slot there; the weapon only swaps, as a hero always holds one. A put-down that cannot go there says why and stays held. Esc or B puts a held item back first and closes the screen on the next press, as the stash does; Tab, a tab change or closing the screen drops the hold.
- J or X (`attack`) wears or takes off at once, what F did before. Q or LB still drops at your feet. The hints say so.
- `Profile.takeOffTo(slot, space)` for the worn-to-bag put-down.
- `tests/padmenus.e2e.ts` gains the moves: the bow to the last bag space, refused on the head and put back by B with the screen still open, then worn from there with the sword taking its space. Passed 3 runs in 3. `smoke.e2e`'s bag test wears the bow with J now.

**Learned**

The stash (P9) already had this exact pick-up-and-put-down and its `back()`, so the hero screen copies its keys and its words; both screens now behave alike under the thumb. `sounds.e2e` and `smoke.e2e`'s bag test fail here on the committed base as well (a held D carries the cursor past the bow on this box's slow pages), so they could not judge this change; the new test drives the screen's handler directly and does not depend on frame rate.

**Next**

Nothing in Phase 2 is the builder's: what is left is (Fable), unanswered (design), or the gate playtest, which is Michael's.

## 2026-10-31: Session 67, B closes menus and a board reset takes two presses

**What changed**

Client only (`input/bindings.ts`, `game/Game.ts`, `ui/EquipScreen.ts`) and one tuning value. Two thirds of Michael's 30 Oct "Menus with an Xbox pad":
- B (button 1) is `menuBack` as well as `dodge`, so it closes the hero screen, the store, the stash, Wren's menu, the tavern's board, a keeper's card and the village map, and resumes from the pause card, as Esc does. `Game.update` notes whether a menu or the run's summary was up when B went down, and drops that frame's dodge press, so the press that closes a menu never rolls the hero (a keeper's card, which read B as its own leave, also no longer steps back twice).
- On the talents and champion boards E or RB arms the reset: the note under the board says "Press E or RB again to reset the whole board", and a second press inside `input.resetConfirmSec` (2 s, on the panel) resets. Moving the cursor or changing tab disarms it. The mouse's Reset buttons are unchanged.
- The controls list gains "Close a menu: Esc · Tab · B"; the pause card says B resumes.
- `tests/padmenus.e2e.ts`: a stand-in pad through `navigator.getGamepads`; RB's arm, reset, timeout and disarm driven straight through `EquipScreen.handle`, then B with the hero screen up closes it and the hero's mode stays out of `dodge` for 1.5 s. Passed 3 runs in 3; with the guard switched off it fails on the first frame's dodge.

**Learned**

The reverted attempt's flake was its way in, not the code: pressing Tab until the hero screen showed raced the page's frames at a few fps. Driving the screen's handler directly for the board and opening the screen with `setVisible` leaves only B going through the real pad poll, which is the part under test.

**Next**

The rest of the item: A picks a bag item up and sets it down in another space (a bag space, the safe pocket or a worn slot), X quick-equips. Then the gate playtest, which is Michael's.

## 2026-10-31: Session 66, the Old Cellar opens the next story

**What changed**

Shared level (`level/floor.ts`); no message change. The critic's bug (c86cbcb), the cause of Michael's 30 Oct "clearing the first story dungeon does not unlock the next": `floorLevel` built a hand-built floor from `checkDungeon`'s own spec, `{ seed, pieces, floor, floors, hand }`, so what Wren's menu chose (`story`, `difficulty`, `modifier`) never reached the level. The welcome sent that spec, and the browser's `runWon` check in `Game.ts` found no story to mark cleared.
- `floorLevel` lays the given spec's `difficulty`, `story` and `modifier` over the checked one; the seed, pieces and joins stay the check's.
- `portalChoice.test.ts`, a new case: every floor of the hand-built story keeps its story, difficulty and modifier, and a spec's Hard and Cursed come through. Fails without the change.

**Learned**

The same drop also kept difficulty and modifiers off any hand-built floor. Today's one hand-built story, the Old Cellar, is Normal with no modifier, so its fights are unchanged; a later hand-built story at Hard or Haunted would have played at Normal with none.

**Next**

Found in play: menus with an Xbox pad (Michael, 30 Oct). I started it this run and reverted it: the code was small, but its e2e passed 1 run in 3 here, so the backlog item now says what was found and what the test needs. Then the gate playtest, which is Michael's.

`test:net` leaves its server on 2599 running after "all passed" (here at 65% CPU and 3 GB until killed), which slowed the next e2e runs to a crawl and makes a second `test:net` fail with EADDRINUSE. Kill it between runs in one session.

## 2026-10-31: Session 65, the village ring a second time

**What changed**

Shared game (`game/HostSession.ts`); no message change, no tuning. The critic's bug (c86cbcb), the cause of Michael's 30 Oct "a second run does not start without a reload": `portalTaken` was set when a ring fired and cleared only by `reopenPortal()` on a failed hand-off, and a village outlives its runs, so the party home again filled the ring to 2 s and nothing happened.
- `stepPortal` clears `portalTaken` whenever nobody is on a ring (the party left the room, or stepped off). While they stand in it during the hand-off it still fires once, and `handingOff` guards the async part as before.
- `portal.test.ts`, a new case: two peers take the village ring, leave, come back, take it again. Fails without the change (1 taken, not 2).
- `test:net` 8b: after the run home and the village's business, Vale and Wren walk into the village ring again and are handed on to a floor.

**Learned**

Michael's "resetting the portal with the portal keeper" was beside the point: Wren's menu sets `choice`, never the taken flag, so any second run from a village was stuck, reset or not. A floor room never met it because each floor is a fresh room.

**Next**

The critic's other bug: `checkDungeon` drops a story floor's `story`, `difficulty` and `modifier`, so clearing the Old Cellar opens nothing (Session 66).

## 2026-10-31: Session 64, a slow page's burst is not folded

**What changed**

Shared netcode (`game/inputSlots.ts`), deep-work card `fable/burst-fold`; no message change, no tuning added. The slots fold the inputs standing past the cushion and four more into one tick, for a server ticking slower than wall time. They used to judge that by the queue's length each tick, which a page at 5 to 10 fps tops up by a frame's six to twelve commands at once, on time; now they judge it by the queue's low point between one message and the next (`Slots.low`, the excess it shows folded at the next tick, presses kept). An on-time burst drains back to the cushion before the next frame and is never folded; a slow server's low point creeps up and still is; a 60 fps sender folds exactly as before, a tick later.
- `inputSlots.test.ts` (6, new): a 5 fps page sending twelve a message is never folded and uses one seq a tick; an uneven 10 fps page is not folded; a slow server (9 ticks in 10) folds a steady sender and keeps its queue short; a slow page on a slow server folds too; a page that was bursty is folded once a slow server makes its inputs stand; a folded input's dodge is kept.
- `test:net` 9c': a 5 fps ClientSession, at most one correction over 10 cm (0 of 25 here, largest 7 cm; main 5 and 7, largest 54 cm, in the same harness).
- CLAUDE.md's Inputs paragraph says what the fold counts.

**Learned**

- At about 10 fps uneven (9c's frames) main never folded at all: 0 folds, 4 stand-ins. Its 3 or 4 corrections over 10 cm all fall in the first 0.4 s, the slots anchored on the 60 ms first frame and widening as the 150 ms ones arrive late; started on the 150 ms frame there are none. The fold was the 5 fps problem, not the 10 fps one.
- The card's shape (a decaying allowance of the largest message, `cushion + burst` before folding) read worse in the lab: 366 corrections a minute and 738 ms in flight against main's 303 and 549 at 0 ms. This box runs two software-GL pages at 7 to 9 fps and the server beside them, so the server ticks slow too, and the allowance kept a queue that really was standing. The low point tells the two apart without a constant.
- Lab, 60 s a condition, pages at 8 to 9 fps unthrottled (this sandbox): corrections a minute 150 / 169 / 189 / 167 at 0, 50, 150 ms and the lossy row, against main 232 / 260 / 205 / 293; over 10 cm 85 / 113 / 123 / 88 against 100 / 104 / 98 / 140. Two more 150 ms runs each: 195 and 215 (103, 103) against 259 and 279 (110, 153). The price: inputs in flight about 60 ms longer at 150 ms (840 against 770 to 790 ms), because the old fold used a burst's inputs ahead of their slots; now each is used at its own tick. A 60 fps page is unchanged.
- `--cpu-throttle 2` here puts Alpha at 5 fps and reads 21 to 29 s in flight on main and the branch alike: that lab row measures this box, not the netcode. The first lab run of a fresh session timed out at "Bravo joined" (Vite's cold start); the second went through.

**Next**

The start-up stand-ins on an uneven slow page (the 0.4 s after a join or a hand-off) would want the first cushion sized from more than the first frame; small, and only on slow pages. The critic's lab on a desktop at 20 to 30 fps would say whether the extra 60 ms in flight on a slow page is felt.
## 2026-10-31: Session 64, the jump clears low attacks (M1)

**What changed**

Shared sim and the HUD; no message change beyond one new event. M1 to Michael's A (control room, 30 Oct): a jump clears low attacks above about half a metre, no i-frames; the air dodge and double jump wait.
- **Which attacks are low.** Everything that goes through `shove` in `enemies.ts`: the Warden's sweep, slam and far slam, and the Brute's slam (a slam is a slam, so the Brute's counts with the Warden's). The grunt's slash and every arrow are not low and still hit a jumper. The Crypt Hound's rush will tag itself the same way when it is built: `low` on its `HeroHit`.
- **The tag** is `HeroHit.low`, the enemy's feet height as it swung: the attack runs along that ground, so a hero over a ledge's lip is measured from the floor the slam struck, not their own. Set only while `jump.clearsLow` is on.
- **The check** (`clearsLow` in `combat.ts`, inside `hurtHero`): in the air and `jump.clearHeight` (0.5 m, panel 0 to 1.5) over the attack's ground, the hit does nothing and pushes a `cleared` event. The HUD shows "Cleared" under the crosshair (pale blue, the parry's slot) and a thin ring passes on the floor beneath. A 1 m jump is above 0.5 m for about 0.4 s of its 0.58 s.
- **When it is judged: as the hit lands, after `coop.lagGraceMs`.** The grace exists so what was on time on the player's screen counts; that screen draws the Warden behind the server and the hero ahead of it, so the slam lands there later than the server swung it. A dodge and a parry are already judged at landing, and the jump now agrees with them: a jump pressed in the 150 ms after the swing clears it, a hero in the air at the swing who has come down by the landing is hit. A hit that lands early because the player rolled or guarded is judged at that moment, as before.
- **Prediction** is untouched: the browser never resolves an enemy's hit on its hero, so the server's verdict reaches it as the snapshot's health and mode, as every hit does. The switch is off in the parity test, and with it off no hit carries the tag, so the golden hashes did not move.
- `sim/jumpClears.test.ts` (10): the Warden's sweep, slam and far slam and the Brute's slam cleared above the height with a `cleared` event and no damage; a 0.3 m hop and standing still are hit; an arrow and a slash still hit a jumper; height measured from the attack's ground; a remote player cleared by a jump after the swing and hit after coming down; off for the slice (no tag, the hit lands); the same inputs twice give the same state. Six of them fail with the check disabled.

**Learned**

Measured on the lag lab locally (30 s a condition, the container drawing at about 12 fps, so noisy): corrections a minute at 0, 50 and 150 ms were 210, 184, 142 on main and 136, 178, 156 here, snaps 0 on both. The lab's bots do not jump, so this says only that nothing else moved.

**Next**

Michael to jump a Warden slam on the hosted build. Not in, by his answer: the air dodge and the double jump (after D6's rooms). The Hound's rush tags itself `low` when the Crypt roster is built.

## 2026-10-31: Session 63, a hall of embers (D6)

**What changed**

Shared level and sim, the floor's view and the minimap; no message change. D6 to Michael's A (control room, 30 Oct): lava only, on today's jump.
- **Where** (`level/lava.ts`, level data from the seed like the props, so every browser and the server lay the same). From a run's second floor, on 60% of floors (by the seed's own hash, so the generator's layout and the props of every seed are untouched), one flat fight room of three cells or more a side, never the Warden's hall, gets strips across its longer run: 1.6 m wide (a running hop is about 3.2 m), 3.4 m of stone between, 3 m clear inside the walls a party enters by, none within 2.5 m of a side wall's doorway. Each strip stops 2 m short of one wall, the next short of the other: the long way round is a zigzag, the hop the quick way. The room's banner reads "A hall of embers"; no enemy wakes within a metre of a strip and no crate stands in one or across its walkway. Hand-built floors have none.
- **The burn** (`sim/lava.ts`, in `stepSim` after the doors, never in prediction: the browser's hero takes its health from the snapshot, as from a hit). A hero on their feet in a strip loses `lava.burnFracPerS` (15%) of max health a second in pulses every `lava.tickS` (0.5 s), the first on the tick they step in, each a `heroHurt` event, so the hurt sound and numbers play; at nothing they go down (`knockDown`, now shared with `hurtHero`). One in the air is spared, and stepping out ends it. Henchmen are spared (their brains do not see lava) and enemies walk it.
- **The look.** A molten strip just above the floor, glowing past the tone map, its crust drifting and its glow breathing, one material for the floor; each strip lights from the torch pool. Orange on the minimap.
- `sim/lava.test.ts` (7): none on floor 1; on 120 deeper floors, between 30% and 90% have one room of lava, and every strip is 1.6 m, inside the walls, clear of doorways, with its walkway alternating, no pillar in a walkway, nobody waking or crate standing in it; the same spec lays the same strips; the burn's rate (30 in two seconds), the hop, the henchman, stepping out, and the down.

**Learned**

The first pulse on the step in and then every 30 ticks needs the countdown to start after the pulse, not before: subtracting first put the second pulse a tick early and five pulses in two seconds.

**Next**

Michael to play a lava room on the hosted build (Wren's Random, any floor past the first). Left out on purpose: lava in the editor's hand-built floors, henchmen that path round it, a chasm (B). The gate playtest is Michael's.

## 2026-10-31: Session 62, the bag cursor one space at a time

**What changed**

Test code only. The critic's bug (7c119bd): `sounds.e2e` held D and polled for the Ash shortbow's name; Playwright's poll waits longer each time (100, 250, 500 ms), and with the menu's repeat at 0.12 s a held D crossed several spaces between looks, carrying the cursor past the bow on a page near 12 fps. Now each step holds D only until `game.equip.cursor` changes (polled every 10 ms), then lets go, up to twelve steps, and the test asserts the bow is chosen.

**Learned**

Old test 3 of 3 failed in this cloud session, the new one 4 of 4 passed. Two earlier failures of the new one were not the test: Vite reloaded the page because I was editing `shared/` while it ran ("Execution context was destroyed", `game` undefined). An e2e run in a session that is also editing the code is not a measurement.

**Next**

D6's lava room (Michael, 30 Oct, A on the control room).

## 2026-10-31: Session 61, the ring's words fade up close

**What changed**

Client only. The critic's bug (7c119bd): the shrine's door stands just behind the village ring, so the camera behind a hero at the door sat in the ring under its "New dungeon" label, letters taller than the hero over a third of the screen.
- `PortalView.update` takes the camera's position and fades the words over it from full at 6 m to gone at 3 m (`LABEL_FADE_FAR`, `LABEL_FADE_NEAR`), hiding the sprite at nothing. Every ring does it, the rest room's two included. A camera 5.5 m behind a hero standing in the ring still reads them at about 80%.
- `tests/smoke.e2e.ts`, a new case: from the square the words are at full; at the shrine door facing it, under 0.3 within 5 s. It fails without the change (1, against < 0.3) and passed 2 of 2 with it.

**Learned**

A label's size on screen is its distance, nothing else, so fading by distance fixes the shrine door and any later spot where a ring sits against a wall, without moving the ring or the door.

**Next**

The flaky `sounds.e2e` (test code), then D6's lava room (Michael, 30 Oct, A on the control room).

## 2026-10-31: Session 60, the shrine's broad door

**What changed**

Shared level data and the door check; no message change. The critic's bug (7c119bd): the shrine's front door is drawn 2.2 m wide but took F only in a 0.8 m circle, so a hero pressed against its planks a metre off the middle got no hint and F did nothing.
- `DoorLink.halfWidth` (optional): the door's circle slides that far either way along its face (the line across `toYawDeg`, as `through` lines henchmen up). `inDoor` in `level/village.ts` is the one test, used by `stepDoors` on the server and the door hint in `Game.doorInReach`, so the hint and the press always agree.
- The shrine's front door has 0.6, so it reaches 1.4 m either side of its middle at the wall: the drawn door's 1.1 m and a little. The other doors are drawn 1.3 m wide and keep their circles.
- `interior.test.ts`: a hero walking north into the planks with F held at x = -1.1, -0.6, 0, 0.6 and 1.1 goes through (fails without the change at the edges); 1.6 m off, or 1 m out in front, it does not. The no-bounce and henchmen checks use `inDoor`.

**Learned**

A hero against the shrine's wall stands at z = -14.6 (the wall at -15, a 0.4 m body), so the critic's (-1.0, -13.6) ends 1.0 m from the circle's centre: the depth was never the problem, only the width.

**Next**

The ring's words at the shrine door, then the flaky `sounds.e2e`, then D6's lava room (Michael, 30 Oct, A on the control room).

## 2026-10-30: Session 59, D6 asked

**What changed**

Docs only. D6 (rooms that need jumping) waited on D2's bigger rooms and M1's answer; both are in, so it is asked in `decisions.md` Pending: A (recommended), a lava room a running hop clears, built by the builder with no change to movement; B, A plus a chasm whose put-back is **(Fable)**; C, after the gate. The backlog marks it asked.

**Learned**

Today's jump (1 m, gravity 24) is about 0.58 s in the air: 3.2 m at a run, 4.6 m at a sprint. A 2 m strip is a hop with room to spare.

**Next**

The producer carries D6 to Michael. The builds pass waits on the feel pass being played; M1 is **(Fable)**; the gate playtest is Michael's.

## 2026-10-30: Session 58, the ceremony at the building

**What changed**

Client only, plus one tuning value; the `upgraded` message is unchanged. Part two of "Building upgrades with ceremony" (Michael, 30 Oct, A), which finishes the item.
- **The ceremony.** When the room answers `upgraded`, the keeper card steps aside and the camera cuts from the counter to the building's front (`VillageView.ceremonyShot`: out from the door and a little to one side, looking up at the roof). Scaffolding climbs the walls over the first quarter (poles every 2.4 m and two rings of planks, built once per building and hidden). Dust puffs rise from the walls' feet while the work goes on. At 60% the new pennant pops onto the ridge, the sign takes its numeral and dust bursts up the walls. Then the scaffold comes down and the camera returns to the keeper, whose card is back with the new tier marked "here". The fanfare and the keeper's line are as in part one.
- **The old tier until the reveal.** The village message can come before or after `upgraded`, so `setTiers` holds the building being raised at its old tier until the reveal (`TierMarks.wanted` is the village's tier, `tier` the one on show).
- **Length and skipping.** `tuning.village.ceremonySeconds` (4; 0 to 10 on the panel, 0 skips it). While it plays it takes every key; A, B, F, Esc or Tab cuts it short and the building stands at its new tier at once. Leaving the village ends it too.
- `tests/smoke.e2e.ts`, a new case: with building free (panel edits, put back after), Confirm on the shrine's tier II hides the card and puts the camera outside the shrine, the ceremony ends by itself with tier II current, and tier III's is cut short by Esc. It passed 3 of 4 runs; the failure was the known flaky walk into the shrine (Session 57), before any of the new code ran.

**Learned**

The cut between the inside and the front needs no camera work: the set shot's blend is already full while a card is up, so changing the shot is a cut, and `setEye` hides the interior shells once the eye is outside.

**Next**

The upgrade item is done. M1 is **(Fable)** and the Phase 2 gate playtest is Michael's. D6 and the builds pass are still **(design)** and not yet asked.

## 2026-10-30: Session 57, a building's tier path and a confirm

**What changed**

Client only; the `upgrade` message is unchanged. Part one of "Building upgrades with ceremony" (Michael, 30 Oct, A).
- **The path.** A keeper's Build button no longer builds: it turns the card to the building's tiers, I to IV in a row (`TierStep`, `.keeper-path`), each with what it gives and, ahead of where the village stands, what it costs; the current tier is marked "here", the next is dashed gold with what the village is short of in ember. Under it, **Confirm: build tier N** (greyed with the shortfall, or "Only <host> can build here" for a guest) and **Back**.
- **Backing out.** Esc, Tab or B step back once: from the path to the keeper's page, then away. Esc was handled twice a frame (the game's menu keys and the card's own), harmless while both closed; the card now leaves Esc to the game and keeps B.
- **A fanfare.** `Sfx.fanfare`: a rising three-note horn call and a held chord when the room answers `upgraded`, with the toast and the keeper's "Done" line as before.
- `tests/smoke.e2e.ts`: by keys, Wren's card, down to Build, four tiers with I current and Confirm chosen, Esc back to the card, Esc away.

**Learned**

The village smoke test is flaky on this box in its walks, not the card: of five runs with the change, two failed (a 25 s walk into the shrine before the card opened, and the ring hand-off), three passed; the base passed its one run.

**Next**

Part two: the ceremony at the building, the camera turning to it (`OrbitCamera.setShot`), dust and scaffolding for a few seconds, and the building changing with its tier. Then M1 is **(Fable)** and the gate playtest is Michael's.

## 2026-10-30: Session 56, launched corpses (K1)

**What changed**

Shared sim and one view; no message change. Michael answered Session 55's three questions on the control room (A each, 30 Oct); this builds K1 to his A.
- **Launched corpses** (`tuning.launch`, every number on the panel). A grunt or archer killed by a melee heavy (the heavy string, the chain's last hit, a slam, Charge, the shield bash: `hit.heavy` and not a projectile) is marked `EnemyState.launched` and slides `distanceM` (5) along the blow instead of the 1.2 m a death had, `warhammerMult` (1.5) farther from the warhammer. `stepLaunched` (combat.ts, called at the end of `stepEnemies`) checks each flying corpse against the living: the first time it meets one, that enemy takes `damageShare` (a third) of the killing blow and is staggered (a roaring Warden excepted, as damage never staggers a roar). The mark drops when the corpse slows under `minSpeed` or stops being dead (a Haunted rise). A corpse's hit is a projectile hit, so it launches nothing in turn and no browser predicts it. Enemies are the server's alone, so prediction is untouched.
- **The arc.** `EnemyView` lifts a launched death on a `arcHeightM` (0.8 m) parabola over `arcSeconds` (0.45 s) from the moment its hitstop ends; the slide itself is the snapshot's.
- **The slice.** `launch.enabled` is off in the parity test; the hashes are unchanged. `shared/src/sim/launch.test.ts`: a heavy kill flies and hurts and staggers the next grunt once; a light kill drops where it stands; the warhammer goes half again as far; switched off, nothing flies.

**Learned**

The kill's slide was already there (knockback steps for the dead too, walls included), so a launch is only a longer push plus the contact check. Corpses stagger the Warden and brutes too, as the decision reads; if that stunlocks the Warden in play, a size rule is one line.

**Next**

Building upgrades with ceremony (answered A): the whole tier path from the Build button, a confirm, the camera and fanfare. M1 (answered A) is now **(Fable)**. Then the Phase 2 gate playtest is Michael's.

## 2026-10-30: Session 55, three design questions asked

**What changed**

Docs only. Every open Phase 2 item left is **(Fable)**, **(Michael)** or an unasked **(design)** pass, so the builder asked three of them in `decisions.md` Pending, each with options and a recommendation: building upgrades with ceremony (A: the whole tier path from the keeper card's Build button, a confirm, and a short ceremony at the building), K1 launched corpses (A: built now behind a switch, a third of the killing blow and a stagger to what a corpse meets), M1 more ways to move (A: the jump clears low attacks with no i-frames; a **(Fable)** item whichever is chosen). The backlog marks each as asked.

**Learned**

D6 (rooms that need jumping) waits on M1's answer, and the builds pass on the feel pass being played, so neither was asked. The builder lock could not be taken this run: the push of the tag was refused by the session's git proxy.

**Next**

The producer carries the three questions to Michael. Once one is answered and not marked **(Fable)**, the builder builds it; otherwise the Phase 2 gate playtest is Michael's.

## 2026-10-30: Session 54, a slow page keeps the server's time

**What changed**

Client and a tuning default; no message change, parity untouched (the sim is not touched).
- **The critic's frame-rate bug** (Found in play, 28 Oct). `Game.update` clamped every frame to 100 ms before the session saw it, and `ClientSession.advance` stepped at most 8 ticks; a page under 10 fps (frames of 100 to 270 ms in the throttled lab) made fewer commands than the server ticked. The server stood in held buttons for the missing ticks, dropped the late ones when they landed, and every key change near a stand-in moved the hero from where the browser had it. The critic's raise of the cap to 16 barely helped because the 100 ms clamp, not the cap, was the limit.
- Now the session takes the frame's whole time (`frameDt`; the views keep the clamped `realDt`), and `sim.maxStepsPerFrame` is 30, half a second, the same catch-up the server allows itself (panel range 1 to 60). Past that a stall still drops time, and the server's 300 ms stall rule picks the player up again.
- `ClientSession.sent`, the commands made so far, for the test.
- Test: `test:net` 9c drives the real ClientSession with uneven frames of 40 to 150 ms (about 10 fps) for 4.5 s of running. Before: 210 commands over 262 ticks of wall time, 17 corrections over 10 cm. After: 262 over 262, 3 over 10 cm, no snap. The count is a check; the corrections over 10 cm are printed as `info` (see Learned). At 13 fps even frames the remainder is 0, at 8 fps 1, at 5 fps 7.
- `smoke.e2e`'s `walkTo` steers by the predicted hero, not a snapshot a round trip old: with a slow headless page now stepping its long frames whole, the old steering circled the 0.6 m mark at Wren's table. Smoke on this box: 5 of 7. The village walk fails at the rest room's gold ring (`steer` home; on the commit before this work it failed earlier, timing out), and the bag test's D-hold timed out once (it passed alone). e2e is not in CI.

**Learned**

- What is left at low frame rates is the server's, not the client's: a frame's commands arrive as one burst (9 to 12 at 5 to 8 fps), and `inputSlots.ts` takes a queue longer than the cushion plus `maxExtra` (4) for a server running slow and folds the excess into one tick. A bursty but on-time page looks the same. Telling them apart (the burst size seen recently, say) is server netcode, so it is a **(Fable)** item now.
- A failed `test:net` leaves its dev server on port 2599; kill it by PID before the next run (`pkill -f` on that pattern also kills the shell that runs it).

**Next**

- Phase 2's builder items are done; the backlog holds (design) and (Fable) work and Michael's gate playtest. The critic's lab at `--cpu-throttle 2` should now read near the desktop's numbers; the fold item is for the deep-work session.

## 2026-10-30: Session 53, item sounds and a coin jingle

**What changed**

Client only; no message change.
- **Every item handled sounds like what it is made of** (Michael, 29 Oct). `Sfx.item(item, putDown)` reads the catalogue's material family: metal clanks (two bright partials, a thud when set down), hide thumps, cloth rustles, wood knocks, arrows rattle, trinkets and dyes chime. Setting down is a little heavier than taking, a two-handed weapon heavier again. Synthesised like the rest of `Sfx` (Michael's M6 call, no recordings).
- **Where**: dropping from the hero screen (Q, LB or the button); the stash both ways, a put-down or a quick move (`BankScreen`'s new `onPut`); a purchase (the item taken) and a sale (the item set down).
- **The coin jingle**: four quick clinks on the room's answer to a buy or a sell (`settleTrades`), so it sounds only when the trade went through, never on the press.
- **The smoke test's walk to Wren's table** goes in two legs: at full speed on a round-trip-old snapshot the one long walk could reach the table at its end and slide round behind it, out of reach of the spot in front. It failed 1 run in 4 on the commit before this work too, so it predates the door change.
- Test: `tests/sounds.e2e.ts` unlocks audio with a key, drops the shortbow from the bag by keys and sees its sound asked for ("ash-shortbow", set down), then plays one item of each family both ways and the coins with no page error. check 222; smoke, loading and sounds 10/10.

**Next**

- Phase 2's builder items are done; what is left is (design) or (Fable) work and Michael's gate playtest. The Found-in-play bug on corrections against frame rate still wants a desktop reading at 20 to 30 fps.

## 2026-10-30: Session 52, doors take a press

**What changed**

Sim (village only), event and client; no message change, parity untouched (the arena has no doors).
- **A door takes F or A** (Michael, 29 Oct: "entering should take a button press (interact), not happen just by walking into the doorway"). `stepDoors` now gets the tick's commands and puts a hero through only while their `interact` is held in the door's circle. Still the server's alone, so prediction never takes a door; the held F rides the input slots like any held button. Henchmen never press, so they still go on touch and with their player, as before.
- **The way out is shut.** An inside's doorway had a gap in its south wall that only the door's circle stopped you walking out of; it now has a `door` collider (no camera block), so walking at it stops in the circle under the daylight, and F takes you out.
- **The hint**: in a door's circle the corner hint reads "F (or A): go into the Portal Shrine" (the building whose front it is) or "F (or A): step outside" (`Game.doorInReach`, through `TalkUi`); a keeper in reach still comes first.
- **The sound**: a new `door` event (player and place) from `stepDoors`; `Sfx.door` synthesises a hinge creak, the latch and the thump of it swinging to, quieter for another player's door.
- Tests: for each of the four buildings, walking straight through a door's circle from the square goes nowhere and makes no door event, F there takes the hero in with the event, and inside, walking at the doorway stops in its circle (fails on the old code: the walk alone went in). check 222, test:net, smoke 7/7 with the shrine's doors now taken with F held (held only once out of Wren's talk range: F by her opens her card, which holds the hero still).

**Learned**

- `npm run test:net` can leave its dev server running when its output is piped and cut short; one left from this run's first check sat at 8 GB and held port 2599, failing the next run with EADDRINUSE. Look for a stray `src/index.ts --dev` before reading a test:net failure.

**Next**

- Item sounds (drop, buy, sell, store, each by item type, a coin jingle on a trade).

## 2026-10-30: Session 51, a loading card while the server wakes

**What changed**

Client only; no message change.
- **After Play, a card instead of a frozen screen** (Michael, 29 Oct). `client/src/ui/LoadingCard.ts`: from the moment the title goes until the room's `welcome`, a card over the level reads "Waking the server", says the free server sleeps and can take about a minute, and shows a bar, the session's own status line ("Starting a game…", "Joining game ABCD…") and the seconds waited. Nothing tells the browser how far the server is, so the bar eases toward full over the expected minute (86% at 60 s, never full) rather than claiming a real percentage.
- After the page has played once, a wait is a portal's hand-off: the card reads "Through the ring" instead, and only past 300 ms, so a quick hand-off never flashes it. A refused or lost connection leaves it to the party panel's message, as before.
- No press on it, no pointer events: it goes on its own. 380 px wide at most, 16 px from the edges on a phone.
- Test: `tests/loading.e2e.ts` points the page at a TCP server that takes the connection and never answers (a server still waking): the card shows, titled, with the bar moving and the seconds counting; against the real dev server the card is gone once playing. Both pass; check 218. At 375 x 667, no sideways scroll.

**Learned**

- The Colyseus client's create starts with an HTTP matchmaking request, so a listener that accepts and never writes is an exact stand-in for a sleeping Render service: the browser waits as it does on the hosted build.

**Next**

- Doors take a press, then item sounds. The open Found-in-play bug (corrections against frame rate) still wants a desktop reading at 20 to 30 fps.

## 2026-10-29: local session, E1 the enemy design pass

**What changed**

`auto/local-e1-design`, stacked on `auto/local-archer-leash`. Docs only.
- **Designed with Michael in chat** (decisions.md, "E1, the enemy design pass"): enemies as eight role behaviours dressed per dungeon type; the Haunted Crypt's roster first, then the Goblin Warrens; the design doc's eight types canonical, Wren's tab to be redrawn to them; built right after the Phase 2 gate. The Crypt adds a Skeleton Shieldbearer, a Crypt Hound, a Wraith (a chill circle), a Bone Priest (raises the fallen), a Barrow Knight (elite), and the Warden's three phases.
- **The design doc** gains the Enemy roles table and the telegraph colour language.
- **The backlog** gains "After the Phase 2 gate: E1, the Crypt roster", E1a (roles and types, deep-work) to E1i (the Warrens, to design after the Crypt is played). E1 is marked designed.

**Next**

- The stack approved and merged (#123 to #126, then this), the builder and the deep-work routine back on, Michael's gate evening; E1a once the gate is recorded.

## 2026-10-30: Session 51 (deep work), lumber, stone and coin as drops

**What changed**

`auto/fable-loot-drops`, the deep-work card "Lumber, stone and coin as drops" (Michael, 29 Oct: "Stone and lumber should be items that drop on the ground and spray out of smashed crates in random quantities. Crates and barrels should hold coins too."). Floors only; the arena and the parity hashes untouched.
- **The spray.** A smashed crate or barrel rolls 1 to 3 lumber and, half the time, 2 to 8 coin; an urn 1 to 3 stone (no coin: Michael named crates and barrels). Every roll is `state.rng` through `nextRandom`. Lumber and stone lie a piece a unit, coin in up to three piles, each thrown 0.56 to 1.4 m out from the prop's wall inside a 120° fan and kept 0.3 m inside the room's open floor (`PropInfo` gained `inward` and `room` for this). They lie in `SimState.floor.loot` (optional, plain data, ids the prop's id times eight plus the piece).
- **The pickup** (`stepLoot`, after `stepPotions` in `stepFloorRun`): once a piece has landed (`loop.smashSettleMs`, 450 ms, so the arc is seen), the first standing player within `loop.lootRadius` (0.9 m) takes it into `floor.found`, now `{ lumber, stone, coin }`, with a `lootTaken` event. Henchmen take no loot (P10) and a downed player takes nothing. The server's alone: prediction runs the smash on its throwaway copy as before and never steps the pickup.
- **Bank and loss.** The rest room or the Warden's fall pays found coin to each player on top of the rooms' coin, as the rooms' coin is paid, with the depth bonus like lumber and stone; anything still on the ground at the bank goes home with the party, as finds on the ground do. A wipe loses the found tally and the ground alike.
- **Tuning.** `smashLumber` and `smashStone` became `smashLumberMin/Max`, `smashStoneMin/Max`; new `smashCoinChance`, `smashCoinMin/Max`, `smashSpray`, `smashSettleMs`, `lootRadius`, all on the panel.
- **The browser.** `PropView` draws each piece (a plank, a grey stone, a stack of one to three glinting coins by the pile's size) built once, flying from the prop to where it lies over the settle time and turning slowly there; one that landed before the view saw it is drawn where it lies. The smash's "+1 lumber" word moved to the pickup ("+3 coin"), with a coin chink or a wood or stone knock. The floor's top-right line says what a wipe would cost: "carrying 5 coin, 1 lumber".
- Tests: `smashLoot.test.ts`, six: the same spray in every run of the same state, inside the room, out from the wall, within the spray; different amounts across a floor's crates; nothing taken in the air, everything taken walking over it into the tally; a henchman and a downed player pass it by; ground loot banked at the rest room (coin to the player) and lost with a wipe. `smash.test.ts` follows the new tally. check 224, parity identical, test:net all passed. In the browser against a dev server: a bot broke floor 1's first crate (seed 202), it threw a plank and three coin piles, the browser drew them and the "+3 coin", "+1 lumber" words, and the bot walked up 7 coin and 1 lumber.

**Learned**

- A fresh state rolls the same dice, so "random quantities" only shows across a floor's props, never across two runs of one test: the variety test breaks a floor's every prop in one state.
- Outside a fight a down does not last a tick, so a test of what a downed player may do steps the system alone.

**Next**

- Michael approves the PR; the critic's play will say whether 0.9 m pickup feels like walking over it or like a vacuum (the smasher at sword range takes the pieces that land at their feet).

## 2026-10-29: local session, a floor's archers come back (and enemies find the doorways)

**What changed**

`auto/local-archer-leash`, stacked on `auto/local-henchmen-grow`. Sim only, floors only; no message or event change.
- **Archers on a floor.** The slice's archer stands on the arena's ledge and only ever moves along x: back along the ledge when you close in, a slow drift otherwise. On a floor, out of sight, that drift ran on for good, and its room never cleared (filed this morning). Now, on a floor only: out of sight or further than `archer.floorRange` (14 m) it comes after its hero through the doorways; nearer than `fleeDistance` it backs straight away in any direction; otherwise it strafes a little across the line.
- **Every enemy on a floor finds the doorways.** `navGoal` on a floor is `floorGoal`: straight at a hero in the same piece, otherwise the next point of `walkRoute` through the doorways, a point counted passed once the enemy is nearer the next (the first sits just inside the door, and turning back for it held enemies jittering in the doorway). A grunt waiting its turn to attack follows the route too when its hero is in another piece. With the doors open (D8) a hero can leave a room, and enemies walking straight at them only pressed into the wall.
- **And steps round a pillar or brazier dead ahead** (`around`): a great hall's brazier stands in front of its north doorway, and an enemy walking straight down the line from the room's middle met it head-on, where the push out is straight back, and stood there for good.
- **The keeper card no longer shuts under the next F** (P11's branch, found by the smoke test): it closed whenever `villagerInReach` lost the keeper, and a hero stopped at the edge of talk range settled a hair past it. It closes now only when the hero is well away (talk range and 1.5 m) or the village is gone.
- **The smoke test's ring**: `walkTo` steers by a snapshot a round trip old at full speed, so the short walk from the shrine's door into the ring could coast through it and out (the hero 2.6 m from its middle, the ring 2.4). `intoRing` walks to its edge, then taps W until the hero stands well inside.
- Tests: on the reported seed, archers in a fight room come within 16 m of a hero two pieces away and closer than they started; a grunt dead in line with the doorway, behind the brazier, reaches its hero; an archer backs away along z. All three fail on the old code, the grunt one without the stepping round too. check 218, parity identical, test:net, smoke 7/7; the two ring tests 8 of 8 repeated.

**Learned**

- The dev server's watcher can keep a half-reloaded module graph after files change under it mid-test (stashing to compare): floor rooms threw `unstickHenchmen is not defined` every tick until a restart. A smoke failure after such checks wants the server's log read first.
- A test that makes enemies with `createEnemy` must not push them again: it adds them itself, and a doubled enemy is stepped twice a tick.

**Next**

- Michael approves the stack (playtest-fixes, keeper-cards, melee-guard, henchmen-grow, this) and plays the gate.

## 2026-10-29: local session, P12 henchmen who grow and P13 the party's frames

**What changed**

`auto/local-henchmen-grow`, stacked on `auto/local-melee-guard`. Event shape changed (`banked` gains an optional `hench`); no message change.
- **Henchmen keep their XP (P12).** By kit (one name a kit) in the village save (`VillageSave.hench`, checked by `readVillageSave`). A floor's bank carries the henchmen's XP in the `banked` event: the village's room keeps it (`credit`, `bankHenchmen`, the most each has banked) and so does the owner's browser, since the village only messages those standing in it. A hire in the village comes at its banked XP, and henchmen coming home are set back to it (`VillageRoom.welcomeHenchmen`, `HostSession.settleHenchmen`), so a wipe loses what they earned since, as finds are lost.
- **The Tavern caps them**: 12 levels a tier, the top tier to 50 (`henchmanCap`, `village.henchmanCapPerTier`); the cap rides on the brain and the card through rings, and `grantXp` earns nothing past it. Raising the Tavern lifts it at once. The Tavern's words and the map say "up to level N".
- **A level is a henchman's build**: `hirelings.damagePerLevel` (2%) a level, as it has no talents, and +10 health as any hero. A new henchman's health now follows its own kit's level from the start.
- **The party's frames (P13)**: a 16-pixel head each (Garrick's plumed helm, Bryn's hood, Tamsin's hat, a player's open helm), "Lv N" beside the name, a line of what they are (a henchman's title and cap, a player's class and weapon), health in numbers; 48 px tall. A henchman's name tag reads "Garrick · Lv 6".
- Two gaps found in the browser and fixed: the browser dropped `hench` reading its save, and the hello rebuilt the village field by field without it.
- Tests: the cap a tier; the save keeps the most banked a kit and reads it back, refusing a bad one; no XP past the cap while a player earns on; settling sets a hire to its banked XP under the cap, quick at the top, the cap on the card; a level's damage and health; a bank with henchmen carries their XP, one without says nothing. check 215, parity identical, test:net, smoke 7/7. In the browser: a tier-3 Tavern's hires came at levels 6 and 3 with 150 and 120 health; on floor 2 their XP climbed in the fight and the rest room banked it into the save (Garrick 12,000 to 13,483, Bryn 2,000 to 3,228). The pane's save put back after.
- Found and filed under Found in play: a fight room's archers left chasing from far off, so the room never cleared.

**Next**

- Michael approves the stack (playtest-fixes, keeper-cards, melee-guard, this) and plays the gate.

## 2026-10-29: local session, C6 melee abilities that protect

**What changed**

`auto/local-melee-guard`, stacked on `auto/local-keeper-cards`. Sim only; no message or event change.
- **Charge's dash is invulnerable**, as a roll is: `stepAbility` sets `invulnerable` while the dash runs and clears it when it lands on someone or runs its length, as Disengage already did. Its windup and recovery stay open. The server's step and the prediction set it alike, and a hit held back by the lag grace that lands during the dash is slipped, as with a dodge.
- **Whirlwind's spin takes `abilities.whirlwindDamageTaken` (0.3) of each hit and is never staggered**: in `hurtHero`, after armour; the windup and recovery take hits as before.
- Behind `abilities.meleeGuard`, off in the parity test. Tests: Charge invulnerable mid-dash and not in recovery; a heavy 20 mid-spin costs 6 and the spin goes on; with the switch off, the slice's. The first two fail on the old code. check 209, parity identical, test:net passed. Not felt by hand yet.

**Next**

- Michael approves the stack (`auto/local-playtest-fixes`, `auto/local-keeper-cards`, this) and feels the abilities in a fight. Then P12 and P13 (henchmen).

## 2026-10-29: local session, P11 keeper cards and P14 the village map

**What changed**

`auto/local-keeper-cards`, stacked on `auto/local-playtest-fixes`. Client only; no message change.
- **A keeper's card (P11).** F (or A) by Wren, Aldous, Marta or Fenn opens it at once: their line and their building's tier, then three 48 px buttons: their menu (choose a portal, browse the shelves, open the stash, hire companions), "Build tier N" with what it brings and its price (greyed with what is missing, or "Only the host can build here", or "As high as it goes"), Leave. Up and down (keys, arrows, stick, d-pad), F or A, Esc or B; a click works. It opens on the keeper's menu, so a second F never spends; building is one press, and the card stays up to say it is done and show the next tier. Walking off or a ring taking the party closes it. The press-again and hold-to-build paths are gone (`talkTo`, `secondTalk`, `upgradeHold`, `village.upgradeHoldMs`); `TalkUi` keeps the hint and lines said in passing (Wren after a portal is chosen).
- **The village map (P14).** M or Start in the village (the floor's map elsewhere): the square drawn from the level's data, each building with its tier, the ring, the well and the party; any direction or a click chooses a building, and beside it are what it gives, what the next tier brings, its price against what the village holds and what you carry, and whose keeper builds it. M, Start, Esc, Tab or B close it. Building stays at the keeper.
- **The corner** is one line top right: whose village, lumber and stone, an M. The party's frames have the top left back.
- Tests: the two smoke tests that talked to Wren use the card. check 206, test:net, smoke 7/7. In the browser by keys: every path above, tier II of the shrine built from the card for 80 coin, the map's five ways to close, and the map at 375 px with no sideways scroll. The pane's save put back after.

**Learned**

- A press that closes a screen must be used up by that screen: the map's own M closed it, then reopened it later in the same frame, until the map took M itself.

**Next**

- Michael approves the stack (`auto/local-playtest-fixes`, then this). The pad by hand on both. Then C6 (melee abilities) and P12, P13 (henchmen).

## 2026-10-29: local session, fixes from Michael's playtest of main 194321a

**What changed**

`auto/local-playtest-fixes`, from `main` (194321a, gate prep merged as #120). No message or event change.
- **Wearing something on a floor no longer heals.** A loadout refilled health while the run was `ante`, meant for between runs; a generated floor is `ante` between its fights, so equipping anything there was a full heal. Not on a floor now.
- **A potion press says why it did nothing.** G was reported as not working. It does (a floor in the browser: 99 to 127, one potion gone), but the sim refuses a drink at full health without a word, which the free heal above made common. Now "Already at full health" or "No health potions".
- **A struck enemy glows softly.** Every hit set the whole enemy to emissive 0.9 for 80 ms, past the bloom's 0.7 threshold, so a chain on pale skeletons was a stream of white flashes. `hitFeel.flashStrength` 0.25, on the panel; sparks unchanged.
- **A stuck henchman is put beside its player.** After `hirelings.stuckMs` (3 s) trying to walk without getting `stuckMoveM` (1 m) from where it started; only a moving command counts as trying, so a bow henchman standing to shoot never jumps. `unstickHenchmen` in `stepSim` after the doors.
- **Health grows with the level of the weapon in hand** (Michael: A, then "a flat like +10 or +25", since +1.5% "feels kind of pathetic"): +10 a level (`progression.healthPerLevel`, on the panel), so 290 at level 20 and 590 at 50 from 100; +25 would make 1,325 at 50 against enemies that do not grow with the hero. The server keeps the base (`PlayerState.hpBase`, gear and Vitality) and `refreshLevelHealth` sets the bar each tick in `stepPlayer`, server and prediction alike, so a level gained mid-fight shows at once; health keeps its share of the bar, so changing weapons is never a heal, and a loadout only caps it. The level-up toast says "+10 health". Off in the parity test (0, and no `hpBase`).
- Tests: a change of gear heals in the antechamber and not on a floor; a henchman behind the tavern's bar stays there at 80% of `stuckMs` and is beside its player at 130%; a bow henchman in a fight is never moved. The first two fail on the old code. Health: 290 at level 20 and 590 at 50, a weapon change keeps the share, a level mid-fight raises the bar on the next tick, a mid-floor loadout never heals, none of it with the switch off. check 206, parity identical, test:net passed. In the browser (at +1.5%), a level-10 sword on a 127 base read 144 / 144; the flat step is the same code with a sum for the product.
- **Asked and answered in chat** (decisions.md): keeper cards with buttons (P11), henchmen with their own XP capped by the Tavern (P12), a village map on M (P14), Charge with i-frames and Whirlwind at 70% less damage (C6); plus the party's frames with a head icon and more stats (P13). All in the backlog. Then asked whether a level should raise health on its own (it was only a talent point, the slice's design): A, built.

**Learned**

- "The potion does not work" was two bugs meeting: a free heal on equipping, and a refusal with no word. A silent refusal reads as a broken key.

**Next**

- Michael approves `auto/local-playtest-fixes`. Then P11 (keeper cards) and P14 (the village map) for the builder or a local session; P12 and C6 are deep-work.

## 2026-10-29: local session, gate prep: the Paused card and a shakedown run

**What changed**

`auto/local-gate-prep`, from `main` (9ef90ac). No message or event change.
- **The Paused card (the critic's bug, 28 Oct)** shows only when the player lets go of the mouse in play (Esc) with no other screen up, not whenever the mouse is unlocked. A join-link arrival who has not clicked, a pad player and a browser without pointer lock never see it over the fight. Esc, Start or A close it as well as Resume or a click. The party line says "1 player".
- **Henchmen come through doors** (found in the shakedown): `stepDoors` brings each henchman whose nearest player took a door through with them, side by side. Before, they stayed inside the tavern when their player walked out, since a door is a jump the server makes and the brain only walks at its leader.
- **Henchmen stand apart** (found in the shakedown): hired together, all three stood on one spot and were drawn as one figure. A henchman steps away from any hero nearer than `hirelings.spacing` (1.3 m); two on the very same point part along a direction from their ids, so the sim has no rolls.
- **The party's frames sit below the village panel**: both were at the top-left corner, so the henchmen's frames covered the village's lumber, stone and tiers.
- **The open Found-in-play bugs**, after the shakedown (Michael: "fix them, black walls first"):
  - The interiors' dark shells show only while the camera is inside one (`VillageView.setEye`); from the square they were the black walls past the palisade.
  - The melee dot holds the centre and reddens while a swing would find someone; a red chevron marks that enemy unless it is locked. With the bow or staff and free aim it was already pinned.
  - A Small run's floor always generates: a 14-piece floor must loop, and one spec in twenty found no seed in 64 that did, so the deeper ring failed for good. After 64 strict tries `generateFloor` tries 64 more without the loop; only specs that used to throw change, so no floor that played before is different. Swept: Small 3 floors 24 of 400 runs broken before, 0 after; the village's own plan 52 of 1000, 0; Small 8 floors 50 of 1000, 0.
  - The bots pace their commands on one clock across drives: back-to-back `drive(4)`s (walkTo) sent the first of each at once, over the server's 75 a second. Now 60.1.
- Tests: a door brings three henchmen through apart and clear of every door circle; three hired on one spot are over 1 m apart within 4 s and still with the party; the critic's Small floor generates, with a staircase and its rest room. Each fails on the old code. check 198, parity identical, test:net passed.

**The shakedown** (the in-app browser with an autopilot in the page, as `gate-party.ts` steers; a level 1 to 3 Knight, the save seeded with 1,500 coin and 400 lumber and stone, put back after):
- The tavern raised to tier III by the hold (272 coin, 136 lumber, 102 stone, as priced); Garrick, Bryn and Tamsin hired for 180 coin; through the shrine's door, Wren's Random tab (medium, 3 floors, Normal), into the ring, every henchman on every floor through every ring.
- Run 1, bronze sword: floor 1 cleared (3 rooms, downed once and picked up by a henchman), banked, rest room healed all; wiped in floor 2's second room. The card, the button home, the summary (2 finds banked, 2 lost from the bag, +36 coin, +18 lumber, +10 stone) all right.
- The store: an iron warhammer for 36 coin, worn from the hero screen by keys. Run 2: floors 1 and 2 cleared with no downs, never under 94%; wiped in floor 3's first room (two brutes and five archers left of it). Home with the henchmen; the summary said floor 3 of 3, +40 coin, the bronze sword lost.
- Two things that looked like bugs were the autopilot: walking round the end of the tavern's bar to stand behind it, and walking back in through a door it had just come out of.

**Learned**

- An autopilot walking straight lines finds door and interior bugs a scripted test does not, but it cannot judge a fight: it never blocks or parries, so its two wipes on floors 2 and 3 say nothing about the difficulty. That is the gate's to judge.
- Not seen yet: a story dungeon cleared, either modifier, the stash, a pad.

**Next**

- Michael approves `auto/local-gate-prep` and plays the gate. The one open Found-in-play bug, corrections climbing as the frame rate falls, needs a desktop reading at 20 to 30 fps.

## 2026-10-29: local session, D3: wear a find straight away

**What changed**

`auto/local-wear-finds`, stacked on `auto/local-tavern-hire`. Event shape changed (`banked` gains `kept`); no message change.
- **A find on a floor goes into the bag at once,** marked carried (`ProfileData.carried`, by uid): wearable outside a fight like anything else, worn straight onto a bare slot as any find is. The server still keeps its own list of what is carried (P1) and decides the loss.
- **The bank:** `banked` now hands over only what still lay on the ground (`items`) and says how many carried finds it made safe (`kept`); the browser clears its marks.
- **A wipe takes every carried find wherever it is,** in the bag, in the pocket or worn (decisions.md 28 Oct: wearing a find is never a way round the risk), then the bag past the pocket (D5). A hero left with nothing in hand takes the best weapon left in the bag, or a plain one of their kind. Marks still there on reaching a village (a floor left early) are lost too.
- **Marked on the hero screen:** a dashed amber cell with "carried", and the item's words say it is lost on a wipe until banked. Also fixed: the bag's pocket stripes (D5) never reached the hero screen's cells, only the stash's.
- Tests: the loop's bank test now expects a carried find as kept, not handed over again. check 195, parity identical, test:net, smoke 7/7. In the browser (the gate): a helm picked up on floor 1 went onto the bare head, marked carried; a wipe took it off the head; picked up again and banked, it stayed and was no longer carried. The pane's save put back after.

**Next**

- Phase 2's backlog is built. The gate is Michael's: a solo evening of three to five runs with henchmen on the hosted build, which needs the stack approved and merged first. The producer words the questions.

## 2026-10-29: local session, P10: the tavern's hires

**What changed**

`auto/local-tavern-hire`, stacked on `auto/local-henchmen-kits`. Protocol 16. Built to Michael's tavern mockup ("The Rusted Stag: Hire Companions").
- **The hires stand in the room:** Garrick (Sellsword), Bryn (Archer) and Tamsin (Hedge-mage) wait in a row before Old Fenn's bar as figures with name tags; one hired leaves the row.
- **The board:** a second F (or A) to Old Fenn opens it, the camera holding on the three, the title top left, a card each along the bottom (name, kit in its colour, a weapon of its kind as the bag draws it, a line on how it fights, and Hire for `village.hireCoin` (60) coin, or "With you, let go"). Left and right choose, F or A hires, X or Q lets one go, Esc leaves; clicking works too.
- **The rules:** a new `hire` message (a kit and the coin held) and `dismiss`; the village's room sends as many at once as the Tavern's tier allows (one, two, three), one of each kit, within the party's four, and a tier-4 Tavern's hires read telegraphs in `hirelings.quickReact` (70%) of the time. The browser pays on `hired`. Anyone in the village may hire, for their own coin.
- **They follow the party:** `HostRoom.handOff` takes the room's henchmen as cards (name, kit, level, quickness) into the next room, new or open, and the last player sent home from an end card takes them too. A friend joining a full party takes a henchman's slot (any room, not only the village or a rest room as the backlog said). Hires last for the session; a new visit to the game starts without them.
- Old Fenn's line, and the debug panel's henchmen now named for their kits.
- Tests: cards carry a henchman out of one room and into another, a friend joining a full party takes a henchman's slot, a quick hire answers sooner, the wire (`henchman.test.ts`); test:net: one hire at tier 1, two at tier 2 after raising the Tavern, a friend joining the full party takes a henchman's slot, and a henchman hired in the village follows the party through the ring onto the floor. check 195, parity identical, test:net, smoke 7/7. In the browser at 1366 by 768: the board over the three, Bryn hired for 60 coin and with the party (`docs/screenshots/tavern-hire.jpg`); the pane's coin put back after.

**Next**

- The Phase 2 gate is Michael's: a solo evening of three to five runs with henchmen on the hosted build (a party of four needs the Tavern at tier 3). The producer words the questions and files it.

## 2026-10-29: local session, P6: the bow and staff henchmen

**What changed**

`auto/local-henchmen-kits`, stacked on `auto/local-henchman`. No protocol change.
- **Three kits in turn:** "Add a henchman" now brings a sword (Garrick), then a bow (Bryn), then a staff (Tamsin); `addHenchman` also takes a kit.
- **Range:** the bow keeps `hirelings.bowRange` (10 m), the staff `staffRange` (8 m), and both step back from anything nearer than `rangedMin` (4.5 m) while still facing it.
- **Abilities:** every `abilityCheckTicks` a henchman with a ready ability and a target in reach uses one on `abilityChance` (40%).
- **Combos, sometimes:** `comboChance` (half) of the time it turns on an enemy someone has set up (Shatter, Skewer or Detonate), to pay it off; which ticks it does so come from the tick and its id, with no roll.
- **Reviving:** with nothing threatening it, a henchman goes to a downed friend (players before other henchmen) and holds talk until they are up. It can go down itself, and players revive it as they would a friend. Party scaling already counted every hero, henchmen included.
- Tests: the kits in turn; a bow steps back, closes and shoots in range; a downed player is revived; three henchmen pay off a combo in a fight (the gate's callout). check 192, parity identical, test:net, smoke 7/7. In the browser, on floor 1 of seed 11, Garrick, Bryn and Tamsin cleared the guard room with none of them hurt, Bryn shooting from 9.8 m and Tamsin from 7.8 m. Three may be too strong for floor 1; the gate's run to floor 3 will say.

**Next**

- P10, the tavern's hiring room (after Michael's mockup: the henchmen standing in the room, each with a card and a price), henchmen following the party through rings and giving their slot to a friend who joins. Then the Phase 2 gate.

## 2026-10-29: local session, P3: a henchman who fights

**What changed**

`auto/local-henchman`, stacked on `auto/local-modifiers`. Protocol unchanged but for a new cheat.
- **The brain** (`shared/src/sim/henchman.ts`): a hero in a party slot with no browser, `PlayerState.henchman`, whose command HostSession writes each tick from the sim (server only, deterministic, its rolls from the sim's rng). It follows the nearest player, fights the nearest enemy near itself or its leader (closing, then pressing attack every `hirelings.attackEveryTicks`, so it chains), and when it stands in an enemy's telegraph it notices only after `hirelings.reactMs` (450 ms; a player about 250), then dodges out (`dodgeChance`, 55%) or raises its guard. Every number is a slider under `hirelings`.
- **In the party:** `HostSession.addHenchman` (a debug cheat, "Add a henchman", until the tavern hires them in P10) adds a sword henchman at the asking hero's level, named Garrick, Bryn, Tamsin or Odo, within the party's four. It is drawn as any other hero with its name over it and listed in the party panel. Rings, the rest room's bank and loot pass it by (the players decide when to go, and loot is theirs); it does not yet follow through a ring (P10).
- **Two smoke-test fixes the run surfaced:** talk now reaches 3 m (it was 2.4), since a hero pressing on a keeper's counter slides along it and can end out of reach; and the test's walks stop when a hand-off takes the hero out of the snapshot.
- Tests: a henchman alone kills three grunts and takes hits; it reads a telegraph only after `reactMs` and answers it once; rings and loot pass it by and the party's cap holds (`henchman.test.ts`). check 188, parity identical, test:net, smoke 7/7 three runs in a row. In the browser: on floor 1 of seed 11, Garrick cleared a guard room and its reinforcements alone in about 20 s while the player stood in the doorway, going from 100 to 66 health (`docs/screenshots/henchman.jpg`).

**Next**

- P6, the bow and staff henchmen (range, abilities, combos now and then, reviving a downed player), then P10, the tavern's hiring room after Michael's mockup, with henchmen following through rings. Then the Phase 2 gate.

## 2026-10-28: local session, P8: Cursed and Haunted; doors made the server's

**What changed**

`auto/local-modifiers`, stacked on `auto/local-interiors`. Protocol 15.
- **Two modifiers** (`portalChoice.ts` `MODIFIERS`): **Cursed**, no revives (`stepRevives` does nothing on a cursed floor; a downed hero still gets up once the room is cleared) and double loot (a big room drops twice); **Haunted**, every enemy but the Warden gets up once, `dungeon.hauntedRiseMs` (1.2 s) after it falls, at `dungeon.hauntedHp` (half) its health, in a green breath with a groan; a room does not clear while a fallen enemy is still to rise.
- **Where they come from:** a fifth row on Wren's Random tab (None, Cursed, Haunted, each with its words), and a story dungeon may carry one (Emberhall is Haunted). The choice, the run's plan, every floor's spec and `SimState.floor` carry it; the ring's label and the floor's line top right name it. Floor-only, so the parity hashes are the slice's.
- **Doors are the server's alone now** (`stepDoors` in `stepSim`, out of `stepPlayer`). The smoke test caught the browser's prediction taking a door the server did not, when a walk grazed its edge, and snapping back from inside; a player brushing a door would have seen the same. The browser's hero now follows the server through a snapshot later, and a jump that long is not counted as a prediction snap.
- Tests: the modifiers on the wire and down to the floor, Cursed blocks a revive (a normal floor allows it) and doubles a big room's drops, Haunted rises once at half health and holds the room until the second fall (`modifiers.test.ts`); doors are not taken by a hero stepped alone (`interior.test.ts`). The smoke test's stop at Wren's table is tighter (it could end past talk range). check 185, parity identical, test:net, smoke 7/7 three runs in a row (two runs before those failed the Wren menu test, which passed alone; watch it).

**Next**

- The henchmen (P3, P6, P10), the tavern's hiring room after Michael's mockup. Then the Phase 2 gate.

## 2026-10-28: local session, interiors: the store, the storehouse and the tavern

**What changed**

`auto/local-interiors`, stacked on `auto/local-shrine-interior`. No protocol change. Michael, 28 Oct, after the shrine's screenshots: "this works for the interiors… just make sure each interior matches its intent and is unique." They can be dressed up later, or stay as the lower tiers' rooms.
- **Three more rooms** in the village level, each far off the square in its own direction, each reached through its building's door, each keeper now inside behind a counter facing the door:
  - **Aldous's General Store** (east): plaster and timber walls, a plank floor, his counter with scales, a till and coin, three boards of jars, bottles and boxed goods behind him, a rack of swords, bows and a shield on the east wall, barrels and sacks by the west, a red rug, two warm lanterns.
  - **Marta's Storehouse** (west): a stone floor and plank walls, racks of crates and chests down both walls, stacked crates in the corners, the strongroom's iron vault (a brass wheel, rivets) behind her desk with its ledger, quill and one candle, cool lanterns.
  - **Old Fenn's Tavern** (south; the Rusted Stag of Michael's mockup): timber walls, the bar with mugs and four kegs behind it, a stone hearth with a fire and a flickering orange light, three tables with stools, mugs and candles, a ring of candles overhead, the stag's head and the order's blue banners over the kegs.
- **Each in its own materials** (`INTERIOR_STYLE`), with candle and hearth light that flickers. Shared door and furniture drawing; furniture the dressing draws itself (barrels, kegs, crates) is no longer a plain box.
- **The store and the stash are framed by their rooms** like Wren's menu: the camera holds a shot of the keeper at their counter, the menu to the right on a wide screen; the talk box closes as a menu opens.
- Tests: every building in and out, its keeper in reach at the counter, every inside far from the square and the others (`interior.test.ts`); the village solidity test now runs into the store's wall away from its door. check 180, parity identical, test:net, smoke 7/7. Screenshots of each room in `docs/screenshots/`.

**Learned**

- **A test that ran into a building's door now walks inside it**: doors are the one place a wall is not a wall.

**Next**

- P8, the two modifiers, then the henchmen; the tavern's hiring room (P10) after Michael's tavern mockup.

## 2026-10-28: local session, interiors: Keeper Wren's shrine

**What changed**

`auto/local-shrine-interior`, stacked on `auto/local-portal-menu`. No protocol change. Michael's call (decisions.md "Wren's portal menu"): interiors you can enter, the shrine first, for him to judge.
- **The inside is part of the village level** (`village.ts`: `InteriorDef`, `DoorLink`): a 14 by 12 m room far north of the square, out of sight, with walls, a table and two bookshelves as colliders. Its walls fade for the camera as a dungeon's do. Keeper Wren stands inside now, at her table.
- **Doors** (`throughDoor` in `stepPlayer`): stepping into the shrine's front door puts the hero inside facing in, and the inside door puts them back on the square before the shrine, past the ring. In `stepPlayer` so the browser's own hero goes through at once and the server agrees; each arrival lies outside the other door's circle. One room, so friends see each other go in; no loading. The camera snaps through with the hero, facing in.
- **The room** (`VillageView.buildInterior`): dark stone and planks, a dark shell hiding the sky and woods, Wren's table with a violet orb (its light) and candles, two candle stands with warm lights, shelves of books, crystals in the far corners, a violet rug and a rune circle before her, and the doorway's daylight.
- **Her menu is framed by the room:** while it is up the camera eases to a set shot from the room's front, Wren and her orb in the left third; on a wide screen the menu sits to the right so she shows (Michael's mockup). Her words close as it opens.
- Tests: a hero walks in through the front door and out through the inside one, no arrival in a door's circle (`interior.test.ts`); the smoke tests that talk to Wren now go round the ring, into the shrine and out. check 176, parity identical, test:net, smoke 7/7 twice. In the browser: in and out with no correction, the room, and the menu over the framed shot at 1366 by 768.

**Learned**

- **A test that steers the camera at a door keeps steering after it,** walking the hero straight back through: the smoke helper stops turning once the hero is on the far side. A player holding W after a door walks on into the room, since the camera turns with them.
- **Wren stood 2.3 m from her table's front** with talk reaching 2.4: she now stands against it.

**Next**

- Michael judges the shrine. Then the store's, the storehouse's and the tavern's insides the same way (the tavern with P10's hiring room, after his mockup), and P8.

## 2026-10-28: local session, P7: Keeper Wren's portal menu

**What changed**

`auto/local-portal-menu`, stacked on `auto/local-stash`. Protocol 14. Built from Michael's mockup and answers (decisions.md "Wren's portal menu").
- **The rules** (`shared/src/game/portalChoice.ts`): five difficulties, Easy (-25%) to Legendary (+150%), each filling every room with that much more of the budget and paying that much more (`depthMult`); the shrine opens Normal at tier 1 and one more a tier. Three sizes (12, 22, 34 pieces on the first floor, more each floor), 1 to 8 floors. Five story dungeons to start: The Old Cellar (hand-built), Mossgate Barrow, The Saltmarsh Warrens, Emberhall, The Hollow Crown, each with a level range (a guide), words, reward slots and key enemies; the generated ones from a fixed seed, so each is the same place every time. A run's plan and every floor's spec carry the difficulty and the story id.
- **The menu** (`client/src/ui/PortalScreen.ts`): a second F (or A) to Wren opens it, violet and candle-coloured after the mockup. Story tab: the dungeons in order, locked until the one before is cleared, each with its picture of rewards (as the bag draws those slots), key enemies and Open Portal; the player's own editor dungeons follow. Random tab: floor count, size, the themes shown locked ("later"), difficulty with the locked ones saying which shrine tier opens them, and Reshape Portal. Q and E (LB, RB) change tab, up and down choose, left and right change a setting, F or A opens, Esc, Tab or B leave; clicking works too.
- **The server**: a new `portal` message; `VillageRoom` refuses a difficulty past its shrine's tier and leads the ring with the choice. Whether a story dungeon is open is the browser's to say (progress is in its save until Phase 3); a win records the story cleared and says which opens next.
- **A second word now acts on letting go of F.** Holding F to build (P4) begins with a press, which at a keeper already talking was taken for opening their menu; now a hold that builds opens nothing.
- Tests: difficulty caps, the wire, plans and specs carrying difficulty and story, a story dungeon the same whatever the server's seed, harder paying more (`portalChoice.test.ts`); test:net: Hard refused at shrine tier 1, a random choice and a story one taken, the ring saying so; the smoke test's Wren case now opens the menu and takes story 1. check 174, parity identical, test:net, smoke 7/7. In the browser: the menu by keys, both tabs, a large 3-floor Normal run reshaped and the ring saying so.

**Learned**

- **Only four enemy kinds exist** (grunt, archer, brute, the Warden), so the key enemies are those until E1's themes. Rewards are slots, not items, until a story dungeon has a loot table of its own.

**Next**

- Wren's shrine interior, enterable, her menu framed by the room (decisions.md, interiors), for Michael to judge before the other three.
- Then P8, and the henchmen with the tavern's hiring room (Michael's tavern mockup).

## 2026-10-28: local session, P9 and D5: Marta's stash, and the bag at risk

**What changed**

`auto/local-stash`, stacked on `auto/local-general-store` (which also gained the store's rows drawn as the bag's cells and the respec at Wren's shrine, after Michael's look). No protocol change.
- **Marta's stash** (P9; Michael's answers, decisions.md "The stash's design"): a second F (or A) to Marta opens it, in the village that is yours. The stash is a wide grid, 8 across like a RuneScape bank, the bag beside it 4 across. It holds `village.stashBase` (16) spaces and `stashPerTier` (8) more a Storehouse tier: 16, 24, 32, 40. F or A (or a click) picks an item up and puts it down, swapping with what is there; X on a pad (Q, or a shift- or right-click) sends it straight to the first free space on the other side; Esc, Tab or B puts a held item back, then leaves. The stash lives in the owner's browser with their village save (P2), never sent to the server, until Phase 3's ledger; the room's word on lumber, stone and tiers no longer overwrites it. A visitor is told their things are in their own village.
- **The bag at risk** (D5; decisions.md 28 Oct, extraction-style): a wipe on a floor now also sends each player `bagLost`, and the browser empties its bag but for the safe pocket, the bag's first `village.pocketBase` (3) spaces and `pocketPerTier` (1) more a Storehouse tier. Worn gear and the stash are never touched. The pocket is marked (striped) on the hero screen and at Marta's; a find never lands in it by itself, so what goes there is the player's choice, made at Marta's. The run summary counts what the wipe took; a toast says so.
- Marta's line, and the Storehouse's words on its tier, say what is safe.
- Tests: the wipe sends `bagLost` to each player (`loop.test.ts`). check 170, parity identical, test:net, smoke 7/7. In the browser: two items quick-moved into the stash, one picked up and put into a pocket space (swapping), the grid and the striped pocket; a `bagLost` took the three items past the pocket and kept the pocket, the two worn pieces and the stash. The pane's save put back after.

**Learned**

- **A find put in the first free space would have gone straight into the pocket,** making the risk vanish for anyone with a near-empty bag. Finds and taken-off gear now skip the pocket.
- **The village's room replaced the whole save,** which would have wiped the stash the moment the village answered. It now replaces only what the room holds.

**Next**

- P7, the portal board, after asking Michael about Wren's dungeon chooser (he has thoughts). Then P8, and the henchmen.

## 2026-10-28: local session, P5: coin and the General Store

**What changed**

`auto/local-general-store`, stacked on `auto/local-village-tiers`. Protocol 13.
- **Aldous's shelves** (`shared/src/game/store.ts`): rolled each day (UTC) from the catalogue, `storeStock` items for the store's tier (4 at tier 1, 2 more a tier). Commons only, of materials up to a tier above the store's; the first three are a melee, a ranged and a magic weapon, so there is always one for another weapon kind. Each place is rolled from the whole catalogue and brought down to the best material the store can get, so raising the store keeps the same things in better materials and adds more. `VillageRoom` keeps the day's shelves (and what was bought from them) and sends them with the village.
- **Prices** in `tuning.village`: a tier-1 common costs 20 coin, each tier 1.8 times more, a rare three times; Aldous pays 30% of his price.
- **Buying and selling.** A second F (or A) to Aldous opens the store: the shelves and the bag side by side with prices and the coin you hold; up and down to choose, left and right to change side, F or A to buy or sell, Esc, Tab or B to leave; clicking works too. New `buy` (a shelf uid and the player's coin) and `sell` (a bag item, checked as D13's drop is) messages; the room answers `bought` (the item, the price) or `sold` (the uid, the price) and the browser changes the bag and the coin. Anyone in the village may trade, visitors too; a bought item is gone from the shelf for everyone until tomorrow.
- **A champion point taken back now costs coin, at Keeper Wren's shrine** (`village.respecCoinPerPoint`, 15 a point, a reset all of them; decisions.md 27 Oct: free until coin came; Michael, 28 Oct, liked the shrine as the place). Within 6 m of Wren the Champion tab takes points back and shows the coin held; elsewhere it says where to go. Wren says so too.
- After Michael's look at the first version: each row on the store's lists is drawn as the bag draws an item (its icon in a cell with the shape's name and rarity), then what it does, then its price.
- Aldous's line no longer says his shelves are bare.
- Tests: prices, the day, the shelves (the same all day, a weapon of each kind first, commons within the tier, the same things better as the store rises), the wire (`store.test.ts`); test:net's village now has a visitor refused short of coin, then buying a shelf item that leaves it for both, and selling it back at Aldous's price. check 170, parity identical, test:net, smoke 7/7. In the browser: the store opened on a second F, a warhammer bought (300 to 264 coin, the shelf one short), a staff sold for 6, Esc closed it; the pane's save put back after.

**Learned**

- **Rolling each tier's shelves from that tier's catalogue reshuffled them** when the store rose (an oak shortbow became an elm one, the cape changed colour). Rolling from the whole catalogue and capping the material keeps a shelf a shelf.
- **Coin is still the browser's,** so the room takes the buyer's word for it, as with upgrades; the item a seller names is checked as an item could be, and the bag is the browser's to empty.

**Next**

- P9 and D5: the Storehouse's stash, and the bag at risk. Then P7, P8.
- Michael: prices are a first guess (`village` sliders).

## 2026-10-28: local session, P4: the four buildings' tiers

**What changed**

`auto/local-village-tiers`, stacked on `auto/local-village-save`. Protocol 12.
- **Prices** in `tuning.village`: tier 2 costs 40 lumber, 30 stone and 80 coin, and each tier after 2.4 times the one before (tier 3: 96, 72, 192; tier 4: 230, 173, 461). Lumber and stone are the village's; coin is the owner's, in their save.
- **What a tier gives** (`villageSave.ts`, for P5, P7, P9 and P10 to use): the shrine opens portals up to one tier above its own; the store stocks 4 items a day and 2 more a tier; the storehouse keeps 12 spaces a tier; the tavern hires a henchman a tier to three, and at tier 4 they are quicker.
- **Building one.** Each building's keeper (Wren, Aldous, Marta, Old Fenn) now says its tier, what it gives, what the next would bring and cost, and what the owner still needs. The owner holds talk (F, or A on a pad) for `village.upgradeHoldMs` (0.9 s) to build it, a hold so spending is never an accident; the hint shows it and fills while held. A new `upgrade` message carries the building and the owner's coin; `VillageRoom` takes it only from the owner, checks the village's lumber and stone and the coin they say they have (their browser holds it until Phase 3), pays, raises the tier, sends everyone the village and the owner an `upgraded` message, whose browser takes the coin and says so. A visitor hears it is the host's to build.
- **The tier shows** on the building: a pennant on the roof for each tier (the top one gold), and the numeral on its sign ("General Store II").
- Tests: prices, what is missing, paying, the top tier, the wire (`villageSave.test.ts`); test:net's village run now has the visitor refused, the owner refused short of coin, then the store raised to tier 2 with the village paying lumber and stone and both players seeing it. check 166, parity identical, test:net. In the browser: Aldous's words, the hold filling, the store raised (coin 300 to 220, lumber 150 to 110, stone 120 to 90), the panel and the sign saying II after a reload. The browser pane's save was put back after.

**Learned**

- **Coin is the player's and lives in their browser,** so the room takes the owner's word for how much they have, as it takes a loadout's. Phase 3's ledger ends that.
- **Wren already uses a second F to turn the ring,** so holding F at her to raise the shrine also turns the ring if her words were already up. Small; a press-on-release for the ring would part them.

**Next**

- P5, coin and the General Store (Aldous's stock, sized by the store's tier), then P9 and D5, P7, P8.
- Michael: the prices are a first guess (`village` sliders); a run banks about 100 lumber and 70 stone over three floors.

## 2026-10-28: local session, P2: the village save

**What changed**

`auto/local-village-save`, stacked on `auto/local-dodge-smash`. Protocol 11.
- **The village is a save of its own** (`shared/src/game/villageSave.ts`): an id, lumber, stone and the four starting buildings' tiers (1 to `village.maxTier`, 4). The browser keeps it under P1's key, which gains the id and the tiers on first load.
- **The hello carries it when joining a village.** The server checks it (`readVillageSave`: an id, whole counts within bounds, tiers that exist; a bad one refuses the hello whole) and `VillageRoom` keeps the first one it is given. From then on the room's copy is the village: a floor's bank adds to it on the server (`FloorRoom.onEvents` credits the village the run came from).
- **A new `village` message** goes to each player on joining and whenever the village changes: the save without its id, the host's name, and whether it is this player's own (their hello carried the same id). Only the owner's browser keeps it, replacing its save with the room's count; a visitor's own save is never touched. A panel top left shows "Your village" or "Vale's village", the lumber and stone and each building's tier.
- The browser still adds its own banks to its save as they happen, so a tab closed mid-run keeps them; the room's count, which has them too, replaces it on the way home.
- Tests: the save's bounds and the hello (`villageSave.test.ts`); test:net's village run now brings two saves and checks the gate: the maker's is the room's, the visitor is told it is the host's, and the run's two banks grew it from 10 lumber and 5 stone to 15 and 9, seen by both. check 163, parity identical, test:net. In the browser: the panel in the village, the save given an id.

**Learned**

- **Ownership by room code broke on the way home,** because a session id changes with every room. An id kept in the save, never sent back to anyone, is what says whose village it is.
- **"Costs it could have paid"** cannot be checked yet: no tier has a price until P4, and the save does not record what was spent. P4 can keep a running total of lumber and stone earned if the check is wanted.

**Next**

- P4, the buildings' tiers: prices in `tuning.village`, an upgrade at each building's villager, and the tier showing on the building.

## 2026-10-28: local session, D9's scaling and D4: a quicker roll with perks, things to smash, the health potion

**What changed**

`auto/local-dodge-smash`, stacked on `auto/local-bigger-rooms`, one commit each (and the docs). Protocol 10.
- **D9's scaling (Michael: option A).** Each Second wind rank (the level-40 row) takes `talents.windCancelMsPerRank` (10 ms) off the point a roll can be cut, and each Light step rank (champion) `champion.lightstepCancelMsPerRank` (4 ms), never under `dodge.cancelFloorMs` (110). Maxed, both bring 170 ms to 110. Both perks' text says so. With neither, it is `cancelAfterMs` to the bit, so parity is untouched.
- **D4, things to smash.** Crates, barrels and urns stand against the walls of a generated floor's rooms and halls (not the rest room or a stair, never within 3 m of a doorway), placed from the floor's seed in `floor.ts` so every browser has the same; the sim keeps only which are broken (`SimState.floor.broken`), so a snapshot grows by a few ids. About 20 to 30 a floor, 4 to 7 a fight room, over five seeds. Any hero's blow breaks one: a swing in its arc, a shot (it stops there), a burst, a whirlwind's turn, a charge, a bash, a frost ring (`sim/smash.ts`). A crate or barrel gives `loop.smashLumber` (1), an urn `loop.smashStone` (1), carried by the party until the floor banks (with the deeper floors' bonus) and lost with a wipe. They do not block movement. Drawn from primitives (`client/src/render/PropView.ts`; the repo has no KayKit models, everything is made in code), with splinters or shards, dust, a sound, and "+1 lumber" floating up.
- **D4, the health potion.** `loop.potionChance` (12%) of smashed props drop one on the floor; the first standing hero over it with room on the belt (`loop.potionMax`, 3) takes it. G, 4 or d-pad left drinks one (`PlayerCommand.drink`, a press, predicted like the rest): `loop.potionHeal` (40%) of max health at once, not at full health, one a second. The belt is `PlayerState.potions` on the server; the browser saves the server's count and brings it into the next room on the loadout (`Loadout.potions`, clamped, taken on joining only; rule 1's accepted exception, like the bag). The HUD shows "Health potion ×N G" under the draughts, and a toast names the keys.
- Tests: the scaling (ranks, the shut row below 40, the floor, i-frames kept); placement (the same every build, against a wall, nowhere it should not be); a swing breaks what is in front and not behind; an arrow stops at a crate; banking pays the smashed lumber and stone, a wipe loses them; a potion rolls out, waits for a belt with room, and is taken; drinking heals, waits a second, refuses at full; the loadout's belt and the `drink` press on the wire. check 160, parity identical, test:net, smoke 7/7. In the browser: a swing broke a crate and an urn (1 lumber, 1 stone), a potion rolled out and went on the belt, the save kept it into the arena, and a drink took 118 back to 127.

**Learned**

- **A level shot flies over a crate.** Arrows leave at chest height and a crate is under a metre, so a crate is broken by aiming down (D12's free aim) or by a swing. The soft target never picks a prop.
- **A handoff carries the loadout ClientSession kept at the last gear change,** so the belt would have been lost at a portal. The browser now refreshes that loadout whenever it saves (`ClientSession.keepLoadout`), without sending it.
- **`Object.assign` cannot set a three.js mesh's position** (it is a read-only property); tsc does not catch it. The first PropView threw on every floor.

**Next**

- Michael plays a floor: smash, drink, and judge how much the props pay and how often a potion drops (sliders under `loop`).
- Then, village first (Michael, 28 Oct): P2, P4, P5, P9 with D5, P7, P8, then the henchmen, then the gate.

## 2026-10-28: local session, D10, D13, D12, D2: death and home, drop to the floor, free aim, bigger rooms

**What changed**

Four stacked branches on `auto/local-dungeon-rules`, one commit each (and the docs): `auto/local-death-home`, `auto/local-drop-to-floor`, `auto/local-free-aim`, `auto/local-bigger-rooms`. Protocol 9.
- **D10, death and going home.** A downed hero lies still (`coop.crawlSpeed` 0; T5's 1.1 is a slider away). A wiped floor's party stays down and no ring opens. The card reads "You died" solo or "Your party was defeated", with a 48 px Return to the village button (F, A). The button sends a new `home` message and `FloorRoom` hands that player alone (`HostRoom.handOne`) to the village the run left from. A win keeps its ring and gains the button. The mouse is freed for the button and the pause card stays away.
- **D13, drop to the floor.** Drop on the hero screen sends the bag's item in a `drop` message, checked as a catalogue item with a bonus a roll could give (`readGearItem`). The server lays it at the hero's feet as a drop only its owner sees, marked `dropped`: taken back only once the owner has stepped away, never banked, carried or lost, and kept when a rest room banks. At most `gear.maxDropped` (12) a player in a room. Handing items over waits for Phase 3.
- **D12, free aim over the shoulder.** With a bow, staff, crossbow or wand out and no lock-on, the camera moves 0.85 m right of the hero (short of any wall) and comes in to 80%, and the reticle pins to the centre. The browser casts from the camera through it against walls, the floor and enemies' bodies (`client/src/game/aim.ts`) and sends the heading and pitch from the hand to what it met (`PlayerCommand.aimPitch`, optional, clamped). A ranged attack or ability with free aim skips soft targeting, tracks the aim while drawn, and leaves along it; lock-on keeps the slice's aim. In the browser, the server's arrow left at pitch 0.154 for an aim of 0.157, on the same heading.
- **D2, rooms a size up.** Four new kit rooms the generator fights in: a 3x3 guard room, a 4x4 hall of pillars, a 6x5 great hall, a 7x7 pit (18 to 42 m across, was 12 to 30). The old four stay in the kit and the editor, so the Old Cellar and any saved hand-built dungeon are unchanged. `dungeon.budgetPerCell` 1 to 0.6. Solo, every enemy a room sends, over 30 seeds:

| Room | Floor 1 | Floor 3 | D1's room, floor 1 / 3 |
| --- | --- | --- | --- |
| Guard room (3x3, was 2x2) | 5.3 | 7.4 | 3.6 / 6.2 |
| Hall of pillars (4x4, was 3x3) | 7.1 | 10.0 | 6.3 / 10.0 |
| Great hall (6x5, was 4x4) | 11.5 | 18.6 | 10.5 / 15.7 |
| The pit (7x7, was 5x5) | 19.0 | 30.5 | 16.6 / 26.2 |

- The floor banners lost "the doors are shut" and the "+40% health" a clear no longer gives (D7, D8 left them).
- Tests: a wipe leaves no ring, keeps the party down and answers `home` only then; a downed hero lies still (and crawls with the slider up); dropping (owner only, after stepping away, not banked, the cap, the item check); free aim (pitch and heading, tracked to release, lock-on and no pitch keep the slice's aim, the wire's clamp). The generator's walk test now checks a big floor has a staircase, not that the way through crosses one. check 151, parity identical, test:net. In the browser: the death card and its button home, a drop round trip in the village, the shoulder camera and an arrow on the aim, a guard room and the hall of pillars.

**Learned**

- **A wiped party used to stand back up to walk to the ring,** because the slice gets heroes up outside a fight. On a floor the end card now holds them down.
- **Picking a dropped item straight back up** is what happens if it lands at your feet with nothing else said, so a dropped item waits for its owner to step away.
- **Free aim needs the shot aimed from the hand, not along the camera.** The camera sits behind and right; aiming along its ray would land every shot left of the reticle, so the browser finds what the ray meets and aims the hand at that.
- **Bigger rooms at D1's density would double the enemies,** so the budget a cell came down to keep D1's counts and give the space to moving.

**Next**

- Michael plays a floor with a bow and a staff (free aim), dies once (the card), drops something, and judges the room sizes and the counts above.
- D9's scaling still wants his answer.
- Then D3 (wear a find straight away), D4 (smashables and the health potion), P9 and D5 (stash, bag at risk).

## 2026-10-28: local session, D7, D8, D9, D11: no heal per room, open doors, a quicker dodge, a reticle

**What changed**

Michael played D1 ("plays pretty well") and sent eight notes (decisions.md, "After playing D1"). The four contained ones are built on `auto/local-dungeon-rules`, stacked on `auto/local-denser-fights`, one commit each.
- **D7, no heal after each room.** A cleared room on a generated floor heals `dungeon.healOnClear` (0) instead of the slice's 40%; the rest room heals every standing hero `dungeon.restHeal` (full) as it banks, and its banner says so. The arena keeps `run.healOnWaveClear`.
- **D8, the doors stay open** (`dungeon.shutDoors`, off). A fight room's fight starts on the first hero in; nobody waits at the door, nobody is pulled in, and the room never walls anyone in or out. T4's shut doors stay behind the switch, and their tests turn it on.
- **D9, a shorter dodge recovery.** `dodge.cancelAfterMs` 240 to 170 ms: any input ends the roll's tail sooner. A roll cut short now keeps the rest of its i-frames (`dodge.keepIframesOnCancel`), because in the slice cutting the tail also ended them, and a held stick cuts it at once, so a shorter tail alone would have made every dodge leakier. The parity test puts back 240 and the slice's ending.
- **D11, a reticle** (`client/src/ui/Reticle.ts`): a dot for melee, a crosshair for the bow and crossbow, a ring for the staff and wand, drawn where the next swing or shot goes. That is the enemy the sim's soft targeting would pick (`pickSoftTarget`, tinted red), or a point ahead along the camera's heading. It glides between targets (`lockOn.reticleRate`) and hides behind the pause card, the hero screen and when down.
- Tests: open doors (a straggler stays where they are, a hero runs out mid-fight), no heal on a clear and a full one in the rest room, the dodge's tail ending under 240 ms with its i-frames kept (and leaking with the switch off). check 142, parity identical, test:net, e2e 14/14 (smoke 7/7). In the browser the dot sits ahead of the knight and the bow's crosshair turned red on a grunt.

**Learned**

- **Soft targeting ignores walls.** The bow's crosshair turned red on a grunt in the next corridor, because the sim would turn a shot toward it. The reticle is honest about that; the sim's choice is D12's to revisit with free aim.
- **With the camera behind the hero, the screen's centre is the hero's head,** so a mark at the screen centre would sit on the hero. Until D12's over-the-shoulder camera, the mark sits on a point 10 to 14 m ahead.

**Next**

- Michael plays a floor: the three rules and the reticle. All the numbers are sliders (`dungeon.healOnClear`, `dungeon.restHeal`, `dodge.cancelAfterMs`, `lockOn.reticleRate`) and `dungeon.shutDoors` a switch.
- D9's scaling with levels and perks needs his answer (Second wind's milestone and a Nimble champion perk, recommended).
- Then D10 (death and the button home), D13 (drop to the floor), D12 (free aim), D2 (bigger rooms): all deep work.

## 2026-10-28: local session, D1: denser fights

**What changed**

- **About twice the enemies a room** (`tuning.dungeon`): a budget of 1 a cell (was 0.45), +35% a floor deeper (was 25%), 2 for each player past the first (was 1.5), and 70% of it in the first group (was 60%), so a room arrives as a fight.
- **Guard rooms mix in archers,** at most one for every two blades. They were grunts only, which made them a queue.
- **Three attackers a hero on a generated floor** (`dungeon.attackersPerHero`). The slice's two (`grunt.maxAttackers`) left most of a fuller room circling. The arena has no `SimState.floor`, so it and the parity test keep two.
- Solo, every enemy a room sends (first group and reinforcements), averaged over 59 seeds:

| Room | Floor 1 before | Floor 1 now | Floor 3 before | Floor 3 now |
| --- | --- | --- | --- | --- |
| Guard room (2x2 cells) | 2.0 | 3.6 | 3.0 | 6.2 |
| Medium | 3.2 | 6.3 | 4.3 | 10.0 |
| Large (4x4) | 4.9 | 10.5 | 6.5 | 15.7 |
| Arena (5x5) | 8.2 | 16.6 | 10.9 | 26.2 |

- Three new floor-run tests: a guard room meets one hero with three or more, a large room has six or more and more again on floor 3, and three enemies hold attack tokens at once on a floor while `grunt.maxAttackers` stays two. All three fail on the old numbers.
- check 138, parity identical, test:net (0 corrections on the floor walks; a four-player snapshot 6.0 KB), smoke 7/7. In the browser, seed 11's large room had seven up at once, three attacking, a brute's slam telegraphed, a 5.9 KB snapshot.

**Learned**

- **Rooms already woke together:** the whole first group spawns when the doors shut. What made a room feel like a queue was the size of the group and the two-attacker cap, not the waking.
- **A guard room's budget was under two,** so with the reinforcement split it sent one grunt, then one more. Most fight rooms are guard rooms, so most fights were one at a time.
- **A scripted bot is no judge of difficulty.** One that walks in and taps attack landed no kills under the old numbers or the new, so the comparison is the per-room counts above, and the feel is Michael's.

**Next**

- Michael plays a floor or two: too much, too little, or right. Every number above is a debug-panel slider.
- D2, bigger rooms (deep work), which these numbers will want to be re-checked against.

## 2026-10-28: local session, quality of life after the feel-pass playtest

**What changed**

Michael played the feel pass and sent a list; the quality-of-life half is built (`auto/local-qol`).
- **Tab opens and closes the hero screen** (it was I). Lock-on moves from Tab to T; middle click and the right stick click stay.
- **Every item has an icon.** `ui/gearIcons.ts` has a 16x16 pixel grid per catalogue shape, in the HUD icons' style, painted in the item's material: base, a lighter and a darker base, and its trim. The cells keep the item's name under the icon; a worn slot's label shows only while it is empty.
- **The three weapon levels are on the Talents tab only.**
- **The HUD's three style chips are gone** (`StyleBar` deleted). A line over the health bar names the hero and the weapon in hand's level ("Knight · Level 6", a gold +N for talent points to spend) with a hairline of progress. The ability slots move under the health bar, in the same corner.
- **The bag tab shows the hero as dressed** (`ui/HeroPreview.ts`): the game's own `HeroView`, put through `applyLoadout` from the profile, facing the player, on a small renderer of its own, drawn only while the tab is open.
- **The mouse wheel zooms the camera**, from half to twice `camera.distance` (`tuning.camera.zoom*`), eased, and kept in the browser. Also - and =, and the d-pad's up and down off the hero screen (rule 4). Over a menu the wheel still scrolls the menu.
- check 135, parity identical, smoke 7/7 (its hero-screen test now opens with Tab and checks the icons, the figure and the levels on the Talents tab). In the browser: icons for all 31 shapes, the dressed figure, the level line, and the zoom from 5.5 m out to 8.5 m on four presses of -.

**Learned**

- **The hero screen redraws by `innerHTML`,** so a WebGL canvas inside it would be thrown away on every keypress. The preview's canvas lives outside and is put back into its slot after each redraw.
- **The game's shared Palette carries the main renderer's reflection map,** which a second renderer cannot use. The preview builds its own from the same `dungeonEnvironment` (now exported), so metal reads the same in both.

**Next**

- Michael's answers on the rest of the list (decisions.md, "After the feel-pass playtest"): the bag at risk with a safe pocket, finds wearable mid-run but still at risk, and the dungeon's feel before the village. The backlog has them as D1 to D5, with P9's stash moved up beside D5.
- D1 (denser fights) is first; it is tuning, so a local session or the builder can take it.

## 2026-10-28: local session, C5: warhammer, crossbow and wand

**What changed**

- **Weapon families.** A family fights its style's fight (its levels, talents and strings) with a chain of its own (`tuning.warhammerCombo`, `crossbowCombo`, `wandCombo`).
- **Each step borrows a pose.** `FAMILY_ANIM` gives each step the pose and projectiles of one of its style's steps, so the views and the shots need nothing new:
  - Warhammer: the sword's sweep, spin and slam.
  - Crossbow: the bow's two quick shots, then the power shot with a long reload. The power shot still sets up Skewer.
  - Wand: the staff's single bolts, five of them, fast.
- **State and checks.** `PlayerState.attackStep` holds the family's step. `Mods.family` travels in the loadout, the server checks it, and it counts only with its own style.
- **A family's heavies** are its style's strings, scaled by `tuning.families`: the warhammer's hit 40% harder and come 30% slower.
- **The warhammer takes both hands** (+20%).
- **The off-hands C4 held back,** each on 3:
  - the tome's **Ward**: the next hit on you and on every ally within 5 m is absorbed, for 8 s
  - the buckler's **Deflect**: every hit is parried for 450 ms
  - the hand crossbow's **Quick shot**: two bolts
- **Drawn as simple meshes in their materials,** on the borrowed poses. The off-hand sits in the off hand with any one-handed weapon. The three abilities have icons.
- **Parity identical.**

**Learned**

- **Borrowing a step's pose made a family cheap.** It carries the slice's swing, its projectiles and its hit timing with it; only the numbers are new. Poses of their own can come later without touching the sim.
- **From behind, the crossbow and the off-hands are hard to see** on the borrowed bow poses. They read in the bag and on the HUD, not yet on the figure.

**Next**

- The feel pass (C1 to C5) is built. It wants a hand on it: heavies, Flow, one weapon per outing, the off-hands and the families.
- Then P2, the village save, or the henchmen (P3).

## 2026-10-28: local session, C4: the off-hand slot

**What changed**

- **The shield slot is the off-hand.** A one-handed weapon takes an off-hand of its kind, and the off-hand brings the third ability.
- **The shield's bash** goes on 3 (or R, or RT). It knocks the nearest enemy in front off its feet and has its own cooldown (`PlayerState.offhandCooldown`).
- **Two-handed weapons** take no off-hand and hit 20% harder (`gear.twoHandDamage`).
- **RuneScape's eleventh slot holds arrows.** With a bow, frost arrows slow what they hit, and a barbed charged shot opens a bleed.
- **What travels and what is checked.** `Mods.offhand` and `Mods.ammo` go in the loadout, and the server checks them against the kinds there are. `PlayerCommand.ability3` is an optional press that a late input carries.
- **On screen:**
  - The HUD shows the third slot only while an off-hand is in use.
  - The hero screen has the ammo cell beside the neck.
  - Item text names the bash, the two-hand bonus and what arrows do.
- **Parity identical.**
- **test:net's flake is fixed.** The netcode test's walk onto floor 2's ring home failed CI four times since 28 Oct (main included, and #89). Both bots stood inside the ring's 2.2 m before the second reached its exact mark, the ring handed the party on, and the bot's walk waited on a room that had stopped sending. A walk now ends once a hand-off arrives.

**Learned**

- **Today's bow and staff take both hands,** so the off-hands for ranged and magic had nothing to go with. The tome, the buckler and the dual hand crossbow moved to C5, beside the one-handed wand and crossbow.
- **The new ammo cell caught the hero screen's cursor.** Right from the head went down to it rather than across to the bag (a tie the ammo cell won). The smoke test walks that route and failed. The cursor now weighs a row change at three steps, so it keeps to its row.
- **One flaky test can hide behind another.** A deterministic floor (`dungeon.seed` pinned) failing only sometimes pointed to timing, not geometry. Checking every CI failure's message found the same waypoint four times.

**Next**

- C5: the warhammer, the one-handed crossbow and the wand, with the tome, the buckler and the dual hand crossbow.

## 2026-10-28: local session, C3: one weapon set per outing

**What changed**

- **The weapon changes only outside a fight** (Michael chose inventory only). The sim holds a requested swap until no fight is on: no doors shut, no waves running. It sits behind `combo.swapInFight`, which the parity test turns on because the slice's scripted parties swap. Parity identical.
- **1 and 2 are the abilities**, beside Q and E; the pad keeps LB and RB. 3 waits for C4's off-hand.
- **The hero screen keeps 1, 2, 3 and the d-pad for its tabs.** New `tab1`, `tab2` and `tab3` actions take the press there before anything else, so a tab change never casts.
- **Gone or changed:**
  - the wheel and d-pad weapon swaps
  - the key numbers on the style bar
  - the HUD's ability keys now read 1 and 2
  - the controls table says how to choose a weapon
- The smoke test that pressed 1 to take the sword back now checks that 1 no longer swaps.

**Learned**

- **The backlog's "move the tabs to free keys" was not needed.** The hero screen already stands the hero still and only opens between fights, so 1, 2 and 3 can mean tabs there and abilities everywhere else, as long as the tab actions are read first.
- **A new hero's 2 does nothing** until the second ability unlocks at level 2. That is the slice's unlock, not a binding fault, and worth knowing when testing keys.

**Next**

- C4, the off-hand slot and its third ability on 3.

## 2026-10-28: local session, C2: Flow

**What changed**

- **A rhythm meter on the hero** (`PlayerState.flow`, `sim/flow.ts`, `tuning.flow`).
- **The beat.** A press as the chain's next step opens (120 ms before to 160 ms after) is on the beat. It is judged on the tick the press was made for, presses during a hit's freeze included, so the server and the prediction agree.
- **What fills it.** An attack's earnings land with its first hit, so swings at the air earn nothing:
  - a light: 8 on the beat, 3 off it
  - a heavy: 14 on the beat, 5 off it
  - the same chain a third time running: half
  - a perfect parry, or a dodge that slips a hit (once a dodge): 20
  - a combo payoff: a whole tier
- **What empties it.** A hit taken costs a tier, and the meter drains after 2.5 s without fighting.
- **The tiers:**
  - I: attacks 5% faster.
  - II: the trail runs hotter.
  - III: a heavy hit lands but does not interrupt.
  - Full: a charged heavy becomes a Crescendo (charge 3, twice the damage) and spends the meter.
- **Harmony:** the payer and another player both at Flow III add 20% to a combo payoff.
- **On screen and in the music.** A thin meter sits under the health bar with tier ticks and a label ("Crescendo: charge a heavy" when full). The fight music adds a layer a tier: hats, then the lead every bar, then bells.
- **Off in the parity test:** parity identical.

**Learned**

- **The first press of a chain from standing is never on the beat;** there is no beat to keep yet. A press that starts a new chain from the last hit's recovery is, so a player who keeps chaining keeps the rhythm.
- **Corrections in a brute fight swing from 11 to 49** over twelve seconds with Flow on or off alike. Flow moves the hero only from tier I (5% faster attacks), so it is not the cause.
- **One smoke failure came from my own scratch runs.** God mode and a Flow switch left on a shared local server failed a test; on fresh servers it was 7/7. Scratch runs should restore what they tune, or use their own server.

**Next**

- C3, one weapon set per outing.
- Flow needs a hand on it: whether the beat window feels like a rhythm, and whether III is reachable in a real fight.

## 2026-10-28: local session, C1: light and heavy strings

**What changed**

- **Hold to go heavy.** Holding attack turns a step into a heavy (`combo.heavyHoldMs`, 250 ms), and holding 450 ms more reaches charge level 2. It is the same on mouse, keyboard and pad: `attackHeld` is a held field on the command, so prediction and the server step it alike.
- **A tap is the slice's light, exactly.** A test compares every tick of the five taps with heavies on and off.
- **Each weapon's string moves** are keyed by the presses that lead to them:
  - Sword: H overhead cleave, LH rising cut, LLH sweeping arc, LLLH pommel break, LLLLH blade spin, HH ground slam, HHH earthsplitter, and HLL whirling counter (Michael's heavy-light-light example).
  - Bow and staff have their own seven.
  - A heavy string without its own move plays H.
- **Each move borrows a chain step's pose, reach and projectiles** (`stringAnim`), so the views follow without knowing about strings until the moves get poses of their own. The numbers are in `tuning` with slider ranges.
- **The HUD names each move** as it fires, so the strings are learned by playing.
- **Behind `combo.heavies`,** which the parity test turns off: parity identical.

**Learned**

- **A hold has to belong to the swing its press started.** The bow's buffer window opens inside the next shot's windup, so pressing and holding for the next heavy turned the *current* light into it. A press made mid-swing now marks its hold as the next swing's (`attackHoldNext`). A test covers it.
- **Heavies add next to no corrections.** In a browser run, the five taps gave 3 to 4 corrections (the known lunge ease); the three heavy moves after them gave 0 to 1 more, and none were snaps.

**Next**

- C2, Flow.
- The heavies need poses of their own: today the overhead cleave is the leaping slam's pose.

## 2026-10-28: local session, P1: the loop's stakes and rewards

**What changed**

- **Carried finds.** On a generated floor a pickup is carried (`SimState.floor.carried`) instead of going straight into the bag.
- **Banking.** The rest room, or the Warden's fall, banks every player's finds in a `banked` event. The event also carries:
  - the coin for the fight rooms cleared on that floor
  - the village's lumber and stone
- **Pay** is `tuning.loop`: 12 coin, 4 lumber and 3 stone for each room cleared, more for the Warden's hall, and 30% more for each floor deeper. Rare drops get likelier deeper too.
- **Losing finds.** A wipe loses what was carried (`findsLost`). A player who leaves mid-floor gives up theirs.
- **The browser saves what the server gives it.**
  - Items go into the bag and coin into the profile.
  - Lumber and stone go into `hearthgate.village.v1`, but only in the browser that opened the village the run set out from. That holds until P2 makes it a real village save.
- **On screen:**
  - The timer line shows what is carried.
  - A summary card greets the party home. F, A or Escape closes it.
  - The equip screen shows coin.
- **Protocol 8.**
- **The slice's arena keeps its own loot**, so parity is identical.

**Learned**

- Banking pays only for rooms actually fought. Since the deeper ring opens on arrival (decisions.md, 27 Oct), skipping rooms is now a real trade: a faster floor for less pay.
- **The summary was hidden at first.** It sat under the Paused card, which shows whenever the mouse is not locked (the critic's open bug). It now sits above that card and below the hero screen.
- The smoke walk's route to the rest room can cross no fight room, so the scratch check steered through one first. One room cleared on floor 1 banked 12 coin, 4 lumber and 3 stone.

**Next**

- C1, light and heavy strings.

## 2026-10-28: local session, combat depth designed with Michael

**What changed**

- A design conversation about combat, drawn up as an interactive page ("Hearthgate Combat Builds") with a Keep, Unsure or Cut on every piece. Michael marked all 43; four conflicts were settled in chat. All of it is in `decisions.md` ("Combat depth").
- **The design doc's Combat section** gains a Builds block, and its Loadout paragraph now says one weapon set per outing. Layer 1 now names the specialization trees.
- **The backlog's Phase 2** gains the feel pass, C1 to C5, after P1: strings, Flow, one weapon set per outing, the off-hand slot, three new families. The builds pass waits as a **(design)** item.

**Learned**

- Michael chose no weapon swap mid-fight. One player can no longer set up and pay off a cross-style combo alone, so combos become party play. That fits pillar 1, and makes the henchmen's combo awareness matter more.
- The slice's parity scenario swaps weapons mid-fight, so the no-swap rule must sit behind a switch the parity test turns back on.

**Next**

- P1 (the loop's stakes), then C1 (light and heavy strings).

## 2026-10-28: local session, Phase 2 planned

**What changed**

- **Phase 2's items** are in the backlog, P1 to P10 and the gate, planned from the design doc with Michael's four answers (`decisions.md`, "Phase 2's shape").
  - The loop's stakes and rewards.
  - The village in the host's browser save.
  - The four starting buildings at tiers 1 to 4.
  - Coin, the General Store and the stash.
  - A portal board with tiers and two modifiers.
  - Three henchmen in three steps.
- The backlog also lists what is not in Phase 2, and three draft gate questions for the producer.

**Learned**

- Nothing in a run is at risk today: a pickup goes straight into the bag, so going deeper costs nothing. P1 fixes that first, because the gate's "holds up" depends on the loop having stakes.
- The fight needs nothing new for henchmen: a henchman is a `PlayerState` whose `PlayerCommand` comes from a brain in `shared/` instead of a browser. Prediction and snapshots carry it as they carry any hero.

**Next**

- The critic's two open bugs, then P1 and P3 (deep work) beside P4 (the builder).

## 2026-10-28: local session, T6c: the slotted perks

**What changed**

- **Nine slotted perks** (`shared/src/sim/champion.ts`), three per constellation, with Michael's answers (`decisions.md`, 28 Oct):
  - Offence: Wide shatter, Teamwork, Deep wounds.
  - Defence: Counterstep, Bulwark, Lifeline.
  - Utility: Long fuse, Momentum, Magnet.
- **Opening and slotting:** a constellation's slotted perks open at 5, 10 and 15 points spent in it; four are slotted at once. They travel as `ChampionState.slots`.
- **Where they change:** `slotsOpen` (coop.ts) allows the village, a floor's rest room once the party has reached it, and the arena's antechamber. Elsewhere `HostSession` keeps the hero's four whatever the browser sends, and the tab says where to change them.
- **The effects** sit where the fight already decides those things: the Shatter splash, the payoff damage, the bleed, the parry, the block, the revive, the combo windows, a new `payCombo` beside the three combo callouts, and the pickup radius.
- **The Champion tab** lists each constellation's slotted perks under its ranked ones, with a slot bar. F or A slots, Q or LB takes one out.
- **Parity identical:** each effect is a branch a hero without champion points never takes. Combo setters (`shatterBy`, `skewerBy`, `detonateBy`, for Teamwork) are recorded only for heroes with champion points.

**Learned**

- A slotted perk whose constellation loses its points stays slotted and does nothing, on both sides. Refusing it instead would make the server drop the whole loadout after a respec on a floor, where the slots are fixed.
- Momentum hooks the combo callout, not the payoff hit, because a Detonate burst lands on every enemy it catches and would otherwise refund once per enemy.

**Next**

- T6 is built. Its gate wants a play past level 50, which today takes a seeded save or the debug panel; the pace of the XP curve is still unjudged.

## 2026-10-28: local session, T6b: champion points

**What changed**

- **Earning** (`shared/src/sim/champion.ts`): once any weapon is at level 50, every weapon's XP also banks toward champion points. The first costs 20,000 XP and each costs 250 more than the last, without end (`tuning.champion`).
- **Nine ranked perks in three constellations:**
  - Offence: Precision (damage), Heft (poise damage), Exploit (combo payoffs).
  - Defence: Vitality (max health), Toughness (damage taken), Steady hands (time to revive a friend).
  - Utility: Will (cooldowns), Light step (dodge recharge), Stride (move speed).
- **The ceiling:** Precision and Vitality stop at +15% damage and +15% health (Michael), and the code holds the ceiling even if the per-rank values are tuned up.
- **The player's, not the hero's:**
  - They are saved under their own key (`hearthgate.champion.v1`), so a second character will share them.
  - They travel in the loadout and `PlayerState.champion`.
  - The server refuses ranks the banked XP could not buy, and applies Vitality to max health itself, so the ceiling holds whatever a browser sends.
- **Parity identical:** the state is optional, and a hero without it (the slice, the parity test) gains exact zeros.
- **The equip screen's third tab, 3 Champion,** works by keys and pad like the talents. Resetting is free between fights until coin. A toast marks each point.
- **The design doc's Layer 1** now says the player moves a little, and chooses how.

**Learned**

- Points come from a closed form (the cost's quadratic, settled to whole points), not a loop: banked XP never stops growing, and the sim asks on every XP grant past 50.
- Health is the one champion number not stepped per tick: it is set when a loadout is applied, so the server applies it rather than taking the browser's max health.

**Next**

- T6c: the four slotted perks, which make a build. They are chosen in the village or a rest room.

## 2026-10-27: local session, T6a: style levels to 50

**What changed**

- **Michael's T6 answers** (decisions.md): a +15% damage and +15% health ceiling on champion points' passive perks, shared across characters, free respec until coin, built in three steps.
- **Levels to 50** on the slice's curve. Levels 2 to 5 are where they were; 10 takes 33,000 XP, 20 takes 120,500, 50 takes 683,000, all on the panel's sliders.
- **Every raw gain is a point.** The slice's flat +10% at level 4 is now Might's top two ranks (7, not 5).
- **Milestone rows** (`talents.ts`): one talent opens at each of 10, 20, 30, 40 and 50, four ranks each.
  - Weight: poise damage.
  - Finisher: this weapon's combo payoff (Shatter, Skewer or Detonate).
  - Riposte: parry window.
  - Second wind: dodge recharge.
  - Mastery: damage.
  - The slice's 29 ranks and these 20 make 49, a point for every level after the first.
- **Checks:** a row below its level is shut in the sim, whatever a save says, and the server refuses a loadout whose board its XP could not have bought (`boardProblem`).
- **The talent tab by keys and pad:** move to choose, F or A adds, Q or LB takes off, E or RB resets that column. It had none: only the mouse worked there.
- **The weapon glow** lights at 25 (was 5) and burns gold at 50.
- **Parity identical:** the parity test sets the slice's level-4 bonus and level cap back, and the new talents add exact zeros (the parry check keeps the slice's milliseconds).

**Learned**

- The curve is long for "about 10 after an evening". A floor-1 clear gave each bot 230 to 380 XP, so 33,000 for level 10 is many evenings. The early gaps (3,500 from 4 to 5) set it, and they are the slice's; T6's gate playtest should judge it before the numbers move.
- `levelFor` built a fresh 50-entry table on every call, and the sim now asks it every tick (rows, dodge recharge). It is cached by the six numbers that shape it.

**Next**

- T6b, champion points: earned past 50 from any style, three constellations of passive perks under the +15% ceiling, shared across characters in the save.
- T6c, the four slotted perks.

## 2026-10-27: local session, the Phase 1 gate played by a bot party

**What changed**

- **`npm run gate:party`** (`tests/gate-party.ts`): the gate's machine stand-in, as Michael asked (decisions.md, 27 Oct).
  - **The party:** four of mixed levels and gear (sword 10 in steel, bow 4 in leather, staff 1 in linen, sword 1 in bronze). They take the village's ring together and clear floor 1 to its rest room with no cheats.
  - **How the bots play:** they follow the floor's doorways, all take the enemy nearest the veteran, and close in or keep their range by weapon. They press their abilities now and then, roll from a wind-up beside them, and pick up a friend who is down.
  - **The browser:** with `--client` the squire is a real browser on the client, steered through the game's own commands, and its screen is saved at every combo and every few seconds of a fight.
  - **The numbers:** counted from the server's events: rooms cleared, combos by kind and finisher, damage share, kills, downs, bleed-outs, revives.
- **`tests/bots.ts`:** a bot can bring its own loadout, keeps the events it was sent, and no longer counts the old room's goodbye after a portal as being kicked (a race that showed up only when the goodbye beat the new seat).
- **Filed:** three runs of three on the hosted build cleared floor 1 with 6 to 12 combos each, numbers in `playtest-notes.md`.

**Learned**

- **Mixed levels hardly matter on floor 1.** The two level-1s did as much damage as the level-10 veteran or more in every run. A style level gives little until its talents are spent.
- **Floor 1 is easy for four.** Nobody went down in any hosted run, so the downs went unexercised here.
- **Two traps for anyone steering the client from a test:**
  - The game lays its pending presses over the command `buildCommand` returns, so attack and ability presses have to go there, not in the command.
  - tsx compiles functions handed to `page.evaluate` with a `__name` helper the page lacks, so the page needs a one-line stand-in.

**Next**

- Michael closed Phase 1 on these runs the same day ("I'm good to close it and move on!"). Phase 2, village and loop, is current.
- T6, progression to 50, carried over as Phase 2's first item. Phase 2's own items still need planning from the design doc.

## 2026-10-27: local session, T5c: every piece drawn on the hero as itself

**What changed**

- **The look travels.** The loadout carries what the hero wears as catalogue ids (`look`), and `applyLoadout` puts it on `PlayerState.look`, so the snapshot gives every player everyone's gear. The server checks each id is in the catalogue and that there is one a slot; a look that fails drops the message whole. Optional, so the slice's state never carries it (parity identical). `PROTOCOL_VERSION` 7. It costs a dressed hero about 100 bytes a snapshot.
- **The wardrobe** (`client/src/render/wardrobe.ts`): every shape in the catalogue has its own build on the slice's skeleton, drawn in its material's base and trim colours.
  - Heads: an open med helm with a nasal bar, the closed full helm with its slit and crest, a hide coif tipped back off the face, a wizard's hat.
  - Bodies: chainbody (a mail texture), platebody (pauldrons, a ridge, a gorget), jerkin (a panel and a strap), robe top (wide sleeves).
  - Legs: platelegs, a flared plateskirt, chaps, a robe skirt to the floor.
  - Hands, feet and the rest: gauntlets, vambraces and gloves; boots (metal ones with a toe cap); capes (the Warden's carries his cross); an amulet; a ring.
  - Square and kite shields.
- **Weapons and shields.** The weapons are the slice's, tinted by their material. A bow or staff in hand slings the shield on the back, and a bow carries a quiver. Nothing worn shows a plain tunic, trousers and shoes. A hero with no look (villagers, the test bots) keeps the slice's three figures.
- **Tests:**
  - A catalogue test for the look and its checks (check 77).
  - A `test:net` step: a look reaches the other player, and an unknown id is dropped.
  - The browser bag test asserts the drawn bow (7/7).
  - Parity identical.

**Learned**

- The look is the views' alone, but the snapshot is the one way a player hears about another, and `PlayerState` already carried the name and the mods: an optional field there was simpler than a message of its own.
- A test page talking to the dev client's default server reaches whatever runs on 2567, another session's included. The local client for these tests now gets `VITE_SERVER_URL` pointing at this session's own server.

**Next**

- Michael: try T5 on the hosted build once merged (#75, #76, this).
- The Phase 1 gate on a generated floor.

## 2026-10-27: local session, T5b: the bag and the body

**What changed**

- **The item catalogue** (`shared/src/sim/catalogue.ts`): every piece is a shape in a slot (med and full helms, chainbody, platebody, jerkin, robe top, platelegs, plateskirt, chaps, robe skirt, gauntlets, vambraces, gloves, boots, square and kite shields, cape, amulet, ring, sword, shortbow, staff) made of a material in a family: metal for melee (bronze, iron, steel, black, wardensteel), hide for ranged (leather, hard leather, studded, wyvernhide, stormhide), cloth for magic (linen, wool, silk, starweave, duskweave), wood for bows and staves (ash, oak, elm, yew, heartwood), trinkets for necks and rings (copper, silver, gold), dyes for capes. The pair gives the name ("Iron full helm", "Black platebody"), the kind, the tier and the stats. Past iron, steel and black the tier names are Hearthgate's own, not RuneScape's.
- **What it does in the fight:** armour cuts damage taken (`Mods.armour`, a piece's tier times its shape's weight, hide and cloth less than metal, capped at 60%); a weapon adds 5% damage a tier; rares carry the slice's bonus stats and perks; each worn armour piece of another kind than the weapon costs that weapon 5% damage (Michael: per piece). A shield does nothing while a bow or staff takes both hands. Capes, necks and rings have no kind and never count against you. All of it travels in the loadout the server already takes, so no fight code changed but the armour line in `hurtHero`.
- **Drops** roll from the catalogue behind `gear.catalogue`; the parity test keeps it off with the downs, since loot is rolled in the fight (identical).
- **The save (v2):** a 28-space bag and RuneScape's ten worn slots. The slice's save carries over: its weapons and body armour become catalogue pieces and its rares keep their names, stats and perks. A new hero holds a bronze sword with an ash shortbow and an ash staff in the bag, and no armour. 1, 2, 3 and the wheel take the best weapon of that kind from the bag; the hero fights with the weapon in hand, whatever changed it.
- **The equip screen:** the body laid out as RuneScape's, the bag beside it, what the chosen piece does and what a mismatch costs now. Keys and pad first (move to choose, F or A to wear or take off, Q or LB to drop, 1 and 2 for the tabs), clicks too; the hero stands still while it is open, and it opens on a floor between rooms as well.
- **Tests:** 9 catalogue tests (check 76); browser smoke 7/7, a bow worn from the bag by keys alone and the sword back on 1; `test:net` passes; parity identical.

**Learned**

- The slice's per-style damage in `Mods` already had room for the mismatch rule: armour of another kind lowers the other styles' numbers, so the weapon in hand picks the right one with no new rule in the fight.
- A key tapped faster than a slow headless frame is never seen by the action layer's held axes; the browser test holds keys as a player does.

**Next**

- Michael: the bag and body on the hosted build once merged.
- T5c, every piece drawn on the hero as itself.

## 2026-10-27: local session, T5a: Hearthgate's downs

**What changed**

- **Hearthgate's downs (5A)** behind one switch, `coop.bleedOut` (on). A hero downed in a fight crawls (`coop.crawlSpeed`, 1.1 m/s) and bleeds out over 30 s; then they are out until the room is cleared. A friend holding F for 3 s picks up the downed for free; the out need the helper's Revive Draught (`coop.draughtsPerFloor`, one per player per floor, a counter until Phase 3's items), used when the revive completes. Out of a fight everyone gets back up (the slice's `downMs`), so a cleared room on a generated floor brings the party back; a party all down or out is wiped.
- New state is optional (`PlayerState.bleed`, `draughts`) and never set with the switch off, so the slice's state never carries it.
- **Parity:** the parity test (and `tests/parity.ts`) plays with the switch off, so it still proves every other rule is the slice's to the bit; identical.
- HUD: the bleed-out clock and "Out until the room is cleared", the draughts under the dodge pips, party frames with the bleed-out left or "out", a revive prompt that knows a draught is needed and how many you carry, toasts for a bleed-out and a draught revive.
- Michael's bag-and-body answers recorded (decisions.md): 28 spaces, RuneScape's ten slots, -5% damage per mismatched piece, every piece drawn as itself. Planned as T5b and T5c.
- Tests: 8 downs unit tests (check 67); `test:net` and browser smoke 6/6 with the downs on in every fight.

**Learned**

- A rule the slice does not have can still be checked against the slice: put it behind a switch the parity test turns off, and keep its state optional so the slice's JSON never grows.
- Solo, going down is a wipe straight away (nobody is left standing), so the bleed-out only shows with a party; the bot harness joins a browser's room by its code for a check like this.

**Next**

- Michael: the downs with a friend on the hosted build once merged.
- T5b, the bag and the body; then T5c, the look.

## 2026-10-27: local session, the T3 / T4 / T4b playtest and its follow-ups

**What changed**

- Michael played T3, T4 and T4b on the hosted build: all three gates passed ("everything looks good for the most part"), filed in `playtest-notes.md`. He answered T5's questions as cards (decisions.md, PR #73, merged into this branch).
- **The HUD overlap he saw** was a T4b regression: both pages imported `theme.css`, so the build moved it into a shared chunk that the game's page loaded before `style.css`, and the base styles won (the weapon chips and abilities fell back to their old centred spots, on top of each other). Dev serves CSS in import order, so only the built game showed it. The editor now keeps its own copy of the colour tokens; checked against a production build.
- **A hand-built dungeon has floors of its own**, his second callout (going deeper fell into generated floors): one to five floors, each its own layout, and a run through it is exactly those floors. Every floor but the last ends in a rest room whose violet ring leads to the next; the last ends at the Warden's hall, or in a rest room with only the ring home. The editor shows floors as tabs ([ and ], the stick clicks, N adds, Shift+Backspace removes), each marked ready or not, and Play starts on the floor being edited. Files from before floors open as one floor. The Old Cellar has a second floor, a drop to the Warden. Protocol 6.
- **Tests**: check 59 (the floor rules, legacy files); `test:net` takes The Old Cellar's deeper ring onto its own second floor; browser smoke 6/6 with two floors built by keys alone.

**Learned**

- A stylesheet two Vite pages share becomes its own chunk, loaded first: the cascade order of the built game is not the order of its imports. Check layout against `npm run build`, not only the dev server, when CSS moves between entries.

**Next**

- Michael: approve #73 (T5's answers, docs) and this branch's PR.
- T5, starting with Hearthgate's downs.

## 2026-10-27: local session, T4b: the dungeon editor

**What changed**

- Michael on T4: the screenshots were as expected; the rest room's rings stay open on arrival ("you should be able to skip rooms and rush the dungeon"). On T4b: dungeons saved in the browser plus an exported file committed to the repo, and Keeper Wren picks where the ring leads (decisions.md).
- **Hand-built dungeons** (`shared/src/level/handmade.ts`): a layout is its placements only (piece, cell, turn, height). `checkDungeon` joins facing doorways at one height as the generator does and says in words what keeps a layout from play (no entrance, no way out, overlaps, a piece cut off; notes for walled-up doorways and ones that meet at another height). `FloorSpec.hand` carries one, so it plays through the floor code T4 built. A run can start on one: ending at the Warden's hall it is that floor alone; ending in a rest room its deeper ring goes on into generated floors. The Old Cellar (9 pieces, a staircase up, three fight rooms) ships in `shared/src/level/dungeons/`.
- **The editor** (`client/editor.html`, `client/src/editor/`): a top-down grid with a ghost of the chosen piece at the cursor, its doorways green where they would join a neighbour and amber where one meets it at another height. Keyboard first (arrows or WASD, Q/E or 1 to 0, R, Z/X, Space, Backspace, F copies the piece under the cursor, U undo, Ctrl+S, P plays), the same on a gamepad, the mouse as an extra; 48 px buttons. Checked as it changes. Saved in the browser (a draft too, so a refresh keeps the work); Export and Import files; Play opens the game on `?floor&play&hand=NAME`. The title screen has a Dungeon editor button.
- **Keeper Wren**: F says where the ring opens; F again while she speaks turns it. A `destination` message, checked whole on the server; the ring carries a label (the dungeon's name, Deeper, Home) drawn over it. Protocol 5.
- **Tests**: 7 unit tests (check 58); `test:net` asks Wren for The Old Cellar, has a broken layout refused, and walks the floor with two bots; browser smoke 6/6, the editor built by keys alone, saved and played, and Wren turning the ring. Parity identical.

**Learned**

- Joining doorways by facing sockets made the hand-built and generated floors one format: nothing downstream of `FloorDef` had to change.
- A synthetic keydown on `window` reaches the game's keyboard, so the browser can be driven for screenshots without the mouse capture.

**Next**

- Michael: approve #71 (T4), then this PR; build a dungeon in the editor, play it, and take it through Wren with a friend. Export the ones worth keeping; committed to `shared/src/level/dungeons/` they ship.
- T5, party rules and the Phase 1 gate.

## 2026-10-27: local session, T4: the dungeon generator

**What changed**

- **The kit** (`shared/src/level/kit.ts`): 13 pieces in code on a 6 m grid (entrance, hall, long hall, corner, junction, crossing, staircase, small, medium and large rooms, the slice-sized arena, rest room, the Warden's hall), each with doorway sockets in the middle of a cell edge, pillars and braziers. Walls stand inside a piece's own cells, so neighbours meet back to back and never overlap.
- **The generator** (`generate.ts`): seeded and pure. A floor grows from its entrance, more than half the time from the newest doorways (paths run on) and otherwise from any doorway (branches); it puts the exit (a rest room, or the Warden's hall on the last floor) at the doorway farthest from the entrance, closes loops with short halls and corners between open doorways at one height that are four or more pieces apart, fills to the piece count with side rooms, and tidies away any hall that leads nowhere. Staircases climb or drop 2.4 m. A try that comes out without a joined staircase, a loop (14 pieces and up) or its exit moves to the next seed, so a spec always gives the same floor. About 2 ms for 50 pieces.
- **Floors as levels** (`floor.ts`): the slice's `LevelDef` and `World`, like the village: walls, lintels, a gate per doorway of each fight room (`World.roomColliders`), raised rooms as flat surfaces, staircases as the slice's ramps between landings.
- **The run, room by room** (`sim/floorRun.ts`): the slice's gate wait, intro, budgeted group (size, floor, party; grunts, archers and brutes), reinforcements and heal, per room; a wipe ends the run where it happens; the rest room banks drops. In `SimState.floor`, never set in the arena. The enemy code's only changes: a floor's open-ground check, and a guard for a level without ledge ramps.
- **Rings** are a list (the rest room's violet deeper and gold home), at their floor's height. **Protocol 4**: `welcome` carries a floor's spec, `snap` the rings.
- **Server**: `FloorRoom` per floor, carrying the run's plan (`runPlan.ts`, `tuning.dungeon`: 3 floors at tier 1, 15 pieces on the first floor growing 6 a floor, more with tier and level). The village's ring starts a run; the arena stays for the tests and the lab.
- **Client**: `FloorView` (pieces at their heights, staircases drawn as steps over the ramp, fading walls, portcullises, ten torch lights following the hero, shadows following the hero), the **minimap** (bottom right, every piece shaded by height, stairs arrowed, fight rooms dotted until cleared, the shut room in red, rings, party and your arrow; M or Start for the whole floor), floor texts in the run UI, `?floor&seed=N&pieces=N`.
- **Tests**: 9 generator tests on five seeds from 10 to 50 pieces (deterministic, distinct shapes, reachable, doorways face to face, no overlapping colliders even shut, branching and loops, a joined staircase, open doorways and spawn spots, a hero walking entrance to exit in the sim); 6 floor-run tests (check 51). `test:net`: two bots village → floor 1 → rest room → deeper → floor 2 → home, and the browser's ClientSession up a staircase with no snap. Browser smoke 4/4 with the round trip now through a floor. Parity identical.

**Learned**

- Growing only from the newest doorway makes one corridor; only from random ones makes a blob. A mix, plus loop-closing paths through empty cells, gives floors that branch and loop.
- A smooth ramp reads as flat floor from behind the hero; drawing steps over it (the sim still walks the ramp, feet within 10 cm) makes a climb obvious.
- One shadow map cannot cover a 150 m floor; the moon's shadow area follows the hero instead.
- A floor carries its corpses in every snapshot unless they go: the dead of the last room are dropped when the next room starts.

**Next**

- Michael: the T4 gate on the hosted build once merged: `?floor&play&seed=101&pieces=10`, `seed=202&pieces=18`, `seed=303&pieces=28&at=2`, `seed=404&pieces=40&floors=5`, `seed=505&pieces=50&floors=5&at=5` (M for the whole floor). (Michael answered the clearing question the same day: rings open on arrival, rooms can be skipped.)
- T4b, the dungeon editor; the builder can take kit pieces (archer ledges in the arena piece, more room shapes) and the minimap's polish.

## 2026-10-27: local session, T3: the village and the portal

**What changed**

- Michael on T1 and T2 (decisions.md): "Feels good"; lag testing waits, content first. T1's gate passed on his solo play (PR #69); T2 (PR #68) is out of draft, waiting for his approval.
- His answers for T3: a portal in the arena brings the party home, and the village is a golden afternoon.
- **The village** (`shared/src/level/village.ts`): a second level kind in the slice's own format. The four starting buildings round a square (Portal Shrine north with the portal before it, General Store east, Storehouse west, Tavern south-west), a villager at each door who answers F (TalkUi), a well, trees inside a palisade and a wood beyond. Its run-start line lies off the map, so the slice's sim runs in it unchanged and no run or enemy ever starts there; the arena's `buildWorld` path is untouched (parity identical).
- **Rooms** (`server/src/rooms/`): HostRoom (the old FightRoom) under VillageRoom and DungeonRoom. Play makes a village; everyone standing in its ring for 2 s is handed into a fresh dungeon run; once the run is won or lost a ring opens in the antechamber and takes the party back to the same village, which stays open while they are away.
- **Client**: ServerLink follows a hand-off (a lost seat lands in a village of our own), ClientSession drops the old room's state and builds the new world, Game rebuilds the level's views without a reload (music and the mouse capture survive). The village is drawn in code (VillageView, villageTextures: grass, packed earth, plaster and timber, shingles, planks, fieldstone) under `tuning.villageLook` (a low western sun, gold-to-blue sky dome, bluish shade, dust motes), tunable live in the panel. PortalView draws the ring, its swirl and the fill as the party holds it.
- **Tests**: portal and village unit tests (check 34); `test:net` takes two bots village -> ring -> one dungeon -> finish -> ring -> the same village; the browser smoke test adds the round trip with Keeper Wren's line (4/4). The lab and the gate test start in a run (`?dungeon`).

**Learned**

- A dungeon room closes as its party leaves it, before they have taken their seats in the village, so a village that closed when its last run closed lost the returning party ("seat reservation expired"). It now waits 30 s.
- The paths are drawn pulled toward the camera so they never flicker against the grass, which hid a ring lying on them; the ring now sits higher with a stronger pull of its own.
- The well's roof stood in the camera's way: its collider now reaches the roof and fades like the trees.
- Bots steering by snapshots overshoot a 2.4 m ring at a run; they ease off near a mark.
- CI found two bugs in T2's input slots, both fixed here (#68 as approved has them): a player stalled past 300 ms whose next input never came was held still for good, and a server ticking slower than wall time (CI's runner at about three quarters speed; a busy free host could do the same) let a player's backlog grow without bound, so inputs landed 0.6 s late. A stalled player now picks up from the first input that arrives, and more than four beyond the cushion are used at once, as the slice folded them. The lossy lab row afterwards, one 120 s run: 57.5 corrections a minute over 2 cm, 13.5 over 10 cm; too noisy against T2's single run to call.
- Bots that fall silent read to the slots as late, which widens the cushion; the test bots keep sending while they stand.

**Next**

- Michael: the village and the portal on the hosted build once #68 and this PR are merged (T3's gate is two players village to dungeon and back, nobody stranded, and the village looks like it belongs to the slice).
- T4, the dungeon generator, from the kit of pieces in decisions.md (27 Oct).

## 2026-10-27: local session, T2: the clean link's corrections were enemy bodies

**What changed**

- The lab splits each correction over 10 cm by what the hero was doing (its own swing or ability, a hit taken, placed by the server, or neither), and `--diag` records, for each, every field where the server's hero at the acked input differs from the browser's prediction of that input. Bravo now fights (it faces the nearest enemy and swings), so a pair can try to finish a run.
- The diagnosis: the 0 ms row's remaining big corrections differed in position alone, mid-dodge or mid-run. The server pushes heroes out of enemy bodies in the enemy step (`settle`), which a joiner's prediction never runs. `separateBodies()` is that push lifted out unchanged (parity with the slice still identical); `ClientSession` applies it after each predicted step against the enemies as the last snapshot had them.

**Lab (local)**

A/B at 0 ms, 180 s each: 231 corrections a minute over 2 cm without the push predicted, 6 with it; over 10 cm 23.7 against 1.7 (of those 1.3 placements, 0 from the network).

| Link (120 s) | Over 2 cm a minute | Over 10 cm | of which placed | Holds a minute | Inputs in flight |
| --- | --- | --- | --- | --- | --- |
| 0 ms | 14 | 3.5 | 1 | 3.5 | 61 ms |
| 50 ms | 31 | 2.5 | 1 | 3 | 240 ms |
| 150 ms | 28 | 6 | 1.5 | 5 | 352 ms |
| 50 ms ±20, 2% loss | 47.5 | 4.5 | 2 | 25 | 358 ms |

The lab against the hosted build with Bravo fighting (main, before these fixes): 5 minutes, 0 network snaps, 54 corrections a minute over 2 cm, 8 runs started and none won.

**Learned**

- My first reading (the clean link's big corrections were the swing's lunge) was wrong; the split and the field diff found the real cause in one run. Measure the cause before naming it.
- Over 10 cm, 0 and 50 ms are inside T2's gate (8 / 3); 150 ms is not (6, or 4.5 without placements, against 1). Lossy holds are 25 a minute, over the lab's line of 20.
- The bots cannot win a run even with Bravo fighting; the T1 gate's two players through a run needs people.

**Next**

- Michael: the T1 gate's two-player run (people), and #68 once he has looked.
- T2: the 150 ms row's remaining big corrections (the diag), and the lossy row's holds.
- The lab against the hosted build once #68 ships.

## 2026-10-27: local session, T2: input slots for the lossy link

**What changed**

- T1 merged (PR #67, Michael on GitHub) and is live. Michael played it solo on the hosted build: "Gameplay looks good." He answered the fight's small corrections A (they stay; T2's gate counts corrections over 10 cm). The T1 gate is filed in `playtest-notes.md` with the lab against the hosted build (PR #69): 5 minutes, two browsers through Render, 0 network snaps, 70 corrections a minute over 2 cm, 2.8 holds a minute, but no run finished, since the bot pair only revives.
- `shared/src/game/inputSlots.ts` replaces the slice host's input queue. Each input has a slot one tick after the one before, behind a cushion. A tick whose input is missing runs on the held buttons and counts as that input (acked); the input is dropped when it lands, its presses carried to the next tick. Late arrivals widen the cushion a tick each (up to 15), five calm seconds narrow it, a player silent 300 ms has stalled. 5 unit tests in `HostSession.test.ts` (check 28); `test:net`'s ack checks now allow the server's 18 stood-in ticks after a bot stops.
- `CLAUDE.md`'s netcode section describes the slots and the adaptive delay.

**Lab (local, 60 s a row)**

| Link | Corrections a minute (over 2 cm) | Over 10 cm | Holds a minute | Inputs in flight |
| --- | --- | --- | --- | --- |
| 0 ms | 77 (repeat: 120) | 16 (repeat: 14) | 0 (repeat: 6) | 74 ms |
| 50 ms | 102 | 5 | 7 | 168 ms |
| 150 ms | 76 | 6 | 5 | 364 ms |
| 50 ms ±20, 2% loss | 92 (before: 277) | 8 (before: 170) | 27 | 360 ms (before: 197) |

**Learned**

- The slice's queue already counted ticks roughly right on a lossy link (repeating held buttons, then folding the burst), but every press and key change in the gap landed ticks from the prediction. Standing in for each missing input and acking it keeps the count exact; widening the cushion after the first retransmit means later ones fit, at the cost of the player's actions reaching the server up to a quarter of a second later on that link.
- One 60-second row is noisy here: the same 0 ms row read 77 and 120 corrections a minute over 2 cm. Compare rows over several runs before calling a change.
- On a clean link the over-10 cm count (14 to 16 at 0 ms) was above the gate's 8. I first put it down to the swing's lunge and turn (decision A); the lab now splits each by what the hero was doing, and that was wrong: with Bravo fighting, the rows read 8 / 5 / 3 over 10 cm at 0 / 50 / 150 ms and 4 lossy, and at 0 ms 6 of the 8 were neither a swing nor a hit taken (50 ms: 3 of 5; 150 ms: 1 of 3).

**Next**

- T2: what the 0 ms row's remaining big corrections are (neither swing nor hit: a dodge, a jump or a stall are the candidates). With Bravo fighting the rows are near the gate (8 / 5 / 3 against 8 / 3 / 1), but rows with a fighting Bravo are not comparable with the earlier ones.
- The lab's bot pair cannot finish a run (5 minutes on the hosted build with Bravo fighting: 8 runs, none won, 0 network snaps), so the T1 gate's two-players-through-a-run needs two people.
- The lab against the hosted build once #68 ships, for the real link.
- Bandwidth stays (about 117 KB/s a player).

## 2026-10-27: local session, T2 begun: where the lab's corrections come from, and the clock back from the shelf

Started on Michael's word ("after this work is finished ... please begin the next step ... I don't want to be a blocker", while T1 waits for its gate), on `auto/local-slice-netcode`, stacked on T1's branch. Nothing here is merged or meant to be before T1's gate.

**What changed**

- `shared/src/net/clock.ts`: Hearthgate's Phase 0 clock, back from the shelf for snapshots only (no pings). The offset is the window's least-delayed snapshot rather than the slice's 5% average, and the interpolation delay follows the longest wait for a snapshot a frame saw: the slice's 80 ms on a clean link, rising on a lossy one up to the lag grace (150 ms), never later, since hits on you wait that long so an on-screen dodge counts. Both slew at 10 ms/s. Its numbers are in `tuning.coop` (`interpDelayMaxMs`, `clockWindowMs`, `clockSlewMsPerS`, `clockSnapMs`). 6 unit tests (check 27).
- The lab: `--tune path=value` sends a tuning edit through the server before the run, to test one cause at a time; it reports corrections over 10 cm and the draw delay.
- `decisions.md`: the small corrections in a fight, three options (recommended A, leave them and judge at the gate).

**Lab (local, 60 s a row)**

| Link | Corrections a minute (over 2 cm) | Over 10 cm | Holds a minute | Draw delay |
| --- | --- | --- | --- | --- |
| 0 ms | 75 | 10 | 1 | 83 ms |
| 50 ms | 65 | 5 | 4 | 83 ms |
| 150 ms | 124 | 3 | 4 | 82 ms |
| 50 ms ±20, 2% loss | 277 | 170 | 22 (T1: 30) | 150 ms |

**Learned**

- The fight's corrections are the hero's own swings, not hits taken and not the input queue: at 0 ms the count was about the same with enemies that never swing (164 a minute counting every difference), higher with god mode (319, Alpha fights longer), and unchanged with a four-tick input cushion (159). A melee swing's lunge stretches to its soft target and the soft target turns the hero, both measured on the client against the last snapshot's enemy. Over 10 cm they read 10 / 5 / 3 a minute at 0 / 50 / 150 ms, near Hearthgate's old 8 / 3 / 1.
- With the delay capped at 200 ms the lossy row held only 12 times a minute, but on clean links the delay drifted to 120 to 160 ms after single slow snapshots, later than the lag grace. Capped at the grace: 22 holds, and clean links stay at the slice's 80.
- The lossy row's 170 big corrections a minute are the slice's input queue under retransmits: a player's inputs held 200 ms, the server repeating their held buttons meanwhile, then folding the late burst into fewer ticks, so a dodge or a turn lands at a different tick than predicted.

**Next**

- Michael: the decision on the fight's corrections (decisions.md); T1's gate first.
- T2: the input queue under loss (the lossy row's 170 a minute over 10 cm). Candidates: count the ticks the server guessed and drop as many late inputs when they arrive (keeping their presses), so a late burst is neither folded nor replayed; or Hearthgate's old input slots. Measured on the lossy row before and after.
- T2: bandwidth stays as it is (about 120 KB/s a player); deltas only if the hosted lab or Render's limits ask.

## 2026-10-27: local session, T1: the combat slice on Hearthgate's server

**What changed**

- The combat slice (`mbuckley616/combat-slice`, 363b726) moved over whole. Its engine-free code (`sim/`, `config/tuning.ts`, `level/`, `net/protocol.ts`, `game/Session.ts`) is in `shared/src/` as it was, imported by path (`@hearthgate/shared/sim/world`); everything else (its `Game`, `ClientSession`, views, camera, UI, sound, input, debug panel, CSS, title screen) is in `client/src/` with only import paths changed. Three.js 0.186. TypeScript and Vite stay at 5.x and 6: the slice typechecks clean on them, and dropping `experimentalDecorators` and `useDefineForClassFields: false` (no schema now) gives its classes their own field semantics.
- The slice's `HostSession` runs on the server (`shared/src/game/HostSession.ts`, in `server/src/rooms/FightRoom.ts`): its input queue, acks, folding and staleness line for line, with the local hero taken out and `send` in place of the relay. The room steps it on Hearthgate's wall-locked 60 Hz pump and broadcasts the slice's `snap` every second tick. One room type, `fight`, with the slice's four-letter codes as room ids: Play creates one (solo is a room of one), Invite shares `?join=CODE`.
- Every player is the slice's joiner: `ClientSession` speaks to the room through `ServerLink` (colyseus.js, the relay's events). Its clock runs at the server's speed so debug slow motion, now the server's, slows prediction and drawing alike. It counts corrections and snaps for the tests and the lab.
- What the slice's host did itself now goes to the server: a lost or won run restarts on anyone's F, tuning edits of values the fight reads are range-checked and passed to everyone (`config/edits.ts`), and the cheat buttons work in a dev build only (`npm run dev`, or `HEARTHGATE_DEV=1`, set in `render.yaml` for Phase 1). Every message is checked before the session sees it (`net/validate.ts`); the rate limit counts commands, 75 a second with a burst of 120.
- Keyboard-only (rule 4, decision 10A): J attacks, L guards, the arrows turn and tilt the camera at the stick's rates. The slice had no attack or camera without a mouse.
- Gone: Hearthgate's `sim.ts` and its modules and ~230 tests, the old client, the schema, the village, dungeon and sim rooms, the levels, the KayKit packs and the art spike images. `clock.ts`, `interp.ts` and `gear.ts` are read-only in `docs/reference/hearthgate-shelf/` for T2 and Phase 3; the hand-off is at 1f4e3e9 for T3.
- Tests: `tests/parity.ts` plays two scripted parties (a party of three to four through four waves with a join and a leave; the Warden, a wipe, a restart and the run again; 9,000 ticks each) through the slice's own `stepSim` from its repo and through Hearthgate's copy: identical every tick. Their hashes are in `shared/src/parity/golden.json`, which `npm test` checks, so CI holds the line without the slice. Unit tests for the room's queue, acks, joins, snapshots and requests, and for the message checks (21 in all). `test:net` rewritten on bots speaking the slice's messages, plus the browser's own `ClientSession` (25 checks). `tests/smoke.e2e.ts`: solo, two players by code, through the gate into wave 1 (3/3). The lab rewritten for the new client.

**Lab (local, this desktop, 60 s a row, both pages at 60 fps on the GPU; a correction is a replay that moves the hero over 2 cm, the old client's line)**

| Link | Corrections a minute | Snaps | Holds a minute | View lag | Inputs in flight | Server to each player |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms | 59 | 0 (+2 placed) | 0 | 110 ms | 66 ms | 122 KB/s |
| 50 ms | 71 | 0 (+2 placed) | 2 | 215 ms | 175 ms | 119 KB/s |
| 150 ms | 93 | 0 (+2 placed) | 3 | 410 ms | 366 ms | 118 KB/s |
| 50 ms ±20, 2% loss | 379 | 0 (+2 placed) | 30 | 225 ms | 196 ms | 118 KB/s |

Hearthgate's last numbers (step 1, its own fight) were 8 / 3 / 1 and 8 lossy. "Placed" snaps are the server moving the player itself (the gate bringing stragglers in, a restart). Counting every difference instead of those over 2 cm, the same rows read about 210 a minute at 0 ms, 3 cm on average. Without enemies the browser's `ClientSession` makes none at all (`test:net`: four seconds of running, sprinting, dodging and jumping). The same row with enemies that never swing reads about the same as with them, and with god mode more (Alpha fights longer): the corrections come from the hero's own swings, not from hits taken. A melee swing's lunge stretches to reach its soft target and the soft target turns the hero, both measured against the enemy where the last snapshot had it; the server measures a few ticks later.

**Learned**

- The corrections are the slice's own joiner prediction, now every player's: a swing's lunge and soft-target turn are predicted against enemies where the last snapshot had them. In the slice the host never predicted; solo is now a joiner, so solo has them too. They are eased over 120 ms, but the lab's line (30 a minute) calls every row rough. That is T2's first question, and Michael's, since the fixes change the slice's fight or its feel.
- On the lossy link the slice's input queue is the trouble: a retransmit holds a player's inputs 200 ms, the server repeats their held buttons meanwhile, then folds the late burst into fewer ticks. 379 corrections a minute, and Bravo's view of Alpha holds 30 times a minute behind the fixed 80 ms delay.
- The slice's input cushion (two ticks) assumes one tick a frame. At 25 fps (the lab's first run, software WebGL) every frame carried two or three ticks, the queue ran dry between frames, the server repeated the held buttons, and corrections ran 268 a minute at 0 ms. A machine below 60 fps will see the same.
- A restart has to travel as a message: the slice's host read F's *press*, and a tap released inside one frame never shows as interact held in any command. The lab caught it.
- Lag grace (150 ms) now covers every player, solo included; in the slice the host had none. Whether enemy hits feel late solo is a gate question.
- About 120 KB/s a player as msgpack (a snapshot is 5.3 KB as JSON for four players): under the 170 KB/s the plan feared.

**Next**

- Michael's T1 gate: side by side with the slice on his desktop, solo on the hosted build feels the same (movement, the chains at 0.25×, hit feel, the look, the sound); then two players through a run with no snap. Watch for: hits on you landing late solo (lag grace), and small eases in a fight.
- T2, netcode from the lab: the combat corrections, the cushion at low frame rates, the lossy row's holds.

## 2026-10-27: local session, step 1 played; the slice moves over whole

**What changed**

- Step 1 merged (PR #64) and is live on the hosted build. Michael played it: it felt okay, but the combat is still Hearthgate's and the movement is hard to judge under the old animations and meshes, and he feared the system-by-system port would water the slice down.
- New plan, `docs/slice-transplant-plan.md`, replacing `combat-port-plan.md` (except its progression section): copy the slice as it is and run its `HostSession` on Hearthgate's server, with every player on the slice's `ClientSession`; then rebuild the village, the portal, generated dungeons and progression on top of it. It lists what Hearthgate keeps (the server, hosting, rooms and hand-off, the 60 Hz pump, the tuning path, the lab, the team, the design) and what goes (`sim.ts` and its tests, the whole client, the schema, the levels, KayKit). Six steps, T1 to T6; the backlog and `decisions.md` follow.
- Earlier the same day: the port was re-planned once (the slice's look first, a dungeon generator before the gate) and Michael answered the generator's questions; those answers carry into T4. The slice was pushed to the private repo `mbuckley616/combat-slice`.

**Learned**

- The slice's code already has the seam a server needs: `stepSim(state, commands, dt)` is pure and engine-free, `HostSession` is the only thing that runs it, and the view only reads a session. A system-by-system port re-creates what that seam lets us move whole.
- A step that changes only what the player cannot see (the tick rate, prediction) is hard to judge in a playtest under the old look: Michael could not tell the movement from the animations.

**Next**

- T1, the transplant, in a local session with Michael.

## 2026-10-27: local session, the combat port's step 1 finished (camera and keys)

**What changed**

- The camera is the combat slice's orbit camera (`client/src/orbit.ts`), centred behind the hero. It sphere-casts from a pivot 1.7 m up to the eye against the level's walls, roofs and the ground (`shared/src/geometry.ts`, the slice's cast on boxes), eases in early on a wider probe and on a cast where a fast swing is heading, and when the walls would bring it inside 1.5 m it cranes up over the hero instead. Pitch runs from 30 degrees below the pivot to 60 above, the bow's lock swings it round and pulls the look point toward the target, and a sprint widens the view by 5 degrees. Its numbers are `tuning.camera` and `tuning.lockOn`, so the panel tunes it. Hearthgate's swing in behind the travel is gone: with strafe movement the hero faces the camera, so there is no travel to swing behind. The old camera's helpers left `shared/src/camera.ts`; `CAMERA` keeps only the shot the art tools frame and the wall fade's aim height.
- Input goes through the slice's action layer (`client/src/input/`, decision 10A): Ctrl dodge, Space jump, Shift sprint, left click or J attack, right click or L guard, Q and E the two ability slots, Tab or the middle button lock-on, F talks and uses the Revive Draught, WASD moves, the arrows turn the camera (Up still raises the eye; the mouse and the right stick tilt the usual way). The gamepad is the slice's: X attack, Y jump, B dodge, A interact, LB and RB the abilities, LT guard, L3 sprint, R3 lock-on. 1, 2 and 3 do nothing until step 3's weapon swap. The HUD's hints and slot keys say so.
- Ctrl is the dodge and Ctrl+W (dodge while running forward) closes a tab, which no page may stop, so a real join asks before leaving, as the slice did; other Ctrl shortcuts are stopped while playing. Scripted joins (tests, the lab) skip the question.

**Learned**

- Backed flat against a wall the camera cranes nearly overhead (up to 85 degrees), the slice's behaviour, and eases back out as the hero steps away. It never enters a wall: `camera.e2e` backs into the yard's east wall at 20 degrees below the pivot and checks fifty frames that the eye is outside every wall and that no wall stands between it and the head; with the walls left out of the camera the same test fails with the eye inside the wall.
- The browser pane's page runs about one frame a second while the pane is hidden, so camera feel cannot be judged there; the headless browser suite runs at full rate.
- Checks: `npm run check` 229 (the old camera's seven tests out, three for the sphere cast in), `test:net` every step, the browser suite 20/20.

**Next**

- Step 1's gate, Michael's: run round the Warrens on the hosted build once the branch is approved and merged; it should feel like the slice, the camera never clips, the panel tunes it live, keyboard-only works, and the lab is no worse. The lab against the hosted build goes with it.
- Then step 2, the sword's combat.

## 2026-10-26: local session, the combat port begins (step 1, part one)

**What changed**

- Michael's combat slice (a separate repo, M0 to M6 passed today) is now the reference for Hearthgate's combat. `docs/combat-port-plan.md` has the plan: Hearthgate's server and netcode stay, and the slice's simulation, tuning, input, camera, views, effects and sound come across in seven steps, each with a playtest gate. His answers are in `decisions.md`: 1A 2A 3A 4B 5A 7A 8A 9A 10A, and his own progression (the slice's levels to 50 with a talent point a level, then Champion-style points). The steps head Phase 1 in the backlog, all **(Fable)**. A `FREEZE:` issue (#63) keeps the builder idle while the shared sim is rewritten.
- The server ticks at 60 Hz (1A) and sends a patch every second tick, 30 a second (`PATCH_TICKS`, `PATCH_MS`). A tick is 16.7 ms, not a whole number of ms, so every slot and replay time goes through `onTick` (back onto the grid), and every time in the schema is `float64`: Colyseus sends a `number` as float32 whenever that loses under 1e-4, which moved a swing's end a hair off the grid and would have made the replay end it a tick late.
- The slice's movement in `applyInput`, with the slice's numbers in the new `shared/src/tuning.ts`: acceleration toward the stick (velocity `vx`, `vz` is synced and rewound), strafe movement facing the camera's aim (`aimX`, `aimZ` in every frame; a frame with no aim turns to run, so the bots still swing where they walk), walk, run 5.5, sprint 8 forward only, the slice's dodge (two charges, an eased roll, a backstep with no direction, i-frames for the first 300 ms in `isUntouchable`, any input ends the tail past 240 ms, it cuts a swing short), the slice's jump arc (still a pure function of the landing time). Combat on top is still Hearthgate's until step 2.
- The live tuning panel (backtick, lil-gui, `client/src/debug.ts`). An edit goes to the server as `tune`; the server checks it against `tuningRanges`, applies it and every room sends its clients the whole set; a joining client gets it before its first patch.
- CLAUDE.md: rule 2 reads "time comes from the tick count" (2A), `tuning.ts` is the tuning surface, and the netcode and movement notes are rewritten for 60 Hz.

**Learned**

- The 60 Hz tick first made the lag lab much worse on this desktop (corrections a minute at 0 / 50 / 150 ms: 68 / 234 / 46; the 20 Hz build on the same box: 14 at 0 ms). Counters on the input queue showed why: under the lab's load the server stalled 200 to 450 ms several times a run, past its 200 ms catch-up, and dropped that time; every client's frames then sat up to 25 ticks ahead of their slots, and the drain cleared them one tick a second, each a correction. At 20 Hz the same stall dropped four ticks. Three fixes: the pump catches up 500 ms, the drain moves the slots back by the whole standing backlog in one step, and the lag window is 300 ms, so a frame a TCP retransmit held up (200 ms minimum timeout) still lands in its slot (the lossy row went from 34 corrections a minute to 6 with it). After those and the movement: 8 / 3 / 1 at 0 / 50 / 150 ms and 8 on the lossy link, no snaps, every row ok.
- More packets mean more lost packets: at 60 Hz the client sends three times the input messages, so a lossy link holds up frames three times as often. Batching frames is the next lever if the hosted build shows it.
- A Node timer asked for 16.7 ms fires nearer 25 ms on Windows, so the bot harness now paces frames by wall time (`sendPaced`), as the browser's `InputClock` does.
- An idle enemy kept the first player in the room as its target while asleep; at 60 Hz a tick falls between two joins. Asleep, it now wakes for whoever is nearest.
- The browser suite: 19/19 after two fixes. A tap of a key is one frame, which with acceleration moves about a centimetre, so `village.e2e` nudges onto its marks with 150 ms holds. And dungeon rooms are now matched by level (`filterBy(["level"])`): a page asking for `?level=yard` had joined a field room an earlier test left open. A browser-pane tab left in the village also stalls that test's portal, which waits for everyone in the room.

**Next**

- Step 1 is not finished: the 10A key layout through the slice's action layer (Ctrl dodge, left click attack, right click guard, Q/E, F; J, L and the arrows for keyboard-only), and the slice's orbit camera. Then Michael's step 1 gate on the hosted build.

## 2026-10-18: Session 50, a downing blow eases instead of snapping

**What changed**

- The critic's bug (c44600d): on a slow link a downing blow snapped the player back. The client keeps predicting its run for a round trip past the frame the server downed it on, and a downed player's replayed frames only crawl, so the error is run speed times the round trip, over `SNAP_DISTANCE` (2.5 m) once that passes about 420 ms; the lab saw 2.7 m and 2.4 m. Like the refused dodge (Session 37), it is a prediction the client could not make, not a teleport. `reconcile` in `client/src/net.ts` now eases a correction on the patch that takes us from standing to downed up to `DOWNED_SNAP_DISTANCE`: the snap limit plus `DOWNED_EASE_MS` (500 ms) of sprinting, 7.0 m, from `PLAYER`'s own numbers so it follows their tuning. The same error while already down, or with no down in it, still snaps.
- Draw and count only: the server, `shared/` and the prediction are unchanged; the player still ends exactly where the server put them, the offset decays as every correction's does.
- Test: `tests/reconcile-placement.ts` case 6 runs east with eleven frames unconfirmed (550 ms), the server downs us at the first: 2.70 m, the critic's figure, eased with one correction and the exact offset; already down, the same error snaps. Without the fix the case fails ("a 2.70 m downing blow snapped instead of easing"). `npm run check` 226; `test:net` every step.

**Learned**

- The downed crawl replays: ten frames at 1.2 m/s claw back 0.6 m of the run, so a 500 ms round trip alone (2.46 m) stays just under the snap limit and it takes about 550 ms to cross it, near the critic's ~420 ms estimate once a sprint or a knock is in the mix.

**Next**

- Phase 1 has no builder item left: the gate playtest is Michael's. The critic can watch for `hp 0` snaps at 150 ms; there should be none.

## 2026-10-17: Session 49, the two-player test holds until it has moved

**What changed**

- The critic's bug (0f5465b): `tests/two-players.e2e.ts` held D for a fixed 700 ms and then asked for more than 2 m. On a slow headless page one frame gap can cover the whole hold, the input clock makes at most four frames of a gap (4 x 0.3 m), and the test failed at exactly 1.2 m: it measured the page's frame rate. Now Alpha holds D until its own position has moved more than 2 m (polled, 10 s limit), then lets go, the way `village.e2e`'s `walkTo` holds until arrival. The checks that matter are unchanged: Bravo must see Alpha more than 2 m along, and the ping must read. Test-only: nothing in `shared/`, the server or the client changes.
- `two-players.e2e` 8/8 at normal speed and 4/4 with Alpha's page throttled six times by CDP (about 4 fps), the case that used to fail. `npm run check` 226; `test:net` every step (run on the branch before the change; the change touches neither `server/` nor `net.ts`).

**Learned**

- The browser tests share one server and the client joins the first open room for its level, so `--workers` above 1 puts every repeat into one room (the party reads 8, not 2). Repeat them with `--workers 1`.

**Next**

- Phase 1 has no builder item left: the gate playtest is Michael's.

## 2026-10-16: Session 48, no figure where the server never put it

**What changed**

- The critic's bug (2026-10-16): from the `handoff` message to the new room's first patch, `draw()` drew our own player in the new level at the old room's coordinates (the village portal, about (0, -9.3)), then at a fresh player's (0, 0) once the seat was taken, and the camera followed it; 1.35 s on the critic's box. Now `draw()` in `client/src/main.ts` draws the own figure and moves the camera only once `Net.isPlaced` (a new getter on the existing `placed` flag in `net.ts`) says the room's first patch has placed us. Until then the figure is removed and the camera holds where it was; the mouse and arrows still turn it. The hand-off's `resetFollow` keys off the same flag, so the camera starts at the placement.
- The same holds on the first join, where the camera used to start at (0, 0) and glide to the spawn.
- `__hg.ownDrawn` for the tests. Nothing in `shared/`, the server, prediction or the inputs changes: draw-only.
- Test: `tests/village.e2e.ts` records every frame through the portal and fails if the own figure is drawn between the hand-off and the Warrens' first patch. With the fix turned off it fails, the figure at (1.70, -9.72) inside the Warrens. `npm run check` 226; `test:net` every step; the browser suite 19/19; `village.e2e` 9 of 10 repeated, the one failure at the keeper's speech before the portal (main alone failed 1 of 4 here, at the step after arrival).

**Learned**

- Playwright here needs `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`: the installed `@playwright/test` looks for headless shell 1243, and the image carries 1194.
- `village.e2e` flakes on this box about one run in five, at different steps (the keeper's speech, the step after arrival), with or without this change: slow headless frames against fixed timeouts. Worth the critic's look if it continues.

**Next**

- Phase 1 has no builder item left: the gate playtest is Michael's. If he sees the figure "at an angle" again after the portal, it is no longer this.

## 2026-10-15: Session 47, the portal can no longer strand a player

**What changed**

- Michael's report (B, 2026-10-15): through the portal, the figure at an angle, no movement at all, the HUD otherwise normal. Not reproduced: five browser runs here, a key held through the hand-off in three, all moved in the Warrens, and the shared sim moves from every spawn point on every level. One path in the code gives exactly those symptoms, and it is now closed: `Net.handoff` (`client/src/net.ts`) waited for the old room to acknowledge the leave, then took the seat, and if the seat was refused or never answered it only logged to the console. The client was then left with no room for good: the player drawn in the new level, the HUD up, every input dropped.
- The hand-off now sends the old room's leave without waiting for it (the seat is ours either way), gives the seat `HANDOFF.seatTimeoutMs` (8 s, in `sim.ts`; the server holds a seat 15 s), and when the seat is refused or times out joins the village under the same name and weapon, with "The way closed: back to the village" on the status line. A join that answers after it was given up is left at once. `__hg.handoffFallbacks` counts them.
- The camera starts over at the hand-off's placement (`View.resetFollow`): it used to glide 10 m from the portal to the new spawn and read the jump as travel, which swings the view round behind it, so the figure arrived seen from an angle.
- Test: `test:net` step 6e drives the real `Net` at the client rate through the village portal (5.1 s) and walks 6.00 m east in the Warrens a second later; then a seat for a room that does not exist (the server answers "seat reservation expired") lands it in the village in 71 ms, where it walks 6.00 m. `npm run check` 226; `test:net` every step; `village.e2e` and `camera.e2e` 5/5.

**Learned**

- The server's refusal for a seat it does not hold is "seat reservation expired", the same error a seat taken after its 15 s gets, so the fallback covers a slow hand-off and a lost room alike.
- In the headless browser here the first key pressed after arriving in the Warrens can be lost: the dressing builds on the first frame in the new level and the stall outlasts a short press. A held key is not lost. On real hardware the build is far shorter.

**Next**

- The critic: the portal on the hosted build (Michael's B), watching `__hg.handoffFallbacks` and the console for "hand-off to warrens failed". A fallback seen there means the seat is being lost and the server side is the next place to look; a stuck player with no fallback means another cause.
- Phase 1 has no builder item left: the gate playtest is Michael's.

## 2026-10-15: Session 46, mouse look and mouse buttons

**What changed**

- Michael's A (2026-10-14): pointer-lock mouse look, the left button attacks, the right blocks. A click on the game view takes the lock (`Input.attachMouse` on the renderer's canvas, from `startLoops`, so the join screen never takes it); under the lock the mouse turns the camera, and with it where W walks; Escape lets go, the browser's own key. The click that takes the lock does nothing else, and buttons are read only under the lock, so a click on the HUD's talk button never swings.
- `mouseTurn` in `shared/src/camera.ts` (pure, beside `turnCamera`): `CAMERA.mouseDegPerPx` 0.15 in `sim.ts`, so 2,400 px is a full turn. Right turns the view right like the Right arrow; up lowers the eye to look up, the usual mouse way and the opposite of the Up arrow's RuneScape tilt; pitch stays in the 5 to 45 degree clamp. A per-pixel turn, not a rate, since the mouse is a position. `View.turnByMouse` counts it as the player's own camera input, so the swing in behind waits its 1.2 s after it as it does after the arrows.
- Left button: the same attack press as J. Right button held: block, as L, Q or LT; let go on release anywhere, on losing the lock and on blur. The context menu is off on the canvas. Nothing in `InputFrame`, `shared/src/sim.ts`'s simulation, the server or the netcode changes: the buttons become the frame's existing `attack` and `block`.
- The HUD's key list has a line for it, hidden on touch screens and on screens under 481 px tall, where it pushed the hint into the top-left panel at 640 x 400. `__hg` gains `mouseLocked`, `me.attackUntil` and `me.guarding`.
- Tests: `camera.test.ts` one case (direction against the arrows, the clamp, a full sweep wraps, no travel no turn); `camera.e2e.ts` a mouse-look case with real pointer lock in headless Chromium: the locking click swings nothing, 200 px right turns 30 degrees, up lowers the pitch, right button guards and lets go, left button attacks, and after the lock is let go the mouse turns nothing (4/4 repeated). `npm run check` 226; browser suite 19/20, the one failure `two-players.e2e` at 1.2 m as on main here (Session 45).

**Learned**

- Headless Chromium grants pointer lock to a Playwright click and reports `movementX` from `page.mouse.move`, so the mouse is testable end to end without stubbing `pointerLockElement`.
- "Turns the camera and aim": the player faces the way they move (`applyInput` sets `facing` from the move vector), so the mouse aims by turning the camera, which turns the move keys. A standing player swinging toward the crosshair would need a facing in `InputFrame`, which is shared-sim work, so it is not built; the bow's lock-on is unchanged.

**Next**

- Michael's feel at the gate playtest: the sensitivity (`CAMERA.mouseDegPerPx`), and whether a standing swing should face the crosshair (a **(Fable)** item if so).
- The portal bug waits on Michael's answer to the critic's question in `decisions.md`.

## 2026-10-15: Session 45, jump, sprint and a separate dodge (Fable)

**What changed**

- Michael answered 1A 2A 3A on the control room. `applyInput` (`shared/src/sim.ts`) has a jump and a sprint; the numbers are in `PLAYER` (`sprintMult` 1.5, `jumpMs` 500, `jumpHeight` 0.6, `jumpSteer` 0.25).
- The sprint: `sprint` held in the frame runs at 9 m/s. Swinging, an ability and the guard's shuffle are unchanged by it, so they stop it; a dodge from a sprint is the same dodge.
- The jump: a `jump` press on the ground, not mid-swing or mid-dodge (a dodge pressed on the same tick wins), sets `jumpUntil` to ten ticks on and keeps this tick's ground velocity as `jumpVx`, `jumpVz`: 3 m walking, 4.5 m sprinting, plus a steer of a quarter of walking speed from the stick. In the air there is no swing, ability, dodge, guard or second jump; walls stop a hop as they stop a walk; a down or a respawn cancels it. `jumpHeight(p, now)` is the parabola, a pure function of the landing time.
- Server: `jumpUntil`, `jumpVx`, `jumpVz` in `PlayerState` and `copyPlayer`. Client: the rewind copies them (so a jump replays like a dodge), remotes keep `jumpUntil` and are lifted by `jumpHeight` at `remoteNow()`, the figure rises by the height and plays `Jump_Full_Short` fitted to the 500 ms.
- Bindings (`client/src/input.ts`): J attacks, Space jumps, Shift held sprints, K or C dodges. Gamepad: X attack, A jump, B dodge, a left-stick click sprints until the stick comes back to rest, slots Y, RT, RB; RT is also the bow's lock-on cycle, which is safe because the bow has no slot 2. The HUD's key list says so.
- Tests: `shared/src/jump.test.ts` (17: speeds, the parabola, landing on a tick, carried speed, steering, what the air forbids, walls, a down, determinism over 200 scripted frames, validation). `test:net` step 5d: 20 sprinting ticks move 9.00 m on the server, a sprint jump carries 4.57 m (4.5 plus the takeoff tick's steer) and the other client sees the same landing time and speed. `figures.e2e` presses Space and sees the landing time come back and the jump clip play (3/3). `npm run check` 225, `npm run test:net` every step.
- CLAUDE.md's netcode section has a line for the jump.

**Learned**

- Keeping the jump's height out of the integrator is what makes it free for the netcode: there is no vertical speed to drift, so nothing new can disagree between prediction and replay, and the remote hop needs no new snapshot field or interpolation. Session 44 planned `y` and a vertical speed in the sim and the schema; the landing time does both jobs.
- Lag lab, 60 s a condition, on this machine at about 12 fps (branch run twice, main once): corrections a minute at 0 / 50 / 150 / 50 lossy were 3 / 5 / 1 / 4 and 6 / 1 / 0 / 1 on the branch, 1 / 2 / 4 / 3 on main; snaps 0 everywhere. Holds read 6 to 10 a minute on the branch and 4 to 10 on main. The lab's schedule never jumps or sprints, so the spread is the slow frames', not the change's; the critic's real-hardware run is the number to trust.
- `two-players.e2e` fails here on main too, every run at exactly 1.2 m for a 700 ms hold of D: the headless software rasteriser of Session 41, not this change. The rest of the browser suite passes (17/18).

**Next**

- The critic: the lab with a schedule that jumps and sprints (it owns `tests/lab/`), and whether `two-players.e2e`'s 1.2 m reproduces off this machine.
- Michael's playtest feel: the hop's height and air time, the sprint's 9 m/s against enemies (kiting), and RT for slot 2 on a pad.

## 2026-10-14: Session 44, jump, sprint and dodge: the design question (Fable)

**What changed**

- Nothing in code. Read the movement path end to end (`applyInput` in `shared/src/sim.ts`, `client/src/input.ts`, the replay in `client/src/net.ts`, `SimRoom`) and wrote the design question under Pending in `decisions.md`: the jump (a hop that clears nothing, a hop that clears low cover, or a hop that is also a defence), the sprint (free, stamina shared with the dodge, or out of combat only), and the buttons (Space jump, hold Shift sprint, K or C dodge; gamepad A jump, B dodge, left-stick click sprint, ability slot 2 to RT).
- FREEZE #50 stays open: the builder must not run while the card holds `shared/`.

**Learned**

- Space is the attack key today (with J) and Shift and K are dodge, so Michael's note moves three bindings, not one; the gamepad has no free face button, which is why slot 2 has to move.
- Walls are footprints with no height in the sim: the 3.2 m dungeon walls and the yard's "low wall" differ only in how they are drawn. Clearing low cover means giving every wall a height, which is why it is its own option.
- A jump is vertical state the server owns: `y` and a vertical speed on `PlayerSim`, `y` in the schema, `y` in the remote pose track, and the replay restoring both. Integrating it per tick with a fixed `dtMs` keeps prediction and replay identical; with g = 20 m/s² a 0.6 m hop is 4.9 m/s up and 0.49 s in the air.

**Next**

- When Michael answers: the sim (jump, sprint, constants in `PLAYER`), `InputFrame` (`jump`, `sprint`), the schema and the replay, the bindings and the HUD hint, unit tests, `test:net`, and the lag lab at 0, 50 and 150 ms against main's 0 / 0 / 0.

## 2026-10-14: Session 43, the Warrens in the KayKit dungeon kit

**What changed**

- `client/src/dungeon.ts` dresses the Warrens (only them: the yard, the cellar, the field and the village stay greybox) from the Dungeon Pack at 0.8 m a kit unit, so a kit wall's 1-unit thickness is the sim's 0.8 m wall and it stands 3.2 m tall. Every long wall rectangle is tiled with `wall` pieces stretched along its length to fill it exactly, with a `wall_endcap` inside each open end (the six doorway sides); the level's edge, a collider already, gets the same walls just outside its bounds in place of the low greybox rim. The floor is 169 `floor_tile_large` tiles. The three cover pillars hold a kit `pillar`, `crates_stacked` and `barrel_large`, each scaled to sit inside its 1.4 m rectangle. 44 `torch_mounted` every 6 m along the room faces, and the torch nearest the middle of each room and of the hall carries a point light (4 in all, warm, 9 m, no shadows). Repeated pieces are one `InstancedMesh` per wall rectangle (so the camera's fade can swap one wall's material), the floor and the torches one each; everything draws with the pack's one material on `dungeon_texture.png`. `level.ts` and collision are untouched.
- The camera: each dressed rectangle goes into the pull-in at the kit's height (3.2 m, a prop at its own), so the eye stops in front of the tall walls (2.7 m from the head with a wall behind it, in a check here); the fade swaps a dressed wall to a see-through copy of the kit material.
- `models.ts` loads the seven pieces with the figures, before anyone joins. `__hg.dressing` gives the instance counts; `village.e2e` checks the Warrens arrive dressed with at most four lit torches.
- Browser suite 18/18, `npm run check` 208, build clean.

**Learned**

- Frame time on the Warrens, one headless page here at 1280 x 720 (software GL, so only the ratios mean anything): 117 ms before, 450 ms with eight torch lights, 260 ms with none, 325 ms with the four kept. Every point light is paid on every lit pixel; the walls and floor (about 85,000 triangles, 50,000 of them in the shadow pass) cost the rest. The critic's lab pages will give the real number.
- Bytes: the seven pieces and the texture add 0.23 MB, so the client loads 6.6 MB of models.
- The kit's `wall_doorway`, `wall_corner` and chests were left out: the doorway piece is solid either side of a narrower opening than the sim's 3 m gaps, a corner and a chest reach outside the rectangles, and nothing in sight may be other than a collider. The end caps fit inside.

**Next**

- The critic's frame time on the Warrens; if it costs, the first cuts are two lit torches, not four, and the torches out of the shadow pass.
- Michael's pick of the village kit from Session 42's shots.

## 2026-10-14: Session 42, the Hexagon tavern scale test

**What changed**

- `npm run tavern-test` (`tests/tavern-test.ts`, page `client/tavern-test.html`, dev only like the turnaround) builds the real village `View`, hides the greybox Tavern (walls, roof, sign; the sim's walls are unchanged), stands KayKit Hexagon's `building_tavern_green` on its spot turned so its arched door faces the square, puts the Knight beside it in its idle, and renders from the game's camera (`CAMERA`'s 5.5 m, 1.6 m look height, 0.55 m shoulder, 50 degree field of view) at 1280 x 720. Two shots, committed: `docs/art/spike/hexagon-tavern-door.png` (at the foot of its steps, starting pitch) and `hexagon-tavern-square.png` (from beside the Storehouse across the square, 18 degrees). `-- --probe` writes turns of the model to `test-results/` to find the door again.
- The tavern is scaled 6x: its door then stands about 2.2 m against the 1.8 m Knight, on a stone plinth about 0.8 m high with three steps, and the building is about 7 m wide, 8 m deep and 8.4 m to the top of the barrel on its roof (the greybox Tavern is 10 x 6 m). The rest of the village is not dressed.

**Learned**

- The Hexagon models carry no door node and no hex tile under the buildings: the scale comes from the shots, not the data. 1 unit of the tavern is 1.4 units tall, so at 6x it is 8.4 m.
- At that scale it reads as a building a Knight walks into, and the pack's villagers stand right beside it. Its footprint is squarer than the greybox's, so taking the kit means re-blocking the Tavern's walls to about 7 x 8 m.

**Next**

- Michael looks at `docs/art/spike/hexagon-tavern-*.png` and picks Hexagon or the Quaternius Medieval Village MegaKit for the village.
- The builder takes part (1) of the item: the KayKit dungeon kit on the Warrens.

## 2026-10-14: Session 41, the KayKit Knight is every player

**What changed**

- `client/src/models.ts` loads the KayKit figures once with three's `GLTFLoader` before anyone joins: the Knight and the four villager bodies, the four held weapons, and five Rig_Medium clip files. The join screen's button reads "Loading" until they are in (a press made while loading joins as soon as they are); a scripted join (`?name=`, tests, the lab) waits for them too. Each figure is a `SkeletonUtils.clone` scaled to 1.8 m, facing +z, returned as the same `Figure` render.ts already used, with a `rig` (one `AnimationMixer`) in place of the hand-posed parts.
- Every player is the Knight, whatever the weapon. The held weapon is the pack's own in the rig's `handslot.r`: `sword_1handed` for the one-handers, `sword_2handed` for the Claymore, `axe_2handed` for the other two-handers, `bow_withString` for the bow, tinted 45% toward its material's colour with the old glow for the high tiers. The party colour is an outline (each body mesh drawn again on the same skeleton, back faces pushed 2.2 cm out along the normals) and the name tag; the outline is what flashes, lightens on a swing and darkens when downed or dead.
- `RigAnimator` maps the timers render.ts already has onto clips: `Idle_A` (`Melee_2H_Idle` with a two-hander, `Ranged_Bow_Idle` with the bow), `Walking_A` under 2.6 m/s and `Running_A` (`Running_HoldingBow`) above, at a time scale from the drawn speed `stepFigureWalk` now also keeps; `Melee_Blocking` while blocking, `Crawling` while downed, `Death_A` held at its end while dead. One-shots play over the base and hand back: `Melee_1H_Attack_Chop`, `Melee_2H_Attack_Chop` or `Ranged_Bow_Release` on a swing (fitted into the swing's time plus 0.3 s), `Dodge_Forward`, `Hit_A` when the drawn hp drops, `Spawn_Ground` on standing up from a down or a respawn. A staggered player still rocks back 0.25 rad. The clips' root translation is dropped at load, so the dodge never draws the figure off the server's spot. No allocation per frame.
- Villagers are the Barbarian, Mage, Ranger and Rogue in turn, each in `Idle_A` at a different phase, stepped in `View.render`.
- The goblin's gear moved onto the dungeon atlas's colours (wood `#A86A4C`, leather `#5E4A40`, iron `#5F676C`, gold `#F0B84A`); its Grub green skin already sits on the atlas's green. The other enemy figures are unchanged. The spike's adventurer code is gone from `figures.ts`.
- `npm run turnaround` renders the Knight (idle, walk, swing; front, side, back, in game) through the real clips, beside the adventurer reference it replaces: `docs/art/spike/knight-*.png`; the goblin sheets are re-rendered in the new colours. The adventurer sheets stay as they were.
- Tests: `figures.e2e` checks the Knight's budget (14,000 drawn triangles), its height, and that it stands in `Idle_A`, runs in `Running_A` and chops on J. `two-players.e2e` now joins the open field (below). Browser suite 18/18, with figures, village, combo and hit-feedback 12/12 over three repeats and two-players 6/6; `npm run check` 208; `npm run test:net` all steps.

**Learned**

- The clips in the pack: General (Death_A, Death_A_Pose, Death_B, Death_B_Pose, Hit_A, Hit_B, Idle_A, Idle_B, Interact, PickUp, Spawn_Air, Spawn_Ground, Throw, Use_Item), MovementBasic (Jump_Full_Long, Jump_Full_Short, Jump_Idle, Jump_Land, Jump_Start, Running_A, Running_B, Walking_A, Walking_B, Walking_C), MovementAdvanced (Crawling, Crouching, Dodge_Backward, Dodge_Forward, Dodge_Left, Dodge_Right, Running_HoldingBow, Running_HoldingRifle, Running_Strafe_Left, Running_Strafe_Right, Sneaking, Walking_Backwards), CombatMelee (Melee_1H_Attack_Chop, _Jump_Chop, _Slice_Diagonal, _Slice_Horizontal, _Stab, Melee_2H_Attack_Chop, _Slice, _Spin, _Spinning, _Stab, Melee_2H_Idle, Melee_Block, Melee_Block_Attack, Melee_Block_Hit, Melee_Blocking, Melee_Dualwield_Attack_Chop/_Slice/_Stab, Melee_Unarmed_Attack_Kick, Melee_Unarmed_Attack_Punch_A, Melee_Unarmed_Idle), CombatRanged (Ranged_1H_/2H_ Aiming, Reload, Shoot, Shooting; Ranged_Bow_Aiming_Idle, _Draw, _Draw_Up, _Idle, _Release, _Release_Up; Ranged_Magic_Raise, _Shoot, _Spellcasting, _Spellcasting_Long, _Summon); every file also has T-Pose. Simulation, Special and Tools are not loaded.
- The Knight is 5,800 triangles (the spike's adventurer was 564), drawn twice for the outline: 13,504 with the sword in hand. The client now loads 6.4 MB of models: 1.97 MB of bodies, 0.16 MB of weapons and textures, 4.25 MB of clip files. The clip files are two thirds of it and carry a mannequin mesh and about 80 clips we do not use; cutting them to the 15 we play would bring the load near 2.5 MB.
- three's loader drops the dots from the pack's bone names: `handslot.r` is `handslotr`.
- The first patch of a join puts the predicted time 200 ms before zero for one frame, so `now < dodgeUntil` reads true; the old figure leaned for a frame, the Knight would play a whole dodge. The animator takes the state as it stands for its first 0.3 s.
- Headless Chromium here draws in software: two pages in the village went from about 183 ms a frame to about 280 ms with the skinned figures, past the input clock's 200 ms catch-up, so `two-players.e2e` held D for 700 ms and moved 1.2 m in one run of four. Turning off the outline, the villagers' shadows or frustum culling each saved about a tenth. The test was written before the village and moved into it silently when the village became the first room; it now joins the open field, which is what it checks. The cost is the software rasteriser's, not the game's; the critic's lab pages (about 31 fps) will say what a real frame costs.

**Next**

- The dungeon kit on the Warrens and the Hexagon tavern test shots (the next item).
- The critic's lab pages give the frame time with the Knight; if it costs, a smaller clip file (the 15 clips we use) and a single-mesh outline are the first cuts.
- Michael's eye at the gate playtest: the swing clips are fitted to the swing's time, not to the server's hit frame.

## 2026-10-14: local session, the art sources picked and the KayKit packs in the repo

**What changed**

- The control room's "Fable routine has not taken the input-timing card" blocker is cleared. It was stale: the routine has run on Opus as the deep-work session since 12 Oct and took the card that day (Session 36, PR #37). CLAUDE.md's Model split and team list say so, and the 9 Oct "wait for the credit reset" decision is marked superseded. The "fable" names on cards, branches and the backlog mark stay, because the producer and the routine match on them.
- `docs/style-guide.md` is one page: rules, palette, camera, lighting, UI, the three reference models and a "Where the art comes from" table. The per-sheet notes and the ChatGPT prompts moved to `docs/art/concept/README.md`. Rule 1 now allows a small colour-swatch texture, since every KayKit pack uses one.
- Michael's calls (`decisions.md`): on the Session 39 spike, KayKit Adventurers for the characters instead of a commission; from a comparison of packs (https://claude.ai/artifact/QqeTEhWyfe9tcpeQFpPyjH), the KayKit Dungeon Pack, a scaled-up KayKit Hexagon tavern tested from the game camera before the village is settled (the Quaternius Medieval Village MegaKit as the fallback), and the spike's goblin kept.
- The free tiers of KayKit Adventurers, Character Animations, Dungeon Pack and Medieval Hexagon are in `client/public/models/kaykit/`: glTF and GLB only, 18 MB, 525 files, each pack's CC0 licence beside it and a README listing what is there. Hexagon is only the eight green buildings the test needs.
- The art direction backlog item is closed; two builder items replace it: the Knight as the player figure, then the dungeon kit on the Warrens plus the tavern test shots.

**Learned**

- The free Adventurers tier has only idle and basic movement clips; the swing, block and dodge clips come from the Character Animations pack, on the same Rig_Medium.
- The Dungeon Pack has torches (`torch`, `torch_lit`, `torch_mounted`), which the pack page did not say.
- KayKit has no goblin, and its character textures are one shared atlas, so the party colour cannot tint a tunic; it stays on the outline and name tag.
- itch.io's free download links expire 60 s after they are issued.

**Next**

- The producer cards this branch: it is no longer docs only (the models are under `client/`), so it needs Michael's approval before it merges, and the builder sees the two new items only once it is on main.
- The builder takes the Knight item, then the dungeon kit and the tavern test; Michael looks at `docs/art/spike/hexagon-tavern-*.png` and picks the village kit.

## 2026-10-14: Session 40, combo.e2e no longer loses the fight standing in the goblin

**What changed**

- `tests/combo.e2e.ts` failed about 1 run in 10 here (3 in 7 on the critic's runs of the branch, 2026-10-14), always at its 30 s limit. A trace of a failing run: the close-in step was timed on the player's speed alone, the goblin closed at its 3.4 m/s too, and the player ended 0.43 m from it, then 0.16 m. That near, "in front" for Cleave's and Execute's cones is a coin toss: one Cleave landed, every Execute after it missed, and the goblin downed the player at 29 s. The camera's swing in behind (Session 38) turns the keys a little between the aim and the press, which makes the overshoot likelier, not the cause.
- The approach step is now timed on both speeds (`PLAYER.speed + ENEMY_KINDS.goblin.speed`), and under 1 m the test backs off to about 1.5 m before it strikes. The stale comment about the camera turning toward the fight now says it swings in behind the travel. No game code changed.
- `combo.e2e` 40/40 in two runs of 20 (7.4 to 9.7 s each; before, 9/10 with the failure at 31 s); the full browser suite 18/18; `npm run check` 208; `npm run test:net` all fifteen steps.

**Learned**

- A player standing inside an enemy happens in play (the drawn goblin sat 0.16 m from the player for 15 s), and at that distance a melee cone misses as often as it hits. For a test that is a steering bug; for a player it would read as "my Execute whiffed point blank". Worth the gate playtest's eye, not a change now.

**Next**

- Phase 1 has no builder item left; the gate playtest and the art spike's keep-or-hire look are Michael's.

## 2026-10-14: Session 39, the art spike: the adventurer and the goblin rebuilt to the references

**What changed**

- `playerFigure` is now the base adventurer from `docs/art/reference-models/adventurer.png`: 1.8 m, a big blocky head (jaw, nose, ears, dark eyes and brows, brown hair with a swept quiff), broad iron shoulder pads, a tunic flaring to a skirt at mid-thigh with a belt, brass buckle and a bandolier front and back, dark sleeves, leather bracers, big gloves, dark trousers and chunky boots with a turned cuff. The party colour tints the tunic only. 38 parts, 564 triangles (budget 1,500).
- `goblinFigure` is now the basic goblin from `goblin.png`: 1.1 m, hunched 0.4 rad with the head lifted out of the hunch, an oversized faceted head, two huge flat ears swept out and up, a drooping nose, glowing torch-orange eyes under angry brows, a leather vest over a pot belly, wrapped wrists, boots, a short iron sword carried point-up and a round oak shield with an iron rim and brass boss on the off arm. 29 parts, 480 triangles (budget 800). Its skin is now Grub green `#A5C83A` (the Warrens accent; the reference is yellow-green), and its windup colour lightens it like the other kinds.
- Both are flat-shaded, one colour per face, with a lighter top baked into vertex colours (0.82 at the feet to 1 at the head), colours from the style guide's neutrals. Geometry is built once per kind and shared by every figure of it; only the tinted material is per figure. The Shieldbearer, Charger and Pack Leader are untouched (they keep `goblinShape`).
- Animation, all in `poseFigure` by moving whole parts: an idle sway (a 3 s breath on the torso and arms, fading out as the walk comes in), the walk (the old stride plus a lean and a shoulder twist against the hips), the swing (the torso twists into it; the goblin's windup lifts the sword overhead, 2.6 rad), and a hit flinch (torso and head rock back). The goblin flinches while its hit flash shows; a player flinches for 220 ms when its drawn hp drops (`render.ts`, draw-only). Nothing allocated per frame.
- `npm run turnaround` (`tests/turnaround.ts`, page `client/turnaround.html`, dev only: the build still has one entry): starts Vite on port 5179, renders each figure on a Bone backdrop under the game's lights from the front, side, back and the game's over-the-shoulder camera (`CAMERA`'s pitch, distance and shoulder, 50 degree field of view), in idle, mid-walk and mid-swing, with the reference crop on the left, and writes six PNGs to `docs/art/spike/` (committed). In a cloud session it needs `PW_CHROMIUM=/opt/pw-browsers/chromium`.
- Tests: `tests/figures.e2e.ts` now checks the triangle budgets (visible meshes, so the held weapon counts); it, `camera`, `hit-feedback` and `village` e2e pass.

**Learned**

- The silhouette carries it: the goblin's ears and the adventurer's head and pads read at once in the turnarounds, and at the in-game distance (a figure about a fifth of the screen tall) the detail below that (buckle, brows, wraps) barely registers. Budget spent on shape beats budget spent on trim.
- What a box-built figure cannot match is the reference's softness: rounded cheeks, the hair's tufts and the cloth folds. That is the line between "good enough to keep" and "hire".

**Next**

- Michael's one look at `docs/art/spike/*.png`: keep (an Artist agent joins and the other kinds follow) or hire (the freelancer commission goes ahead). The spike does not touch the other kinds, `shared/` or the server.
- Phase 1 has no builder item left after this; the gate playtest is Michael's.

## 2026-10-14: Session 38, the camera goes over the shoulder

**What changed**

- The camera sits low and close behind the player (Michael, 2026-10-13, "like RuneScape: Dragonwilds"), replacing Session 29's 35 degrees at 12 m. `CAMERA` in `sim.ts` holds every number: 14 degrees of pitch at 5.5 m, the look target at head height (1.6 m) and 0.55 m to the camera's right, so the player stands left of centre with the way ahead clear.
- The player turns it. Left and Right arrows yaw it at 150 degrees a second, Up and Down tilt it at 75 a second between 5 and 45 degrees (Up raises the eye to look down more, as RuneScape's arrows do), and the right stick does both past a 0.2 deadzone (`Input.look`, `turnCamera`). The arrows no longer move the player: WASD and the left stick are the only movement, still camera-relative through `cameraRelativeMove`. The camera turn never goes in an `InputFrame`, so the server and the replay are unchanged.
- The auto-turn toward the fight is gone (`fightYaw` deleted). In its place, after 1.2 s with no camera input, the camera swings in behind the player's drawn travel (`swingTarget`), at most 45 degrees a second past an 8 degree deadband, and only when the travel is faster than 1.5 m/s and within 75 degrees of the view: the move keys are camera-relative, so swinging behind a strafe or a backpedal would wheel the player round in a circle. While the bow's lock is held the camera keeps the locked enemy within 15 degrees of straight ahead instead (`lockYaw`, `LOCK_TUNING`). Reduced motion turns both off; the player's own turning stays.
- Walls pull the eye in. `clearDistance` casts the head-to-eye segment through every wall as a box from the ground to its height, and every village roof as a slab, and stops the eye 0.3 m short of the first one, never closer than 0.9 m; it comes in at once and eases back out over 350 ms (`easeDistance`) so walking past a pillar does not pump the view. The shoulder offset shrinks with it, so the eye is never in a wall. The pillar fade stays for what the shoulder offset leaves across the body.
- Floor telegraphs got bright rims (a 0.14 m band at the windup wedge's far edge, strips down both sides of the Charger's lane): at 14 degrees the fills flatten to slivers, the rims still read. Teammates' name tags already draw through walls (`depthTest: false`), so a teammate behind a wall stays findable; the local player's own tag is now hidden, since at this distance it hung in the middle of the view.
- HUD hint: "WASD move, arrows camera" and "Gamepad: sticks". README controls updated.
- Tests. `shared/src/camera.test.ts` rewritten (10): the pitch and distance sit in the item's ranges and the look target at head height; Left turns the view left, Up raises the eye, the tilt clamps at 5 and 45; the swing goes behind forward travel and holds for standing, strafing and backing up; it never snaps and rests at the deadband's edge; the lock framing; the pull-in short of a 3 m wall, not for a 1.1 m one the ray climbs over, the minimum when pressed against a wall, a roof overhead; in at once and eased out; the pillar fade. `npm run check` 208. `tests/camera.e2e.ts` rewritten (3): the arrows turn and tilt the camera and leave the player within 0.2 m, then S walks toward the eye at the turned yaw; W+D swings the camera; with reduced motion W+D leaves it at 0 and Right still turns it. e2e 18/18 twice; `combo` missed once in one earlier full-suite run and passed in the five runs since. `npm run test:net` all fifteen steps (nothing in `server/` or `net.ts` changed).

**Learned**

- With camera-relative movement, "swing behind the travel" and "the player strafes" fight each other: any swing during a strafe rotates the strafe with it. A window on the travel's angle to the view is the cheap answer; whether 75 degrees is right is for a playtest.
- At 14 degrees the low walls (1.1 m) almost never block the head ray, the pillars (1.8 m) and the village's walls do; the pull-in mostly happens in the village and against the Warrens' pillars.

**Next**

- The optional mouse look (drag or pointer lock) the item allows is not built; it is never required (CLAUDE.md rule 4) and waits for someone to ask. The swing's window, speed and delay, and the arrows' rates, are first guesses for the gate playtest to judge.
- Phase 1 has no builder item left; the gate playtest is Michael's.

## 2026-10-13: local session, art direction style guide draft

**What changed**

- New `docs/style-guide.md`, the draft of the one-page style guide the backlog's (Michael) art direction item asks for. Part 1: style rules, camera, palette swatches (shared neutrals, the four regions, the dungeon accents, the six states, party outlines), lighting, UI direction, a do / do not table. Part 2: a master style block and five concept-sheet prompts for ChatGPT (world and regions; characters and gear; enemies and combat readability; village and the run; HUD and menus), plus one-line fixes for when an image drifts. Michael read it and approved it as it stands.
- Michael generated the five sheets in ChatGPT; they are in `docs/art/concept/` (WebP, about 450 KB each), and the style guide has a Reference sheets section that links each one with what to use, what to ignore and what is missing.
- A sixth sheet (`06-run-choices.webp`) from a prompt written for the gaps: rest room, go deeper, wipe, combo, downed and revive, the Guide, a corner HUD with three slots, the design's control table, Market Hall trade, the phone layout. It drew all ten and kept the design's bindings.
- Michael's camera direction (decisions.md, 2026-10-13): over the shoulder, like RuneScape: Dragonwilds, not a raised camera that reads as top-down. The design doc's Combat camera paragraph and control table, the style guide's camera rules and prompts, and a new Phase 1 backlog item for the builder carry it. Arrow keys move from walking to turning the camera, so WASD is the only keyboard move.

**Learned**

- The Old Gates concept sheets are painterly and near-realistic; Hearthgate's design doc asks for flat-shaded low-poly. An image model drifts toward painterly unless told otherwise in every prompt, so the guide says so up front and the fixes list leads with it.
- With the style stated that firmly, the look landed on the first try; the content is what drifted. Every sheet invents features the design does not have (classes, a Farm, jumping, a world map and quest log, a centre ability bar, level ranges instead of tiers) and leaves out the rest room choice. Generated sheets are style references only; the notes list each conflict so no one builds from a picture.

**Next**

- The builder takes the over-the-shoulder camera item, then the art spike (decisions.md, 2026-10-13: an agent rebuilds the adventurer and the goblin to match `docs/art/reference-models/` and renders turnarounds beside them for Michael to judge, before any freelancer is hired).
- Michael picked the three reference models (the base adventurer, the basic goblin, the regional building; `decisions.md`). Next for him: the character commission and the asset-pack purchase. A sixth sheet could cover what the five missed: the rest room choice, combo, downed and revive, the Guide, the trade window, a corner HUD with three slots.

## 2026-10-13: Session 37, a refused dodge eases back instead of popping

**What changed**

- `reconcile` (`client/src/net.ts`) tells a refused dodge from a teleport. It keeps the predicted `dodgeCooldownUntil` before it rewinds; a dodge start always sets the cooldown, so a different one after the replay means the server refused or moved a dodge we predicted. Such a correction eases into the visual offset up to `DODGE_SNAP_DISTANCE`, the snap limit plus the dodge's own length (2.5 + 16 m/s x 220 ms = 6.02 m, taken from `PLAYER` so it follows the dodge's tuning), instead of snapping at `SNAP_DISTANCE`. Any other error over 2.5 m still snaps; respawns and hand-offs are placements as before. It still counts as a correction.
- Server and sim unchanged: the server still refuses the dodge and lands the blow, as it should. Only how the client draws the undo changed.
- CLAUDE.md's netcode section names the exception.
- Tests. `tests/reconcile-placement.ts` (part of `npm run test:net`) grew case 5: through the real `Net`, a dodge east predicted over six frames (4.30 m), then a patch where the server applied the dodge frame staggered by a blow (hp down 20, no dodge) and the replay holds us off balance. It eases (0 snaps, 1 correction, a 4.30 m offset to decay); the same 4.30 m error with no dodge in it still snaps. Without the fix the case fails ("a refused 4.30 m dodge snapped instead of easing"). `npm run check` 205; `npm run test:net` all fifteen steps.
- Lag lab, this branch, 60 s a condition on the field: corrections a minute 0 / 1 / 1 / 7 at 0 / 50 / 150 ms / the lossy row, 0 snaps throughout (the critic on main: 0 / 1 / 2 / 2, 0 snaps). The throttled acceptance run (`--only "150 ms" --cpu-throttle 4`, Alpha at 20 to 28 fps), eight runs: corrections a minute 1, 2, 4, 2, 1, 4, 1, 0, walked 181 to 295 m a minute, 0 snaps in all eight. The critic had 4 snaps in 14 runs on main, all with Alpha hurt mid-fight, where the lab's driver dodges while it attacks.

**Learned**

- The dodge was the only predicted move longer than the snap limit, so the limit was really "a dodge is never refused". The cooldown is a free witness: it is set only by a dodge start, so the client needs no new state to know a dodge is what it got wrong.
- A 3.5 m ease over the 90 ms decay is a fast glide back, not a pop; it reads as being caught, which is what happened on the server.

**Next**

- Part 2 of the critic's item, judging a dodge against the swing the player saw (lag compensation of the defender), is not done and not raised: the critic advises holding it until a human says dodges feel late, and the gate playtest's third question will say. The Charger's throw learned a round trip late could in theory exceed 2.5 m too (critic, unconfirmed, not filed). Reconnect is the Phase 1 netcode item left.

## 2026-10-12: Session 36, inputs land in their own slots and come by wall time

**What changed**

- The server applies each input at its slot, not at the tick it arrived in (`shared/src/inputs.ts`, `applyDueInputs`, tuned by `INPUT_TIMING` in `sim.ts`). A player has an input clock, `inputAt` (in `PlayerSim` and the schema): the time their last frame was applied. The next frame belongs one tick after it, never later than the tick (nobody acts in the future, which is also the speed limit), at most two a tick. So a frame that arrived a tick late is applied a tick in the past, where the client predicted it, and two frames that arrive together get two times instead of one. A quiet tick does nothing within 200 ms (`maxLagMs`); past that the player gets a neutral frame at the window's edge (guard kept, so a knock still slides) and the next frame is placed at the tick, the one case the client is corrected for. A frame that waits for its slot is pure latency, so when ticks ending with a frame waiting outnumber those without by 20 (`drainAfterTicks`), the slots move a tick earlier.
- The client replays its pending frames one tick apart from the patch's `inputAt` instead of the patch's tick, so its replay and the server agree on when a dodge, a swing or a cooldown ends. `predictedTime` is now `inputAt` plus a tick per unconfirmed frame.
- The client makes one frame per tick of wall time (`InputClock`, `dueInputTicks`), from a timer scheduled to the next due tick like the server's pump: a timer that runs late sends a frame for every tick it missed, up to four (`clientCatchupTicks`), and drops the rest, so a sleeping tab does not dump stale movement. A held key covers the same ground at 10 fps as at 60.
- A key pressed and released between two samples counts as held for one frame (`input.ts`): on a busy page a short tap of a direction or of block used to vanish, the same frame-rate dependence as a dropped tick.
- Three e2e tests were tuned, without knowing it, to the slow walk the frame-rate bug gave a starved headless page. `combo` walked at the goblin with fixed W+D holds; at full speed it overshot and faced away, so Execute's cone missed. It now aims with the camera's yaw and sizes its steps by distance. `village` stopped within the keeper's talk range on the portal (2.5 m radius, 3.2 m from the keeper) and got handed off mid-walk; it now comes at the keeper from the east, taps the last 2.5 m and checks the portal label while it walks. `camera` held A for 1.2 s and walked 7 m, far enough for the chasing goblin to be in front again; it now takes short steps until the camera turns.
- CLAUDE.md's netcode section describes the slots, the input clock and the replay.
- Tests. `shared/src/inputs.test.ts` (11): a 1.5 s hold covers 9 m within one 10 fps frame at 60, 21 and 10 fps (one frame a callback walked 4.5 m at 10 fps); the catch-up cap; a late frame lands in its slot; nothing applies ahead of the tick; two a tick; the stall rule; the silent-player neutral frame with the guard held; the drain, and no drain for a bunch that comes and goes; determinism. And a client and server over a link that bunches frames (60 ms one way, 0 to 70 ms late, order kept), with dodges, swings and guards: the old timing corrected 30 times in 200 frames, the slots 0. 205 in all.
- `npm run test:net`: all fifteen steps.
- e2e: `two-players`, failing since Session 4, passes. The suite went 17/17, 16/17 and 17/17 in three runs; the miss was `two-players` on a page that got one timer callback in its 700 ms hold (four frames, 1.2 m). On main it fails every run.
- Lag lab, 60 s a condition, main then this branch, corrections a minute: 0 ms 9 and 16 → 0; 50 ms 18 and 15 → 0; 150 ms 31 and 52 → 1; 50 ms ±20 with 2% loss 41 and 21 → 3. Snaps 0 throughout, before and after. View lag 100–110 ms on a clean link before and 115 after; 50 ms 210–240 → 200; 150 ms 395–425 → 405. With `--cpu-throttle 4` (Alpha at about 25 fps) on the 150 ms link: corrections 35 → 1 a minute, walked 174 → 209 m a minute.
- `npm run test:clock` is noisy on main too: its 150 ms pop limit (0.075 m) failed in 2 of the last 4 runs on main (0.225 m) and in about half the runs here (0.1 to 0.25 m). Its held and pop numbers come from late patches and the one-tick projection, not from the inputs. It still needs a look. A guess, not measured: the harness drives Alpha from a `setInterval`, which sends a little under 20 frames a second, and the slots turn that into a frame placed at the tick every few seconds where main gave a neutral frame.

**Learned**

- The corrections on a clean link were never the network: they came from the server and the client giving the same frame different times. Once both count slots from the same `inputAt`, the whole class goes away, not just the dodge cases.
- The first version kept a frame that arrived early until its slot came, which put a standing queue of 0.7 to 1 frames on the driven client (about 40 ms more view lag). A strict "waited every tick for a second" drain never fired, because jitter emptied the queue now and then; counting up and down does.
- A held key that walks the right speed showed up three e2e tests leaning on the bug.

**Next**

- The netcode items left in Phase 1 are reconnect (Fable). The input-path bugs under Found in play are closed. The gate playtest can now judge feel without the clean-link corrections.

## 2026-10-08: Session 35, the event log keeps four lines

**What changed**

- The bottom-right event log holds at most four lines (`EVENT_LOG.maxLines` in `sim.ts`, next to its 2.5 s `showMs`, which moved there from a literal in `main.ts`). A burst drops the oldest line instead of stacking: the critic's case was eight lines in 2.5 s from a Cleave and Execute, which climbed over the ping and corrections panel at 480 x 300 (CLAUDE.md rule 5).
- `pushLogLine` and `expireLogLines` in `shared/src/feedback.ts`, pure, which `main.ts` now calls instead of pushing and shifting by hand.
- Tests. `shared/src/feedback.test.ts` (+2): nine events leave the newest four; a line shows for exactly `showMs`. 194 in all. `tests/mobile.e2e.ts` (+2): four of the longest log lines at 480 x 300 and 568 x 320 sit below the top-right panel and clear of the ability slots. With eight lines the same check fails (log top at 50 px against the panel's bottom at 89 px at 480 x 300), so it catches the bug; with four the log's top is at 130 px, two lines of room to spare. mobile e2e 6 of 6.

**Learned**

- No CSS change was needed: a line is about 20 px, and the gap between the slots and the top-right panel on the smallest landscape phone fits six. A cap in lines is simpler than a max-height and never cuts a line in half.

**Next**

- Phase 1's builder list is empty again: the gate playtest, the art-direction item, and the Fable items (reconnect, the two input-path bugs, whose card is the producer's open question).

## 2026-10-06: Session 34, Execute and the combo callout

**What changed**

- Execute is the melee weapons' slot 2 (key 2, gamepad B), Michael's A on "No combo can fire in play yet". `ABILITIES.execute` in `sim.ts`: 300 ms windup, 650 ms committed, 2.4 m, the sword's 108 degree cone, 18 damage, 5 s cooldown. It takes the nearest Staggered enemy in its cone, else the nearest, with the tags `melee` and `execute`, so `resolveHit` consumes Staggered for the crit (x2) times the combo multiplier: 36 alone, 54 when someone else did the staggering (x1.5 for two players). On an enemy that is not staggered it is an 18 hit that drains posture like Cleave. A goblin (60) is felled by a teammate's Cleave (14) then Execute (54).
- The crit's knockdown is carried out now (`knockDown`): recovery for `COMBO.knockdownMs` (1.2 s), guard down, posture broken for the time, any charge stopped.
- The server no longer drops the payoffs: every hit that consumes a state adds a `combo` event (attacker, enemy, payoff, contributors, multiplier), broadcast with the tick's other events. Marked, which consumes nothing, is not a callout.
- `contributors` ignores the empty applier: a Charger stunned on a wall is Staggered by the level, which set up a crit but is not a second player (it would have read x1.5 alone).
- Client: the callout over the enemy, "Combo x1.5" (or "Critical" alone), gold with a dark outline, rising 0.7 m and fading over a second, from three sprites built once in `render.ts`; a rising chime in `sound.ts`, one note per player (two to four); a log line ("Combo x1.5 from 2 players: the goblin knocked down"); the slot reads "Execute".
- Tests. `shared/src/execute.test.ts` (8): slot 2 commits and cools down; a plain hit with no combo; a solo crit with the knockdown; the two-player x1.5 that kills the goblin; Execute lands inside Staggered's 2.5 s after a teammate's Cleave; it prefers the staggered enemy over a nearer one; a wall stun counts no extra player; a plain swing makes no combo event. 192 in all. `npm run test:net` grew a step: in a cellar Mira cleaves, Nell executes, and both clients get the combo event, x1.5 from 2 players for 54, 2.2 s after setting off. `tests/combo.e2e.ts`: a real browser walks at the cellar's goblin, presses 1 then 2, and sees the callout ("Critical"), the log line and the slot's name, no page errors. camera, figures, join, mobile, village and combo e2e 13 of 13.

**Learned**

- Every piece of the combo was built except the last metre: the states, the multiplier and the contributor count were in `states.ts` since Session 8, but nothing consumed Staggered and the server threw the result away. The gate's "visible" was a missing event and a sprite, not a system.

**Next**

- Phase 1's builder list is empty: what is left is the gate playtest (a mixed-level party clears the Warrens and sees "Combo x1.5"), the art-direction item, and the Fable items (reconnect, the two input-path bugs). Whether Execute's numbers and the callout's size feel right is the playtest's call.

## 2026-10-06: Session 33, the enemy bar stops promising a return on a floor

**What changed**

- The enemy bar's text once nothing lives comes from `clearedBarText(level)` (`shared/src/feedback.ts`): "returning soon" on a level without stairs (the field and the yard, which reset after `ROOM.resetMs`), "floor clear" on one with stairs (the Warrens, the cellar), where nothing returns until the party leaves. The label above it still reads "Stairs open: everyone onto them". Fixes the critic's 2026-10-06 find.
- Test: one unit test over the four combat levels (184 in all).

**Learned**

- The HUD had one level-blind string left from the field's reset loop; the stairs' arrival made it false. Any text that describes what the level does next belongs with the level, not the HUD.

**Next**

- Execute in melee slot 2 and the combo callout (Michael's A).

## 2026-10-06: Session 32, the client walks the village and follows the hand-off

**What changed**

- The client joins the village first: `Net.connect` picks the `village` room when no level is asked for (or the village's id) and a `dungeon` room on that floor otherwise, so the tests and the lab (`?level=field`, `yard`, `warrens`) go where they always did. A `handoff` message from the server (`Net.handoff`) leaves the room, drops everything that was its (the clock, since each room counts ticks from its own zero; the pending inputs, the remotes, the enemies, the placement, the pings) and consumes the seat; the new room's first patch places us as a join does, so the move is neither a correction nor a snap (`tests/village.e2e.ts` checks `snaps` stays 0). A status line ("Through the portal: The Goblin Warrens", "Up the stairs: back to the village") shows until that patch; the event log and any villager's line are cleared with it.
- The town's look, built once per level in `render.ts`: the ground, grid and edge wall now take the level's bounds (the village is 48 m square, the sun's shadow box follows); a wall is drawn at its own `h` when the level gives one, so the buildings stand 3.2 m with a doorway, a flat roof a little proud of the walls and a sign over the door; each villager is the player figure in a plain coat with a name tag; the portal is a blue dais in a ring of stones that glows a little always and brightens as the party's hold fills (`setPortal`), beside the stairs' dais.
- The villager prompt: when a villager is within `NPC.talkRange` of where we are drawn, the top-left panel shows a real button, "E or LB: talk to Keeper Wren", at least 48 px high, that a tap or a click presses as E does (`Input.pressUse`), so the touch layout can keep it as it is. The server's `npcTalk` for us puts the line under it for 8 s ("Keeper Wren: The shrine's portal opens on..."); a friend's talk is a log line. In the village the enemy bar is hidden and its label says where you are, or the portal's hold as it fills. The enemy label is capped at the bar's width so a long one wraps instead of pushing the panel into the top-right one (the mobile test caught it on a 412 px portrait phone).
- Tests. `tests/village.e2e.ts`, a real browser: joins the village (level and room "village", no enemies), walks round the dais to the keeper, sees the prompt (48 px) and the keeper's line on E, stands on the portal, is moved to a Warrens room with nine enemies and one hand-off, no snap, the status line gone, and a step still moves it on the new server clock, with no page errors (25 s). The rest of the suite: `camera`, `figures`, `join`, `mobile` 11 of 11 with it; `two-players` fails on the committed tree as it has since Session 4 (0.3 m in 700 ms headless, the frame-rate item in Found in play) and `hit-feedback` as Session 29 found. `npm run check` 183, `npm run test:net` all fourteen steps.
- The lag lab (`npm run lab`, 60 s a condition, on the field as the critic pins it, so a dungeon room and none of this session's code in the path): corrections a minute 12 / 36 / 59 / 20 and holds 15 / 2 / 20 / 21 at 0 / 50 / 150 ms / the loss row, 0 snaps but one at 150 ms. Against the critic's 13 / 20 / 16 / 52 and 7 / 8 / 4 / 43 on 2026-10-05 that read worse, so the 150 ms condition was run again on main and on this branch back to back on the same box: main 45 corrections and 12 holds, the branch 52 and 5, no snap on either. That is this sandbox's spread (the critic saw 11 to 24 on one build and Session 25 saw 51 on main at 150 ms here, both at about 30 fps under software WebGL), and the corrections are the tick-timing item the critic filed, not the rooms: the dungeon's step is the same code moved into `SimRoom`. The single snap did not come back in either re-run.
- CLAUDE.md's netcode section describes the two room types and the hand-off; the backlog item is checked.

**Learned**

- The hand-off's cost on the client is the clock: it starts over, and the first second in the new room runs on the fast pings (twelve at 250 ms) before the window fills, as a join does. Nothing else about the netcode knew which room it was in, which is what the `SimRoom` split was for.
- A slow walk across the dais is a hold: the first e2e run was handed to the Warrens on its way to the keeper, because the headless page walks at about a metre a second and the portal takes two seconds of everyone standing on it. At 6 m/s a player crosses the 5 m dais in under a second, so in play it needs a stop; the test goes round it. Whether the portal should ask for a press rather than a stand is a feel question for the playtest, noted below.

**Next**

- The greybox is Michael's to walk: the layout (the shrine straight ahead, the tavern behind and to the left so the camera is not inside it from the square), the hold on the portal against a press, whether villagers should face you when you talk, and what the stairs' return should feel like. Then the Phase 1 gate playtest, the combo item (builder), and the Fable items left: reconnect with a grace period, the two input-path bugs the critic filed.

## 2026-10-06: Session 31, the village room and the hand-off between rooms

**What changed**

- The server has two room types, as the design doc's Rooms paragraph says: a `village` room the client joins first and a `dungeon` room a run. Both are a `SimRoom` (`server/src/rooms/SimRoom.ts`): one `Level`, the 20 Hz tick locked to wall time, two queued inputs a player a tick, the patch at the end of each step, the clock pings. `DungeonRoom` and `VillageRoom` only name their level and act on the tick's events, so nothing in the netcode's shape moved.
- The village is a `Level` (`VILLAGE` in `shared/src/level.ts`): four greybox buildings (Portal Shrine north, General Store west, Storehouse east, Tavern south) whose walls are ordinary `WallRect`s made by `buildingWalls` (four faces at 3.2 m, a 2.4 m doorway in the face the door is on), so a building stops a player exactly as a ruin does and the client's prediction already runs it. A villager (`Npc`) stands by each door with one line; a portal on the ground before the shrine leads to the Warrens. No enemies. `WallRect.h` is a drawing height the collision ignores.
- The hand-off. The party moves as the stairs already did: every standing player on the portal (`PORTAL`, 2.5 m, 2 s) or the open stairs (`STAIRS`, unchanged) for the hold. The sim says so once (`portalTaken`, `stairsTaken`; `Encounter.departed` latches) and the server does the rest in `SimRoom.handOffParty`: it locks the room, makes a fresh dungeon room on the portal's level (or finds an open village, or makes one), reserves a seat per client under their own name, weapon and tier, and sends each a `handoff` message with the reservation and the level id. The client leaves and consumes the seat (`colyseus.js` `consumeSeatReservation`); the old room disposes when empty. A refused reservation clears the latch so the portal or the stairs fire again.
- The stairs no longer restart the floor: `floorDescended` and the floor counter are gone, with the enemy reset and the draught refill that rode on them (a fresh run is a fresh dungeon room). `use` (E, LB) is one key: a dead teammate in reach takes the draught, else a villager in reach talks (`talkToNpc`, 2.5 m) and the server broadcasts `npcTalk`; the line itself is level data, never sent.
- `CELLAR`: the smallest floor, one goblin and the stairs, for the tests. `LEVELS` now holds five.
- Tests. `shared/src/village.test.ts` (10, 183 in all): a building's five walls and its doorway on each face, a player through the door and stopped beside it; the village's spawns, villagers and portal clear of its walls and the spawns off the portal; every door reachable from the square and every back wall closed; talk in reach and not out of it or downed; the portal fires once when everyone holds it, resets when one steps off, ignores the dead, and works again after the server clears the latch. The Warrens stairs tests say "taken, once" instead of "restart the floor". `npm run test:net` grew two steps: two bots in a village room (no enemies, four villagers), one talks to the keeper in 1.5 s, both hold the portal and are handed seats in one fresh Warrens room 3.3 s after setting off, there together with the bow Juno picked; then in a cellar Kit kills the goblin in 2.7 s, both hold the open stairs and are handed to a village together, 2.9 s. The server log shows each left room disposing. The old eight steps and the stress run (20.0 patches a second, 54 ms worst gap) are unchanged.
- Client: only what the typecheck needed (the floor counter and its log line); the join, the hand-off, the town's look and the villager prompt are the next session.

**Learned**

- Colyseus's matchmaker does the hand-off's hard part on the server: `createRoom` plus `joinById` per client gives every member a seat in the same new room before any of them moves, and a locked room is skipped by `joinOrCreate`, so a party on its way out cannot be joined. The clients never see a room id they did not get from the server.
- One hold rule for both moves keeps the sim to one new function (`holdOn`) and means the portal needs nothing the stairs did not already have on keyboard, gamepad and a later touch layout.

**Next**

- Session 32: the client joins the village by default and follows a `handoff` (tear down the level, the remotes and the clock, consume the seat, build the new level), draws the buildings with roofs and signs, the villagers and the portal, shows the 48 px talk button and the line, and the e2e test walks a real browser through the portal. Then CLAUDE.md's netcode section, the lab numbers and the backlog.

## 2026-10-05: Session 30, placeholder figures instead of pills

**What changed**

- Every player and enemy is a low-poly figure of flat-shaded parts instead of a capsule or a cone, built once per entity in `client/src/figures.ts`, one function per kind behind `enemyFigure(kind)` and `playerFigure(colour)`, each returning a `Figure` (root, hip and shoulder pivots, the right hand, the flashing material, the height) so a commissioned model can replace a kind without touching `render.ts`.
- Players: broad-shouldered wedge torso in the party colour, a head with a dark brow band on the front (the facing; the old nose block is gone), dark legs, arms. The held weapon now hangs from the right hand, a little oversized per the design doc's Art section, so a swing lifts it with the arm.
- Goblins small and hunched (1.0 m, leaning 0.45 rad) with big ears, glowing eyes and a stubby club. The Shieldbearer the same family at 1.35x, more upright, with a helmet, behind its existing plank shield. The Pack Leader 1.45x and nearly upright with a red crest of spikes under its existing banner: the tallest outline in the room. The Charger a four-legged beast, long and low (wider than it is tall), with a hump, a low head and tusks.
- Animation without a skeleton: `stepFigureWalk` advances a stride from how far the drawn pose moved (a full cycle per 1.3 m; a jump over 1.5 m is a placement, not a stride) and eases the swing in and out over about 100 ms; `poseFigure` swings legs and arms opposite, bobs the root, and raises the weapon arm for a swing. An enemy's windup rears it back with the arm raised (the Charger only rears), replacing the old rising cone. Dodge, stagger, downed and dead lean or lay the whole figure as they did the capsule; hit flash, windup and rally tints are unchanged. Name tags and party colours stay; the HP bar sits above the tallest figures.
- Tests: `tests/figures.e2e.ts` reads a new `__hg.figures()`: each of the four kinds and the player has 7+ parts; goblin shorter than the player, Shieldbearer taller than the goblin, Pack Leader taller still, Charger wider than tall; standing stride under 0.05, over 0.5 while S is held, back under 0.05 after. `camera`, `join`, `mobile` e2e green with it (11 of 11, three runs). `npm run check` 173.
- Follow-up to Session 29: `tests/camera.e2e.ts` walks at the goblin until it wakes instead of for a fixed 1.5 s, and steps west before waiting for the turn: 1 run in 6 had stopped short or left the goblin inside the deadband. 16 of 16 after.

**Learned**

- At the new camera the yard's 1.1 m walls read as big blocks; the figures are scaled to them (the player 1.84 m) rather than the other way round, so the levels' numbers did not move.

**Next**

- The combo item once Michael answers. Then Phase 1 holds only Fable work, the art-direction item and the gate playtest.

## 2026-10-05: Session 29, the camera to the design doc's spec

**What changed**

- Merged main (Fable's extrapolation, PR #17, and the local camera/art backlog) into `auto/build`. Three conflicts, all keep-both: `client/src/net.ts` (each remote player keeps its `weapon` from Session 25 and takes main's `PoseTrack`; the old `sampleSnapshots` and `pushSnapshot` go, `syncWeapon` stays), `decisions.md` (the staff and village answers side by side) and the devlog (both Session 25 entries kept).
- The camera sits at 35 degrees and 12 m from the player instead of 55 degrees and 15.8 m, so it reads as third person, not top-down. It turns toward the fight: the centre of the awake enemies and living teammates within 14 m, the player included. The turn ignores the first 20 degrees of error, eases over 1.5 s and never exceeds 40 degrees a second; out of combat, or with the fight centred on the player, it holds still. All of it is pure in `shared/src/camera.ts`, tuned by `CAMERA` in `sim.ts`, and draw-only.
- Movement is camera-relative: `Input.sample(yaw)` turns WASD and the left stick by the camera's yaw before the vector goes in the `InputFrame`, so the server and the replay still see plain world vectors and nothing in the simulation changed. At yaw 0 the frame is exactly what it was.
- Walls between the eye and the player swap to a see-through material (and stop casting shadows) while they are in the way: the sight line to the player's middle is clipped to each wall's footprint and checked against its top where it leaves. At 35 degrees that is the 1.8 m pillars; a 1.1 m wall would have to stand within 0.3 m of the player's centre.
- Reduced motion (`prefers-reduced-motion`) keeps the camera from turning, as the hit nudge already did; the nudge still rides on top of the follow.
- Tests: 7 in `shared/src/camera.test.ts` (173 in all): 35 degrees and closer than before; yaw 0 moves as before; W away from the eye and D to the screen's right at any yaw; the fight pulls the camera, out of range or out of combat holds; the turn is capped per frame, takes the short way across the back and rests inside the deadband; which pillar hides the player at two yaws. `tests/camera.e2e.ts` (2 of 2): in the yard the camera turns once a goblin wakes and S then walks toward the eye within 35 degrees; with reduced motion the yaw stays 0. `join` and `mobile` e2e 7 of 7. `npm run test:net` green on the merged tree.

**Learned**

- `hit-feedback.e2e.ts` fails without this change too (no hit lands in 20 s headless): the same headless slowness as the critic's frame-rate item, not the camera.
- A sight line falls from the eye to the player, so it is lowest where it leaves a wall's footprint, not where it enters; testing the entry point missed a pillar standing right behind the player.

**Next**

- Placeholder figures instead of pills, the next builder item. Then the combo item once Michael answers.

## 2026-10-05: Session 28, Magic deferred; no combo fires in play

**What changed**

- Michael's answer B on "The staff for Magic missile" (control room, 2026-10-05): Magic and Magic missile wait for Phase 2 or later. The Arrow rain item closes with Arrow rain (Session 27), and the weapon classes item closes too: the staff goes with Magic, and the bow's charge timing is left for the gate playtest to judge. The question moves to Answered in `decisions.md`.
- Checked what the gate's "combo bonus is visible" can rest on, and it is nothing yet. `resolveHit` pays off only when a hit's tags consume a state: Staggered (applied by Cleave, parries and posture breaks) is consumed by `execute` or `backstab`, and no hit carries either tag; Marked, Soaked, Burning, Rooted and Chilled are applied by nothing. The server also ignores the returned `effects`, so even a payoff would reach no client. New question under Pending: "No combo can fire in play yet" (A, Execute in the melee slot 2 plus a combo callout over the enemy, recommended), and a **(design)** item in the backlog for it.
- No code changed. `npm run check` (155 tests) and `npm run test:net` green on the merged tree.

**Learned**

- The states system was built ahead of the abilities that feed it (Session 8), and the abilities that landed since (Cleave, Arrow rain) apply or ignore states without consuming any, so the combo half of the gate fell through a gap no single item owned.

**Next**

- Build to Michael's answer on the combo question. Without it, nothing is left in Phase 1 for the builder: the rest is Fable work and the gate playtest.

## 2026-10-05: Session 27, Arrow rain

**What changed**

- The bow's slot 1 (design doc: "Arrow rain: arrows fall on a marked area"; `ABILITIES.arrowRain` in `sim.ts`, `BOW_SLOTS`). Press 1 (gamepad Y) with a bow: a 650 ms draw and flight, committed for 700 ms, then a volley lands on every living enemy within 3 m of the spot for 16 each, tagged ranged and area for the combos; 8 s cooldown. It comes from above, so a Shieldbearer's raised shield does not cut it, and it breaks no windup (Cleave's job).
- Where it falls (`rainSpot`, server only, chosen when it lands so it falls where the target is now): the bow's lock if it is within 12 m and in sight, else the enemy a bow shot would take, else 7 m ahead inside the level. Session 26's lock is the "mark".
- `SimEvent` gains `arrowRain` (the spot and how many it hit), sent even when it hits nobody; the client flashes a gold disc of the volley's size there for 400 ms (four discs built once in the View, the oldest reused). The log says "Your arrows hit the goblin for 16", or "Your arrows found nothing". The slot reads "Arrow rain".
- Magic missile waits: the staff does not exist in The Old Gates. Question under Pending in `decisions.md` ("The staff for Magic missile"; A, add a Staff with Magic missile, recommended).
- Tests: 4 more in `shared/src/weapons.test.ts` (155 in all): on the lock, three of a pack under it and the fourth outside untouched, once each and not again; the auto target and the miss ahead; full damage on a raised shield; a lock behind a wall is not the spot. An earlier test now checks that an archer's empty slot 2 spends nothing. `npm run test:net`: the lock-on room now casts Arrow rain on the locked goblin and sees it land for 16. `tests/join.e2e.ts` 4 of 4 and `tests/mobile.e2e.ts` 4 of 4, twice; the archer's walk now holds the keys until the goblin is in range, since a fixed 1.5 s walk fell 4.6 m short in one run (the frame-rate bug).

**Learned**

- Choosing the spot when the volley lands, not when it is loosed, keeps it out of prediction entirely: the cast (cooldown, commitment) is predicted from the player alone, and only the server, which knows where every enemy is, picks the spot.
- The client's disc shows where it landed, after the fact. A telegraph before landing would matter if enemies could see it; for now the bow's target ring is the aim.

**Next**

- Magic missile and the staff after Michael's answer.
- The Phase 1 builder list is otherwise done: the gate needs a playtest of a mixed-level party clearing the Warrens, and the combo bonus has nothing on screen beyond the log (Session 22's note), which may be worth a backlog item before that playtest.

## 2026-10-05: Session 26, the bow's lock-on cycle

**What changed**

- The design doc's Targeting line ("ranged weapons use a lock-on cycle rather than free aim"): with a bow, Tab or R (gamepad RT) locks on. The candidates are the living enemies within the bow's 12 m with a clear line, in any direction, nearest first; each press moves the lock to the next, and past the last it goes back to soft auto-targeting, so the same key lets go. Any other weapon clears the lock.
- The server decides it, as the draught is decided: `InputFrame.cycle` (a press; `isValidInput` checks it), and `cycleLock` runs in `DungeonRoom.step` after everyone has moved, from where the archer stands. `PlayerSim.lockId` is in the schema (`lockId`); the client copies it on reconcile and never predicts it, since `applyInput` does not touch it (a unit test proves a cycle frame predicts exactly like one without).
- A locked shot goes to the lock wherever the archer faces, while it is in range and in sight; with a wall between them the shot falls back to the cone and the lock holds. `dropStaleLocks` (once a tick in `stepEncounter`) lets go when the enemy dies, gets past 1.25x the bow's range (`LOCK_ON.keepRangeMult` in `sim.ts`), or the archer is down or dead.
- Client: one ring built once in the View, on the ground under the bow's target: solid gold under a lock, faint under the enemy the cone would pick now (presentation only, from the interpolated poses). The enemy panel follows the lock ("Goblin (locked), 1 of 1 left"). The controls hint lists Tab.
- Tests: 6 in `shared/src/weapons.test.ts` (151 in all): the cycle order through range, sight and direction and back to auto, only a bow locks, a locked shot behind the archer, a lock out of sight falling back without letting go, letting go on death and distance, the input check and prediction parity. `npm run test:net` adds a lock-on room: nothing in range at 17 m, the field goblin locked at 8.3 m after walking toward it, back to auto on the next press. `tests/join.e2e.ts` adds an archer who walks in and presses Tab: the lock reaches `__hg` and the HUD says "(locked)". join 4 of 4 twice, mobile 4 of 4.

**Learned**

- A key that cycles is a toggle in disguise: the first version of the e2e pressed Tab every 300 ms until it read a lock, and a press still in flight let go again. Anything scripted against the cycle should press once and wait for the patch.
- The goblin's aggro (14 m) is longer than the bow's reach (12 m), so a goblin always closes on an archer it has seen; the Shieldbearer (10 m) and the Charger's lane are where the bow's range will matter.

**Next**

- Arrow rain in the bow's slot 1 (Ranged), with a ground marker on the lock. The staff (Magic) and Magic missile need defining, since The Old Gates has no staff; they may want a design question first.

## 2026-10-05: Session 25, pick a weapon before joining

**What changed**

- Michael's answer A (2026-10-05) to "How a player picks a weapon": a join screen before the room (`client/src/join.ts`). Two rows of buttons, the eleven weapon types and the ten materials, and Join. Arrows or WASD move, Enter or Space joins; a gamepad's d-pad or stick moves and A joins (polled per frame, acting on the press, and a button already down when the screen opens is ignored); every choice is a real button of at least 48 px, so a tap works too, and nothing needs hover. A line under the rows says what the pick does and what it is worth here: "Iron Claymore, two-handed: slower, hits up to 3 in front; Cleave on 1. 51 a hit in a tier-1 portal, held to Bronze (a tier-1 portal allows up to tier 2).". The last pick is remembered in the browser (wrapped in try/catch; a private window starts from the sword).
- A scripted join skips the screen: a URL with `?name=` or `?weapon=` connects straight away, which keeps the e2e tests and the critic's lab unchanged; `?weapon=claymore&tier=5` picks for it (Michael's note on A).
- The server trusts only a type name and a number: `weaponFromPick` in `gear.ts` turns an unknown type (or `toString`, or an object) into the starter sword and clamps the tier to 1..10. `DungeonRoom.onJoin` sets the player's weapon from it; `PlayerState` gains `weaponType` and `weaponTier`, so every client sees what everyone holds.
- Prediction: the client starts with its pick and takes the server's checked weapon on every reconcile, before the replay, so a Claymore's 300 ms windup is predicted with a Claymore. Remote players carry theirs for drawing.
- Abilities by style (`slotsFor`): melee weapons (one- and two-handed) carry Cleave in slot 1, the bow's slots are empty until Arrow rain. `abilityInSlot` now takes the weapon; before this an archer would have cleaved.
- Client: one held mesh per class (a blade, a long blade, a bow) and one swing arc per class sized to its range and cone, built once per player and toggled; the held mesh takes the material's colour and its glow from Mithril up, changed only when the weapon changes. The swing flash follows the class's timings instead of the Phase 0 sword's. The HUD's top-left panel shows the weapon under the name.
- Tests: 4 in `shared/src/weapons.test.ts` (145 in all): the pick, the fallbacks and clamps, slots by style, and an archer pressing 1 spending nothing on either side. `npm run test:net` adds a weapon-pick room: a tier-5 Claymore reaches both clients and swings two-handed on the server, a "laser" at tier 99 becomes a tier-1 sword. `tests/join.e2e.ts` (3, all green): keyboard alone picks an Iron Claymore and joins with it; at 360 x 640 every choice is 48 px or more with no sideways scroll, and a tap on Bow then Join works; a scripted join skips the screen. `tests/mobile.e2e.ts` 4 of 4.

**Learned**

- `tests/hit-feedback.e2e.ts` is flaky on this box with or without this session's change (1 of 3 on the merged tree before it, 1 of 2 after): the player walks 1.5 s toward the yard's first goblin and sometimes never trades a hit within 20 s. Likely the frame-rate movement bug (Fable, in Found in play) or the Session 24 chase routes; not chased here.
- Putting the weapon on the name line pushed the top-left panel into the top-right one at 360 px (the mobile e2e caught it); it has its own line now.

**Next**

- The bow's lock-on marker and a key and button to cycle targets, then Arrow rain in the bow's slot 1. The staff (Magic) and Magic missile need defining: The Old Gates has no staff.
- The gate's "mixed-level party" is now possible: two players can join with different tiers.

## 2026-10-05: Session 24, enemies use the doors

(Numbered 24 because the Fable branch, PR #9, already carries a Session 23.)

**What changed**

- The critic's bug (2026-10-05): an awake enemy whose target left its room pressed straight at them into the wall and slid to a corner, where it stayed; a Shieldbearer sat at (-1, 8.9) inside the guard room while its target stood in the hall at (2, 3).
- `Level.waypoints` in `shared/src/level.ts`: points either side of each doorway, 1.8 m out from the wall so the way to them clears the jambs. The Warrens has six (guard room to hall, pens to hall, guard room to den). The field and the yard have none and behave as before.
- `pathClear` (a body of a given radius fits from a to b: the centre line and both edges clear) and `steerToward` (the target itself when the way is clear, else the first waypoint on the shortest route, a Dijkstra over the handful of points with ties to the lower index, so it is deterministic). In `stepEnemy`'s chase, an enemy that cannot walk straight now walks to that waypoint and faces it; arriving hands on to the next leg. With no route it slides as before. The wake rule (line of sight) and the Charger's lane are unchanged.
- Tests: `shared/src/pathing.test.ts`, 6 (136 in all): the critic's exact case reaches the hall, a den goblin reaches the hall through the guard room, a pens goblin uses its door, straight walking when clear and on levels without waypoints, two runs agree. The three chase tests fail on the old code. `npm run test:net` green (no server change; the Warrens and 4-bot stress steps unchanged).

**Learned**

- A single door point in the wall's plane is not enough: a chaser pressed along the wall approaches it nearly parallel and its edge clips the jamb, so the route says blocked. Two points per doorway, set back from the wall, fix that and give the chaser a straight line through.
- Routes are recomputed every tick per enemy; with six points and nine walls that is cheap. A bigger floor would want the waypoint-to-waypoint visibility cached per level.

**Next**

- Still waiting on Michael's answer on picking a weapon (decisions.md); then the rest of the weapon classes, Arrow rain and Magic missile.
- For the critic: re-run the guard-room steps; a chaser should now come out of the door within a few seconds.
## 2026-10-05: Session 25, extrapolation past a late snapshot

**What changed**

- `shared/src/interp.ts`, pure and unit tested: the remote pose lookup the client used to keep in `net.ts` (`sampleSnapshots`, `pushSnapshot`, the 24-deep buffer) moved here as a `PoseTrack` per entity, and learned two things. Past the newest snapshot, `projectPose` moves the pose along the motion of the last tick (the last two snapshots) by at most `INTERP.extrapolateMaxMs` (one tick, 50 ms) and holds there; facing is held, because the sim turns a player to a new heading inside one tick and projecting that would spin them past it. The projection runs through `collideWalls` with the entity's radius (`PLAYER.radius`, or the kind's from `ENEMY_KINDS`), so a goblin walking at a wall is drawn stopped at its face the way the server stops it, never inside. A step faster than `INTERP.extrapolateMaxMps` (20 m/s; the fastest real move, a dodge, a charge or a throw, is 12) is a placement, a respawn or the stairs, and is held rather than flung another 15 m.
- The ease. A projection is a guess, and the snapshot that ends it can disagree: the player stopped, turned, or the stall ran past the cap and they are a metre on. `pushPoseSnapshot` remembers the pose the track last handed out and the draw time it was for; when the newest snapshot arrives for a time the track was already past, it interpolates the new buffer at that same draw time and makes the difference a per-entity offset that `samplePoseTrack` adds to every later pose, decaying with time constant `INTERP.easeMs` (100 ms). So the first frame after the late snapshot continues from the last one drawn, and the remote is on the true path within half a second. Over `INTERP.easeSnapM` (2.5 m) the difference is a placement and pops, as a correction of the own player does over `SNAP_DISTANCE`. Position only: facing was already interpolated across a tick.
- `client/src/net.ts`: `RemotePlayer` and `EnemyView` carry a `track` instead of `snaps`; `remotePose` is `samplePoseTrack` at `remoteNow()` inside `net.level`; the snapshot push passes the level too, so the fold-in sees the same walls. `Pose` is the shared type now, re-exported for `render.ts`. `main.ts` is unchanged: every call site (the draw loop, the HUD's nearest enemy, the revive prompt, `__hg`) goes through `remotePose`, so remote players and every enemy get the projection and the ease together.
- Constants in `INTERP` (`sim.ts`): `extrapolateMaxMs`, `extrapolateMaxMps`, `easeMs`, `easeSnapM`. The server is untouched: this is draw-only, and the shared sim's step does not call any of it.
- `tests/clock-sync.ts` reports five more columns and fails on three of them: `late %` (frames whose newest snapshot was late, what a fixed pose would have held on), `proj %` (late within one tick: projected), `held %` (late past the cap: frozen), `ahead` (the furthest a drawn pose sat from the newest snapshot while projecting, m; one tick of travel is 0.3 m walking and 0.6 when the tick before was a server catch-up of two inputs, so the bar is the code's own guarantee, one tick at `extrapolateMaxMps`, 1.0 m, and the table shows what really happens), and `pop` (the largest change between frames of the drawn pose's error against the true path, rebuilt after the run from every snapshot received; limit a quarter of a tick of travel). The 150 ms link's bar moved from 0.4% held to 0.02%. 10 new unit tests (146 total): interpolation unchanged, the projection and its cap, a standing entity and a respawn held, a wall and the bounds, the ease's continuity and convergence, a hold's end eased, a placement popping, determinism of the whole track.
- `CLAUDE.md`: the interpolation bullet describes the projection and the ease and no longer ends "No extrapolation yet".

`npm run test:clock -- --seconds 30`, before (this branch with only the harness change) and after:

| link | delay mean / max (ms) | late frames | projected | held | ahead max (m) | pop max (m) |
| --- | --- | --- | --- | --- | --- | --- |
| 0 ms, before | 100.0 / 100.0 | 0.00% | | 0.00% | | 0.098 |
| 0 ms, after | 100.0 / 100.0 | 0.00% | 0.00% | 0.00% | 0.000 | 0.001 |
| 50 ms, before | 101.2 / 106.7 | 0.05% | | 0.05% | | 0.039 |
| 50 ms, after | 105.7 / 106.9 | 0.05% | 0.05% | 0.00% | 0.012 | 0.001 |
| 150 ms, before | 157.9 / 165.3 | 0.76% | | 0.76% | | 0.488 |
| 150 ms, after | 165.1 / 175.1 | 0.00% | 0.00% | 0.00% | 0.000 | 0.001 |
| 150 ms, after, 60 s | 157.1 / 165.4 | 0.08% | 0.08% | 0.00% | 0.071 | 0.053 |

Before, every late frame was a held frame (the two columns are the same number) and the pop column is the hold ending. After, the 60 s row is the one where the projection fired: the drawn player ran 7 cm past the newest snapshot at most (a 12 ms guess) and the ease's first frame moved it 5 cm more than the true path did, against the 49 cm jump a hold's end made before. The pop limit (a quarter of a tick of travel) is for this link, whose lateness never passes the cap; a 200 ms TCP stall, the lab's loss row, ends with the ease walking 1.2 m back over a few frames, 18 cm in the first, which is a catch-up rather than a jump but would fail this bar, so the bar stays on the jitter link only. The 150 ms link's late share runs 0.27% to 0.76% from run to run (Sessions 14 and 23 saw 0.2% and 0.1%); the 30 s "after" run happened to see none, hence the 60 s row. The one baseline run with a 0.098 m pop on the clean link was a frame 16 ms late; the first baseline (same code, first version of the metric) had 0.00% late there.

`npm run check` (146 unit tests) and `npm run test:net` (placement, field, flooder, downs, Cleave, draught, the yard wall, 4-bot stress at 20.0 patches/s and tick 1.000 of wall time) green. Lab (`npm run lab -- --seconds 60`, the field level, two headless Chromiums at 48 fps on this box), with the critic's run on main this morning for comparison:

| link | corrections/min, critic / here | holds/min, critic / here |
| --- | --- | --- |
| 0 ms | 13 / 7 | 7 / 7 |
| 50 ms | 20 / 22 | 8 / 12 |
| 150 ms | 16 / 53 (main on this box, same hour: 51) | 4 / 3 |
| 50 ms, ±20 jitter, 2% loss | 52 / 26 | 43 / 32 |

The lab's hold is Bravo's drawn Alpha standing still for four or more samples while Alpha moved. The 0 and 50 ms conditions have no jitter and no late snapshot, so their holds are Bravo's page skipping frames at 48 fps headless (the sampler reads the same `__hg` until the next draw), which no drawing change can remove; they are the same here as on main. The loss row is where the network holds live: a lost segment stalls TCP for 200 ms, four ticks past the one-tick cap, so the projection covers the first tick of each stall and the hold count falls by a quarter rather than to nothing. That cap is the card's; raising it is a design question for Michael, not this session's. Corrections are Alpha's own reconciliation, which this change does not touch (draw-only); the 150 ms figure is this box's: main run here the same hour, same condition, gives 51 a minute and 4 holds, so the box (two browsers, the server and Vite on a small VM) is where the critic's 16 became 53, and the critic's tick-timing item under "Found in play" is the cause either way.

**Learned**

- The first pop metric (the drawn step beyond walking speed in a frame) read 0.1 m on a clean link with no late frames at all. That is the server, not the drawing: a tick that applies two queued inputs moves a player 0.6 m in 50 ms, and interpolating that tick draws 12 m/s for 50 ms. It is the critic's tick-timing finding seen from the other side and the harness cannot fix it, so the metric compares the drawn pose with the true path instead (every snapshot received, interpolated after the run), and a pop is the change in that error between frames. The server's catch-up ticks are then invisible to it and a hold ending is not.
- The 150 ms link's late share is a few events a run and swings fourfold between runs of the same code (0.00, 0.27, 0.76% here). A 30 s run proves the projection works when it fires and says little about how often; the 60 s row and the lab's daily run are the frequency numbers. A run of `npm run check` on the same box while the harness measured the clean link cost that link 11 ms of delay and a 67 ms late patch; the harness measures the box as Session 15 said.
- The ease folds the disagreement in at the arrival, not at the next frame, and compares the pose last handed out (offset included) with what the new buffer says for that same draw time, then replaces the offset rather than adding to it. That is what makes the drawn pose exactly continuous: at the draw time of the fold the new sample plus the new offset equals the old pose by construction. Adding would double count when two late snapshots arrive a frame apart.
- The projection uses the real wall collision rather than clamping to the last snapshot: `collideWalls` is two passes over the level's rectangles, cheap at ten entities and sixty frames, and it draws the one thing a player near a wall expects, the body stopping at the face. A clamp would have made the entity visibly stop a tick early at every wall on a bad link.

**Next**

- Reconnect with a grace period (the last Phase 0 Fable carry-over), then the two items under "Found in play" that share the input path: movement speed falling with frame rate, and corrections from tick timing.
- The lab's `holds/min` already reads the projected pose through `__hg`, so the critic's loss row (TCP stalls of 200 ms, 48 holds a minute before the adaptive delay) will show what the ease does at a hold's end: catching up 1.2 m over a few frames instead of a jump.

## 2026-10-05: Session 23, the adaptive delay merged with the Warrens groundwork

**What changed**

- `origin/main` (the Warrens groundwork, local Session 15: many enemies as an `Encounter`, walls in a `Level`, a snapshot buffer and a mesh per enemy) merged into `auto/fable-interp-budget` again, Michael's answer A of 2026-10-05. The producer counted one conflict (the devlog); there were four. `CLAUDE.md`: the adaptive interpolation bullet now says every enemy and names the per-enemy buffer, and main's `Level` bullet sits between it and the clock bullet. `client/src/net.ts`: both halves of the class comment (the delay from the window's longest wait; prediction inside the level). `client/src/main.ts`: main's `draw()` took `serverNow()` at the top and a literal `serverNow - 100` for every remote timer, the pattern Session 14 removed; the merged `draw()` takes `remoteNow()` once and the remote players' swing, dodge and Cleave flash and every enemy's windup and hit flash run at it, so four goblins are drawn at the adaptive delay like one was. `shared/src/sim.ts` and `server/src/rooms/DungeonRoom.ts` merged on their own: the `INTERP` block beside `ENEMY_KINDS` and `ROOM`, the step's wall time still taken after the patch leaves.
- Numbered 23 because the builder's branch already carries Sessions 16 to 22 (its Slack post of 2026-10-04); two Session 15 entries sit in this file already and a third pair would not help anyone reading it.
- On the merged tree: `npm run check` (77 unit tests), `npm run test:net` (placement, field, flooder, downs, Cleave, draught, the yard wall at x = 5.10, 4-bot stress at 20.0 patches/s and tick 1.000 of wall time) and `npm run test:clock -- --seconds 30`: 0 ms link delay 100.0 / 100.0 ms (mean / max), 0 holds; 50 ms 103.5 / 104.9, 0.1% held frames, 2 holds a minute; 150 ms 155.3 / 165.9, 0.1% held, 2 holds a minute; corrections and snaps 0 on all three. Session 15's run had 0 holds at 50 and 150 ms and Session 14's 6 a minute at 150; this is within that spread and well under the test's 0.4% bar.

**Learned**

- A "docs-only conflict" is what git reports, not what the merge needs: `main.ts` had no textual conflict in the enemies loop, and taking it as it came would have drawn every goblin a fixed 100 ms behind while the players next to them moved at the adaptive delay. The thing to check after any merge touching the client is that `remoteNow()` is still the only subtraction from `serverNow()` (`git grep -n 'serverNow - ' client/src` should find nothing).
- The builder's branch (`auto/build`, Sessions 16 to 22, PR #7) changes `sim.ts`, `net.ts` and `main.ts` again on top of main: a test merge of `auto/build` onto this merged tree conflicts only in the devlog, and its `draw()` keeps `remoteNow()` as the one remote clock, so that merge is a routine one. Whichever of PR #9 and PR #7 merges second needs one more merge of main; #9 is the smaller one, so landing it first costs the builder a routine merge and landing #7 first costs another Fable card.

**Next**

- Michael approves PR #9 and the producer merges it before PR #7; then extrapolation by up to one tick when a snapshot is late, then reconnect with a grace period.

## 2026-10-04: Session 15, the adaptive delay merged with builder Sessions 7 to 13

**What changed**

- `origin/main` (builder Sessions 7 to 13: downs, states, Cleave, the Revive Draught, the placement fix, the stress test) merged into `auto/fable-interp-budget`. Three conflicts, all keep-both: the `INTERP` block and the `STATES`, `COMBO` and `ABILITIES` blocks both added after `GOBLIN` in `shared/src/sim.ts`; the `interpDelayAt` and `isAlive`/`isDead` imports in `client/src/net.ts`; Sessions 13 and 14 both at the top of this file. No code was changed in the merge: `main.ts` merged on its own and already runs the remote swing, dodge, Cleave flash and goblin windup timers at `remoteNow()`, so the builder's Cleave is drawn at the adaptive delay like everything else remote.
- `npm run check` (62 unit tests), `npm run test:net` (placement, downs, Cleave, draught, 4-bot stress) and `npm run test:clock -- --seconds 30` green on the merged tree. The clock run: 0 ms link 100.0 / 100.0 ms delay, 0 holds; 50 ms 102.0 / 103.0, 0 holds; 150 ms 155.3 / 162.8, 0.0% held frames, 0 holds a minute. Same shape as Session 14's table (0.2% held at 150 ms then; the difference is the run, not the code).

**Learned**

- The first `test:clock` on this box failed hard on the 0 and 50 ms links (a patch 540 and 1324 ms late, the server tick at 0.97 of wall time, the clock snapping at 957 ms/s) and passed the 150 ms link that ran last. The VM was two minutes old and still compiling; the second run was clean. The test measures the box as much as the code, so a red clock run on a cold machine is a re-run first. The critic's lab has the same exposure.

**Next**

- Michael approves PR #9 and the producer merges it; then the extrapolation item (one tick when a snapshot is late), then reconnect with a grace period.

## 2026-10-04: Session 14, adaptive interpolation delay

**What changed**

- `INTERP` in `shared/src/sim.ts` (the tuning surface): `baseMs` 100, `maxMs` 200, `slewMsPerS` 10. Michael's answer C to the Session 6 question: 100 ms plus the measured jitter, capped at 200, slewed like the clock.
- `shared/src/clock.ts` estimates the delay from the window it already keeps. At every frame the newest patch is some way behind the clock, `now + offset - stamp`: the wait for the next patch so far. On a punctual link that peaks at one tick; a late patch makes it peak at a tick plus its lateness, and a remote player holds exactly when the wait exceeds the delay. Each patch sample remembers the longest wait a frame saw while it was the newest, the window's largest less the tick is `late`, and the delay target is `late` plus a tick within the bounds. The applied delay slews toward it at 10 ms/s and never jumps (the cap bounds the walk to ten seconds; the offset still snaps over 250 ms, the delay does not). `interpDelayAt` and `remoteTimeAt` are the entry points; `stepClock` slews both.
- `client/src/net.ts`: `INTERP_DELAY_MS` is gone. `remoteNow()` is server time less the delay, `remotePose` samples at it, and `draw()` in `main.ts` runs remote swing, dodge and windup timers at the same `remoteNow()` instead of the literal `serverNow - 100`, which the critic had flagged would run ahead of the bodies once the delay moved. `interpDelayMs` and `lateMs` are debug handles, on `window.__hg` as `interpDelay` and `late`.
- `server/src/rooms/DungeonRoom.ts`: the step's wall time is taken after the patch leaves, not when the step begins. A ping reply was stamped from the step's start while the patch it compares with left at its end, so on a busy box pings beat patches by the step's own duration and the clock sat 5 ms ahead of anything a snapshot could deliver (`vs floor max` 5.0 in the first run here, 0.2 after). The server is otherwise unchanged.
- `tests/clock-sync.ts` reads the live delay, reports the worst lateness the frames saw and the delay's mean and max, and fails if the clean link pays more than the base, the 150 ms link holds more than 0.4% of frames (a third of the fixed delay's), or the delay passes the cap. 5 new unit tests (32 total): base on a link up to 50 ms late, following the longest wait and ageing out through the slew, the slew surviving an offset snap, a client stall not reading as lateness, and the 150 ms simulation where the fixed base holds and the adaptive delay does not.
- `CLAUDE.md`: the interpolation line describes the adaptive delay and names `remoteNow()` as the one place a delay is subtracted.

`npm run test:clock -- --seconds 30`, before (fixed 100 ms, this branch before the change) and after:

| link | delay mean / max (ms) | worst lateness seen (ms) | held frames | holds/min |
| --- | --- | --- | --- | --- |
| 0 ms, before | 100 / 100 | | 0.0% | 0 |
| 0 ms, after | 100.0 / 100.0 | 31 | 0.0% | 0 |
| 50 ms, before | 100 / 100 | | 0.2% | 6 |
| 50 ms, after | 101.3 / 101.9 | 52 | 0.0% | 0 |
| 150 ms, before | 100 / 100 | | 1.6% | 14 |
| 150 ms, after | 145.4 / 158.3 | 108 | 0.2% | 6 |

The clock numbers (wander, drift, position against the floor) and the driven player's corrections and snaps did not change. `npm run test:net` green.

**Learned**

- The first version measured lateness at arrival: the worst sample's distance below the target in the window. It gave 0 holds at 150 ms with the delay at 167 to 179 ms, and the clean link paid 117 ms, because the window had caught the connection's startup burst, patches 80 ms "late" while the client was still joining. In a browser that is every page load: 20 s at the cap while the scene builds. Measuring the wait at the frames that actually ran is immune to it, and to a background tab or a long GC pause: nothing was drawn while the client stalled, and the patches it missed are handled before its next frame (there is a unit test for exactly that).
- Measured against the applied offset the budget came out short: 133 ms mean at 150 ms and 0.8% held, because the offset sags 13 ms below the floor on average while the best sample ages out. Against the floor (the target, or the offset when that is the later) it is 145 ms and 0.2%.
- What is left at 150 ms is the measure being reactive: the first spike after the previous one has left the window holds for a frame or two before the delay has risen to cover it, and the climb from 100 to 180 takes 8 s at 10 ms/s. A guard of one frame above the measured wait, or a faster rise than fall, would take some of those at the cost of 15 to 20 ms on the 50 ms link; the extrapolation item (next) covers a late snapshot by up to a tick and is the designed answer. Not done here, since C says what it says.
- The clock slews at 10 ms/s and so does the delay; when both move the same way the drawn remote runs up to 2% off speed for a few seconds. Nobody saw it in the lab; if someone does, a shared budget is the fix.

**Next**

- Extrapolate remote players by up to one tick when a snapshot is late, then reconnect with a grace period.
- The critic's lab can read `__hg.interpDelay`; its loss row (TCP stalls of 200 ms, 48 holds a minute) should now draw at the cap and hold far less.

## 2026-10-05: Session 22, the Goblin Warrens floor

**What changed**

- `WARRENS` in `shared/src/level.ts`, now the default level (`?level=yard` keeps the yard): an entry hall where the party spawns, with the stairs at its centre, and three rooms off it through 3 m doorways. North-west the guard room (two goblins and a Shieldbearer), through it the den (a Charger watching the door from the far side and a goblin), south the pens (the Pack Leader with two goblins in its rally and one just outside it). Pillars in the den and the pens for cover and for baiting the Charger.
- Rooms (`Level.rooms`, `roomAt`): every enemy belongs to the room it spawned in. When a room's last enemy falls the room is clear ("The guard room: clear"): the downed stand up and the dead come back, as a whole-level clear did before. A level without rooms is one room, so the field and the yard behave as they did.
- Michael's objective (A, 2026-10-04): when every room is clear the stairs open (`Level.stairs`, `STAIRS`): the dais lights up and the HUD says "Stairs open: everyone onto them". Every standing player within 2.5 m of the stairs for 2 s takes the party down (`stepStairs`); the dead do not hold it up. Until a second floor exists, going down starts this floor again: every enemy back at its post, the stairs shut, a draught each, `floor` counting up ("Down the stairs: floor 2"). The stairs sit where the party spawns, so going down moves nobody and the client has nothing to reconcile. Levels without stairs keep `ROOM.resetMs`.
- Enemies need a line of sight to wake (`lineClear`, as Session 15 left for this item): each room sleeps until someone walks in, and an idle enemy behind a wall stays idle. Two Session 15 tests assumed goblins woke through a wall; one now checks both sides of that, the other starts its goblins awake.
- Server: `stairsOpen`, `descendMs` and `floor` in the room state. Client: the stairs built once with the walls and lit while open, brighter as the party's hold fills.
- Tests: 7 in `shared/src/warrens.test.ts` (130 in all): the layout (every enemy in a room, the spawns and stairs in the hall, nothing in a wall), the doorways, every room asleep while the party waits, rooms clearing one by one with the stairs shut until the last, the descent and its refill, the dead not holding it, the yard still on its timer. `npm run test:net` adds a Warrens room (nine enemies asleep, stairs shut, floor 1); the yard and stress steps now ask for the yard by name. `tests/hit-feedback.e2e.ts` joins `?level=yard`, since it walks to the yard's first goblin. e2e mobile and hit feedback 5 of 5.

**Learned**

- Putting the stairs in the spawn hall is what keeps the descent free of netcode: a floor change that moved players would be a teleport, which reconcile counts as a snap unless the client is told it is a placement (Session 12's rule). When a real second floor arrives with its own layout, that placement flag is the work to do, and it is a client netcode change.
- For the critic: the lag lab joins the default level, now the Warrens hall where nothing wakes, so its corrections will fall for a reason unrelated to the network. `level=yard` in its page URL keeps its numbers comparable; the lab is the critic's, so this run left it alone.

**Next**

- Nothing else in Phase 1 is the builder's until Michael answers how a player picks a weapon (decisions.md). Then the rest of the weapon classes, Arrow rain and Magic missile.
- The gate (a mixed-level party clears a Warrens floor, the combo bonus visible) is playable once the weapon pick lands, and the combo bonus has nothing on screen yet beyond the log: worth a look before the playtest.

## 2026-10-05: Session 21, the Pack Leader

**What changed**

- The Pack Leader (`PACK_LEADER` in `sim.ts`), designed in The Old Gates ("buffs nearby enemies") and never built there: a goblin chief with a red banner, 90 hp. Every other living enemy within 7 m of it is rallied: 25% quicker and a third harder (a goblin's 15 becomes 20), tinted war-paint red. While it has a rallied pack it hangs back 5 m from its target instead of closing in; alone, it fights like a goblin. Kill it and the pack is ordinary goblins on the next tick. Leaders do not rally each other.
- `updateRallies` runs at the start of `stepEnemies`, from where everyone stood when the tick began, so the order enemies step in cannot change who is rallied. `rallied` is in the enemy schema for the tint and the HUD ("Goblin, 6 of 7 left, rallied").
- The yard has one at (-15, -13), behind the south-west goblin, which it rallies from the start: the first goblin pack. The yard now holds four goblins, a Shieldbearer, a Charger and a Pack Leader.
- Tests: 4 more in `shared/src/roster.test.ts` (123 in all): who is rallied and only while the leader lives, a rallied goblin's speed and blow, the hang-back and the charge-in once alone, the yard's leader starting with its goblin. `npm run test:net` green (seven enemies in the yard, 4-bot stress at 20.0 patches/s); e2e mobile and hit feedback 5 of 5.

**Learned**

- The three new kinds each ask a different thing of a party: the Shieldbearer a hold and a flank, the Charger reading a lane, the Pack Leader reaching the back line. None is a bigger health bar, which is the design doc's rule for tiers too.
- Goblin packs are placement: a leader and the goblins in its reach. The floor item places them room by room; nothing more is needed in the sim.

**Next**

- The Goblin Warrens floor: rooms as a `Level`, clear every room (Michael's A), stairs in place of `ROOM.resetMs`, packs and the new kinds placed by room.
- Michael's answer on picking a weapon unblocks the rest of the weapon classes, then Arrow rain and Magic missile.

## 2026-10-05: Session 20, the Charger

**What changed**

- The Charger (`CHARGER` in `sim.ts`), designed in The Old Gates and never built there; its charge is the lair beast's (every 7 s, from 5 to 16 units, four times its speed, double damage, a three-unit throw) on a brown brute with 80 hp. When a player is 5 to 14 m away with a clear line and the charge is ready, it plants for 900 ms with a red lane on the ground (`aim`), then runs straight down the lane at 12 m/s (`charge`) for up to 14 m. The first standing player it meets takes 30 (blocked or parried like any blow) and is thrown 3 m along the lane; a dodge goes through it; a wall stops it dead and stuns it for 2 s (Staggered, so the combos pay). Up close it swings like a goblin. Cleave breaks the aim or the run like a windup.
- The throw is a slide, not a teleport (`KNOCKBACK`, `PlayerSim.knockUntil/knockDx/knockDz`): `applyInput` moves a thrown player at 12 m/s for the five ticks after the blow and ignores their input, and the state is in the schema, so the client rewinds to it and replays it like a dodge. The patch that brings a throw is a smoothed correction (the client could not have known), never a snap, and the next patch agrees with the replay; `tests/reconcile-placement.ts` proves both.
- `strikePlayer` takes the blow's size, so the charge goes through the same parry, block and posture rules as a swing.
- The yard has one in the south-east corner (14, -15), open ground in front of it. Client: the Charger's mesh and its lane are built once; the log says "The charger ran you down" and "The charger hit the wall: stunned".
- Tests: 8 more in `shared/src/roster.test.ts` (119 in all): aim and the fixed lane, the run and the 3 m throw with no actions during it, a dodge through, a parry, a wall stun, the cooldown, the swing up close and the line-of-sight wait, Cleave breaking the aim, prediction parity for a slide. `npm run test:net` green (the yard step reads the level's list, now six); e2e mobile and hit feedback 5 of 5.

**Learned**

- The slide runs on the ticks after the blow, because inputs are applied before hits resolve in a tick; a 250 ms window gave four ticks (2.4 m). `KNOCKBACK.ms` is 300 for the 3 m. Anything else that moves a player from the server (a pull, a shove) should reuse this state rather than set a position.
- A Charger aimed at a group hits whoever is first in the lane, sorted along the lane with ids breaking ties, so the server and a replay agree on the victim.

**Next**

- The Pack Leader (buffs goblins near it), then goblin packs placed by the floor item.

## 2026-10-05: Session 19, the Shieldbearer

**What changed**

- The first new kind in the roster, lifted from The Old Gates' enemy table (`SHIELDBEARER` in `sim.ts`): a tall grey figure behind a plank shield. Hits on its front half do 35% while the shield is up (`EnemyDef.frontGuard`, `shieldCovers`), sword and bow alike. The Old Gates' two answers both work: Cleave on the shield (the power attack) breaks the guard outright, staggering it for 1.5 s with the shield down so follow-ups land in full; or go round it, since the shield covers only the front half and turns to face its target, so in a party one player holds it while another hits its back. Any posture break drops the shield (Session 18's posture), and it comes back up when the stagger ends, so a long fight means breaking it again.
- Numbers are The Old Gates' ratios on Hearthgate's goblin: 100 hp (48 to the goblin's 28 there), 2.0 m/s, 20 a blow, an 800 ms tell and 700 ms recovery (slower to read than the goblin's 650), aggro at 10 m so it waits until someone walks up.
- The yard has one, at (0, 15) facing the start, 12 m north of the spawns, out of aggro at join.
- Server and client: `guardUp` in the enemy schema; the renderer builds the shield once per Shieldbearer and hides it while the guard is broken; the HUD label reads "Shieldbearer, 5 of 5 left, shield up"; the log says "You hit the shieldbearer's shield for 7".
- Tests: 8 in `shared/src/roster.test.ts` (111 in all): shield up at spawn, 35% on the front, full from the side and behind, Cleave breaks it and follow-ups land in full, it comes back after the stagger and on a reset, posture damage through the shield drops it, it covers the front half as it turns, the yard spawn is clear of walls. `npm run test:net`: the yard step now checks the level's own enemy list arrives with the Shieldbearer's shield up. e2e: mobile and hit feedback 5 of 5.

**Learned**

- The Shieldbearer is the first enemy that asks for two players (hold and flank) rather than one player doing more damage, which is the design doc's whole point about mixed-level parties; the Charger and the Pack Leader should be judged by the same test.
- Facing the target every chase tick is what makes the flank a co-op move: a lone player circling it is always in front. If playtests find it too hard alone, a slower turn rate is the knob, not a smaller shield.

**Next**

- The Charger (rush plus knockback; The Old Gates' lair-beast charge is the closest built mechanic) and the Pack Leader (buffs goblins nearby), then goblin packs placed by the floor.

## 2026-10-05: Session 18, block, parry and posture

**What changed**

- Block, from The Old Gates' `executeStrike` and parry window, simplified for crowds. Hold L or Q (LT on a gamepad; held, not a press) and the guard goes up: a plate across the front of the character, half walking speed without turning, no swing or ability until you let go, and a dodge drops it. A blow from the front half is cut by the weapon's `blockReduce` (a goblin's 15 becomes 10 with a sword, 8 with a two-hander); from behind it lands in full. `InputFrame` gains an optional `block` (absent means no; `isValidInput` rejects a non-boolean).
- Parry: a blow that lands within 300 ms of raising the guard (`GUARD.parryWindowMs`; The Old Gates' 200 ms, made more generous for crowds as the design doc asks) does nothing to you, staggers the goblin (the Staggered state, so it feeds the combos), drains 40% of its posture and holds it in recovery for 1.2 s. Holding the guard up and waiting is a block, not a parry.
- Posture (`POSTURE` in `sim.ts`). The player has 100: an unblocked blow drains its damage x1.5, a blocked one x1, a parry nothing. Empty, you are off balance for 0.8 s (no move, swing, guard or dodge; rocked back on screen), then the bar is full. A goblin has half its health (30): a weapon hit drains 8 times the weapon's `postureMult` (sword 4 hits, War Hammer 2), Cleave 25, a parry 12; empty, it is staggered and in recovery for 1.5 s, which breaks a windup in progress. Both refill 5 a second after 1.5 s without a blow (`stepPosture`, in `stepEncounter`).
- The guard is predicted like a dodge: `guarding` and `blockSince` are in the schema and the client rewinds and replays them; posture and the stagger come from the server. A starved tick no longer lowers a held guard: the server's fill frame carries `block: p.guarding`, because raising it again on the next frame would hand out a fresh parry window nobody timed. Without that line the guard dropped on every late frame (`test:net` fails on it).
- HUD: "Posture 85 / 100, guard up" (or "off balance") under the health bar; the nearest enemy's label adds "off balance" while its posture is broken; the log says "You parried the goblin: staggered", "The goblin hit your guard for 10", "You are knocked off balance", "The goblin is off balance: hit it now". The controls hint lists the block key and LT.
- Tests: 12 in `shared/src/guard.test.ts` (103 in all): input validation; raise once, shuffle, no swing; a dodge drops it; parry; block; a Claymore blocks more; the back is open; a posture break and recovery; sword and War Hammer breaking a goblin; Cleave's drain; regen; prediction parity. `npm run test:net` adds a guard step: held, a three-tick gap, held again, the window unchanged, Bravo sees it, release lowers it. `tests/mobile.e2e.ts` 4 of 4 with the longer hint (run with `PW_CHROMIUM=/opt/pw-browsers/chromium` in the cloud).

**Learned**

- Holding a guard across a gap in the inputs is the same problem as the critic's frame-rate bug in a smaller form: the server fills a missed tick with a neutral frame, and anything held (movement today, now the guard) is lost for that tick. For the guard the fill keeps it; movement is still the Fable item's.
- A frozen tab keeps its guard up until its inputs resume or it leaves. That is the right side to err on (a stuck guard costs the player speed, not the party a fight).
- The backstab, riposte and finisher multipliers from the same Old Gates files are not in: backstab is already a state consumer (Staggered, design doc) waiting on an ability that tags "backstab", and the riposte would be a second bonus on the same opening. A playtest should say whether the parry's stagger is reward enough first.

**Next**

- Michael's answer on picking a weapon unblocks the rest of the weapon classes and then Arrow rain.
- The enemy roster (Shieldbearer, Charger, Pack Leader) is the next builder item; the Shieldbearer's frontal block can reuse `GUARD.arc` and break on posture.

## 2026-10-05: Session 17, weapon classes in the shared sim

**What changed**

- Every `PlayerSim` holds a `weapon` (a `Gear` from Session 16; the Wooden Sword to start), and the swing comes from its class (`WEAPON_CLASSES` in `sim.ts`, `weaponClassOf` in `gear.ts`). One-handers keep the Phase 0 sword's numbers exactly (2.4 m, 108 degrees, 150 ms windup, 450 ms committed). Two-handers wind up 300 ms, commit 750 ms, reach 2.9 m over 135 degrees, and hit up to the weapon's `cleaveTargets` nearest in the cone (Claymore 3, Great Axe 2, War Hammer and Great Club 1). The bow locks on to the nearest enemy it can see in a 63 degree cone out to 12 m (`lineClear` against the level's walls, its first use) and the hit lands when the 350 ms draw ends; no projectile yet.
- Damage is `weaponStats(weapon, level.tier)`: `Level` gains an optional portal `tier` (1 when absent, as in both levels today), `resolvePlayerAttacks` takes the level, and `stepEncounter` passes the room's. A weapon hit is tagged with the weapon's style (melee or ranged) for the states.
- Nothing changes in play: everyone holds the sword, server and client both build players with `createPlayer`, so prediction and truth agree, and the schema is untouched. How a player picks another weapon is a question for Michael (decisions.md, Pending; A, a pick on the join screen, recommended).
- Tests: 8 in `shared/src/weapons.test.ts` (91 in all): the starter sword swings as before, classes by type, a Claymore hits the three nearest of four, War Hammer one and Great Axe two, the bow hits at 10 m and not 45 degrees off, a wall hides a goblin from the bow, the room's tier caps a Mithril sword through `stepEncounter` (27 at tier 1, 54 at tier 3), and prediction parity for a two-hander. `npm run test:net` green (placement, downs, Cleave, draught, yard wall, 4-bot stress at 20.0 patches/s).

**Learned**

- `sim.ts` and `gear.ts` import each other (gear reads `GEAR`, sim reads the weapon helpers). It is safe because neither touches the other's exports at load time, only inside functions; keep it that way or move `GEAR` across.
- The bow's lock-on is the soft auto-target with a narrower, longer cone plus line of sight. The design doc's lock-on *cycle* (a key to switch targets) and *charge timing* are left for when the bow is in someone's hands and can be felt.

**Next**

- After Michael's answer on picking a weapon: sync `weapon` in the schema, the pick itself, a mesh per class in `render.ts`, the bow's lock-on marker and target cycle, and Arrow rain in the bow's slot 1. The staff (Magic) is not in The Old Gates and needs defining with Magic missile.
- Posture, parry and block is the next builder item that does not wait on the answer.

## 2026-10-05: Session 16, gear and weapon definitions from The Old Gates

**What changed**

- `shared/src/gear.ts`: the lift of `docs/reference/old-gates/14-items.js`. Kept unchanged: the ten materials (Wooden to Cosmic, with the blade colour and the glow from Mithril up), the eleven weapon types with their attack multipliers and the two-hander fields (`twoHand`, `cleaveTargets`, `postureMult`, `blockReduce`), the eight armour types, and the per-tier attack, defence and shield-block curves. Each weapon type gains a `style` (every melee weapon Melee, the bow Ranged; the staff is not in The Old Gates and comes with the weapon classes item). Four weapon enchants (Flames, Frost, Shock, Life Drain) as data; Fatigue, Soul Tap and the armour enchants stayed behind because Hearthgate has no stamina, mana or attributes. Also left behind on purpose: weight and encumbrance, attribute requirements, prices and drop weights (the economy is Phase 3).
- A piece of gear is a plain description (`Gear`: kind, type, material tier, enchant) and its numbers are always derived for a portal tier (`weaponStats`, `armorStats`), so no caller can hold stats that forgot the cap. Nothing here creates or moves an item (rule 3); it only says what one is worth.
- The re-tune, in `GEAR` in `sim.ts`: a portal of tier T lets gear perform up to material tier 2T (ten materials over five portal tiers), and Old Gates attack times 3 is Hearthgate damage, which makes the starter Wooden Sword hit for exactly 20, today's `PLAYER.attackDamage`. Hits are fixed, not rolled: a weapon at or under the cap hits for the middle of its range, a capped one for the top of the capped tier's range. So a Mithril sword in a tier-1 portal hits for 27, a native Bronze sword for 25, an Iron sword in a tier-2 portal for 32: "a strong tier-1 sword", better, never the next tier, and it keeps its enchant.
- Nothing in combat reads it yet: the weapon classes item puts the weapon in the player's hand and the swing.
- Tests: 11 in `shared/src/gear.test.ts` (83 in all): the tables kept, the starter sword equals today's damage, the cap mapping, a capped weapon between native and next tier, the enchant survives the cap, damage rises with tier for every type, style and two-hander fields, armour and shield caps, names, clamping, purity. The code went up in one commit and these docs in the next (a script error split them).

**Learned**

- The Old Gates rolls damage in a range with `Math.random()` on every hit; rule 2 would need a seeded stream for that, and Hearthgate's hits have always been fixed numbers. The midpoint keeps the starter sword at 20 and gives the cap a natural meaning (the top of the range), so no RNG was needed.
- The design doc's "tier-5 sword in a tier-1 portal" uses one scale for gear and portals; The Old Gates has ten materials and Hearthgate five portal tiers. Two materials a portal tier is the number to revisit in playtests (`GEAR.materialsPerPortalTier`).

**Next**

- Weapon classes: put a `Gear` weapon on `PlayerSim`, take damage, reach and swing time from it, add the two-handers' cleave cap and the bow with lock-on, and slots by style.

## 2026-10-04: Session 15 (Fable, local), many enemies and walls, and the Old Gates reference

**What changed**

- Michael's local session, started because the game still looked like the Phase 0 spike: Phase 1 had twelve builder sessions behind it but the four items that lift The Old Gates were blocked (the cloud builder is refused that repo even after his answer A), and the Warrens groundwork he assigned to Fable had no session yet. Both are done here.
- `shared/src/level.ts`: a `Level` is bounds, walls as axis-aligned rectangles and enemy spawns. `collideWalls` keeps a circle inside the bounds and out of the walls (push out along the nearest point; a centre that lands inside a wall leaves by the nearest face; two passes so corners settle), and both sides run it: `applyInput` takes the level, the client passes `net.level` to prediction and replay. `lineClear` (segment against the walls) is there for the floor item's aggro and ranged attacks; nothing uses it yet. Two levels: `field` (the Phase 0 arena, one goblin; the unit tests and the smoke test's downs steps assume it) and `yard` (the default: five ruined walls and four goblins spread so a lone player meets one or two at a time).
- `sim.ts`: enemies are an `Encounter` of keyed `EnemySim`s (`e1`..), each with a `kind` from `ENEMY_KINDS` (`EnemyDef`: hp, speed, reach, telegraph), a `maxHp` and a spawn. The sword hits the nearest living enemy in its cone (`enemiesInCone`, soft auto-targeting from the design doc); Cleave hits every enemy in its wider cone. Enemies no longer respawn one by one: a dead one stays dead, the last kill is `roomCleared` (the downed stand up, the dead come back, as before), and `ROOM.resetMs` (6 s) later `roomReset` puts them all back, the stand-in for stairs. `separateEnemies` keeps living enemies out of each other (pairs in id order, half the overlap each, then back out of the walls). `stepEncounter` is the server's one call per tick. Events carry `enemyId`.
- Server: `EnemyState` gains `id`, `kind`, `maxHp`; the state has an `enemies` map and a `levelId`; `onCreate` takes a `level` option (tests use `field`). Client: `net.enemies` with a snapshot buffer per enemy, `net.level`, `nearestEnemy`; the renderer builds the level's walls once (waist-high ruins, taller pillars) and one mesh per enemy; the HUD shows the nearest enemy's bar and "Goblin, 3 of 4 left"; the log names the enemy and says "Room clear" and "The goblins are back". `?level=field` joins a field room.
- `docs/reference/old-gates/`: copies of `10-player.js`, `14-items.js`, `62-actions.js`, `74-strikes.js` and the enemy tables, with a README mapping each to its Phase 1 item and noting that only the Shieldbearer exists in The Old Gates code; Charger and Pack Leader were designed there and never built. The four lift items lose their (design) mark and name their source files. The roster item notes the groundwork is in.
- The remote playtest, by machine: Michael dropped the "friend on another network" item (no such friend; it would stay a blocker), so the critic's lag lab gained `--server` and `--client`: no local server, no proxy, no Vite, two real Chromium pages on this desktop against the hosted Render build over the public internet. Five minutes at main c064e1a: 19 ms round trip, 1 correction (0.2 a minute), 0 snaps, 0 holds, Bravo drew Alpha 105 ms behind with a 0.45 m mean gap, verdict ok. Filed in `docs/playtest-notes.md`; both Phase 0 (Michael) items and the lag-lab item are checked.
- Tests: 15 new unit tests in `level.test.ts` (a wall stops and slides, a dodge cannot pass one, a circle inside a wall leaves by the nearest face, prediction parity through walls, line of sight, the yard keeps every spawn clear; chase, separation, sliding along a wall, room clear and reset, sword versus Cleave targeting, wipe, determinism), 65 in all. `npm run test:net` runs its downs and Cleave steps on the field (as written for one goblin), then a yard room: four goblins reach the client and the server holds a client walking east from (-3, 3) at x = 5.10, the wall's face less the radius; stress runs in the yard. e2e: 5 pass; `two-players.e2e.ts` fails as it has since Session 4 (the critic's frame-rate bug: 0.9 m in 700 ms headless), not from this change.

**Learned**

- The Old Gates has no Charger or Pack Leader in code (devlog there: designed in the Session 5 monster ladder, only the Shieldbearer shipped). The design doc's "reuse" for those two is a reuse of the design, which is why the roster item now says so.
- With four goblins the old smoke test's downs step is not a fair test any more (two goblins down the rescuer before the 1.5 s pickup finishes), so that step keeps the one-goblin field and the yard gets its own step. A test that depends on a tuning number should pin the level it assumes.
- Enemy order matters for determinism in separation: iterate pairs in id order, not Map order, or a server that rebuilt its map would part a crowd differently.

**Next**

- The builder: gear, weapon classes, posture and parry, the roster, then the Warrens floor as a `Level` with rooms (walls with gaps), the clear-every-room objective and stairs in place of `ROOM.resetMs`.
- Fable: extrapolation, reconnect, the frame-rate input bug (the critic's), and PR #9's conflicts with main.
- Interest management stays out until a floor has more enemies than a patch comfortably carries; measure first.

## 2026-10-04: Session 13, the Revive Draught

**What changed**

- Michael answered the four Phase 1 questions on the control room (all A). The Revive Draught is built to his choice: a plain counter in the sim, not an item, which the Phase 3 ledger replaces (rule 3 stays whole: nothing here creates or moves an item). Every player has one (`DOWNS.draughtsPerFloor`). A standing player presses E, or LB on a gamepad, next to a dead teammate's body (within 2.5 m, centre to centre) and they stand where they lie at 50 hp (`draughtHp`, more than a pickup's 40 because the draught is the scarce one). It only works on the dead: the downed have the free pickup, and the dead already on a respawn timer (room cleared, squad wiped) are coming back anyway. Nothing to target, or no draught left, spends nothing.
- Floors do not exist yet, so a wipe, which the design doc makes the end of the run, refills everyone. The floor item moves the refill to the floor's start.
- `shared/src/sim.ts`: `InputFrame` gains an optional `use` (absent means no, so older frames and the bot harness stay valid; `isValidInput` rejects a non-boolean), `PlayerSim.draughts`, `useDraught()` and the `playerRevived` event. The draught changes another player, so it is not in `applyInput`: the server collects this tick's presses after every player's inputs and resolves them before the attacks, and the client does not predict it.
- Server: the schema carries `draughts`. Client: the top-left panel shows "Revive Draughts: 1", and turns into "E or LB: revive Bram (1 draught)" when a body is in reach; the controls hint lists E and LB; the log says "Orla brought Bram back with a draught"; the dead player's banner says a friend's draught can bring them back.
- Tests: 7 unit tests in `shared/src/draught.test.ts` (57 total): the input flag, the revive where the body lies, out of reach, the downed and the respawning are not targets, one a floor, nearest body first and the dead cannot use one, the wipe refill. `npm run test:net` sends five draught presses with nobody dead and checks they are applied, spend nothing, and both clients see the count. `tests/mobile.e2e.ts` checks the count renders in the top-left panel on all four viewports; 5 of 5 e2e pass (mobile and hit feedback).

**Learned**

- `test:net` cannot cheaply reach a real revive: a bleed-out is 30 s. The sim tests carry the revive and the net test carries the wire and the schema; if that gap ever matters, a test-only room option for a short bleed-out would close it.
- Michael's Old Gates answer (A) did not unblock this run: the clone is still refused by the run's own permission check. It needs the repository added to the routine's sources, which only Michael can do.

**Next**

- Nothing else in Phase 1 is the builder's today: the four Old Gates items wait on that access, Arrow rain and Magic missile wait on the weapon classes, the Warrens groundwork is now a **(Fable)** item ahead of the floor, and the critic's frame-rate bug is likely **(Fable)**.
## 2026-10-04: Session 12, respawns are placements, not snaps

**What changed**

- The critic's bug: `reconcile` counted the server moving us to our spawn as a prediction error over `SNAP_DISTANCE`, so every respawn and wipe raised the HUD's corrections and `__hg.snaps`, and the lag lab's snaps a minute with them. Now a patch that takes us from dead to standing (a bleed-out, a cleared room, a wipe) is a placement: the client takes the server's position, clears the visual offset and counts nothing. The first patch after joining is treated the same, since the client starts at the origin and the server puts us at a spawn (it counted one snap per join before). Real errors are unchanged: a 3.5 m error while standing still snaps and counts.
- `tests/reconcile-placement.ts` feeds the real `Net` class fake patches (no server): joining, downed, dead, respawned 10 m away, then a real error. It fails on the old code (joining alone counted a snap) and passes now. `npm run test:net` runs it first.

**Learned**

- Pickup (downed to standing) is left counted on purpose: the player stays where they crawled, so any error there is a real one.
- `Net` runs under tsx in Node without a browser, so client netcode can be checked headless by calling `onState` with plain objects; useful for later reconcile work.

**Next**

- The critic's first bug (movement speed falls with frame rate) is filed as likely **(Fable)** and waits for a card. The rest of Phase 1 waits on the four questions in `decisions.md`.

## 2026-10-04: Session 11, controls hint clear of the ability slots

**What changed**

- The critic's bug: between 601 and about 750 px wide the bottom-left controls hint ran under ability slots 1 and 2 (109 px of overlap at 640 x 400). The hint is now capped at the width left of the slots (`max-width: calc(100% - 226px)`: the 14 px gutter, the 184 px of slots, their 14 px gutter and a 14 px gap) and wraps upward instead. Under 600 px it is still hidden.
- `tests/mobile.e2e.ts` gains a 640 x 400 viewport and checks, wherever the hint shows, that it stays on screen and clear of the slots and the top panels. Without the fix the new case fails on the overlap; with it, 4 of 4 pass.

**Learned**

- The hint panel had no right edge at all, so any viewport between the breakpoint and the hint's natural one-line width was exposed. A bound tied to the slots' size fixes the whole range rather than one width.

**Next**

- The critic's third bug: respawn and wipe teleports counted as snaps and corrections.

## 2026-10-04: Session 10, ability slots and Cleave

**What changed**

- Three ability slots a player, pressed with 1, 2, 3 (number row or numpad) or Y, B, RB on a gamepad. `InputFrame` gains an optional `ability` (0 to 3; absent means none, so older frames and the bot harness stay valid); `isValidInput` rejects anything else. Which ability sits in a slot comes from the weapon: the sword is the only weapon, so `SWORD_SLOTS` is Cleave, empty, empty. Arrow rain and Magic missile wait for the bow and the staff (weapon classes, blocked on The Old Gates).
- Cleave (`ABILITIES.cleave` in `sim.ts`): a committed move like the sword swing, predicted the same way. 250 ms windup, 600 ms total, 2.8 m reach, a 198 degree arc (the sword's is 108), 14 damage, 6 s cooldown. It hits as melee and area (so it lands in full on a Rooted target), applies Staggered (Session 8's states: the setup for a later Execute or Backstab), and breaks a goblin windup in progress, which is how Melee answers a telegraph. Downed players cannot use it; respawning clears the cooldowns.
- Server: the schema carries `abilityUntil`, `abilityHitAt`, `abilitySlot` and the per-slot `readyAt` as an `ArraySchema`, and Cleave's hit is an `abilityHit` event. Client: the cooldowns come back in `reconcile`; a wide arc flashes when Cleave lands, for you and for others; hits nudge and sound like the sword's; the log says "You cleaved the goblin for 14: staggered, swing broken".
- HUD: the slots sit in the bottom-right corner as three 56 px boxes with the key, the name and a cooldown count (empty slots dashed). The event log moved up above them. The controls hint lists the new keys.
- Tests: 6 unit tests in `shared/src/abilities.test.ts` (50 total): validation, commit and cooldown, empty slots and the downed, the hit with stagger and interrupt, the wider arc, prediction parity. `npm run test:net` has Alpha walk up and Cleave the goblin (landed in 553 ms), and checks Bravo sees Alpha's slot cooling down, which proves the array syncs. The mobile e2e test checks the slots are on screen in the bottom half, at least 48 px, clear of the top panels; 4 of 4 e2e pass.

**Learned**

- The sword swing and Cleave share one rule for "committed" (`isAttacking` covers both), which kept the downs pickup and the movement lock right without touching either.
- A Playwright locator that matches three elements fails in strict mode inside `boundingBox`; pick one slot by its `data-slot`.

**Next**

- Unblocked Phase 1 work left: the Goblin Warrens floor (rooms, an objective, stairs). It turns one goblin into many and adds walls to movement, which reshapes the shared sim and touches server and client together; the builder will raise it as a question before starting.
- Michael's answers on The Old Gates access and the Revive Draught unblock the rest.

## 2026-10-04: Session 9, four-player stress test

**What changed**

- `npm run test:net` ends with a stress run: `STRESS_BOTS` bots (default 4) join a fresh room and, for `STRESS_MS` (default 5 s), each walks a circle at its own phase at the client's 20 Hz, swinging every 15 inputs and dodging every 40. It fails if any client does not see every bot, any bot is dropped (the flood limit must not trip on honest bots), the server has not applied a bot's inputs to within 3 of the last sent, two clients disagree on a bot's position by over 0.5 m, any client gets under 18 patches a second or waits over 200 ms for one, or the server tick strays more than 5% from wall time.
- Measured on loopback, 5 s: 4 bots and 8 bots (the room's maximum) both: 99 inputs each, all applied, clients agree exactly, 20.0 patches a second to every client, worst gap 51 ms, server tick 1.000 of wall time.
- The script's header lists the downs check from Session 7, which it had not.

**Learned**

- Eight players cost the server nothing visible at this size of simulation: the patch cadence is the tick, to the millisecond. The load that will matter is the floor (many enemies) and state sync, not the player count; the stress run is the place to grow that check when the floor lands.
- `tests/clock-sync.ts` has six type errors under the root `tsconfig.json` (narrowing to `never` on line 239). `npm run check` does not typecheck `tests/`, and tsx runs it regardless, so nothing caught it. Left for the Fable session that owns it; the new stress code typechecks clean.

**Next**

- The remaining unblocked Phase 1 items are the ability slots (they change `InputFrame` and lean on weapon styles, which are blocked) and the Goblin Warrens floor. Michael's answers on The Old Gates access and the Revive Draught unblock five more.

## 2026-10-04: Session 8, states and combo payoffs

**What changed**

- `shared/src/states.ts`: the six states from the design doc on a target (`StateSet`), each remembering who applied it. `applyState` applies or refreshes (a refresh extends to a full duration and adds the applier once), `expireStates` drops the old ones each tick, and `resolveHit` takes a hit's damage and tags and returns the final damage, what it consumed, and the payoffs for the caller to carry out. The "Consumed by" column is a table: Soaked by lightning (chain to enemies within 4 m for 60% of the hit) or frost (frozen: rooted and chilled for 2 s); Staggered by backstab or execute (double damage and a 1.2 s knockdown); Burning by oil or wind (spread within 4 m); Rooted by area hits (full multiplier, cannot dodge); Chilled by Shatter (+40). Marked is never consumed: +25% on every hit from anyone.
- The payoff multiplier is 1 + 0.5 per distinct contributor beyond the first (appliers plus the finisher), counted up to 4 (2.5x), so two players setting up and a third finishing is worth 2x what the veteran does alone, and a full room of eight does not one-shot anything. Numbers are `STATES` and `COMBO` in `sim.ts`, first guesses for playtests.
- Wired into the sim already: the goblin carries a `StateSet`, expires it every tick and clears it on death and wipe; the sword hit goes through `resolveHit` (tag "melee", so it only gains from Marked); a Rooted goblin does not move. Nothing applies a state in play yet: that is the abilities item.
- 9 unit tests in `shared/src/states.test.ts` (44 total); `npm run test:net` unchanged and green.

**Learned**

- `sim.ts` imports `states.ts` and `states.ts` reads the tuning from `sim.ts`. That cycle is safe only while `states.ts` touches the constants inside functions, so `STATE_KINDS` is a literal rather than `Object.keys(STATES)`, which would run before `STATES` exists.
- Chain, spread, freeze and knockdown come back as effects rather than being applied, because they need the other enemies and the enemy AI, and there is one goblin. The enemy roster item makes them real.

**Next**

- Three ability slots with Cleave, Arrow rain and Magic missile: they are the first things that apply and consume states. That needs new inputs in `InputFrame`, which changes the wire format the netcode reconciles; the builder will check whether it is a **(Fable)** item before starting.

## 2026-10-04: Session 7, downs, bleed-out and pickup

**What changed**

- `shared/src/sim.ts`: a player at zero health is downed, not dead (design doc, "Downs, revives and wipes"). Tuning is `DOWNS`: a 30 s bleed-out, a 1.2 m/s crawl with no swing or dodge, and a pickup by any standing teammate who stays within 2 m (centre to centre) for 1.5 s without swinging or dodging; walking off breaks the channel and it starts over. Picked-up players stand with 40 hp. Bleeding out is dead for the fight: no timer, back when the room is clear. Felling the goblin stands every downed player up where they lie and brings the dead back at their spawn after the usual 3 s. Nobody standing is a wipe: everyone respawns at their spawn after 3 s and the goblin resets to full health at its post. The goblin ignores the downed and goes for whoever is standing. New: `downPlayer`, `stepDowns`, `isDowned`, `isDead`; events `playerDowned`, `playerPickedUp`, `squadWiped`; `playerDied` now means bled out.
- The pickup is proximity, not a button: it needs no new input, so it works on keyboard, gamepad and a later touch layout alike, and `InputFrame` (the netcode's wire format) is unchanged.
- Server: `stepDowns` runs after the goblin each tick; the schema carries `downedUntil`, `pickupMs`, `pickupBy`. Client: prediction crawls a downed player at the server's speed (the state arrives in `reconcile`); a downed player lies down in their colour, the dead lie dark; a ground ring grows round the downed as the pickup fills; the centre banner shows the bleed-out countdown, the pickup percentage, or "back when the goblin falls".
- Tests: 8 unit tests in `shared/src/downs.test.ts` (crawl, pickup, broken channel, bleed-out without wipe, room clear, wipe once, the goblin's targeting, determinism); 35 total. `npm run test:net` now walks Bravo into the goblin until downed (8.9 s) and Alpha over to pick them up (2.3 s, Bravo at 40 hp). The mobile and hit-feedback e2e tests pass.

**Learned**

- Solo play is unchanged in feel: one player downed is nobody standing, so it wipes at once and respawns in 3 s, as before.
- The first four Phase 1 items and the enemy roster lift code from The Old Gates, and this cloud run is not allowed to clone that repository. They are marked **(design)** with a question for Michael (A: let the builder read it, recommended). The Revive Draught needs an item before the item ledger exists (rule 3), so it is a second question (A: a Phase 1 stand-in counter, recommended).

**Next**

- The state system (Soaked, Staggered, Marked, Burning, Rooted, Chilled) and the three ability slots are the next unblocked items.
- Michael's answers on The Old Gates access and the Revive Draught.

## 2026-10-04: Session 6, clock sync

**What changed**

- `shared/src/clock.ts` (tuned by `CLOCK_SYNC` in `sim.ts`): a pure clock estimator. Every stamped message from the server is a sample `serverTime - recvAt`: the patches (stamped with their tick, 20 a second) and the ping replies (the server's simulation time including the part of the tick elapsed; they also give the HUD its round trip). The largest sample in a 20 s window is the message with the shortest trip from the server, so it is the floor the snapshots can reach, and it is the target. The applied offset slews toward the target at 10 ms/s (a remote player drawn against it runs at most 1% off speed) and snaps only over 250 ms (first sample, a tab that slept). The card asked for the lowest-RTT reply; the shortest *return* trip is the quantity that matters, because the snapshots ride the return path and a quick outbound leg can pick a slow return. 7 unit tests, including a 90 s simulated 150 ms link with jitter and late packets (27 total).
- `server/src/rooms/DungeonRoom.ts`: the tick is locked to wall time. `setInterval(50)` fired every 50-and-a-bit ms, which made simulation time run 0.3 to 1.1% slow (measured as `srv rate` below); any client clock that assumes a second is a second then drifts against it, and the old per-patch EMA was quietly tracking that drift. A self-scheduling timer (`pump`) now runs every tick that is due, catching up at most four, and the patch goes out at the end of `step` with Colyseus's own patch interval off: that interval ran out of phase and sent each snapshot about 49 ms after the tick it carried, which is a whole tick of lag for everyone and would have eaten the interpolation budget once the clock was honest. `ping` is answered with `{ sentAt, serverTime }`.
- `client/src/net.ts`: the clock replaces the patch-offset EMA; `serverNow()` is server time as it reaches us on the least-delayed path and is never mixed with `predictedTime`. Pings go every 250 ms for the first twelve, then once a second. Snapshots carry their arrival time, corrections too big to smooth are counted as `snaps`, and `window.__hg` exposes `minRtt`, `clockOffset` and `snaps`. `Net` no longer touches `window`, so it runs in Node.
- `tests/clock-sync.ts` (`npm run test:clock`): a delay-and-jitter TCP proxy around the real `Net` class. One client walks, the other renders it at 60 Hz, and the run reports the clock's wander and fastest move, where it sits against the best delivery seen, the interpolation margin, held frames, and the driven player's corrections and snaps per minute, at 0, 50 and 150 ms round trips with jitter and 2% late packets. It fails if the clock moves faster than its slew limit, sits ahead of the delivery floor, or a remote player holds on a clean or 50 ms link. The lag lab in `tests/lab/` does not exist yet, so these are the numbers the card asked for; the critic can lift the proxy.
- `CLAUDE.md`: the netcode section describes the wall-locked tick, the patch at the step, and the clock.

Before and after, 30 s per link (the before run is `main` with only the `window` timer change so it runs in Node):

| link | server rate | offset sd (ms) | fastest move (ms/s) | clock vs floor max (ms) | margin p5 (ms) | held frames | corrections/min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 ms, before | 0.996 | 34.9 | 7.2 | +11.3 | 48 | 0% | 0 |
| 0 ms, after | 1.000 | 4.4 | 10.0 | +0.3 | 51 | 0% | 0 |
| 50 ms, before | 0.996 | 39.2 | 9.6 | n/a | 45 | 0% | 0 |
| 50 ms, after | 1.000 | 5.8 | 10.0 | +0.1 | 38 | 0.1% | 0 |
| 150 ms, before | 0.999 | 29.1 | 17.2 | n/a | 34 | 1.7% | 0 |
| 150 ms, after | 1.001 | 23.7 | 10.1 | 0.0 | 13 | 1.3% | 0 |

The "before" clock's position against the floor is not meaningful (the floor is a run-wide maximum and the drifting server clock set it in the first seconds), so only the 0 ms figure, where drift is smallest, is shown. With 5% late packets instead of 2% the before run moved 39 ms/s at 150 ms (4% speed error) and held 2.6% of frames. Corrections and snaps are the prediction side and were not expected to change; they did not.

**Learned**

- The slew limit is now the fastest the clock moves at every link (10.0 ms/s); what remains at 150 ms is the target hopping between the floor and 25 to 40 ms below it as the best sample ages out, in the safe direction. The holds there are the fixed 100 ms budget, not the clock: a snapshot more than 50 ms late holds whatever the clock does. That is a tuning question for Michael (`decisions.md`, Pending).
- A timer per delayed chunk reorders chunks that arrive in the same event-loop turn, because Node starts timers from the loop's millisecond clock while the delays were computed from `performance.now()`. The proxy's first version did that and the WebSocket upgrade failed at 150 ms about half the time, which looked like a server bug for an hour. One queue per direction, drained from the head, fixed it.
- `tests/two-players.e2e.ts` still fails here (Alpha moves 1.2 m, not over 2) as Session 4 recorded; the other four e2e tests pass. The clock did not change the input path.

**Next**

- Michael's answer on the interpolation budget (A fixed 100, B fixed 150, C adaptive; C recommended).
- Extrapolation by up to one tick when a snapshot is late, then reconnect with a grace period.
- The critic's lag lab can start from `tests/clock-sync.ts`'s proxy.

## 2026-10-03: Session 5, hit feedback

**What changed**

- Landing a hit on the goblin slides the camera 0.12 m toward it for 110 ms; taking a hit shoves it 0.32 m away for 180 ms. The eye and the look target move together, so the view slides without tilting. Skipped under `prefers-reduced-motion`. Tuning is `HIT_FEEDBACK` in `shared/src/sim.ts`; the curve (fast out, eased back, peak early so it lands on contact) is `nudgeOffset` in `shared/src/feedback.ts`.
- `client/src/sound.ts`: a bright thwack for hits on the goblin and a low thud for hits on players, synthesised with WebAudio (filtered noise plus a falling tone), no assets. A friend's hits play at 35% volume and give no nudge. Audio starts on the first key, gamepad or touch, as browsers require.
- Presentation only: both are driven by the server's `playerHit` / `enemyHit` events and never touch the sim.
- Tests: 3 unit tests on the nudge curve (20 total). `tests/hit-feedback.e2e.ts` walks to the goblin, trades blows, and checks every hit you land or take nudged exactly once, with no page errors; 12 of 12 passed with the mobile tests over 3 repeats. `playwright.config.ts` now runs one worker, because every e2e test joins the same room.

**Learned**

- Running e2e tests in parallel put them all in one room, so one test counted another's hits. That also explains part of why `two-players.e2e.ts` waits for exactly 2 players.

**Next**

- Phase 0's builder items are done. What is left is **(Fable)** (extrapolation, clock sync, reconnect), **(Michael)** playtests, and the critic's lag lab. Michael answered the gate card "passed" on the control room; the producer records it and moves the phase.

## 2026-10-03: Session 4, mobile sanity check

**What changed**

- `tests/mobile.e2e.ts`: Playwright opens the client on emulated phones (Pixel 7 portrait and landscape, and a 360 x 640 Android) with touch on, and checks that the canvas fills the screen, the scene draws (more than 8 colours in the frame, so WebGL did not fail silently), both top HUD panels are on screen and do not overlap, HP text shows, there is no page scroll, and there are no page errors. All 3 pass.
- It found a real bug: on portrait phones the top-right net panel (ping, unconfirmed, corrections, room) ran about 300 px wide on one line and covered the health bars. `client/index.html` now drops the panels' desktop `min-width` under 600 px, tightens their padding, and caps the right panel at 36vw so the net line wraps. Checked by screenshot at 360 px.
- `playwright.config.ts` takes an optional `PW_CHROMIUM` executable path, so a machine with a preinstalled Chromium (cloud sessions) can run `npm run test:e2e` without `playwright install`.

**Learned**

- The existing `two-players.e2e.ts` fails here before and after this session: Alpha moves 0.3 to 0.6 m in a 700 ms key hold instead of about 4 m, and `bringToFront()` does not fix it. The server never drops the client, so it is not the new rate limit; it looks like headless Chromium throttling the input `setInterval` when two pages are open. CI does not run the e2e tests, so nothing caught it.
- Emulation is not a phone. A real phone over the LAN is still worth one look (GPU, notch, browser chrome), but nothing blocks it now.

**Next**

- Hit feedback: a camera nudge and a sound on `playerHit` and `enemyHit`.
- Someone should look at why the two-page e2e test barely moves.

## 2026-10-03: Session 3, input rate limiting

**What changed**

- `shared/src/sim.ts`: `INPUT_LIMIT` (25 a second refill, 25 burst) and a pure token bucket, `createInputBucket` / `takeInputToken`, timed by a `now` argument like the rest of the sim.
- `DungeonRoom` keeps one bucket per client and counts every `input` message before validation, so garbage costs the same as real frames. An empty bucket drops the client with close code 4001 (`CLOSE_INPUT_FLOOD`).
- 5 new unit tests (17 total): an honest 20 Hz client with ±30 ms jitter for a minute never trips; a one-second stall plus a 20-frame backlog dump passes; 60/s is dropped inside a second; 30/s is dropped only after more than 3 s; identical arrival times give identical results.
- `npm run test:net` adds a third client sending 80 inputs a second: dropped after 36 inputs in 656 ms with code 4001, while the two honest clients stay connected.

**Learned**

- The client sends from a fixed 50 ms `setInterval`, and background tabs only throttle it, never burst it, so 25/s leaves an honest client 5 inputs a second of headroom plus a full second of backlog.

**Next**

- Hit feedback (camera nudge and sound on hits), then the mobile sanity check.

## 2026-10-03: Session 2, the team, the control room and hosting

**What changed**

- Netcode smoke test runs on Windows: node is launched directly with the tsx loader instead of `npx` (a .cmd shim that spawn() cannot exec), and the server cwd comes from `fileURLToPath` (05e828e).
- Hosting on the free tier, all on Render: `render.yaml` runs the server (sleeps after 15 idle minutes) and builds the client as a static site with `VITE_SERVER_URL` baked in. `client/src/main.ts` reads it; `?server=` still overrides. GitHub Pages was the first plan and was dropped when the repo turned out to be private.
- The agent team, mirroring Neighborhood Airsoft: builder (Opus, every 3 h), Fable session (hourly card check), critic (daily, owns the new lag lab), producer (Sonnet, after each builder run, owns the phase gate). Slack #hearthgate (C0C6LQQF8CC). Control room artifact with a phase-and-gate card, a playtest form and a lag-lab table.
- `docs/decisions.md` with the three answers from today; backlog items marked **(Fable)** and **(Michael)**; a `## Found in play (the critic)` section; CLAUDE.md gained Shipping, The team, The room and the non-code files.

**Learned**

- The desktop app's dev-server preview injects `PORT`, and the Colyseus server honours it, so `npm run dev` through the preview tool makes the server steal Vite's port. `.claude/launch.json` (untracked) runs server and client as separate entries instead.
- A cloud routine cannot be created against a repository the account cannot reach; the routines had to wait for the repo to exist.

**Next**

- Michael connects Render to the repo (one click on the blueprint). If Render renames the server, he sets `VITE_SERVER_URL` on the client site to match.
- Then the builder takes rate limiting, hit feedback and the mobile check; the producer proposes the three Fable cards (extrapolation, clock sync, reconnect); the critic builds the lag lab.

## 2026-10-03: Session 1, Phase 0 scaffold

**What changed**

- New repo. Three npm workspaces: `shared` (deterministic simulation), `server` (Colyseus 0.16 room), `client` (Vite, Three.js, colyseus.js).
- Shared sim: player movement, dodge with i-frames, committed attack with a windup, cone hit test, goblin AI (idle, chase, windup, recover, dead, respawn), player death and respawn. 12 unit tests, including a determinism test.
- Server: `DungeonRoom` steps the sim at 20 Hz, applies at most two queued inputs per player per tick, validates input shape, broadcasts combat events, syncs plain sim objects into schema. Health endpoint.
- Client: prediction with rewind-and-replay reconciliation and a decaying visual error offset; remote players and the goblin interpolated 100 ms behind the server; keyboard and gamepad input; raised third-person follow camera; attack arc flash and a growing red telegraph for the goblin's swing; corner HUD with HP bars, party count, ping, unconfirmed inputs, corrections, and an event log.
- Tests: `npm run test:net` boots the server and joins two headless clients, drives one, and checks the other sees it move and the goblin aggroes. Playwright two-page e2e test written (needs `npx playwright install chromium` locally). CI runs typecheck, unit tests, netcode smoke and the client build.

**Learned**

- `@colyseus/schema` v3 decorators require `useDefineForClassFields: false` in tsconfig. With define semantics the class field initialisers overwrite the decorator's accessors and the encoder crashes with `Cannot read properties of undefined (reading 'Symbol(Symbol.metadata)')`.
- `tsx` only applies a tsconfig to files that tsconfig `include`s, so the server must be launched from `server/` (or with `--tsconfig server/tsconfig.json`) for `experimentalDecorators` to apply.
- Iterating a `Map` with `for...of` yields entries, not values. Caught by the enemy-targeting tests.

**Next**

- Local two-tab playtest, then a remote one with a friend over a tunnel. See the backlog.
