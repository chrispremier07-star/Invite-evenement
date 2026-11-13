// Teste réellement la chaîne sauvegarde → restauration : sauvegarde la base, la restaure dans une base jetable,
// compare le nombre de lignes de chaque table, puis supprime la base jetable. npm run backup:verify
const say = (s) =>
  process.stdout.write(`${s}
`);
import { loadEnv, conn, pg } from './lib/pg.mjs';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

loadEnv();
execFileSync(process.execPath, ['scripts/backup.mjs'], { stdio: 'inherit' });
const file = `backups/${readdirSync('backups')
  .filter((f) => f.endsWith('.dump'))
  .sort()
  .pop()}`;
const c = conn();
const check = `${c.db}_restore_check`;
execFileSync(process.execPath, ['scripts/restore.mjs', file, check], { stdio: 'inherit' });
const tables = [
  'submissions',
  'notes',
  'attachments',
  'push_subscriptions',
  'users',
  'audit_log',
  'settings',
];
const count = (db, t) =>
  Number(
    pg('psql', [...c.args, '-d', db, '-At', '-c', `SELECT count(*) FROM ${t}`], { capture: true })
      .toString()
      .trim(),
  );
let ok = true;
for (const t of tables) {
  const a = count(c.db, t),
    b = count(check, t);
  say(`${t.padEnd(20)} origine=${a} restauré=${b} ${a === b ? 'OK' : 'ÉCART'}`);
  if (a !== b) ok = false;
}
pg('psql', [...c.args, '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS "${check}" WITH (FORCE)`]);
if (!ok) {
  console.error('La restauration ne correspond pas à la base d’origine.');
  process.exit(1);
}
say('Restauration vérifiée : toutes les tables correspondent.');
