import type pg from 'pg';
import { createDb, type Db } from './db';
import type { Env } from './env';
import { createMailer, type Mailer } from './services/mail';
import { createPushSender, type PushSender } from './services/push';
import { Realtime } from './services/realtime';
import { createStorage, type Storage } from './services/storage';

export interface Deps {
  env: Env;
  db: Db;
  pool: pg.Pool;
  mailer: Mailer;
  storage: Storage;
  push: PushSender;
  /** Vérifie le jeton anti-robot côté serveur. */
  verifyTurnstile: (token: string, ip: string) => Promise<boolean>;
  realtime: Realtime;
}

export function createTurnstileVerifier(env: Env) {
  return async (token: string, ip: string): Promise<boolean> => {
    try {
      const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip });
      const r = await fetch(env.TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return false;
      const j = (await r.json()) as { success?: boolean };
      return j.success === true;
    } catch {
      return false;
    }
  };
}

export function createDeps(env: Env): Deps {
  const { db, pool } = createDb(env.DATABASE_URL);
  return {
    env,
    db,
    pool,
    mailer: createMailer(env),
    storage: createStorage(env),
    push: createPushSender(env),
    verifyTurnstile: createTurnstileVerifier(env),
    realtime: new Realtime(),
  };
}
