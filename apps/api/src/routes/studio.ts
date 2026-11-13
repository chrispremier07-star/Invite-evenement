import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  EraseInput,
  ListQuery,
  NoteInput,
  PushSubscriptionInput,
  SettingsInput,
  StatusInput,
  allBlocks,
  displayValue,
  statusOf,
  type DeviceInfo,
  type SubmissionDetail,
} from '@cree/shared';
import type { Deps } from '../deps';
import { attachments, notes, pushSubscriptions, submissions } from '../db/schema';
import { HttpError, notFound, parse } from '../http';
import { audit, getSettings, saveSettings } from '../services/core';
import { purgeSubmissions } from '../services/jobs';
import { computeStats, listSubmissions, toSummary, unreadCount } from '../services/submissions';
import { csvCell, sha256 } from '../util';
import { requireUser } from './auth';

const uuidParam = z.object({ id: z.string().uuid() });

function deviceLabel(ua: string): string {
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /firefox/i.test(ua)
      ? 'Firefox'
      : /chrome|crios/i.test(ua)
        ? 'Chrome'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Navigateur';
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad/i.test(ua)
      ? 'iOS'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac os/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'appareil';
  return `${browser} sur ${os}`;
}

export function studioRoutes(app: FastifyInstance, deps: Deps) {
  const { db, env } = deps;

  app.register(
    async (s) => {
      s.addHook('preHandler', async (req) => requireUser(req, deps));
      const uid = (r: { user: { id: string } | null }) => r.user!.id;

      // ---- Demandes -------------------------------------------------------
      s.get('/submissions', async (req) => listSubmissions(db, parse(ListQuery, req.query)));

      s.get('/submissions/:id', async (req): Promise<SubmissionDetail> => {
        const { id } = parse(uuidParam, req.params);
        const [row] = await db
          .select()
          .from(submissions)
          .where(and(eq(submissions.id, id), isNull(submissions.deletedAt)));
        if (!row) throw notFound('Demande');
        const files = await db
          .select()
          .from(attachments)
          .where(and(eq(attachments.submissionId, id), eq(attachments.status, 'ready')));
        const noteRows = await db
          .select()
          .from(notes)
          .where(eq(notes.submissionId, id))
          .orderBy(asc(notes.createdAt));
        return {
          ...toSummary(row),
          answers: row.answers,
          timeZone: row.timeZone,
          attachments: await Promise.all(
            files.map(async (f) => ({
              id: f.id,
              filename: f.filename,
              contentType: f.contentType,
              size: f.size,
              url: await deps.storage.signedGetUrl(f.storageKey, f.filename),
            })),
          ),
          notes: noteRows.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
        };
      });

      s.post('/submissions/:id/read', async (req) => {
        const { id } = parse(uuidParam, req.params);
        const res = await db
          .update(submissions)
          .set({ read: true, firstReadAt: sql`coalesce(${submissions.firstReadAt}, now())` })
          .where(and(eq(submissions.id, id), isNull(submissions.deletedAt)))
          .returning({ id: submissions.id });
        if (!res[0]) throw notFound('Demande');
        const unread = await unreadCount(db);
        deps.realtime.publish({ type: 'submission.updated', id, unread });
        return { ok: true, unread };
      });

      s.patch('/submissions/:id/status', async (req) => {
        const { id } = parse(uuidParam, req.params);
        const { status } = parse(StatusInput, req.body);
        const res = await db
          .update(submissions)
          .set({ status })
          .where(and(eq(submissions.id, id), isNull(submissions.deletedAt)))
          .returning({ id: submissions.id });
        if (!res[0]) throw notFound('Demande');
        await audit(db, {
          userId: uid(req),
          action: 'submission.status',
          target: id,
          meta: { status: statusOf(status).id },
          ipHash: req.ipHash,
        });
        const unread = await unreadCount(db);
        deps.realtime.publish({ type: 'submission.updated', id, unread });
        return { ok: true, unread };
      });

      // L'identifiant de la note est choisi par l'appareil : rejouer l'action hors ligne ne crée jamais de doublon.
      s.post('/submissions/:id/notes', async (req, reply) => {
        const { id } = parse(uuidParam, req.params);
        const input = parse(NoteInput, req.body);
        const [exists] = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(and(eq(submissions.id, id), isNull(submissions.deletedAt)));
        if (!exists) throw notFound('Demande');
        await db
          .insert(notes)
          .values({ id: input.id, submissionId: id, userId: uid(req), body: input.body })
          .onConflictDoNothing();
        const [row] = await db.select().from(notes).where(eq(notes.id, input.id));
        if (!row || row.submissionId !== id) throw new HttpError(409, 'conflit', 'Cette note existe déjà.');
        await audit(db, { userId: uid(req), action: 'note.add', target: id, ipHash: req.ipHash });
        return reply.code(201).send({ id: row.id, body: row.body, createdAt: row.createdAt.toISOString() });
      });

      s.delete('/submissions/:id/notes/:noteId', async (req) => {
        const { id, noteId } = parse(
          z.object({ id: z.string().uuid(), noteId: z.string().uuid() }),
          req.params,
        );
        await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.submissionId, id)));
        await audit(db, { userId: uid(req), action: 'note.delete', target: id, ipHash: req.ipHash });
        return { ok: true };
      });

      // Suppression douce (corbeille, purge programmée) ou définitive (droit à l'effacement).
      s.delete('/submissions/:id', async (req) => {
        const { id } = parse(uuidParam, req.params);
        const { permanent } = parse(
          z.object({ permanent: z.enum(['true', 'false']).default('false') }),
          req.query,
        );
        const [row] = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, id));
        if (!row) throw notFound('Demande');
        if (permanent === 'true') await purgeSubmissions(deps, [id], app.log);
        else await db.update(submissions).set({ deletedAt: new Date() }).where(eq(submissions.id, id));
        await audit(db, {
          userId: uid(req),
          action: permanent === 'true' ? 'submission.purge' : 'submission.delete',
          target: id,
          ipHash: req.ipHash,
        });
        const unread = await unreadCount(db);
        deps.realtime.publish({ type: 'submission.deleted', id, unread });
        return { ok: true, unread };
      });

      // ---- Statistiques et exports ------------------------------------------
      s.get('/stats', async () => computeStats(db));

      s.get('/export', async (req, reply) => {
        const { format } = parse(z.object({ format: z.enum(['csv', 'json']) }), req.query);
        const rows = await db
          .select()
          .from(submissions)
          .where(isNull(submissions.deletedAt))
          .orderBy(asc(submissions.receivedAt));
        const noteRows = await db.select().from(notes).orderBy(asc(notes.createdAt));
        const files = await db.select().from(attachments).where(eq(attachments.status, 'ready'));
        const notesOf = (id: string) => noteRows.filter((n) => n.submissionId === id).map((n) => n.body);
        const filesOf = (id: string) => files.filter((f) => f.submissionId === id).map((f) => f.filename);
        await audit(db, {
          userId: uid(req),
          action: 'export.all',
          meta: { format, count: rows.length },
          ipHash: req.ipHash,
        });
        const stamp = new Date().toISOString().slice(0, 10);
        if (format === 'json') {
          reply.header('content-disposition', `attachment; filename="demandes-${stamp}.json"`);
          return rows.map((r) => ({
            id: r.id,
            receivedAt: r.receivedAt.toISOString(),
            status: r.status,
            read: r.read,
            answers: r.answers,
            notes: notesOf(r.id),
            files: filesOf(r.id),
          }));
        }
        const header = [
          'id',
          'recu_le',
          'statut',
          'lu',
          ...allBlocks.map((b) => b.label),
          'notes',
          'fichiers',
        ];
        const lines = rows.map((r) =>
          [
            r.id,
            r.receivedAt.toISOString(),
            statusOf(r.status).label,
            r.read ? 'oui' : 'non',
            ...allBlocks.map((b) => displayValue(b, r.answers).replace(/\n/g, ' | ')),
            notesOf(r.id).join(' | '),
            filesOf(r.id).join(' | '),
          ]
            .map(csvCell)
            .join(';'),
        );
        reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', `attachment; filename="demandes-${stamp}.csv"`);
        return `\ufeff${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`;
      });

      // ---- Données personnelles (RGPD) ----------------------------------------
      s.get('/privacy/export', async (req) => {
        const { email } = parse(EraseInput, req.query);
        const rows = await db
          .select()
          .from(submissions)
          .where(sql`lower(${submissions.email}) = ${email.toLowerCase()}`);
        await audit(db, {
          userId: uid(req),
          action: 'privacy.export',
          target: sha256(email.toLowerCase()).slice(0, 16),
          meta: { count: rows.length },
          ipHash: req.ipHash,
        });
        const ids = rows.map((r) => r.id);
        const noteRows = ids.length
          ? await db.select().from(notes).where(inArray(notes.submissionId, ids))
          : [];
        return rows.map((r) => ({
          id: r.id,
          receivedAt: r.receivedAt.toISOString(),
          answers: r.answers,
          notes: noteRows.filter((n) => n.submissionId === r.id).map((n) => n.body),
        }));
      });

      s.post('/privacy/erase', async (req) => {
        const { email } = parse(EraseInput, req.body);
        const rows = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(sql`lower(${submissions.email}) = ${email.toLowerCase()}`);
        const count = await purgeSubmissions(
          deps,
          rows.map((r) => r.id),
          app.log,
        );
        await audit(db, {
          userId: uid(req),
          action: 'privacy.erase',
          target: sha256(email.toLowerCase()).slice(0, 16),
          meta: { count },
          ipHash: req.ipHash,
        });
        deps.realtime.publish({ type: 'submission.deleted', id: '', unread: await unreadCount(db) });
        return { deleted: count };
      });

      // ---- Notifications push et appareils -------------------------------------
      s.get('/push/key', async () => ({ publicKey: env.VAPID_PUBLIC_KEY }));

      s.post('/push/subscribe', async (req, reply) => {
        const input = parse(PushSubscriptionInput, req.body);
        const ua = String(req.headers['user-agent'] ?? '').slice(0, 300);
        const [row] = await db
          .insert(pushSubscriptions)
          .values({
            userId: uid(req),
            endpoint: input.endpoint,
            p256dh: input.keys.p256dh,
            auth: input.keys.auth,
            userAgent: ua,
            label: input.label?.trim() || deviceLabel(ua),
          })
          .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: {
              p256dh: input.keys.p256dh,
              auth: input.keys.auth,
              userAgent: ua,
              lastSeenAt: new Date(),
              userId: uid(req),
            },
          })
          .returning({ id: pushSubscriptions.id });
        await audit(db, { userId: uid(req), action: 'push.subscribe', target: row!.id, ipHash: req.ipHash });
        return reply.code(201).send({ id: row!.id });
      });

      s.post('/push/unsubscribe', async (req) => {
        const { endpoint } = parse(z.object({ endpoint: z.string().url() }).strict(), req.body);
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
        return { ok: true };
      });

      // Vrai push serveur, signé VAPID, vers l'appareil qui le demande.
      s.post('/push/test', async (req) => {
        const { endpoint } = parse(z.object({ endpoint: z.string().url() }).strict(), req.body);
        const [sub] = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, endpoint));
        if (!sub)
          throw new HttpError(404, 'appareil_inconnu', 'Cet appareil n’est pas abonné aux notifications.');
        const unread = await unreadCount(db);
        const code = await deps.push(sub, {
          title: 'Notification de contrôle',
          body: 'Les notifications fonctionnent sur cet appareil.',
          unread,
          tag: 'controle',
        });
        if (code === 404 || code === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          throw new HttpError(
            410,
            'abonnement_expire',
            'L’abonnement de cet appareil a expiré. Réactivez les notifications.',
          );
        }
        if (code < 200 || code >= 300)
          throw new HttpError(
            502,
            'push_refuse',
            'Le service de notifications a refusé l’envoi. Réessayez dans un instant.',
          );
        await audit(db, { userId: uid(req), action: 'push.test', target: sub.id, ipHash: req.ipHash });
        return { ok: true };
      });

      s.get('/devices', async (req): Promise<DeviceInfo[]> => {
        const { endpoint } = parse(z.object({ endpoint: z.string().optional() }), req.query);
        const rows = await db.select().from(pushSubscriptions).orderBy(asc(pushSubscriptions.createdAt));
        return rows.map((r) => ({
          id: r.id,
          label: r.label,
          userAgent: r.userAgent ?? '',
          createdAt: r.createdAt.toISOString(),
          lastSeenAt: r.lastSeenAt.toISOString(),
          current: r.endpoint === endpoint,
        }));
      });

      s.patch('/devices/:id', async (req) => {
        const { id } = parse(uuidParam, req.params);
        const { label } = parse(z.object({ label: z.string().trim().min(1).max(100) }).strict(), req.body);
        const res = await db
          .update(pushSubscriptions)
          .set({ label })
          .where(eq(pushSubscriptions.id, id))
          .returning({ id: pushSubscriptions.id });
        if (!res[0]) throw notFound('Appareil');
        return { ok: true };
      });

      s.delete('/devices/:id', async (req) => {
        const { id } = parse(uuidParam, req.params);
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
        await audit(db, { userId: uid(req), action: 'push.unsubscribe', target: id, ipHash: req.ipHash });
        return { ok: true };
      });

      // ---- Réglages -----------------------------------------------------------
      s.get('/settings', async () => getSettings(db));
      s.put('/settings', async (req) => {
        const input = parse(SettingsInput, req.body);
        await saveSettings(db, input);
        await audit(db, {
          userId: uid(req),
          action: 'settings.update',
          meta: { ...input, alertEmail: undefined },
          ipHash: req.ipHash,
        });
        return input;
      });

      // ---- Temps réel (Server-Sent Events) ---------------------------------------
      s.get('/events', (req, reply) => {
        reply.hijack();
        const res = reply.raw;
        const base: Record<string, string> = {};
        for (const [k, v] of Object.entries(reply.getHeaders())) if (v !== undefined) base[k] = String(v);
        res.writeHead(200, {
          ...base,
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        res.write('retry: 3000\n\nevent: ready\ndata: {}\n\n');
        deps.realtime.add(res);
        req.raw.on('close', () => res.end());
      });
    },
    { prefix: '/api/studio' },
  );
}
