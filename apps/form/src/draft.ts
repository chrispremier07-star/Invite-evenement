/** Brouillon local : les réponses survivent à un rechargement ou à une coupure réseau. */
export interface DraftFile {
  id: string;
  name: string;
  size: number;
}
export interface Draft {
  step: number;
  maxStep: number;
  data: Record<string, unknown>;
  locs: Array<{ id: number; v: string }>;
  files: DraftFile[];
  idempotencyKey: string;
}

const KEY = 'cree:brouillon';

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* stockage plein ou bloqué : l'envoi reste possible */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à nettoyer */
  }
}
