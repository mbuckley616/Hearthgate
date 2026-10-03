# Backlog

Ordered. Top item is next. Move finished items to the devlog, not to a "done" list here.

## Phase 0: netcode spike (current)

Gate: two people on different networks fight the goblin together and both say it feels responsive.

- [ ] First local playtest: two tabs on one machine. Note anything that feels off in `playtest-notes.md`.
- [ ] Remote playtest with one friend over a tunnel (see README). Record ping, corrections count from the HUD, and the gate answers.
- [ ] Extrapolate remote players by up to one tick when a snapshot is late, so a stuttering connection does not freeze them.
- [ ] Clock sync: replace the "latest patch" offset with a min-RTT based estimate so interpolation delay stays constant under jitter.
- [ ] Input rate limiting on the server: drop clients that send more than 25 inputs a second sustained.
- [ ] Reconnect: `room.reconnect` with a grace period so a dropped tab rejoins the same player instead of spawning a new one.
- [ ] Mobile sanity check: open the client on a phone over the LAN. It should render and show the HUD even though there is no touch input yet.
- [ ] Hit feedback: a short camera nudge and a sound on `playerHit` and `enemyHit` (readability is part of "feels responsive").

## Phase 1: combat slice (next)

Gate: a mixed-level party clears a Goblin Warrens floor and the combo bonus is visible.

- [ ] Lift the gear and weapon definitions from The Old Gates into `shared/src/gear.ts`, re-tuned for tier caps.
- [ ] Weapon classes: sword (current), two-handed, bow with lock-on. Style = Melee / Ranged / Magic from the weapon.
- [ ] Posture, parry window, block from The Old Gates, simplified for crowds.
- [ ] State system: Soaked, Staggered, Marked, Burning, Rooted, Chilled, with combo payoffs that scale by distinct contributors.
- [ ] Three ability slots per player; first ability per style: Cleave, Arrow rain, Magic missile.
- [ ] Downs with a bleed-out timer, free pickup, Revive Draught consumable.
- [ ] Enemy roster from The Old Gates: Charger, Pack Leader, Shieldbearer; goblin packs.
- [ ] One hand-built Goblin Warrens floor assembled from rooms; a floor objective; stairs.
- [ ] Four-player stress test with the bot harness (`tests/netcode-smoke.ts` extended to N clients).

## Later phases

See the design doc Milestones section: village and loop, regions and trade, first playable, touch layout.
