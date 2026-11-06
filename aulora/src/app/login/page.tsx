'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, MailCheck } from 'lucide-react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { profileApi } from '@/services/api';
import { useAuth } from '@/components/layout/auth';
import { Button, LabeledInput } from '@/components/ui/controls';
import { PasswordChecklist, PasswordInput } from '@/components/ui/PasswordInput';
import { validateNewPassword } from '@/lib/password';
import { Logo } from '@/components/layout/Logo';

type Mode = 'signin' | 'signup' | 'reset';

/** Mensajes de Firebase Auth en español. */
function translate(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña es demasiado débil: usa al menos 8 caracteres con letras y números.',
    'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos de seguridad del proyecto.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed': 'No hay conexión con el servidor.',
    'auth/operation-not-allowed': 'El registro de nuevas cuentas está desactivado.',
    'auth/admin-restricted-operation': 'El registro de nuevas cuentas está desactivado.',
    'auth/user-disabled': 'Esta cuenta está desactivada.',
  };
  return map[code] ?? ((e as Error)?.message || 'No se pudo completar la operación.');
}

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setConfirm('');
  };
  const { user, loading: authLoading } = useAuth();
  const next = (() => {
    const n = params.get('next');
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
  })();

  // con sesión ya iniciada, directamente a la app
  useEffect(() => {
    if (!authLoading && user && !loading) window.location.replace(next);
  }, [authLoading, user, next, loading]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = firebaseAuth();
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        window.location.assign(next);
        return;
      }
      if (mode === 'signup') {
        const problem = validateNewPassword(password, confirm);
        if (problem) {
          setError(problem);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const display = name.trim() || email.trim().split('@')[0];
        await updateProfile(cred.user, { displayName: display });
        // el perfil puede haberse creado ya al detectar la sesión: fija el nombre elegido
        await profileApi.ensure(display);
        await profileApi.update(cred.user.uid, { display_name: display });
        window.location.assign(next);
        return;
      }
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setSent('Si existe una cuenta con ese correo, recibirás un enlace para elegir una nueva contraseña.');
      }
    } catch (err) {
      setError(translate(err));
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
              <PasswordInput
                label="Contraseña"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={setPassword}
                required
              />
            ) : null}
            {mode === 'signup' ? (
              <>
                <PasswordInput label="Repite la contraseña" autoComplete="new-password" value={confirm} onChange={setConfirm} required />
                <PasswordChecklist password={password} confirm={confirm} />
              </>
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
                  <button type="button" className="text-muted hover:text-fg" onClick={() => switchMode('reset')}>
                    ¿Has olvidado la contraseña?
                  </button>
                  <button type="button" className="font-medium text-accent" onClick={() => switchMode('signup')}>
                    Crear una cuenta nueva
                  </button>
                </>
              ) : (
                <button type="button" className="font-medium text-accent" onClick={() => switchMode('signin')}>
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
