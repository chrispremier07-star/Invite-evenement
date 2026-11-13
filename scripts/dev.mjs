// Lance l'API et les deux interfaces en développement : npm run dev  (docker compose up -d doit avoir été lancé).
const say = (s) =>
  process.stdout.write(`${s}
`);
import { spawn } from 'node:child_process';

const jobs = [
  ['api', ['run', 'dev', '-w', '@cree/api']],
  ['formulaire', ['run', 'dev', '-w', '@cree/form']],
  ['studio', ['run', 'dev', '-w', '@cree/studio']],
];
const procs = jobs.map(([name, args]) => {
  const p = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  const tag = (d) =>
    d
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((l) => say(`[${name}] ${l}`));
  p.stdout.on('data', tag);
  p.stderr.on('data', tag);
  return p;
});
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
say(
  'Formulaire : http://localhost:5173 · Studio : http://localhost:5174/studio/ · API : http://localhost:3100 · Mails : http://localhost:8125',
);
