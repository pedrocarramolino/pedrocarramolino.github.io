'use client';
import Link from 'next/link';
import { cn } from './cn';
import { colorFor, cvar } from '@/lib/colors';

export function Avatar({
  name,
  photo,
  color,
  size = 32,
  square = false,
  className,
}: {
  name: string;
  photo?: string | null;
  color?: string | null;
  size?: number;
  square?: boolean;
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '·';
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38), ...cvar(color || colorFor(name)) };
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" style={style} className={cn('shrink-0 object-cover', square ? 'rounded-lg' : 'rounded-full', className)} />;
  }
  return (
    <span
      style={style}
      aria-hidden
      className={cn('tint-strong inline-flex shrink-0 items-center justify-center font-semibold tracking-tight', square ? 'rounded-lg' : 'rounded-full', className)}
    >
      {initials}
    </span>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface shadow-sm', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  icon: Icon,
  action,
  className,
  count,
}: {
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  count?: number;
}) {
  return (
    <div className={cn('flex items-center gap-2 px-4 pt-3.5 pb-2', className)}>
      {Icon ? <Icon className="size-4 text-muted" /> : null}
      <h2 className="text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
      {count !== undefined ? <span className="text-xs text-muted tabular-nums">{count}</span> : null}
      <div className="ml-auto flex items-center gap-1">{action}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5 px-4 py-6' : 'gap-3 px-6 py-14', className)}>
      {Icon ? (
        <div className={cn('flex items-center justify-center rounded-xl bg-surface-2 text-muted', compact ? 'size-9' : 'size-12')}>
          <Icon className={compact ? 'size-4' : 'size-5'} />
        </div>
      ) : null}
      <div>
        <p className={cn('font-medium text-fg', compact ? 'text-sm' : 'text-[15px]')}>{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight md:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  hrefFor,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  hrefFor?: (v: T) => string;
  onChange?: (v: T) => void;
}) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0" role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        const cls = cn(
          'relative -mb-px flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium whitespace-nowrap transition-colors',
          active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
        );
        const content = (
          <>
            {t.label}
            {t.count !== undefined ? <span className="text-xs text-muted tabular-nums">{t.count}</span> : null}
          </>
        );
        return hrefFor ? (
          <Link key={t.value} href={hrefFor(t.value)} replace scroll={false} role="tab" aria-selected={active} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={t.value} role="tab" aria-selected={active} className={cls} onClick={() => onChange?.(t.value)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

export function ColorDot({ color, className }: { color?: string | null; className?: string }) {
  return <span style={cvar(color)} className={cn('dot inline-block size-2 shrink-0 rounded-full', className)} />;
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-xs text-muted">{hint}</div> : null}
    </>
  );
  const cls = 'block rounded-xl border border-border bg-surface px-4 py-3.5 shadow-sm transition-colors';
  return href ? (
    <Link href={href} className={cn(cls, 'hover:border-border-strong')}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color ?? 'var(--accent)' }}
      />
    </div>
  );
}
