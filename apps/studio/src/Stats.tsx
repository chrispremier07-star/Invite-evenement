import { useCallback, useEffect, useState } from 'react';
import { STATUSES, statusOf, type Stats as StatsData } from '@cree/shared';
import { ApiFail, getCached } from './api';
import { bus } from './bus';
import { dayAndMonth, hours } from './fmt';

export function Stats(props: { onOpen(id: string): void; onOffline(o: boolean): void }) {
  const [s, setS] = useState<StatsData | null>(null);
  const [error, setError] = useState('');
  const { onOffline } = props;

  const load = useCallback(async () => {
    try {
      const r = await getCached<StatsData>('/studio/stats');
      setS(r.data);
      setError('');
      onOffline(r.offline);
    } catch (e) {
      setError(e instanceof ApiFail ? e.message : 'Les statistiques ne sont pas disponibles sans connexion.');
    }
  }, [onOffline]);

  useEffect(() => {
    void load();
    const on = () => void load();
    bus.addEventListener('rt', on);
    return () => bus.removeEventListener('rt', on);
  }, [load]);

  if (!s) {
    return (
      <p
        style={{ padding: 40, textAlign: 'center', color: error ? '#9B1C3F' : '#625C78' }}
        role={error ? 'alert' : 'status'}
      >
        {error || 'Chargement…'}
      </p>
    );
  }

  const kpis = [
    {
      label: 'Non lues',
      value: String(s.unread),
      hint: s.unread ? 'À traiter en priorité' : 'Tout est à jour',
    },
    { label: 'Reçues cette semaine', value: String(s.receivedThisWeek), hint: `${s.total} au total` },
    {
      label: 'Taux de signature',
      value: s.signatureRate == null ? '—' : `${s.signatureRate} %`,
      hint: `${s.signed} signée(s) sur ${s.decided} conclue(s)`,
    },
    {
      label: 'Prochain événement',
      value: s.nextEvent ? `J-${s.nextEvent.daysLeft}` : '—',
      hint: s.nextEvent ? `${s.nextEvent.name} · ${s.nextEvent.type}` : 'Aucun',
    },
    {
      label: 'Délai de lecture moyen',
      value: hours(s.avgReadHours),
      hint: 'Entre réception et première lecture',
    },
  ];
  const maxOf = (items: Array<{ count: number }>) => Math.max(1, ...items.map((i) => i.count));

  if (s.total === 0) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(16px,3vw,36px)' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 450, letterSpacing: '-.04em' }}>Vue d'ensemble</h1>
        <p style={{ margin: '24px 0 0', fontSize: 16, color: '#625C78', lineHeight: 1.5 }}>
          Les statistiques apparaîtront dès la première demande reçue.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(16px,3vw,36px)', display: 'grid', gap: 16 }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 450, letterSpacing: '-.04em' }}>Vue d'ensemble</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#625C78' }}>
          {s.active} demande{s.active > 1 ? 's' : ''} active{s.active > 1 ? 's' : ''}
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
          gap: 12,
        }}
      >
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="st-card"
            style={{ display: 'grid', gap: 10, animation: `stIn .45s ${i * 50}ms both` }}
          >
            <span style={{ fontSize: 14, color: '#625C78' }}>{k.label}</span>
            <span
              style={{
                fontSize: 'clamp(28px,4vw,38px)',
                fontWeight: 450,
                letterSpacing: '-.04em',
                lineHeight: 1,
              }}
            >
              {k.value}
            </span>
            <span style={{ fontSize: 13, color: '#625C78' }}>{k.hint}</span>
          </div>
        ))}
      </div>
      <div className="st-card">
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 500 }}>Suivi des demandes</h2>
        <div
          style={{
            display: 'flex',
            height: 14,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'rgba(123,82,240,.08)',
            gap: 2,
          }}
        >
          {STATUSES.map((t) => (
            <div
              key={t.id}
              title={t.label}
              style={{
                width: `${(s.pipeline[t.id] / s.total) * 100}%`,
                background: t.color,
                transition: 'width .6s',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', marginTop: 14 }}>
          {STATUSES.map((t) => (
            <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
              {t.label}
              <span style={{ fontFamily: "'Geist Mono Variable',monospace", color: '#625C78' }}>
                {s.pipeline[t.id]}
              </span>
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))',
          gap: 16,
        }}
      >
        {[
          { title: "Par type d'événement", items: s.byType },
          { title: 'Par budget', items: s.byBudget },
        ].map((d) => (
          <div className="st-card" key={d.title}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 500 }}>{d.title}</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {d.items.map((i) => (
                <div key={i.label} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span>{i.label}</span>
                    <span style={{ fontFamily: "'Geist Mono Variable',monospace", color: '#625C78' }}>
                      {i.count}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 6,
                      background: 'rgba(123,82,240,.1)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(i.count / maxOf(d.items)) * 100}%`,
                        borderRadius: 6,
                        background: '#7B52F0',
                        transition: 'width .6s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="st-card">
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 500 }}>Événements à venir</h2>
        {s.upcoming.length === 0 && (
          <p style={{ margin: '8px 0 0', fontSize: 15, color: '#625C78' }}>
            Aucun événement à venir parmi les demandes actives.
          </p>
        )}
        {s.upcoming.map((u) => {
          const dm = dayAndMonth(u.eventDate);
          return (
            <button
              key={u.id}
              type="button"
              className="st-row"
              style={{
                gridTemplateColumns: '64px minmax(0,1fr) auto',
                borderTop: '1px solid rgba(123,82,240,.1)',
                borderRadius: 0,
              }}
              onClick={() => props.onOpen(u.id)}
            >
              <span style={{ gridRow: 'span 2', textAlign: 'center', lineHeight: 1 }}>
                <span style={{ display: 'block', fontSize: 24, fontWeight: 450, letterSpacing: '-.03em' }}>
                  {dm.day}
                </span>
                <span className="st-lb" style={{ fontSize: 11 }}>
                  {dm.month}
                </span>
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {u.name}
              </span>
              <span style={{ font: "400 12px/1 'Geist Mono Variable',monospace", color: '#625C78' }}>
                J-{u.daysLeft}
              </span>
              <span style={{ fontSize: 13, color: '#625C78', gridColumn: '2 / 4' }}>
                {[u.type, u.firstPlace, statusOf(u.status).label].filter(Boolean).join(' · ')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
