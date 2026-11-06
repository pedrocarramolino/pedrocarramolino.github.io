# Aulora · Gestión docente

Aulora es una aplicación web para gestionar a tus alumnos, grupos, clases, agenda y tareas semanales como profesor particular y de clases colectivas. Funciona en Mac, iPad y iPhone, y cada profesor solo puede ver sus propios datos.

**Tecnología:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Firebase (Authentication + Cloud Firestore con reglas de seguridad) · TanStack Query · Lucide · date-fns. Se despliega en Vercel.

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
| **Búsqueda** | Buscador global con ⌘K / Ctrl+K o `/` (sin distinguir tildes) y búsqueda avanzada con filtros por alumno, grupo, semana, categoría, estado y fechas. |
| **Ajustes** | Perfil, horario de la agenda, duración por defecto, tema claro/oscuro/sistema, categorías editables, cambio de contraseña (con confirmación, requisitos mínimos y opción de verla), exportación de una copia de seguridad en JSON y cierre de sesión. |

**Atajos de teclado:** `T` nueva tarea · `C` nueva clase · `A` nuevo alumno · `G` nuevo grupo · `⌘K` buscar.

---

## Estructura del proyecto

```
aulora/
├── firestore.rules           # Reglas de seguridad (cada profesor solo accede a lo suyo)
├── firestore.indexes.json    # Índices (no hacen falta índices compuestos)
├── firebase.json · .firebaserc
├── src/
│   ├── app/                  # Rutas (App Router)
│   │   ├── (app)/            # Zona privada: inicio, agenda, alumnos, grupos, tareas,
│   │   │                     # seguimiento, clases/[id], buscar, ajustes
│   │   └── login/            # Acceso, registro y recuperación de contraseña
│   ├── lib/firebase.ts       # Inicialización de Firebase (y emuladores en pruebas)
│   ├── services/api.ts       # Capa de datos: todas las lecturas/escrituras en Firestore
│   ├── hooks/data.ts         # Hooks de TanStack Query, caché e invalidaciones
│   ├── lib/                  # Dominio: fechas, recurrencia, conflictos, tipos, etiquetas
│   └── components/
│       ├── ui/               # Botones, campos, diálogos, menús, avatares, pestañas…
│       ├── layout/           # Sesión (AuthGate), barra lateral, barra inferior, ⌘K
│       ├── agenda/           # Rejilla horaria (arrastrar/redimensionar), mes, formulario, panel
│       ├── tasks/            # Fila de tarea, añadir rápido, copiar semana, formulario
│       ├── students/ groups/ lessons/ progress/
└── e2e/                      # Pruebas de reglas y de extremo a extremo
```

### Modelo de datos (Cloud Firestore)

Todos los datos de un profesor cuelgan de su usuario:

```
users/{uid}                       perfil y preferencias
users/{uid}/categories/{id}       Técnica, Estudios, Repertorio, Lectura, Teoría musical, Ejercicios, Otros
users/{uid}/students/{id}         alumnos · group_ids: grupos a los que pertenece (N:M)
users/{uid}/groups/{id}           grupos
users/{uid}/series/{id}           horarios recurrentes
users/{uid}/lessons/{id}          cada sesión real (resumen, observaciones, objetivos…)
users/{uid}/tasks/{id}            tareas · assignments: { alumno → estado, fechas, comentario }
users/{uid}/notes/{id}            anotaciones de seguimiento
users/{uid}/goals/{id}            objetivos
users/{uid}/activity/{id}         actividad reciente
```

Decisiones clave:

- **Las clases recurrentes se guardan sesión a sesión.** Una serie crea un documento por sesión, de modo que modificar, cancelar o resumir una sesión nunca afecta a las demás. Al editar puedes elegir «Solo esta sesión» o «Esta y las siguientes».
- **Cada tarea guarda sus asignaciones.** Una tarea puede ir a uno o varios alumnos, o a un grupo completo (en ese caso se crea una asignación por integrante y cada alumno lleva su propio estado). Los cambios de estado se hacen en transacciones.
- **Copiar una semana no crea duplicados.** Cada copia tiene un identificador fijo (tarea de origen + semana + alcance), así que la misma tarea no puede copiarse dos veces a la misma semana.
- **La seguridad está en el servidor.** Las reglas de Firestore solo permiten a cada usuario autenticado leer y escribir dentro de `users/{suUid}` y además validan los campos esenciales. Todo lo demás está cerrado.
- **Las operaciones de varios documentos son atómicas.** Por ejemplo, borrar un alumno elimina también sus clases, anotaciones, objetivos y asignaciones en lotes.
- Las fotos se guardan como miniaturas JPEG de unos 10 KB dentro del documento del alumno, así que no hace falta configurar Storage.
- Firestore guarda una caché local (IndexedDB) para que la app abra al instante. La fuente de verdad es siempre el servidor. `localStorage` solo se usa para la preferencia de tema.

---

## 1. Crear el proyecto de Firebase

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) → **Crear un proyecto** → nombre `Aulora`. Google Analytics no hace falta. El plan gratuito **Spark** es suficiente.
2. **Authentication** → **Comenzar** → pestaña **Método de inicio de sesión** → activa **Correo electrónico/contraseña**.
3. **Firestore Database** → **Crear base de datos** → ubicación `eur3 (europe-west)` → **modo de producción**.
4. **Publica las reglas de seguridad** (imprescindible):
   - Opción A, en la consola: Firestore → **Reglas** → pega el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.
   - Opción B, con la CLI:
     ```bash
     cd aulora
     npx firebase login
     npx firebase use --add          # elige tu proyecto
     npm run deploy:rules
     ```
5. **Configuración del proyecto** (rueda dentada) → **Tus apps** → icono **Web `</>`** → registra la app con el nombre `Aulora` (sin Firebase Hosting). Copia los valores de `firebaseConfig`: `apiKey`, `authDomain`, `projectId`, `appId`, `storageBucket` y `messagingSenderId`.

> La `apiKey` de una app web de Firebase no es secreta: identifica el proyecto. Lo que protege tus datos son las reglas de seguridad y el inicio de sesión.

## 2. Probar en local

```bash
cd aulora
cp .env.example .env.local      # rellena los valores de firebaseConfig
npm install
npm run dev                     # http://localhost:3000
```

Entra en `/login` → **Crear una cuenta nueva**. Al registrarte se crean tu perfil y las categorías iniciales.

## 3. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), elige **Import Git Repository** y selecciona `pedrocarramolino/pedrocarramolino.github.io`.
2. En **Configure Project**:
   - **Root Directory:** `aulora` (importante: el resto del repositorio es tu portfolio).
   - **Framework Preset:** Next.js (se detecta solo).
   - **Environment Variables** (para *Production*, *Preview* y *Development*):

     | Nombre | Valor (de `firebaseConfig`) |
     | --- | --- |
     | `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
     | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` (p. ej. `aulora-xxxx.firebaseapp.com`) |
     | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
     | `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
     | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
     | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |

3. Pulsa **Deploy**. Al terminar tendrás una URL del tipo `https://aulora-xxxx.vercel.app`.
4. Vercel publica en producción la rama `main`: fusiona esta rama a `main` (o elige la rama en *Settings → Git*).
5. Si quieres que Vercel solo vuelva a desplegar cuando cambie la app, ve a **Settings → Build and Deployment → Ignored Build Step** y pon `git diff --quiet HEAD^ HEAD -- .`.

## 4. Autorizar el dominio en Firebase

En Firebase → **Authentication → Configuración → Dominios autorizados** → **Agregar dominio** → `aulora-xxxx.vercel.app` (y tu dominio propio si lo añades). Sin esto, el inicio de sesión desde la URL de Vercel falla.

Recomendado para una app privada:

1. Crea tu cuenta desde `/login`.
2. Después, en **Authentication → Configuración → Acciones del usuario**, desactiva **Habilitar la creación (registro)**. Así nadie más podrá registrarse. Aunque alguien lo intentara, las reglas le impedirían ver tus datos.
3. Opcional: en **Authentication → Plantillas** pon el idioma en español para el correo de recuperación de contraseña.

## 5. Usarla en iPhone y iPad como una app

Abre la URL en Safari → botón **Compartir** → **Añadir a pantalla de inicio**. Se abre a pantalla completa, con su icono y respetando el notch y la barra inferior.

---

## Pruebas

Las pruebas usan los **emuladores oficiales de Firebase** (necesitan Java 11 o superior) con las mismas reglas que en producción.

```bash
npm test                        # Pruebas unitarias (recurrencia, conflictos, fechas, estados)
npm run rules:test              # Reglas de seguridad de Firestore (9 casos)
npm run e2e:build && npm run e2e  # 31 escenarios E2E con Playwright (escritorio, iPhone, iPad)
```

`npm run e2e:build` compila la app con la configuración de `.env.e2e` (proyecto de demostración `demo-aulora` y emuladores) sin tocar tu `.env.local`.

Los escenarios E2E cubren: registro e inicio de sesión, alumnos (crear, duplicar, archivar), grupos, series recurrentes, conflictos, arrastrar clases, editar una sesión sin tocar la serie, tareas en línea y con formulario, estados, vista general, copiar semana sin duplicados, ficha de clase, seguimiento, buscador, filtros, persistencia, aislamiento entre profesores, tema oscuro, móvil (iPhone, sin desbordamientos) y tablet (iPad).

## Copias de seguridad

**Ajustes → Exportar mis datos** descarga un JSON con todos tus datos. Para copias automáticas en Firebase, consulta *Firestore → Recuperación ante desastres* (requiere el plan Blaze).
