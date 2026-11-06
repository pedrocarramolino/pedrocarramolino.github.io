/** Requisitos mínimos de contraseña (se comprueban antes de enviarla a Firebase). */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Al menos 8 caracteres', test: (p: string) => p.length >= 8 },
  { id: 'letter', label: 'Al menos una letra', test: (p: string) => /\p{L}/u.test(p) },
  { id: 'number', label: 'Al menos un número', test: (p: string) => /\d/.test(p) },
] as const;

export function passwordIssues(p: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
}

export function isStrongEnough(p: string): boolean {
  return passwordIssues(p).length === 0;
}

/** Valida contraseña nueva + confirmación. Devuelve el mensaje de error o null. */
export function validateNewPassword(p: string, confirm: string): string | null {
  const issues = passwordIssues(p);
  if (issues.length) return `La contraseña no cumple los requisitos: ${issues.join(', ').toLowerCase()}.`;
  if (p !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}
