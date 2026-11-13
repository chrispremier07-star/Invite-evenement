import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const int = z.coerce.number().int().positive();
const list = z
  .string()
  .min(1)
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  HOST: z.string().min(1),
  PORT: int,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  TRUST_PROXY: bool,
  PUBLIC_URL: z.string().url(),
  STUDIO_URL: z.string().url(),
  ALLOWED_ORIGINS: list,
  FORM_DIST_DIR: z.string().min(1),
  STUDIO_DIST_DIR: z.string().min(1),

  DATABASE_URL: z.string().url(),

  SESSION_SECRET: z.string().min(32, 'au moins 32 caractères'),
  IP_HASH_SECRET: z.string().min(32, 'au moins 32 caractères'),
  SESSION_DAYS: int,
  LOGIN_LINK_MINUTES: int,
  LOGIN_LINK_COOLDOWN_SECONDS: z.coerce.number().int().min(0),

  ADMIN_EMAIL: z.string().email(),
  DEFAULT_RESPONSE_DELAY_HOURS: int,
  DEFAULT_RETENTION_DAYS: int,
  PURGE_DELAY_DAYS: int,

  PRIVACY_CONTROLLER_NAME: z.string().min(1),
  PRIVACY_CONTACT_EMAIL: z.string().email(),
  POLICY_VERSION: z.string().min(1),

  VAPID_PUBLIC_KEY: z.string().min(20),
  VAPID_PRIVATE_KEY: z.string().min(20),
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:)/, 'doit commencer par mailto: ou https:'),

  SMTP_URL: z.string().min(1),
  MAIL_FROM: z.string().min(3),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool,

  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  TURNSTILE_SCRIPT_URL: z.string().url(),
  TURNSTILE_VERIFY_URL: z.string().url(),

  RATE_GLOBAL_PER_MINUTE: int,
  RATE_SUBMIT_PER_HOUR: int,
  RATE_UPLOAD_PER_HOUR: int,
  RATE_AUTH_PER_HOUR: int,

  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {}

/** Valide les variables d'environnement ; lève une erreur lisible listant chaque variable manquante ou invalide. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => {
      const name = String(i.path[0] ?? '?');
      const missing = source[name] === undefined || source[name] === '';
      return `  - ${name} : ${missing ? 'variable manquante' : i.message}`;
    });
    throw new EnvError(
      `Configuration invalide. Corrigez le fichier .env (voir .env.example) :\n${lines.join('\n')}`,
    );
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const insecure = [env.PUBLIC_URL, env.STUDIO_URL].filter((u) => !u.startsWith('https://'));
    if (insecure.length)
      throw new EnvError(
        'Configuration invalide : PUBLIC_URL et STUDIO_URL doivent commencer par https:// en production.',
      );
  }
  return env;
}
