/** Texto en minúsculas y sin tildes, para búsquedas. */
export function normalize(s: string) {
  return s
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
