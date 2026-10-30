// Pruebas funcionales de extremo a extremo sobre el build de producción.
// Uso: npm run build && node e2e/run.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS ?? 'e2e/screens';
mkdirSync(SHOTS, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const results = [];
const consoleErrors = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(['OK', name]);
    console.log('✔', name);
  } catch (e) {
    results.push(['FALLO', name, e.message.split('\n')[0]]);
    await page.screenshot({ path: `${SHOTS}/fallo-${results.length}.png` }).catch(() => {});
    console.log('✘', name, '\n   ', e.message.split('\n').slice(0, 3).join('\n    '));
  }
}
function assert(c, msg) {
  if (!c) throw new Error(msg);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
const page = await ctx.newPage();
page.setDefaultTimeout(6000);
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });
const go = async (hash) => {
  await page.goto(BASE + '#' + hash);
  await page.waitForTimeout(250);
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const pickDate = async (scope, label, iso) => {
  await scope.getByRole('button', { name: new RegExp(`^${label}:`) }).click();
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  if (m - 1 !== now.getMonth() || y !== now.getFullYear()) await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.getByRole('button', { name: `${d} ${MESES[m - 1]} ${y}`, exact: true }).click();
};
const typeWeight = async (v) => {
  await page.getByRole('button', { name: /^Peso .*Pulsa para escribirlo/ }).click();
  await page.getByRole('textbox', { name: 'Peso corporal' }).fill(v);
};
const noHScroll = async (label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert(o.sw <= o.w, `${label}: desplazamiento horizontal (${o.sw} > ${o.w})`);
};

await page.goto(BASE);

await step('Onboarding y pantalla de inicio vacía', async () => {
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.getByPlaceholder('Cómo quieres que te llamemos').fill('Pedro');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('heading', { name: 'Hoy' }).waitFor();
  await page.getByText('Tu progreso empieza aquí').waitFor();
  await page.getByText('Sin registros de peso').waitFor();
  await shot('01-inicio-vacio');
});

await step('Crear rutina con ejercicios, superserie y calentamiento', async () => {
  await go('/routines/new');
  await page.getByPlaceholder('Ej.: Torso A').fill('Torso A');
  await page.getByRole('button', { name: 'Añadir ejercicios' }).click();
  const search = page.getByRole('searchbox', { name: 'Buscar ejercicio' });
  await search.fill('press de banca con barra');
  await page.getByRole('button', { name: /Press de banca con barra/ }).click();
  await search.fill('remo con barra');
  await page.getByRole('button', { name: /^Remo con barra/ }).click();
  await page.getByRole('button', { name: 'Añadir 2' }).click();
  await page.getByRole('button', { name: '+ Calentamiento' }).first().click();
  await page.getByRole('button', { name: /Opciones de Press de banca/ }).click();
  await page.getByRole('button', { name: 'Superserie con el siguiente' }).click();
  await shot('02-editor-rutina');
  await page.getByRole('button', { name: 'Guardar rutina' }).click();
  await page.getByRole('heading', { name: 'Torso A' }).waitFor();
  await page.getByText('Superserie con el siguiente').first().waitFor();
});

await step('Crear muchas rutinas (sin límites) y ejercicio personalizado', async () => {
  await page.evaluate(async () => {
    const req = indexedDB.open('draxivo');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const tx = db.transaction('routines', 'readwrite');
    for (let i = 0; i < 120; i++) tx.objectStore('routines').put({ id: 'bulk' + i, name: 'Rutina ' + i, description: '', goal: '', category: 'Fuerza', folderId: null, exercises: [], estimatedMin: null, notes: '', archived: false, isTemplate: false, variantOf: null, order: i, createdAt: 1, updatedAt: 1 });
    await new Promise((r) => (tx.oncomplete = r));
  });
  await go('/routines');
  await page.getByText('Rutina 119').waitFor();
  await go('/exercises');
  await page.getByRole('button', { name: 'Nuevo ejercicio' }).click();
  await page.getByPlaceholder('Ej.: Press inclinado en Smith').fill('Press Smith inclinado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('heading', { name: 'Press Smith inclinado' }).waitFor();
  await page.getByRole('button', { name: 'Opciones' }).click();
  await page.getByRole('button', { name: 'Editar ejercicio' }).click();
  await page.getByPlaceholder('Ajustes de la máquina, agarre, sensaciones…').fill('Banco a 30°');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Banco a 30°').waitFor();
});

await step('Duplicar, archivar y eliminar rutinas', async () => {
  await go('/routines');
  await page.getByRole('button', { name: 'Opciones de Rutina 1', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicar' }).click();
  await page.getByText('Rutina 1 (copia)').waitFor();
  await page.getByRole('button', { name: 'Opciones de Rutina 2', exact: true }).click();
  await page.getByRole('button', { name: 'Archivar' }).click();
  await page.getByText('Archivadas · 1').waitFor();
  await page.getByRole('button', { name: 'Opciones de Rutina 3', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
  await page.waitForTimeout(300);
  assert((await page.getByText('Rutina 3', { exact: true }).count()) === 0, 'la rutina no se eliminó');
});

let firstVolume = 0;
await step('Entrenar desde rutina: registrar series, descanso, deshacer', async () => {
  await go('/train');
  await page.getByRole('button', { name: 'Empezar Torso A' }).click();
  await page.getByRole('button', { name: 'Terminar' }).waitFor();
  const press = page.locator('section[aria-label="Press de banca con barra"]');
  const remo = page.locator('section[aria-label="Remo con barra"]');
  const fillSet = async (sec, n, w, r) => {
    const name = typeof n === 'number' ? `serie ${n}` : n;
    await sec.getByLabel(`Peso ${name}`, { exact: true }).fill(w);
    await sec.getByLabel(`Repeticiones ${name}`, { exact: true }).fill(r);
    await sec.getByLabel(`Completar ${name}`, { exact: true }).click();
  };
  // Press de banca: calentamiento + series de trabajo
  await fillSet(press, 'de calentamiento 1', '40', '10');
  await fillSet(press, 1, '80', '8');
  await fillSet(press, 2, '80', '8');
  // Remo (último de la superserie): el descanso arranca
  await fillSet(remo, 1, '60', '10');
  await page.getByRole('timer').waitFor();
  await shot('03-entrenamiento-activo');
  // Añadir y eliminar serie con deshacer
  await remo.getByRole('button', { name: 'Añadir serie' }).click();
  const before = await page.getByLabel(/Peso serie/).count();
  await remo.getByLabel(/^Serie 4: Normal/).click();
  await page.getByRole('button', { name: 'Eliminar serie' }).click();
  assert((await page.getByLabel(/Peso serie/).count()) === before - 1, 'no se eliminó la serie');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  assert((await page.getByLabel(/Peso serie/).count()) === before, 'deshacer no restauró la serie');
  const metrics = await page.locator('.wk-metrics').innerText();
  assert(/Volumen\s*1\.?880/.test(metrics.replace(/\s+/g, ' ')), 'volumen en vivo incorrecto: ' + metrics);
});

await step('Pausar, reanudar y recuperar sesión tras recargar', async () => {
  await page.getByRole('button', { name: /^Tiempo / }).click();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByText('Entrenamiento en pausa').waitFor();
  await page.getByRole('button', { name: 'Reanudar' }).first().click();
  await page.reload();
  await page.waitForTimeout(500);
  await go('/');
  await page.getByRole('button', { name: 'Volver al entrenamiento en curso' }).click();
  const press = page.locator('section[aria-label="Press de banca con barra"]');
  const w = await press.getByLabel('Peso serie 1', { exact: true }).inputValue();
  assert(w === '80', 'no se recuperó el peso: ' + w);
  assert(await press.getByLabel('Desmarcar serie 1', { exact: true }).isVisible(), 'serie completada no recuperada');
});

await step('Finalizar sesión y verificar métricas del resumen', async () => {
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByText(/series sin completar/).waitFor();
  await page.getByRole('button', { name: 'Terminar y guardar' }).click();
  await page.getByRole('heading', { name: '¡Entrenamiento guardado!' }).waitFor();
  const txt = (await page.locator('.stats-grid').innerText()).replace(/\s+/g, ' ');
  // 80×8 + 80×8 + 60×10 = 1880 (calentamiento excluido)
  assert(/1\.?880 kg/.test(txt), 'volumen del resumen: ' + txt);
  assert(/Series 3/.test(txt), 'series del resumen: ' + txt);
  firstVolume = 1880;
  await shot('04-resumen');
  await page.getByRole('button', { name: 'Hecho' }).click();
});

await step('Valores de la sesión anterior y récord en segunda sesión', async () => {
  await go('/train');
  await page.getByRole('button', { name: 'Empezar Torso A' }).click();
  const press = page.locator('section[aria-label="Press de banca con barra"]');
  const prev = await press.locator('.last-time').innerText();
  assert(prev.includes('80 kg × 8'), 'última vez no mostrada: ' + prev);
  await press.locator('.last-time').click();
  await page.waitForTimeout(250);
  assert((await press.getByLabel('Peso serie 1', { exact: true }).inputValue()) === '80', 'no copió los valores anteriores');
  await press.getByLabel('Peso serie 1', { exact: true }).fill('85');
  await press.getByLabel('Completar serie 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar y guardar' }).click();
  await page.getByText('Récords personales').waitFor();
  await page.getByText('Peso máximo').first().waitFor();
});

await step('Historial: lista, calendario, filtros, comparación y edición', async () => {
  await go('/history');
  await page.getByText('2 entrenamientos').waitFor();
  await page.getByRole('searchbox').fill('remo');
  await page.getByText('Quitar filtros (1 resultados)').waitFor();
  await page.getByRole('button', { name: /Quitar filtros/ }).click();
  await page.getByRole('radio', { name: 'Calendario' }).click();
  await page.locator('.cal-day.today').click();
  await page.getByRole('radio', { name: 'Lista' }).click();
  await page.locator('.row-button', { hasText: 'Torso A' }).last().click();
  await page.getByText('Comparar con otra sesión').waitFor();
  await page.getByRole('button', { name: 'Editar sesión' }).click();
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
  await page.getByText('Cambios guardados').waitFor();
});

await step('Estadísticas por ejercicio y 1RM estimado', async () => {
  await go('/exercises/ex-press-banca');
  await page.getByText('1RM est.').first().waitFor();
  await page.getByText('Récords personales').waitFor();
  const t = await page.locator('main').innerText();
  // Epley 85×8 = 107,7
  assert(t.includes('107,7'), '1RM estimado incorrecto');
});

await step('Registrar peso, corregir medición anterior y variación semanal', async () => {
  await go('/');
  await page.getByRole('button', { name: 'Registrar peso' }).first().click();
  await page.getByRole('slider', { name: 'Peso corporal' }).waitFor();
  await typeWeight('80,4');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Peso registrado').waitFor();
  await go('/body/weight');
  // Registro de hace 7 días
  await page.getByRole('button', { name: 'Registrar peso' }).first().click();
  await typeWeight('81');
  const d = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  await pickDate(page.getByRole('dialog'), 'Fecha', d);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Variación semanal').waitFor();
  // Corregir el antiguo: 81 → 81,5
  await page.locator('.row-split-main', { hasText: '81 kg' }).click();
  await typeWeight('81,5');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Registro corregido').waitFor();
  const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  assert(t.includes('−1,1 kg'), 'variación semanal esperada −1,1 kg: ' + t.slice(0, 400));
  await shot('05-peso');
});

await step('Medidas corporales', async () => {
  await go('/body/measurements');
  await page.getByRole('button', { name: 'Añadir medida' }).first().click();
  await page.getByLabel('Valor (cm)').fill('84');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('Últimos valores').waitFor();
});

await step('Teclado: buscador de ejercicios escribiendo letra a letra', async () => {
  await go('/routines/new');
  await page.getByRole('button', { name: 'Añadir ejercicios' }).click();
  const s = page.getByRole('searchbox', { name: 'Buscar ejercicio' });
  await s.click();
  const frase = 'press inclinado con mancuernas';
  await page.keyboard.type(frase, { delay: 35 });
  assert((await s.inputValue()) === frase, 'texto incompleto: ' + (await s.inputValue()));
  assert(await s.evaluate((el) => el === document.activeElement), 'el buscador perdió el foco');
  await page.getByRole('button', { name: /^Press inclinado con mancuernas/ }).click();
  assert((await s.inputValue()) === frase, 'se perdió el texto al seleccionar');
  assert(await s.evaluate((el) => el === document.activeElement), 'el foco salió del buscador al seleccionar');
  await s.press('Control+A');
  await page.keyboard.type('remo con barra', { delay: 35 });
  await page.getByRole('button', { name: /^Remo con barra/ }).click();
  await page.getByRole('button', { name: 'Añadir 2' }).click();
  await page.locator('.wex-name h3', { hasText: 'Press inclinado con mancuernas' }).waitFor();
  await page.locator('.wex-name h3', { hasText: 'Remo con barra' }).waitFor();
  // Otra hoja con texto (nota del peso): también debe escribir de forma continua.
  await go('/');
  await page.getByRole('button', { name: 'Registrar peso' }).first().click();
  const nota = page.getByPlaceholder('Cómo te sientes, cambios, etc.');
  await nota.click();
  await page.keyboard.type('en ayunas tras dormir bien', { delay: 30 });
  assert((await nota.inputValue()) === 'en ayunas tras dormir bien', 'la nota se cortó: ' + (await nota.inputValue()));
  await page.getByRole('button', { name: 'Cancelar' }).click();
});

const leerTarjetas = () =>
  page.locator('.gen-item').evaluateAll((els) => els.map((e) => e.querySelector('.card-sub')?.textContent ?? ''));
const minutosEstimados = async () => Number((await page.locator('.gen-time .hero-number').innerText()).replace(/[^\d]/g, ''));

await step('Generador: «bíceps y tríceps» en 45 minutos', async () => {
  await go('/routines/generate');
  await page.getByLabel('Qué quieres entrenar').fill('Quiero entrenar bíceps y tríceps durante 45 minutos');
  assert(await page.getByRole('button', { name: 'Bíceps', exact: true }).getAttribute('aria-pressed') === 'true', 'no detectó bíceps');
  assert(await page.getByRole('radio', { name: '45 min' }).getAttribute('aria-checked') === 'true', 'no detectó 45 min');
  await page.getByRole('button', { name: 'Generar rutina' }).click();
  await page.locator('.gen-item').first().waitFor();
  const subs = await leerTarjetas();
  assert(subs.length >= 4, 'muy pocos ejercicios: ' + subs.length);
  assert(subs.every((t) => /^(Bíceps|Tríceps)/.test(t)), 'ejercicios de otros músculos: ' + subs.join(' | '));
  const min = await minutosEstimados();
  assert(min >= 35 && min <= 47, 'duración no razonable: ' + min);
  const arts = await page.locator('.gen-item .exercise-art').count();
  assert(arts === subs.length, 'faltan ilustraciones en la propuesta');
  await shot('11-generador');
});

await step('Generador: pecho 20 min con mancuernas, editar, sustituir y guardar y empezar', async () => {
  await go('/routines');
  await go('/routines/generate');
  await page.getByRole('button', { name: 'Pecho', exact: true }).click();
  await page.getByRole('radio', { name: '20 min' }).click();
  await page.getByRole('button', { name: 'Mancuernas', exact: true }).click();
  await page.getByRole('button', { name: 'Generar rutina' }).click();
  await page.locator('.gen-item').first().waitFor();
  const subs = await leerTarjetas();
  assert(subs.every((t) => /^Pecho · (Mancuernas|Peso corporal)/.test(t)), 'material o músculo incorrecto: ' + subs.join(' | '));
  assert((await minutosEstimados()) <= 21, 'excede 20 min');
  // Editar series del primero y comprobar que la duración se recalcula.
  const antes = await minutosEstimados();
  await page.locator('.gen-item').first().getByRole('button', { name: /^Editar series/ }).click();
  await page.getByRole('button', { name: 'Aumentar series', exact: true }).click();
  await page.keyboard.press('Escape');
  assert((await minutosEstimados()) > antes, 'la duración no se recalculó');
  // Sustituir el segundo por una alternativa y eliminar el último.
  const nombre2 = await page.locator('.gen-item').nth(1).locator('.card-title').innerText();
  await page.locator('.gen-item').nth(1).getByRole('button', { name: /^Sustituir/ }).click();
  await page.getByRole('dialog').locator('.row-button').first().click();
  assert((await page.locator('.gen-item').nth(1).locator('.card-title').innerText()) !== nombre2, 'no se sustituyó');
  const n = await page.locator('.gen-item').count();
  await page.locator('.gen-item').last().getByRole('button', { name: /^Eliminar/ }).click();
  assert((await page.locator('.gen-item').count()) === n - 1, 'no se eliminó');
  await page.getByRole('button', { name: 'Guardar y empezar' }).click();
  await page.getByRole('button', { name: 'Completar serie', exact: true }).waitFor();
  const press = page.locator('section.wex').first();
  await press.getByLabel(/^Peso (de calentamiento|serie) 1/).first().fill('20');
  await press.getByLabel(/^Repeticiones (de calentamiento|serie) 1/).first().fill('10');
  await page.getByRole('button', { name: 'Completar serie', exact: true }).click();
  await page.getByRole('timer').waitFor();
  await page.getByRole('button', { name: 'Descartar entrenamiento' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
  await page.getByRole('heading', { name: 'Hoy' }).waitFor();
  await go('/routines');
  await page.getByText(/^Pecho · 20 min/).first().waitFor();
});

await step('Ilustraciones: cada ejercicio de la biblioteca tiene la suya', async () => {
  await go('/exercises');
  const rows = await page.locator('.list .row-button').count();
  const data = await page.locator('.list .row-button .exercise-art').evaluateAll((els) => els.map((e) => e.getAttribute('data-template')));
  assert(rows > 100 && data.length === rows, `filas ${rows}, ilustraciones ${data.length}`);
  assert(data.every(Boolean), 'ejercicio sin plantilla');
  assert(new Set(data).size >= 90, 'pocas ilustraciones distintas: ' + new Set(data).size);
  await go('/exercises/ex-sentadilla');
  await page.locator('.ex-hero svg').waitFor();
  await page.getByText('Posición inicial').waitFor();
  await page.getByText('Posición final').waitFor();
});

await step('Centrado del número de sesiones (1 y 2 dígitos, varias anchuras)', async () => {
  const centered = async (sel) =>
    page.locator(sel).first().evaluate((ctl) => {
      const out = ctl.querySelector('.stepper-value');
      const n = out.firstChild ? document.createRange() : null;
      n.selectNodeContents(out);
      const t = n.getBoundingClientRect();
      const o = out.getBoundingClientRect();
      const c = ctl.getBoundingClientRect();
      return { dx: Math.abs(t.left + t.width / 2 - (o.left + o.width / 2)), dy: Math.abs(t.top + t.height / 2 - (c.top + c.height / 2)), w: o.width, left: o.left - c.left };
    });
  for (const width of [320, 390, 834]) {
    await page.setViewportSize({ width, height: 900 });
    await go('/plan');
    const ctl = '.stepper-ctl[aria-label="sesiones objetivo"]';
    const one = await centered(ctl);
    for (let i = 0; i < 12; i++) {
      const v = Number(await page.locator(`${ctl} .stepper-value`).innerText());
      if (v >= 10) break;
      await page.getByRole('button', { name: 'Aumentar sesiones objetivo' }).click();
    }
    const two = await centered(ctl);
    assert(one.dx < 1.5 && one.dy < 1.5 && two.dx < 1.5 && two.dy < 1.5, `descentrado @${width}: ${JSON.stringify([one, two])}`);
    assert(Math.abs(one.left - two.left) < 0.5 && Math.abs(one.w - two.w) < 0.5, 'el número desplaza el control');
    await page.getByRole('button', { name: 'Restablecer al predeterminado' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

await step('Planificación semanal', async () => {
  await go('/plan');
  await page.getByRole('button', { name: /^Añadir al/ }).last().click();
  await page.getByRole('button', { name: /^Torso A \d+ ejercicios/ }).click();
  await page.getByText(/planificada/).waitFor();
});

let reviewId = '';
await step('Completar y recuperar revisión semanal', async () => {
  await go('/reviews');
  await page.getByRole('button', { name: /Revisar semana/ }).click();
  await page.getByText('Paso 1 de 5', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('radiogroup', { name: '¿Cómo ha sido tu energía?' }).getByRole('radio', { name: '4' }).click();
  await page.getByLabel('¿Qué quieres mejorar?').fill('Dormir más');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByText('Aspectos que requieren atención').waitFor();
  // Recuperar borrador tras recargar
  await page.reload();
  await page.waitForTimeout(500);
  await go('/reviews');
  await page.getByText('Borrador').waitFor();
  await page.locator('.row-button', { hasText: 'Borrador' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar revisión' }).click();
  await page.getByText('Valoración personal').waitFor();
  assert((await page.locator('main').innerText()).includes('4/5'), 'respuesta no guardada');
  reviewId = page.url().split('/').pop();
});

await step('Comparar revisiones', async () => {
  // Segunda revisión de la semana anterior
  const prev = new Date(Date.now() - 14 * 86400000);
  const mon = new Date(prev);
  mon.setUTCDate(prev.getUTCDate() - ((prev.getUTCDay() + 6) % 7));
  await go(`/reviews/new?week=${mon.toISOString().slice(0, 10)}`);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar revisión' }).click();
  await page.getByText('Valoración personal').waitFor();
  await go('/reviews/compare');
  await page.locator('.compare-table').waitFor();
  assert((await page.locator('.compare-table th').count()) >= 3, 'faltan columnas');
});

await step('Exportar e importar (JSON y CSV)', async () => {
  await go('/profile/data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar copia' }).click()]);
  const path = await dl.path();
  const json = JSON.parse(readFileSync(path, 'utf8'));
  assert(json.app === 'draxivo' && json.data.workouts.length === 2, 'copia incompleta');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Series' }).click()]);
  assert(readFileSync(await csv.path(), 'utf8').includes('Press de banca con barra'), 'CSV sin series');
  await page.locator('input[type=file]').setInputFiles(path);
  await page.getByText('No hay datos nuevos que importar.').waitFor();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await page.getByText('No se puede importar').waitFor();
});

await step('Rutina vacía y datos incompletos', async () => {
  await go('/routines/new');
  await page.getByRole('button', { name: 'Guardar rutina' }).click();
  await page.getByText('Ponle un nombre a la rutina.').waitFor();
  await page.getByPlaceholder('Ej.: Torso A').fill('Vacía');
  await page.getByRole('button', { name: 'Guardar rutina' }).click();
  await page.getByText('Rutina vacía').waitFor();
  await go('/train');
  await page.getByRole('button', { name: 'Entrenamiento libre' }).click();
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByText('No hay ninguna serie completada').waitFor();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Descartar entrenamiento' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
  await page.getByRole('heading', { name: 'Hoy' }).waitFor();
});

const SCREENS = ['/', '/train', '/routines', '/progress', '/profile', '/history', '/body/weight', '/reviews', '/plan', '/exercises', `/reviews/${reviewId}`];
for (const width of [320, 375, 390, 430]) {
  await step(`Sin desplazamiento horizontal a ${width}px`, async () => {
    await page.setViewportSize({ width, height: 800 });
    for (const s of SCREENS) {
      await go(s);
      await noHScroll(`${s} @${width}`);
    }
    await go('/train');
    await page.getByRole('button', { name: 'Empezar Torso A' }).click();
    await page.locator('.set-row').first().waitFor();
    await noHScroll(`/workout @${width}`);
    if (width === 320) await shot('06-entreno-320');
    await page.getByRole('button', { name: 'Descartar entrenamiento' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
  });
}

await step('Contenido no tapado por la barra inferior', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/profile');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  const last = await page.locator('main p').last().boundingBox();
  const bar = await page.locator('.tabbar').boundingBox();
  assert(last && bar && last.y + last.height <= bar.y, 'el último contenido queda bajo la barra');
});

await step('Modo oscuro y paleta sin verde', async () => {
  await go('/profile');
  await page.getByRole('button', { name: /^Tema/ }).click();
  await page.getByRole('option', { name: 'Oscuro' }).click();
  await go('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert(bg === 'rgb(17, 18, 22)', 'fondo oscuro incorrecto ' + bg);
  await shot('07-inicio-oscuro');
  await go('/progress');
  await shot('08-progreso-oscuro');
  const colors = await page.evaluate(() => {
    const set = new Set();
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const c of [cs.color, cs.backgroundColor, cs.fill, cs.stroke]) if (c && c.startsWith('rgb')) set.add(c);
    }
    return [...set];
  });
  const greens = colors.filter((c) => {
    const [r, g, b] = c.match(/\d+/g).map(Number);
    return g > r + 40 && g > b + 40;
  });
  assert(!greens.length, 'colores verdes encontrados: ' + greens.join(', '));
  await page.getByRole('link', { name: 'Perfil' }).click();
  await page.getByRole('button', { name: /^Tema/ }).click();
  await page.getByRole('option', { name: 'Claro' }).click();
  await go('/progress');
  await shot('09-progreso-claro');
});

await step('Escritorio (1280px): columna de ancho móvil con barra inferior', async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await go('/');
  const app = await page.locator('.app').boundingBox();
  const bar = await page.locator('.tabbar').boundingBox();
  assert(app && app.width <= 481 && Math.abs(app.x + app.width / 2 - 640) < 2, 'la columna no está centrada o es demasiado ancha');
  assert(bar && bar.width <= 481, 'barra inferior demasiado ancha');
  await shot('10-escritorio');
});

await step('Sin selects ni campos de fecha nativos', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const s of ['/', '/routines', '/routines/new', '/exercises', '/progress', '/profile', '/history', '/body/weight', '/body/measurements', '/plan', '/reviews', '/profile/data']) {
    await go(s);
    const n = await page.evaluate(() => document.querySelectorAll('select, input[type=date]').length);
    assert(n === 0, `${s}: ${n} controles nativos`);
  }
});

await step('PWA: manifiesto y service worker', async () => {
  const m = await (await page.request.get(BASE + 'manifest.webmanifest')).json();
  assert(m.name === 'DRAXIVO' && m.icons.length >= 3, 'manifiesto');
  const sw = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !!r;
  });
  assert(sw, 'service worker no registrado');
});

await step('Sin errores en consola', async () => {
  assert(!consoleErrors.length, consoleErrors.slice(0, 5).join(' | '));
});

await browser.close();
server.kill();
const failed = results.filter((r) => r[0] !== 'OK');
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas`);
process.exit(failed.length ? 1 : 0);
