import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachments, submissions } from '../src/db/schema';
import { body, findMail, makeCtx, validAnswers, waitFor, type TestCtx } from './helpers';

let ctx: TestCtx;
beforeAll(async () => {
  ctx = await makeCtx('public');
});
afterAll(async () => ctx.close());

const post = (payload: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/submissions',
    payload: payload as object,
    headers: { origin: 'http://localhost:5173', ...headers },
  });

describe('santé et configuration publique', () => {
  it('répond sur /health avec la base', async () => {
    const r = await ctx.app.inject({ url: '/health' });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe('ok');
  });
  it('expose le délai de réponse venant de la base, jamais codé en dur', async () => {
    const r = await ctx.app.inject({ url: '/api/public-config' });
    expect(r.json().responseDelayHours).toBe(Number(ctx.env.DEFAULT_RESPONSE_DELAY_HOURS));
    expect(r.json().turnstileSiteKey).toBe(ctx.env.TURNSTILE_SITE_KEY);
  });
  it('envoie des en-têtes de sécurité stricts', async () => {
    const r = await ctx.app.inject({ url: '/health' });
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
  it('refuse les origines non autorisées en CORS', async () => {
    const r = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/api/submissions',
      headers: { origin: 'https://pirate.example', 'access-control-request-method': 'POST' },
    });
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
    const ok = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/api/submissions',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('POST /api/submissions', () => {
  it('refuse une demande incomplète avec des messages français par champ', async () => {
    const r = await post(body({ nom: '' }));
    expect(r.statusCode).toBe(422);
    expect(r.json().error.fields.nom).toBe('Indiquez votre prénom et votre nom.');
    expect(r.json().error.fields.email).toBeDefined();
  });

  it('refuse les champs inconnus et le consentement absent', async () => {
    expect((await post({ ...body(validAnswers()), intrus: true })).statusCode).toBe(422);
    const noConsent = await post({ ...body(validAnswers()), consent: false });
    expect(noConsent.statusCode).toBe(422);
    expect(noConsent.json().error.fields.consent).toContain('consentement');
  });

  it('refuse un jeton anti-robot invalide', async () => {
    const r = await post(body(validAnswers(), { turnstileToken: 'faux' }));
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('antirobot');
  });

  it('ignore silencieusement les robots qui remplissent le piège', async () => {
    const before = await ctx.deps.db.select({ n: sql<number>`count(*)::int` }).from(submissions);
    const r = await post(body(validAnswers(), { site_web: 'http://spam.example' }));
    expect(r.statusCode).toBe(202);
    const after = await ctx.deps.db.select({ n: sql<number>`count(*)::int` }).from(submissions);
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it('enregistre la demande, déclenche push, alerte et e-mail de confirmation avec récapitulatif', async () => {
    const payload = body(validAnswers({ nom: 'Léa <b>Koné</b>', email: 'lea.kone@example.org' }));
    const r = await post(payload);
    expect(r.statusCode).toBe(201);
    const id = r.json().id as string;

    const [row] = await ctx.deps.db
      .select()
      .from(submissions)
      .where(sql`id = ${id}`);
    expect(row!.status).toBe('new');
    expect(row!.read).toBe(false);
    expect(row!.name).toBe('Léa <b>Koné</b>');
    expect(row!.ipHash).toMatch(/^[0-9a-f]{40}$/);
    expect(row!.ipHash).not.toContain('127.0.0.1');
    expect(row!.timeZone).toBe('Africa/Abidjan');
    expect(row!.policyVersion).toBe(ctx.env.POLICY_VERSION);

    const confirm = await findMail('lea.kone@example.org', 'bien été reçue');
    expect(confirm.Text).toContain('Réponse sous 2 jours');
    expect(confirm.Text).toContain('650 000 à 1 300 000 FCFA');
    expect(confirm.HTML).toContain('&lt;b&gt;Koné&lt;/b&gt;'); // échappement des réponses
    expect(confirm.HTML).not.toContain('<b>Koné</b>');

    const alert = await findMail(ctx.env.ADMIN_EMAIL, 'Nouvelle demande');
    expect(alert.Text).toContain(`/#/demande/${id}`);
  });

  it('est idempotente : le même envoi répété ne crée qu’une demande', async () => {
    const payload = body(validAnswers({ nom: 'Idem Potent', email: 'idem@example.org' }));
    const [a, b] = await Promise.all([post(payload), post(payload)]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(a.json().id).toBe(b.json().id);
    const n = await ctx.deps.db
      .select({ n: sql<number>`count(*)::int` })
      .from(submissions)
      .where(sql`email = 'idem@example.org'`);
    expect(n[0]!.n).toBe(1);
  });
});

describe('téléversement de fichiers', () => {
  const presign = (payload: unknown) =>
    ctx.app.inject({ method: 'POST', url: '/api/uploads/presign', payload: payload as object });

  async function upload(content: Buffer, contentType: string, filename: string) {
    const r = await presign({ filename, contentType, size: content.length });
    expect(r.statusCode).toBe(201);
    const { attachmentId, url, fields } = r.json() as {
      attachmentId: string;
      url: string;
      fields: Record<string, string>;
    };
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(content)], { type: contentType }), filename);
    const put = await fetch(url, { method: 'POST', body: form });
    return { attachmentId, status: put.status };
  }

  it('refuse un type ou une taille hors limites', async () => {
    expect(
      (await presign({ filename: 'a.exe', contentType: 'application/x-msdownload', size: 10 })).statusCode,
    ).toBe(422);
    expect(
      (await presign({ filename: 'a.pdf', contentType: 'application/pdf', size: 999_999_999 })).statusCode,
    ).toBe(422);
  });

  it('envoie un vrai fichier dans le stockage, le rattache à la demande et le sert par URL signée', async () => {
    const content = Buffer.from('%PDF-1.4 faire-part de test intégré');
    const up = await upload(content, 'application/pdf', 'faire-part.pdf');
    expect(up.status).toBe(204);

    const r = await post(body(validAnswers({ email: 'fichier@example.org', fichiers: [up.attachmentId] })));
    expect(r.statusCode).toBe(201);
    const [att] = await ctx.deps.db
      .select()
      .from(attachments)
      .where(sql`id = ${up.attachmentId}`);
    expect(att!.submissionId).toBe(r.json().id);
    expect(att!.status).toBe('ready');
    expect(att!.size).toBe(content.length);

    const url = await ctx.deps.storage.signedGetUrl(att!.storageKey, att!.filename);
    const dl = await fetch(url);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-disposition')).toContain('faire-part.pdf');
    expect(Buffer.from(await dl.arrayBuffer()).equals(content)).toBe(true);
  });

  it('refuse un fichier annoncé mais jamais téléversé', async () => {
    const r = await presign({ filename: 'fantome.png', contentType: 'image/png', size: 100 });
    const r2 = await post(
      body(validAnswers({ email: 'fantome@example.org', fichiers: [r.json().attachmentId] })),
    );
    expect(r2.statusCode).toBe(422);
    expect(r2.json().error.fields.fichiers).toBeDefined();
  });

  it('refuse un fichier dépassant la limite côté stockage', async () => {
    const r = await presign({ filename: 'a.png', contentType: 'image/png', size: 10 });
    const { url, fields } = r.json() as { url: string; fields: Record<string, string> };
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(26 * 1024 * 1024)], { type: 'image/png' }), 'a.png');
    const put = await fetch(url, { method: 'POST', body: form });
    expect(put.status).toBe(400);
  });

  it('refuse un identifiant de fichier inconnu', async () => {
    const r = await post(body(validAnswers({ email: 'inconnu@example.org', fichiers: [randomUUID()] })));
    expect(r.statusCode).toBe(422);
  });
});

describe('limitation de débit', () => {
  it('bloque au-delà du quota par IP avec un message en français', async () => {
    const limited = await makeCtx('rate', { RATE_SUBMIT_PER_HOUR: '2' });
    try {
      const send = () =>
        limited.app.inject({
          method: 'POST',
          url: '/api/submissions',
          payload: body(validAnswers()) as object,
        });
      await waitFor(async () => (await send()).statusCode === 201 || undefined);
      await send();
      const third = await send();
      expect(third.statusCode).toBe(429);
      expect(third.json().error.message).toContain('Trop de tentatives');
    } finally {
      await limited.close();
    }
  });
});
