// Outils PostgreSQL partagés par les scripts de sauvegarde : pg_dump/pg_restore locaux, sinon ceux du conteneur docker compose.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv() {
  const p = resolve(process.cwd(), '.env');
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante : renseignez le fichier .env.');
  return process.env;
}

const hasLocal = () => spawnSync('pg_dump', ['--version'], { encoding: 'utf8' }).status === 0;

/** Exécute un outil PostgreSQL ; `input` est envoyé sur l'entrée standard et `capture` renvoie la sortie binaire. */
export function pg(tool, args, { input, capture } = {}) {
  const env = loadEnv();
  const local = hasLocal();
  const cmd = local ? tool : 'docker';
  const full = local
    ? args
    : ['compose', 'exec', '-T', '-e', `PGPASSWORD=${env.POSTGRES_PASSWORD}`, 'db', tool, ...args];
  const r = spawnSync(cmd, full, {
    input,
    maxBuffer: 1024 * 1024 * 1024,
    env: { ...process.env, PGPASSWORD: env.POSTGRES_PASSWORD ?? '' },
    stdio: ['pipe', capture ? 'pipe' : 'inherit', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`${tool} a échoué (code ${r.status}).`);
  return r.stdout;
}

export const isLocal = hasLocal;

/** Découpe DATABASE_URL en paramètres pour les outils en ligne de commande. */
export function conn(url = process.env.DATABASE_URL, dbOverride) {
  const u = new URL(url);
  const inDocker = !hasLocal();
  return {
    args: [
      '-h',
      inDocker ? 'localhost' : u.hostname,
      '-p',
      inDocker ? '5432' : u.port || '5432',
      '-U',
      decodeURIComponent(u.username),
    ],
    db: dbOverride ?? u.pathname.slice(1),
    password: decodeURIComponent(u.password),
  };
}
