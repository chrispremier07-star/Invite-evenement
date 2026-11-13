import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import {
  BUDGET_OPTIONS,
  TYPE_OPTIONS,
  STATUS_IDS,
  isVisible,
  allBlocks,
  displayValue,
  type Answers,
  type DistributionItem,
  type ListQuery,
  type Stats,
  type StatusId,
  type SubmissionSummary,
} from '@cree/shared';
import type { Db } from '../db';
import { submissions } from '../db/schema';
import { normalizeSearch, toTsQuery } from '../util';

/** Colonnes dérivées des réponses (liste, tri, statistiques), calculées une seule fois à l'insertion. */
export function deriveColumns(answers: Answers) {
  const str = (k: string) => (typeof answers[k] === 'string' ? (answers[k] as string) : null);
  const type = str('type') === 'Autre' && str('type_autre') ? str('type_autre') : str('type');
  const places = Array.isArray(answers.lieux) ? (answers.lieux as string[]) : [];
  const searchParts = allBlocks
    .filter((b) => b.kind !== 'file' && isVisible(b, answers))
    .map((b) => displayValue(b, answers))
    .filter(Boolean);
  return {
    name: str('nom') ?? '',
    email: (str('email') ?? '').toLowerCase(),
    eventType: type,
    eventDate: str('date'),
    guests: typeof answers.invites === 'number' ? answers.invites : null,
    firstPlace: places[0] ?? null,
    budget: str('budget'),
    searchText: normalizeSearch(searchParts.join(' ')),
  };
}

export function toSummary(r: typeof submissions.$inferSelect): SubmissionSummary {
  return {
    id: r.id,
    receivedAt: r.receivedAt.toISOString(),
    status: r.status as StatusId,
    read: r.read,
    name: r.name,
    type: r.eventType ?? 'Événement',
    eventDate: r.eventDate,
    guests: r.guests,
    firstPlace: r.firstPlace,
  };
}

interface Cursor {
  v: string;
  id: string;
}
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor;
    return typeof c.v === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

export async function unreadCount(db: Db): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(
      and(
        isNull(submissions.deletedAt),
        eq(submissions.read, false),
        sql`${submissions.status} <> 'archived'`,
      ),
    );
  return r?.n ?? 0;
}

export async function listSubmissions(db: Db, q: ListQuery) {
  const conds: SQL[] = [isNull(submissions.deletedAt)];
  if (q.status === 'active') conds.push(sql`${submissions.status} <> 'archived'`);
  else if (q.status !== 'all') conds.push(eq(submissions.status, q.status));
  const tsq = q.q ? toTsQuery(q.q) : null;
  if (q.q && !tsq) conds.push(sql`false`);
  if (tsq) conds.push(sql`search @@ to_tsquery('simple', ${tsq})`);

  const cursor = decodeCursor(q.cursor);
  let order: SQL[];
  if (q.sort === 'received_asc') {
    order = [sql`${submissions.receivedAt} asc`, sql`${submissions.id} asc`];
    if (cursor)
      conds.push(
        sql`(${submissions.receivedAt}, ${submissions.id}) > (${cursor.v}::timestamptz, ${cursor.id}::uuid)`,
      );
  } else if (q.sort === 'event_asc') {
    // Date d'événement croissante, demandes sans date en dernier ; clé de curseur : date ou « 9999-12-31 ».
    order = [sql`coalesce(${submissions.eventDate}, date '9999-12-31') asc`, sql`${submissions.id} asc`];
    if (cursor)
      conds.push(
        sql`(coalesce(${submissions.eventDate}, date '9999-12-31'), ${submissions.id}) > (${cursor.v}::date, ${cursor.id}::uuid)`,
      );
  } else {
    order = [sql`${submissions.receivedAt} desc`, sql`${submissions.id} desc`];
    if (cursor)
      conds.push(
        sql`(${submissions.receivedAt}, ${submissions.id}) < (${cursor.v}::timestamptz, ${cursor.id}::uuid)`,
      );
  }

  const rows = await db
    .select()
    .from(submissions)
    .where(and(...conds))
    .orderBy(...order)
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  let nextCursor: string | null = null;
  if (rows.length > q.limit && last) {
    const v = q.sort === 'event_asc' ? (last.eventDate ?? '9999-12-31') : last.receivedAt.toISOString();
    nextCursor = encodeCursor({ v, id: last.id });
  }

  const counts = await statusCounts(db);
  return { items: page.map(toSummary), nextCursor, counts, unread: await unreadCount(db) };
}

export async function statusCounts(db: Db): Promise<Record<StatusId | 'active' | 'all', number>> {
  const rows = await db
    .select({ status: submissions.status, n: sql<number>`count(*)::int` })
    .from(submissions)
    .where(isNull(submissions.deletedAt))
    .groupBy(submissions.status);
  const out = { new: 0, progress: 0, quote: 0, signed: 0, archived: 0, active: 0, all: 0 } as Record<
    StatusId | 'active' | 'all',
    number
  >;
  for (const r of rows) {
    out[r.status as StatusId] = r.n;
    out.all += r.n;
    if (r.status !== 'archived') out.active += r.n;
  }
  return out;
}

async function distribution(
  db: Db,
  column: 'event_type' | 'budget',
  fixed: string[],
): Promise<DistributionItem[]> {
  const res = await db.execute<{ label: string; n: number }>(
    sql`select ${sql.raw(column)} as label, count(*)::int as n from submissions where deleted_at is null and status <> 'archived' and ${sql.raw(column)} is not null group by 1`,
  );
  const counts = new Map(res.rows.map((r) => [r.label, r.n]));
  const items = fixed.map((label) => ({ label, count: counts.get(label) ?? 0 }));
  // Types libres saisis via « Autre » : regroupés sous « Autre ».
  if (column === 'event_type') {
    const known = new Set(fixed);
    const other = res.rows.filter((r) => !known.has(r.label)).reduce((a, r) => a + r.n, 0);
    const o = items.find((i) => i.label === 'Autre');
    if (o) o.count += other;
  }
  return items;
}

/** Statistiques du tableau de bord : tout est calculé en SQL à chaque appel. */
export async function computeStats(db: Db): Promise<Stats> {
  const agg = await db.execute<{
    total: number;
    active: number;
    unread: number;
    week: number;
    signed: number;
    archived: number;
    avg_read_hours: number | null;
  }>(sql`
    select count(*)::int as total,
      count(*) filter (where status <> 'archived')::int as active,
      count(*) filter (where not read and status <> 'archived')::int as unread,
      count(*) filter (where received_at > now() - interval '7 days')::int as week,
      count(*) filter (where status = 'signed')::int as signed,
      count(*) filter (where status = 'archived')::int as archived,
      (avg(extract(epoch from (first_read_at - received_at)) / 3600) filter (where first_read_at is not null))::float8 as avg_read_hours
    from submissions where deleted_at is null`);
  const a = agg.rows[0]!;
  const decided = a.signed + a.archived;
  const counts = await statusCounts(db);
  const pipeline = Object.fromEntries(STATUS_IDS.map((s) => [s, counts[s]])) as Record<StatusId, number>;

  const up = await db.execute<{
    id: string;
    name: string;
    type: string | null;
    event_date: string;
    days: number;
    place: string | null;
    status: StatusId;
  }>(sql`
    select id, name, event_type as type, to_char(event_date, 'YYYY-MM-DD') as event_date, (event_date - current_date)::int as days, first_place as place, status
    from submissions where deleted_at is null and status <> 'archived' and event_date >= current_date
    order by event_date asc, id asc limit 6`);
  const upcoming = up.rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type ?? 'Événement',
    eventDate: r.event_date,
    daysLeft: r.days,
    firstPlace: r.place,
    status: r.status,
  }));
  const next = upcoming[0];
  return {
    unread: a.unread,
    receivedThisWeek: a.week,
    total: a.total,
    active: a.active,
    signed: a.signed,
    decided,
    signatureRate: decided ? Math.round((a.signed / decided) * 100) : null,
    avgReadHours: a.avg_read_hours,
    pipeline,
    byType: await distribution(db, 'event_type', TYPE_OPTIONS),
    byBudget: await distribution(db, 'budget', BUDGET_OPTIONS),
    upcoming,
    nextEvent: next ? { name: next.name, type: next.type, daysLeft: next.daysLeft } : null,
  };
}
