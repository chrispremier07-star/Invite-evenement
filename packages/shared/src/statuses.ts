export const STATUS_IDS = ['new', 'progress', 'quote', 'signed', 'archived'] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export const STATUSES: ReadonlyArray<{ id: StatusId; label: string; color: string }> = [
  { id: 'new', label: 'Nouvelle', color: 'oklch(0.58 0.2 290)' },
  { id: 'progress', label: 'En échange', color: 'oklch(0.72 0.15 70)' },
  { id: 'quote', label: 'Devis envoyé', color: 'oklch(0.62 0.15 240)' },
  { id: 'signed', label: 'Signée', color: 'oklch(0.64 0.15 155)' },
  { id: 'archived', label: 'Archivée', color: 'oklch(0.7 0.02 290)' },
];

export function statusOf(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0]!;
}
