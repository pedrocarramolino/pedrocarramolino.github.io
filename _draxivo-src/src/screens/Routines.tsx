import { useMemo, useState } from 'react';
import { Archive, Copy, Ellipsis, Folder, FolderPlus, ListChecks, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import type { Routine } from '../db/types';
import { useQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { useSettings, useToast } from '../app/context';
import { deleteFolder, deleteRoutine, duplicateRoutine, estimateRoutineMinutes, listFolders, saveFolder, saveRoutine, setRoutineArchived } from '../db/repo';
import { BUILTIN_TEMPLATES, routineFromTemplate } from '../db/templates';
import { fmtMinutes } from '../lib/dates';
import { ActionMenu, Button, Empty, Field, IconButton, Input, List, Loading, Page, Row, Section, Sheet, Tag, useConfirm } from '../ui/kit';
import { normalize, useExercises, useRoutines, useStartWorkout } from './shared';

export function useRoutineActions() {
  const toast = useToast();
  const confirm = useConfirm();
  const start = useStartWorkout();
  const folders = useQuery(listFolders, ['folders']);
  const [moving, setMoving] = useState<Routine | null>(null);
  const actions = (r: Routine) => [
    { label: 'Empezar entrenamiento', icon: <Play size={20} />, onSelect: () => start(r.id), hidden: r.archived || r.isTemplate },
    { label: 'Usar esta plantilla', icon: <Copy size={20} />, hidden: !r.isTemplate, onSelect: async () => { const n = await duplicateRoutine(r.id, 'fromTemplate'); toast('Rutina creada desde la plantilla'); navigate(`/routines/${n.id}/edit`); } },
    { label: 'Editar', icon: <Pencil size={20} />, onSelect: () => navigate(`/routines/${r.id}/edit`) },
    { label: 'Duplicar', icon: <Copy size={20} />, onSelect: async () => { await duplicateRoutine(r.id, 'copy'); toast('Rutina duplicada'); } },
    { label: 'Crear variante', icon: <Copy size={20} />, hidden: r.isTemplate, onSelect: async () => { const n = await duplicateRoutine(r.id, 'variant'); toast('Variante creada'); navigate(`/routines/${n.id}/edit`); } },
    { label: 'Guardar como plantilla', icon: <Copy size={20} />, hidden: r.isTemplate, onSelect: async () => { await duplicateRoutine(r.id, 'template'); toast('Plantilla guardada'); } },
    { label: 'Mover a carpeta', icon: <Folder size={20} />, onSelect: () => setMoving(r) },
    { label: r.archived ? 'Restaurar' : 'Archivar', icon: <Archive size={20} />, onSelect: async () => { await setRoutineArchived(r.id, !r.archived); toast(r.archived ? 'Rutina restaurada' : 'Rutina archivada. Su historial se conserva.'); } },
    {
      label: 'Eliminar',
      icon: <Trash2 size={20} />,
      destructive: true,
      onSelect: async () => {
        if (await confirm({ title: `¿Eliminar «${r.name}»?`, message: 'Las sesiones ya realizadas con esta rutina se conservan en el historial. Las planificaciones futuras se eliminarán.', confirmLabel: 'Eliminar', destructive: true })) {
          await deleteRoutine(r.id);
          toast('Rutina eliminada');
        }
      },
    },
  ];
  const moveSheet = (
    <Sheet open={!!moving} onClose={() => setMoving(null)} title="Mover a carpeta">
      <List>
        {[{ id: '', name: 'Sin carpeta' }, ...(folders ?? [])].map((f) => (
          <Row
            key={f.id}
            title={f.name}
            value={(moving?.folderId ?? '') === f.id ? '✓' : undefined}
            onClick={async () => {
              if (moving) await saveRoutine({ ...moving, folderId: f.id || null });
              setMoving(null);
            }}
          />
        ))}
      </List>
    </Sheet>
  );
  return { actions, moveSheet };
}

export function Routines() {
  const { settings } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const routines = useRoutines();
  const folders = useQuery(listFolders, ['folders']);
  const exercises = useExercises(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<Routine | null>(null);
  const [folderEdit, setFolderEdit] = useState<{ id?: string; name: string } | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ id: string; name: string } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const { actions, moveSheet } = useRoutineActions();

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return (routines ?? []).filter((r) => (!nq || normalize(r.name).includes(nq) || normalize(r.description).includes(nq)) && (!cat || r.category === cat));
  }, [routines, q, cat]);

  if (!routines || !folders || !exercises) return <Loading />;
  const active = filtered.filter((r) => !r.archived && !r.isTemplate);
  const templates = filtered.filter((r) => r.isTemplate && !r.archived);
  const archived = filtered.filter((r) => r.archived);
  const categories = [...new Set(routines.map((r) => r.category).filter(Boolean))];
  const exName = new Map(exercises.map((e) => [e.id, e.name]));

  const routineRow = (r: Routine) => (
    <Row
      key={r.id}
      title={
        <span>
          {r.name} {r.variantOf && <Tag>Variante</Tag>}
        </span>
      }
      subtitle={
        r.exercises.length
          ? `${r.exercises.length} ejercicios · ~${fmtMinutes(r.estimatedMin ?? estimateRoutineMinutes(r, settings.defaultRestSec))} · ${r.exercises
              .slice(0, 3)
              .map((e) => exName.get(e.exerciseId) ?? '?')
              .join(', ')}${r.exercises.length > 3 ? '…' : ''}`
          : 'Sin ejercicios'
      }
      onClick={() => navigate(`/routines/${r.id}`)}
      chevron={false}
    >
      <IconButton
        label={`Opciones de ${r.name}`}
        onClick={(e) => {
          e.stopPropagation();
          setMenu(r);
        }}
      >
        <Ellipsis size={20} />
      </IconButton>
    </Row>
  );

  const byFolder = (fid: string | null) => active.filter((r) => (r.folderId ?? null) === fid);
  const timedIds = new Set(exercises.filter((e) => e.tracking === 'duration' || e.tracking === 'distance_duration').map((e) => e.id));

  return (
    <Page
      title="Rutinas"
      actions={
        <>
          <IconButton label="Nueva carpeta" onClick={() => setFolderEdit({ name: '' })}>
            <FolderPlus size={22} />
          </IconButton>
          <IconButton label="Nueva rutina" onClick={() => navigate('/routines/new')}>
            <Plus size={24} />
          </IconButton>
        </>
      }
    >
      <div className="search">
        <Search size={18} />
        <Input type="search" placeholder="Buscar rutinas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar rutinas" />
      </div>
      {categories.length > 0 && (
        <div className="chips">
          <button className={`chip ${!cat ? 'active' : ''}`} onClick={() => setCat('')}>
            Todas
          </button>
          {categories.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="btn-row mt">
        <Button variant="tinted" icon={<Plus size={18} />} onClick={() => navigate('/routines/new')}>
          Nueva rutina
        </Button>
        <Button icon={<ListChecks size={18} />} onClick={() => navigate('/exercises')}>
          Ejercicios
        </Button>
      </div>

      {!routines.length && (
        <Section>
          <Empty icon={<ListChecks size={24} />} title="Crea tu primera rutina" text="Organiza tus ejercicios, series y descansos. También puedes empezar desde una plantilla." action={<Button onClick={() => setTplOpen(true)}>Ver plantillas</Button>} />
        </Section>
      )}

      {folders.map((f) => {
        const list = byFolder(f.id);
        if (q && !list.length) return null;
        return (
          <Section
            key={f.id}
            title={
              <span>
                <Folder size={13} style={{ verticalAlign: '-2px' }} /> {f.name} · {list.length}
              </span>
            }
            action={
              <IconButton label={`Opciones de la carpeta ${f.name}`} onClick={() => setFolderMenu(f)}>
                <Ellipsis size={18} />
              </IconButton>
            }
          >
            {list.length ? <List>{list.map(routineRow)}</List> : <p className="small muted" style={{ padding: '0 4px' }}>Carpeta vacía. Usa «Mover a carpeta» en una rutina.</p>}
          </Section>
        );
      })}

      {byFolder(null).length > 0 && (
        <Section title={folders.length ? 'Sin carpeta' : 'Mis rutinas'}>
          <List>{byFolder(null).map(routineRow)}</List>
        </Section>
      )}

      {routines.length > 0 && !active.length && q && <p className="muted mt">No hay rutinas que coincidan.</p>}

      <Section title="Plantillas" action={<button className="link" onClick={() => setTplOpen(true)}>Incluidas</button>}>
        {templates.length ? <List>{templates.map(routineRow)}</List> : <p className="small muted" style={{ padding: '0 4px' }}>Guarda cualquier rutina como plantilla para reutilizarla, o usa una de las incluidas.</p>}
      </Section>

      {archived.length > 0 && (
        <Section title={`Archivadas · ${archived.length}`} action={<button className="link" onClick={() => setShowArchived((s) => !s)}>{showArchived ? 'Ocultar' : 'Mostrar'}</button>}>
          {showArchived && <List>{archived.map(routineRow)}</List>}
        </Section>
      )}

      <ActionMenu open={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ''} actions={menu ? actions(menu) : []} />
      {moveSheet}

      <ActionMenu
        open={!!folderMenu}
        onClose={() => setFolderMenu(null)}
        title={folderMenu?.name ?? ''}
        actions={[
          { label: 'Nueva rutina en esta carpeta', onSelect: () => navigate(`/routines/new?folder=${folderMenu!.id}`) },
          { label: 'Renombrar carpeta', onSelect: () => setFolderEdit(folderMenu) },
          {
            label: 'Eliminar carpeta',
            destructive: true,
            onSelect: async () => {
              if (await confirm({ title: `¿Eliminar la carpeta «${folderMenu!.name}»?`, message: 'Las rutinas que contiene no se eliminan: pasan a «Sin carpeta».', confirmLabel: 'Eliminar', destructive: true })) {
                await deleteFolder(folderMenu!.id);
                toast('Carpeta eliminada');
              }
            },
          },
        ]}
      />

      <Sheet
        open={!!folderEdit}
        onClose={() => setFolderEdit(null)}
        title={folderEdit?.id ? 'Renombrar carpeta' : 'Nueva carpeta'}
        footer={
          <>
            <Button onClick={() => setFolderEdit(null)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!folderEdit?.name.trim()}
              onClick={async () => {
                const existing = folders.find((f) => f.id === folderEdit!.id);
                await saveFolder({ ...existing, id: folderEdit!.id, name: folderEdit!.name });
                setFolderEdit(null);
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <Field label="Nombre">
          <Input value={folderEdit?.name ?? ''} onChange={(e) => setFolderEdit((f) => f && { ...f, name: e.target.value })} maxLength={60} data-autofocus />
        </Field>
      </Sheet>

      <Sheet open={tplOpen} onClose={() => setTplOpen(false)} title="Plantillas incluidas">
        <p className="small muted">Al usar una plantilla se crea una rutina nueva que puedes editar libremente.</p>
        <List className="mt">
          {BUILTIN_TEMPLATES.map((t) => (
            <Row key={t.id} title={t.name} subtitle={`${t.description} · ${t.items.length} ejercicios`} chevron={false}>
              <Button
                size="sm"
                variant="tinted"
                onClick={async () => {
                  const r = await saveRoutine(routineFromTemplate(t, timedIds));
                  setTplOpen(false);
                  toast(`Rutina «${r.name}» creada`);
                  navigate(`/routines/${r.id}`);
                }}
              >
                Usar
              </Button>
            </Row>
          ))}
        </List>
      </Sheet>
    </Page>
  );
}
