import { rewrite } from '@vercel/edge';

/**
 * Déploiement Vercel : le formulaire et le Studio sont des fichiers statiques ; l'API (processus continu avec flux
 * temps réel) vit ailleurs. Ce relais transmet `/api/*` et `/health` à l'API pour que le navigateur ne voie qu'une
 * seule origine : cookies de session, CSRF et CORS restent ceux d'un site unique.
 * L'adresse de l'API vient de la variable d'environnement Vercel API_ORIGIN, jamais du code.
 */
export const config = { matcher: ['/api/:path*', '/health'] };

export default function middleware(request: Request): Response {
  const origin = process.env.API_ORIGIN;
  if (!origin) {
    return new Response(
      JSON.stringify({ error: { code: 'configuration', message: 'Le service est en cours de configuration.' } }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }
  const url = new URL(request.url);
  return rewrite(new URL(`${url.pathname}${url.search}`, origin));
}
