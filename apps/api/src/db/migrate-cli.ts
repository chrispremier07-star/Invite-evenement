import { createDb } from './index';
import { runMigrations } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('DATABASE_URL manquante : renseignez le fichier .env.\n');
  process.exit(1);
}
const { db, pool } = createDb(url);
try {
  await runMigrations(db);
  process.stdout.write('Migrations appliquées.\n');
} finally {
  await pool.end();
}
