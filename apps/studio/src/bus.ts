/** Bus interne : le flux temps réel de l'application y publie, les écrans s'y abonnent. */
export const bus = new EventTarget();

export function publish(type: string, id = ''): void {
  bus.dispatchEvent(new CustomEvent('rt', { detail: { type, id } }));
}
