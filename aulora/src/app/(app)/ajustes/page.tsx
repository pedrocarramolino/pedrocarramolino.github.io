'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, LogOut, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react';
import { Button, Field, Input, LabeledInput, Segmented } from '@/components/ui/controls';
import { Card, CardHeader, PageHeader } from '@/components/ui/display';
import { useConfirm } from '@/components/ui/overlay';
import { cn } from '@/components/ui/cn';
import { ColorPicker } from '@/components/ui/pickers';
import { useTheme, type ThemePref } from '@/components/layout/theme';
import { useAction, useCategories, useProfile } from '@/hooks/data';
import { categoryApi, exportAll, profileApi } from '@/services/api';
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/components/layout/auth';
import { COLORS, cvar } from '@/lib/colors';
import type { Category } from '@/lib/types';

function SettingsPage() {
  const params = useSearchParams();
  const profile = useProfile();
  const { pref, setPref } = useTheme();
  const { user } = useAuth();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Ajustes" />
      <div className="space-y-4">
        {params.get('recuperar') ? <PasswordCard highlight /> : null}
        {profile.data ? <ProfileCard key={profile.data.id} /> : null}

        <Card>
          <CardHeader title="Apariencia" />
          <div className="px-4 pb-4">
            <Segmented<ThemePref>
              value={pref}
              onChange={setPref}
              options={[
                { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" /> Claro</span> },
                { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" /> Oscuro</span> },
                { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="size-3.5" /> Sistema</span> },
              ]}
            />
          </div>
        </Card>

        <CategoriesCard />

        {!params.get('recuperar') ? <PasswordCard /> : null}

        <Card>
          <CardHeader title="Cuenta y datos" />
          <div className="space-y-4 px-4 pb-4">
            <p className="text-sm text-fg-2">
              Sesión iniciada como <strong>{user?.email ?? '…'}</strong>. Tus datos se guardan en tu proyecto de Firebase y solo tú puedes acceder a ellos.
            </p>
            <div className="flex flex-wrap gap-2">
              <ExportButton />
              <Button
                onClick={async () => {
                  await signOut(firebaseAuth());
                  window.location.assign('/login');
                }}
              >
                <LogOut className="size-4" /> Cerrar sesión
              </Button>
            </div>
          </div>
        </Card>
        <p className="pb-4 text-center text-xs text-muted">Aulora · gestión docente</p>
      </div>
    </div>
  );
}

function ProfileCard() {
  const profile = useProfile();
  const p = profile.data!;
  const [name, setName] = useState(p.display_name);
  const [start, setStart] = useState(p.day_start_hour);
  const [end, setEnd] = useState(p.day_end_hour);
  const [minutes, setMinutes] = useState(p.default_lesson_minutes);
  const save = useAction(
    async () => {
      if (end <= start) throw new Error('La hora de fin debe ser posterior a la de inicio');
      return profileApi.update(p.id, { display_name: name.trim(), day_start_hour: start, day_end_hour: end, default_lesson_minutes: minutes });
    },
    { invalidate: ['profile'], success: 'Ajustes guardados' },
  );
  const dirty = name !== p.display_name || start !== p.day_start_hour || end !== p.day_end_hour || minutes !== p.default_lesson_minutes;
  return (
    <Card>
      <CardHeader title="Perfil y agenda" />
      <form
        className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <LabeledInput label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-2" />
        <LabeledInput label="La agenda empieza a las" type="number" min={0} max={23} value={start} onChange={(e) => setStart(Number(e.target.value))} hint="Hora (0–23)" />
        <LabeledInput label="La agenda termina a las" type="number" min={1} max={24} value={end} onChange={(e) => setEnd(Number(e.target.value))} hint="Hora (1–24)" />
        <LabeledInput label="Duración de clase por defecto (min)" type="number" min={5} max={600} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        <div className="flex items-end justify-end sm:col-span-1">
          <Button type="submit" variant="primary" disabled={!dirty} loading={save.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CategoriesCard() {
  const categories = useCategories();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [color, setColor] = useState('indigo');
  const add = useAction(() => categoryApi.create({ name: name.trim(), color, sort_order: (categories.data?.length ?? 0) + 1 }), {
    invalidate: ['categories'],
    success: 'Categoría creada',
    onDone: () => setName(''),
  });
  const remove = useAction((id: string) => categoryApi.remove(id), { invalidate: ['categories', 'tasks'], success: 'Categoría eliminada' });
  return (
    <Card>
      <CardHeader title="Categorías de tareas" count={categories.data?.length} />
      <ul className="divide-y divide-border border-y border-border">
        {(categories.data ?? []).map((c) => (
          <CategoryRow
            key={c.id}
            c={c}
            onDelete={async () =>
              (await confirm({
                title: `¿Eliminar «${c.name}»?`,
                description: 'Las tareas de esta categoría se conservarán, pero quedarán sin categoría.',
                confirmLabel: 'Eliminar',
                danger: true,
              })) && remove.mutate(c.id)
            }
          />
        ))}
      </ul>
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate(undefined);
        }}
      >
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría (p. ej. Improvisación)" aria-label="Nueva categoría" />
          <Button type="submit" variant="primary" disabled={!name.trim()} loading={add.isPending}>
            <Plus className="size-4" /> Añadir
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </form>
    </Card>
  );
}

function CategoryRow({ c, onDelete }: { c: Category; onDelete: () => void }) {
  const [name, setName] = useState(c.name);
  const [picking, setPicking] = useState(false);
  useEffect(() => setName(c.name), [c.name]);
  const update = useAction((patch: Partial<Category>) => categoryApi.update(c.id, patch), { invalidate: ['categories'] });
  return (
    <li className="px-4 py-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPicking((p) => !p)}
          style={cvar(c.color)}
          className="dot size-5 shrink-0 rounded-full"
          aria-label={`Color: ${COLORS[c.color]?.label ?? c.color}`}
          title="Cambiar color"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== c.name && update.mutate({ name: name.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm outline-none hover:bg-surface-2 focus:bg-surface-2"
          aria-label="Nombre de la categoría"
        />
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Eliminar ${c.name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {picking ? (
        <div className="animate-rise py-2 pl-7">
          <ColorPicker
            value={c.color}
            onChange={(color) => {
              update.mutate({ color });
              setPicking(false);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function PasswordCard({ highlight = false }: { highlight?: boolean }) {
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    if (pw !== pw2) return toast.error('Las contraseñas no coinciden');
    const user = firebaseAuth().currentUser;
    if (!user?.email) return;
    setLoading(true);
    try {
      // Firebase exige haber iniciado sesión recientemente para cambiar la contraseña
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, pw);
      toast.success('Contraseña actualizada');
      setCurrent('');
      setPw('');
      setPw2('');
    } catch (err) {
      const code = (err as { code?: string }).code;
      toast.error(code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'La contraseña actual no es correcta' : (err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card className={cn(highlight && 'border-accent ring-3 ring-[var(--ring)]')}>
      <CardHeader title="Cambiar contraseña" />
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-3 sm:items-end">
        <Field label="Contraseña actual">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nueva contraseña">
          <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Repítela">
          <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <div className="flex justify-end sm:col-span-3">
          <Button type="submit" variant="primary" loading={loading} disabled={!pw || !current}>
            Actualizar contraseña
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ExportButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const data = await exportAll();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `aulora-copia-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Copia de seguridad descargada');
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setLoading(false);
        }
      }}
    >
      <Download className="size-4" /> Exportar mis datos
    </Button>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
