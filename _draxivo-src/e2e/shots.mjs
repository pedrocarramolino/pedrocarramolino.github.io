// Capturas de revisión visual con datos de ejemplo (no forma parte de las pruebas).
// Uso: npm run build && node e2e/shots.mjs [claro|oscuro]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const PORT = 4181;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'e2e/screens/shots';
mkdirSync(OUT, { recursive: true });
const dark = process.argv[2] === 'oscuro';

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: dark ? 'dark' : 'light' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(BASE);
await page.getByRole('button', { name: 'Empezar' }).click();
await page.getByPlaceholder('Cómo quieres que te llamemos').fill('Pedro');
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('heading', { name: 'Hoy' }).waitFor();

// Datos de ejemplo
await page.evaluate(async () => {
  const req = indexedDB.open('draxivo');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const tx = db.transaction(['routines', 'workouts', 'bodyweights'], 'readwrite');
  const mk = (id, name, ids, cat) => ({ id, name, description: '', goal: 'Hipertrofia', category: cat, folderId: null, exercises: ids.map((e, i) => ({ id: id + i, exerciseId: e, restSec: null, notes: '', supersetId: null, effort: 'none', sets: [1, 2, 3].map((k) => ({ id: id + i + k, type: 'normal', repsMin: 8, repsMax: 10, weight: null, rpe: null, rir: null, durationSec: null, distanceM: null })) })), estimatedMin: null, notes: '', archived: false, isTemplate: false, variantOf: null, order: 0, createdAt: 1, updatedAt: 1 });
  const rs = [
    mk('ra', 'Torso A', ['ex-press-banca', 'ex-press-inclinado-mancuernas', 'ex-remo-barra', 'ex-elevaciones-laterales', 'ex-curl-barra'], 'Torso'),
    mk('rb', 'Pierna A', ['ex-sentadilla', 'ex-peso-muerto-rumano', 'ex-prensa', 'ex-curl-femoral-tumbado', 'ex-gemelo-de-pie'], 'Pierna'),
    mk('rc', 'Tirón', ['ex-dominadas', 'ex-jalon-pecho', 'ex-remo-polea-baja', 'ex-face-pull'], 'Tirón'),
  ];
  for (const r of rs) tx.objectStore('routines').put(r);
  for (let i = 0; i < 10; i++) {
    const d = day(i * 3 + 1);
    const start = new Date(d + 'T18:00:00').getTime();
    tx.objectStore('workouts').put({ id: 'w' + i, routineId: 'ra', routineName: 'Torso A', name: 'Torso A', status: 'completed', startedAt: start, endedAt: start + 55 * 60000, pausedAt: null, pausedTotalMs: 0, date: d, notes: '', rest: null, planEntryId: null, createdAt: start, updatedAt: start, exercises: [
      { id: 'we' + i, exerciseId: 'ex-press-banca', name: 'Press de banca con barra', tracking: 'weight_reps', primaryMuscle: 'pecho', restSec: null, notes: '', supersetId: null, effort: 'none', sets: [1, 2, 3].map((k) => ({ id: 's' + i + k, type: 'normal', weight: 70 - i * 1.5, reps: 8, rpe: null, rir: null, durationSec: null, distanceM: null, completed: true, completedAt: start })) },
    ] });
  }
  for (let i = 0; i < 21; i++) tx.objectStore('bodyweights').put({ id: 'b' + i, date: day(i), time: null, weightKg: 86.4 + i * 0.12 + Math.sin(i) * 0.3, note: '', createdAt: 1, updatedAt: 1 });
  await new Promise((r) => (tx.oncomplete = r));
});
await page.reload();
await page.waitForTimeout(800);

const go = async (h) => {
  await page.goto(BASE + '#' + h);
  await page.waitForTimeout(450);
};
const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${dark ? 'd-' : ''}${n}.png`, fullPage: full });

await go('/');
await shot('inicio');
await go('/routines');
await shot('rutinas');
await go('/routines/ra');
await shot('rutina-detalle');
await go('/exercises');
await shot('biblioteca');
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(200);
await shot('biblioteca-2');
await go('/exercises/ex-press-banca');
await shot('ejercicio-detalle', true);
await go('/progress');
await shot('progreso', true);
await go('/profile');
await shot('perfil', true);
await go('/');
await page.getByRole('button', { name: 'Registrar peso' }).click();
await page.waitForTimeout(500);
await shot('registrar-peso');
await page.keyboard.press('Escape');
await go('/train');
await page.getByRole('button', { name: 'Empezar Torso A' }).click();
await page.waitForTimeout(500);
const press = page.locator('section[aria-label="Press de banca con barra"]');
await press.getByLabel('Peso serie 1', { exact: true }).fill('72,5');
await press.getByLabel('Repeticiones serie 1', { exact: true }).fill('8');
await page.getByRole('button', { name: 'Completar serie', exact: true }).click();
await page.waitForTimeout(400);
await shot('entreno');
await shot('entreno-full', true);
await page.locator('.wk-title').click();
await page.waitForTimeout(400);
await shot('entreno-lista');
await browser.close();
server.kill();
console.log('ok');
