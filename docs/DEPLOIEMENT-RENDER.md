# Héberger sur Render (tout au même endroit)

Un seul service Render fait tourner le site (formulaire, Studio, API) et héberge la base PostgreSQL. Les fichiers restent chez Cloudflare R2.

1. Pousser le code sur GitHub (fait).
2. render.com > **New > Blueprint** > choisir le dépôt. Render lit `render.yaml` : il crée le service `cree-api` et la base `cree-db`, et relie les deux.
3. Dans le service > **Environment** > **Add from .env** : coller le contenu du fichier local `render.env` (ignoré par Git, il contient des secrets). Modifier `ADMIN_EMAIL` (votre vraie adresse) et `PRIVACY_CONTACT_EMAIL` avant d'enregistrer.
4. Render redéploie. Quand le service est « Live », ouvrir `https://<votre-service>.onrender.com/health` : `{"status":"ok"}`.
5. CORS du bucket R2 : autoriser `PUT` depuis `https://<votre-service>.onrender.com`.
6. Resend : remplacer `SMTP_URL` et `MAIL_FROM` dans Environment, puis tester la connexion au Studio.

Les adresses publiques (`PUBLIC_URL`, `STUDIO_URL`, `ALLOWED_ORIGINS`) se déduisent automatiquement de l'adresse du service ; renseignez-les dans Environment seulement quand vous brancherez un nom de domaine.

Limites du plan gratuit : le service s'endort après 15 minutes d'inactivité (premier appel lent) et la base expire après 30 jours.
