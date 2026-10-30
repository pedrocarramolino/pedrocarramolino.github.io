import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dateKey } from '../lib/dates';
import { goBack } from '../app/router';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// ---------- Marca ----------
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx('logo-mark', className)} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="116" className="logo-tile" />
      <rect x="132" y="128" width="64" height="256" rx="10" className="logo-bar" />
      <path d="M244 128 L380 256 L244 384" fill="none" className="logo-chevron" strokeWidth="64" strokeLinejoin="miter" strokeLinecap="butt" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark size={26} />
      <span>DRAXIVO</span>
    </span>
  );
}

// ---------- Estructura de página ----------
export function Page({
  title,
  subtitle,
  back,
  backLabel,
  actions,
  children,
  large = true,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('page', className)}>
      <header className={cx('page-header', back && 'with-back')}>
        {back ? (
          <div className="page-toolbar">
            <button className="back-btn" onClick={() => goBack(back)} aria-label={`Volver${backLabel ? ` a ${backLabel}` : ''}`}>
              <ChevronLeft size={26} strokeWidth={2.2} />
            </button>
            <h1 className={cx('page-title-inline', !large && 'small')}>{title}</h1>
            <div className="page-actions">{actions}</div>
          </div>
        ) : (
          <div className="page-toolbar page-toolbar-root">
            <h1 className="page-title">{title}</h1>
            <div className="page-actions">{actions}</div>
          </div>
        )}
        {subtitle && <p className={cx('page-subtitle', back && 'indented')}>{subtitle}</p>}
      </header>
      <div className="page-body">{children}</div>
    </div>
  );
}

/** Tarjeta blanca con esquinas redondeadas; pulsable si recibe onClick. */
export function Card({ children, onClick, className, ariaLabel }: { children: ReactNode; onClick?: () => void; className?: string; ariaLabel?: string }) {
  if (onClick)
    return (
      <button type="button" className={cx('card card-button', className)} onClick={onClick} aria-label={ariaLabel}>
        {children}
      </button>
    );
  return <div className={cx('card', className)}>{children}</div>;
}

/** Icono dentro de un cuadrado suave, como en los ajustes de iOS. */
export function IconTile({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'dark' }) {
  return <span className={cx('icon-tile', `icon-tile-${tone}`)}>{children}</span>;
}

/** Fila de selección con hoja de opciones (para ajustes tipo iOS). */
export function PickerRow<T extends string>({
  icon,
  title,
  value,
  options,
  onChange,
}: {
  icon?: ReactNode;
  title: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <>
      <Row icon={icon} title={title} value={cur?.label ?? '—'} onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="list" role="listbox" aria-label={title}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={cx('row row-button option-row', o.value === value && 'selected')}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="row-main">
                <span className="row-title">{o.label}</span>
              </span>
              {o.value === value && <Check size={20} className="option-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function Section({ title, action, children, footer, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section className={cx('section', className)}>
      {(title || action) && (
        <div className="section-head">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

export function List({ children, className, inset = true }: { children: ReactNode; className?: string; inset?: boolean }) {
  return <div className={cx('list', inset && 'list-inset', className)}>{children}</div>;
}

export function Row({
  icon,
  title,
  subtitle,
  value,
  onClick,
  chevron,
  children,
  className,
  danger,
  ariaLabel,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  children?: ReactNode;
  className?: string;
  danger?: boolean;
  ariaLabel?: string;
}) {
  const content = (
    <>
      {icon && <span className="row-icon">{icon}</span>}
      <span className="row-main">
        <span className={cx('row-title', danger && 'text-danger')}>{title}</span>
        {subtitle && <span className="row-subtitle">{subtitle}</span>}
      </span>
      {value != null && <span className="row-value">{value}</span>}
      {children}
      {(chevron ?? !!onClick) && <ChevronRight className="row-chevron" size={18} aria-hidden="true" />}
    </>
  );
  if (onClick && children) {
    // Evita botones anidados: la zona principal es pulsable y los controles quedan aparte.
    return (
      <div className={cx('row', 'row-split', className)}>
        <button type="button" className="row-split-main" onClick={onClick} aria-label={ariaLabel}>
          {icon && <span className="row-icon">{icon}</span>}
          <span className="row-main">
            <span className={cx('row-title', danger && 'text-danger')}>{title}</span>
            {subtitle && <span className="row-subtitle">{subtitle}</span>}
          </span>
          {value != null && <span className="row-value">{value}</span>}
        </button>
        {children}
      </div>
    );
  }
  if (onClick)
    return (
      <button type="button" className={cx('row', 'row-button', className)} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </button>
    );
  return <div className={cx('row', className)}>{content}</div>;
}

// ---------- Botones ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'plain' | 'danger' | 'tinted';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
};
export function Button({ variant = 'secondary', size = 'md', block, icon, className, children, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={cx('btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', className)} {...rest}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={cx('icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

// ---------- Controles ----------
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cx('segmented', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx('segment', o.value === value && 'active')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label className="row toggle-row" htmlFor={id}>
      <span className="row-main">
        <span className="row-title">{label}</span>
        {description && <span className="row-subtitle">{description}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Field({ label, children, hint, error }: { label: ReactNode; children: ReactNode; hint?: ReactNode; error?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} onFocus={(e) => { props.onFocus?.(e); keepVisible(e.currentTarget); }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx('input textarea', props.className)} onFocus={(e) => { props.onFocus?.(e); keepVisible(e.currentTarget); }} />;
}

interface Opt {
  value: string;
  label: ReactNode;
}

function collectOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ value?: string | number; children?: ReactNode }>;
    if (el.type === 'option') {
      const label = el.props.children;
      out.push({ value: el.props.value != null ? String(el.props.value) : String(label ?? ''), label });
    } else if (el.props.children) out.push(...collectOptions(el.props.children));
  });
  return out;
}

/**
 * Selector táctil propio: muestra el valor y abre una hoja con las opciones.
 * Mantiene la API de <select> (hijos <option>) para no cambiar las pantallas.
 */
export function Select({
  value,
  onChange,
  children,
  title,
  className,
  ...rest
}: { value: string | number | readonly string[] | undefined; onChange: (v: string) => void; children: ReactNode; title?: string; className?: string; 'aria-label'?: string; id?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const opts = collectOptions(children);
  const v = String(value ?? '');
  const current = opts.find((o) => o.value === v);
  const label = rest['aria-label'];
  return (
    <>
      <button
        type="button"
        className={cx('input select-btn', className)}
        aria-haspopup="dialog"
        aria-label={label ? `${label}: ${typeof current?.label === 'string' ? current.label : v}` : undefined}
        id={rest.id}
        disabled={rest.disabled}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <span className="select-value">{current?.label ?? '—'}</span>
        <ChevronDown size={18} aria-hidden="true" className="select-chevron" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? label ?? 'Seleccionar'}>
        <div className="list" role="listbox" aria-label={title ?? label}>
          {opts.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === v}
              className={cx('row row-button option-row', o.value === v && 'selected')}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="row-main">
                <span className="row-title">{o.label}</span>
              </span>
              {o.value === v && <Check size={20} className="option-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function todayKeyLocal() {
  return dateKey();
}

/** Selector de fecha con calendario propio (sustituye a <input type="date">). */
export function DateInput({
  value,
  onChange,
  min,
  max,
  placeholder = 'Elegir fecha',
  clearable,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value || todayKeyLocal());
  const first = month.slice(0, 8) + '01';
  const [y, m] = first.split('-').map(Number);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const t = todayKeyLocal();
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 10));
  };
  const fmt = (k: string) => {
    const [yy, mm, dd] = k.split('-').map(Number);
    return `${dd} ${MONTHS_ES[mm - 1].slice(0, 3)} ${yy}`;
  };
  return (
    <>
      <button
        type="button"
        className="input select-btn"
        aria-haspopup="dialog"
        aria-label={label ? `${label}: ${value ? fmt(value) : placeholder}` : undefined}
        onClick={(e) => {
          e.preventDefault();
          setMonth(value || t);
          setOpen(true);
        }}
      >
        <span className={cx('select-value', !value && 'muted')}>{value ? fmt(value) : placeholder}</span>
        <CalendarDays size={18} aria-hidden="true" className="select-chevron" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? 'Fecha'}>
        <div className="cal">
          <div className="cal-head">
            <IconButton label="Mes anterior" onClick={() => shift(-1)}>
              <ChevronLeft size={20} />
            </IconButton>
            <h3>
              {MONTHS_ES[m - 1]} {y}
            </h3>
            <IconButton label="Mes siguiente" onClick={() => shift(1)}>
              <ChevronRight size={20} />
            </IconButton>
          </div>
          <div className="cal-grid">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
              <div key={d} className="cal-wd">
                {d}
              </div>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={'e' + i} />
            ))}
            {Array.from({ length: daysIn }, (_, i) => {
              const k = `${first.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
              const disabled = (!!max && k > max) || (!!min && k < min);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  className={cx('cal-day', k === t && 'today', k === value && 'selected', disabled && 'other')}
                  aria-label={fmt(k)}
                  aria-pressed={k === value}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                >
                  <span>{i + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="btn-row mt">
          {(!max || t <= max) && (
            <Button
              variant="tinted"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
            >
              Hoy
            </Button>
          )}
          {clearable && value && (
            <Button
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Borrar fecha
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}

/** Selector en rueda (scroll-snap) para valores numéricos, accesible con teclado. */
export function WheelPicker({
  value,
  onChange,
  min,
  max,
  step,
  format,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM = 40;
  const count = Math.round((max - min) / step) + 1;
  const idx = Math.max(0, Math.min(count - 1, Math.round((value - min) / step)));
  const settle = useRef<number | null>(null);
  const userScroll = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || userScroll.current) return;
    el.scrollTop = idx * ITEM;
  }, [idx]);
  const valAt = (i: number) => Math.round((min + i * step) * 1000) / 1000;
  return (
    <div className="wheel">
      <div className="wheel-highlight" aria-hidden="true" />
      <div
        ref={ref}
        className="wheel-scroll"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valAt(idx)}
        aria-valuetext={format(valAt(idx))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(valAt(Math.max(0, idx - 1)));
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(valAt(Math.min(count - 1, idx + 1)));
          }
        }}
        onScroll={(e) => {
          userScroll.current = true;
          const top = e.currentTarget.scrollTop;
          if (settle.current) window.clearTimeout(settle.current);
          settle.current = window.setTimeout(() => {
            userScroll.current = false;
            const i = Math.max(0, Math.min(count - 1, Math.round(top / ITEM)));
            if (i !== idx) onChange(valAt(i));
          }, 90);
        }}
      >
        <div style={{ height: ITEM * 2 }} />
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={cx('wheel-item', i === idx && 'active')} style={{ height: ITEM }} onClick={() => onChange(valAt(i))}>
            {format(valAt(i))}
          </div>
        ))}
        <div style={{ height: ITEM * 2 }} />
      </div>
    </div>
  );
}

/** Mantiene visible el campo con foco cuando aparece el teclado virtual. */
export function keepVisible(el: HTMLElement) {
  window.setTimeout(() => {
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* navegador antiguo */
    }
  }, 300);
}

/** Campo numérico con teclado decimal y aceptación de coma. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  decimals = true,
  className,
  ariaLabel,
  min,
  max,
  id,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimals?: boolean;
  className?: string;
  ariaLabel?: string;
  min?: number;
  max?: number;
  id?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : String(value).replace('.', ','));
  }, [value]);
  return (
    <input
      id={id}
      className={cx('input num-input', className)}
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
        keepVisible(e.currentTarget);
      }}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? '' : String(value).replace('.', ','));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(decimals ? /[^0-9.,]/g : /[^0-9]/g, '');
        setText(raw);
        const t = raw.replace(',', '.');
        if (t === '') return onChange(null);
        const n = Number(t);
        if (!Number.isFinite(n)) return;
        if (min != null && n < min) return;
        if (max != null && n > max) return;
        onChange(n);
      }}
    />
  );
}

// ---------- Hoja modal ----------
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  action,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'full';
  /** Cabecera estilo iOS: «Cancelar · Título · Acción». */
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Las pantallas pasan un onClose nuevo en cada render. Se guarda en una referencia para que
  // el efecto de apertura dependa sólo de `open`: si dependiera de onClose, cada pulsación de
  // teclado en un campo de la hoja re-ejecutaría el efecto, devolvería el foco al elemento
  // anterior y cerraría el teclado en iOS.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add('sheet-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      const panel = ref.current;
      // No roba el foco si el usuario ya está escribiendo dentro de la hoja.
      if (!panel || panel.contains(document.activeElement)) return;
      (panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel).focus({ preventScroll: true });
    }, 30);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      if (!document.querySelector('.sheet-panel')) document.body.classList.remove('sheet-open');
      if (prev && prev.isConnected) prev.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={ref} className={cx('sheet-panel', `sheet-${size}`)} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet-grabber" aria-hidden="true" />
        {action ? (
          <div className="sheet-header sheet-header-ios">
            <button type="button" className="sheet-nav-btn" onClick={onClose}>
              Cancelar
            </button>
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
            <button type="button" className="sheet-nav-btn strong" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </button>
          </div>
        ) : (
          <div className="sheet-header">
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
            <IconButton label="Cerrar" onClick={onClose} className="sheet-close">
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Confirmación ----------
interface ConfirmOpts {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
const ConfirmCtx = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state &&
        createPortal(
          <div className="alert-root">
            <div className="sheet-backdrop" onClick={() => close(false)} />
            <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
              <h2 id="alert-title" className="alert-title">
                {state.title}
              </h2>
              {state.message && <div className="alert-message">{state.message}</div>}
              <div className="alert-actions">
                <button className="alert-btn" onClick={() => close(false)} autoFocus>
                  {state.cancelLabel ?? 'Cancelar'}
                </button>
                <button className={cx('alert-btn', 'alert-btn-strong', state.destructive && 'text-danger')} onClick={() => close(true)}>
                  {state.confirmLabel ?? 'Aceptar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('ConfirmProvider ausente');
  return c;
}

// ---------- Menú de acciones ----------
export interface MenuAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  hidden?: boolean;
}

export function ActionMenu({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title: string; actions: MenuAction[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <List>
        {actions
          .filter((a) => !a.hidden)
          .map((a) => (
            <button
              key={a.label}
              type="button"
              className={cx('row row-button menu-item', a.destructive && 'text-danger')}
              onClick={() => {
                onClose();
                a.onSelect();
              }}
            >
              {a.icon && <span className="row-icon">{a.icon}</span>}
              <span className="row-main">
                <span className="row-title">{a.label}</span>
              </span>
            </button>
          ))}
      </List>
    </Sheet>
  );
}

// ---------- Estados y cifras ----------
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3 className="empty-title">{title}</h3>
      {text && <p className="empty-text">{text}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, sub, tone }: { label: ReactNode; value: ReactNode; unit?: ReactNode; sub?: ReactNode; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </span>
      {sub && <span className={cx('stat-sub', tone && `tone-${tone}`)}>{sub}</span>}
    </div>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: 'blue' | 'neutral' | 'warn' }) {
  return <span className={cx('tag', tone && `tag-${tone}`)}>{children}</span>;
}

export function Loading() {
  return (
    <div className="loading" aria-busy="true" aria-live="polite">
      <span className="spinner" />
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="progress-fill" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Scale({ value, onChange, label, low, high }: { value: number | null; onChange: (v: number | null) => void; label: string; low: string; high: string }) {
  return (
    <div className="scale">
      <div className="scale-label">{label}</div>
      <div className="scale-buttons" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} className={cx('scale-btn', value === n && 'active')} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="scale-ends">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Control − valor + para ajustar números con el dedo. */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, label, format }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; format?: (v: number) => string }) {
  return (
    <div className="stepper-ctl" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Reducir ${label}`}>
        −
      </button>
      <output className="stepper-value" aria-live="polite">
        {format ? format(value) : value}
      </output>
      <button type="button" className="stepper-btn" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`Aumentar ${label}`}>
        +
      </button>
    </div>
  );
}
