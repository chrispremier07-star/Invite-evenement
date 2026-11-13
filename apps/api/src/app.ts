import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import * as Sentry from '@sentry/node';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Deps } from './deps';
import { HttpError } from './http';
import { authRoutes } from './routes/auth';
import { publicRoutes } from './routes/public';
import { studioRoutes } from './routes/studio';
import { hmacIp } from './util';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const { env } = deps;
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : { level: env.LOG_LEVEL, redact: ['req.headers.cookie', 'req.headers.authorization'] },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
  });

  const allowed = new Set([...env.ALLOWED_ORIGINS, new URL(env.PUBLIC_URL).origin]);
  const prod = env.NODE_ENV === 'production';
  const self = "'self'";
  const turnstile = new URL(env.TURNSTILE_SCRIPT_URL).origin;

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': [self],
        'script-src': [self, turnstile],
        'style-src': [self],
        'img-src': [self, 'data:', 'blob:', deps.storage.origin],
        'font-src': [self],
        'connect-src': [self, deps.storage.origin, turnstile, ...allowed],
        'frame-src': [turnstile],
        'worker-src': [self],
        'manifest-src': [self],
        'object-src': ["'none'"],
        'base-uri': [self],
        'form-action': [self],
        'frame-ancestors': ["'none'"],
        ...(prod ? { 'upgrade-insecure-requests': [] } : {}),
      },
    },
    strictTransportSecurity: prod ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });
  // Brotli/gzip pour le JavaScript, le CSS et le JSON ; le flux temps réel (SSE) écrit directement et n'est pas compressé.
  await app.register(compress, { global: true, threshold: 512 });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_GLOBAL_PER_MINUTE,
    timeWindow: '1 minute',
    errorResponseBuilder: () =>
      new HttpError(429, 'trop_de_requetes', 'Trop de tentatives. Patientez un moment, puis réessayez.'),
  });

  app.decorateRequest('ipHash', '');
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    req.ipHash = hmacIp(env.IP_HASH_SECRET, req.ip);
  });

  // Protection CSRF : en plus du cookie SameSite=Lax, toute écriture authentifiée doit venir d'une origine autorisée.
  app.addHook('onRequest', async (req) => {
    if (!UNSAFE.has(req.method) || !(req.url.startsWith('/api/studio') || req.url.startsWith('/api/auth')))
      return;
    const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : '');
    if (!origin || !allowed.has(origin))
      throw new HttpError(403, 'origine_refusee', 'Requête refusée : origine non autorisée.');
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({
        error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
      });
    }
    if (err instanceof ZodError) {
      return reply
        .code(422)
        .send({ error: { code: 'validation', message: 'Certaines informations sont invalides.' } });
    }
    const status = err.statusCode ?? 500;
    if (status === 413)
      return reply.code(413).send({
        error: { code: 'trop_volumineux', message: 'Les données envoyées sont trop volumineuses.' },
      });
    if (status === 400 || status === 415) {
      return reply.code(status).send({
        error: {
          code: 'requete_invalide',
          message: 'La requête est illisible. Rechargez la page, puis réessayez.',
        },
      });
    }
    if (status === 429)
      return reply.code(429).send({
        error: {
          code: 'trop_de_requetes',
          message: 'Trop de tentatives. Patientez un moment, puis réessayez.',
        },
      });
    req.log.error({ err }, 'Erreur interne');
    Sentry.captureException(err);
    return reply.code(500).send({
      error: {
        code: 'erreur_interne',
        message: 'Une erreur est survenue de notre côté. Réessayez dans un instant.',
      },
    });
  });

  publicRoutes(app, deps);
  authRoutes(app, deps);
  studioRoutes(app, deps);

  const formDir = resolve(env.FORM_DIST_DIR);
  const studioDir = resolve(env.STUDIO_DIST_DIR);
  const noCache = (res: { header(k: string, v: string): unknown }, path: string) => {
    if (/\.(html|webmanifest)$|sw\.js$/.test(path)) res.header('Cache-Control', 'no-cache');
    else if (/[\\/]assets[\\/]/.test(path))
      res.header('Cache-Control', 'public, max-age=31536000, immutable');
  };
  const hasForm = existsSync(formDir);
  const hasStudio = existsSync(studioDir);
  if (hasStudio)
    await app.register(fastifyStatic, {
      root: studioDir,
      prefix: '/studio/',
      wildcard: false,
      setHeaders: noCache,
    });
  if (hasForm)
    await app.register(fastifyStatic, {
      root: formDir,
      prefix: '/',
      wildcard: false,
      decorateReply: !hasStudio,
      setHeaders: noCache,
    });
  if (!hasForm || !hasStudio)
    app.log.warn(
      { formDir, studioDir },
      'Front compilé introuvable : lancez `npm run build` pour servir les interfaces depuis l’API.',
    );

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0] ?? '';
    if (path.startsWith('/api/'))
      return reply.code(404).send({ error: { code: 'introuvable', message: 'Ressource introuvable.' } });
    if (req.method !== 'GET')
      return reply.code(404).send({ error: { code: 'introuvable', message: 'Ressource introuvable.' } });
    if (path.startsWith('/studio') && hasStudio) return reply.sendFile('index.html', studioDir);
    if (hasForm) return reply.sendFile('index.html', formDir);
    return reply.code(404).send({ error: { code: 'introuvable', message: 'Page introuvable.' } });
  });

  return app;
}
