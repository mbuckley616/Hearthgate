import { tuning } from '@hearthgate/shared/config/tuning';
import type { LevelKind } from '@hearthgate/shared/net/protocol';
import { Client, type Room } from 'colyseus.js';

/** The Colyseus message type every message travels under (server/src/rooms/HostRoom.ts). */
const MSG = 'm';
/** A seat the server reserved and nobody took is given up after this long; the village is the fallback. */
const SEAT_TIMEOUT_MS = 8000;

/**
 * What the link can tell us: the slice's relay events, the ones a joiner heard. A joined room
 * reports its four-letter code and what it runs; the server is the only other end, so messages
 * come from peer 0.
 */
export type LinkEvent =
  | { t: 'joined'; code: string; kind: LevelKind }
  | { t: 'error'; reason: string }
  | { t: 'msg'; d: unknown }
  | { t: 'closed' };

/**
 * A hosted client bakes its server in at build time (VITE_SERVER_URL); a dev client talks to the
 * same host on 2567. `?server=` overrides either.
 */
export function serverUrl(): string {
  const param = new URLSearchParams(location.search).get('server');
  if (param) return param;
  const baked = import.meta.env.VITE_SERVER_URL as string | undefined;
  return baked || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;
}

/** What a room runs, from the name the server registered it under. */
function kindOf(room: Room): LevelKind {
  return room.name === 'dungeon' ? 'arena' : 'village';
}

/**
 * The slice's RelayClient, pointed at Hearthgate's server: one Colyseus room at a time, a village
 * of our own (create), a friend's room by its code (joinById), or the next room a portal leads to
 * (a seat the server reserved, handoff). `coop.fakeLatencyMs` delays every message this browser
 * sends and every one it receives, so one tab sees the round trip the slice's two tabs made with
 * the setting on in both.
 */
export class ServerLink {
  private room: Room | null = null;
  private handlers: ((ev: LinkEvent) => void)[] = [];
  private client: Client;

  constructor(url?: string) {
    this.client = new Client(url ?? serverUrl());
  }

  onEvent(fn: (ev: LinkEvent) => void): void {
    this.handlers.push(fn);
  }

  get open(): boolean {
    return this.room !== null && this.room.connection.isOpen;
  }

  /** Join a friend's room by code, or start one of our own when there is none: a village (Play), or a dungeon run straight away (the tests and the lab). */
  async join(code: string | null, create: 'village' | 'dungeon' = 'village'): Promise<void> {
    try {
      this.attach(code ? await this.client.joinById(code) : await this.client.create(create));
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.emit({ t: 'error', reason: code && /not found|locked|full/i.test(text) ? 'No game with that code, or it is full' : `Could not reach the server (${text})` });
    }
  }

  /**
   * Follow the party through a portal: leave this room (without waiting for it to answer) and take
   * the seat the server reserved in the next. A seat that is refused or never answers lands us in
   * a village of our own instead, so a hand-off can never leave us with no room.
   */
  async handoff(reservation: unknown): Promise<void> {
    const old = this.room;
    this.room = null;
    void old?.leave();
    let gaveUp = false;
    try {
      const seat = this.client.consumeSeatReservation(reservation as Parameters<Client['consumeSeatReservation']>[0]);
      // A seat that answers after we gave up on it is left at once.
      seat.then((r) => gaveUp && void r.leave(), () => {});
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('the seat never answered')), SEAT_TIMEOUT_MS));
      this.attach(await Promise.race([seat, timeout]));
    } catch (err) {
      gaveUp = true;
      console.warn('[link] hand-off seat failed; starting a village', err);
      await this.join(null);
    }
  }

  send(d: unknown): void {
    this.later(() => {
      if (this.open) this.room!.send(MSG, d);
    });
  }

  close(): void {
    void this.room?.leave();
  }

  private attach(room: Room): void {
    this.room = room;
    room.onMessage(MSG, (d: unknown) => this.later(() => this.room === room && this.emit({ t: 'msg', d })));
    // Leaving the old room on a hand-off is not the connection closing.
    room.onLeave(() => this.later(() => this.room === room && this.emit({ t: 'closed' })));
    this.emit({ t: 'joined', code: room.roomId, kind: kindOf(room) });
  }

  private later(fn: () => void): void {
    const delay = tuning.coop.fakeLatencyMs;
    if (delay > 0) setTimeout(fn, delay);
    else fn();
  }

  private emit(ev: LinkEvent): void {
    for (const h of this.handlers) h(ev);
  }
}
