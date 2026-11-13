import { openDB, type IDBPDatabase } from 'idb';

/** Cache de lecture hors ligne et file des actions à rejouer au retour du réseau (IndexedDB). */
export interface QueuedOp {
  id?: number;
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  queuedAt: number;
}

let dbp: Promise<IDBPDatabase> | null = null;
const db = () =>
  (dbp ??= openDB('cree-studio', 1, {
    upgrade(d) {
      d.createObjectStore('cache');
      d.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    },
  }));

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get('cache', key)) as T | undefined;
  } catch {
    return undefined;
  }
}
export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    await (await db()).put('cache', value, key);
  } catch {
    /* stockage indisponible : l'application reste utilisable en ligne */
  }
}
export async function queueAdd(op: Omit<QueuedOp, 'id' | 'queuedAt'>): Promise<void> {
  await (await db()).add('queue', { ...op, queuedAt: Date.now() });
}
export async function queueList(): Promise<QueuedOp[]> {
  return (await (await db()).getAll('queue')) as QueuedOp[];
}
export async function queueRemove(id: number): Promise<void> {
  await (await db()).delete('queue', id);
}
export async function clearOffline(): Promise<void> {
  const d = await db();
  await d.clear('cache');
  await d.clear('queue');
}
