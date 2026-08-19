'use client';

import { useMemo } from 'react';
import { partsRemisesEnJeu, COULEUR_GROUPE_DEFAUT } from '@/lib/senatoriales/graphiques';
import { useChartTooltip } from '@/components/charts/ChartTooltip';
import type { GroupeRepartition, Sortant } from '../../PageClient';

/**
 * Part des sièges que chaque groupe remet en jeu.
 *
 * Le nombre de sièges renouvelés, seul, ne dit pas grand-chose : trente sièges
 * pèsent différemment selon qu'un groupe en compte soixante ou trente-cinq. La
 * barre montre donc la proportion, et le chiffre à droite rappelle l'effectif —
 * un groupe qui remet 100 % de trois sièges ne joue pas la même partie qu'un
 * groupe qui en remet la moitié de cent.
 */
export function PartRemiseEnJeu({
  parGroupe,
  sortants,
  onSelection,
}: {
  parGroupe: GroupeRepartition[];
  /** Sortants complets pour résoudre les identifiants de mandat d'un groupe. */
  sortants?: Sortant[];
  /** Sélection des sortants d'un groupe pour filtrer la liste. */
  onSelection?: (mandatIds: string[], libelle: string) => void;
}) {
  const { tooltip, handlers } = useChartTooltip();
  const parts = useMemo(() => partsRemisesEnJeu(parGroupe), [parGroupe]);
  if (parts.length === 0) return null;

  return (
    <>
      <ul className="space-y-3">
        {parts.map((groupe) => {
          const contenuTooltip = {
            titre: groupe.nom,
            lignes: [
              { label: 'Remis en jeu', valeur: String(groupe.sieges) },
              { label: 'Total au Sénat', valeur: String(groupe.siegesSenat) },
              { label: 'Part', valeur: `${Math.round(groupe.part)} %` },
            ],
            couleur: groupe.couleur || COULEUR_GROUPE_DEFAUT,
          };
          const mandatIds = (sortants ?? [])
            .filter((s) => (s.groupe?.slug ?? 'sans-groupe') === groupe.slug)
            .map((s) => s.mandatId);
          const interactif = onSelection !== undefined && sortants !== undefined;

          return (
            <li key={groupe.slug}>
              <div
                className={`space-y-1 ${interactif ? 'cursor-pointer hover:opacity-80' : ''}`}
                {...handlers(contenuTooltip)}
                {...(interactif
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => onSelection(mandatIds, groupe.nom),
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelection(mandatIds, groupe.nom);
                        }
                      },
                    }
                  : {})}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: groupe.couleur || COULEUR_GROUPE_DEFAUT }}
                    />
                    <span className="truncate font-medium">{groupe.nom}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {groupe.sieges}/{groupe.siegesSenat} siège{groupe.siegesSenat > 1 ? 's' : ''} ·{' '}
                    <span className="font-semibold text-foreground">{Math.round(groupe.part)} %</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    // Un groupe à part très faible resterait invisible sans plancher ;
                    // il vaut mieux une barre minuscule qu'une barre absente.
                    style={{
                      width: `${Math.max(groupe.part, 1.5)}%`,
                      backgroundColor: groupe.couleur || COULEUR_GROUPE_DEFAUT,
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {tooltip}
    </>
  );
}
