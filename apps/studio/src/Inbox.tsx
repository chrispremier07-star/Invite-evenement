import { useCallback, useEffect, useRef, useState } from 'react';
import {
  STATUSES,
  formatDateFr,
  initials,
  statusOf,
  studioGroups,
  type ListResponse,
  type StatusId,
  type SubmissionDetail,
  type SubmissionSummary,
} from '@cree/shared';
import { ApiFail, NetworkError, getCached, mutate, request } from './api';
import { AVATARS, download, fileSize, rel } from './fmt';
import { bus } from './bus';

type Filter = StatusId | 'active';
const emptyCounts = { new: 0, progress: 0, quote: 0, signed: 0, archived: 0, active: 0, all: 0 };

interface Props {
  selId: string | null;
  onSelect(id: string | null): void;
  onUnread(n: number): void;
  onOffline(offline: boolean): void;
  onPending(): void;
  toast(title: string, body: string): void;
}

export function Inbox({ selId, onSelect, onUnread, onOffline, onPending, toast }: Props) {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [counts, setCounts] = useState<ListResponse['counts']>(emptyCounts);
  const [unread, setUnread] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [sort, setSort] = useState<'received_desc' | 'received_asc' | 'event_asc'>('received_desc');
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailErr, setDetailErr] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const selRef = useRef(selId);
  useEffect(() => {
    selRef.current = selId;
  }, [selId]);

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const query = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams({ status: filter, sort, limit: '30' });
      if (dq) p.set('q', dq);
      if (cursor) p.set('cursor', cursor);
      return `/studio/submissions?${p}`;
    },
    [filter, sort, dq],
  );

  const loadList = useCallback(async () => {
    try {
      const { data, offline } = await getCached<ListResponse>(query());
      setItems(data.items);
      setCounts(data.counts);
      setUnread(data.unread);
      onUnread(data.unread);
      setNext(data.nextCursor);
      setError('');
      onOffline(offline);
    } catch (e) {
      setError(
        e instanceof NetworkError
          ? 'Pas de connexion et aucune donnée en mémoire.'
          : e instanceof ApiFail
            ? e.message
            : 'Chargement impossible.',
      );
    } finally {
      setLoaded(true);
    }
  }, [query, onUnread, onOffline]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadMore = async () => {
    if (!next) return;
    try {
      const data = await request<ListResponse>('GET', query(next));
      setItems((cur) => [...cur, ...data.items]);
      setNext(data.nextCursor);
    } catch (e) {
      toast('Chargement impossible', e instanceof ApiFail ? e.message : 'Vérifiez votre connexion.');
    }
  };

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const { data } = await getCached<SubmissionDetail>(`/studio/submissions/${id}`);
        setDetail(data);
        setDetailErr('');
        if (!data.read) {
          setItems((cur) => cur.map((x) => (x.id === id ? { ...x, read: true } : x)));
          setUnread((u) => {
            const n = Math.max(0, u - (data.status === 'archived' ? 0 : 1));
            onUnread(n);
            return n;
          });
          const r = await mutate({ method: 'POST', path: `/studio/submissions/${id}/read` });
          if (r === 'queued') onPending();
        }
      } catch (e) {
        setDetail(null);
        setDetailErr(
          e instanceof ApiFail && e.status === 404
            ? 'Cette demande n’existe plus.'
            : 'Cette demande n’a pas pu être chargée.',
        );
      }
    },
    [onUnread, onPending],
  );

  useEffect(() => {
    setDetail(null);
    setDetailErr('');
    setNote('');
    if (selId) void loadDetail(selId);
  }, [selId, loadDetail]);

  // Temps réel : une nouvelle demande ou une modification faite sur un autre appareil rafraîchit l'écran.
  useEffect(() => {
    const on = (e: Event) => {
      const ev = (e as CustomEvent<{ type: string; id: string }>).detail;
      void loadList();
      if (selRef.current && (ev.id === selRef.current || ev.type === 'reconnect')) {
        request<SubmissionDetail>('GET', `/studio/submissions/${selRef.current}`)
          .then(setDetail)
          .catch(() => {
            if (ev.type === 'submission.deleted') {
              setDetail(null);
              onSelect(null);
            }
          });
      }
    };
    bus.addEventListener('rt', on);
    return () => bus.removeEventListener('rt', on);
  }, [loadList, onSelect]);

  const setStatus = async (id: string, status: StatusId) => {
    const before = detail?.status;
    if (before === status) return;
    setDetail((d) => (d ? { ...d, status } : d));
    setItems((cur) => cur.map((x) => (x.id === id ? { ...x, status } : x)));
    if (before)
      setCounts((c) => ({
        ...c,
        [before]: c[before] - 1,
        [status]: c[status] + 1,
        active: c.active + (status === 'archived' ? 0 : 1) - (before === 'archived' ? 0 : 1),
      }));
    try {
      const r = await mutate({ method: 'PATCH', path: `/studio/submissions/${id}/status`, body: { status } });
      if (r === 'queued') {
        onPending();
        toast('Hors ligne', 'Le changement de statut sera envoyé au retour du réseau.');
      } else void loadList();
    } catch (e) {
      toast('Statut non modifié', e instanceof ApiFail ? e.message : 'Réessayez.');
      void loadList();
    }
  };

  const addNote = async () => {
    if (!detail || !note.trim()) return;
    const n = { id: crypto.randomUUID(), body: note.trim(), createdAt: new Date().toISOString() };
    setDetail({ ...detail, notes: [...detail.notes, n] });
    setNote('');
    try {
      const r = await mutate({
        method: 'POST',
        path: `/studio/submissions/${detail.id}/notes`,
        body: { id: n.id, body: n.body },
      });
      if (r === 'queued') {
        onPending();
        toast('Hors ligne', 'La note sera enregistrée au retour du réseau.');
      }
    } catch (e) {
      setDetail((d) => (d ? { ...d, notes: d.notes.filter((x) => x.id !== n.id) } : d));
      setNote(n.body);
      toast('Note non enregistrée', e instanceof ApiFail ? e.message : 'Réessayez.');
    }
  };

  const remove = async (permanent: boolean) => {
    if (!detail) return;
    const ok = confirm(
      permanent
        ? 'Supprimer définitivement cette demande, ses notes et ses fichiers ? Cette action est irréversible.'
        : 'Déplacer cette demande dans la corbeille ? Elle sera supprimée définitivement après le délai de purge.',
    );
    if (!ok) return;
    try {
      const r = await mutate({
        method: 'DELETE',
        path: `/studio/submissions/${detail.id}${permanent ? '?permanent=true' : ''}`,
      });
      if (r === 'queued') onPending();
      setItems((cur) => cur.filter((x) => x.id !== detail.id));
      onSelect(null);
      void loadList();
    } catch (e) {
      toast('Suppression impossible', e instanceof ApiFail ? e.message : 'Réessayez.');
    }
  };

  const filters: Array<{ id: Filter; label: string; color?: string; count: number }> = [
    { id: 'active', label: 'Actives', count: counts.active },
    ...STATUSES.map((s) => ({ id: s.id as Filter, label: s.label, color: s.color, count: counts[s.id] })),
  ];
  const inboxSub = !loaded
    ? 'Chargement…'
    : unread
      ? `${unread} nouvelle${unread > 1 ? 's' : ''} demande${unread > 1 ? 's' : ''} à lire`
      : counts.all
        ? 'Toutes les demandes sont lues'
        : 'En attente de la première demande';
  const empty = loaded && !error && counts.all === 0;

  return (
    <div className="st-split" data-d={selId ? 'true' : 'false'}>
      <section
        className="st-list"
        aria-label="Demandes"
        style={{ padding: 'clamp(16px,3vw,24px) clamp(12px,2vw,16px)' }}
      >
        <div style={{ padding: '0 4px' }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 450, letterSpacing: '-.04em' }}>Demandes</h1>
          <p style={{ margin: '6px 0 16px', fontSize: 14, color: '#625C78' }} aria-live="polite">
            {inboxSub}
          </p>
          <label
            htmlFor="st-q"
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
          >
            Rechercher
          </label>
          <input
            id="st-q"
            className="st-in"
            type="search"
            placeholder="Rechercher un nom, un lieu, un type…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              padding: '12px 0 8px 4px',
              margin: '0 -4px',
              scrollbarWidth: 'none',
            }}
            role="group"
            aria-label="Filtrer par statut"
          >
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className="st-chip"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.color && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: f.color }} />
                )}
                {f.label}
                <span className="c">{f.count}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 12px' }}>
            <label htmlFor="st-sort" style={{ fontSize: 13, color: '#625C78' }}>
              Trier par
            </label>
            <select
              id="st-sort"
              className="st-in"
              style={{ minHeight: 40, padding: '0 10px', width: 'auto' }}
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="received_desc">Plus récentes</option>
              <option value="received_asc">Plus anciennes</option>
              <option value="event_asc">Date de l’événement</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {items.map((r, i) => {
            const st = statusOf(r.status);
            const meta = [
              r.type,
              r.eventDate
                ? formatDateFr(r.eventDate, { day: 'numeric', month: 'short', year: 'numeric' })
                : '',
              r.guests ? `${r.guests} inv.` : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={r.id}
                type="button"
                className="st-row"
                aria-current={r.id === selId}
                onClick={() => onSelect(r.id)}
                style={{ animation: `stIn .4s ${Math.min(i, 8) * 30}ms both` }}
              >
                <span
                  style={{
                    gridRow: 'span 2',
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: AVATARS[r.name.length % AVATARS.length],
                    font: "500 14px/1 'Geist Variable',sans-serif",
                    color: '#15112A',
                    position: 'relative',
                  }}
                >
                  {initials(r.name)}
                  {!r.read && (
                    <span
                      aria-label="Non lue"
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: '#6A3DE8',
                        border: '2px solid #F5F2FC',
                        animation: 'stPulse 1.8s ease-out 3',
                      }}
                    />
                  )}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    fontSize: 15,
                    fontWeight: r.read ? 450 : 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.name || 'Sans nom'}
                </span>
                <span
                  style={{
                    font: "400 12px/1 'Geist Mono Variable',monospace",
                    color: '#625C78',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rel(r.receivedAt)}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    fontSize: 13,
                    color: '#625C78',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {meta}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: '#3A3550',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />
                  {st.label}
                </span>
              </button>
            );
          })}
          {empty && (
            <p
              style={{
                padding: '32px 12px',
                textAlign: 'center',
                color: '#625C78',
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              Aucune demande pour l’instant. Celles que vos clients envoient depuis le formulaire apparaîtront
              ici dès leur arrivée.
            </p>
          )}
          {loaded && !error && !empty && items.length === 0 && (
            <p style={{ padding: '32px 12px', textAlign: 'center', color: '#625C78', fontSize: 15 }}>
              Aucune demande ne correspond.
            </p>
          )}
          {error && (
            <p
              role="alert"
              style={{ padding: '24px 12px', textAlign: 'center', color: '#9B1C3F', fontSize: 15 }}
            >
              {error}{' '}
              <button type="button" className="st-gh" onClick={() => void loadList()}>
                Réessayer
              </button>
            </p>
          )}
          {!loaded && !error && (
            <p
              style={{ padding: '32px 12px', textAlign: 'center', color: '#625C78', fontSize: 15 }}
              role="status"
            >
              Chargement…
            </p>
          )}
          {next && (
            <button
              type="button"
              className="st-gh"
              style={{ justifySelf: 'center', margin: '8px 0' }}
              onClick={() => void loadMore()}
            >
              Afficher plus
            </button>
          )}
        </div>
      </section>

      <section
        className="st-detail"
        aria-label="Détail de la demande"
        style={{ padding: 'clamp(16px,3vw,32px)' }}
      >
        {detail ? (
          <Detail
            d={detail}
            note={note}
            setNote={setNote}
            addNote={addNote}
            setStatus={setStatus}
            remove={remove}
            copied={copied}
            setCopied={setCopied}
            onBack={() => onSelect(null)}
          />
        ) : selId ? (
          <p
            style={{ textAlign: 'center', color: detailErr ? '#9B1C3F' : '#625C78', padding: 40 }}
            role={detailErr ? 'alert' : 'status'}
          >
            {detailErr || 'Chargement…'}
          </p>
        ) : (
          <div
            style={{
              height: '100%',
              minHeight: '50vh',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              color: '#625C78',
            }}
          >
            <div>
              <div
                aria-hidden="true"
                style={{
                  width: 72,
                  height: 72,
                  margin: '0 auto 18px',
                  borderRadius: '50%',
                  border: '14px solid rgba(123,82,240,.18)',
                }}
              />
              <p style={{ margin: 0, fontSize: 16 }}>Sélectionnez une demande pour la consulter.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail(p: {
  d: SubmissionDetail;
  note: string;
  setNote(v: string): void;
  addNote(): void;
  setStatus(id: string, s: StatusId): void;
  remove(permanent: boolean): void;
  copied: boolean;
  setCopied(v: boolean): void;
  onBack(): void;
}) {
  const { d } = p;
  const a = d.answers;
  const st = statusOf(d.status);
  const names = new Map(d.attachments.map((f) => [f.id, f.filename] as const));
  const groups = studioGroups(a, names);
  const first = String(a.nom ?? '').split(' ')[0];
  const tel = typeof a.tel === 'string' ? a.tel : '';
  const meta = [d.type, d.eventDate ? formatDateFr(d.eventDate) : '', d.guests ? `≈ ${d.guests} invités` : '']
    .filter(Boolean)
    .join(' · ');
  const summary = () =>
    `${a.nom}\n\n${groups
      .map(
        (g) =>
          `${g.title}\n${g.rows
            .filter((r) => r.value)
            .map((r) => `${r.label} : ${r.value}`)
            .join('\n')}`,
      )
      .join('\n\n')}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      p.setCopied(true);
      setTimeout(() => p.setCopied(false), 1600);
    } catch {
      /* presse-papiers refusé */
    }
  };
  return (
    <div
      style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 16, animation: 'stIn .45s both' }}
      key={d.id}
    >
      <button type="button" className="st-gh st-back" style={{ justifySelf: 'start' }} onClick={p.onBack}>
        ← Demandes
      </button>
      <div className="st-card" style={{ display: 'grid', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p className="st-lb" style={{ margin: '0 0 10px' }}>
              Reçue le{' '}
              {formatDateFr(d.receivedAt, {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(26px,4vw,36px)',
                fontWeight: 450,
                letterSpacing: '-.04em',
                lineHeight: 1.05,
              }}
            >
              {d.name || 'Sans nom'}
            </h2>
            <p style={{ margin: '10px 0 0', fontSize: 16, color: '#3A3550' }}>{meta}</p>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(123,82,240,.08)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
            {st.label}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <a
            className="st-btn"
            href={`mailto:${String(a.email ?? '')}?subject=${encodeURIComponent(`Votre invitation ${d.type.toLowerCase()} — Crée`)}&body=${encodeURIComponent(`Bonjour ${first},\n\nMerci pour votre demande. `)}`}
          >
            Répondre par e-mail
          </a>
          {tel && (
            <>
              <a className="st-gh" href={`tel:${tel.replace(/\s/g, '')}`}>
                Appeler
              </a>
              <a
                className="st-gh"
                href={`https://wa.me/${tel.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener"
              >
                WhatsApp
              </a>
            </>
          )}
          <button type="button" className="st-gh" onClick={() => void copy()}>
            {p.copied ? 'Copié' : 'Copier le résumé'}
          </button>
          <button
            type="button"
            className="st-gh"
            onClick={() =>
              download(
                `demande-${(d.name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
                JSON.stringify(d, null, 2),
                'application/json',
              )
            }
          >
            Exporter
          </button>
        </div>
        <div style={{ borderTop: '1px solid rgba(123,82,240,.12)', paddingTop: 16 }}>
          <p className="st-lb" style={{ margin: '0 0 10px' }}>
            Statut
          </p>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
            role="group"
            aria-label="Changer le statut"
          >
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="st-chip"
                aria-pressed={d.status === s.id}
                onClick={() => p.setStatus(d.id, s.id)}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="st-card">
        <label htmlFor="st-notes" className="st-lb" style={{ display: 'block', marginBottom: 10 }}>
          Notes internes
        </label>
        {d.notes.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'grid', gap: 10 }}>
            {d.notes.map((n) => (
              <li
                key={n.id}
                style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(123,82,240,.06)' }}
              >
                <span style={{ display: 'block', fontSize: 12, color: '#625C78', marginBottom: 4 }}>
                  {formatDateFr(n.createdAt, {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span
                  style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
                >
                  {n.body}
                </span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          id="st-notes"
          className="st-in"
          placeholder="Premier appel, idées, points à vérifier…"
          value={p.note}
          maxLength={4000}
          onChange={(e) => p.setNote(e.target.value)}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#625C78' }}>
            Visibles par vous seul, enregistrées sur le serveur.
          </p>
          <button type="button" className="st-btn" disabled={!p.note.trim()} onClick={p.addNote}>
            Ajouter la note
          </button>
        </div>
      </div>

      {groups.map((g, i) => (
        <div className="st-card" key={g.title}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <span style={{ font: "500 13px/1 'Geist Mono Variable',monospace", color: '#5A36D6' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 500, letterSpacing: '-.02em' }}>{g.title}</h3>
          </div>
          <dl
            style={{
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))',
              gap: '16px 24px',
            }}
          >
            {g.rows.map((r) => (
              <div key={r.key} style={{ minWidth: 0, gridColumn: r.wide ? '1 / -1' : 'auto' }}>
                <dt style={{ fontSize: 13, color: '#625C78', marginBottom: 5 }}>{r.label}</dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-line',
                    color: r.value || r.key === 'fichiers' ? '#15112A' : '#8A849C',
                  }}
                >
                  {r.key === 'fichiers' && d.attachments.length > 0 ? (
                    <span style={{ display: 'grid', gap: 6 }}>
                      {d.attachments.map((f) => (
                        <a key={f.id} href={f.url} rel="noopener">
                          {f.filename}{' '}
                          <span style={{ color: '#625C78', fontSize: 13 }}>({fileSize(f.size)})</span>
                        </a>
                      ))}
                    </span>
                  ) : (
                    <>
                      {r.swatches.length > 0 && (
                        <span style={{ display: 'inline-flex', verticalAlign: -3, marginRight: 8 }}>
                          {r.swatches.map((c) => (
                            <span
                              key={c}
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                marginRight: -4,
                                border: '1px solid rgba(21,17,42,.15)',
                                background: c,
                              }}
                            />
                          ))}
                        </span>
                      )}
                      {r.value || 'Non renseigné'}
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, paddingBottom: 12 }}
      >
        <button type="button" className="st-gh" onClick={() => p.remove(false)} style={{ color: '#9B1C3F' }}>
          Mettre à la corbeille
        </button>
        <button type="button" className="st-gh" onClick={() => p.remove(true)} style={{ color: '#9B1C3F' }}>
          Supprimer définitivement
        </button>
      </div>
    </div>
  );
}
