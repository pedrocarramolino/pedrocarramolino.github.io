'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, LogOut, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react';
import { Button, Field, Input, LabeledInput, NumberInput, Segmented, rangeError } from '@/components/ui/controls';
import { Card, CardHeader, PageHeader } from '@/components/ui/display';
import { useConfirm } from '@/components/ui/overlay';
import { cn } from '@/components/ui/cn';
import { ColorPicker } from '@/components/ui/pickers';
import { PasswordChecklist, PasswordInput } from '@/components/ui/PasswordInput';
import { validateNewPassword } from '@/lib/password';
import { useTheme, type ThemePref } from '@/components/layout/theme';
import { SyncStatusRow } from '@/components/layout/SyncBanner';
import { pendingWrites } from '@/lib/sync-status';
import { useAction, useCategories, useProfile } from '@/hooks/data';
import { categoryApi, exportAll, profileApi } from '@/services/api';
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import { firebaseAuth, flushWrites } from '@/lib/firebase';
import { useAuth } from '@/components/layout/auth';
import { COLORS, cvar } from '@/lib/colors';
import type { Category } from '@/lib/types';

function SettingsPage() {
  const params = useSearchParams();
  const profile = useProfile();
  const { pref, setPref } = useTheme();
  const { user } = useAuth();
  const confirm = useConfirm();

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
            <SyncStatusRow />
            <p className="text-sm text-fg-2">
              Sesión iniciada como <strong>{user?.email ?? '…'}</strong>. Tus datos se guardan en la nube (tu proyecto de Firebase), se sincronizan entre tus dispositivos y solo tú puedes acceder a ellos.
            </p>
            <div className="flex flex-wrap gap-2">
              <ExportButton />
              <Button
                onClick={async () => {
                  await flushWrites();
                  // si quedan cambios sin subir, cerrar sesión podría perderlos
                  const left = pendingWrites();
                  if (
                    left &&
                    !(await confirm({
                      title: 'Hay cambios sin guardar en la nube',
                      description: `${left === 1 ? 'Queda 1 cambio' : `Quedan ${left} cambios`} que todavía no se han subido. Si cierras sesión ahora podrían perderse. Espera a tener conexión o ciérrala igualmente.`,
                      confirmLabel: 'Cerrar sesión igualmente',
                      danger: true,
                    }))
                  )
                    return;
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
  const [start, setStart] = useState<number | null>(p.day_start_hour);
  const [end, setEnd] = useState<number | null>(p.day_end_hour);
  const [minutes, setMinutes] = useState<number | null>(p.default_lesson_minutes);
  const save = useAction(
    async () => {
      const problem =
        rangeError(start, 0, 23, 'la hora de inicio de la agenda') ??
        rangeError(end, 1, 24, 'la hora de fin de la agenda') ??
        rangeError(minutes, 5, 600, 'la duración por defecto (en minutos)');
      if (problem) throw new Error(problem);
      if (end! <= start!) throw new Error('La hora de fin debe ser posterior a la de inicio');
      return profileApi.update(p.id, { display_name: name.trim(), day_start_hour: start!, day_end_hour: end!, default_lesson_minutes: minutes! });
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
        <Field label="La agenda empieza a las" hint="Hora (0–23)">
          <NumberInput value={start} onValueChange={setStart} maxLength={2} placeholder="8" />
        </Field>
        <Field label="La agenda termina a las" hint="Hora (1–24)">
          <NumberInput value={end} onValueChange={setEnd} maxLength={2} placeholder="22" />
        </Field>
        <Field label="Duración de clase por defecto (min)" hint="Entre 5 y 600 minutos">
          <NumberInput value={minutes} onValueChange={setMinutes} maxLength={3} placeholder="60" />
        </Field>
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
    const problem = validateNewPassword(pw, pw2);
    if (problem) return toast.error(problem);
    if (pw === current) return toast.error('La nueva contraseña debe ser distinta de la actual');
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
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-3 sm:items-start">
        <PasswordInput label="Contraseña actual" autoComplete="current-password" value={current} onChange={setCurrent} />
        <PasswordInput label="Nueva contraseña" autoComplete="new-password" value={pw} onChange={setPw} />
        <PasswordInput label="Repítela" autoComplete="new-password" value={pw2} onChange={setPw2} />
        <div className="sm:col-span-2">{pw || pw2 ? <PasswordChecklist password={pw} confirm={pw2} /> : null}</div>
        <div className="flex justify-end">
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
