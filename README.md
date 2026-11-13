# Crée

Formulaire public d'invitation sur mesure et **Crée Studio**, l'application privée du créateur (PWA) : demandes, fiche client, statistiques, notifications push.

## Architecture (et pourquoi)

| Dossier           | Rôle                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `apps/form`       | Formulaire public en 3 étapes (Vite, React, TypeScript).                                        |
| `apps/studio`     | PWA du créateur : connexion par lien magique, temps réel, hors ligne, push.                     |
| `apps/api`        | API Fastify + PostgreSQL (Drizzle). Sert aussi les deux interfaces compilées.                   |
| `packages/shared` | **Source unique** : questions, validation Zod, formats FCFA et dates, statuts. Utilisé partout. |

Choix : un seul dépôt TypeScript strict, un seul schéma de validation partagé (le serveur re-vérifie tout ce que le navigateur vérifie), une seule image Docker (l'API sert le formulaire à `/` et le Studio à `/studio/`, donc même origine : pas de CORS ni de cookie inter-sites à gérer). PostgreSQL porte tout : demandes en JSONB validé, recherche plein texte, statistiques en SQL. Les fichiers vont dans un stockage compatible S3 par formulaire signé, jamais via l'API. Aucune dépendance de composants : le design d'origine (Geist, lilas et violet) est repris tel quel en CSS.

## Installation en 5 commandes

Prérequis : Node 20+, Docker.

```bash
npm install
cp .env.example .env && npm run vapid   # puis collez les 2 lignes VAPID dans .env, et remplacez SESSION_SECRET et IP_HASH_SECRET
docker compose up -d                    # PostgreSQL, MinIO (fichiers), Mailpit (e-mails de test)
npm run build
npm run dev                             # API :3100 · formulaire :5173 · Studio :5174/studio/
```

- Formulaire : <http://localhost:5173> · Studio : <http://localhost:5174/studio/> · Mails reçus : <http://localhost:8125>
- Connexion au Studio : saisissez `ADMIN_EMAIL`, ouvrez le lien reçu dans Mailpit.
- L'API applique les migrations au démarrage.

## Variables d'environnement

Aucune valeur par défaut dans le code : **l'API refuse de démarrer et liste les variables manquantes**. Chaque variable est commentée dans [`.env.example`](.env.example). En résumé :

| Groupe      | Variables                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Serveur     | `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `TRUST_PROXY`, `PUBLIC_URL`, `STUDIO_URL`, `ALLOWED_ORIGINS`, `FORM_DIST_DIR`, `STUDIO_DIST_DIR`   |
| Base        | `DATABASE_URL` (+ `TEST_DATABASE_URL` pour les tests)                                                                                       |
| Secrets     | `SESSION_SECRET`, `IP_HASH_SECRET` (32 caractères minimum), `SESSION_DAYS`, `LOGIN_LINK_MINUTES`, `LOGIN_LINK_COOLDOWN_SECONDS`             |
| Créateur    | `ADMIN_EMAIL`, `DEFAULT_RESPONSE_DELAY_HOURS`, `DEFAULT_RETENTION_DAYS`, `PURGE_DELAY_DAYS` (valeurs initiales, modifiables dans le Studio) |
| RGPD        | `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL`, `POLICY_VERSION`                                                                        |
| Push        | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                                                                    |
| E-mail      | `SMTP_URL`, `MAIL_FROM`                                                                                                                     |
| Fichiers    | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`                                  |
| Anti-robot  | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SCRIPT_URL`, `TURNSTILE_VERIFY_URL`                                                |
| Débit       | `RATE_GLOBAL_PER_MINUTE`, `RATE_SUBMIT_PER_HOUR`, `RATE_UPLOAD_PER_HOUR`, `RATE_AUTH_PER_HOUR`                                              |
| Supervision | `SENTRY_DSN` (la seule variable facultative)                                                                                                |

En production, `PUBLIC_URL` et `STUDIO_URL` doivent commencer par `https://`.

## Générer les clés VAPID (notifications push)

```bash
npm run vapid
```

Collez `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans `.env` (ou dans les secrets de l'hébergeur). `VAPID_SUBJECT` est votre adresse `mailto:`. Ne changez plus ces clés ensuite : tous les appareils abonnés devraient se réabonner.

## Configurer l'e-mail

L'API envoie par SMTP (un seul réglage : `SMTP_URL`). Resend, Postmark, Brevo ou Mailgun fournissent tous un accès SMTP.

- **Resend** : `SMTP_URL=smtps://resend:VOTRE_CLE_API@smtp.resend.com:465`
- **Postmark** : `SMTP_URL=smtps://JETON:JETON@smtp.postmarkapp.com:465`
- `MAIL_FROM="Crée <contact@votre-domaine>"` : l'adresse doit appartenir à un domaine vérifié chez le fournisseur (enregistrements SPF et DKIM).

Trois e-mails partent : lien de connexion du créateur, alerte « nouvelle demande » (désactivable dans les réglages), confirmation avec récapitulatif au client.

## Configurer le stockage des fichiers

Tout service compatible S3 convient (Cloudflare R2, AWS S3, Scaleway, Backblaze B2…). Créez un bucket **privé**, puis une clé d'accès limitée à ce bucket, et renseignez les variables `S3_*`.

1. Autorisez le CORS du bucket pour l'adresse du formulaire (`POST`, en-têtes `*`, origine = `PUBLIC_URL`). Les envois de fichiers vont directement du navigateur au bucket.
2. `S3_FORCE_PATH_STYLE=false` pour AWS S3 et R2, `true` pour MinIO.
3. Les fichiers sont limités à 25 Mo et aux images, PDF et vidéos MP4 (`LIMITS` dans `packages/shared/src/questions.ts`). Les téléchargements du créateur utilisent des liens signés de 5 minutes.
4. Activez le versionnage ou la réplication du bucket : c'est votre sauvegarde des fichiers.

## Ajouter ou modifier une question (un seul fichier)

Éditez [`packages/shared/src/questions.ts`](packages/shared/src/questions.ts) : ajoutez un bloc dans la section voulue.

```ts
{ id: 'allergies', kind: 'text', label: 'Allergies à signaler', short: 'Allergies' }
```

Types : `text`, `area`, `choice` (cartes ou pastilles, choix multiple), `range`, `scale`, `toggles`, `locations`, `file`. Un champ `showIf` rend un bloc conditionnel ; `req` + `err` le rendent obligatoire. Le formulaire, la validation serveur, l'e-mail de confirmation, la recherche, l'export CSV et la fiche du Studio se mettent à jour sans autre modification. Les tranches de budget se règlent dans `BUDGET_TIERS` (FCFA).

## Déploiement pas à pas

L'image [`Dockerfile`](Dockerfile) contient l'API et les deux interfaces. Exemple avec Fly.io (Render et Railway fonctionnent de la même façon : un service Docker, un PostgreSQL managé, les variables d'environnement) :

1. **Base** : créez un PostgreSQL managé (Neon, Supabase, Fly Postgres…) et notez `DATABASE_URL` (avec `?sslmode=require` si le fournisseur l'impose).
2. **Domaine** : choisissez l'adresse (ex. `invitation.votre-domaine.tld`). `PUBLIC_URL=https://invitation.votre-domaine.tld`, `STUDIO_URL=https://invitation.votre-domaine.tld/studio/`, `ALLOWED_ORIGINS=https://invitation.votre-domaine.tld`.
3. **Turnstile** : tableau de bord Cloudflare, _Turnstile_, _Add widget_, domaine du site : copiez la clé de site et la clé secrète dans `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`.
4. **Application** :
   ```bash
   fly launch --no-deploy --copy-config      # donne un nom à l'application ([fly.toml](fly.toml))
   fly secrets set $(grep -v '^#' .env | grep -v '^$' | xargs)   # puis corrigez les valeurs de production
   fly deploy
   fly certs add invitation.votre-domaine.tld   # puis créez l'enregistrement DNS indiqué
   ```
5. **Vérification** : `https://…/health` répond `{"status":"ok"}`. Ouvrez `/studio/`, connectez-vous avec `ADMIN_EMAIL`, activez les notifications dans _Réglages_.
6. **Déploiement continu** : dans GitHub, secret `FLY_API_TOKEN` et variable `FLY_APP` ; la CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) déploie à chaque fusion sur `main` si tous les tests passent.

Si vous préférez héberger les fronts à part (Vercel, Netlify) : compilez `apps/form` et `apps/studio`, servez-les sur le même domaine principal et redirigez `/api/*` vers l'API ; ajoutez leurs origines à `ALLOWED_ORIGINS`.

### Mise à l'échelle

Le flux temps réel (Server-Sent Events) vit en mémoire d'une instance. Une seule machine suffit pour un créateur unique. Au-delà, faites passer les événements par PostgreSQL `LISTEN/NOTIFY` ou Redis avant de répliquer l'API.

## Sauvegarde et restauration

```bash
npm run backup                                  # backups/cree-AAAAMMJJ-HHMM.dump (pg_dump, format personnalisé)
npm run restore -- backups/cree-….dump base_test # restaure dans une autre base, sans rien écraser
npm run restore -- backups/cree-….dump --oui     # remplace la base de DATABASE_URL
npm run backup:verify                            # TESTE la chaîne : sauvegarde, restauration dans une base jetable, comparaison table par table
```

- **Automatique** : le workflow [`backup.yml`](.github/workflows/backup.yml) sauvegarde chaque nuit dans un bucket privé (secrets `DATABASE_URL`, `BACKUP_*`). Activez aussi les sauvegardes quotidiennes de votre fournisseur PostgreSQL.
- **Fichiers** : sauvegardés par le versionnage du bucket S3 (voir plus haut).
- `backup:verify` s'exécute dans la CI à chaque modification.

## Notifications push, hors ligne et installation

- _Réglages > Notifications_ : autorisation, abonnement de l'appareil, **notification de contrôle** (un vrai push serveur signé VAPID vers l'appareil courant), liste et retrait des appareils. Les abonnements expirés (404/410) sont supprimés automatiquement.
- Clic sur une notification : ouvre la demande. La pastille de l'icône affiche le nombre de demandes non lues (iOS 16.4+ : installez d'abord l'application sur l'écran d'accueil).
- Hors ligne : la dernière liste et les dernières fiches restent consultables (IndexedDB) ; changements de statut, lectures et notes sont mis en file puis rejoués au retour du réseau. Une nouvelle version propose « Nouvelle version disponible ».

## Tests, qualité, performance

```bash
npm run lint && npm run typecheck && npm run grep:faux   # style, types stricts, motifs interdits
npm test                                                  # unitaires + intégration API (vraie base, vrai S3, vrai SMTP)
npm run build && npm run test:e2e                         # Playwright : formulaire, Studio, temps réel, hors ligne, push, PWA
```

Les tests d'intégration et de bout en bout exigent `docker compose up -d`. `npm run grep:faux` échoue s'il reste un jeu de données, une simulation, un `console.log`, un marqueur de tâche inachevée ou une valeur métier codée en dur.

## Dépannage

| Symptôme                                                    | Piste                                                                                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L'API s'arrête au démarrage avec « Configuration invalide » | Elle liste les variables manquantes : complétez `.env`.                                                                                                                 |
| Pas de lien de connexion reçu                               | Vérifiez `ADMIN_EMAIL` (seule cette adresse peut se connecter), `SMTP_URL`, puis la boîte Mailpit en local. Un lien par minute au plus (`LOGIN_LINK_COOLDOWN_SECONDS`). |
| « Requête refusée : origine non autorisée »                 | L'adresse du navigateur n'est pas dans `ALLOWED_ORIGINS`.                                                                                                               |
| Envoi de fichier en échec depuis le formulaire              | CORS du bucket (voir _Stockage_) ou `S3_ENDPOINT` inaccessible depuis le navigateur.                                                                                    |
| « La vérification anti-robot a échoué »                     | Clés Turnstile fausses ou domaine non déclaré dans le widget.                                                                                                           |
| Pas de notification sur iPhone                              | Installez l'application sur l'écran d'accueil (Safari, Partager), iOS 16.4 minimum, puis activez les notifications.                                                     |
| Notification de contrôle : « abonnement expiré »            | Désactivez puis réactivez les notifications sur l'appareil.                                                                                                             |
| Studio qui n'affiche pas la dernière version                | Un bandeau « Nouvelle version disponible » propose la mise à jour ; sinon fermez et rouvrez l'application.                                                              |
| `npm run backup` introuvable `pg_dump`                      | En local sans PostgreSQL installé, le script utilise le conteneur `db` de `docker compose`.                                                                             |

## Sécurité et RGPD (résumé)

HTTPS et HSTS en production ; CSP stricte (aucun script ni style en ligne) ; CORS limité à `ALLOWED_ORIGINS` ; cookies de session `HttpOnly`, `Secure`, `SameSite=Lax` plus contrôle de l'origine sur toute écriture (CSRF) ; limitation de débit par IP ; honeypot, Turnstile et idempotence à l'envoi ; réponses échappées dans les e-mails ; export CSV protégé contre l'injection de formules ; journal d'audit des actions du créateur ; adresses IP stockées uniquement sous forme de HMAC. Consentement explicite et page `/confidentialite` alimentée par la configuration ; export et effacement des données d'un client dans _Réglages_ ; durée de conservation configurable avec purge automatique ; corbeille purgée après `PURGE_DELAY_DAYS`.
