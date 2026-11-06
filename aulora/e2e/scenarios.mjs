// Escenarios E2E de Aulora. Cada paso usa la interfaz real y verifica en la base de datos.

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

export async function run({ browser, base, shots, admin }) {
  let me;
  /** Documentos del profesor principal en Firestore (lectura de administración). */
  const docs = async (name) => {
    // lo guardado en el dispositivo se envía en segundo plano: esperar a que llegue
    await page.evaluate(() => window.__auloraFlush?.()).catch(() => {});
    me ??= await admin.uid('pedro@test.es');
    return admin.docs(me, name);
  };
  const madrid = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const asgCount = (t) => Object.keys(t.assignments ?? {}).length;
  const statuses = (t) => Object.values(t.assignments ?? {}).map((a) => a.status);
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
    await page.goto(base + '/login');
    await page.getByRole('button', { name: 'Crear una cuenta nueva' }).click();
    await page.getByLabel('Tu nombre').fill('Pedro Carramolino');
    await page.getByLabel('Correo electrónico').fill('pedro@test.es');
    // requisitos mínimos y confirmación
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await page.getByLabel('Repite la contraseña', { exact: true }).fill('corta');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.getByRole('alert').getByText(/no cumple los requisitos/).waitFor();
    await page.getByLabel('Contraseña', { exact: true }).fill('secreto123');
    await page.getByLabel('Repite la contraseña', { exact: true }).fill('secreto124');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.getByRole('alert').getByText('Las contraseñas no coinciden.').waitFor();
    // mostrar y ocultar la contraseña
    const pw = page.getByLabel('Contraseña', { exact: true });
    expect((await pw.getAttribute('type')) === 'password', 'la contraseña debería estar oculta');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).first().click();
    expect((await pw.getAttribute('type')) === 'text', 'la contraseña debería verse');
    await page.getByRole('button', { name: 'Ocultar contraseña' }).first().click();
    expect((await pw.getAttribute('type')) === 'password', 'la contraseña debería volver a ocultarse');
    await page.getByLabel('Repite la contraseña', { exact: true }).fill('secreto123');
    await page.getByText('Las dos contraseñas coinciden').waitFor();
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
      if (first === 'Hugo') {
        // borrar la duración y escribir 45: no debe quedar «0» ni «045»
        const dur = page.getByLabel('Duración de la clase (min)');
        await dur.fill('');
        expect((await dur.inputValue()) === '', 'el campo vacío no debería mostrar 0');
        await dur.pressSequentially('045');
        expect((await dur.inputValue()) === '45', `duración mostrada: ${await dur.inputValue()}`);
      }
      await page.getByRole('button', { name: 'Crear alumno' }).click();
      await page.waitForURL(/\/alumnos\/[A-Za-z0-9]{20}$/);
      await page.getByRole('heading', { name: `${first} ${last}` }).waitFor();
      students[first] = page.url().split('/').pop();
    }
    const all = await docs('students');
    expect(all.length === 3, `esperados 3 alumnos, hay ${all.length}`);
    const hugoMin = all.find((x) => x.first_name === 'Hugo')?.lesson_minutes;
    expect(hugoMin === 45, `duración guardada de Hugo: ${hugoMin}`);
  });

  await step('foto del alumno: se reduce y se guarda rápido', async () => {
    // foto grande, como la de la cámara de un iPhone (4032×3024)
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 4032;
      c.height = 3024;
      const x = c.getContext('2d');
      for (let i = 0; i < 300; i++) {
        x.fillStyle = `hsl(${i}, 70%, 50%)`;
        x.fillRect(Math.random() * 4032, Math.random() * 3024, 300, 300);
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      const buf = new Uint8Array(await blob.arrayBuffer());
      let out = '';
      for (const v of buf) out += String.fromCharCode(v);
      return btoa(out);
    });
    const { writeFileSync } = await import('node:fs');
    const file = `${shots}/foto-grande.jpg`;
    writeFileSync(file, Buffer.from(b64, 'base64'));
    await page.goto(`${base}/alumnos/${students['Hugo']}`);
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Editar ficha' }).click();
    await page.locator('input[type=file]').setInputFiles(file);
    await page.getByRole('dialog').locator('img').first().waitFor();
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await toast('Alumno actualizado');
    const ms = Date.now() - t0;
    expect(ms < 1500, `guardar con foto tardó ${ms} ms`);
    let hugo;
    for (let i = 0; i < 20 && !hugo?.photo; i++) {
      hugo = (await docs('students')).find((x) => x.first_name === 'Hugo');
      if (!hugo?.photo) await page.waitForTimeout(250);
    }
    expect(hugo?.photo?.startsWith('data:image/jpeg') && hugo.photo.length < 60000, `foto en el servidor: ${hugo?.photo?.length ?? 'sin foto'} caracteres`);
  });

  let groupId;
  await step('crear grupo con integrantes', async () => {
    await quick('Grupo');
    await page.getByLabel('Nombre del grupo *').fill('Lenguaje Musical 1');
    await page.getByLabel('Aula o ubicación').fill('Aula 3');
    await page.getByRole('dialog').getByRole('button', { name: /Hugo García/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Alberto Ruiz/ }).click();
    await page.getByRole('button', { name: 'Crear grupo' }).click();
    await page.waitForURL(/\/grupos\/[A-Za-z0-9]{20}/);
    groupId = page.url().split('/').pop().split('?')[0];
    const m = (await docs('students')).filter((s) => s.group_ids.includes(groupId)).length;
    expect(m === 2, 'el grupo debería tener 2 integrantes');
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
    const r = (await docs('students')).find((s) => s.last_name === 'Martín (copia)');
    expect(r?.status === 'archived', 'la copia debería estar archivada');
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
    const n = (await docs('lessons')).filter((l) => l.series_id).length;
    expect(n === 6, `esperadas 6 clases, hay ${n}`);
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

  await step('serie con conflicto: aviso tras guardar y deshacer', async () => {
    await page.getByRole('button', { name: 'Nueva clase' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Alumno').selectOption({ label: 'Lucía Martín · Piano' });
    await dlg.getByLabel('Fecha').fill(key(nextMonday));
    await dlg.getByLabel('Hora').fill('17:00');
    await dlg.getByText('Repetir cada semana').click();
    await dlg.getByLabel('Hasta el').fill(key(addDays(nextMonday, 1)));
    await dlg.getByRole('button', { name: 'Crear 1 clase', exact: true }).click();
    await toast('Serie creada: 1 clase');
    await toast('1 sesión coincide con otra clase');
    const lucia = (await docs('students')).find((x) => x.first_name === 'Lucía' && x.last_name === 'Martín');
    expect((await docs('lessons')).some((l) => l.student_id === lucia.id), 'la serie debería haberse guardado');
    await page.locator('[data-sonner-toast]').filter({ hasText: 'coincide' }).getByRole('button', { name: 'Deshacer serie' }).click();
    await toast('Serie deshecha');
    expect(!(await docs('lessons')).some((l) => l.student_id === lucia.id), 'la serie debería haberse deshecho');
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
    const alberto = (await docs('students')).find((s) => s.first_name === 'Alberto');
    const l = (await docs('lessons')).find((x) => x.student_id === alberto.id);
    expect(madrid(l.starts_at) === '18:30', `esperado 18:30, está a las ${madrid(l.starts_at)}`);
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
    const series = (await docs('lessons')).filter((l) => l.series_id);
    const at17 = series.filter((l) => madrid(l.starts_at) === '17:00');
    const at19 = series.filter((l) => madrid(l.starts_at) === '19:00');
    expect(at17.length === 5 && at19.length === 1 && at19[0].is_modified && !at17.some((l) => l.is_modified), series.map((l) => madrid(l.starts_at)).join(','));
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
    const r = (await docs('tasks')).map((t) => `${t.title}:${asgCount(t)}`).sort();
    expect(JSON.stringify(r) === JSON.stringify(['Concierto de Arutunian:1', 'Dictado musical:2', 'Estudio nº 4:1']), JSON.stringify(r));
  });

  await step('vista general: con tareas / sin tareas', async () => {
    await page.getByRole('button', { name: /Con tareas\s*2/ }).waitFor();
    await page.getByRole('button', { name: /Sin tareas\s*1/ }).click();
    await page.getByRole('link', { name: /^Lucía Martín/ }).waitFor();
    await page.getByRole('link', { name: /^Hugo García/ }).waitFor({ state: 'detached', timeout: 3000 }).catch(() => {
      throw new Error('Hugo no debería aparecer en «Sin tareas»');
    });
    await page.getByRole('button', { name: /Sin tareas\s*1/ }).click();
    await page.getByRole('link', { name: /^Hugo García/ }).waitFor();
  });

  await step('cambiar el estado de una tarea', async () => {
    const row = page.locator('div.group').filter({ hasText: 'Estudio nº 4' }).first();
    await row.getByRole('button', { name: /Estado: Pendiente/ }).click();
    await row.getByRole('button', { name: /Estado: En proceso/ }).waitFor();
    const t = (await docs('tasks')).find((x) => x.title === 'Estudio nº 4');
    expect(statuses(t)[0] === 'in_progress', statuses(t).join());
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
    const t = (await docs('tasks')).find((x) => x.title === 'Escalas mayores');
    const cat = (await docs('categories')).find((c) => c.id === t?.category_id);
    expect(t && asgCount(t) === 2 && t.priority === 'high' && cat?.name === 'Técnica', JSON.stringify({ t, cat }));
  });

  await step('copiar la semana a la siguiente sin duplicar', async () => {
    await page.getByRole('button', { name: /Copiar semana/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'Copiar 4 tareas' }).click();
    await toast('4 tareas copiadas');
    const copies = (await docs('tasks')).filter((t) => t.week_start === key(nextMonday));
    expect(copies.length === 4, `esperadas 4 copias, hay ${copies.length}`);
    expect(copies.flatMap(statuses).every((x) => x === 'pending'), 'las copias deben empezar pendientes');
    await page.getByRole('button', { name: /Copiar semana/ }).click();
    await page.getByRole('dialog').getByText('Ya copiada').first().waitFor();
    expect(await page.getByRole('dialog').getByRole('button', { name: /^Copiar\s+tareas$/ }).isDisabled(), 'el botón debería estar desactivado');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await page.waitForURL(new RegExp(`semana=${key(nextMonday)}`));
    await page.getByText('Concierto de Arutunian').waitFor();
  });

  await step('ficha de clase: tareas, resumen y finalizar sesión', async () => {
    const [l] = (await docs('lessons')).filter((x) => x.series_id).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
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
    const r = (await docs('lessons')).find((x) => x.id === l.id);
    expect(r.status === 'completed' && r.plan.startsWith('Flexibilidad') && r.summary.startsWith('Buen sonido') && r.completed_at, JSON.stringify(r));
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
    const [g] = await docs('goals');
    const [n] = await docs('notes');
    expect(g?.status === 'achieved' && n?.kind === 'difficulty', JSON.stringify({ g, n }));
    await page.goto(`${base}/seguimiento`);
    await page.getByRole('link', { name: /Hugo García/ }).waitFor();
  });

  await step('buscador global (⌘K)', async () => {
    await page.goto(base + '/');
    await page.getByRole('heading', { name: /Pedro/ }).waitFor();
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
    const left = (await docs('tasks')).filter((t) => t.week_start === key(nextMonday) && t.title === 'Dictado musical');
    expect(left.length === 0, 'la tarea sigue existiendo');
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
    // zonas que pinta el sistema en iOS: fondo de <html> y barras (theme-color)
    const sys = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      metas: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')),
    }));
    expect(sys.html === 'rgb(18, 18, 20)', `fondo de html no oscuro: ${sys.html}`);
    expect(sys.scheme === 'dark', `color-scheme: ${sys.scheme}`);
    expect(sys.metas.length === 1 && sys.metas[0] === '#121214', `theme-color: ${sys.metas.join(',')}`);
    // al cambiar de tema sin recargar, la etiqueta se sustituye por una nueva (iOS repinta la barra)
    const swap = async (label, expected) => {
      const before = await page.evaluateHandle(() => document.querySelector('meta[name="theme-color"]'));
      await page.getByRole('tab', { name: new RegExp(label) }).click();
      const r = await page.evaluate((old) => {
        const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
        return { n: metas.length, color: metas[0]?.getAttribute('content'), replaced: metas[0] !== old, html: getComputedStyle(document.documentElement).backgroundColor };
      }, before);
      expect(r.n === 1 && r.color === expected && r.replaced, `${label}: ${JSON.stringify(r)}`);
    };
    await swap('Claro', '#f7f7f5');
    await swap('Oscuro', '#121214');
    await swap('Claro', '#f7f7f5');
    await page.getByRole('tab', { name: /Oscuro/ }).click();
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
    await p2.getByLabel('Contraseña', { exact: true }).fill('secreto123');
    await p2.getByLabel('Repite la contraseña', { exact: true }).fill('secreto123');
    await p2.getByRole('button', { name: 'Crear cuenta' }).click();
    await p2.waitForURL(base + '/');
    await p2.goto(base + '/alumnos');
    await p2.getByText('Aún no tienes alumnos').waitFor();
    await p2.goto(`${base}/alumnos/${students['Hugo']}`);
    await p2.getByText('Alumno no encontrado').waitFor();
    await other.close();
  });

  await step('sincronización en vivo entre dispositivos (sin recargar)', async () => {
    const { devices } = await import('node:module').then((m) => m.createRequire(import.meta.url)('playwright'));
    const phone = await browser.newContext({ ...devices['iPhone 14'], timezoneId: 'Europe/Madrid', storageState: await ctx.storageState({ indexedDB: true }) });
    const m = await phone.newPage();
    await m.goto(base + '/alumnos');
    await m.getByText('Hugo García').first().waitFor();
    // en el ordenador: alumno nuevo y cambio de nombre
    await page.goto(base + '/alumnos');
    await quick('Alumno');
    await page.getByLabel('Nombre *').fill('Sincro');
    await page.getByRole('button', { name: 'Crear alumno' }).click();
    await page.getByRole('heading', { name: 'Sincro' }).waitFor();
    // en el iPhone aparece solo, sin recargar
    await m.getByText('Sincro', { exact: true }).waitFor({ timeout: 10_000 });
    await phone.close();
  });

  await step('móvil (iPhone): navegación inferior y vistas', async () => {
    const { devices } = await import('node:module').then((m) => m.createRequire(import.meta.url)('playwright'));
    const mctx = await browser.newContext({ ...devices['iPhone 14'], timezoneId: 'Europe/Madrid', storageState: await ctx.storageState({ indexedDB: true }) });
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
    // el formulario de alumno cabe en la pantalla, sin desplazamiento lateral
    await m.goto(base + '/');
    await m.getByRole('button', { name: 'Crear' }).click();
    await m.getByRole('menuitem', { name: 'Alumno' }).click();
    await m.getByRole('dialog').waitFor();
    await m.waitForTimeout(400);
    const fit = await m.evaluate(() => {
      const panel = document.querySelector('[role=dialog]');
      const body = panel.querySelector('.overflow-y-auto');
      return { vw: window.innerWidth, panel: panel.getBoundingClientRect().width, scroll: body.scrollWidth, client: body.clientWidth, bodyPos: getComputedStyle(document.body).position };
    });
    expect(fit.panel <= fit.vw && fit.scroll <= fit.client, `formulario desbordado: ${JSON.stringify(fit)}`);
    expect(fit.bodyPos === 'fixed', 'el fondo debería quedar bloqueado mientras el formulario está abierto');
    await m.screenshot({ path: `${shots}/movil-nuevo-alumno.png` });
    await m.getByRole('button', { name: 'Cancelar' }).click();
    expect((await m.evaluate(() => getComputedStyle(document.body).position)) !== 'fixed', 'el fondo debería desbloquearse al cerrar');
    await m.getByRole('button', { name: 'Crear' }).click();
    await m.getByRole('menuitem', { name: 'Tarea' }).click();
    await m.getByRole('dialog').waitFor();
    await m.screenshot({ path: `${shots}/movil-nueva-tarea.png` });
    await mctx.close();
  });

  await step('iPhone en modo oscuro del sistema: todo oscuro', async () => {
    const { devices } = await import('node:module').then((m) => m.createRequire(import.meta.url)('playwright'));
    const dctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: 'dark', timezoneId: 'Europe/Madrid', storageState: await ctx.storageState({ indexedDB: true }) });
    const d = await dctx.newPage();
    await d.goto(base + '/login');
    await d.evaluate(() => localStorage.setItem('aulora-theme', 'system'));
    for (const u of ['/', '/tareas', '/agenda', '/ajustes']) {
      await d.goto(base + u);
      await d.getByRole('navigation', { name: 'Navegación principal' }).waitFor();
      const r = await d.evaluate(() => {
        const light = (c) => {
          const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0, 0];
          if (m.length === 4 && m[3] === 0) return false;
          return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] > 200;
        };
        const offenders = [...document.querySelectorAll('body, body *')]
          .filter((el) => el.getBoundingClientRect().width > 40 && light(getComputedStyle(el).backgroundColor))
          .map((el) => el.tagName + '.' + String(el.className).slice(0, 60));
        return {
          dark: document.documentElement.classList.contains('dark'),
          html: getComputedStyle(document.documentElement).backgroundColor,
          metas: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => `${m.getAttribute('media') ?? ''}=${m.getAttribute('content')}`),
          offenders: offenders.slice(0, 5),
        };
      });
      expect(r.dark && r.html === 'rgb(18, 18, 20)', `${u}: tema ${JSON.stringify(r)}`);
      expect(r.metas.length === 1 && r.metas[0].endsWith('#121214'), `${u}: theme-color ${r.metas.join(' ')}`);
      expect(!r.offenders.length, `${u}: fondos claros en modo oscuro: ${r.offenders.join(' | ')}`);
    }
    await d.screenshot({ path: `${shots}/movil-oscuro-ajustes.png` });
    await d.goto(base + '/');
    await d.screenshot({ path: `${shots}/movil-oscuro-inicio.png` });
    await dctx.close();
  });

  await step('tablet (iPad): agenda semanal', async () => {
    const { devices } = await import('node:module').then((m) => m.createRequire(import.meta.url)('playwright'));
    const tctx = await browser.newContext({ ...devices['iPad Pro 11'], timezoneId: 'Europe/Madrid', storageState: await ctx.storageState({ indexedDB: true }) });
    const t = await tctx.newPage();
    await t.goto(`${base}/agenda?vista=semana&fecha=${key(nextMonday)}`);
    await t.locator('[role=button][aria-label^="Hugo García"]').first().waitFor();
    await t.screenshot({ path: `${shots}/ipad-agenda.png` });
    await t.goto(`${base}/tareas?semana=${week}`);
    await t.getByText('Estudio nº 4').waitFor();
    await t.screenshot({ path: `${shots}/ipad-tareas.png` });
    await tctx.close();
  });

  await step('cambiar la contraseña con confirmación', async () => {
    await page.goto(base + '/ajustes');
    await page.getByLabel('Contraseña actual', { exact: true }).fill('secreto123');
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('nuevaClave2026');
    await page.getByLabel('Repítela', { exact: true }).fill('nuevaClave2025');
    await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
    await toast('Las contraseñas no coinciden');
    await page.getByLabel('Repítela', { exact: true }).fill('nuevaClave2026');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).nth(1).click();
    expect((await page.getByLabel('Nueva contraseña', { exact: true }).getAttribute('type')) === 'text', 'debería verse la nueva contraseña');
    await page.getByRole('button', { name: 'Actualizar contraseña' }).click();
    await toast('Contraseña actualizada');
  });

  await step('cerrar sesión y entrar con la nueva contraseña', async () => {
    await page.goto(base + '/ajustes');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL(/\/login/);
    await page.goto(base + '/');
    await page.waitForURL(/\/login/);
    await page.getByLabel('Correo electrónico').fill('pedro@test.es');
    await page.getByLabel('Contraseña', { exact: true }).fill('nuevaClave2026');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(base + '/');
    await page.getByRole('heading', { name: /Pedro/ }).waitFor();
  });

  const relevant = errors.filter((e) => !/hydrat/i.test(e) || true);
  if (relevant.length) {
    failed++;
    console.log('  ✗ errores en la consola del navegador:\n      ' + [...new Set(relevant)].slice(0, 10).join('\n      '));
  } else console.log('  ✓ sin errores de JavaScript en el navegador');

  console.log(failed ? `\n${failed} pasos fallidos` : '\nTodo correcto');
  return failed;
}
