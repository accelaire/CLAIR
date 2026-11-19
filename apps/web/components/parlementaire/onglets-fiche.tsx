import type { RefObject } from 'react';

// Les onglets des fiches de députés et de sénateurs : votes, interventions,
// amendements. Une liste vide n'a pas d'onglet (#129) : la fiche de Sébastien
// Lecornu ouvrait sur « Aucun vote trouvé », ses onze votes étant des scrutins
// où, ministre, il ne pouvait pas voter.

export const ONGLETS_FICHE = ['votes', 'interventions', 'amendements'] as const;
export type OngletFiche = (typeof ONGLETS_FICHE)[number];

const LIBELLES: Record<OngletFiche, string> = {
  votes: 'Votes récents',
  interventions: 'Interventions',
  amendements: 'Amendements',
};

/** Taille des listes de la fiche (`listes` de l'API). */
export type ListesFiche = Record<OngletFiche, number> & {
  /** Amendements dont il est l’auteur, sur les `amendements` déposés ou cosignés. */
  amendementsDeposes?: number;
};

/**
 * Les onglets à montrer, dans l'ordre. Sans `listes` (réponse mise en cache
 * avant leur ajout), tous : mieux vaut un onglet vide qu'une liste cachée.
 */
export function ongletsVisibles(listes: ListesFiche | null | undefined): OngletFiche[] {
  if (!listes) return [...ONGLETS_FICHE];
  return ONGLETS_FICHE.filter((o) => listes[o] > 0);
}

export function BarreOngletsFiche({
  onglets,
  actif,
  choisir,
  barre,
}: {
  onglets: readonly OngletFiche[];
  actif: OngletFiche;
  choisir: (o: OngletFiche) => void;
  barre: RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={barre} className="scroll-mt-20 border-b">
      <nav className="flex gap-8 overflow-x-auto scrollbar-none">
        {onglets.map((o) => (
          <button
            key={o}
            onClick={() => choisir(o)}
            className={`shrink-0 whitespace-nowrap pb-4 ${
              actif === o ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {LIBELLES[o]}
          </button>
        ))}
      </nav>
    </div>
  );
}
