// Génère une paire de clés VAPID pour les notifications push : npm run vapid
const say = (s) =>
  process.stdout.write(`${s}
`);
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
say('Collez ces deux lignes dans votre fichier .env :\n');
say(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
say(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
say('\nLa clé privée est un secret : ne la publiez jamais.');
