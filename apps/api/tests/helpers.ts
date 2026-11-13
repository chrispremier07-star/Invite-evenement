import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
import { buildApp } from '../src/app';
import { createDb } from '../src/db';
import { runMigrations } from '../src/db/migrate';
import { createDeps, type Deps } from '../src/deps';
import { loadEnv, type Env } from '../src/env';
import { bootstrap } from '../src/services/core';
import type { PushSender } from '../src/services/push';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'));
} catch {
  /* les variables peuvent venir de l'environnement (CI) */
}

export const mailpit = `http://localhost:${process.env.MAILPIT_PORT}`;

/** Recrée une base de test vide, applique les migrations et renvoie l'environnement associé. */
export async function freshDatabase(name: string): Promise<string> {
  const base = process.env.TEST_DATABASE_URL!;
  const admin = new pg.Client({ connectionString: base.replace(/\/[^/]+$/, '/postgres') });
  await admin.connect();
  const dbName = `cree_test_${name}`;
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
  await admin.end();
  const url = base.replace(/\/[^/]+$/, `/${dbName}`);
  const { db, pool } = createDb(url);
  await runMigrations(db);
  await pool.end();
  return url;
}

export interface TestCtx {
  app: Awaited<ReturnType<typeof buildApp>>;
  deps: Deps;
  env: Env;
  pushes: Array<{ endpoint: string; title: string; unread: number }>;
  pushStatus: { code: number };
  turnstileOk: { value: boolean };
  close(): Promise<void>;
}

export async function makeCtx(name: string, overrides: Record<string, string> = {}): Promise<TestCtx> {
  const url = await freshDatabase(name);
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: url,
    RATE_GLOBAL_PER_MINUTE: '100000',
    RATE_SUBMIT_PER_HOUR: '100000',
    RATE_UPLOAD_PER_HOUR: '100000',
    RATE_AUTH_PER_HOUR: '100000',
    ...overrides,
  });
  const deps = createDeps(env);
  const pushes: TestCtx['pushes'] = [];
  const pushStatus = { code: 201 };
  const turnstileOk = { value: true };
  const fakePush: PushSender = async (t, p) => {
    pushes.push({ endpoint: t.endpoint, title: p.title, unread: p.unread });
    return pushStatus.code;
  };
  deps.push = fakePush;
  deps.verifyTurnstile = async (token) => turnstileOk.value && token === 'jeton-valide';
  await bootstrap(deps.db, env);
  const app = await buildApp(deps);
  await app.ready();
  return {
    app,
    deps,
    env,
    pushes,
    pushStatus,
    turnstileOk,
    async close() {
      deps.realtime.close();
      await app.close();
      await deps.pool.end();
    },
  };
}

export const ORIGIN = 'http://localhost:5174';

export const validAnswers = (over: Record<string, unknown> = {}) => ({
  nom: 'Awa Diallo',
  email: 'awa.diallo@example.org',
  type: 'Mariage',
  date: '2099-06-12',
  invites: 140,
  lieux: ['Château de Grand-Bassam'],
  langues: ['Français'],
  rubriques: ['Programme'],
  destination: 'E-mail',
  ambiance: 'Moderne',
  budget: '650 000 à 1 300 000 FCFA',
  ...over,
});

export const body = (answers: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(),
  answers,
  consent: true,
  turnstileToken: 'jeton-valide',
  timeZone: 'Africa/Abidjan',
  ...over,
});

export async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Délai dépassé en attendant la condition.');
    await new Promise((r) => setTimeout(r, 150));
  }
}

export async function findMail(to: string, subjectPart: string) {
  return waitFor(async () => {
    const list = (await (await fetch(`${mailpit}/api/v1/messages`)).json()) as {
      messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }>;
    };
    const m = list.messages.find(
      (x) => x.Subject.includes(subjectPart) && x.To.some((t) => t.Address === to),
    );
    if (!m) return undefined;
    return (await (await fetch(`${mailpit}/api/v1/message/${m.ID}`)).json()) as {
      Text: string;
      HTML: string;
      Subject: string;
    };
  });
}

/** Ouvre une session créateur complète (lien magique reçu par e-mail puis vérifié). */
export async function login(ctx: TestCtx): Promise<string> {
  await fetch(`${mailpit}/api/v1/messages`, { method: 'DELETE' });
  const r = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/request',
    headers: { origin: ORIGIN },
    payload: { email: ctx.env.ADMIN_EMAIL },
  });
  if (r.statusCode !== 202) throw new Error(`demande de lien refusée : ${r.statusCode}`);
  const mail = await findMail(ctx.env.ADMIN_EMAIL, 'lien de connexion');
  const token = /#\/connexion\/([\w-]+)/.exec(mail.Text)?.[1];
  if (!token) throw new Error('lien absent du message');
  const v = await ctx.app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    headers: { origin: ORIGIN },
    payload: { token },
  });
  if (v.statusCode !== 200) throw new Error(`vérification refusée : ${v.statusCode}`);
  const cookie = v.cookies.find((c) => c.name === 'cree_session');
  if (!cookie) throw new Error('cookie de session absent');
  return `cree_session=${cookie.value}`;
}
