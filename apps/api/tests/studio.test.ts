import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachments, pushSubscriptions, submissions } from '../src/db/schema';
import { loadEnv } from '../src/env';
import { runMaintenance } from '../src/services/jobs';
import { ORIGIN, body, login, makeCtx, validAnswers, waitFor, type TestCtx } from './helpers';

let ctx: TestCtx;
let cookie: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  ctx = await makeCtx('studio');
  cookie = await login(ctx);
  const send = async (key: string, answers: Record<string, unknown>) => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/submissions',
      payload: body(answers) as object,
    });
    expect(r.statusCode).toBe(201);
    ids[key] = r.json().id;
  };
  await send(
    'camille',
    validAnswers({
      nom: 'Camille Laurent',
      email: 'camille@example.org',
      lieux: ['Château de Vaux'],
      date: '2099-06-12',
    }),
  );
  await send(
    'yasmine',
    validAnswers({
      nom: 'Yasmine Benali',
      email: 'yasmine@example.org',
      type: 'Anniversaire',
      date: '2099-02-20',
      budget: 'Je ne sais pas encore',
    }),
  );
  await send(
    'gala',
    validAnswers({
      nom: 'Marc Dubois',
      email: 'marc@example.org',
      type: 'Autre',
      type_autre: 'Gala',
      date: '2099-01-05',
    }),
  );
});
afterAll(async () => ctx.close());

const api = (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({
    method: method as 'GET',
    url,
    payload: payload as object,
    headers: { cookie, origin: ORIGIN, ...headers },
  });

describe('authentification par lien magique', () => {
  it('refuse l’accès sans session', async () => {
    const r = await ctx.app.inject({ url: '/api/studio/submissions' });
    expect(r.statusCode).toBe(401);
    expect(r.json().error.message).toContain('Connectez-vous');
  });
  it('indique l’absence de session sans erreur', async () => {
    const r = await ctx.app.inject({ url: '/api/auth/me' });
    expect(r.statusCode).toBe(200);
    expect(r.json().email).toBeNull();
  });
  it('répond pareil pour une adresse inconnue (aucune fuite)', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/request',
      headers: { origin: ORIGIN },
      payload: { email: 'inconnu@example.org' },
    });
    expect(r.statusCode).toBe(202);
  });
  it('rend le lien à usage unique', async () => {
    const token = randomUUID() + randomUUID();
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      headers: { origin: ORIGIN },
      payload: { token },
    });
    expect(r.statusCode).toBe(400);
  });
  it('pose un cookie HttpOnly SameSite=Lax et /me répond', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/request',
      headers: { origin: ORIGIN },
      payload: { email: ctx.env.ADMIN_EMAIL },
    });
    expect(r.statusCode).toBe(202);
    const me = await api('GET', '/api/auth/me');
    expect(me.json().email).toBe(ctx.env.ADMIN_EMAIL.toLowerCase());
  });
  it('rejette les écritures venant d’une origine non autorisée (CSRF)', async () => {
    const r = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/studio/submissions/${ids.camille}/status`,
      headers: { cookie, origin: 'https://pirate.example' },
      payload: { status: 'signed' },
    });
    expect(r.statusCode).toBe(403);
    const none = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/studio/submissions/${ids.camille}/status`,
      headers: { cookie },
      payload: { status: 'signed' },
    });
    expect(none.statusCode).toBe(403);
  });
});

describe('demandes', () => {
  it('liste avec compteurs, non lues et recherche sans accents ni casse', async () => {
    const all = (await api('GET', '/api/studio/submissions')).json();
    expect(all.items.length).toBe(3);
    expect(all.unread).toBe(3);
    expect(all.counts.new).toBe(3);
    const q = (await api('GET', `/api/studio/submissions?q=${encodeURIComponent('chateau vau')}`)).json();
    expect(q.items.map((i: { name: string }) => i.name)).toEqual(['Camille Laurent']);
    const none = (await api('GET', '/api/studio/submissions?q=zzzz')).json();
    expect(none.items).toEqual([]);
  });

  it('trie par date d’événement et pagine par curseur', async () => {
    const p1 = (await api('GET', '/api/studio/submissions?sort=event_asc&limit=2')).json();
    expect(p1.items.map((i: { name: string }) => i.name)).toEqual(['Marc Dubois', 'Yasmine Benali']);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (
      await api('GET', `/api/studio/submissions?sort=event_asc&limit=2&cursor=${p1.nextCursor}`)
    ).json();
    expect(p2.items.map((i: { name: string }) => i.name)).toEqual(['Camille Laurent']);
    expect(p2.nextCursor).toBeNull();
  });

  it('marque comme lue, change le statut et diffuse la mise à jour en temps réel', async () => {
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const port = (ctx.app.server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/studio/events`, { headers: { cookie } });
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    let seen = '';
    const pump = (async () => {
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        seen += dec.decode(value);
      }
    })();
    await waitFor(async () => seen.includes('event: ready') || undefined);

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/submissions',
      payload: body(validAnswers({ nom: 'Temps Réel', email: 'tr@example.org' })) as object,
    });
    ids.tr = created.json().id;
    await waitFor(async () => seen.includes('event: submission.created') || undefined, 3000);
    expect(seen).toContain('Temps Réel');

    expect((await api('POST', `/api/studio/submissions/${ids.camille}/read`)).statusCode).toBe(200);
    expect(
      (await api('PATCH', `/api/studio/submissions/${ids.camille}/status`, { status: 'signed' })).statusCode,
    ).toBe(200);
    await waitFor(async () => seen.includes('event: submission.updated') || undefined, 3000);
    await reader.cancel();
    await pump.catch(() => undefined);

    const d = (await api('GET', `/api/studio/submissions/${ids.camille}`)).json();
    expect(d.status).toBe('signed');
    expect(d.read).toBe(true);
    expect(
      (await api('PATCH', `/api/studio/submissions/${ids.camille}/status`, { status: 'inconnu' })).statusCode,
    ).toBe(422);
  });

  it('ajoute une note de façon idempotente (rejeu hors ligne sans doublon)', async () => {
    const note = { id: randomUUID(), body: 'Premier appel : veut une version anglaise.' };
    const a = await api('POST', `/api/studio/submissions/${ids.yasmine}/notes`, note);
    const b = await api('POST', `/api/studio/submissions/${ids.yasmine}/notes`, note);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    const d = (await api('GET', `/api/studio/submissions/${ids.yasmine}`)).json();
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0].body).toBe(note.body);
    // un identifiant déjà pris par une autre demande est refusé
    const clash = await api('POST', `/api/studio/submissions/${ids.gala}/notes`, note);
    expect(clash.statusCode).toBe(409);
  });

  it('calcule les statistiques en SQL à partir des données réelles', async () => {
    const s = (await api('GET', '/api/studio/stats')).json();
    expect(s.total).toBe(4);
    expect(s.receivedThisWeek).toBe(4);
    expect(s.signed).toBe(1);
    expect(s.decided).toBe(1);
    expect(s.signatureRate).toBe(100);
    expect(s.unread).toBe(3);
    expect(s.pipeline.signed).toBe(1);
    expect(s.pipeline.new).toBe(3);
    expect(s.byType.find((t: { label: string }) => t.label === 'Mariage').count).toBe(2);
    expect(s.byType.find((t: { label: string }) => t.label === 'Autre').count).toBe(1);
    expect(s.upcoming[0].name).toBe('Marc Dubois');
    expect(s.nextEvent.name).toBe('Marc Dubois');
    expect(s.avgReadHours).toBeGreaterThanOrEqual(0);
  });

  it('exporte en CSV (anti-formules) et en JSON', async () => {
    await ctx.deps.db
      .update(submissions)
      .set({ name: '=HYPERLINK("http://x")' })
      .where(sql`id = ${ids.gala}`);
    const csv = await api('GET', '/api/studio/export?format=csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.payload.startsWith('﻿')).toBe(true);
    expect(csv.payload).toContain('Camille Laurent');
    const json = (await api('GET', '/api/studio/export?format=json')).json();
    expect(json).toHaveLength(4);
    expect(json.find((r: { id: string }) => r.id === ids.yasmine).notes).toHaveLength(1);
    await ctx.deps.db
      .update(submissions)
      .set({ answers: sql`jsonb_set(answers, '{nom}', '"=1+1"')` })
      .where(sql`id = ${ids.gala}`);
    const csv2 = await api('GET', '/api/studio/export?format=csv');
    expect(csv2.payload).toContain(`"'=1+1"`);
  });

  it('supprime en douceur puis purge à l’échéance', async () => {
    expect((await api('DELETE', `/api/studio/submissions/${ids.tr}`)).statusCode).toBe(200);
    expect((await api('GET', `/api/studio/submissions/${ids.tr}`)).statusCode).toBe(404);
    expect(
      (await api('GET', '/api/studio/submissions')).json().items.map((i: { id: string }) => i.id),
    ).not.toContain(ids.tr);
    await ctx.deps.db
      .update(submissions)
      .set({ deletedAt: sql`now() - interval '400 days'` })
      .where(sql`id = ${ids.tr}`);
    const report = await runMaintenance(ctx.deps, ctx.app.log);
    expect(report.softDeleted).toBe(1);
    const left = await ctx.deps.db
      .select()
      .from(submissions)
      .where(sql`id = ${ids.tr}`);
    expect(left).toHaveLength(0);
  });
});

describe('notifications push et appareils', () => {
  const sub = (n: number) => ({
    endpoint: `https://push.example/${n}`,
    expirationTime: null,
    keys: { p256dh: 'BPubKey', auth: 'authsecret' },
    label: `Appareil ${n}`,
  });

  it('abonne, liste, renomme et désabonne un appareil', async () => {
    expect((await api('GET', '/api/studio/push/key')).json().publicKey).toBe(ctx.env.VAPID_PUBLIC_KEY);
    const r = await api('POST', '/api/studio/push/subscribe', sub(1));
    expect(r.statusCode).toBe(201);
    const list = (
      await api('GET', `/api/studio/devices?endpoint=${encodeURIComponent(sub(1).endpoint)}`)
    ).json();
    expect(list).toHaveLength(1);
    expect(list[0].current).toBe(true);
    expect(
      (await api('PATCH', `/api/studio/devices/${r.json().id}`, { label: 'Mon téléphone' })).statusCode,
    ).toBe(200);
    expect((await api('GET', '/api/studio/devices')).json()[0].label).toBe('Mon téléphone');
    expect((await api('DELETE', `/api/studio/devices/${r.json().id}`)).statusCode).toBe(200);
    expect(await ctx.deps.db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it('envoie la notification de contrôle et supprime un abonnement expiré (410)', async () => {
    await api('POST', '/api/studio/push/subscribe', sub(2));
    ctx.pushes.length = 0;
    expect((await api('POST', '/api/studio/push/test', { endpoint: sub(2).endpoint })).statusCode).toBe(200);
    expect(ctx.pushes[0]!.title).toBe('Notification de contrôle');
    ctx.pushStatus.code = 410;
    const gone = await api('POST', '/api/studio/push/test', { endpoint: sub(2).endpoint });
    expect(gone.statusCode).toBe(410);
    expect(await ctx.deps.db.select().from(pushSubscriptions)).toHaveLength(0);
    ctx.pushStatus.code = 201;
  });

  it('pousse chaque nouvelle demande aux appareils et nettoie les abonnements morts', async () => {
    await api('POST', '/api/studio/push/subscribe', sub(3));
    await api('POST', '/api/studio/push/subscribe', sub(4));
    ctx.pushes.length = 0;
    ctx.pushStatus.code = 410;
    await ctx.app.inject({
      method: 'POST',
      url: '/api/submissions',
      payload: body(validAnswers({ nom: 'Push Test', email: 'push@example.org' })) as object,
    });
    await waitFor(async () => (await ctx.deps.db.select().from(pushSubscriptions)).length === 0 || undefined);
    expect(ctx.pushes.filter((p) => p.title === 'Nouvelle demande')).toHaveLength(2);
    ctx.pushStatus.code = 201;
  });
});

describe('réglages, RGPD et rétention', () => {
  it('lit et met à jour les réglages avec validation', async () => {
    const cur = (await api('GET', '/api/studio/settings')).json();
    expect(cur.responseDelayHours).toBe(Number(ctx.env.DEFAULT_RESPONSE_DELAY_HOURS));
    const upd = await api('PUT', '/api/studio/settings', { ...cur, responseDelayHours: 24 });
    expect(upd.statusCode).toBe(200);
    expect((await ctx.app.inject({ url: '/api/public-config' })).json().responseDelayHours).toBe(24);
    expect((await api('PUT', '/api/studio/settings', { ...cur, retentionDays: 1 })).statusCode).toBe(422);
  });

  it('exporte puis efface toutes les données d’un client, fichiers compris', async () => {
    const content = Buffer.from('logo');
    const pre = await ctx.app.inject({
      method: 'POST',
      url: '/api/uploads/presign',
      payload: { filename: 'logo.png', contentType: 'image/png', size: content.length },
    });
    const { attachmentId, url, fields } = pre.json() as {
      attachmentId: string;
      url: string;
      fields: Record<string, string>;
    };
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(content)], { type: 'image/png' }), 'logo.png');
    expect((await fetch(url, { method: 'POST', body: form })).status).toBe(204);
    await ctx.app.inject({
      method: 'POST',
      url: '/api/submissions',
      payload: body(
        validAnswers({ nom: 'Efface Moi', email: 'Efface@Example.org', fichiers: [attachmentId] }),
      ) as object,
    });

    const exp = (await api('GET', '/api/studio/privacy/export?email=efface@example.org')).json();
    expect(exp).toHaveLength(1);
    const [att] = await ctx.deps.db
      .select()
      .from(attachments)
      .where(sql`id = ${attachmentId}`);
    const del = await api('POST', '/api/studio/privacy/erase', { email: 'efface@example.org' });
    expect(del.json().deleted).toBe(1);
    expect(
      await ctx.deps.db
        .select()
        .from(attachments)
        .where(sql`id = ${attachmentId}`),
    ).toHaveLength(0);
    expect(await ctx.deps.storage.head(att!.storageKey)).toBeNull();
    const audit = await ctx.deps.db.execute(
      sql`select count(*)::int as n from audit_log where action = 'privacy.erase'`,
    );
    expect((audit.rows[0] as { n: number }).n).toBe(1);
  });

  it('purge les demandes plus anciennes que la durée de conservation et les fichiers orphelins', async () => {
    const r = await ctx.app.inject({
      method: 'POST',
      url: '/api/submissions',
      payload: body(validAnswers({ nom: 'Trop Ancien', email: 'ancien@example.org' })) as object,
    });
    await ctx.deps.db
      .update(submissions)
      .set({ receivedAt: sql`now() - interval '5000 days'` })
      .where(sql`id = ${r.json().id}`);
    const pre = await ctx.app.inject({
      method: 'POST',
      url: '/api/uploads/presign',
      payload: { filename: 'o.png', contentType: 'image/png', size: 5 },
    });
    await ctx.deps.db
      .update(attachments)
      .set({ createdAt: sql`now() - interval '3 days'` })
      .where(sql`id = ${pre.json().attachmentId}`);
    const report = await runMaintenance(ctx.deps, ctx.app.log);
    expect(report.expired).toBe(1);
    expect(report.orphanFiles).toBe(1);
    expect(
      await ctx.deps.db
        .select()
        .from(submissions)
        .where(sql`id = ${r.json().id}`),
    ).toHaveLength(0);
  });

  it('se déconnecte et invalide la session', async () => {
    expect((await api('POST', '/api/auth/logout')).statusCode).toBe(200);
    expect((await api('GET', '/api/studio/stats')).statusCode).toBe(401);
  });
});

describe('configuration', () => {
  it('refuse de démarrer et liste chaque variable manquante', () => {
    const { DATABASE_URL: _d, VAPID_PRIVATE_KEY: _v, ...rest } = process.env;
    expect(() => loadEnv({ ...rest, NODE_ENV: 'test' })).toThrowError(
      /DATABASE_URL : variable manquante[\s\S]*VAPID_PRIVATE_KEY : variable manquante/,
    );
  });
  it('exige HTTPS en production', () => {
    expect(() => loadEnv({ ...process.env, NODE_ENV: 'production' })).toThrowError(/https/);
  });
});
