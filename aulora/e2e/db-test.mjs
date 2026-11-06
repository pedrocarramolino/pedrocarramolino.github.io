// Pruebas de la base de datos sobre un Postgres local con el stub de Supabase.
// Verifica: migración, RLS entre profesores, FKs compuestas, RPCs y triggers.
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:test
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const dbName = 'aula_dbtest';

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`drop database if exists ${dbName}`);
await admin.query(`create database ${dbName}`);
await admin.end();

const url = new URL(adminUrl);
url.pathname = '/' + dbName;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
await db.query(readFileSync(path.join(here, 'db/supabase-stub.sql'), 'utf8'));
const migrations = path.join(here, '../supabase/migrations');
for (const f of (await import('node:fs')).readdirSync(migrations).sort()) {
  await db.query(readFileSync(path.join(migrations, f), 'utf8'));
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await db.query('begin');
    await fn();
    await db.query('rollback');
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    await db.query('rollback').catch(() => {});
    failed++;
    console.log('  ✗', name, '\n     ', e.message);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function as(uid, sql, params) {
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await db.query('set local role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.query('reset role');
  }
}
async function rejects(fn, msg) {
  await db.query('savepoint sp');
  try {
    await fn();
  } catch {
    await db.query('rollback to savepoint sp');
    return;
  }
  throw new Error(msg);
}
async function user(email) {
  const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  return r.rows[0].id;
}

console.log('Base de datos');

await test('alta de usuario crea perfil y 7 categorías', async () => {
  const a = await user('a@test.es');
  const p = await as(a, 'select * from profiles');
  assert(p.rowCount === 1 && p.rows[0].display_name === 'a', 'perfil');
  const c = await as(a, 'select name from task_categories order by sort_order');
  assert(c.rows.map((r) => r.name).join(',') === 'Técnica,Estudios,Repertorio,Lectura,Teoría musical,Ejercicios,Otros', 'categorías');
});

await test('RLS: un profesor no ve ni modifica datos de otro', async () => {
  const a = await user('a@test.es');
  const b = await user('b@test.es');
  await as(a, `insert into students (first_name) values ('Hugo')`);
  const seenByB = await as(b, 'select * from students');
  assert(seenByB.rowCount === 0, 'B ve alumnos de A');
  const upd = await as(b, `update students set first_name = 'X' returning id`);
  assert(upd.rowCount === 0, 'B modifica alumnos de A');
  const del = await as(b, `delete from students returning id`);
  assert(del.rowCount === 0, 'B borra alumnos de A');
  await rejects(() => as(b, `insert into students (owner_id, first_name) values ($1, 'Intruso')`, [a]), 'B inserta en nombre de A');
});

await test('anon no tiene acceso', async () => {
  await db.query('set local role anon');
  await rejects(() => db.query('select * from students'), 'anon lee alumnos');
  await db.query('reset role');
});

await test('FK compuesta impide enlazar el alumno de otro profesor', async () => {
  const a = await user('a@test.es');
  const b = await user('b@test.es');
  const s = await as(a, `insert into students (first_name) values ('Hugo') returning id`);
  const g = await as(b, `insert into groups (name) values ('Grupo B') returning id`);
  await rejects(
    () => as(b, `insert into group_members (group_id, student_id) values ($1, $2)`, [g.rows[0].id, s.rows[0].id]),
    'B añade a su grupo un alumno de A',
  );
});

await test('clases: ends_at calculado y conflictos detectados', async () => {
  const a = await user('a@test.es');
  const s = (await as(a, `insert into students (first_name) values ('Hugo') returning id`)).rows[0].id;
  const l = await as(a, `insert into lessons (student_id, starts_at, duration_minutes) values ($1, '2026-11-09 17:00+01', 45) returning ends_at`, [s]);
  assert(new Date(l.rows[0].ends_at).toISOString() === '2026-11-09T16:45:00.000Z', 'ends_at');
  const c = await as(a, `select * from find_conflicts('2026-11-09 17:30+01', '2026-11-09 18:00+01')`);
  assert(c.rowCount === 1, 'conflicto no detectado');
  const none = await as(a, `select * from find_conflicts('2026-11-09 17:45+01', '2026-11-09 18:30+01')`);
  assert(none.rowCount === 0, 'falso conflicto en el borde');
  await as(a, `update lessons set status = 'cancelled'`);
  const after = await as(a, `select * from find_conflicts('2026-11-09 17:30+01', '2026-11-09 18:00+01')`);
  assert(after.rowCount === 0, 'clase cancelada genera conflicto');
});

await test('tarea de grupo crea una asignación por integrante (excepto archivados)', async () => {
  const a = await user('a@test.es');
  const g = (await as(a, `insert into groups (name) values ('LM1') returning id`)).rows[0].id;
  const ids = (await as(a, `insert into students (first_name, status) values ('A','active'),('B','active'),('C','archived') returning id`)).rows.map((r) => r.id);
  for (const id of ids) await as(a, `insert into group_members (group_id, student_id) values ($1, $2)`, [g, id]);
  const t = (await as(a, `insert into tasks (title, week_start) values ('Dictado', '2026-11-09') returning id`)).rows[0].id;
  const n = await as(a, `select assign_task_to_group($1, $2) as n`, [t, g]);
  assert(n.rows[0].n === 2, `esperadas 2 asignaciones, hay ${n.rows[0].n}`);
});

await test('semana debe empezar en lunes', async () => {
  const a = await user('a@test.es');
  await rejects(() => as(a, `insert into tasks (title, week_start) values ('X', '2026-11-10')`), 'acepta martes');
});

await test('duplicar semana: copia, resetea estado y no duplica dos veces', async () => {
  const a = await user('a@test.es');
  const s1 = (await as(a, `insert into students (first_name) values ('Hugo') returning id`)).rows[0].id;
  const s2 = (await as(a, `insert into students (first_name) values ('Alberto') returning id`)).rows[0].id;
  const t = (await as(a, `insert into tasks (title, week_start, due_on) values ('Estudio 4', '2026-11-09', '2026-11-13') returning id`)).rows[0].id;
  await as(a, `insert into task_assignments (task_id, student_id, status) values ($1, $2, 'completed'), ($1, $3, 'reviewed')`, [t, s1, s2]);
  const n1 = await as(a, `select duplicate_tasks(array[$1]::uuid[], '2026-11-16') as n`, [t]);
  assert(n1.rows[0].n === 1, 'primera copia');
  const n2 = await as(a, `select duplicate_tasks(array[$1]::uuid[], '2026-11-16') as n`, [t]);
  assert(n2.rows[0].n === 0, 'segunda copia no debería crear nada');
  const copy = await as(a, `select t.due_on::text, array_agg(a.status::text) st from tasks t join task_assignments a on a.task_id = t.id where t.week_start = '2026-11-16' group by t.id`);
  assert(copy.rows[0].due_on === '2026-11-20', 'fecha de revisión desplazada');
  assert(copy.rows[0].st.every((x) => x === 'pending') && copy.rows[0].st.length === 2, 'estados reseteados');
  const n3 = await as(a, `select duplicate_tasks(array[$1]::uuid[], '2026-11-23', $2) as n`, [t, s1]);
  assert(n3.rows[0].n === 1, 'copia individual');
  const ind = await as(a, `select count(*)::int c from task_assignments a join tasks t on t.id = a.task_id where t.week_start = '2026-11-23'`);
  assert(ind.rows[0].c === 1, 'la copia individual solo incluye al alumno');
});

await test('duplicar alumno copia ficha y grupos', async () => {
  const a = await user('a@test.es');
  const s = (await as(a, `insert into students (first_name, last_name, instrument) values ('Hugo', 'Pérez', 'Trompeta') returning id`)).rows[0].id;
  const g = (await as(a, `insert into groups (name) values ('Trompetas') returning id`)).rows[0].id;
  await as(a, `insert into group_members (group_id, student_id) values ($1, $2)`, [g, s]);
  const n = (await as(a, `select duplicate_student($1) id`, [s])).rows[0].id;
  const copy = await as(a, `select s.last_name, s.instrument, (select count(*)::int from group_members where student_id = s.id) g from students s where id = $1`, [n]);
  assert(copy.rows[0].last_name === 'Pérez (copia)' && copy.rows[0].instrument === 'Trompeta' && copy.rows[0].g === 1, 'copia incorrecta');
});

await test('estados de asignación sellan fechas', async () => {
  const a = await user('a@test.es');
  const s = (await as(a, `insert into students (first_name) values ('Hugo') returning id`)).rows[0].id;
  const t = (await as(a, `insert into tasks (title, week_start) values ('X', '2026-11-09') returning id`)).rows[0].id;
  await as(a, `insert into task_assignments (task_id, student_id) values ($1, $2)`, [t, s]);
  const r = await as(a, `update task_assignments set status = 'reviewed' returning completed_at, reviewed_at`);
  assert(r.rows[0].completed_at && r.rows[0].reviewed_at, 'fechas no selladas');
  const p = await as(a, `update task_assignments set status = 'pending' returning completed_at, reviewed_at`);
  assert(!p.rows[0].completed_at && !p.rows[0].reviewed_at, 'fechas no limpiadas');
});

await test('registro de actividad: crea entradas, ignora cascadas y series', async () => {
  const a = await user('a@test.es');
  const s = (await as(a, `insert into students (first_name, last_name) values ('Hugo', 'Pérez') returning id`)).rows[0].id;
  const se = (await as(a, `insert into lesson_series (student_id, weekdays, start_time, duration_minutes, start_date, end_date) values ($1, '{1,3}', '17:00', 45, '2026-11-09', '2027-06-30') returning id`, [s])).rows[0].id;
  await as(a, `insert into lessons (series_id, student_id, starts_at, duration_minutes) values ($1, $2, '2026-11-09 17:00+01', 45), ($1, $2, '2026-11-11 17:00+01', 45)`, [se, s]);
  await as(a, `delete from students where id = $1`, [s]);
  const log = await as(a, `select entity, action, label from activity_log order by id`);
  const summary = log.rows.map((r) => `${r.entity}:${r.action}`).join(',');
  assert(summary === 'students:created,lesson_series:created,students:deleted', summary);
  assert(log.rows[0].label === 'Hugo Pérez', 'etiqueta');
});

await test('eliminar la cuenta borra todos sus datos', async () => {
  const a = await user('a@test.es');
  await as(a, `insert into students (first_name) values ('Hugo')`);
  await as(a, `insert into groups (name) values ('G')`);
  await db.query('delete from auth.users where id = $1', [a]);
  const r = await db.query('select (select count(*) from students) + (select count(*) from groups) + (select count(*) from activity_log) as n');
  assert(Number(r.rows[0].n) === 0, 'quedan datos');
});

await db.end();
const cleanup = new pg.Client({ connectionString: adminUrl });
await cleanup.connect();
await cleanup.query(`drop database if exists ${dbName}`);
await cleanup.end();

console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
