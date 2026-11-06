'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button, LabeledInput } from '@/components/ui/controls';
import { Logo } from '@/components/layout/Logo';

type Mode = 'signin' | 'signup' | 'reset';

function translate(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/Email not confirmed/i.test(msg)) return 'Confirma tu correo antes de entrar: revisa tu bandeja de entrada.';
  if (/already registered|already exists/i.test(msg)) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (/at least 6|weak/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/signups not allowed|Signups not allowed/i.test(msg)) return 'El registro de nuevas cuentas está desactivado.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';
  if (/fetch/i.test(msg)) return 'No hay conexión con el servidor.';
  return msg;
}

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error') === 'enlace' ? 'El enlace no es válido o ha caducado.' : null);
  const [sent, setSent] = useState<string | null>(null);

  const next = (() => {
    const n = params.get('next');
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
  })();
  const origin = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = supabase().auth;
      if (mode === 'signin') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.assign(next);
        return;
      }
      if (mode === 'signup') {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign('/');
          return;
        }
        setSent('Te hemos enviado un correo para confirmar tu cuenta. Ábrelo desde este dispositivo y volverás a Aulora.');
      }
      if (mode === 'reset') {
        const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin}/auth/callback?next=/ajustes?recuperar=1` });
        if (error) throw error;
        setSent('Si existe una cuenta con ese correo, recibirás un enlace para elegir una nueva contraseña.');
      }
    } catch (err) {
      setError(translate((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Logo />
        <p className="text-sm text-muted">Tu centro de organización como profesor.</p>
      </div>
      <div className="animate-pop-in rounded-2xl border border-border bg-surface p-6 shadow">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success">
              <MailCheck className="size-5" />
            </div>
            <p className="text-sm text-fg-2">{sent}</p>
            <Button
              variant="ghost"
              onClick={() => {
                setSent(null);
                setMode('signin');
              }}
            >
              Volver a iniciar sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-lg font-semibold tracking-tight">
              {mode === 'signin' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta' : 'Recuperar contraseña'}
            </h1>
            {mode === 'signup' ? <LabeledInput label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /> : null}
            <LabeledInput label="Correo electrónico" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {mode !== 'reset' ? (
              <LabeledInput
                label="Contraseña"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            ) : null}
            {error ? (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" className="w-full" loading={loading}>
              {mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
              {!loading ? <ArrowRight className="size-4" /> : null}
            </Button>
            <div className="flex flex-col items-center gap-1.5 pt-1 text-sm">
              {mode === 'signin' ? (
                <>
                  <button type="button" className="text-muted hover:text-fg" onClick={() => setMode('reset')}>
                    ¿Has olvidado la contraseña?
                  </button>
                  <button type="button" className="font-medium text-accent" onClick={() => setMode('signup')}>
                    Crear una cuenta nueva
                  </button>
                </>
              ) : (
                <button type="button" className="font-medium text-accent" onClick={() => setMode('signin')}>
                  Ya tengo cuenta
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
