import { useEffect, useState } from 'react';
import type { PublicConfig } from '@cree/shared';
import { getConfig } from './api';

const h2 = { margin: '28px 0 8px', fontSize: 20, fontWeight: 500 } as const;
const p = { margin: '0 0 10px', fontSize: 16, lineHeight: 1.6, color: '#3A3550' } as const;

export function Privacy() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    document.title = 'Confidentialité — Crée';
    getConfig()
      .then(setCfg)
      .catch(() => setFailed(true));
  }, []);
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#F5F2FC',
        color: '#15112A',
        fontFamily: "'Geist Variable', system-ui, sans-serif",
      }}
    >
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(28px,5vw,56px) clamp(16px,4vw,32px)' }}>
        <a href="/" style={{ fontSize: 15 }}>
          ← Retour au formulaire
        </a>
        <h1
          style={{
            margin: '24px 0 8px',
            fontSize: 'clamp(2rem,6vw,2.8rem)',
            fontWeight: 400,
            letterSpacing: '-.04em',
          }}
        >
          Confidentialité
        </h1>
        {failed && (
          <p role="alert" style={p}>
            Cette page n’a pas pu être chargée. Vérifiez votre connexion, puis rechargez.
          </p>
        )}
        {cfg && (
          <>
            <p style={p}>
              Version du {cfg.privacy.policyVersion}. Ce texte explique comment {cfg.privacy.controller}{' '}
              utilise les informations que vous saisissez dans le formulaire.
            </p>
            <h2 style={h2}>Qui est responsable de vos données ?</h2>
            <p style={p}>
              {cfg.privacy.controller}. Pour toute question :{' '}
              <a href={`mailto:${cfg.privacy.contactEmail}`}>{cfg.privacy.contactEmail}</a>.
            </p>
            <h2 style={h2}>Quelles données, et pourquoi ?</h2>
            <p style={p}>
              Vos coordonnées, les détails de votre événement, vos préférences de style et les fichiers que
              vous joignez. Elles servent uniquement à vous répondre et à préparer votre proposition. Nous ne
              les vendons pas et ne les utilisons pas pour de la publicité.
            </p>
            <p style={p}>
              Nous conservons une version abrégée et chiffrée de votre adresse réseau (IP) pour limiter les
              abus. Elle ne permet pas de vous identifier.
            </p>
            <h2 style={h2}>Base légale</h2>
            <p style={p}>
              Votre consentement, donné en cochant la case avant l’envoi, et les mesures précontractuelles
              prises à votre demande.
            </p>
            <h2 style={h2}>Combien de temps ?</h2>
            <p style={p}>
              Au maximum {Math.round(cfg.privacy.retentionDays / 30)} mois après la réception de votre
              demande, puis suppression automatique.
            </p>
            <h2 style={h2}>Vos droits</h2>
            <p style={p}>
              Vous pouvez demander l’accès à vos données, leur correction, leur export ou leur suppression à
              tout moment en écrivant à{' '}
              <a href={`mailto:${cfg.privacy.contactEmail}`}>{cfg.privacy.contactEmail}</a>. Nous répondons
              dans un délai d’un mois. Vous pouvez aussi saisir l’autorité de protection des données de votre
              pays.
            </p>
            <h2 style={h2}>Prestataires</h2>
            <p style={p}>
              Hébergement et stockage des fichiers, envoi des e-mails et vérification anti-robot (Cloudflare
              Turnstile) interviennent comme sous-traitants. Votre brouillon est conservé uniquement dans
              votre navigateur tant que vous n’avez pas envoyé le formulaire.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
