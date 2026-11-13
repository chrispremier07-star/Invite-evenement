import * as Sentry from '@sentry/node';
import { buildApp } from './app';
import { createDeps } from './deps';
import { runMigrations } from './db/migrate';
import { EnvError, loadEnv } from './env';
import { bootstrap } from './services/core';
import { scheduleMaintenance } from './services/jobs';

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (e) {
    if (e instanceof EnvError) {
      process.stderr.write(`${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }
  if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });

  const deps = createDeps(env);
  await runMigrations(deps.db);
  await bootstrap(deps.db, env);
  const app = await buildApp(deps);
  const timer = scheduleMaintenance(deps, app.log);

  const stop = async (signal: string) => {
    app.log.info({ signal }, 'Arrêt en cours');
    clearInterval(timer);
    deps.realtime.close();
    await app.close();
    await deps.pool.end();
    await Sentry.close(2000);
    process.exit(0);
  };
  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((e) => {
  Sentry.captureException(e);
  process.stderr.write(`Démarrage impossible : ${(e as Error).message}\n`);
  process.exit(1);
});
