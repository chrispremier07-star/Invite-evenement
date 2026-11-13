import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: ts('created_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
  },
  (t) => [index('sessions_expires_idx').on(t.expiresAt)],
);

export const loginTokens = pgTable('login_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
});

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receivedAt: ts('received_at').notNull().defaultNow(),
    status: text('status').notNull().default('new'),
    read: boolean('read').notNull().default(false),
    firstReadAt: ts('first_read_at'),
    /** Réponses du client, validées par le schéma partagé avant insertion. */
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
    source: text('source').notNull(),
    ipHash: text('ip_hash').notNull(),
    timeZone: text('time_zone'),
    idempotencyKey: uuid('idempotency_key').notNull().unique(),
    consentAt: ts('consent_at').notNull(),
    policyVersion: text('policy_version').notNull(),
    deletedAt: ts('deleted_at'),
    // Colonnes dérivées des réponses (liste, statistiques, recherche, effacement par e-mail)
    name: text('name').notNull(),
    email: text('email').notNull(),
    eventType: text('event_type'),
    eventDate: date('event_date', { mode: 'string' }),
    guests: integer('guests'),
    firstPlace: text('first_place'),
    budget: text('budget'),
    searchText: text('search_text').notNull(),
    // Colonne `search` (tsvector généré) et index GIN : voir la migration SQL 0001.
  },
  (t) => [
    index('submissions_status_idx').on(t.status),
    index('submissions_received_idx').on(t.receivedAt.desc()),
    index('submissions_event_date_idx').on(t.eventDate),
    index('submissions_email_idx').on(sql`lower(${t.email})`),
    check('submissions_status_check', sql`${t.status} in ('new','progress','quote','signed','archived')`),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('notes_submission_idx').on(t.submissionId, t.createdAt)],
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    status: text('status').notNull().default('pending'),
    ipHash: text('ip_hash'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('attachments_submission_idx').on(t.submissionId),
    index('attachments_created_idx').on(t.createdAt),
  ],
);

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  label: text('label').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: ts('at').notNull().defaultNow(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    target: text('target'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
  },
  (t) => [index('audit_at_idx').on(t.at.desc())],
);

export const settings = pgTable(
  'settings',
  {
    id: smallint('id').primaryKey().default(1),
    responseDelayHours: integer('response_delay_hours').notNull(),
    alertEmail: text('alert_email').notNull(),
    retentionDays: integer('retention_days').notNull(),
    notifyByEmail: boolean('notify_by_email').notNull().default(true),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [check('settings_singleton', sql`${t.id} = 1`)],
);
