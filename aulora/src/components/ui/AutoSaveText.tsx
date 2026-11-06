'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Textarea } from './controls';
import { cn } from './cn';

/**
 * Área de texto con guardado automático (al dejar de escribir y al salir).
 * Muestra el estado: guardando / guardado / error.
 */
export function AutoSaveText({
  value,
  onSave,
  label,
  placeholder,
  rows = 3,
  className,
}: {
  value: string;
  onSave: (v: string) => Promise<unknown>;
  label: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);

  // sincroniza si cambia desde fuera y no se está editando
  useEffect(() => {
    if (!focused.current && value !== saved.current) {
      setText(value);
      saved.current = value;
    }
  }, [value]);

  const flush = async (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (v === saved.current) return;
    setState('saving');
    try {
      await onSave(v);
      saved.current = v;
      setState('saved');
    } catch {
      setState('error');
    }
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-medium text-fg-2">{label}</label>
        <span className="flex items-center gap-1 text-[11px] text-muted" aria-live="polite">
          {state === 'saving' ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Guardando
            </>
          ) : state === 'saved' ? (
            <>
              <Check className="size-3 text-success" /> Guardado
            </>
          ) : state === 'error' ? (
            <span className="text-danger">No se pudo guardar · reintenta</span>
          ) : null}
        </span>
      </div>
      <Textarea
        value={text}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setState('idle');
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => flush(v), 900);
        }}
        onBlur={() => {
          focused.current = false;
          flush(text);
        }}
      />
    </div>
  );
}
