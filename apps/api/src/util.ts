import { createHash, createHmac, randomBytes } from 'node:crypto';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hmacIp = (secret: string, ip: string) =>
  createHmac('sha256', secret).update(ip).digest('hex').slice(0, 40);

export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

/** Minuscules sans accents : sert à indexer et à interroger la recherche plein texte. */
export function normalizeSearch(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Construit une requête `to_tsquery` à préfixes à partir de la saisie libre (jamais de syntaxe brute). */
export function toTsQuery(input: string): string | null {
  const words = normalizeSearch(input)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

/** Empêche l'interprétation d'une cellule comme formule par un tableur (injection CSV). */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
