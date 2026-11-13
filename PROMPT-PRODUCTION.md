# Prompt VS Code : passer Crée de prototype à production

Collez tout ce qui suit dans l'agent (Claude Code, Copilot Agent ou Cursor), à la racine du dossier du projet.

---

## RÔLE

Tu es un ingénieur full-stack senior (TypeScript, PostgreSQL, sécurité, PWA). Tu transformes le prototype « Crée » en produit de production, entièrement fonctionnel, raccordé et opérationnel. Tu travailles de bout en bout, sans me demander de valider chaque étape. Tu ne t'arrêtes que pour les informations que seul moi peux fournir (clés, noms de domaine), listées en fin de tâche.

## CONTEXTE

Le dossier contient un prototype :
- `Cree-Questionnaire.html` et `Cree-Questionnaire-v4.dc.html` : formulaire client en 3 étapes (accueil, événement, site, finalisation, confirmation). Tout le contenu est dans l'objet `cfg` (questions, options, textes).
- `Cree-Studio-v1.dc.html` : interface du créateur (demandes, fiche client, vue d'ensemble, réglages, notifications, installation PWA).
- `sw.js`, `manifest.webmanifest`, `icons/` : base PWA.
- `apps-script.gs` : réception provisoire via Google Sheets.
Les fichiers `.dc.html` sont des composants de prototypage. Reprends leur design, leurs textes français, leurs interactions et leur structure d'écrans à l'identique, mais réécris-les en code de production.

## RÈGLE ABSOLUE : ZÉRO FAUX

Dans le code livré, il ne doit rester aucun :
- jeu de données de test, fonction `seed()`, bouton « Simuler une demande », « Notification test » alimenté par de fausses données ;
- `setTimeout` qui imite un envoi, une réponse serveur ou un chargement ;
- valeur codée en dur (URL, clé, e-mail, montant, nom, statistique, délai « 48 heures », nom de domaine) hors fichier de configuration d'environnement ;
- texte `lorem`, « demo », « test », `TODO`, `FIXME`, `console.log` de débogage.
Chaque chiffre affiché (compteurs, taux de signature, répartitions, événements à venir) est calculé depuis la base de données. Chaque état vide a un vrai écran vide. À la fin, exécute une recherche (`grep`) sur ces motifs et prouve qu'il n'en reste aucun.

## ARCHITECTURE À METTRE EN PLACE

Choisis la pile la plus simple et robuste, justifie-la en 5 lignes, puis applique-la. Proposition par défaut :
- **Monorepo** `apps/form` (formulaire public), `apps/studio` (PWA du créateur), `apps/api`, `packages/shared`.
- **Front** : TypeScript, Vite, composants natifs ou framework léger. Pas de dépendance inutile. Garde le design actuel à l'identique (Geist, palette lilas et violet, composants, animations, `prefers-reduced-motion`).
- **API** : Node 20 + Fastify (ou Hono), validation Zod partagée entre front et back.
- **Base** : PostgreSQL (Supabase, Neon ou autre), migrations versionnées (Drizzle ou Prisma).
- **Auth Studio** : connexion sécurisée du créateur (e-mail avec lien magique ou mot de passe + 2FA), sessions en cookies `HttpOnly`, `Secure`, `SameSite=Lax`. Le formulaire reste public, le Studio est privé.
- **Stockage fichiers** : bucket S3 compatible (logo, faire-part, photos), URLs signées, limites de taille et de type.
- **Notifications** : Web Push réel (VAPID) via `web-push`, plus e-mail transactionnel (Resend ou Postmark). Abonnements stockés en base, nettoyage des abonnements expirés (410).
- **Hébergement** : Dockerfile, `docker-compose` pour le développement, déploiement documenté (Vercel/Netlify pour les fronts, Fly/Render/Railway pour l'API).

## TRAVAIL DEMANDÉ

### 1. Modèle de données
Tables : `submissions` (id, reçue le, statut, lu, réponses en JSONB validé par schéma, source, IP hachée), `notes`, `attachments`, `push_subscriptions`, `users`, `audit_log`. Statuts : nouvelle, en échange, devis envoyé, signée, archivée. Index sur statut, date de réception et recherche plein texte.

### 2. Formulaire public
- Même parcours en 3 étapes, même UX. Les questions sont lues depuis une configuration unique partagée (`packages/shared/questions.ts`), pas dupliquées.
- Sauvegarde locale du brouillon conservée (localStorage), reprise là où l'on s'était arrêté.
- Envoi réel `POST /api/submissions` : validation serveur Zod stricte, honeypot, limitation de débit par IP, jeton anti-bot (Cloudflare Turnstile ou hCaptcha), idempotence (clé unique par envoi) pour empêcher le double envoi.
- Téléversement réel des fichiers vers le stockage (URL signée), progression visible, erreurs claires. Plus de « seuls les noms sont envoyés ».
- Gestion réelle des erreurs réseau : nouvel essai manuel, sauvegarde de secours, message sans jargon.
- E-mail de confirmation automatique au client, avec le récapitulatif de ses réponses.
- Écran de confirmation avec le vrai délai de réponse lu en configuration.
- Budgets en FCFA, format `1 300 000 FCFA`. Dates en `fr-FR`. Fuseau horaire de l'utilisateur géré.

### 3. API
Routes : création de demande (publique), liste paginée avec filtres, recherche et tri (privée), détail, changement de statut, notes, suppression (suppression douce + purge programmée), pièces jointes, export CSV/JSON, statistiques agrégées, abonnement et désabonnement push, paramètres. Réponses typées, codes HTTP corrects, erreurs normalisées en français. Temps réel : Server-Sent Events ou WebSocket pour que le Studio reçoive les nouvelles demandes instantanément, avec reprise après coupure.

### 4. Studio (PWA)
- Remplace toutes les données locales par l'API. Plus de `localStorage` pour les demandes ; garde seulement un cache hors ligne en lecture (IndexedDB) et la file d'actions à rejouer au retour du réseau (changement de statut, notes).
- Notifications push réelles : activation, abonnement, réception application fermée, clic qui ouvre la bonne demande, pastille de badge sur l'icône. Supprime les boutons de simulation et de test factice. Garde un bouton « Envoyer une notification de contrôle » qui déclenche un vrai push serveur vers l'appareil courant.
- Installation PWA vérifiée : manifest complet, icônes maskable 192 et 512, service worker avec stratégie de cache adaptée (shell en cache d'abord, API réseau d'abord), mise à jour contrôlée avec message « Nouvelle version disponible », support iOS 16.4+.
- Vue d'ensemble : toutes les statistiques viennent de requêtes SQL. Taux de signature, budgets, événements à venir et délais calculés côté serveur.
- Réglages : adresse du service retirée (le Studio parle à son API), gestion des appareils abonnés, rétention des données, adresse de réception des alertes e-mail, délai de réponse affiché aux clients, export complet.
- Accessibilité conservée : navigation clavier, focus visibles, `aria-live`, contrastes AA, cibles tactiles de 48 px minimum, texte de saisie 16 px minimum.

### 5. Sécurité et conformité
- HTTPS obligatoire, en-têtes de sécurité (CSP stricte, HSTS, `X-Content-Type-Options`, `Referrer-Policy`), CORS limité aux origines autorisées.
- Aucun secret dans le dépôt : `.env.example` documenté, variables validées au démarrage (l'application refuse de démarrer si une variable manque).
- Protection injection, XSS (échappement systématique des réponses utilisateur), CSRF, limitation de débit sur toutes les routes publiques, journal d'audit des actions du créateur.
- RGPD : mention d'information et consentement sur le formulaire, page de confidentialité, export et suppression des données d'un client sur demande, durée de conservation configurable, IP hachées.
- Sauvegardes automatiques de la base et procédure de restauration testée et documentée.

### 6. Qualité et exploitation
- Tests : unitaires (validation, calculs de statistiques), intégration API avec une vraie base de test, tests de bout en bout Playwright (remplir le formulaire jusqu'à l'envoi, recevoir la demande dans le Studio, changer le statut, recevoir une notification, installer la PWA).
- Lint, formatage, TypeScript strict, CI GitHub Actions (lint, types, tests, build, déploiement).
- Journalisation structurée, suivi d'erreurs (Sentry), point de santé `/health`, supervision de disponibilité.
- Performance : Lighthouse ≥ 95 en performance, accessibilité, bonnes pratiques et PWA sur mobile ; formulaire chargé en moins de 1,5 s sur 4G ; animations en `transform` et `opacity` uniquement.
- Navigateurs testés : Safari iOS, Chrome Android, Chrome, Edge, Firefox, Safari macOS. Largeurs testées : 360, 390, 768, 1024, 1440 et écran ultra large, sans barre de défilement horizontale.

### 7. Documentation
`README.md` : installation en 5 commandes, variables d'environnement, déploiement pas à pas, génération des clés VAPID, configuration e-mail et stockage, ajout ou modification d'une question (un seul fichier), sauvegarde et restauration, dépannage.

## ORDRE D'EXÉCUTION

1. Audite le dépôt, liste tout ce qui est factice avec le fichier et la ligne, puis annonce ton plan d'architecture.
2. Crée le monorepo, la base, les migrations et l'API avec leurs tests.
3. Branche le formulaire sur l'API (envoi, fichiers, e-mails).
4. Branche le Studio (auth, liste, fiche, statistiques, temps réel, push, PWA).
5. Sécurité, RGPD, tests de bout en bout, CI, déploiement.
6. Exécute la recherche « zéro faux » et fournis le rapport.

## CRITÈRES D'ACCEPTATION

- Un vrai client remplit le formulaire sur son téléphone, ses fichiers sont stockés, il reçoit un e-mail de confirmation.
- Moins de 3 secondes plus tard, le créateur voit la demande dans le Studio ouvert, et reçoit un push sur son téléphone même application fermée.
- Le créateur change le statut, ajoute une note, exporte en CSV, tout est conservé en base et visible sur un second appareil.
- Aucune donnée, clé, URL ou montant n'est codé en dur. `grep` des motifs interdits : 0 résultat.
- Tous les tests passent en CI. Lighthouse ≥ 95. Aucune erreur dans la console.

## À LA FIN, DONNE-MOI

1. La liste exacte des informations que je dois fournir (noms de domaine, clés API, comptes à créer) avec où cliquer pour les obtenir.
2. Les commandes pour lancer en local et déployer.
3. Le rapport « zéro faux » et la liste de ce qui reste à faire, s'il y en a.
