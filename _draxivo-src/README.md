# DRAXIVO

*Train with purpose.* Aplicación web (PWA) para registrar entrenamientos, gestionar rutinas, controlar el peso corporal y analizar el progreso. Gratuita, sin cuenta, sin anuncios y sin límites artificiales. Los datos se guardan sólo en el dispositivo (IndexedDB).

## Funcionalidades

- **Inicio**: resumen de la semana (sesiones/objetivo, días entrenados, tiempo, volumen), último peso y variación semanal, última sesión, próxima rutina planificada y estado de la revisión semanal.
- **Rutinas**: ilimitadas, con carpetas, búsqueda, categorías, duplicar, variantes, plantillas (propias e incluidas), archivar, eliminar (el historial se conserva), copiar ejercicios entre rutinas, reordenar (arrastrar o flechas), series de calentamiento/descendentes/al fallo, rangos de repeticiones, carga objetivo, RPE/RIR, descanso por ejercicio y superseries.
- **Biblioteca**: ~115 ejercicios en 14 grupos musculares y 7 tipos de equipamiento; ejercicios personalizados ilimitados. Tipos de registro: peso y reps, lastre, asistido, sólo reps, duración, distancia y duración.
- **Entrenamiento activo**: cronómetro con pausa, valores de la sesión anterior (toca para copiarlos), volumen en vivo, añadir/eliminar/reordenar/sustituir ejercicios, notas, deshacer, recuperación tras recarga o cierre, temporizador de descanso basado en marcas de tiempo reales (±15 s, pausa, reinicio, sonido y vibración).
- **Resumen e historial**: duración, series, reps, volumen, récords personales, comparación con la sesión anterior; calendario, filtros por fecha/rutina/ejercicio, búsqueda, edición y comparación de sesiones.
- **Estadísticas**: periodos de 7/30/90 días, 1 año, todo o rango; entrenamientos y volumen por semana/mes, series por grupo muscular, consistencia; por ejercicio: 1RM estimado (Epley, 1–12 reps), peso máximo, volumen y repeticiones.
- **Peso corporal**: registros con fecha/hora/nota, corrección, tendencia (media 7 días), variación semanal/mensual, comparación de periodos y objetivo opcional.
- **Medidas y fotos**: 9 medidas y fotos privadas con comparación por fechas.
- **Revisión semanal**: 5 pasos (resumen, evolución, valoración, conclusiones, guardar) con instantánea de métricas, borradores recuperables, historial y comparación.
- **Planificación**: rutinas por día, descansos, reprogramación, objetivo semanal y planificado frente a realizado.
- **Progresión de cargas**: sugerencias explicadas que se aceptan, modifican o ignoran; nunca se aplican solas.
- **Datos**: copia JSON completa (fotos opcionales), CSV por tipo de dato, importación validada, atómica y sin duplicados, borrado total.
- **PWA**: instalable, funciona sin conexión, avisa de nuevas versiones.

## Diseño

Interfaz de app nativa para iPhone: fondo gris muy claro, tarjetas blancas, texto carbón y acentos azul grisáceo; tema oscuro equivalente. Columna de ancho móvil (máx. 480 px) también en escritorio, barra inferior fija con Inicio, Entrenar, Rutinas, Progreso y Perfil.

- Sin controles nativos del navegador: los desplegables se sustituyen por hojas inferiores (`Select`, `PickerRow`), las fechas por un calendario propio (`DateInput`) y el peso se elige con un selector en rueda (`WheelPicker`).
- Ilustraciones SVG locales y consistentes para cada ejercicio (`src/ui/ExerciseArt.tsx`), dibujadas con primitivas comunes y colores del tema. Sin imágenes externas.
- Entrenamiento activo en modo «un ejercicio por pantalla» (las superseries se muestran juntas), con vista de lista opcional, tarjeta de descanso con temporizador circular y botones fijos «Añadir serie» y «Completar serie».

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas unitarias (Vitest + fake-indexeddb)
npm run build      # comprobación de tipos + build en dist/
npm run e2e        # pruebas end-to-end con Playwright sobre el build
npm run icons      # regenera los iconos PNG desde el SVG
npm run shots      # capturas de revisión visual con datos de ejemplo (añade «oscuro» para el tema oscuro)
```

## Publicación

### Vercel

El proyecto incluye `vercel.json` (Vite, `npm ci`, `npm run build`, salida `dist/`, cabeceras de caché para el service worker y los recursos con hash, y reescritura de rutas a `index.html`).

1. En Vercel: **Add New → Project** e importa el repositorio `pedrocarramolino/pedrocarramolino.github.io`.
2. En **Root Directory** elige `_draxivo-src`.
3. Deja el resto como lo detecta `vercel.json` y pulsa **Deploy**.
4. Dominio propio (opcional): **Settings → Domains → Add** y crea en tu proveedor DNS el registro que indique Vercel (normalmente `CNAME` a `cname.vercel-dns.com` para un subdominio, o `A` a `76.76.21.21` para el dominio raíz).

**Variables de entorno:** ninguna. La aplicación no usa backend ni claves; todos los datos se guardan en el navegador.

### GitHub Pages

`dist/` es un sitio estático con rutas relativas (`base: './'`) y enrutado por hash, así que funciona en cualquier subcarpeta de cualquier alojamiento estático (GitHub Pages, Netlify, Vercel, Cloudflare Pages) sin reescrituras. Para GitHub Pages basta con copiar el contenido de `dist/` en la carpeta publicada.

## Arquitectura

- `src/db/`: tipos, IndexedDB versionada con migraciones (`idb`), repositorio, plantillas y copias de seguridad.
- `src/domain/`: cálculos puros (métricas, peso, revisiones, progresión) y esquemas de validación (`zod`).
- `src/ui/`: componentes, gráficas SVG y lista reordenable.
- `src/screens/`: pantallas.
- `sw-template.js`: service worker generado en el build con la lista de recursos y versión.

## Limitaciones conocidas

- Sin sincronización entre dispositivos ni copia en la nube: el traspaso se hace exportando e importando el JSON.
- Si se borran los datos del navegador se pierden los datos sin copia. En iOS, Safari puede borrar el almacenamiento de webs no instaladas que no se usen durante semanas; instalarla en la pantalla de inicio reduce el riesgo.
- Los avisos de fin de descanso sólo suenan con la app en primer plano; en iPhone no hay vibración (Safari no la permite).
