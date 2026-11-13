import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Injecte dans sw.js la liste exacte des fichiers compilés à mettre en cache et une version dérivée de leur contenu. */
function precache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cree-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split(sep).join('/'));
        }
      };
      walk(outDir);
      const shell = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const hash = createHash('sha256');
      for (const f of shell) hash.update(f).update(readFileSync(join(outDir, f)));
      const sw = readFileSync(join(outDir, 'sw.js'), 'utf8')
        .replaceAll('__VERSION__', hash.digest('hex').slice(0, 12))
        .replaceAll('__PRECACHE__', JSON.stringify(['/studio/', ...shell.map((f) => `/studio/${f}`)]));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: '/studio/',
  plugins: [react(), precache()],
  server: { port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3100' } },
  build: { target: 'es2022', sourcemap: false },
});
