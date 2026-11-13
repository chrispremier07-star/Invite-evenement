import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './index';

function migrationsFolder(): string {
  const candidates = [new URL('../../drizzle', import.meta.url), new URL('../drizzle', import.meta.url)];
  for (const c of candidates) {
    const p = fileURLToPath(c);
    if (existsSync(p)) return p;
  }
  throw new Error('Dossier de migrations introuvable.');
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
}
