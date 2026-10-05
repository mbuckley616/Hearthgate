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
