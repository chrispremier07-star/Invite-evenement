# Audit initial du prototype (avant passage en production)

Fichiers audités : `prototype/Cree-Questionnaire-v4.dc.html`, `prototype/Cree-Studio-v1.dc.html`, `prototype/sw.js`, `prototype/apps-script.gs`.
Tout ce qui est listé ci-dessous était factice ou codé en dur ; chaque point a été remplacé (colonne de droite).

| Fichier : ligne           | Élément factice                                               | Remplacement                                                           |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Questionnaire : 351       | `ENDPOINT = ''`, « l'envoi est simulé »                       | `POST /api/submissions` réel (`apps/form/src/api.ts`)                  |
| Questionnaire : 560       | `setTimeout(r, 1100)` qui imite l'envoi                       | Envoi réseau réel, erreurs et nouvel essai réels                       |
| Questionnaire : 359       | « Réponse sous 48 heures » codé en dur                        | Réglage en base (`settings`), lu via `/api/public-config`              |
| Questionnaire : 394       | « Seuls les noms des fichiers nous sont transmis »            | Téléversement réel vers S3 par formulaire signé, avec progression      |
| Questionnaire : 472, 562  | Brouillon et copie de secours seulement locaux                | Brouillon conservé ; l'envoi va au serveur (clé d'idempotence)         |
| Studio : 319-330          | `seed()` : 6 clients fictifs                                  | Supprimé : état vide réel                                              |
| Studio : 332-334          | Chargement de la démonstration par défaut                     | Données lues depuis l'API, cache IndexedDB en lecture seule            |
| Studio : 400-406, 271     | `simulate()` et bouton « Simuler une nouvelle demande »       | Supprimés                                                              |
| Studio : 235, 511         | « Envoyer une notification test » sur une fausse demande      | « Notification de contrôle » : vrai push serveur (VAPID)               |
| Studio : 250, 497         | « Données de démonstration », adresse du service (`ENDPOINT`) | Retirés : le Studio parle à son API                                    |
| Studio : 259-266, 521-529 | Clé VAPID saisie à la main, abonnement affiché en JSON        | Clé fournie par le serveur, abonnement enregistré en base              |
| Studio : 363, 368-383     | Interrogation périodique d'un Google Sheet                    | Temps réel (Server-Sent Events) avec reprise après coupure             |
| Studio : 323-328, 492     | Budgets en euros, noms et e-mails fictifs                     | Budgets en FCFA depuis la configuration partagée ; statistiques en SQL |
| Studio : 470              | Suppression locale définitive                                 | Corbeille + purge programmée, suppression définitive RGPD              |
| Studio : 469              | Notes enregistrées « sur cet appareil »                       | Notes en base, file d'actions rejouées hors ligne                      |
| sw.js : 3, 28             | Cache du fichier `Cree-Studio.dc.html`                        | Service worker généré à la compilation, mise à jour contrôlée          |
| apps-script.gs            | Réception provisoire via Google Sheets                        | API Fastify + PostgreSQL                                               |
