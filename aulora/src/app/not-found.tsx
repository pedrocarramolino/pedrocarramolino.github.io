import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="text-xl font-semibold">Esta página no existe</h1>
      <Link href="/" className="mt-2 text-sm font-medium text-accent">
        Volver al inicio
      </Link>
    </div>
  );
}
