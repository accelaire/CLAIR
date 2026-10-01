'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { slugDepuisCode } from '@/lib/senatoriales/departements';
import { FAMILLES, ORDRE_FAMILLES } from '@/lib/senatoriales/familles';
import type { ResumeCirconscription } from '@/lib/senatoriales/resultats';
import { PastilleEtat, PointsSieges } from './EtatCirconscription';

type Filtre = 'toutes' | 'pourvues' | 'attente';
type Tri = 'alpha' | 'etat' | 'sieges';

const RANG_ETAT: Record<ResumeCirconscription['statut'], number> = {
  pourvue: 0,
  partielle: 1,
  second_tour: 2,
  resultats_attendus: 3,
  vote_en_cours: 4,
  pas_ouvert: 5,
};

/**
 * Les 64 circonscriptions, une vignette chacune : son état et un point par
 * siège. Le rendu serveur montre la grille complète ; les filtres et le tri ne
 * sont qu'un confort de lecture.
 */
export function GrilleCirconscriptions({
  circonscriptions,
  base,
}: {
  circonscriptions: ResumeCirconscription[];
  /** Préfixe des liens vers les pages de circonscription. */
  base: string;
}) {
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [tri, setTri] = useState<Tri>('alpha');

  const pourvues = circonscriptions.filter((c) => c.statut === 'pourvue').length;
  const visibles = useMemo(() => {
    const filtrees = circonscriptions.filter((c) =>
      filtre === 'toutes' ? true : filtre === 'pourvues' ? c.statut === 'pourvue' : c.statut !== 'pourvue',
    );
    return [...filtrees].sort((a, b) => {
      if (tri === 'etat') return RANG_ETAT[a.statut] - RANG_ETAT[b.statut] || a.nom.localeCompare(b.nom, 'fr');
      if (tri === 'sieges') return b.nbSieges - a.nbSieges || a.nom.localeCompare(b.nom, 'fr');
      return a.nom.localeCompare(b.nom, 'fr');
    });
  }, [circonscriptions, filtre, tri]);

  const onglets: { cle: Filtre; libelle: string }[] = [
    { cle: 'toutes', libelle: `Toutes · ${circonscriptions.length}` },
    { cle: 'pourvues', libelle: `Pourvues · ${pourvues}` },
    { cle: 'attente', libelle: `En attente · ${circonscriptions.length - pourvues}` },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Résultats par circonscription</h2>
          <p className="text-sm text-muted-foreground">
            Chaque point est un siège. Le détail des voix est sur la page de chaque circonscription.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Filtrer les circonscriptions">
            {onglets.map((o) => (
              <button
                key={o.cle}
                type="button"
                onClick={() => setFiltre(o.cle)}
                aria-pressed={filtre === o.cle}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  filtre === o.cle ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.libelle}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="tri-circonscriptions">
            Trier
          </label>
          <select
            id="tri-circonscriptions"
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
          >
            <option value="alpha">Ordre alphabétique</option>
            <option value="etat">Par état</option>
            <option value="sieges">Par nombre de sièges</option>
          </select>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Légende">
        <li>Nuance des élus (ministère de l&apos;Intérieur) :</li>
        {ORDRE_FAMILLES.map((f) => (
          <li key={f} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FAMILLES[f].couleur }} aria-hidden />
            {FAMILLES[f].libelle}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-muted-foreground/60" aria-hidden />
          Siège non attribué
        </li>
      </ul>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visibles.map((c) => {
          const slug = slugDepuisCode(c.departement);
          const connue = c.statut === 'pourvue';
          const pasOuvert = c.statut === 'pas_ouvert';
          const contenu = (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium leading-snug">{c.nom}</p>
                <PastilleEtat
                  statut={c.statut}
                  secondTour={c.secondTour}
                  className={`mt-0.5 text-xs ${connue ? 'text-foreground' : 'text-muted-foreground'}`}
                />
              </div>
              <PointsSieges sieges={c.sieges} />
            </div>
          );
          const classe = `block rounded-lg border p-3 transition-colors ${
            connue ? 'bg-card' : pasOuvert ? 'border-dashed' : 'bg-card/60'
          } ${slug ? 'hover:border-primary' : ''}`;
          return (
            <li key={c.departement}>
              {slug ? (
                <Link href={`${base}/${slug}`} className={classe}>
                  {contenu}
                </Link>
              ) : (
                <div className={classe}>{contenu}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
