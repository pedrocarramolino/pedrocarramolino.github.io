// Pruebas de extremo a extremo con Playwright contra la app compilada.
//
// 1. Crea una base de datos local (stub de Supabase + migraciones).
// 2. Arranca el backend de pruebas (Auth + PostgREST simulados sobre Postgres real con RLS).
// 3. Arranca `next start` (requiere `npm run build` con .env.local apuntando a http://localhost:54321).
// 4. Ejecuta los escenarios de e2e/scenarios.mjs.
//
//   npm run build && npm run e2e
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const ADMIN = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'aula_e2e';

async function setupDb() {
  const admin = new pg.Client({ connectionString: ADMIN });
  await admin.connect();
  await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = '${DB}' and pid <> pg_backend_pid()`);
  await admin.query(`drop database if exists ${DB}`);
  await admin.query(`create database ${DB}`);
  await admin.end();
  const url = new URL(ADMIN);
  url.pathname = '/' + DB;
  const c = new pg.Client({ connectionString: url.toString() });
  await c.connect();
  await c.query(readFileSync(path.join(here, 'db/supabase-stub.sql'), 'utf8'));
  for (const f of readdirSync(path.join(root, 'supabase/migrations')).sort()) {
    await c.query(readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'));
  }
  await c.end();
  return url.toString();
}

function start(cmd, args, env, ready) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let out = '';
    const onData = (d) => {
      out += d;
      if (process.env.VERBOSE) process.stdout.write(d);
      if (ready.test(out)) resolve(p);
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('exit', (code) => reject(new Error(`${cmd} terminó (${code}):\n${out}`)));
    setTimeout(() => reject(new Error(`${cmd} no arrancó a tiempo:\n${out}`)), 60_000);
  });
}

const dbUrl = await setupDb();
const backend = await start('node', ['e2e/backend/server.mjs'], { DATABASE_URL: dbUrl, DEBUG: process.env.VERBOSE ?? '' }, /Backend de pruebas/);
const web = await start('npx', ['next', 'start', '-p', '3100'], { TZ: 'Europe/Madrid' }, /Ready|started server|Local:/);

const browser = await chromium.launch();
mkdirSync(path.join(here, 'shots'), { recursive: true });
let failed = 0;
try {
  const { run } = await import('./scenarios.mjs');
  failed = await run({ browser, base: 'http://localhost:3100', shots: path.join(here, 'shots'), dbUrl });
} catch (e) {
  console.error(e);
  failed = 1;
} finally {
  await browser.close();
  for (const p of [web, backend]) {
    try {
      process.kill(-p.pid, 'SIGTERM');
    } catch {}
  }
}
process.exit(failed ? 1 : 0);
