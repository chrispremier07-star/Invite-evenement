import type { FastifyRequest } from 'fastify';
import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Élément') => new HttpError(404, 'introuvable', `${what} introuvable.`);

/** Valide une entrée avec un schéma Zod ; renvoie une erreur 422 en français listant les champs fautifs. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
  throw new HttpError(422, 'validation', 'Certaines informations sont invalides.', fields);
}

declare module 'fastify' {
  interface FastifyRequest {
    ipHash: string;
    user: { id: string; email: string; sessionId: string } | null;
  }
}

export type Req = FastifyRequest;
