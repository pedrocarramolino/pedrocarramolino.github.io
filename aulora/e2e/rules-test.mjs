// Pruebas de las reglas de seguridad de Firestore contra el emulador oficial.
//   npm run rules:test   (arranca el emulador, ejecuta y lo detiene)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');

const here = path.dirname(fileURLToPath(import.meta.url));
const env = await initializeTestEnvironment({
  projectId: 'demo-aulora',
  firestore: { rules: readFileSync(path.join(here, '../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
});

const now = new Date().toISOString();
const student = (extra = {}) => ({
  first_name: 'Hugo', last_name: 'García', photo: null, instrument: 'Trompeta', phone: '', email: '', joined_on: '2026-11-06',
  usual_schedule: '', lesson_minutes: 45, level: '', notes: '', status: 'active', color: 'indigo', group_ids: [], created_at: now, updated_at: now, ...extra,
});
const lesson = (extra = {}) => ({
  series_id: null, student_id: 's1', group_id: null, starts_at: '2026-11-09T16:00:00.000Z', ends_at: '2026-11-09T16:45:00.000Z',
  duration_minutes: 45, lesson_type: 'Individual', status: 'scheduled', location: '', plan: '', notes: '', summary: '', next_goals: '', ...extra,
});
const task = (extra = {}) => ({
  title: 'Estudio nº 4', description: '', category_id: null, priority: 'normal', week_start: '2026-11-09', assigned_on: '2026-11-06',
  due_on: null, notes: '', group_id: null, lesson_id: null, copied_from: null, student_ids: ['s1'],
  assignments: { s1: { status: 'pending', feedback: '', completed_at: null, reviewed_at: null, updated_at: now } }, ...extra,
});

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await env.clearFirestore();
    await fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.log('  ✗', name, '\n     ', e.message);
  }
}

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anon = () => env.unauthenticatedContext().firestore();

console.log('Reglas de Firestore');

await test('el profesor lee y escribe sus datos', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/students/s1'), student()));
  await assertSucceeds(getDoc(doc(alice(), 'users/alice/students/s1')));
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice/students/s1'), { level: 'Elemental 2' }));
  await assertSucceeds(deleteDoc(doc(alice(), 'users/alice/students/s1')));
});

await test('otro profesor no puede leer, listar, modificar ni borrar', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/students/s1'), student()));
  await assertFails(getDoc(doc(bob(), 'users/alice/students/s1')));
  await assertFails(getDocs(collection(bob(), 'users/alice/students')));
  await assertFails(updateDoc(doc(bob(), 'users/alice/students/s1'), { first_name: 'X' }));
  await assertFails(deleteDoc(doc(bob(), 'users/alice/students/s1')));
  await assertFails(setDoc(doc(bob(), 'users/alice/students/s2'), student()));
});

await test('sin sesión no hay acceso', async () => {
  await assertFails(getDocs(collection(anon(), 'users/alice/students')));
  await assertFails(setDoc(doc(anon(), 'users/alice/students/s1'), student()));
});

await test('rutas fuera de users/{uid} están cerradas', async () => {
  await assertFails(setDoc(doc(alice(), 'public/x'), { a: 1 }));
  await assertFails(getDoc(doc(alice(), 'users/bob')));
});

await test('validación de alumnos', async () => {
  await assertFails(setDoc(doc(alice(), 'users/alice/students/s1'), student({ first_name: '' })));
  await assertFails(setDoc(doc(alice(), 'users/alice/students/s1'), student({ status: 'borrado' })));
  await assertFails(setDoc(doc(alice(), 'users/alice/students/s1'), student({ lesson_minutes: 0 })));
});

await test('validación de clases: un solo destinatario y duración válida', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/lessons/l1'), lesson()));
  await assertFails(setDoc(doc(alice(), 'users/alice/lessons/l2'), lesson({ group_id: 'g1' })));
  await assertFails(setDoc(doc(alice(), 'users/alice/lessons/l3'), lesson({ student_id: null })));
  await assertFails(setDoc(doc(alice(), 'users/alice/lessons/l4'), lesson({ duration_minutes: 900 })));
  await assertFails(setDoc(doc(alice(), 'users/alice/lessons/l5'), lesson({ status: 'otra' })));
});

await test('validación de tareas', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/tasks/t1'), task()));
  await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t2'), task({ title: '' })));
  await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t3'), task({ week_start: '9/11/2026' })));
  await assertFails(setDoc(doc(alice(), 'users/alice/tasks/t4'), task({ priority: 'urgente' })));
});

await test('el registro de actividad no se puede modificar', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/activity/a1'), { entity: 'students', entity_id: 's1', action: 'created', label: 'Hugo', created_at: now }));
  await assertFails(updateDoc(doc(alice(), 'users/alice/activity/a1'), { label: 'Otro' }));
});

await test('perfil: horario coherente', async () => {
  const p = { display_name: 'Pedro', day_start_hour: 8, day_end_hour: 22, default_lesson_minutes: 60, created_at: now };
  await assertSucceeds(setDoc(doc(alice(), 'users/alice'), p));
  await assertFails(setDoc(doc(alice(), 'users/alice'), { ...p, day_end_hour: 7 }));
});

await env.cleanup();
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
