# Hearthgate's shelf

Read-only copies of three of Hearthgate's own modules, taken off the build when the combat slice moved over whole (T1, 27 Oct 2026, `docs/slice-transplant-plan.md`). They imported the old `shared/src/sim.ts` and `level.ts`, which went with the old fight, so they cannot stay compiled; they are kept here because the plan names them as coming back.

| File | What it is | When it returns |
| --- | --- | --- |
| `clock.ts` | Server-clock estimation from every stamped message (the shortest-trip sample in a 20 s window, slewed at 10 ms/s) and the adaptive interpolation delay. | T2, if the lab shows the slice's simple offset tracking drifting or its fixed 80 ms delay holding remote players. |
| `interp.ts` | Projection of a late snapshot along its last patch of motion, held at walls, eased back when the snapshot lands. | T2, if the lab shows remote heroes or enemies stalling on late snapshots. |
| `gear.ts` | The Old Gates' materials, tiers and weapon types, re-tuned for tier caps. | Phase 3, for the portal's tier caps and the item ledger; the slice's gear runs the game until then. |

Each needs its imports re-pointed (the constants it took from `sim.ts`: `CLOCK_SYNC`, `INTERP`, `PATCH_MS`, `GEAR`; `collideWalls` from `level.ts`) before it compiles again. Their tests are in git history at 1f4e3e9 (`shared/src/clock.test.ts`, `interp.test.ts`, `gear.test.ts`, `weapons.test.ts`).

The room hand-off (`SimRoom.handOffParty` and `Net.handoff`) is in the same commit's `server/src/rooms/SimRoom.ts` and `client/src/net.ts`, for T3.
