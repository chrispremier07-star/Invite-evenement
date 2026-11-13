import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LoginInput } from '@cree/shared';
import type { Deps } from '../deps';
import { loginTokens, sessions, users } from '../db/schema';
import { HttpError, parse } from '../http';
import { audit } from '../services/core';
import { loginEmail } from '../services/mail';
import { randomToken, sha256 } from '../util';

export const SESSION_COOKIE = 'cree_session';

export function authRoutes(app: FastifyInstance, deps: Deps) {
  const { env, db } = deps;
  const secure = env.PUBLIC_URL.startsWith('https://');
  const limit = { config: { rateLimit: { max: env.RATE_AUTH_PER_HOUR, timeWindow: '1 hour' } } };

  app.post('/api/auth/request', limit, async (req, reply) => {
    const { email } = parse(LoginInput, req.body);
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    // Réponse identique que le compte existe ou non : on ne révèle rien.
    if (user) {
      const [last] = await db
        .select()
        .from(loginTokens)
        .where(eq(loginTokens.userId, user.id))
        .orderBy(desc(loginTokens.createdAt))
        .limit(1);
      const tooSoon = last && Date.now() - last.createdAt.getTime() < env.LOGIN_LINK_COOLDOWN_SECONDS * 1000;
      if (!tooSoon) {
        const token = randomToken();
        await db.insert(loginTokens).values({
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + env.LOGIN_LINK_MINUTES * 60_000),
        });
        const link = `${env.STUDIO_URL.replace(/\/$/, '')}/#/connexion/${token}`;
        await deps.mailer.send({ to: user.email, ...loginEmail({ link, minutes: env.LOGIN_LINK_MINUTES }) });
        await audit(db, { userId: user.id, action: 'auth.link_sent', ipHash: req.ipHash });
      }
    }
    return reply.code(202).send({ ok: true });
  });

  app.post('/api/auth/verify', limit, async (req, reply) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(200) }).strict(), req.body);
    const used = await db
      .update(loginTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(loginTokens.tokenHash, sha256(token)),
          isNull(loginTokens.usedAt),
          gt(loginTokens.expiresAt, sql`now()`),
        ),
      )
      .returning({ userId: loginTokens.userId });
    const row = used[0];
    if (!row) throw new HttpError(400, 'lien_invalide', 'Ce lien n’est plus valide. Demandez-en un nouveau.');
    const [user] = await db.select().from(users).where(eq(users.id, row.userId));
    if (!user)
      throw new HttpError(400, 'lien_invalide', 'Ce lien n’est plus valide. Demandez-en un nouveau.');

    const sessionToken = randomToken();
    const maxAge = env.SESSION_DAYS * 24 * 3600;
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: sha256(sessionToken),
      expiresAt: new Date(Date.now() + maxAge * 1000),
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
      ipHash: req.ipHash,
    });
    await audit(db, { userId: user.id, action: 'auth.login', ipHash: req.ipHash });
    reply.setCookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    return { email: user.email };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  // Répond toujours 200 : « pas de session » n'est pas une erreur (évite un échec réseau visible dans la console).
  app.get('/api/auth/me', async (req) => {
    try {
      await requireUser(req, deps);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) return { email: null };
      throw e;
    }
    return { email: req.user!.email };
  });
}

/** Charge la session depuis le cookie ou répond 401. */
export async function requireUser(req: FastifyRequest, deps: Deps): Promise<void> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) throw new HttpError(401, 'non_connecte', 'Connectez-vous pour continuer.');
  const rows = await deps.db
    .select({ sessionId: sessions.id, userId: users.id, email: users.email, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, sql`now()`)));
  const row = rows[0];
  if (!row) throw new HttpError(401, 'non_connecte', 'Votre session a expiré. Connectez-vous de nouveau.');
  req.user = { id: row.userId, email: row.email, sessionId: row.sessionId };
  if (Date.now() - row.lastSeenAt.getTime() > 3600_000) {
    await deps.db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.sessionId));
  }
}

export type Reply = FastifyReply;
