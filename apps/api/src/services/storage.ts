import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../env';

export interface Storage {
  /** URL d'envoi (PUT) signée : le type et la taille exacts du fichier font partie de la signature. */
  presignUpload(
    key: string,
    contentType: string,
    size: number,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  head(key: string): Promise<{ size: number; contentType: string | undefined } | null>;
  signedGetUrl(key: string, filename: string): Promise<string>;
  remove(key: string): Promise<void>;
  /** Origine du stockage, pour la politique de sécurité du contenu (CSP). */
  origin: string;
}

export function createStorage(env: Env): Storage {
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    // Évite d'ajouter des en-têtes de somme de contrôle que les formulaires POST des navigateurs ne peuvent pas fournir.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return {
    origin: new URL(env.S3_ENDPOINT).origin,
    async presignUpload(key, contentType, size) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          ContentType: contentType,
          ContentLength: size,
        }),
        { expiresIn: 600, signableHeaders: new Set(['content-type', 'content-length']) },
      );
      return { url, headers: { 'Content-Type': contentType } };
    },
    async head(key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
        return { size: r.ContentLength ?? 0, contentType: r.ContentType };
      } catch {
        return null;
      }
    },
    signedGetUrl(key, filename) {
      const safe = filename.replace(/[^\w.\- ()]/g, '_');
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${safe}"`,
        }),
        { expiresIn: 300 },
      );
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    },
  };
}
