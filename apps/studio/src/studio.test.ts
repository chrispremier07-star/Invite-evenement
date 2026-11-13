import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOffline, queueList } from './offline';
import { flushQueue, mutate } from './api';
import { hours, rel } from './fmt';

type Call = { method: string; url: string };
let calls: Call[] = [];

function stubFetch(handler: (c: Call) => Response | Promise<Response>) {
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const c = { method: init.method ?? 'GET', url };
      calls.push(c);
      return handler(c);
    }),
  );
}
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const offline = () => {
  throw new TypeError('Failed to fetch');
};

beforeEach(async () => {
  calls = [];
  await clearOffline();
});
afterEach(() => vi.unstubAllGlobals());

describe('file d’actions hors ligne', () => {
  it('envoie directement quand le réseau répond', async () => {
    stubFetch(ok);
    expect(
      await mutate({ method: 'PATCH', path: '/studio/submissions/1/status', body: { status: 'signed' } }),
    ).toBe('sent');
    expect(await queueList()).toHaveLength(0);
  });

  it('met en file sans réseau puis rejoue dans l’ordre au retour', async () => {
    stubFetch(offline);
    await mutate({ method: 'PATCH', path: '/studio/submissions/1/status', body: { status: 'quote' } });
    await mutate({ method: 'POST', path: '/studio/submissions/1/notes', body: { id: 'n1', body: 'a' } });
    expect(await queueList()).toHaveLength(2);

    calls = [];
    stubFetch(ok);
    const r = await flushQueue();
    expect(r).toEqual({ sent: 2, dropped: 0 });
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST']);
    expect(await queueList()).toHaveLength(0);
  });

  it('conserve les actions si la coupure continue', async () => {
    stubFetch(offline);
    await mutate({ method: 'PATCH', path: '/studio/submissions/1/status', body: { status: 'quote' } });
    expect(await flushQueue()).toEqual({ sent: 0, dropped: 0 });
    expect(await queueList()).toHaveLength(1);
  });

  it('abandonne une action refusée définitivement (4xx) sans bloquer la suivante', async () => {
    stubFetch(offline);
    await mutate({ method: 'PATCH', path: '/studio/submissions/gone/status', body: { status: 'quote' } });
    await mutate({ method: 'PATCH', path: '/studio/submissions/2/status', body: { status: 'signed' } });
    stubFetch((c) =>
      c.url.includes('gone')
        ? new Response(JSON.stringify({ error: { code: 'introuvable', message: 'Demande introuvable.' } }), {
            status: 404,
          })
        : ok(),
    );
    expect(await flushQueue()).toEqual({ sent: 1, dropped: 1 });
    expect(await queueList()).toHaveLength(0);
  });

  it('s’arrête et conserve la file sur une erreur serveur (5xx)', async () => {
    stubFetch(offline);
    await mutate({ method: 'PATCH', path: '/studio/submissions/1/status', body: { status: 'quote' } });
    stubFetch(() => new Response('{}', { status: 503 }));
    expect(await flushQueue()).toEqual({ sent: 0, dropped: 0 });
    expect(await queueList()).toHaveLength(1);
  });
});

describe('formats', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  it('exprime l’ancienneté', () => {
    expect(rel('2026-11-12T11:59:40Z', now)).toBe("à l'instant");
    expect(rel('2026-11-12T11:30:00Z', now)).toBe('30 min');
    expect(rel('2026-11-12T09:00:00Z', now)).toBe('3 h');
    expect(rel('2026-11-11T09:00:00Z', now)).toBe('hier');
  });
  it('exprime un délai moyen', () => {
    expect(hours(null)).toBe('—');
    expect(hours(0.2)).toBe('12 min');
    expect(hours(5)).toBe('5 h');
    expect(hours(72)).toBe('3 j');
  });
});
