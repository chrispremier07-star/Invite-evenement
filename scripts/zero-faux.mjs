// Recherche « zéro faux » : échoue s'il reste un motif interdit dans le code livré. npm run grep:faux
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOTS = [
  'apps',
  'packages',
  'scripts',
  'e2e',
  '.github',
  'Dockerfile',
  'docker-compose.yml',
  'README.md',
  '.env.example',
];
const SKIP = new Set(['node_modules', 'dist', 'drizzle', 'test-results', 'playwright-report', '.git']);

const PATTERNS = [
  [
    'jeu de données de test (seed, mock, fixtures)',
    /\bseed\s*\(|\bseedData\b|\bfixtures?\b|\bmock(?:Data)?\b/i,
    false,
  ],
  ['simulation de demande ou de réponse', /simuler|\bsimulate\b|onSimulate/i, false],
  ['setTimeout qui imite un envoi', /new Promise\(\s*\w+\s*=>\s*setTimeout\(\s*\w+\s*,\s*\d+\s*\)\)/, false],
  ['lorem', /lorem/i, false],
  ['demo / démonstration', /\bdemo\b|démonstration/i, true],
  ['donnée ou notification « test »', /notification test|données de test|\btest data\b/i, true],
  ['TODO / FIXME', /\bTODO\b|\bFIXME\b/, false],
  ['console.log de débogage', /console\.log\(/, false],
  ['délai « 48 heures » codé en dur', /48\s*heures/i, true],
  ['nom de domaine codé en dur', /@?[a-z0-9-]+\.(?:fr|com)\b/i, true],
];
// Les tests, la documentation (adresses SMTP des fournisseurs), les exemples d'environnement et ce script peuvent citer des adresses d'exemple ; les motifs marqués « true » y sont tolérés.
const TOLERATED = [
  /\.test\.tsx?$/,
  /(^|\/)tests\//,
  /^e2e\//,
  /\.env\.example$/,
  /^README\.md$/,
  /^scripts\/zero-faux\.mjs$/,
];

const hits = [];
function scan(path) {
  const rel = relative('.', path).split(sep).join('/');
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const f of readdirSync(path)) if (!SKIP.has(f)) scan(join(path, f));
    return;
  }
  if (/\.(png|woff2?|ico|webmanifest|map)$|package-lock/.test(rel)) return;
  const tolerated = TOLERATED.some((r) => r.test(rel));
  readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      for (const [name, re, soft] of PATTERNS) {
        if (rel === 'scripts/zero-faux.mjs') continue;
        if (soft && tolerated) continue;
        if (re.test(line)) hits.push(`${rel}:${i + 1}  [${name}]  ${line.trim().slice(0, 110)}`);
      }
    });
}
for (const r of ROOTS) {
  try {
    scan(r);
  } catch {
    /* racine absente */
  }
}
if (hits.length) {
  console.error(`${hits.length} occurrence(s) interdite(s) :\n${hits.join('\n')}`);
  process.exit(1);
}
process.stdout.write('Zéro faux : 0 occurrence des motifs interdits dans le code livré.\n');
