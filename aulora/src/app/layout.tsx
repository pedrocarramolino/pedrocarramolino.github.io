import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from '@/components/layout/Providers';
import { themeScript } from '@/components/layout/theme';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Aulora', template: '%s · Aulora' },
  description: 'Gestión docente: alumnos, grupos, agenda y tareas semanales.',
  applicationName: 'Aulora',
  appleWebApp: { capable: true, title: 'Aulora', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // color de la barra de estado/navegación de Safari según el modo del sistema
  // (si el usuario fuerza claro u oscuro, theme.ts lo ajusta)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
