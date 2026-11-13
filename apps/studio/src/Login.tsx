import { useState } from 'react';
import { ApiFail, NetworkError, request } from './api';

export function Login(props: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      await request('POST', '/auth/request', { email: email.trim() });
      setState('sent');
    } catch (err) {
      setState('idle');
      setError(
        err instanceof NetworkError
          ? 'Pas de connexion. Réessayez dès que le réseau est revenu.'
          : err instanceof ApiFail && err.status === 422
            ? 'Cette adresse e-mail semble incomplète.'
            : err instanceof ApiFail
              ? err.message
              : 'Une erreur est survenue.',
      );
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        position: 'relative',
      }}
    >
      <form
        onSubmit={submit}
        className="st-card"
        style={{ width: 'min(100%,440px)', display: 'grid', gap: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 450, letterSpacing: '-.04em' }}>Connexion</h1>
          <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.5, color: '#3A3550' }}>
            Entrez l’adresse du créateur. Nous vous envoyons un lien de connexion à usage unique.
          </p>
        </div>
        {props.notice && (
          <p role="status" style={{ margin: 0, fontSize: 14, color: '#625C78' }}>
            {props.notice}
          </p>
        )}
        {state === 'sent' ? (
          <p
            role="status"
            style={{
              margin: 0,
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(123,82,240,.07)',
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Si cette adresse est celle du créateur, un lien vient d’être envoyé. Ouvrez-le sur cet appareil.
            Il est valable quelques minutes.
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 8 }}>
              <label htmlFor="login-email" className="st-lb">
                Adresse e-mail
              </label>
              <input
                id="login-email"
                className="st-in"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" style={{ margin: 0, fontSize: 14, color: '#9B1C3F' }}>
                {error}
              </p>
            )}
            <button type="submit" className="st-btn" disabled={state === 'sending' || !email.trim()}>
              {state === 'sending' ? 'Envoi…' : 'Recevoir le lien'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
