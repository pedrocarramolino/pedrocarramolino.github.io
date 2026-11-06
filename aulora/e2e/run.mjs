// Pruebas de extremo a extremo con Playwright contra la app compilada y los
// emuladores oficiales de Firebase (Auth + Firestore, con las reglas reales).
//
//   npm run e2e:build   # compila la app apuntando a los emuladores (.env.e2e)
//   npm run e2e         # arranca los emuladores, la app y ejecuta los escenarios
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, getDocs, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const PROJECT = 'demo-aulora';

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

// Acceso de administración a los datos del emulador (sin reglas) para verificar.
const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: readFileSync(path.join(root, 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

const admin = {
  /** uid de la cuenta con ese correo. */
  async uid(email) {
    const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
      body: JSON.stringify({ returnUserInfo: true }),
    });
    const j = await r.json();
    return (j.userInfo ?? []).find((u) => u.email === email)?.localId;
  },
  /** Documentos de una colección de un profesor. */
  async docs(uid, name) {
    let out = [];
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), 'users', uid, name));
      out = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    return out;
  },
};

const web = await start('npx', ['next', 'start', '-p', '3100'], { TZ: 'Europe/Madrid' }, /Ready|started server|Local:/);
const browser = await chromium.launch();
mkdirSync(path.join(here, 'shots'), { recursive: true });
let failed = 0;
try {
  const { run } = await import('./scenarios.mjs');
  failed = await run({ browser, base: 'http://localhost:3100', shots: path.join(here, 'shots'), admin });
} catch (e) {
  console.error(e);
  failed = 1;
} finally {
  await browser.close();
  await env.cleanup();
  try {
    process.kill(-web.pid, 'SIGTERM');
  } catch {}
}
process.exit(failed ? 1 : 0);
