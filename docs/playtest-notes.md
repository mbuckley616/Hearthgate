# Playtest notes

One entry per session. Keep the gate questions verbatim so answers are comparable over time.

## Template

```
## YYYY-MM-DD: <who played>, <connection types, e.g. "host on fibre, friend on hotel wifi">

Ping (HUD): host __ ms, friend __ ms
Corrections (HUD, after 5 minutes): host __, friend __
Session length: __ min

Gate questions
1. Does your own movement feel instant? (yes / mostly / no, and what felt late)
2. Do hits land where they look like they land, for you and for the other player?
3. Did anything teleport, rubber-band, or freeze? When?

Other notes
- 

Decisions
- 
```

## Sessions

## 2026-10-03: Michael, two tabs on one machine (local, no real network)

Ping (HUD): host 13 ms, friend 15 ms
Corrections (HUD, after 5 minutes): host 0, friend not recorded
Session length: 5 min

Gate questions
1. Does your own movement feel instant? (yes / mostly / no, and what felt late) — Yes, pretty instant.
2. Do hits land where they look like they land, for you and for the other player? — Yes!
3. Did anything teleport, rubber-band, or freeze? When? — No, both looked fairly smooth.

Other notes
- Everything worked fairly well. Michael only wanted to confirm that multiple users can share a session; he is not concerned about testing with other people or machines yet.
- This was local, so it does not meet the gate's "different networks" condition.

Decisions
- Gate: passed (2026-10-03). Michael called it on the control room: option A, on to Phase 1. The remaining Phase 0 backlog items (the Fable netcode items) stay open as carry-over.

## 2026-10-04: the lag lab against the hosted build (two headless Chromium clients on Michael's desktop in Central US, to the Render server over the public internet; no human)

Ping (HUD): host 19 ms, friend 19 ms (both clients on the same desktop; the server is on Render)
Corrections (HUD, after 5 minutes): host 1 (0.2 a minute), friend not driven
Session length: 5 min (plus a 1 min run first: 0 corrections, 0 snaps, 1 hold a minute)

Gate questions
1. Does your own movement feel instant? (yes / mostly / no, and what felt late) — Measured, not felt: 1 reconciliation correction in 5 minutes of continuous driven movement, 0 snaps, so the predicted player was where the server put it the whole time.
2. Do hits land where they look like they land, for you and for the other player? — Not judged by this run (no human eyes); the hit tests in `npm run test:net` cover the mechanism. Alpha was downed once by the goblin, as expected from standing in its reach.
3. Did anything teleport, rubber-band, or freeze? When? — No: 0 snaps and 0 holds a minute (Bravo's view of Alpha never froze while Alpha moved); Bravo drew Alpha 105 ms behind, 0.45 m mean gap at speed.

Other notes
- Run with `npm run lab -- --server wss://hearthgate-8lrq.onrender.com --client https://hearthgate-client.onrender.com --seconds 300` (Session 15 added the hosted mode to the critic's lab). Hosted build at main c064e1a. Verdict "ok" by the lab's rule (snaps 0, under 30 corrections and 20 holds a minute).
- This is the machine stand-in for the "two people on different networks" test: a real network between browser and server, but one machine and no second person, so the 19 ms ping is a best case (Render is near).

Decisions
- Michael, 2026-10-04 (in chat): no friend on another network is available and it would stay a blocker, so the human remote playtest is dropped; this run and the critic's daily lab stand in for it. The gate was already passed on 2026-10-03.

## 2026-10-27: T3, T4 and T4b gates (the village and portal, generated dungeons, the dungeon editor): Michael on the hosted build

Played on the hosted build after #71 and #72 merged (main b9811c5). Who else joined and over what connection was not said.
Ping (HUD): not recorded (the slice's HUD has no ping readout)
Corrections (HUD, after 5 minutes): not recorded
Session length: not recorded

Gate questions
1. Does your own movement feel instant? (yes / mostly / no, and what felt late) — Not answered one by one. Michael, in chat: "Playtest of T3, T4, and T4b is cleared - everything looks good for the most part."
2. Do hits land where they look like they land, for you and for the other player? — As above.
3. Did anything teleport, rubber-band, or freeze? When? — As above.

The steps' own gates (slice-transplant-plan.md)
- T3: village to dungeon and back, nobody stranded, the village belongs to the slice — passed.
- T4: five floors from five seeds, each a different shape with a climb or drop, none broken, readable, the minimap showing where you are — passed (his screenshots of the five, earlier the same day: "as expected").
- T4b: lay out a dungeon by hand and save one the portal can offer — passed ("creating a dungeon works great").

Other notes
- The editor makes one floor; going deeper from its rest room goes on into generated floors. Not wrong, he said, but a hand-built dungeon should be able to have several floors of its own, shown as tabs or similar. Taken up straight away (auto/local-t4-followups).
- The ability squares and the weapon chips overlapped at the bottom of the screen (his screenshot). A regression from T4b: the built game loaded the theme before the base styles. Fixed the same day (auto/local-t4-followups).

Decisions
- Gates: T3, T4 and T4b passed (2026-10-27). T5 (party rules and the Phase 1 gate) is next; its answers are in decisions.md.

## 2026-10-27: T1 gate (the combat slice on the server): Michael solo on the hosted build, and the lag lab against it for two players

Half 1: Michael, solo, side by side with the combat slice on his desktop, on the hosted build (main 9b6c0f2).
Ping (HUD): not recorded (the slice's HUD has no ping readout)
Corrections (HUD, after 5 minutes): not recorded (the slice's HUD has no counter)
Session length: not recorded

Gate questions
1. Does your own movement feel instant? (yes / mostly / no, and what felt late) — Not answered one by one. Michael, in chat: "Gameplay looks good."
2. Do hits land where they look like they land, for you and for the other player? — As above.
3. Did anything teleport, rubber-band, or freeze? When? — As above.

Half 2: the lag lab against the hosted build, two headless Chromium clients on Michael's desktop (Central US) to the Render server over the public internet, GPU rendering at 60 fps; no human. `npm run lab -- --server wss://hearthgate-8lrq.onrender.com --client https://hearthgate-client.onrender.com --seconds 300`, main's lab at 9b6c0f2.
Ping (HUD): not shown by the slice's HUD; inputs in flight averaged 79 ms (round trip plus the server's two-tick cushion)
Corrections (lab, 5 minutes): Alpha 350 over 2 cm (70 a minute); Bravo not driven
Session length: 5 min

Gate questions
1. Does your own movement feel instant? (yes / mostly / no, and what felt late) — Measured, not felt: 70 corrections a minute over 2 cm, eased over 120 ms. They come from Alpha's own swings (lunge and soft-target turn predicted against the last snapshot's enemy), which Michael chose to keep (decisions.md, 27 Oct, A).
2. Do hits land where they look like they land, for you and for the other player? — Not judged by this run (no human eyes). Alpha was downed 4 times and revived by Bravo.
3. Did anything teleport, rubber-band, or freeze? When? — No network snap: 0. The 12 the lab saw were all placements by the server itself (the gate bringing a straggler in, a restart). Bravo's view of Alpha held still 2.8 times a minute; Bravo drew Alpha 125 ms behind, 0.08 m mean gap.

Other notes
- The lab pair started 13 runs in 5 minutes and finished none: Bravo only stands and revives, so the two lose each run and restart it. This covers "no snap" over five minutes of fighting, not "two players through a whole run", which needs two people or a bot that fights.
- 0 page errors on either client.
- A second run the same day, with the lab's Bravo made to fight (it faces the nearest enemy, closes in and swings, and still revives; PR #68's lab against the hosted build): 5 minutes, 0 network snaps (7 placements), 54 corrections a minute over 2 cm, 0.6 holds a minute, 0 page errors. 8 runs started, none won: Bravo charges in and goes down, then Alpha. The bots cannot finish a run, so "two players through a whole run" needs two people.

Decisions
- Gate: passed on Michael's solo play (2026-10-27, "Feels good"). The two-player run and lag testing wait: he wants content first (decisions.md, 27 Oct).
