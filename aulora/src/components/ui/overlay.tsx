'use client';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './controls';
import { cn } from './cn';

let openCount = 0;
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    openCount++;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      openCount--;
      if (openCount === 0) document.documentElement.style.overflow = '';
    };
  }, [active]);
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/**
 * Diálogo modal. En pantallas pequeñas se muestra como hoja inferior;
 * en tablet/ordenador, centrado. `side` lo convierte en panel lateral.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  side?: boolean;
}) {
  const mounted = useMounted();
  const panel = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    // foco inicial: primer campo, o el panel
    requestAnimationFrame(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([type=checkbox]), textarea, select');
      if (el && window.matchMedia('(hover: hover)').matches) el.focus();
      else panel.current?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;
  const widths = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-black/30 backdrop-blur-[2px] dark:bg-black/50" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-surface shadow-lg outline-none',
          'animate-sheet-in rounded-t-2xl md:animate-pop-in md:rounded-xl',
          side ? 'md:animate-slide-in-right md:fixed md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[min(34rem,calc(100vw-1.5rem))] md:rounded-xl' : widths[size],
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong md:hidden" />
        {title ? (
          <div className="flex shrink-0 items-start gap-3 px-5 pt-4 pb-3 md:pt-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar" className="-mt-0.5 -mr-1">
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer ? (
          <div className="pb-safe flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

// ----------------------------------------------------------------- Confirmación
type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
};
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        {state?.description ? <div className="text-sm leading-relaxed text-fg-2">{state.description}</div> : null}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmCtx);
}

// ----------------------------------------------------------------- Menú desplegable
export interface MenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

export function Menu({
  trigger,
  items,
  align = 'end',
  className,
}: {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; 'aria-expanded': boolean }) => React.ReactNode;
  items: (MenuItem | 'separator')[];
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const mounted = useMounted();

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const w = 220;
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 4;
    const h = listRef.current?.offsetHeight ?? 200;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setPos({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        },
        'aria-expanded': open,
      })}
      {mounted && open
        ? createPortal(
            <div
              ref={listRef}
              role="menu"
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: 220 }}
              className="animate-pop-in fixed z-[60] rounded-xl border border-border bg-surface p-1 shadow-lg"
            >
              {items.map((it, i) =>
                it === 'separator' ? (
                  <div key={i} className="my-1 h-px bg-border" />
                ) : (
                  <button
                    key={i}
                    role="menuitem"
                    disabled={it.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      it.onSelect();
                    }}
                    className={cn(
                      'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors disabled:opacity-40',
                      it.danger ? 'text-danger hover:bg-danger-soft' : 'text-fg hover:bg-surface-2',
                    )}
                  >
                    {it.icon ? <it.icon className="size-4 shrink-0 opacity-70" /> : null}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.hint ? <span className="text-xs text-muted">{it.hint}</span> : null}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
