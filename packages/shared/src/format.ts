const NBSP = ' ';

/** Montant avec groupes de trois chiffres séparés par une espace insécable. */
export function formatAmount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Montant en FCFA : « 1 300 000 FCFA ». */
export function formatFcfa(n: number): string {
  return `${formatAmount(n)}${NBSP}FCFA`;
}

export type DateStyle = Intl.DateTimeFormatOptions;

/**
 * Formate une date `YYYY-MM-DD` (sans fuseau) ou un instant ISO.
 * Un instant est affiché dans le fuseau demandé, par défaut celui de l'appareil.
 */
export function formatDateFr(value: string, options?: DateStyle, timeZone?: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const opts: DateStyle = options ?? { day: 'numeric', month: 'long', year: 'numeric' };
  try {
    if (dateOnly) {
      return new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(
        new Date(`${value}T00:00:00Z`),
      );
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', timeZone ? { ...opts, timeZone } : opts).format(d);
  } catch {
    return value;
  }
}

/** Libellé du délai de réponse, calculé à partir du réglage en heures. */
export function formatResponseDelay(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) return `Réponse sous ${hours / 24} jours`;
  return `Réponse sous ${hours} ${hours > 1 ? 'heures' : 'heure'}`;
}

export function initials(name: string | undefined): string {
  const letters = (name ?? '')
    .split(/\s+/)
    .filter((w) => /^[A-ZÀ-Ý]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return letters || '?';
}
