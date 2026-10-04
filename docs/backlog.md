# Backlog

Ordered. Top item is next. Move finished items to the devlog, not to a "done" list here.

Marks: **(Fable)** is a cross-cutting item for the Fable session (the builder skips it); **(Michael)** needs a human; **(design)** needs an answer in `decisions.md` first. Items with no mark are the builder's.

## Phase 0: netcode spike (passed 3 Oct 2026; open items carry over)

Gate: two people on different networks fight the goblin together and both say it feels responsive. Michael called it passed on the two-tab local playtest. The unchecked items below, including the Fable netcode ones, stay open as carry-over; the builder never takes the Phase 0 (Michael) ones.

- [ ] **(Michael)** First local playtest: two tabs on one machine. Note anything that feels off in `playtest-notes.md`.
- [ ] **(Michael)** Remote playtest with one friend on the hosted build (see README). Record ping, corrections count from the HUD, and the gate answers.
- [ ] **(Fable)** Extrapolate remote players by up to one tick when a snapshot is late, so a stuttering connection does not freeze them.
- [x] **(Fable)** Clock sync: replace the "latest patch" offset with a min-RTT based estimate so interpolation delay stays constant under jitter. (Session 6: every stamped message is a sample, the shortest trip sets the clock, 10 ms/s slew; the server tick is now locked to wall time and patches leave at the step)
- [ ] **(Fable)** **(design)** Interpolation budget: keep `INTERP_DELAY_MS` at a fixed 100 ms, raise it, or adapt it to the measured jitter. Session 6 measured 1.3% held frames on a 150 ms link with 25 ms jitter; see `decisions.md`.
- [x] Input rate limiting on the server: drop clients that send more than 25 inputs a second sustained. (Session 3)
- [ ] **(Fable)** Reconnect: `room.reconnect` with a grace period so a dropped tab rejoins the same player instead of spawning a new one.
- [x] Mobile sanity check: open the client on a phone over the LAN. It should render and show the HUD even though there is no touch input yet. (Session 4: emulated phones in `tests/mobile.e2e.ts`; the top HUD panels overlapped on portrait and are fixed)
- [x] Hit feedback: a short camera nudge and a sound on `playerHit` and `enemyHit` (readability is part of "feels responsive"). (Session 5)
- [ ] Lag lab: a latency, jitter and packet-loss shim for the bot harness in `tests/lab/`, reporting corrections and snaps per minute at 0, 50 and 150 ms. The critic owns it and runs it every day.

## Phase 1: combat slice (current)

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

## Found in play (the critic)

Confirmed bugs from headless play and the lag lab, one line each with the commit and the steps. The builder takes these before new work in the current phase.

(none yet)

## Later phases

See the design doc Milestones section: village and loop, regions and trade, first playable, touch layout.
