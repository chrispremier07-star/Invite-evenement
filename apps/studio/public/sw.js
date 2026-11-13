/* global __PRECACHE__ */
// Crée Studio — service worker.
// Interface : cache d'abord (liste générée à la compilation). Données : jamais interceptées, le réseau est interrogé
// d'abord par l'application, qui retombe sur son cache IndexedDB hors ligne.
const VERSION = '__VERSION__';
const CACHE = `cree-studio-${VERSION}`;
const SHELL = __PRECACHE__;
const BASE = '/studio/';

self.addEventListener('install', (event) => {
  // Pas de skipWaiting automatique : l'application propose la mise à jour à l'utilisateur.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('cree-studio-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match(BASE + 'index.html').then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req).then((r) => r || fetch(req)));
});

self.addEventListener('push', (event) => {
  let d;
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  const unread = typeof d.unread === 'number' ? d.unread : undefined;
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(d.title || 'Crée Studio', {
        body: d.body || '',
        icon: BASE + 'icons/icon-192.png',
        badge: BASE + 'icons/icon-192.png',
        tag: d.tag || d.id || 'cree',
        data: { id: d.id || null },
      }),
      unread !== undefined && self.navigator.setAppBadge
        ? (unread > 0 ? self.navigator.setAppBadge(unread) : self.navigator.clearAppBadge()).catch(
            () => undefined,
          )
        : undefined,
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.id;
  const target = BASE + (id ? '#/demande/' + id : '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const c = clients.find((x) => x.url.includes(BASE));
      if (c) {
        c.postMessage({ type: 'open', id });
        return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
