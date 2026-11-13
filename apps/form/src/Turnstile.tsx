import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id?: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;
function loadScript(src: string): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${src}?render=explicit`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Widget anti-robot Cloudflare Turnstile ; `resetKey` change pour obtenir un nouveau jeton. */
export function Turnstile(props: {
  siteKey: string;
  scriptUrl: string;
  resetKey: number;
  onToken: (t: string) => void;
  onFail: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { siteKey, scriptUrl, resetKey, onToken, onFail } = props;
  useEffect(() => {
    let id: string | undefined;
    let dead = false;
    loadScript(scriptUrl)
      .then(() => {
        if (dead || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: 'fr',
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(''),
          'error-callback': () => onFail(),
        });
      })
      .catch(onFail);
    return () => {
      dead = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, scriptUrl, resetKey, onToken, onFail]);
  return <div ref={box} style={{ minHeight: 65 }} />;
}
