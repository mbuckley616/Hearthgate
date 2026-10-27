import { tuning } from '@hearthgate/shared/config/tuning';
import { Client, type Room } from 'colyseus.js';

/** The Colyseus message type every message travels under (server/src/rooms/FightRoom.ts). */
const MSG = 'm';

/**
 * What the link can tell us: the slice's relay events, the ones a joiner heard. A joined room
 * reports its four-letter code; the server is the only other end, so messages come from peer 0.
 */
export type LinkEvent =
  | { t: 'joined'; code: string }
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

/**
 * The slice's RelayClient, pointed at Hearthgate's server: one Colyseus room, a fight of our own
 * (create) or a friend's by its code (joinById). `coop.fakeLatencyMs` delays every message this
 * browser sends and every one it receives, so one tab sees the round trip the slice's two tabs
 * made with the setting on in both.
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

  /** Join a friend's fight by code, or start one of our own when there is none. */
  async join(code: string | null): Promise<void> {
    try {
      const room = code ? await this.client.joinById(code) : await this.client.create('fight');
      this.room = room;
      room.onMessage(MSG, (d: unknown) => this.later(() => this.emit({ t: 'msg', d })));
      room.onLeave(() => this.later(() => this.emit({ t: 'closed' })));
      this.emit({ t: 'joined', code: room.roomId });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.emit({ t: 'error', reason: code && /not found|locked|full/i.test(text) ? 'No game with that code, or it is full' : `Could not reach the server (${text})` });
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

  private later(fn: () => void): void {
    const delay = tuning.coop.fakeLatencyMs;
    if (delay > 0) setTimeout(fn, delay);
    else fn();
  }

  private emit(ev: LinkEvent): void {
    for (const h of this.handlers) h(ev);
  }
}
