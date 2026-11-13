import { and, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { Deps } from '../deps';
import { attachments, loginTokens, sessions, submissions } from '../db/schema';
import { audit, getSettings } from './core';

export interface Logger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

/** Supprime définitivement des demandes : fichiers du stockage d'abord, puis lignes (notes et pièces jointes en cascade). */
export async function purgeSubmissions(deps: Deps, ids: string[], log: Logger): Promise<number> {
  if (!ids.length) return 0;
  const files = await deps.db
    .select({ key: attachments.storageKey })
    .from(attachments)
    .where(inArray(attachments.submissionId, ids));
  for (const f of files) {
    try {
      await deps.storage.remove(f.key);
    } catch (e) {
      log.warn({ key: f.key, err: (e as Error).message }, 'Suppression du fichier impossible');
    }
  }
  await deps.db.delete(submissions).where(inArray(submissions.id, ids));
  return ids.length;
}

export interface JobReport {
  softDeleted: number;
  expired: number;
  orphanFiles: number;
  sessions: number;
}

/** Tâches de nettoyage : purge de la corbeille, durée de conservation, fichiers orphelins, sessions expirées. */
export async function runMaintenance(deps: Deps, log: Logger): Promise<JobReport> {
  const { db, env } = deps;

  const trash = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        isNotNull(submissions.deletedAt),
        lt(submissions.deletedAt, sql`now() - make_interval(days => ${env.PURGE_DELAY_DAYS})`),
      ),
    );
  const softDeleted = await purgeSubmissions(
    deps,
    trash.map((r) => r.id),
    log,
  );

  const { retentionDays } = await getSettings(db);
  const old = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(lt(submissions.receivedAt, sql`now() - make_interval(days => ${retentionDays})`));
  const expired = await purgeSubmissions(
    deps,
    old.map((r) => r.id),
    log,
  );
  if (expired) await audit(db, { action: 'retention.purge', meta: { count: expired, retentionDays } });

  const orphans = await db
    .select({ id: attachments.id, key: attachments.storageKey })
    .from(attachments)
    .where(
      and(isNull(attachments.submissionId), lt(attachments.createdAt, sql`now() - interval '24 hours'`)),
    );
  for (const o of orphans) {
    try {
      await deps.storage.remove(o.key);
    } catch (e) {
      log.warn({ key: o.key, err: (e as Error).message }, 'Suppression du fichier orphelin impossible');
    }
  }
  if (orphans.length)
    await db.delete(attachments).where(
      inArray(
        attachments.id,
        orphans.map((o) => o.id),
      ),
    );

  const s1 = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, sql`now()`))
    .returning({ id: sessions.id });
  const s2 = await db
    .delete(loginTokens)
    .where(lt(loginTokens.expiresAt, sql`now() - interval '1 day'`))
    .returning({ id: loginTokens.id });

  const report = { softDeleted, expired, orphanFiles: orphans.length, sessions: s1.length + s2.length };
  if (softDeleted || expired || orphans.length) log.info(report, 'Maintenance effectuée');
  return report;
}

export function scheduleMaintenance(deps: Deps, log: Logger): NodeJS.Timeout {
  const run = () =>
    runMaintenance(deps, log).catch((e) =>
      log.error({ err: (e as Error).message }, 'Échec de la maintenance'),
    );
  void run();
  const t = setInterval(run, 60 * 60 * 1000);
  t.unref();
  return t;
}
