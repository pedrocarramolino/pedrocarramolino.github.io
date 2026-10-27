import {
  createContext,
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
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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
        <div className="page-toolbar">
          {back ? (
            <button className="back-btn" onClick={() => goBack(back)} aria-label={`Volver${backLabel ? ` a ${backLabel}` : ''}`}>
              <ChevronLeft size={22} strokeWidth={2.2} />
              <span>{backLabel ?? 'Atrás'}</span>
            </button>
          ) : (
            <span />
          )}
          <div className="page-actions">{actions}</div>
        </div>
        {large ? <h1 className="page-title">{title}</h1> : <h1 className="page-title page-title-small">{title}</h1>}
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </header>
      <div className="page-body">{children}</div>
    </div>
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

export function Select({ value, onChange, children, ...rest }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & { onChange: (v: string) => void }) {
  return (
    <select className="input select" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {children}
    </select>
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
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'full';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add('sheet-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? ref.current?.focus(), 30);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (!document.querySelector('.sheet-panel')) document.body.classList.remove('sheet-open');
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-root">
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={ref} className={cx('sheet-panel', `sheet-${size}`)} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-header">
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose} className="sheet-close">
            <X size={18} />
          </IconButton>
        </div>
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
