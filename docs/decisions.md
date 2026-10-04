# Decisions

Questions for Michael and his answers. Nothing is a spec without a `Michael:` line.
Agents write questions under **Pending** with lettered options and a recommendation; the
producer carries them to Michael (Slack #hearthgate or the control room) and writes the
answer here. Answered entries override the backlog.

## Pending

(none)

## Answered

### 2026-10-04: Interpolation budget now that the clock holds still (Fable, Session 6)
Remote players and the goblin are drawn `INTERP_DELAY_MS` (100 ms) behind the client's server clock. Session 6 made that clock sit on the best delivery the network gives and move no faster than 10 ms/s, so the 100 ms is now exactly the budget a late snapshot has: one that arrives more than about 50 ms late (the budget less one tick) holds the remote player in place until the next one. Measured with `npm run test:clock` (30 s per link): on a 0 ms and a 50 ms link, no holds; on a 150 ms link with 25 ms jitter and 2% of packets 80 ms late, 1.3% of frames held, 18 holds a minute. Before this session the drifting clock happened to sit 50 to 70 ms late on average, which hid some of this by adding lag nobody chose.
A. Keep 100 ms fixed: least lag; a bad link stutters.
B. Raise it to 150 ms fixed: one more tick of lag for everyone; a bad link rarely holds.
C. Adapt it: 100 ms plus the jitter spread the clock window already measures, capped at 200 ms, slewed like the clock. Clean links keep 100 ms; bad links get what they need. **Recommended.** The extrapolation item (next on the Fable list) covers what remains.
This does not block the clock-sync PR; it is the next Fable item if C or B.
Michael: **C, adapt it: 100 ms plus measured jitter, cap 200** (2026-10-04)

### 2026-10-03: Phase 0 gate: call it passed?
The two-tab local playtest answered yes, yes, no; the gate asks for different networks. The producer recommended B (one more playtest first).
Michael: **A, passed, on to Phase 1**. (2026-10-03)

### 2026-10-03: Hosting for remote playtests
A tunnel by hand (free, only while Michael is present) or a free-tier host deployed from main.
Michael: free tier. Render (server) plus GitHub Pages (client), deployed on every push to main.

### 2026-10-03: Builder cadence
Michael: every 3 hours, every day. He is leaning towards buying more usage.

### 2026-10-03: Team channel
Michael: create #hearthgate (C0C6LQQF8CC) in the Bunratty Game Studios workspace.
