/** Paleta de colores identificativos para alumnos, grupos y categorías. */
export const COLORS: Record<string, { label: string; hex: string }> = {
  indigo: { label: 'Índigo', hex: '#5562e0' },
  sky: { label: 'Cielo', hex: '#2f8fd6' },
  teal: { label: 'Turquesa', hex: '#1f9a8a' },
  emerald: { label: 'Esmeralda', hex: '#2e9a5c' },
  lime: { label: 'Lima', hex: '#77a11c' },
  amber: { label: 'Ámbar', hex: '#d08b12' },
  orange: { label: 'Naranja', hex: '#e06a2b' },
  rose: { label: 'Rosa', hex: '#d9486a' },
  pink: { label: 'Fucsia', hex: '#c74ab3' },
  violet: { label: 'Violeta', hex: '#8657d8' },
  slate: { label: 'Pizarra', hex: '#6b7280' },
};

export const COLOR_KEYS = Object.keys(COLORS);

export function colorHex(key: string | null | undefined): string {
  return COLORS[key ?? '']?.hex ?? COLORS.slate.hex;
}

/** Estilo inline para las utilidades .tint / .dot. */
export function cvar(key: string | null | undefined): React.CSSProperties {
  return { ['--c' as string]: colorHex(key) } as React.CSSProperties;
}

/** Color estable a partir de un texto (para alumnos sin color elegido). */
export function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const keys = COLOR_KEYS.filter((k) => k !== 'slate');
  return keys[h % keys.length];
}
