import { Skeleton } from '@/components/ui/display';

/** Se muestra al instante al abrir la ficha mientras se carga la página. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10" />
      <Skeleton className="h-64" />
    </div>
  );
}
