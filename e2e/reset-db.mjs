// Recrée la base de test de bout en bout, vierge. Lancé avant le démarrage du serveur.
import pg from 'pg';

const base = process.env.DATABASE_URL;
const admin = new pg.Client({ connectionString: base.replace(/\/[^/]+$/, '/postgres') });
await admin.connect();
await admin.query('drop database if exists cree_e2e with (force)');
await admin.query('create database cree_e2e');
await admin.end();
await fetch(`http://localhost:${process.env.MAILPIT_PORT}/api/v1/messages`, { method: 'DELETE' }).catch(
  () => undefined,
);
