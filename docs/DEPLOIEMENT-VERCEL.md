# Déployer pour des tests en production : Vercel + API

## Principe

- **Vercel** héberge le formulaire (`/`) et le Studio (`/studio/`), en fichiers statiques.
- **L'API** (processus continu : temps réel, tâches planifiées) tourne sur Render (ou Fly). Elle ne peut pas vivre sur les fonctions Vercel.
- Le fichier [`middleware.ts`](../middleware.ts) relaie `/api/*` et `/health` de Vercel vers l'API. Le navigateur ne voit qu'**une seule adresse** : les cookies de session, la protection CSRF et le CORS fonctionnent comme sur un site unique.
- Plus tard, quand le site vitrine existera, ce formulaire en deviendra une page : l'adresse Vercel et le relais restent valables.

L'ordre compte : l'API d'abord (Vercel a besoin de son adresse), puis Vercel (l'API a besoin de l'adresse Vercel). Au premier passage, on met une adresse provisoire que l'on corrige à l'étape 6.

## 1. Services externes (comptes gratuits suffisants pour tester)

| Besoin | Où | À récupérer |
| --- | --- | --- |
| Base PostgreSQL | neon.tech > New project (région Europe) | `DATABASE_URL` (« Connection string », avec `sslmode=require`) |
| E-mail | resend.com > API Keys | `SMTP_URL=smtps://resend:VOTRE_CLE@smtp.resend.com:465` |
| Stockage | Cloudflare R2 (déjà fait) | `S3_*` du fichier `.env` |
| Anti-robot | Cloudflare > Turnstile | clé de site et clé secrète (étape 5) |

**E-mail sans domaine** : avec Resend, tant que votre domaine n'est pas vérifié, `MAIL_FROM="Crée <onboarding@resend.dev>"` n'envoie qu'à l'adresse de votre compte Resend. Mettez cette adresse dans `ADMIN_EMAIL` : le lien de connexion et les alertes arrivent. Pour tester la confirmation client, remplissez le formulaire avec cette même adresse.

## 2. Pousser le code

Le dépôt est déjà sur GitHub : https://github.com/chrispremier07-star/Invite-evenement

## 3. Déployer l'API sur Render

1. render.com > New > **Blueprint** > choisissez le dépôt. Render lit [`render.yaml`](../render.yaml) et crée le service `cree-api`.
2. Renseignez les variables « à saisir » (valeurs de votre `.env`, sauf celles ci-dessous) :
   - `DATABASE_URL` : celle de Neon.
   - `ADMIN_EMAIL`, `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL`.
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` + votre adresse).
   - `SMTP_URL`, `MAIL_FROM`.
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (R2).
   - `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (étape 5 ; provisoirement les clés de test).
   - `PUBLIC_URL`, `STUDIO_URL`, `ALLOWED_ORIGINS` : provisoirement `https://exemple.invalid` (à corriger à l'étape 6).
3. Déployez. Notez l'adresse du service (`https://cree-api-xxxx.onrender.com`) : c'est votre `API_ORIGIN`.
4. Vérifiez `https://cree-api-xxxx.onrender.com/health` : `{"status":"ok"}`. Le plan gratuit s'endort après 15 minutes : le premier appel prend environ 30 secondes.

## 3 bis. Alternative : Fly.io

`fly launch --no-deploy --copy-config`, `fly secrets set ...`, `fly deploy` (voir le README). Fly ne s'endort pas, mais demande une carte bancaire.

## 4. Déployer le front sur Vercel

1. vercel.com > Add New > **Project** > importez le dépôt.
2. Laissez les réglages : [`vercel.json`](../vercel.json) fournit commande d'installation, de compilation et dossier de sortie (framework : *Other*).
3. Variable d'environnement : **`API_ORIGIN`** = l'adresse de l'API à l'étape 3, sans `/` final.
4. Deploy. Notez l'adresse du projet, par exemple `https://invite-evenement.vercel.app`.
5. Test rapide : `https://…vercel.app/health` doit afficher `{"status":"ok"}` (relais vers l'API).

## 5. Turnstile et CORS avec l'adresse Vercel

- **Turnstile** : Cloudflare > Turnstile > Add widget. Nom d'hôte : exactement `invite-evenement.vercel.app` (le domaine seul `vercel.app` n'est pas accepté). Mode *Managed*. Copiez la clé de site et la clé secrète dans les variables `TURNSTILE_*` de Render.
- **CORS du bucket R2** : bucket > Paramètres > Stratégie CORS :
  ```json
  [{ "AllowedOrigins": ["https://invite-evenement.vercel.app"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
  ```

## 6. Corriger les adresses de l'API

Dans Render, remplacez les valeurs provisoires par l'adresse Vercel, puis redéployez :

```
PUBLIC_URL=https://invite-evenement.vercel.app
STUDIO_URL=https://invite-evenement.vercel.app/studio/
ALLOWED_ORIGINS=https://invite-evenement.vercel.app
```

## 7. Tester en production

1. `https://…vercel.app/studio/` : saisissez `ADMIN_EMAIL`, ouvrez le lien reçu par e-mail.
2. *Réglages* > **Activer les notifications**, puis « Envoyer une notification de contrôle ».
3. Sur un téléphone, ouvrez le formulaire, joignez une image, envoyez : la demande doit apparaître dans le Studio ouvert, et une notification doit arriver application fermée.
4. Sur iPhone : installez d'abord le Studio sur l'écran d'accueil (Safari > Partager).

## Points de vigilance

- **Flux temps réel via Vercel** : le relais passe par l'infrastructure Vercel. Si les nouvelles demandes n'apparaissent pas en direct dans le Studio, elles apparaissent à la prochaine actualisation ; dites-le-moi et j'ajouterai une actualisation automatique de secours.
- **Plan gratuit Render** : l'API s'endort ; les notifications push et les e-mails arrivent quand même, mais la première requête est lente. Passez à un plan payant pour les vrais clients.
- **Aucun secret dans Vercel** : seule `API_ORIGIN` y est définie. Les secrets restent côté API.
