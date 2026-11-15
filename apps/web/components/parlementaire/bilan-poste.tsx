'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { DetailBilan, resumeBilanPoste } from '@/components/gouvernements/parcours';
import { cumulerBilans, type BilanPoste, type EntreeGouvernementale } from '@/lib/gouvernements';

interface MembreReponse {
  data: { postes: Array<{ uid: string; bilan: BilanPoste | null }> };
}

/**
 * Bilan d'une entrée de la frise (un poste, ou des postes reconduits) sur la
 * fiche d'un parlementaire : le résumé vient avec la fiche, la liste des
 * textes et des 49.3 se charge à l'ouverture (`/gouvernements/membres/:slug`).
 */
export function BilanPosteLigne({ entree }: { entree: EntreeGouvernementale }) {
  const [ouvert, setOuvert] = useState(false);
  const membreSlug = entree.postes[0]?.membreSlug ?? null;
  const membre = useQuery({
    queryKey: ['gouvernement-membre', membreSlug],
    queryFn: () => fetcher<MembreReponse>(`/gouvernements/membres/${membreSlug}`),
    enabled: ouvert && !!membreSlug,
    staleTime: 3_600_000,
  });
  if (!entree.bilan) return null;
  const morceaux = resumeBilanPoste(entree.bilan);
  if (morceaux.length === 0) return null;
  const uids = new Set(entree.postes.map((p) => p.uid));
  const detail = membre.data
    ? cumulerBilans(membre.data.data.postes.filter((p) => uids.has(p.uid)).map((p) => p.bilan))
    : null;

  return (
    <div className="mt-1 text-sm text-muted-foreground">
      <p>{morceaux.join(' · ')}</p>
      {membreSlug && (
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="mt-0.5 text-xs text-primary hover:underline"
          aria-expanded={ouvert}
        >
          {ouvert ? 'Masquer le détail' : 'Voir le détail'}
        </button>
      )}
      {ouvert && (
        <div className="mt-2 rounded-lg border bg-card px-3 py-2 text-foreground">
          {membre.isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
          {membre.isError && <p className="text-xs text-muted-foreground">Le détail n&apos;a pas pu être chargé.</p>}
          {detail && <DetailBilan bilan={detail} />}
        </div>
      )}
    </div>
  );
}
