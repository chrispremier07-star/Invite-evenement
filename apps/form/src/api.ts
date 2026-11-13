import type { PublicConfig } from '@cree/shared';

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

const NETWORK_MESSAGE = 'Connexion impossible pour le moment. Vérifiez votre réseau, puis réessayez.';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiFail(0, 'reseau', NETWORK_MESSAGE);
  }
  const data = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string; fields?: Record<string, string> };
  } | null;
  if (!res.ok)
    throw new ApiFail(
      res.status,
      data?.error?.code ?? 'erreur',
      data?.error?.message ?? 'Une erreur est survenue. Réessayez dans un instant.',
      data?.error?.fields,
    );
  return data as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const getConfig = () => call<PublicConfig>('/api/public-config');
export const sendSubmission = (body: unknown) => call<{ id: string }>('/api/submissions', json(body));
export const presign = (file: { filename: string; contentType: string; size: number }) =>
  call<{ attachmentId: string; url: string; headers: Record<string, string> }>(
    '/api/uploads/presign',
    json(file),
  );

/** Envoi direct au stockage avec progression (XMLHttpRequest, seul moyen d'observer l'envoi). */
export function uploadToStorage(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiFail(xhr.status, 'televersement', 'Ce fichier n’a pas pu être envoyé. Réessayez.'));
    xhr.onerror = () => reject(new ApiFail(0, 'reseau', NETWORK_MESSAGE));
    xhr.send(file);
  });
}
