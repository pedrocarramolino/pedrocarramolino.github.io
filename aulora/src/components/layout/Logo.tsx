/**
 * Identidad de Aulora: un arco (la puerta del aula) que contiene un pentagrama
 * simplificado. Se dibuja con el color de acento.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 25V15a7 7 0 0 1 14 0v10" fill="none" stroke="var(--accent-fg)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12.5 18.5h7M12.5 22h7" stroke="var(--accent-fg)" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">Aulora</span>
    </span>
  );
}
