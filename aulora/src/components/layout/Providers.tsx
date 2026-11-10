'use client';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { localChanges, syncErrors, type LocalChange } from '@/services/api';
import { applyLocalChanges } from '@/hooks/local-changes';
import { ConfirmProvider } from '@/components/ui/overlay';
import { UiProvider } from './ui-store';
import { useTheme } from './theme';
import { AuthProvider } from './auth';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Firestore funciona sin conexión (caché y cola de envíos): no hay que pausar
          // consultas ni acciones cuando el dispositivo está offline
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'always' },
          mutations: { retry: 0, networkMode: 'always' },
        },
      }),
  );
  const { resolved } = useTheme();
  // escrituras guardadas en segundo plano que el servidor rechazó
  useEffect(() => {
    const on = (e: Event) => {
      toast.error(`No se pudo guardar en el servidor: ${(e as CustomEvent<Error>).detail.message}`);
      void client.invalidateQueries();
    };
    // cambios guardados en el dispositivo: se muestran al instante en todas las pantallas
    const onChange = (e: Event) => applyLocalChanges(client, (e as CustomEvent<LocalChange[]>).detail);
    syncErrors.addEventListener('error', on);
    localChanges.addEventListener('change', onChange);
    return () => {
      syncErrors.removeEventListener('error', on);
      localChanges.removeEventListener('change', onChange);
    };
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ConfirmProvider>
          <UiProvider>{children}</UiProvider>
        </ConfirmProvider>
      </AuthProvider>
      <Toaster
        position="bottom-center"
        theme={resolved}
        offset={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
        mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
        toastOptions={{ className: 'aulora-toast' }}
        closeButton={false}
      />
    </QueryClientProvider>
  );
}
