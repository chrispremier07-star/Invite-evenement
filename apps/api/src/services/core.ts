import { eq, sql } from 'drizzle-orm';
import type { StudioSettings } from '@cree/shared';
import type { Db } from '../db';
import { auditLog, settings, users } from '../db/schema';
import type { Env } from '../env';

/** Crée le compte du créateur et la ligne de réglages au premier démarrage, à partir de l'environnement. */
export async function bootstrap(db: Db, env: Env): Promise<void> {
  await db.insert(users).values({ email: env.ADMIN_EMAIL.toLowerCase() }).onConflictDoNothing();
  await db
    .insert(settings)
    .values({
      id: 1,
      responseDelayHours: env.DEFAULT_RESPONSE_DELAY_HOURS,
      alertEmail: env.ADMIN_EMAIL.toLowerCase(),
      retentionDays: env.DEFAULT_RETENTION_DAYS,
    })
    .onConflictDoNothing();
}

export async function getSettings(db: Db): Promise<StudioSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!row) throw new Error('Réglages absents : la base n’a pas été initialisée.');
  return {
    responseDelayHours: row.responseDelayHours,
    alertEmail: row.alertEmail,
    retentionDays: row.retentionDays,
    notifyByEmail: row.notifyByEmail,
  };
}

export async function saveSettings(db: Db, s: StudioSettings): Promise<void> {
  await db
    .update(settings)
    .set({ ...s, updatedAt: sql`now()` })
    .where(eq(settings.id, 1));
}

export async function audit(
  db: Db,
  entry: {
    userId?: string | null;
    action: string;
    target?: string | null;
    meta?: Record<string, unknown>;
    ipHash?: string | null;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    userId: entry.userId ?? null,
    action: entry.action,
    target: entry.target ?? null,
    meta: entry.meta ?? null,
    ipHash: entry.ipHash ?? null,
  });
}
