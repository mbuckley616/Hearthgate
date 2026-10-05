# The Old Gates, reference copies

Read-only copies of the files the Phase 1 lift items draw on, taken from
`mbuckley616/The-Old-Gates` at commit `a129d39` (4 Oct 2026, after Session 484 split the
game into 41 files). They are here because the cloud builder cannot clone that repo
(decisions.md, "The builder cannot read The Old Gates": Michael chose A, letting the routine
read it, and the clone was still refused on the next run, so this is the fallback B applied
by Michael's local session on 4 Oct 2026). Nothing here is built or imported; it is source
material. When The Old Gates changes, the lift does not follow it: these are a snapshot.

The Old Gates runs entirely in one browser; its combat reads globals (`px`, `pz`, `EQ`,
`ATTRS`), `performance.now()` and `Math.random()`. A lift into `shared/` keeps the numbers
and the rules, and rewrites the mechanism to take state and a `now` argument (CLAUDE.md,
rule 2).

| File | What it holds | Phase 1 item |
| --- | --- | --- |
| `14-items.js` | `MATERIALS` (10 tiers), `WEAPON_TYPES` (dagger to war hammer, with `atkMult`, `twoHand`, `cleaveTargets`, `postureMult`, `blockReduce`), `TIER_BASE_ATK`, `TIER_BASE_DEF`, `TIER_BLOCK`, `WEAPON_ENCHANTS`, `ARMOR_ENCHANTS`, `makeItem` (line 492) | Gear and weapon definitions; weapon classes |
| `10-player.js` | The player's posture (`PPOST`, line 319: 100 + 2 per armour point, 0.8 s stagger), the parry window (`PARRY_WINDOW_BASE` 200 ms, line 450), posture tuning (`POSTURE_*`, line 534), riposte and finisher (`RIPOSTE_*`, line 544), bash, block reduction tiers (`BLOCK_REDUCE_NO_SHIELD`, line 577), backstab, enemy posture (`POSTURE_FAMILY_MULT`, `initPosture`, `applyPostureDamage`, `tickPostureRegen`, lines 1105 to 1200) | Posture, parry window, block |
| `74-strikes.js` | `applyMeleeDamage` (line 30: resist, staggered crit, backstab, flat def), `executeStrike` (line 84: the enemy's blow against a perfect parry, a held block or nothing), strike arcs (line 71), enemy variants | Posture, parry window, block; enemy roster |
| `62-actions.js` | `attack` (line 64: weight-scaled swing and cooldown, stamina), `_resolveDungeonStrike` (cleave cap, power-vs-shield, Shieldbearer frontal block), `doBash`, `fireArrow` (line 232) | Weapon classes; posture, parry, block |
| `56-dungeon-build.enemy-defs.excerpt.js` | The dungeon enemy table: Goblin, Skeleton, Cave Troll, Shieldbearer (`shieldUp`), Kobold Thief (`canFlee`), and the rest, with hp, speed, `dmgMult`, def and resists | Enemy roster |
| `42-zone-enemies.defs.excerpt.js`, `42-zone-enemies.tick.excerpt.js` | The open-world foe table (Bandit, Bandit Archer, Bandit Captain) and the first part of their tick: aggro, `alertPack`, the telegraph | Enemy roster |

**On the roster.** Only the Shieldbearer exists in The Old Gates code (frontal block until a
power attack or a flank breaks it). The Charger and the Pack Leader were designed there
(devlog: "Charger (rush + knockback), Pack Leader (buffs nearby enemies)") and never built;
the closest built mechanic to a Charger is the lair beast's charge (every 7 s from 5 to 16 units
at four times its speed, double damage, throws the player three units). The Hearthgate roster
item builds those two from the design doc and this note, not from a lift.
