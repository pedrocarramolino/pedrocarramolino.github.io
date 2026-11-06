'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '@/components/ui/overlay';
import { UiProvider } from './ui-store';
import { useTheme } from './theme';
import { AuthProvider } from './auth';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  );
  const { resolved } = useTheme();
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
