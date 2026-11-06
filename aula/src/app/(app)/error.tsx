'use client';
import { Button } from '@/components/ui/controls';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-lg font-semibold">Algo ha fallado</h1>
      <p className="max-w-md text-sm text-muted">{error.message || 'Error inesperado.'}</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
