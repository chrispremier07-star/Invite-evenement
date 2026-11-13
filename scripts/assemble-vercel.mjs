// Assemble un seul dossier statique pour Vercel : formulaire à la racine, Studio sous /studio/.
import { cpSync, existsSync, rmSync } from 'node:fs';

const form = 'apps/form/dist';
const studio = 'apps/studio/dist';
for (const d of [form, studio]) {
  if (!existsSync(d)) throw new Error(`${d} introuvable : lancez d'abord la compilation des interfaces.`);
}
rmSync(`${form}/studio`, { recursive: true, force: true });
cpSync(studio, `${form}/studio`, { recursive: true });
process.stdout.write(`Studio copié dans ${form}/studio\n`);
