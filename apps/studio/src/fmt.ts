import { formatDateFr } from '@cree/shared';

export const AVATARS = ['#E9E1FF', '#FBE0EE', '#E0ECFF', '#E2F3E8', '#FFF0D9'];

/** Durée écoulée lisible : « à l'instant », « 5 min », « 3 h », « hier », puis date courte. */
export function rel(iso: string, now = Date.now()): string {
  const m = (now - new Date(iso).getTime()) / 60000;
  if (m < 1) return "à l'instant";
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  if (m < 2880) return 'hier';
  return formatDateFr(iso, { day: 'numeric', month: 'short' });
}

export function dayAndMonth(date: string): { day: string; month: string } {
  return {
    day: formatDateFr(date, { day: 'numeric' }),
    month: formatDateFr(date, { month: 'short' }).replace('.', ''),
  };
}

export function hours(h: number | null): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
}

export function download(name: string, text: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const fileSize = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} Ko`
    : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
