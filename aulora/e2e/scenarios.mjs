// Escenarios E2E de Aulora. Cada paso usa la interfaz real y verifica en la base de datos.
import pg from 'pg';

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function monday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const w = x.getDay() || 7;
  x.setDate(x.getDate() - w + 1);
  return x;
}
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export async function run({ browser, base, shots, dbUrl }) {
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();
  let failed = 0;
  const errors = [];
  const step = async (name, fn) => {
    try {
      await fn();
      console.log('  ✓', name);
    } catch (e) {
      failed++;
      console.log('  ✗', name, '\n     ', e.message.split('\n').slice(0, 6).join('\n      '));
      await page.screenshot({ path: `${shots}/fallo-${name.replace(/\W+/g, '-')}.png` }).catch(() => {});
    }
  };
  const expect = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  const one = async (sql, params) => (await db.query(sql, params)).rows;

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10_000);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`console: ${m.text()}`));

  const today = new Date();
  const thisMonday = monday(today);
  const nextMonday = addDays(thisMonday, 7);
  const week = key(thisMonday);
  const toast = (text) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first().waitFor();
  const quick = async (item) => {
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.getByRole('menuitem', { name: item }).click();
  };

  console.log('E2E');

  await step('sin sesión redirige a /login', async () => {
    await page.goto(base + '/tareas');
    await page.waitForURL(/\/login\?next=%2Ftareas/);
  });

  await step('registro e inicio de sesión', async () => {
    await page.getByRole('button', { name: 'Crear una cuenta nueva' }).click();
    await page.getByLabel('Tu nombre').fill('Pedro Carramolino');
    await page.getByLabel('Correo electrónico').fill('pedro@test.es');
    await page.getByLabel('Contraseña').fill('secreto123');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.waitForURL(base + '/');
    await page.getByRole('heading', { name: /Pedro/ }).waitFor();
    await page.getByText('Bienvenido a Aulora').waitFor();
  });

  const students = {};
  await step('crear alumnos desde «Crear»', async () => {
    for (const [first, last, inst] of [
      ['Hugo', 'García', 'Trompeta'],
      ['Alberto', 'Ruiz', 'Trompeta'],
      ['Lucía', 'Martín', 'Piano'],
    ]) {
      await quick('Alumno');
      await page.getByLabel('Nombre *').fill(first);
      await page.getByLabel('Apellidos').fill(last);
      await page.getByLabel('Instrumento o especialidad').fill(inst);
      await page.getByRole('button', { name: 'Crear alumno' }).click();
      await page.waitForURL(/\/alumnos\/[0-9a-f-]{36}$/);
      await page.getByRole('heading', { name: `${first} ${last}` }).waitFor();
      students[first] = page.url().split('/').pop();
    }
    const rows = await one('select count(*)::int n from students');
    expect(rows[0].n === 3, `esperados 3 alumnos, hay ${rows[0].n}`);
  });

  let groupId;
  await step('crear grupo con integrantes', async () => {
    await quick('Grupo');
    await page.getByLabel('Nombre del grupo *').fill('Lenguaje Musical 1');
    await page.getByLabel('Aula o ubicación').fill('Aula 3');
    await page.getByRole('dialog').getByRole('button', { name: /Hugo García/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Alberto Ruiz/ }).click();
    await page.getByRole('button', { name: 'Crear grupo' }).click();
    await page.waitForURL(/\/grupos\/[0-9a-f-]{36}/);
    groupId = page.url().split('/').pop().split('?')[0];
    const m = await one('select count(*)::int n from group_members where group_id = $1', [groupId]);
    expect(m[0].n === 2, 'el grupo debería tener 2 integrantes');
  });

  await step('editar, duplicar y archivar alumno', async () => {
    await page.goto(`${base}/alumnos/${students['Lucía']}`);
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Duplicar' }).click();
    await page.waitForURL((u) => !u.pathname.endsWith(students['Lucía']) && /\/alumnos\//.test(u.pathname));
    await page.getByRole('heading', { name: 'Lucía Martín (copia)' }).waitFor();
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Archivar' }).click();
    await toast('archivado');
    const r = await one(`select status from students where last_name = 'Martín (copia)'`);
    expect(r[0]?.status === 'archived', 'la copia debería estar archivada');
    await page.goto(`${base}/alumnos`);
    await page.getByText('3 activos').waitFor();
  });

  await step('clase recurrente (lunes y miércoles, 3 semanas)', async () => {
    await page.goto(`${base}/agenda?vista=semana&fecha=${key(nextMonday)}`);
    await page.getByRole('button', { name: 'Nueva clase' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Alumno').selectOption({ label: 'Hugo García · Trompeta' });
    await dlg.getByLabel('Fecha').fill(key(nextMonday));
    await dlg.getByLabel('Hora').fill('17:00');
    await dlg.getByText('Repetir cada semana').click();
    await dlg.getByRole('button', { name: 'Miércoles' }).click();
    await dlg.getByLabel('Hasta el').fill(key(addDays(nextMonday, 16)));
    await dlg.getByRole('button', { name: 'Crear 6 clases' }).click();
    await toast('Serie creada: 6 clases');
    const r = await one('select count(*)::int n from lessons where series_id is not null');
    expect(r[0].n === 6, `esperadas 6 clases, hay ${r[0].n}`);
    await page.locator('[role=button][aria-label^="Hugo García"]').nth(1).waitFor();
  });

  await step('aviso de conflicto de horario', async () => {
    await page.getByRole('button', { name: 'Nueva clase' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Alumno').selectOption({ label: 'Alberto Ruiz · Trompeta' });
    await dlg.getByLabel('Fecha').fill(key(nextMonday));
    await dlg.getByLabel('Hora').fill('17:30');
    await dlg.getByRole('button', { name: 'Programar clase' }).click();
    await dlg.getByText('Conflicto de horario').waitFor();
    await dlg.getByText(/con Hugo García/).waitFor();
    await dlg.getByRole('button', { name: 'Guardar de todos modos' }).click();
    await toast('Clase programada');
  });

  await step('arrastrar una clase a otra hora', async () => {
    const block = page.locator('[role=button][aria-label^="Alberto Ruiz"]');
    const box = await block.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 30, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2, box.y + 8 + 56, { steps: 6 });
    await page.mouse.up();
    await toast('Clase movida');
    const r = await one(`select to_char(starts_at at time zone 'Europe/Madrid', 'HH24:MI') t from lessons l join students s on s.id = l.student_id where s.first_name = 'Alberto'`);
    expect(r[0].t === '18:30', `esperado 18:30, está a las ${r[0].t}`);
  });

  await step('modificar una sesión no cambia el resto de la serie', async () => {
    // abre la clase del miércoles
    await page.locator('[role=button][aria-label^="Hugo García"]').nth(1).click();
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Editar o reprogramar' }).click();
    const dlg = page.getByRole('dialog').filter({ hasText: 'Editar clase' });
    await dlg.getByLabel('Hora').fill('19:00');
    await dlg.getByRole('button', { name: 'Guardar' }).click();
    await toast('Clase actualizada');
    const r = await one(`select to_char(starts_at at time zone 'Europe/Madrid', 'HH24:MI') t, count(*)::int n, bool_or(is_modified) m from lessons where series_id is not null group by 1 order by 1`);
    expect(r.length === 2 && r[0].t === '17:00' && r[0].n === 5 && r[1].t === '19:00' && r[1].n === 1 && r[1].m, JSON.stringify(r));
    await page.keyboard.press('Escape');
  });

  await step('vistas día y mes de la agenda', async () => {
    await page.goto(`${base}/agenda?vista=mes&fecha=${key(nextMonday)}`);
    await page.getByRole('button', { name: /Hugo García/ }).first().waitFor();
    await page.goto(`${base}/agenda?vista=dia&fecha=${key(nextMonday)}`);
    await page.locator('[role=button][aria-label^="Hugo García"]').waitFor();
    await page.locator('[role=button][aria-label^="Alberto Ruiz"]').waitFor();
  });

  await step('tareas: añadir rápido a alumno y a grupo', async () => {
    await page.goto(`${base}/tareas?semana=${week}`);
    const hugo = page.getByLabel('Añadir tarea a Hugo…');
    await hugo.fill('Estudio nº 4');
    await hugo.press('Enter');
    await page.getByText('Estudio nº 4').waitFor();
    await hugo.fill('Concierto de Arutunian');
    await hugo.press('Enter');
    await page.getByText('Concierto de Arutunian').waitFor();
    const grp = page.getByLabel('Añadir tarea al grupo…');
    await grp.fill('Dictado musical');
    await grp.press('Enter');
    await page.getByText('Dictado musical').waitFor();
    const r = await one(`select t.title, count(a.id)::int n from tasks t left join task_assignments a on a.task_id = t.id group by t.title order by 1`);
    expect(JSON.stringify(r) === JSON.stringify([{ title: 'Concierto de Arutunian', n: 1 }, { title: 'Dictado musical', n: 2 }, { title: 'Estudio nº 4', n: 1 }]), JSON.stringify(r));
  });

  await step('vista general: con tareas / sin tareas', async () => {
    await page.getByRole('button', { name: /Con tareas\s*2/ }).waitFor();
    await page.getByRole('button', { name: /Sin tareas\s*1/ }).click();
    await page.getByRole('link', { name: /^Lucía Martín/ }).waitFor();
    expect((await page.getByRole('link', { name: /^Hugo García/ }).count()) === 0, 'Hugo no debería aparecer en «Sin tareas»');
    await page.getByRole('button', { name: /Sin tareas\s*1/ }).click();
  });

  await step('cambiar el estado de una tarea', async () => {
    const row = page.locator('div.group').filter({ hasText: 'Estudio nº 4' }).first();
    await row.getByRole('button', { name: /Estado: Pendiente/ }).click();
    await row.getByRole('button', { name: /Estado: En proceso/ }).waitFor();
    const r = await one(`select a.status from task_assignments a join tasks t on t.id = a.task_id where t.title = 'Estudio nº 4'`);
    expect(r[0].status === 'in_progress', r[0].status);
  });

  await step('tarea con formulario: varios alumnos y categoría', async () => {
    await page.getByRole('button', { name: 'Nueva tarea' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder(/Estudio nº 4, escalas/).fill('Escalas mayores');
    await dlg.getByRole('button', { name: /Alberto Ruiz/ }).click();
    await dlg.getByRole('button', { name: /Lucía Martín/ }).first().click();
    await dlg.getByRole('button', { name: 'Técnica' }).click();
    await dlg.getByRole('tab', { name: 'Alta' }).click();
    await dlg.getByRole('button', { name: 'Asignar tarea' }).click();
    await toast('Tarea asignada');
    const r = await one(`select t.priority, c.name, count(a.id)::int n from tasks t join task_categories c on c.id = t.category_id join task_assignments a on a.task_id = t.id where t.title = 'Escalas mayores' group by 1, 2`);
    expect(r[0]?.n === 2 && r[0].priority === 'high' && r[0].name === 'Técnica', JSON.stringify(r));
  });

  await step('copiar la semana a la siguiente sin duplicar', async () => {
    await page.getByRole('button', { name: /Copiar semana/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Copiar 4 tareas' }).click();
    await toast('4 tareas copiadas');
    const r = await one(`select count(*)::int n from tasks where week_start = $1`, [key(nextMonday)]);
    expect(r[0].n === 4, `esperadas 4 copias, hay ${r[0].n}`);
    const st = await one(`select distinct a.status from task_assignments a join tasks t on t.id = a.task_id where t.week_start = $1`, [key(nextMonday)]);
    expect(st.length === 1 && st[0].status === 'pending', 'las copias deben empezar pendientes');
    await page.getByRole('button', { name: /Copiar semana/ }).click();
    await page.getByRole('dialog').getByText('Ya copiada').first().waitFor();
    expect(await page.getByRole('dialog').getByRole('button', { name: /^Copiar\s+tareas$/ }).isDisabled(), 'el botón debería estar desactivado');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await page.waitForURL(new RegExp(`semana=${key(nextMonday)}`));
    await page.getByText('Concierto de Arutunian').waitFor();
  });

  await step('ficha de clase: tareas, resumen y finalizar sesión', async () => {
    const [l] = await one(`select id from lessons where series_id is not null order by starts_at limit 1`);
    await page.goto(`${base}/clases/${l.id}`);
    // aparece en la semana de la clase (copia) y en «semanas anteriores» (original)
    await page.getByText('Concierto de Arutunian').nth(1).waitFor();
    await page.getByText('Tareas de semanas anteriores').waitFor();
    await page.getByLabel('Contenido previsto').fill('Flexibilidad y primer movimiento');
    await page.getByLabel('Observaciones de la sesión').click(); // provoca el guardado automático
    await page.getByText('Guardado').first().waitFor();
    await page.getByLabel('Resumen de lo trabajado').fill('Buen sonido en el registro agudo. Repasar compases 20-32.');
    await page.getByRole('button', { name: 'Finalizar sesión' }).click();
    await toast('Sesión finalizada');
    const r = await one(`select status, plan, summary from lessons where id = $1`, [l.id]);
    expect(r[0].status === 'completed' && r[0].plan.startsWith('Flexibilidad') && r[0].summary.startsWith('Buen sonido'), JSON.stringify(r[0]));
    await page.goto(`${base}/alumnos/${students['Hugo']}?tab=historial`);
    await page.getByText('Buen sonido en el registro agudo').waitFor();
  });

  await step('seguimiento: objetivo y anotación', async () => {
    await page.goto(`${base}/alumnos/${students['Hugo']}?tab=seguimiento`);
    await page.getByLabel('Nuevo objetivo').fill('Tocar Arutunian de memoria');
    await page.getByRole('button', { name: 'Añadir', exact: true }).first().click();
    await toast('Objetivo añadido');
    await page.getByLabel('Nueva anotación').fill('Le cuesta el picado doble');
    await page.locator('button[aria-pressed]', { hasText: 'Dificultad' }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await toast('Anotación guardada');
    await page.getByRole('button', { name: 'Marcar conseguido' }).click();
    await page.waitForTimeout(400);
    const r = await one(`select (select status from goals limit 1) g, (select kind from progress_notes limit 1) k`);
    expect(r[0].g === 'achieved' && r[0].k === 'difficulty', JSON.stringify(r[0]));
    await page.goto(`${base}/seguimiento`);
    await page.getByRole('link', { name: /Hugo García/ }).waitFor();
  });

  await step('buscador global (⌘K)', async () => {
    await page.goto(base + '/');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('dialog', { name: 'Buscar' }).getByRole('textbox');
    await input.fill('hugo');
    await page.getByRole('dialog', { name: 'Buscar' }).getByText('Hugo García').waitFor();
    await input.fill('dictado');
    await page.getByRole('dialog', { name: 'Buscar' }).getByText('Dictado musical').first().waitFor();
    await input.fill('picado');
    await page.getByRole('dialog', { name: 'Buscar' }).getByText('Le cuesta el picado doble').waitFor();
    await page.keyboard.press('Escape');
  });

  await step('búsqueda avanzada con filtros', async () => {
    await page.goto(`${base}/buscar`);
    await page.getByLabel('Categoría').selectOption({ label: 'Técnica' });
    await page.getByText('Escalas mayores').first().waitFor();
    await page.getByLabel('Estado de la tarea').selectOption({ label: 'En proceso' });
    await page.getByText('Estudio nº 4').first().waitFor();
    expect((await page.getByText('Escalas mayores').count()) === 0, 'con estado «En proceso» no debería aparecer «Escalas mayores»');
    await page.getByLabel('Estado de la tarea').selectOption({ label: 'Revisada' });
    await page.getByText('Sin resultados').waitFor();
  });

  await step('panel de inicio con datos', async () => {
    await page.goto(base + '/');
    await page.getByText('Alumnos con tareas pendientes').waitFor();
    await page.getByText('Actividad reciente').waitFor();
    await page.getByText(/Tarea creada:/).first().waitFor();
  });

  await step('los datos persisten tras recargar', async () => {
    await page.goto(base + '/alumnos');
    await page.reload();
    await page.getByText('Hugo García').waitFor();
    await page.getByText('Alberto Ruiz').waitFor();
  });

  await step('eliminar con confirmación', async () => {
    await page.goto(`${base}/tareas?semana=${key(nextMonday)}`);
    const row = page.locator('div.group').filter({ hasText: 'Dictado musical' }).first();
    await row.getByRole('button', { name: 'Opciones de la tarea' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByText(/Se eliminará para todos/).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    await toast('Tarea eliminada');
    const r = await one(`select count(*)::int n from tasks where week_start = $1 and title = 'Dictado musical'`, [key(nextMonday)]);
    expect(r[0].n === 0, 'la tarea sigue existiendo');
  });

  await step('ajustes: tema oscuro y categorías', async () => {
    await page.goto(base + '/ajustes');
    await page.getByRole('tab', { name: /Oscuro/ }).click();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'no se aplicó el tema oscuro');
    await page.getByLabel('Nueva categoría').fill('Improvisación');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await toast('Categoría creada');
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'el tema no persiste');
    await page.screenshot({ path: `${shots}/escritorio-ajustes-oscuro.png` });
    await page.goto(base + '/');
    await page.screenshot({ path: `${shots}/escritorio-inicio-oscuro.png` });
    await page.goto(`${base}/agenda?vista=semana&fecha=${key(nextMonday)}`);
    await page.locator('[role=button][aria-label^="Hugo García"]').first().waitFor();
    await page.screenshot({ path: `${shots}/escritorio-agenda-oscuro.png` });
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await page.getByRole('tab', { name: /Claro/ }).click();
  });

  // capturas en claro (escritorio)
  await step('capturas de escritorio', async () => {
    for (const [name, url, wait] of [
      ['inicio', '/', 'Actividad reciente'],
      ['tareas', `/tareas?semana=${week}`, 'Estudio nº 4'],
      ['agenda-semana', `/agenda?vista=semana&fecha=${key(nextMonday)}`, null],
      ['alumno', `/alumnos/${students['Hugo']}?tab=tareas`, 'Concierto de Arutunian'],
      ['grupo', `/grupos/${groupId}`, 'Dictado musical'],
      ['seguimiento', `/alumnos/${students['Hugo']}?tab=seguimiento`, 'Evolución por categorías'],
    ]) {
      await page.goto(base + url);
      if (wait) await page.getByText(wait).first().waitFor();
      else await page.waitForTimeout(800);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${shots}/escritorio-${name}.png` });
    }
  });

  await step('RLS: otro profesor no ve nada', async () => {
    const other = await browser.newContext({ timezoneId: 'Europe/Madrid' });
    const p2 = await other.newPage();
    await p2.goto(base + '/login');
    await p2.getByRole('button', { name: 'Crear una cuenta nueva' }).click();
    await p2.getByLabel('Correo electrónico').fill('otra@test.es');
    await p2.getByLabel('Contraseña').fill('secreto123');
    await p2.getByRole('button', { name: 'Crear cuenta' }).click();
    await p2.waitForURL(base + '/');
    await p2.goto(base + '/alumnos');
    await p2.getByText('Aún no tienes alumnos').waitFor();
    await p2.goto(`${base}/alumnos/${students['Hugo']}`);
    await p2.getByText('Alumno no encontrado').waitFor();
    await other.close();
  });

  await step('móvil (iPhone): navegación inferior y vistas', async () => {
    const { devices } = await import('node:module').then((m) => m.createRequire(import.meta.url)('playwright'));
    const mctx = await browser.newContext({ ...devices['iPhone 14'], timezoneId: 'Europe/Madrid', storageState: await ctx.storageState() });
    const m = await mctx.newPage();
    m.on('pageerror', (e) => errors.push(`móvil pageerror: ${e.message}`));
    await m.goto(base + '/');
    await m.getByRole('navigation', { name: 'Navegación principal' }).waitFor();
    await m.screenshot({ path: `${shots}/movil-inicio.png` });
    await m.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Tareas' }).click();
    await m.waitForURL(/\/tareas/);
    await m.getByText('Estudio nº 4').waitFor();
    await m.screenshot({ path: `${shots}/movil-tareas.png` });
    await m.goto(`${base}/agenda?fecha=${key(nextMonday)}`);
    await m.locator('[role=button][aria-label^="Hugo García"]').waitFor();
    await m.screenshot({ path: `${shots}/movil-agenda-dia.png` });
    // sin desbordamiento horizontal
    for (const u of ['/', '/tareas', '/alumnos', `/alumnos/${students['Hugo']}`, '/grupos', '/seguimiento', '/ajustes', '/buscar', `/grupos/${groupId}`]) {
      await m.goto(base + u);
      await m.waitForTimeout(500);
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow <= 1, `desbordamiento horizontal de ${overflow}px en ${u}`);
    }
    await m.goto(base + '/');
    await m.getByRole('button', { name: 'Crear' }).click();
    await m.getByRole('menuitem', { name: 'Tarea' }).click();
    await m.getByRole('dialog').waitFor();
    await m.screenshot({ path: `${shots}/movil-nueva-tarea.png` });
    await mctx.close();
  });

  await step('tablet (iPad): agenda semanal', async () => {
    const { devices } = await import('node:module').then((m) => m.createRequire(import.meta.url)('playwright'));
    const tctx = await browser.newContext({ ...devices['iPad Pro 11'], timezoneId: 'Europe/Madrid', storageState: await ctx.storageState() });
    const t = await tctx.newPage();
    await t.goto(`${base}/agenda?vista=semana&fecha=${key(nextMonday)}`);
    await t.locator('[role=button][aria-label^="Hugo García"]').first().waitFor();
    await t.screenshot({ path: `${shots}/ipad-agenda.png` });
    await t.goto(`${base}/tareas?semana=${week}`);
    await t.getByText('Estudio nº 4').waitFor();
    await t.screenshot({ path: `${shots}/ipad-tareas.png` });
    await tctx.close();
  });

  await step('cerrar sesión', async () => {
    await page.goto(base + '/ajustes');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL(/\/login/);
    await page.goto(base + '/');
    await page.waitForURL(/\/login/);
  });

  const relevant = errors.filter((e) => !/hydrat/i.test(e) || true);
  if (relevant.length) {
    failed++;
    console.log('  ✗ errores en la consola del navegador:\n      ' + [...new Set(relevant)].slice(0, 10).join('\n      '));
  } else console.log('  ✓ sin errores de JavaScript en el navegador');

  await db.end();
  console.log(failed ? `\n${failed} pasos fallidos` : '\nTodo correcto');
  return failed;
}
