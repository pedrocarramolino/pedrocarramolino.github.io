'use client';
import { useId, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { Field, Input } from './controls';
import { cn } from './cn';
import { PASSWORD_RULES } from '@/lib/password';

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <Field label={label} error={error} htmlFor={id}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          aria-invalid={!!error}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}

/** Lista de requisitos que se marcan en verde a medida que se cumplen. */
export function PasswordChecklist({ password, confirm }: { password: string; confirm?: string }) {
  const items = [
    ...PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(password) })),
    ...(confirm !== undefined ? [{ id: 'match', label: 'Las dos contraseñas coinciden', ok: password.length > 0 && password === confirm }] : []),
  ];
  return (
    <ul className="space-y-1" aria-label="Requisitos de la contraseña">
      {items.map((it) => (
        <li key={it.id} className={cn('flex items-center gap-1.5 text-xs transition-colors', it.ok ? 'text-success' : 'text-muted')}>
          {it.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" />}
          <span>{it.label}</span>
          <span className="sr-only">{it.ok ? '(cumplido)' : '(pendiente)'}</span>
        </li>
      ))}
    </ul>
  );
}
