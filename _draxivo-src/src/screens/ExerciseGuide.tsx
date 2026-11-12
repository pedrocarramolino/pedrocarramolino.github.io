// Piezas compartidas de la biblioteca: filtros (búsqueda, grupo, material y nivel),
// contenido de la guía de cada ejercicio y la hoja «Cómo se hace».
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, House, Search, ShieldCheck } from 'lucide-react';
import type { Equipment, Exercise } from '../db/types';
import { useMediaQuery } from '../app/hooks';
import { navigate } from '../app/router';
import { FILTER_GROUPS, LEVELS, catalogEntry, guideFor, levelOf, searchText, type Level } from '../data/catalog';
import { LEGACY_INSTRUCTIONS } from '../data/catalog/legacy';
import { EQUIPMENT, MUSCLES } from '../lib/labels';
import { ExerciseArt } from '../ui/ExerciseArt';
import { Button, Input, Section, Sheet, cx } from '../ui/kit';
import { normalize } from '../lib/text';

// ---------- Filtros ----------
export interface ExerciseFilterState {
  q: string;
  group: string;
  equip: Equipment | '';
  level: Level | '';
}

/** Estado de filtros y lista filtrada; la búsqueda se aplaza para no bloquear el teclado. */
export function useExerciseFilter<E extends Exercise>(all: E[] | undefined) {
  const [f, setF] = useState<ExerciseFilterState>({ q: '', group: '', equip: '', level: '' });
  const q = useDeferredValue(f.q);
  const index = useMemo(() => new Map((all ?? []).map((e) => [e.id, normalize(`${searchText(e)} ${MUSCLES[e.primaryMuscle]} ${EQUIPMENT[e.equipment]}`)])), [all]);
  const list = useMemo(() => {
    const words = normalize(q.trim()).split(/\s+/).filter(Boolean);
    const muscles = FILTER_GROUPS.find((g) => g.value === f.group)?.muscles;
    const out = (all ?? []).filter(
      (e) =>
        words.every((w) => index.get(e.id)!.includes(w)) &&
        (!muscles || muscles.includes(e.primaryMuscle) || e.secondaryMuscles.some((m) => muscles.includes(m))) &&
        (!f.equip || e.equipment === f.equip) &&
        (!f.level || (!e.custom && levelOf(e) === f.level)),
    );
    // Con un grupo elegido, primero los que lo trabajan como músculo principal.
    if (muscles) out.sort((a, b) => Number(!muscles.includes(a.primaryMuscle)) - Number(!muscles.includes(b.primaryMuscle)));
    return out;
  }, [all, q, f.group, f.equip, f.level, index]);
  const set = (p: Partial<ExerciseFilterState>) => setF((x) => ({ ...x, ...p }));
  const active = !!(f.group || f.equip || f.level);
  return { f, set, list, active, reset: () => setF((x) => ({ ...x, group: '', equip: '', level: '' })) };
}

type Filter = ReturnType<typeof useExerciseFilter>;

export function ExerciseFilters({ filter, autoFocus, placeholder = 'Buscar por nombre, músculo o material' }: { filter: Pick<Filter, 'f' | 'set' | 'active' | 'reset'>; autoFocus?: boolean; placeholder?: string }) {
  const { f, set } = filter;
  return (
    <div className="ex-filters">
      <div className="search">
        <Search size={18} />
        <Input
          type="search"
          placeholder={placeholder}
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          aria-label="Buscar ejercicio"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          {...(autoFocus ? { 'data-autofocus': true } : {})}
        />
      </div>
      <ChipRow label="Filtrar por grupo muscular" value={f.group} onChange={(v) => set({ group: v })} all="Todos" options={FILTER_GROUPS.map((g) => ({ value: g.value, label: g.label }))} />
      <ChipRow label="Filtrar por material" value={f.equip} onChange={(v) => set({ equip: v as Equipment | '' })} all="Todo el material" options={(Object.keys(EQUIPMENT) as Equipment[]).map((k) => ({ value: k, label: EQUIPMENT[k] }))} />
      <ChipRow label="Filtrar por nivel" value={f.level} onChange={(v) => set({ level: v as Level | '' })} all="Todos los niveles" options={(Object.keys(LEVELS) as Level[]).map((k) => ({ value: k, label: LEVELS[k] }))} />
    </div>
  );
}

function ChipRow({ label, value, onChange, all, options }: { label: string; value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      <button type="button" className={cx('chip', !value && 'active')} aria-pressed={!value} onClick={() => onChange('')}>
        {all}
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" className={cx('chip', value === o.value && 'active')} aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? '' : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** «Pecho · Barra · Intermedio» */
export function exerciseMeta(e: Exercise): string {
  const c = catalogEntry(e);
  return [MUSCLES[e.primaryMuscle], EQUIPMENT[e.equipment], c ? LEVELS[c.level] : e.custom ? 'Personalizado' : null].filter(Boolean).join(' · ');
}

// ---------- Guía ----------
/** Pasos a mostrar: los del catálogo, salvo que la persona haya escrito sus propias instrucciones. */
export function stepsFor(ex: Exercise): { steps: string[]; own: boolean } {
  const g = guideFor(ex);
  const text = ex.instructions.trim();
  const id = ex.id.replace(/^ex-/, '');
  const edited = !!text && (!g || (text !== g.steps.join(' ') && text !== LEGACY_INSTRUCTIONS[id]));
  if (g && !edited) return { steps: g.steps, own: false };
  return {
    steps: text
      .split(/(?<=\.)\s+|\n+/)
      .map((x) => x.trim())
      .filter(Boolean),
    own: true,
  };
}

export function GuideTags({ ex }: { ex: Exercise }) {
  const c = catalogEntry(ex);
  return (
    <div className="guide-tags">
      {[ex.primaryMuscle, ...ex.secondaryMuscles].map((m, i) => (
        <span key={m} className={cx('tag', i === 0 && 'tag-blue')}>
          {MUSCLES[m]}
        </span>
      ))}
      <span className="tag">{EQUIPMENT[ex.equipment]}</span>
      {c && <span className="tag">{LEVELS[c.level]}</span>}
      {c?.home && (
        <span className="tag">
          <House size={12} aria-hidden /> En casa
        </span>
      )}
    </div>
  );
}

export function GuideSections({ ex, compact }: { ex: Exercise; compact?: boolean }) {
  const g = guideFor(ex);
  const { steps, own } = stepsFor(ex);
  return (
    <>
      {steps.length > 0 && (
        <Section title={own ? 'Tus instrucciones' : 'Paso a paso'}>
          <div className="card">
            <ol className="steps-list">
              {steps.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
        </Section>
      )}
      {g && (
        <>
          <Section title="Consejos de seguridad">
            <div className="card">
              <ul className="guide-list">
                {g.tips.slice(0, compact ? 3 : undefined).map((x) => (
                  <li key={x}>
                    <ShieldCheck size={16} aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
          <Section title="Errores frecuentes">
            <div className="card">
              <ul className="guide-list guide-list-warn">
                {g.mistakes.slice(0, compact ? 3 : undefined).map((x) => (
                  <li key={x}>
                    <CircleAlert size={16} aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </>
      )}
    </>
  );
}

/** Hoja con la demostración y los pasos: para elegir con seguridad o recordar la técnica. */
export function ExerciseGuideSheet({ ex, onClose, action, showDetailLink = true }: { ex: Exercise | null; onClose: () => void; action?: { label: string; icon?: ReactNode; run: () => void }; showDetailLink?: boolean }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <Sheet
      open={!!ex}
      onClose={onClose}
      title="Cómo se hace"
      size="lg"
      footer={
        ex && (action || showDetailLink) ? (
          <>
            {showDetailLink && (
              <Button
                onClick={() => {
                  onClose();
                  navigate(`/exercises/${ex.id}`);
                }}
              >
                Ficha y progreso
              </Button>
            )}
            {action && (
              <Button variant="primary" icon={action.icon} onClick={action.run}>
                {action.label}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {ex && (
        <div className="guide-sheet">
          <div className="ex-hero">
            <ExerciseArt exercise={ex} size="fill" mode={reduceMotion ? 'static' : 'animated'} label={`Demostración de ${ex.name}`} />
          </div>
          <h2 className="guide-title">{ex.name}</h2>
          <GuideTags ex={ex} />
          <GuideSections ex={ex} compact />
        </div>
      )}
    </Sheet>
  );
}
