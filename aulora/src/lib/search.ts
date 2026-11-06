/** Normaliza texto para búsquedas sin tildes ni mayúsculas. */
export function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** ¿Contiene el texto todas las palabras de la consulta? */
export function matches(haystack: string, query: string): boolean {
  const h = norm(haystack);
  return norm(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => h.includes(w));
}

/** Término seguro para filtros ilike de PostgREST (solo la palabra más larga, sin tildes problemáticas). */
export function serverTerm(query: string): string {
  const words = query
    .replace(/[,()*%\\.:"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return words[0] ?? '';
}
