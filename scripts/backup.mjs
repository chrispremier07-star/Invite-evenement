// Sauvegarde complète de la base : npm run backup  →  backups/cree-AAAAMMJJ-HHMM.dump (format personnalisé pg_dump).
const say = (s) =>
  process.stdout.write(`${s}
`);
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv, conn, pg } from './lib/pg.mjs';

loadEnv();
const c = conn();
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
mkdirSync('backups', { recursive: true });
const out = `backups/cree-${stamp}.dump`;
const data = pg('pg_dump', [...c.args, '-Fc', '--no-owner', c.db], { capture: true });
writeFileSync(out, data);
say(`Sauvegarde écrite : ${out} (${Math.round(data.length / 1024)} Ko)`);
say(
  'Les fichiers (pièces jointes) vivent dans le bucket S3 : activez le versionnage ou la réplication chez votre fournisseur.',
);
