import { request } from './api';

export type PushState = 'unsupported' | 'denied' | 'default' | 'granted';

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function permission(): PushState {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission as PushState;
}

function keyToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Demande l'autorisation, s'abonne au service push du navigateur et enregistre l'abonnement côté serveur. */
export async function enablePush(): Promise<PushSubscription> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted')
    throw new Error('Les notifications sont bloquées. Autorisez-les dans les réglages du navigateur.');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await request<{ publicKey: string }>('GET', '/studio/push/key');
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
  await request('POST', '/studio/push/subscribe', sub.toJSON());
  return sub;
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await request('POST', '/studio/push/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}
