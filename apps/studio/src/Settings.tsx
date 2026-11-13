import { useCallback, useEffect, useState } from 'react';
import { formatDateFr, type DeviceInfo, type StudioSettings } from '@cree/shared';
import { ApiFail, NetworkError, getCached, request } from './api';
import { clearOffline } from './offline';
import {
  currentSubscription,
  disablePush,
  enablePush,
  permission,
  pushSupported,
  type PushState,
} from './push';

export interface InstallInfo {
  canInstall: boolean;
  installed: boolean;
  ios: boolean;
  prompt(): void;
}

const dot = (c: string) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />;
const OK = 'oklch(0.64 0.15 155)';
const BAD = 'oklch(0.6 0.18 15)';
const OFF = 'oklch(0.7 0.02 290)';

export function Settings(props: {
  install: InstallInfo;
  email: string;
  pending: number;
  onLogout(): void;
  toast(t: string, b: string): void;
}) {
  const { toast } = props;
  const [perm, setPerm] = useState<PushState>(permission());
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [eraseEmail, setEraseEmail] = useState('');

  const refreshDevices = useCallback(async (ep: string | null) => {
    try {
      setDevices(
        await request<DeviceInfo[]>(
          'GET',
          `/studio/devices${ep ? `?endpoint=${encodeURIComponent(ep)}` : ''}`,
        ),
      );
    } catch {
      /* hors ligne : liste inchangée */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const sub = await currentSubscription().catch(() => null);
      setEndpoint(sub?.endpoint ?? null);
      void refreshDevices(sub?.endpoint ?? null);
      try {
        setSettings((await getCached<StudioSettings>('/studio/settings')).data);
      } catch {
        /* affiché plus bas */
      }
    })();
  }, [refreshDevices]);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(
        e instanceof NetworkError
          ? 'Pas de connexion.'
          : e instanceof Error
            ? e.message
            : 'Une erreur est survenue.',
      );
    } finally {
      setBusy('');
    }
  };

  const enable = () =>
    run('enable', async () => {
      const sub = await enablePush();
      setPerm(permission());
      setEndpoint(sub.endpoint);
      await refreshDevices(sub.endpoint);
      toast('Notifications activées', 'Cet appareil sera alerté à chaque nouvelle demande.');
    });
  const disable = () =>
    run('disable', async () => {
      await disablePush();
      setEndpoint(null);
      await refreshDevices(null);
    });
  const test = () =>
    run('test', async () => {
      if (!endpoint) throw new Error('Activez d’abord les notifications sur cet appareil.');
      await request('POST', '/studio/push/test', { endpoint });
      toast('Notification envoyée', 'Elle doit arriver dans quelques secondes, même application fermée.');
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaveErr('');
    try {
      setSettings(await request<StudioSettings>('PUT', '/studio/settings', settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveErr(
        err instanceof ApiFail
          ? err.fields
            ? (Object.values(err.fields)[0] ?? err.message)
            : err.message
          : 'Enregistrement impossible sans connexion.',
      );
    }
  };

  const erase = () =>
    run('erase', async () => {
      const email = eraseEmail.trim();
      if (
        !confirm(`Supprimer définitivement toutes les données liées à ${email} (demandes, notes, fichiers) ?`)
      )
        return;
      const r = await request<{ deleted: number }>('POST', '/studio/privacy/erase', { email });
      toast(
        'Données effacées',
        `${r.deleted} demande${r.deleted > 1 ? 's' : ''} supprimée${r.deleted > 1 ? 's' : ''}.`,
      );
      setEraseEmail('');
    });
  const exportClient = () =>
    run('exportClient', async () => {
      const data = await request<unknown>(
        'GET',
        `/studio/privacy/export?email=${encodeURIComponent(eraseEmail.trim())}`,
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = 'donnees-client.json';
      a.click();
    });

  const permLabel =
    perm === 'granted' && endpoint
      ? 'Activées sur cet appareil'
      : perm === 'denied'
        ? 'Bloquées'
        : perm === 'unsupported'
          ? 'Non prises en charge'
          : 'Désactivées';
  const permDot = perm === 'granted' && endpoint ? OK : perm === 'denied' ? BAD : OFF;
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div
      style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(16px,3vw,36px)', display: 'grid', gap: 16 }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 450, letterSpacing: '-.04em' }}>Réglages</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#625C78' }}>
          Notifications, appareils, application et données.
        </p>
      </div>

      <div className="st-card" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Notifications</h2>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            {dot(permDot)}
            {permLabel}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#3A3550' }}>
          Recevez une alerte dès qu'une nouvelle demande arrive, même lorsque l'application est fermée.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {pushSupported() && !endpoint && perm !== 'denied' && (
            <button
              type="button"
              className="st-btn"
              disabled={busy === 'enable'}
              onClick={() => void enable()}
            >
              Activer les notifications
            </button>
          )}
          {endpoint && (
            <button type="button" className="st-btn" disabled={busy === 'test'} onClick={() => void test()}>
              Envoyer une notification de contrôle
            </button>
          )}
          {endpoint && (
            <button
              type="button"
              className="st-gh"
              disabled={busy === 'disable'}
              onClick={() => void disable()}
            >
              Désactiver sur cet appareil
            </button>
          )}
        </div>
        {perm === 'denied' && (
          <p style={{ margin: 0, fontSize: 14, color: '#9B1C3F' }}>
            Les notifications sont bloquées par le navigateur. Autorisez-les dans les réglages du site.
          </p>
        )}
        {perm === 'unsupported' && (
          <p style={{ margin: 0, fontSize: 14, color: '#625C78' }}>
            Ce navigateur ne prend pas en charge les notifications. Sur iPhone, installez d'abord
            l'application sur l'écran d'accueil.
          </p>
        )}
        {msg && (
          <p role="alert" style={{ margin: 0, fontSize: 14, color: '#9B1C3F' }}>
            {msg}
          </p>
        )}
      </div>

      <div className="st-card" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Appareils abonnés</h2>
        {devices.length === 0 && (
          <p style={{ margin: 0, fontSize: 15, color: '#625C78' }}>
            Aucun appareil n'est abonné aux notifications.
          </p>
        )}
        {devices.map((d) => (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderTop: '1px solid rgba(123,82,240,.1)',
              paddingTop: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>
                {d.label}
                {d.current ? ' · cet appareil' : ''}
              </div>
              <div style={{ fontSize: 13, color: '#625C78' }}>Ajouté le {formatDateFr(d.createdAt)}</div>
            </div>
            <button
              type="button"
              className="st-gh"
              style={{ color: '#9B1C3F' }}
              onClick={() =>
                void run('rm', async () => {
                  await request('DELETE', `/studio/devices/${d.id}`);
                  if (d.current) {
                    await (await currentSubscription())?.unsubscribe();
                    setEndpoint(null);
                  }
                  await refreshDevices(d.current ? null : endpoint);
                })
              }
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <div className="st-card" style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Application</h2>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            {dot(props.install.installed ? OK : OFF)}
            {props.install.installed ? 'Installée' : 'Non installée'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#3A3550' }}>
          Installez Crée Studio sur votre téléphone ou votre ordinateur pour l'ouvrir comme une application,
          même hors ligne.
        </p>
        {props.install.canInstall && !props.install.installed && (
          <div>
            <button type="button" className="st-btn" onClick={props.install.prompt}>
              Installer Crée Studio
            </button>
          </div>
        )}
        {props.install.ios && !props.install.installed && (
          <p
            style={{
              margin: 0,
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(123,82,240,.07)',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Sur iPhone : touchez Partager dans Safari, puis « Sur l'écran d'accueil ». Les notifications
            fonctionnent une fois l'application installée.
          </p>
        )}
        {!props.install.canInstall && !props.install.installed && !props.install.ios && (
          <p style={{ margin: 0, fontSize: 14, color: '#625C78' }}>
            Le bouton d'installation apparaît dans Chrome, Edge ou Safari lorsque l'application est ouverte en
            HTTPS.
          </p>
        )}
      </div>

      <form className="st-card" style={{ display: 'grid', gap: 14 }} onSubmit={save}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Réponses aux clients et conservation</h2>
        {!settings ? (
          <p style={{ margin: 0, fontSize: 15, color: '#625C78' }}>Réglages indisponibles sans connexion.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="st-delay" className="st-lb">
                Délai de réponse affiché aux clients (heures)
              </label>
              <input
                id="st-delay"
                className="st-in"
                type="number"
                inputMode="numeric"
                min={1}
                max={720}
                value={settings.responseDelayHours}
                onChange={(e) => setSettings({ ...settings, responseDelayHours: num(e.target.value) })}
              />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="st-alert" className="st-lb">
                Adresse de réception des alertes e-mail
              </label>
              <input
                id="st-alert"
                className="st-in"
                type="email"
                value={settings.alertEmail}
                onChange={(e) => setSettings({ ...settings, alertEmail: e.target.value })}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, fontSize: 15 }}>
              <input
                type="checkbox"
                style={{ width: 22, height: 22 }}
                checked={settings.notifyByEmail}
                onChange={(e) => setSettings({ ...settings, notifyByEmail: e.target.checked })}
              />
              Recevoir un e-mail à chaque nouvelle demande
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="st-ret" className="st-lb">
                Durée de conservation des demandes (jours)
              </label>
              <input
                id="st-ret"
                className="st-in"
                type="number"
                inputMode="numeric"
                min={30}
                max={3650}
                value={settings.retentionDays}
                onChange={(e) => setSettings({ ...settings, retentionDays: num(e.target.value) })}
              />
              <span style={{ fontSize: 13, color: '#625C78' }}>
                Passé ce délai, les demandes et leurs fichiers sont supprimés automatiquement.
              </span>
            </div>
            {saveErr && (
              <p role="alert" style={{ margin: 0, fontSize: 14, color: '#9B1C3F' }}>
                {saveErr}
              </p>
            )}
            <div>
              <button type="submit" className="st-btn">
                {saved ? 'Enregistré' : 'Enregistrer'}
              </button>
            </div>
          </>
        )}
      </form>

      <div className="st-card" style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Export complet</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <a className="st-gh" href="/api/studio/export?format=csv" download>
            Exporter tout (CSV)
          </a>
          <a className="st-gh" href="/api/studio/export?format=json" download>
            Exporter tout (JSON)
          </a>
        </div>
      </div>

      <div className="st-card" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Données d'un client (RGPD)</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#3A3550' }}>
          À la demande d'un client, exportez ou effacez tout ce que vous détenez à son sujet.
        </p>
        <label htmlFor="st-erase" className="st-lb">
          Adresse e-mail du client
        </label>
        <input
          id="st-erase"
          className="st-in"
          type="email"
          value={eraseEmail}
          onChange={(e) => setEraseEmail(e.target.value)}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="st-gh"
            disabled={!eraseEmail.includes('@')}
            onClick={() => void exportClient()}
          >
            Exporter ses données
          </button>
          <button
            type="button"
            className="st-gh"
            style={{ color: '#9B1C3F' }}
            disabled={!eraseEmail.includes('@')}
            onClick={() => void erase()}
          >
            Effacer ses données
          </button>
        </div>
      </div>

      <div className="st-card" style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>Compte</h2>
        <p style={{ margin: 0, fontSize: 15, color: '#3A3550' }}>
          Connecté : {props.email}
          {props.pending
            ? ` · ${props.pending} action${props.pending > 1 ? 's' : ''} en attente d'envoi`
            : ''}
        </p>
        <div>
          <button
            type="button"
            className="st-gh"
            onClick={async () => {
              await request('POST', '/auth/logout').catch(() => undefined);
              await clearOffline();
              props.onLogout();
            }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
