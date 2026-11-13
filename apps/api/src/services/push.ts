import { eq } from 'drizzle-orm';
import { createRequire } from 'node:module';
import type WebPush from 'web-push';
import type { Db } from '../db';
import { pushSubscriptions } from '../db/schema';
import type { Env } from '../env';

// web-push est un module CommonJS : chargement explicite, identique sous tsx, vitest et le bundle de production.
const webpush = createRequire(import.meta.url)('web-push') as typeof WebPush;

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface PushPayload {
  title: string;
  body: string;
  id?: string;
  unread: number;
  tag?: string;
}
/** Retourne le code HTTP du service push (201 = envoyé, 404/410 = abonnement expiré). */
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<number>;

export function createPushSender(env: Env): PushSender {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return async (target, payload) => {
    try {
      const r = await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: 'high' },
      );
      return r.statusCode;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (typeof code === 'number') return code;
      throw e;
    }
  };
}

export interface PushLogger {
  warn(obj: object, msg: string): void;
}

/** Envoie à tous les appareils abonnés et supprime ceux dont l'abonnement a expiré (404/410). */
export async function broadcastPush(
  db: Db,
  send: PushSender,
  payload: PushPayload,
  log: PushLogger,
): Promise<{ sent: number; removed: number }> {
  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        const code = await send(s, payload);
        if (code === 404 || code === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
          removed++;
        } else if (code >= 200 && code < 300) sent++;
        else log.warn({ code, device: s.id }, 'Service push : réponse inattendue');
      } catch (e) {
        log.warn({ err: (e as Error).message, device: s.id }, 'Service push injoignable');
      }
    }),
  );
  return { sent, removed };
}
