'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarPlus, CheckSquare, MoreHorizontal, Plus, Search, UserPlus, UsersRound } from 'lucide-react';
import { Logo, LogoMark } from './Logo';
import { NAV, isActive } from './nav';
import { useUi } from './ui-store';
import { CommandPalette } from './CommandPalette';
import { SyncBanner } from './SyncBanner';
import { Button, Kbd } from '@/components/ui/controls';
import { Dialog, Menu } from '@/components/ui/overlay';
import { cn } from '@/components/ui/cn';
import { StudentForm } from '@/components/students/StudentForm';
import { GroupForm } from '@/components/groups/GroupForm';
import { LessonForm } from '@/components/agenda/LessonForm';
import { TaskForm } from '@/components/tasks/TaskForm';

function QuickCreate({ compact = false }: { compact?: boolean }) {
  const ui = useUi();
  return (
    <Menu
      trigger={(p) =>
        compact ? (
          <Button variant="primary" size="icon" aria-label="Crear" {...p}>
            <Plus className="size-5" />
          </Button>
        ) : (
          <Button variant="primary" size="md" {...p}>
            <Plus className="size-4" /> Crear
          </Button>
        )
      }
      items={[
        { label: 'Tarea', icon: CheckSquare, onSelect: () => ui.openTask(), hint: 'T' },
        { label: 'Clase', icon: CalendarPlus, onSelect: () => ui.openLesson(), hint: 'C' },
        { label: 'Alumno', icon: UserPlus, onSelect: () => ui.openStudent(), hint: 'A' },
        { label: 'Grupo', icon: UsersRound, onSelect: () => ui.openGroup(), hint: 'G' },
      ]}
    />
  );
}

function ModalHost() {
  const { modal, close } = useUi();
  if (!modal) return null;
  switch (modal.kind) {
    case 'student':
      return <StudentForm student={modal.student} onClose={close} />;
    case 'group':
      return <GroupForm group={modal.group} onClose={close} />;
    case 'lesson':
      return <LessonForm draft={modal.draft} onClose={close} />;
    case 'task':
      return <TaskForm draft={modal.draft} onClose={close} />;
    case 'palette':
      return <CommandPalette onClose={close} />;
  }
}

/** Atajos de teclado globales: ⌘K buscar · T tarea · C clase · A alumno · G grupo. */
function useShortcuts() {
  const ui = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.openPalette();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || ui.modal) return;
      const k = e.key.toLowerCase();
      if (k === 't') ui.openTask();
      else if (k === 'c') ui.openLesson();
      else if (k === 'a') ui.openStudent();
      else if (k === 'g') ui.openGroup();
      else if (k === '/') {
        e.preventDefault();
        ui.openPalette();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ui = useUi();
  const [more, setMore] = useState(false);
  useShortcuts();
  useEffect(() => setMore(false), [pathname]);

  const mobileMain = NAV.filter((n) => ['/', '/agenda', '/tareas', '/alumnos'].includes(n.href));
  const mobileMore = NAV.filter((n) => !['/', '/agenda', '/tareas', '/alumnos'].includes(n.href));
  const moreActive = mobileMore.some((n) => isActive(pathname, n.href)) || pathname.startsWith('/buscar');

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral (tablet: iconos · ordenador: completa) */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface/60 md:flex md:w-[68px] lg:w-60">
        <div className="flex h-14 items-center px-4 lg:px-5">
          <Link href="/" className="lg:hidden" aria-label="Aulora">
            <LogoMark size={30} />
          </Link>
          <Link href="/" className="hidden lg:block">
            <Logo />
          </Link>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={ui.openPalette}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm text-muted shadow-sm transition-colors hover:text-fg lg:justify-start"
            aria-label="Buscar"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 text-left lg:inline">Buscar</span>
            <span className="hidden lg:inline">
              <Kbd>⌘K</Kbd>
            </span>
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                className={cn(
                  'flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors lg:h-9 lg:justify-start',
                  active ? 'bg-surface-3/70 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                  n.href === '/ajustes' && 'mt-auto',
                )}
              >
                <n.icon className={cn('size-[18px] shrink-0', active ? 'text-accent' : 'opacity-80')} />
                <span className="hidden lg:inline">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="h-3" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="pt-safe sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-4 md:px-6">
            <Link href="/" className="md:hidden">
              <Logo />
            </Link>
            <span className="hidden text-[17px] font-semibold tracking-tight md:inline lg:hidden">Aulora</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={ui.openPalette} aria-label="Buscar">
                <Search className="size-5" />
              </Button>
              <div className="md:hidden">
                <QuickCreate compact />
              </div>
              <div className="hidden md:block">
                <QuickCreate />
              </div>
            </div>
          </div>
          {/* aviso de sincronización: dentro de la cabecera fija para que se vea siempre */}
          <SyncBanner />
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-28 md:px-6 md:pt-7 md:pb-12">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl md:hidden" aria-label="Navegación principal">
        <div className="grid h-16 grid-cols-5">
          {mobileMain.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link key={n.href} href={n.href} className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-accent' : 'text-muted')}>
                <n.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {n.label}
              </Link>
            );
          })}
          <button onClick={() => setMore(true)} className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-medium', moreActive ? 'text-accent' : 'text-muted')}>
            <MoreHorizontal className="size-[22px]" />
            Más
          </button>
        </div>
      </nav>
      <Dialog open={more} onClose={() => setMore(false)} title="Más">
        <div className="grid gap-1">
          {mobileMore.map((n) => (
            <Link key={n.href} href={n.href} className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-surface-2">
              <n.icon className="size-5 text-muted" />
              {n.label}
            </Link>
          ))}
          <Link href="/buscar" className="flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium hover:bg-surface-2">
            <Search className="size-5 text-muted" />
            Búsqueda avanzada
          </Link>
        </div>
      </Dialog>

      <ModalHost />
    </div>
  );
}
