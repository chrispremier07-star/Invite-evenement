import { z } from 'zod';
import { STATUS_IDS } from './statuses';
import { allBlocks, blockById, LIMITS, optionLabel, type Block } from './questions';

// Pas de compilation à la volée (new Function) : elle serait bloquée par la CSP stricte des pages.
z.config({ jitless: true });

export type Answers = Record<string, unknown>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TEL_RE = /^\+?[\d\s().-]{6,}$/;

export function isEmpty(v: unknown): boolean {
  return (
    v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim())
  );
}

/** Un bloc conditionnel est visible si la réponse liée contient la valeur attendue. */
export function isVisible(block: Block, answers: Answers): boolean {
  if (!block.showIf) return true;
  const v = answers[block.showIf.id];
  return Array.isArray(v) ? v.includes(block.showIf.has) : v === block.showIf.has;
}

function isRealDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Message d'erreur (en français) pour la valeur d'un bloc, ou chaîne vide si elle est valide.
 * Utilisé tel quel par le formulaire (aide à la saisie) et par le serveur (validation stricte).
 */
export function blockError(block: Block, value: unknown): string {
  const required = block.req ? block.err || 'Ce champ est nécessaire.' : '';
  if (block.kind === 'locations') {
    if (isEmpty(value)) return '';
    if (!Array.isArray(value) || value.length > LIMITS.locations) return 'Ajoutez cinq lieux au maximum.';
    if (value.some((x) => typeof x !== 'string' || x.length > LIMITS.text)) return 'Un lieu est trop long.';
    return '';
  }
  if (block.kind === 'file') {
    if (isEmpty(value)) return '';
    if (!Array.isArray(value) || value.length > LIMITS.files)
      return `Ajoutez ${LIMITS.files} fichiers au maximum.`;
    if (value.some((x) => typeof x !== 'string' || !/^[0-9a-f-]{36}$/i.test(x)))
      return 'Un fichier est invalide.';
    return '';
  }
  if (block.kind === 'range' || block.kind === 'scale') {
    if (isEmpty(value)) return '';
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Valeur invalide.';
    if (block.kind === 'range') {
      const min = block.min ?? 0;
      const max = block.max ?? 0;
      const step = block.step ?? 1;
      if (value < min || value > max || (value - min) % step !== 0) return 'Valeur invalide.';
    } else if (value < 0 || value >= (block.options?.length ?? 0)) return 'Valeur invalide.';
    return '';
  }
  if (block.kind === 'choice' || block.kind === 'toggles') {
    const labels = (block.options ?? []).map(optionLabel);
    const multi = block.multi || block.kind === 'toggles';
    if (isEmpty(value)) return required;
    if (multi) {
      if (!Array.isArray(value) || value.some((x) => typeof x !== 'string' || !labels.includes(x)))
        return 'Choix invalide.';
    } else if (typeof value !== 'string' || !labels.includes(value)) return 'Choix invalide.';
    return '';
  }
  // text | area
  if (isEmpty(value)) return required;
  if (typeof value !== 'string') return 'Valeur invalide.';
  const max = block.kind === 'area' ? LIMITS.area : LIMITS.text;
  if (value.length > max) return `Ce texte est trop long (${max} caractères au maximum).`;
  if (block.vt === 'email' && !EMAIL_RE.test(value)) return 'Cette adresse e-mail semble incomplète.';
  if (block.vt === 'tel' && !TEL_RE.test(value)) return 'Ce numéro semble incomplet.';
  if (block.type === 'date' && !isRealDate(value)) return 'Cette date est invalide.';
  return '';
}

export type AnswersResult = { ok: true; answers: Answers } | { ok: false; errors: Record<string, string> };

/** Validation stricte des réponses : clés inconnues refusées, blocs masqués ignorés, valeurs nettoyées. */
export function validateAnswers(raw: unknown): AnswersResult {
  const errors: Record<string, string> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { ok: false, errors: { _: 'Réponses invalides.' } };
  const input = raw as Answers;
  for (const k of Object.keys(input)) if (!blockById.has(k)) errors[k] = 'Champ inconnu.';
  const answers: Answers = {};
  for (const block of allBlocks) {
    if (!isVisible(block, input)) continue;
    let v = input[block.id];
    if (typeof v === 'string') v = v.trim();
    const msg = blockError(block, v);
    if (msg) {
      errors[block.id] = msg;
      continue;
    }
    if (!isEmpty(v)) answers[block.id] = v;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}

const uuid = z.string().uuid();

export const SubmissionInput = z
  .object({
    idempotencyKey: uuid,
    answers: z.record(z.string(), z.unknown()),
    consent: z.literal(true, { message: 'Le consentement est nécessaire pour envoyer votre demande.' }),
    turnstileToken: z.string().min(1, 'La vérification anti-robot est nécessaire.').max(4096),
    /** Piège à robots : un humain ne le remplit jamais. */
    site_web: z.string().max(200).optional(),
    timeZone: z.string().max(64).optional(),
    page: z.string().max(500).optional(),
  })
  .strict();
export type SubmissionInput = z.infer<typeof SubmissionInput>;

export const PresignInput = z
  .object({
    filename: z.string().min(1).max(200),
    contentType: z.enum(LIMITS.fileTypes),
    size: z.number().int().positive().max(LIMITS.fileBytes),
  })
  .strict();
export type PresignInput = z.infer<typeof PresignInput>;

export const StatusInput = z.object({ status: z.enum(STATUS_IDS) }).strict();
export const NoteInput = z.object({ id: uuid, body: z.string().trim().min(1).max(4000) }).strict();
export const ListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...STATUS_IDS, 'active', 'all']).default('active'),
  sort: z.enum(['received_desc', 'received_asc', 'event_asc']).default('received_desc'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(200).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

export const SettingsInput = z
  .object({
    responseDelayHours: z
      .number()
      .int()
      .min(1)
      .max(24 * 30),
    alertEmail: z.string().regex(EMAIL_RE, 'Adresse e-mail invalide.'),
    retentionDays: z.number().int().min(30).max(3650),
    notifyByEmail: z.boolean(),
  })
  .strict();
export type SettingsInput = z.infer<typeof SettingsInput>;

export const PushSubscriptionInput = z
  .object({
    endpoint: z.string().url().max(2000),
    /** Champ standard de PushSubscription.toJSON(), inutilisé côté serveur. */
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
    label: z.string().max(100).optional(),
  })
  .strict();
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

export const LoginInput = z.object({ email: z.string().regex(EMAIL_RE) }).strict();
export const EraseInput = z.object({ email: z.string().regex(EMAIL_RE) }).strict();
