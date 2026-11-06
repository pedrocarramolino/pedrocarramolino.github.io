'use client';
import { createContext, forwardRef, useContext, useId } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'icon' | 'icon-sm';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface text-fg border border-border hover:bg-surface-2 shadow-sm',
  ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg',
  subtle: 'bg-surface-2 text-fg hover:bg-surface-3',
  danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md',
};

/** Clases de botón para usar en enlaces (<Link className={buttonStyles(...)} />). */
export function buttonStyles(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100',
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonStyles(variant, size, className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

/** Id del campo actual: enlaza <label> con el control aunque no se pase htmlFor. */
const FieldCtx = createContext<string | undefined>(undefined);

/** Ancho completo salvo que se indique otro ancho en className. */
const widthFor = (className?: string) => (/(^|\s)w-/.test(className ?? '') ? '' : 'w-full');
const fieldBase =
  'rounded-lg border border-border bg-surface px-3 text-fg placeholder:text-muted shadow-sm transition-[border-color,box-shadow] outline-none focus:border-accent focus:ring-3 focus:ring-[var(--ring)] disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  const fieldId = useContext(FieldCtx);
  return <input ref={ref} id={fieldId} className={cn(fieldBase, widthFor(className), 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    const fieldId = useContext(FieldCtx);
    return <textarea ref={ref} id={fieldId} rows={rows} className={cn(fieldBase, widthFor(className), 'py-2 leading-relaxed resize-y', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  const fieldId = useContext(FieldCtx);
  return (
    <select
      ref={ref}
      id={fieldId}
      className={cn(
        fieldBase,
        widthFor(className),
        "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237b7b82%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.6rem_center] bg-no-repeat pr-8",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg-2">
        {label}
      </label>
      <FieldCtx.Provider value={id}>{children}</FieldCtx.Provider>
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Campo con etiqueta e id generado automáticamente. */
export function LabeledInput({ label, hint, error, ...props }: { label: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <Input id={id} aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function Badge({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      style={style}
      className={cn('inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap', className ?? 'bg-surface-2 text-fg-2')}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-muted', className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-lg bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          title={o.title}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 font-medium transition-all duration-150',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer rounded border-border accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

/** Normaliza lo tecleado en un campo numérico: solo dígitos y sin ceros a la izquierda. */
export function cleanDigits(raw: string, maxLength = 4): string {
  return raw
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, maxLength);
}

/**
 * Campo numérico que se puede vaciar mientras se escribe (sin quedarse en «0»
 * ni producir «045»). Devuelve null cuando está vacío; la validación del
 * rango se hace al guardar.
 */
export const NumberInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
    value: number | null;
    onValueChange: (v: number | null) => void;
    maxLength?: number;
  }
>(function NumberInput({ value, onValueChange, maxLength = 4, ...rest }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={value === null || Number.isNaN(value) ? '' : String(value)}
      onChange={(e) => {
        const t = cleanDigits(e.target.value, maxLength);
        onValueChange(t === '' ? null : Number(t));
      }}
      {...rest}
    />
  );
});

/** Comprueba un valor numérico obligatorio dentro de un rango. Devuelve el error o null. */
export function rangeError(v: number | null, min: number, max: number, what: string): string | null {
  if (v === null || Number.isNaN(v)) return `Indica ${what}.`;
  if (v < min || v > max) return `${what.charAt(0).toUpperCase() + what.slice(1)} debe estar entre ${min} y ${max}.`;
  return null;
}
