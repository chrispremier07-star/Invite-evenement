import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { LIMITS, PresignInput, SubmissionInput, validateAnswers, type PublicConfig } from '@cree/shared';
import type { Deps } from '../deps';
import { attachments, submissions } from '../db/schema';
import { HttpError, parse } from '../http';
import { audit, getSettings } from '../services/core';
import { alertEmail, confirmationEmail } from '../services/mail';
import { broadcastPush } from '../services/push';
import { deriveColumns, unreadCount } from '../services/submissions';

/** Code d'erreur PostgreSQL, que Drizzle enveloppe dans `cause`. */
const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;

export function publicRoutes(app: FastifyInstance, deps: Deps) {
  const { env, db } = deps;

  app.get('/health', async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ok', uptime: Math.round(process.uptime()) };
    } catch {
      return reply.code(503).send({ status: 'degraded' });
    }
  });

  app.get('/api/public-config', async (): Promise<PublicConfig> => {
    const s = await getSettings(db);
    return {
      responseDelayHours: s.responseDelayHours,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY,
      turnstileScriptUrl: env.TURNSTILE_SCRIPT_URL,
      privacy: {
        controller: env.PRIVACY_CONTROLLER_NAME,
        contactEmail: env.PRIVACY_CONTACT_EMAIL,
        retentionDays: s.retentionDays,
        policyVersion: env.POLICY_VERSION,
      },
    };
  });

  // Téléversement : le navigateur envoie le fichier directement au stockage avec un formulaire signé.
  app.post(
    '/api/uploads/presign',
    { config: { rateLimit: { max: env.RATE_UPLOAD_PER_HOUR, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = parse(PresignInput, req.body);
      const id = randomUUID();
      const safeName = input.filename.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'fichier';
      const key = `uploads/${new Date().toISOString().slice(0, 7)}/${id}/${safeName}`;
      const post = await deps.storage.presignUpload(key, input.contentType, LIMITS.fileBytes);
      await db.insert(attachments).values({
        id,
        storageKey: key,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        ipHash: req.ipHash,
      });
      return reply.code(201).send({ attachmentId: id, url: post.url, fields: post.fields });
    },
  );

  app.post(
    '/api/submissions',
    { config: { rateLimit: { max: env.RATE_SUBMIT_PER_HOUR, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = parse(SubmissionInput, req.body);

      // Piège à robots rempli : on répond comme si tout allait bien, sans rien enregistrer.
      if (input.site_web && input.site_web.trim()) return reply.code(202).send({ ok: true });

      const existing = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(eq(submissions.idempotencyKey, input.idempotencyKey));
      if (existing[0]) return reply.code(200).send({ id: existing[0].id, duplicate: true });

      if (!(await deps.verifyTurnstile(input.turnstileToken, req.ip))) {
        throw new HttpError(
          400,
          'antirobot',
          'La vérification anti-robot a échoué. Rechargez la page, puis réessayez.',
        );
      }

      const checked = validateAnswers(input.answers);
      if (!checked.ok)
        throw new HttpError(422, 'validation', 'Certaines réponses sont à corriger.', checked.errors);
      const answers = checked.answers;

      const fileIds = Array.isArray(answers.fichiers) ? (answers.fichiers as string[]) : [];
      const files = fileIds.length
        ? await db
            .select()
            .from(attachments)
            .where(and(inArray(attachments.id, fileIds), isNull(attachments.submissionId)))
        : [];
      if (files.length !== fileIds.length) {
        throw new HttpError(
          422,
          'fichier',
          'Un fichier n’a pas été reçu. Retirez-le, puis ajoutez-le de nouveau.',
          { fichiers: 'Un fichier n’a pas été reçu.' },
        );
      }
      const sizes = new Map<string, number>();
      for (const f of files) {
        const head = await deps.storage.head(f.storageKey);
        if (!head || head.size < 1 || head.size > LIMITS.fileBytes) {
          throw new HttpError(
            422,
            'fichier',
            'Un fichier n’a pas été reçu. Retirez-le, puis ajoutez-le de nouveau.',
            { fichiers: 'Un fichier n’a pas été reçu.' },
          );
        }
        sizes.set(f.id, head.size);
      }

      const derived = deriveColumns(answers);
      const origin = req.headers.origin;
      let source = 'formulaire';
      try {
        if (origin) source = new URL(origin).host;
      } catch {
        /* origine illisible : source par défaut */
      }

      let id: string;
      try {
        id = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(submissions)
            .values({
              answers,
              source,
              ipHash: req.ipHash,
              timeZone: input.timeZone ?? null,
              idempotencyKey: input.idempotencyKey,
              consentAt: new Date(),
              policyVersion: env.POLICY_VERSION,
              ...derived,
            })
            .returning({ id: submissions.id });
          for (const f of files) {
            await tx
              .update(attachments)
              .set({ submissionId: row!.id, status: 'ready', size: sizes.get(f.id)! })
              .where(eq(attachments.id, f.id));
          }
          return row!.id;
        });
      } catch (e) {
        // Deux envois simultanés avec la même clé : le second retrouve la demande du premier.
        if (pgCode(e) === '23505') {
          const again = await db
            .select({ id: submissions.id })
            .from(submissions)
            .where(eq(submissions.idempotencyKey, input.idempotencyKey));
          if (again[0]) return reply.code(200).send({ id: again[0].id, duplicate: true });
        }
        throw e;
      }

      void notifyNewSubmission(deps, app, id, answers, input.timeZone).catch((e) =>
        app.log.error({ err: (e as Error).message }, 'Notification de nouvelle demande incomplète'),
      );
      return reply.code(201).send({ id });
    },
  );
}

/** Temps réel, push, alerte au créateur et confirmation au client. Chaque canal échoue sans bloquer les autres. */
async function notifyNewSubmission(
  deps: Deps,
  app: FastifyInstance,
  id: string,
  answers: Record<string, unknown>,
  timeZone?: string,
) {
  const { db, env } = deps;
  const unread = await unreadCount(db);
  const name = String(answers.nom ?? 'Un client');
  deps.realtime.publish({ type: 'submission.created', id, name, unread });

  const type =
    answers.type === 'Autre' && answers.type_autre
      ? String(answers.type_autre)
      : String(answers.type ?? 'Événement');
  const body = `${name} · ${type}`;
  const s = await getSettings(db);
  const jobs: Promise<unknown>[] = [
    broadcastPush(db, deps.push, { title: 'Nouvelle demande', body, id, unread, tag: id }, app.log),
    deps.mailer
      .send({
        to: String(answers.email),
        ...confirmationEmail({
          answers,
          receivedAt: new Date(),
          timeZone,
          delayHours: s.responseDelayHours,
          controller: env.PRIVACY_CONTROLLER_NAME,
          contactEmail: env.PRIVACY_CONTACT_EMAIL,
        }),
      })
      .catch((e) =>
        app.log.error({ err: (e as Error).message, submission: id }, 'E-mail de confirmation non envoyé'),
      ),
  ];
  if (s.notifyByEmail) {
    jobs.push(
      deps.mailer
        .send({ to: s.alertEmail, ...alertEmail({ answers, studioUrl: env.STUDIO_URL, submissionId: id }) })
        .catch((e) =>
          app.log.error({ err: (e as Error).message, submission: id }, 'E-mail d’alerte non envoyé'),
        ),
    );
  }
  await Promise.allSettled(jobs);
  await audit(db, { action: 'submission.received', target: id });
}
