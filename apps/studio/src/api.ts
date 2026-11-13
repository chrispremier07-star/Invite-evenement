import { cacheGet, cacheSet, queueAdd, queueList, queueRemove, type QueuedOp } from './offline';

export class ApiFail extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export class NetworkError extends Error {
  constructor() {
    super('Pas de connexion pour le moment.');
  }
}

export const UNAUTH_EVENT = 'cree:non-connecte';

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }
  const data = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string; fields?: Record<string, string> };
  } | null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(UNAUTH_EVENT));
    throw new ApiFail(
      res.status,
      data?.error?.code ?? 'erreur',
      data?.error?.message ?? 'Une erreur est survenue. Réessayez dans un instant.',
      data?.error?.fields,
    );
  }
  return data as T;
}

/** Réseau d'abord ; sans réseau, dernière réponse connue (`offline: true`). */
export async function getCached<T>(path: string): Promise<{ data: T; offline: boolean }> {
  try {
    const data = await request<T>('GET', path);
    void cacheSet(path, data);
    return { data, offline: false };
  } catch (e) {
    if (e instanceof NetworkError) {
      const hit = await cacheGet<T>(path);
      if (hit !== undefined) return { data: hit, offline: true };
    }
    throw e;
  }
}

export type MutationResult = 'sent' | 'queued';

/** Envoie une écriture ; sans réseau, la met en file pour la rejouer plus tard (les écritures sont idempotentes). */
export async function mutate(op: Omit<QueuedOp, 'id' | 'queuedAt'>): Promise<MutationResult> {
  try {
    await request(op.method, op.path, op.body);
    return 'sent';
  } catch (e) {
    if (e instanceof NetworkError) {
      await queueAdd(op);
      return 'queued';
    }
    throw e;
  }
}

let flushing: Promise<{ sent: number; dropped: number }> | null = null;
/** Rejoue les actions en attente, dans l'ordre. Une erreur définitive (4xx) abandonne l'action ; une coupure arrête la relecture. */
export function flushQueue(): Promise<{ sent: number; dropped: number }> {
  flushing ??= (async () => {
    let sent = 0;
    let dropped = 0;
    try {
      for (const op of await queueList()) {
        try {
          await request(op.method, op.path, op.body);
          sent++;
        } catch (e) {
          if (e instanceof NetworkError) break;
          if (e instanceof ApiFail && e.status >= 500) break;
          dropped++;
        }
        await queueRemove(op.id!);
      }
    } finally {
      flushing = null;
    }
    return { sent, dropped };
  })();
  return flushing;
}
