# Aulora · Gestión docente

Aulora es una aplicación web para gestionar a tus alumnos, grupos, clases, agenda y tareas semanales como profesor particular y de clases colectivas. Funciona en Mac, iPad y iPhone, y cada profesor solo puede ver sus propios datos.

**Tecnología:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth y Row Level Security) · TanStack Query · Lucide · date-fns.

---

## Funcionalidades

| Área | Qué incluye |
| --- | --- |
| **Inicio** | Alumnos activos, grupos, clases de hoy y próximas, clases por preparar, tareas de la semana, alumnos con tareas pendientes, resumen semanal y actividad reciente. |
| **Agenda** | Vistas de día, semana (de lunes a domingo) y mes. Puedes arrastrar una clase para moverla (en táctil, mantén pulsado) o estirar su borde para cambiar la duración. Clases recurrentes por días de la semana con fecha de inicio y de fin. Cancelar, reprogramar, anotaciones, aviso de conflictos y tareas de la semana dentro del panel de cada clase. |
| **Alumnos** | Ficha completa con foto, buscador y filtros por estado. Pestañas: Información, Agenda, Tareas (por semanas), Seguimiento e Historial. Se pueden editar, duplicar, archivar y eliminar. |
| **Grupos** | Integrantes (un alumno puede estar en varios grupos), día, hora, duración, aula y observaciones. Tareas para todo el grupo con el estado de cada integrante, o tareas individuales para un alumno del grupo. |
| **Tareas** | Vista semanal por alumno y grupo, con flechas, botón «Esta semana» y selector de fecha. Muestra quién tiene tareas, quién tiene pendientes y quién no tiene ninguna. Puedes añadir tareas en línea (escribir e Intro) o con el formulario completo, también varias a la vez. Para copiar la semana a otra, eliges qué tareas copiar y la aplicación evita duplicarlas. Vista de lista con filtros. |
| **Ficha de clase** | Contenido previsto (se guarda solo), tareas de la semana y de las 4 semanas anteriores, marcar tareas como realizadas o revisadas, observaciones, objetivos para la próxima clase, resumen al finalizar (queda en el historial) y la clase anterior como referencia. |
| **Seguimiento** | Clases realizadas, cumplimiento de tareas, evolución por categorías, últimas 8 semanas, objetivos y anotaciones (observación, logro, dificultad, aspecto a mejorar). También hay una vista general de todos los alumnos. |
| **Búsqueda** | Buscador global con ⌘K / Ctrl+K o `/` y búsqueda avanzada con filtros por alumno, grupo, semana, categoría, estado y fechas. |
| **Ajustes** | Perfil, horario de la agenda, duración por defecto, tema claro/oscuro/sistema, categorías editables, cambio de contraseña, exportación de una copia de seguridad en JSON y cierre de sesión. |

**Atajos de teclado:** `T` nueva tarea · `C` nueva clase · `A` nuevo alumno · `G` nuevo grupo · `⌘K` buscar.

---

## Estructura del proyecto

```
aulora/
├── supabase/migrations/      # Esquema SQL completo (tablas, RLS, triggers, RPC)
├── src/
│   ├── app/                  # Rutas (App Router)
│   │   ├── (app)/            # Zona privada: inicio, agenda, alumnos, grupos, tareas,
│   │   │                     # seguimiento, clases/[id], buscar, ajustes
│   │   ├── login/            # Acceso y registro
│   │   └── auth/             # Callbacks de Supabase Auth (confirmación, recuperación)
│   ├── proxy.ts              # Protege las rutas y refresca la sesión (middleware de Next 16)
│   ├── services/api.ts       # Capa de datos: todas las consultas a Supabase
│   ├── hooks/data.ts         # Hooks de TanStack Query, caché e invalidaciones
│   ├── lib/                  # Dominio: fechas, recurrencia, conflictos, tipos, etiquetas
│   └── components/
│       ├── ui/               # Botones, campos, diálogos, menús, avatares, pestañas…
│       ├── layout/           # Barra lateral, barra inferior móvil, crear rápido, buscador ⌘K
│       ├── agenda/           # Rejilla horaria (arrastrar/redimensionar), mes, formulario, panel
│       ├── tasks/            # Fila de tarea, añadir rápido, copiar semana, formulario
│       ├── students/ groups/ lessons/ progress/
└── e2e/                      # Pruebas de base de datos y de extremo a extremo
```

### Modelo de datos

```
auth.users ─┬─ profiles               (preferencias del profesor)
            ├─ task_categories        (Técnica, Estudios, Repertorio, Lectura, Teoría musical, Ejercicios, Otros)
            ├─ students ──┐
            ├─ groups ────┼─ group_members        (N:M alumnos ↔ grupos)
            ├─ lesson_series ─── lessons          (horario recurrente → cada sesión real)
            ├─ tasks ─────────── task_assignments (una asignación y un estado por alumno)
            ├─ progress_notes · goals             (seguimiento)
            └─ activity_log                       (actividad reciente, generada por triggers)
```

Decisiones clave:

- **Las clases recurrentes se guardan sesión a sesión.** Una serie crea una fila por sesión, de modo que modificar, cancelar o resumir una sesión nunca afecta a las demás. Al editar puedes elegir «Solo esta sesión» o «Esta y las siguientes».
- **Las tareas y las asignaciones van por separado.** Una tarea puede asignarse a uno o varios alumnos, o a un grupo completo (en ese caso se crea una asignación por integrante y cada alumno lleva su propio estado).
- **Copiar una semana no crea duplicados.** Cada copia lleva una clave única (`copy_key`), así que la misma tarea no puede copiarse dos veces a la misma semana.
- **La seguridad está en la base de datos.** Hay RLS en todas las tablas (`owner_id = auth.uid()`), y las claves foráneas compuestas `(id, owner_id)` impiden enlazar filas de otro profesor aunque se conozca su UUID.
- Las fotos se guardan como miniaturas JPEG de unos 10 KB dentro de la fila del alumno, así que también las protege la RLS sin configurar un bucket.
- `localStorage` solo se usa para la preferencia de tema. Todos los datos están en PostgreSQL.

---

## 1. Crear la base de datos en Supabase

1. Entra en [supabase.com](https://supabase.com) → **New project**. Ponle el nombre `Aulora` y elige la región `West EU (Paris)` (la más cercana a España). Guarda la contraseña de la base de datos.
2. Cuando el proyecto esté listo, ve a **SQL Editor → New query**, pega el contenido de [`supabase/migrations/20261106000000_init.sql`](supabase/migrations/20261106000000_init.sql) y pulsa **Run**. Debe terminar sin errores.
   - Si usas la CLI: `npx supabase link --project-ref TU_REF && npx supabase db push`.
3. Ve a **Project Settings → API Keys** y copia:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_…`). Si tu proyecto solo muestra la clave *anon* (legacy), también sirve.

## 2. Probar en local

```bash
cd aulora
cp .env.example .env.local      # rellena URL y publishable key
npm install
npm run dev                     # http://localhost:3000
```

Entra en `/login` → **Crear una cuenta nueva**. Si Supabase tiene activada la confirmación por correo, abre el enlace del email y volverás a la app con la sesión iniciada.

## 3. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), elige **Import Git Repository** y selecciona `pedrocarramolino/pedrocarramolino.github.io`.
2. En **Configure Project**:
   - **Root Directory:** `aulora` (importante: el resto del repositorio es tu portfolio).
   - **Framework Preset:** Next.js (se detecta solo).
   - **Environment Variables** (para *Production*, *Preview* y *Development*):

     | Nombre | Valor |
     | --- | --- |
     | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
     | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
     | `NEXT_PUBLIC_SITE_URL` | `https://tu-proyecto.vercel.app` (la URL final; puedes añadirla después del primer despliegue) |

3. Pulsa **Deploy**. Al terminar tendrás una URL del tipo `https://aulora-xxxx.vercel.app`.
4. Si quieres que Vercel solo vuelva a desplegar cuando cambie la app, ve a **Settings → Build and Deployment → Ignored Build Step** y pon `git diff --quiet HEAD^ HEAD -- .`.

## 4. Configurar las URLs de autenticación en Supabase

En Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://tu-proyecto.vercel.app`
- **Redirect URLs:** añade
  - `https://tu-proyecto.vercel.app/auth/callback`
  - `https://tu-proyecto.vercel.app/**` (incluye también las vistas previas, si quieres)
  - `http://localhost:3000/**` (para desarrollo)

Recomendado para una app privada:

1. Crea tu cuenta desde `/login`.
2. Después, en **Authentication → Sign In / Providers → Email**, desactiva **Allow new users to sign up**. Así nadie más podrá registrarse. Aunque alguien lo intentara, la RLS le impediría ver tus datos.

## 5. Usarla en iPhone y iPad como una app

Abre la URL en Safari → botón **Compartir** → **Añadir a pantalla de inicio**. Se abre a pantalla completa, con su icono y respetando el notch y la barra inferior.

---

## Pruebas

```bash
npm test          # Pruebas unitarias (recurrencia, conflictos, fechas, estados)
npm run db:test   # Migración + RLS + RPC sobre un Postgres local (necesita DATABASE_URL)
npm run build && npm run e2e   # 29 escenarios E2E con Playwright
```

Las pruebas E2E usan un Postgres local con la misma migración y un pequeño servidor (`e2e/backend/server.mjs`) que reproduce la parte de la API de Supabase que usa la app (Auth y PostgREST). Cada consulta se ejecuta como el rol `authenticated` con su JWT, así que la RLS real queda probada. **Ese servidor solo sirve para las pruebas**: en producción la app habla directamente con Supabase. Para lanzarlas, `.env.local` debe apuntar a `http://localhost:54321` al compilar.

Cubren: registro e inicio de sesión, alumnos (crear, duplicar, archivar), grupos, series recurrentes, conflictos, arrastrar clases, editar una sesión sin tocar la serie, tareas en línea y con formulario, estados, vista general, copiar semana sin duplicados, ficha de clase, seguimiento, buscador, filtros, persistencia, aislamiento entre profesores, tema oscuro, móvil (iPhone, sin desbordamientos) y tablet (iPad).

## Copias de seguridad

**Ajustes → Exportar mis datos** descarga un JSON con todas tus tablas. Además, Supabase hace copias diarias automáticas de la base de datos.
