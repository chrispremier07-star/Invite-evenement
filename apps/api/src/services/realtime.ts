import type { ServerResponse } from 'node:http';
import type { RealtimeEvent } from '@cree/shared';

/**
 * Diffusion temps réel (Server-Sent Events) vers les Studios ouverts.
 * Instance unique : si l'API est répliquée, il faut un bus partagé (voir README, « Mise à l'échelle »).
 */
export class Realtime {
  private clients = new Set<ServerResponse>();
  private seq = 0;
  private timer: NodeJS.Timeout | null = null;

  add(res: ServerResponse): void {
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
    if (!this.timer) {
      this.timer = setInterval(() => {
        for (const c of this.clients) c.write(': ping\n\n');
      }, 25_000);
      this.timer.unref();
    }
  }

  publish(event: RealtimeEvent): void {
    const frame = `id: ${++this.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const c of this.clients) c.write(frame);
  }

  get size(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    for (const c of this.clients) c.end();
    this.clients.clear();
  }
}
