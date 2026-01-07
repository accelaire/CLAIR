'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-destructive">Erreur</h1>
      <h2 className="mt-4 text-2xl font-semibold text-foreground">
        Une erreur est survenue
      </h2>
      <p className="mt-2 text-muted-foreground">
        Nous sommes désolés, quelque chose s&apos;est mal passé.
      </p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Réessayer
      </button>
    </div>
  );
}
