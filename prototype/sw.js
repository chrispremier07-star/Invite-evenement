// Crée Studio — service worker : cache de l'interface, notifications push.
const CACHE = 'cree-studio-v1';
const SHELL = ['./Cree-Studio.dc.html', './support.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Réseau d'abord, cache en secours (l'app reste consultable hors ligne)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request)));
});
// Push serveur : payload JSON { title, body, id }
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Nouvelle demande', {
    body: d.body || 'Une nouvelle demande vient d\'arriver.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.id || 'cree', data: { id: d.id }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  const url = './Cree-Studio.dc.html' + (id ? '#' + id : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.includes('Cree-Studio'));
    if (c) { c.postMessage({ open: id }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
