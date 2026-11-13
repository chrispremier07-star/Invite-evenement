// Restauration : npm run restore -- backups/cree-….dump [nom_de_base_cible]
// Sans nom de base, la restauration vise la base de DATABASE_URL (elle est alors REMPLACÉE : confirmez avec --oui).
const say = (s) =>
  process.stdout.write(`${s}
`);
import { readFileSync } from 'node:fs';
import { loadEnv, conn, pg } from './lib/pg.mjs';

loadEnv();
const [file, target] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const yes = process.argv.includes('--oui');
if (!file) {
  console.error('Usage : npm run restore -- <fichier.dump> [base_cible] [--oui]');
  process.exit(1);
}
const c = conn();
const db = target ?? c.db;
if (!target && !yes) {
  console.error(
    `Cette commande remplace la base « ${db} ». Relancez avec --oui pour confirmer, ou indiquez une base cible.`,
  );
  process.exit(1);
}
pg('psql', [
  ...c.args,
  '-d',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  `DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`,
]);
pg('psql', [...c.args, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${db}"`]);
pg('pg_restore', [...c.args, '--no-owner', '-d', db, '--exit-on-error'], { input: readFileSync(file) });
say(`Base « ${db} » restaurée depuis ${file}.`);
