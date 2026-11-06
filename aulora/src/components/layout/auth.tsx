'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { firebaseAuth } from '@/lib/firebase';
import { profileApi } from '@/services/api';
import { LogoMark } from './Logo';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
const Ctx = createContext<AuthState>({ user: null, loading: true, error: null });

/**
 * Sesión de Firebase Auth. Al cambiar de usuario se vacía la caché de datos
 * y se crea el perfil (con las categorías iniciales) si es la primera vez.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });
  const lastUid = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let auth;
    try {
      auth = firebaseAuth();
    } catch (e) {
      setState({ user: null, loading: false, error: (e as Error).message });
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (lastUid.current !== (user?.uid ?? null)) {
        qc.clear();
        lastUid.current = user?.uid ?? null;
      }
      if (user) {
        try {
          const created = await profileApi.ensure(user.displayName ?? user.email?.split('@')[0] ?? '');
          if (created) qc.invalidateQueries();
        } catch {
          // sin conexión: se reintentará en el próximo inicio
        }
      }
      setState({ user, loading: false, error: null });
    });
  }, [qc]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

function Splash({ message }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="animate-pulse">
        <LogoMark size={44} />
      </div>
      {message ? <p className="max-w-md text-sm text-danger">{message}</p> : null}
    </div>
  );
}

/** Protege la zona privada: sin sesión, redirige a /login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && !error) {
      const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
      router.replace(next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login');
    }
  }, [loading, user, error, router, pathname]);

  if (error) return <Splash message={error} />;
  if (loading || !user) return <Splash />;
  return <>{children}</>;
}
