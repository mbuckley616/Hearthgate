/**
 * The lag lab's link: a TCP proxy that sits between a browser and the game server and adds
 * one-way delay, jitter and loss in both directions. Owned by the critic.
 *
 * It works on TCP chunks rather than WebSocket messages because that is what a real link
 * does to a WebSocket: nothing is ever dropped, it arrives late. Loss is therefore modelled
 * as TCP models it: a lost segment is retransmitted after `rtoMs` (Linux's minimum RTO is
 * 200 ms), and because TCP delivers in order, everything behind it waits too (head-of-line
 * blocking). Dropping a whole Colyseus patch instead would corrupt the client's decoder,
 * which no real network can do.
 *
 * One queue per direction, drained from the head (the lesson from tests/clock-sync.ts: a
 * timer per chunk reorders chunks that arrive in the same event-loop turn and breaks the
 * WebSocket upgrade). Jitter and loss come from a seeded PRNG so every run sees the same
 * sequence for the same traffic.
 */
import net from "node:net";

export interface Link {
  /** Added each way, so the round trip grows by twice this. */
  oneWayMs: number;
  /** Uniform plus-or-minus per chunk. Order is kept, so jitter shows as bunching, not reordering. */
  jitterMs: number;
  /** Share of chunks lost and retransmitted. */
  loss: number;
  /** Retransmission delay for a lost chunk. */
  rtoMs?: number;
}

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LabProxy {
  server: net.Server;
  /** Chunks that took the retransmission path, both directions. */
  lost: () => number;
  close: () => Promise<void>;
}

export function startProxy(listenPort: number, targetPort: number, link: Link, seed = 42): Promise<LabProxy> {
  const rng = mulberry32(seed);
  const rto = link.rtoMs ?? 200;
  let lost = 0;
  const sockets = new Set<net.Socket>();

  const server = net.createServer((down) => {
    const up = net.connect(targetPort, "127.0.0.1");
    // Without this Nagle holds small writes for an ACK and adds tens of ms the link never asked for.
    down.setNoDelay(true);
    up.setNoDelay(true);
    sockets.add(down);
    sockets.add(up);
    const relay = (from: net.Socket, to: net.Socket) => {
      const queue: { due: number; chunk: Buffer }[] = [];
      let timer: ReturnType<typeof setTimeout> | null = null;
      let closeAfterDrain = false;
      const pump = () => {
        timer = null;
        const now = performance.now();
        while (queue.length && queue[0].due <= now + 0.5) {
          const { chunk } = queue.shift()!;
          if (!to.destroyed) to.write(chunk);
        }
        if (queue.length) timer = setTimeout(pump, Math.max(1, Math.ceil(queue[0].due - now)));
        else if (closeAfterDrain) to.destroy();
      };
      from.on("data", (chunk: Buffer) => {
        let delay = Math.max(0, link.oneWayMs + (rng() * 2 - 1) * link.jitterMs);
        if (link.loss > 0 && rng() < link.loss) {
          delay += rto;
          lost++;
        }
        const last = queue.length ? queue[queue.length - 1].due : 0;
        queue.push({ due: Math.max(last, performance.now() + delay), chunk });
        if (!timer) pump();
      });
      from.on("close", () => {
        closeAfterDrain = true;
        if (!timer) pump();
      });
      from.on("error", () => to.destroy());
    };
    relay(down, up);
    relay(up, down);
    down.on("close", () => sockets.delete(down));
    up.on("close", () => sockets.delete(up));
  });

  return new Promise((resolve) => {
    server.listen(listenPort, "127.0.0.1", () =>
      resolve({
        server,
        lost: () => lost,
        close: () =>
          new Promise<void>((r) => {
            for (const s of sockets) s.destroy();
            server.close(() => r());
          })
      })
    );
  });
}
