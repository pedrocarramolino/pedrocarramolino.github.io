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
  // La etiqueta theme-color (barra de estado de iOS) la gestiona theme.ts:
  // se crea antes del primer pintado y se sustituye en cada cambio de tema,
  // porque iOS no repinta la barra si solo cambia su valor.
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
