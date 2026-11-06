import { CalendarDays, CheckSquare, Home, LineChart, Settings, Users, UsersRound } from 'lucide-react';

export const NAV = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/alumnos', label: 'Alumnos', icon: Users },
  { href: '/grupos', label: 'Grupos', icon: UsersRound },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare },
  { href: '/seguimiento', label: 'Seguimiento', icon: LineChart },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/agenda' && pathname.startsWith('/clases')) return true;
  return pathname === href || pathname.startsWith(href + '/');
}
