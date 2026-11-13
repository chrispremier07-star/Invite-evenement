import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeEvent } from '@cree/shared';
import { ApiFail, UNAUTH_EVENT, flushQueue, getCached, request } from './api';
import { publish } from './bus';
import { Inbox } from './Inbox';
import { Login } from './Login';
import { queueList } from './offline';
import { Settings, type InstallInfo } from './Settings';
import { Stats } from './Stats';

type View = 'inbox' | 'stats' | 'settings';
interface Toast {
  tid: string;
  title: string;
  body: string;
  id?: string;
}
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function parseHash(): { view: View; id: string | null; token: string | null } {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  if (a === 'connexion' && b) return { view: 'inbox', id: null, token: b };
  if (a === 'demande' && b) return { view: 'inbox', id: b, token: null };
  if (a === 'stats') return { view: 'stats', id: null, token: null };
  if (a === 'reglages') return { view: 'settings', id: null, token: null };
  return { view: 'inbox', id: null, token: null };
}
const go = (path: string) => {
  location.hash = `#/${path}`;
};

export function App() {
  const [auth, setAuth] = useState<'loading' | 'out' | 'in'>('loading');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [route, setRoute] = useState(parseHash);
  const [unread, setUnread] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [live, setLive] = useState(false);
  const [pending, setPending] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true,
  );
  const unreadRef = useRef(0);

  const toast = useCallback((title: string, body: string, id?: string) => {
    const tid = crypto.randomUUID();
    setToasts((t) => [...t.slice(-2), { tid, title, body, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.tid !== tid)), 6500);
  }, []);
  const refreshPending = useCallback(() => {
    queueList()
      .then((q) => setPending(q.length))
      .catch(() => undefined);
  }, []);

  // ---- session ----
  const verifyToken = useCallback(async (token: string) => {
    try {
      const r = await request<{ email: string }>('POST', '/auth/verify', { token });
      history.replaceState(null, '', location.pathname);
      setRoute(parseHash());
      setEmail(r.email);
      setAuth('in');
    } catch (e) {
      history.replaceState(null, '', location.pathname);
      setNotice(
        e instanceof ApiFail ? e.message : 'Ce lien n’a pas pu être vérifié. Vérifiez votre connexion.',
      );
      setAuth('out');
    }
  }, []);

  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      if (r.token) void verifyToken(r.token);
      else setRoute(r);
    };
    addEventListener('hashchange', onHash);
    const onUnauth = () => {
      setAuth('out');
      setNotice('Votre session a expiré. Connectez-vous de nouveau.');
    };
    addEventListener(UNAUTH_EVENT, onUnauth);
    return () => {
      removeEventListener('hashchange', onHash);
      removeEventListener(UNAUTH_EVENT, onUnauth);
    };
  }, [verifyToken]);

  useEffect(() => {
    void (async () => {
      const { token } = parseHash();
      if (token) return void verifyToken(token);
      try {
        const r = await getCached<{ email: string | null }>('/auth/me');
        if (!r.data.email) return void setAuth('out');
        setEmail(r.data.email);
        setOffline(r.offline);
        setAuth('in');
      } catch {
        setAuth('out');
      }
    })();
  }, [verifyToken]);

  // ---- PWA : service worker, mise à jour contrôlée, installation ----
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let refreshing = false;
    // Rechargement uniquement lors d'une mise à jour acceptée : la première installation ne doit pas interrompre l'utilisateur.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        location.reload();
      }
    });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'open' && e.data.id) go(`demande/${e.data.id}`);
    });
    navigator.serviceWorker
      .register('/studio/sw.js', { scope: '/studio/' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setUpdate(reg);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) setUpdate(reg);
          });
        });
        setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const bip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const ai = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    addEventListener('beforeinstallprompt', bip);
    addEventListener('appinstalled', ai);
    return () => {
      removeEventListener('beforeinstallprompt', bip);
      removeEventListener('appinstalled', ai);
    };
  }, []);

  // ---- réseau : relecture de la file d'actions ----
  const sync = useCallback(async () => {
    const r = await flushQueue();
    refreshPending();
    if (r.sent) {
      toast(
        'Synchronisé',
        `${r.sent} action${r.sent > 1 ? 's' : ''} envoyée${r.sent > 1 ? 's' : ''} au retour du réseau.`,
      );
      publish('reconnect');
    }
    if (r.dropped) toast('Action abandonnée', 'Une modification faite hors ligne n’a pas pu être appliquée.');
  }, [refreshPending, toast]);
  useEffect(() => {
    const on = () => {
      setOffline(false);
      void sync();
    };
    const off = () => setOffline(true);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, [sync]);
  useEffect(() => {
    if (auth === 'in') {
      refreshPending();
      void sync();
    }
  }, [auth, sync, refreshPending]);
  // Tant que des actions attendent, on retente régulièrement : l'événement « online » n'est pas toujours émis par les navigateurs.
  useEffect(() => {
    if (auth !== 'in' || pending === 0) return;
    const t = setInterval(() => void sync(), 4000);
    return () => clearInterval(t);
  }, [auth, pending, sync]);

  // ---- temps réel (Server-Sent Events, reprise automatique après coupure) ----
  useEffect(() => {
    if (auth !== 'in') return;
    const es = new EventSource('/api/studio/events');
    let opened = false;
    es.addEventListener('ready', () => {
      setLive(true);
      if (opened) {
        void sync();
        publish('reconnect');
      }
      opened = true;
    });
    es.onerror = () => setLive(false);
    const handle = (e: MessageEvent<string>) => {
      const ev = JSON.parse(e.data) as RealtimeEvent;
      setUnread(ev.unread);
      unreadRef.current = ev.unread;
      publish(ev.type, ev.id);
      if (ev.type === 'submission.created') {
        toast('Nouvelle demande', ev.name, ev.id);
        try {
          navigator.vibrate?.([12, 40, 12]);
        } catch {
          /* vibration indisponible */
        }
      }
    };
    for (const t of ['submission.created', 'submission.updated', 'submission.deleted'])
      es.addEventListener(t, handle as EventListener);
    return () => es.close();
  }, [auth, sync, toast]);

  // ---- pastille d'icône et titre ----
  useEffect(() => {
    document.title = `${unread ? `(${unread}) ` : ''}Crée Studio`;
    try {
      if (navigator.setAppBadge) void (unread ? navigator.setAppBadge(unread) : navigator.clearAppBadge());
    } catch {
      /* badge indisponible */
    }
  }, [unread]);

  const install: InstallInfo = {
    canInstall: !!installEvt,
    installed,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    prompt: () => {
      void installEvt
        ?.prompt()
        .then(() => installEvt.userChoice)
        .then((r) => {
          if (r.outcome === 'accepted') setInstalled(true);
          setInstallEvt(null);
        });
    },
  };

  if (auth === 'loading')
    return (
      <p role="status" style={{ padding: 40, textAlign: 'center', color: '#625C78' }}>
        Chargement…
      </p>
    );
  if (auth === 'out') return <Login notice={notice} />;

  const nav: Array<{ id: View; label: string; short: string; path: string; shape: string; count: number }> = [
    { id: 'inbox', label: 'Demandes', short: 'Demandes', path: '', shape: '5px', count: unread },
    { id: 'stats', label: "Vue d'ensemble", short: 'Aperçu', path: 'stats', shape: '50%', count: 0 },
    {
      id: 'settings',
      label: 'Réglages',
      short: 'Réglages',
      path: 'reglages',
      shape: '5px 5px 50% 50%',
      count: 0,
    },
  ];
  const syncText = offline ? 'Hors ligne' : live ? 'Temps réel actif' : 'Reconnexion…';
  const syncDot = offline ? 'oklch(0.6 0.18 15)' : live ? 'oklch(0.64 0.15 155)' : 'oklch(0.72 0.15 70)';

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: '#F5F2FC',
        color: '#15112A',
        fontFamily: "'Geist Variable', system-ui, sans-serif",
        overflowX: 'clip',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(50% 40% at 100% 0%,rgba(196,170,255,.4),transparent 70%),radial-gradient(45% 40% at 0% 100%,rgba(255,196,236,.32),transparent 70%)',
        }}
      />
      {update && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px 12px 18px',
            borderRadius: 18,
            background: '#15112A',
            color: '#fff',
            maxWidth: 520,
            margin: '0 auto',
          }}
        >
          <span style={{ fontSize: 15 }}>Nouvelle version disponible</span>
          <button
            type="button"
            className="st-btn"
            onClick={() => update.waiting?.postMessage({ type: 'SKIP_WAITING' })}
          >
            Mettre à jour
          </button>
        </div>
      )}
      <div className="st-app" style={{ position: 'relative' }}>
        <aside className="st-side" aria-label="Navigation">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 22px' }}>
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'conic-gradient(#6A3DE8,#D98BFF,#6A3DE8)',
              }}
            />
            <span style={{ font: "500 19px/1 'Geist Variable',sans-serif", letterSpacing: '-.03em' }}>
              Crée Studio
            </span>
          </div>
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              className="st-nav"
              aria-current={route.view === n.id ? 'page' : undefined}
              onClick={() => go(n.path)}
            >
              <span>{n.label}</span>
              {n.count > 0 && (
                <span className="st-badge" aria-label={`${n.count} non lue${n.count > 1 ? 's' : ''}`}>
                  {n.count}
                </span>
              )}
            </button>
          ))}
          <div style={{ marginTop: 'auto', display: 'grid', gap: 10, padding: 12 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#625C78' }}
              role="status"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: syncDot }} />
              {syncText}
              {pending ? ` · ${pending} en attente` : ''}
            </div>
            {install.canInstall && !install.installed && (
              <button type="button" className="st-gh" onClick={install.prompt}>
                Installer l'application
              </button>
            )}
          </div>
        </aside>

        <main className="st-main" style={{ minWidth: 0 }}>
          <div
            className="st-mtop"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              minHeight: 60,
              padding: '0 16px',
              background: 'rgba(245,242,252,.85)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderBottom: '1px solid rgba(123,82,240,.1)',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                font: "500 17px/1 'Geist Variable',sans-serif",
                letterSpacing: '-.03em',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'conic-gradient(#6A3DE8,#D98BFF,#6A3DE8)',
                }}
              />
              Crée Studio
            </span>
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#625C78' }}
              role="status"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: syncDot }} />
              {syncText}
            </span>
          </div>
          {route.view === 'inbox' && (
            <Inbox
              selId={route.id}
              onSelect={(id) => go(id ? `demande/${id}` : '')}
              onUnread={(n) => {
                setUnread(n);
                unreadRef.current = n;
              }}
              onOffline={setOffline}
              onPending={refreshPending}
              toast={toast}
            />
          )}
          {route.view === 'stats' && <Stats onOpen={(id) => go(`demande/${id}`)} onOffline={setOffline} />}
          {route.view === 'settings' && (
            <Settings
              install={install}
              email={email}
              pending={pending}
              toast={toast}
              onLogout={() => {
                setAuth('out');
                setNotice('');
                setUnread(0);
              }}
            />
          )}
        </main>
      </div>

      <nav className="st-tabs" aria-label="Navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            className="st-tab"
            aria-current={route.view === n.id ? 'page' : undefined}
            onClick={() => go(n.path)}
          >
            <span
              aria-hidden="true"
              style={{ width: 18, height: 18, borderRadius: n.shape, border: '1.6px solid currentColor' }}
            />
            {n.short}
            {n.count > 0 && (
              <span className="st-badge" aria-label={`${n.count} non lue${n.count > 1 ? 's' : ''}`}>
                {n.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 'calc(12px + env(safe-area-inset-top))',
          right: 12,
          left: 12,
          zIndex: 20,
          display: 'grid',
          justifyItems: 'end',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.tid}
            role="status"
            style={{
              pointerEvents: 'auto',
              width: 'min(100%,380px)',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '14px 14px 14px 16px',
              borderRadius: 18,
              background: 'rgba(255,255,255,.95)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 0 0 1px rgba(123,82,240,.15),0 20px 50px -20px rgba(60,30,150,.45)',
              animation: 'stToast .4s cubic-bezier(.2,.7,.2,1) both',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                marginTop: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#6A3DE8',
                animation: 'stPulse 1.6s ease-out 2',
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (t.id) go(`demande/${t.id}`);
                setToasts((x) => x.filter((y) => y.tid !== t.tid));
              }}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                border: 0,
                background: 'none',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{t.title}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 14, color: '#625C78' }}>{t.body}</span>
            </button>
            <button
              type="button"
              onClick={() => setToasts((x) => x.filter((y) => y.tid !== t.tid))}
              aria-label="Fermer"
              style={{
                flex: 'none',
                width: 44,
                height: 44,
                margin: '-8px -6px 0 0',
                border: 0,
                borderRadius: '50%',
                background: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: '#625C78',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
