import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, LockKeyhole } from 'lucide-react';
import type { ProgressPhoto } from '../db/types';
import { useQuery } from '../app/hooks';
import { useToast } from '../app/context';
import { deletePhoto, listPhotos, savePhoto } from '../db/repo';
import { fmtDate, today } from '../lib/dates';
import { Button, Empty, Field, Input, Loading, Page, Section, Segmented, Select, Sheet, cx, useConfirm } from '../ui/kit';

const POSES: Record<ProgressPhoto['pose'], string> = { frente: 'Frente', lado: 'Lado', espalda: 'Espalda', otra: 'Otra' };

/** Reduce la imagen para no agotar el almacenamiento del dispositivo. */
async function compress(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

function useObjectUrls(photos: ProgressPhoto[] | undefined) {
  const urls = useMemo(() => new Map((photos ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export function PhotosScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const photos = useQuery(listPhotos, ['photos']);
  const urls = useObjectUrls(photos);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ blob: Blob; date: string; pose: ProgressPhoto['pose']; note: string } | null>(null);
  const [mode, setMode] = useState<'grid' | 'compare'>('grid');
  const [sel, setSel] = useState<string[]>([]);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [pose, setPose] = useState<ProgressPhoto['pose'] | ''>('');

  if (!photos) return <Loading />;
  const shown = photos.filter((p) => !pose || p.pose === pose);
  const [a, b] = sel.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as ProgressPhoto[];
  const ordered = a && b ? [a, b].sort((x, y) => x.date.localeCompare(y.date)) : [];

  return (
    <Page title="Fotos" back="/progress" backLabel="Progreso">
      <div className="callout callout-neutral">
        <LockKeyhole size={18} />
        <span>Las fotos se guardan sólo en este dispositivo y nunca se envían a ningún servidor. Sólo se incluyen en una copia de seguridad si lo eliges al exportar.</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const blob = await compress(file);
          setPending({ blob, date: today(), pose: 'frente', note: '' });
        }}
      />
      <div className="btn-row mt">
        <Button variant="primary" icon={<Camera size={18} />} onClick={() => fileRef.current?.click()}>
          Añadir foto
        </Button>
      </div>

      {!photos.length ? (
        <Section>
          <Empty icon={<Camera size={26} />} title="Sin fotos" text="Haz fotos con la misma luz, distancia y postura para que las comparaciones sean útiles." />
        </Section>
      ) : (
        <>
          <Section>
            <Segmented
              label="Vista"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setSel([]);
              }}
              options={[{ value: 'grid', label: 'Galería' }, { value: 'compare', label: 'Comparar' }]}
            />
            <div className="mt">
              <Select value={pose} onChange={(v) => setPose(v as ProgressPhoto['pose'] | '')} aria-label="Postura">
                <option value="">Todas las posturas</option>
                {Object.entries(POSES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            {mode === 'compare' && <p className="small muted mt">Selecciona dos fotos para compararlas.</p>}
          </Section>
          {mode === 'compare' && ordered.length === 2 && (
            <div className="compare mt">
              {ordered.map((p) => (
                <figure key={p.id}>
                  <img src={urls.get(p.id)} alt={`Foto de progreso del ${fmtDate(p.date, true)}`} />
                  <figcaption>
                    {fmtDate(p.date, true)} · {POSES[p.pose]}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="photo-grid mt">
            {shown.map((p) => (
              <button
                key={p.id}
                className={cx('photo-cell', sel.includes(p.id) && 'selected')}
                onClick={() => {
                  if (mode === 'grid') setViewing(p);
                  else setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s.slice(-1), p.id]));
                }}
                aria-label={`Foto del ${fmtDate(p.date, true)}, ${POSES[p.pose]}`}
                aria-pressed={mode === 'compare' ? sel.includes(p.id) : undefined}
              >
                <img src={urls.get(p.id)} alt="" loading="lazy" />
                <span className="photo-date">{fmtDate(p.date)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Nueva foto"
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await savePhoto({ ...pending!, mime: pending!.blob.type || 'image/jpeg' });
                  toast('Foto guardada en este dispositivo');
                  setPending(null);
                } catch (e) {
                  toast(`No se pudo guardar: ${(e as Error).message}`, { tone: 'error' });
                }
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        {pending && (
          <>
            <PreviewImg blob={pending.blob} />
            <div className="form-grid mt">
              <Field label="Fecha">
                <Input type="date" value={pending.date} max={today()} onChange={(e) => setPending({ ...pending, date: e.target.value })} />
              </Field>
              <Field label="Postura">
                <Select value={pending.pose} onChange={(v) => setPending({ ...pending, pose: v as ProgressPhoto['pose'] })}>
                  {Object.entries(POSES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Nota">
              <Input value={pending.note} onChange={(e) => setPending({ ...pending, note: e.target.value })} maxLength={200} />
            </Field>
          </>
        )}
      </Sheet>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${fmtDate(viewing.date, true)} · ${POSES[viewing.pose]}` : ''} size="full">
        {viewing && (
          <>
            <img src={urls.get(viewing.id)} alt={`Foto del ${fmtDate(viewing.date, true)}`} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            {viewing.note && <p className="mt">{viewing.note}</p>}
            <Button
              variant="danger"
              block
              className="mt"
              onClick={async () => {
                if (await confirm({ title: '¿Eliminar esta foto?', message: 'Se borrará de este dispositivo.', confirmLabel: 'Eliminar', destructive: true })) {
                  await deletePhoto(viewing.id);
                  setViewing(null);
                  toast('Foto eliminada');
                }
              }}
            >
              Eliminar foto
            </Button>
          </>
        )}
      </Sheet>
    </Page>
  );
}

function PreviewImg({ blob }: { blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="Vista previa" style={{ width: '100%', maxHeight: '40dvh', objectFit: 'contain', borderRadius: 12, background: 'var(--surface-2)' }} />;
}
