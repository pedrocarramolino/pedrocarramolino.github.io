/**
 * Cambia la URL (filtros, pestañas, semana…) sin pedir la página al servidor.
 * Next.js sincroniza useSearchParams con history.replaceState, así que la
 * pantalla se actualiza al instante y el botón «atrás» no se llena de pasos.
 */
export function replaceUrl(url: string) {
  window.history.replaceState(null, '', url);
}

type Router = { prefetch: (href: string, options?: never) => void };
/** Props para empezar a precargar una ficha al tocarla o pasar el ratón (antes del clic). */
export function prefetchOnIntent(router: Router, href: string) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    router.prefetch(href, { kind: 'full' } as never);
  };
  return { onPointerEnter: go, onTouchStart: go, onFocus: go };
}
