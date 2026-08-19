'use client';

import type { Comptage } from '@/lib/senatoriales/graphiques';
import { useChartTooltip } from '@/components/charts/ChartTooltip';

/**
 * Barres horizontales pour un simple décompte par catégorie.
 *
 * Horizontales et non verticales : les libellés sont des phrases — « Commission
 * des lois constitutionnelles, de législation… » — et une barre verticale les
 * obligerait à pivoter, ce qui les rend illisibles au premier coup d'œil.
 */
export function BarresComptage({
  donnees,
  couleur = '#3b82f6',
  total,
  onSelection,
  sortantsParLabel,
}: {
  donnees: Comptage[];
  couleur?: string;
  /** Base des pourcentages. Par défaut, la somme des valeurs. */
  total?: number;
  /** Sélection des sortants représentés par une barre. */
  onSelection?: (mandatIds: string[], libelle: string) => void;
  /** Association des libellés aux identifiants de mandats, pour la sélection. */
  sortantsParLabel?: Record<string, string[]>;
}) {
  const { tooltip, handlers } = useChartTooltip();

  if (donnees.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>;
  }

  const max = Math.max(...donnees.map((d) => d.valeur));
  const base = total ?? donnees.reduce((somme, d) => somme + d.valeur, 0);

  return (
    <>
      <ul className="space-y-2.5">
        {donnees.map((entree) => {
          const pct = Math.round((entree.valeur / base) * 100);
          const contenuTooltip = {
            titre: entree.label,
            lignes: [
              { label: 'Sortants', valeur: String(entree.valeur) },
              { label: 'Part', valeur: `${pct} %` },
            ],
            couleur,
          };
          const mandatIds = sortantsParLabel?.[entree.label] ?? [];
          const interactif = onSelection !== undefined && sortantsParLabel !== undefined;

          return (
            <li key={entree.label}>
              <div
                className={`space-y-1 ${interactif ? 'cursor-pointer hover:opacity-80' : ''}`}
                {...handlers(contenuTooltip)}
                {...(interactif
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => onSelection(mandatIds, entree.label),
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelection(mandatIds, entree.label);
                        }
                      },
                    }
                  : {})}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {entree.label}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{entree.valeur}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {pct} %
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    // L'échelle est celle du maximum et non du total : sur huit
                    // commissions autour de 12 %, des barres calées sur le total
                    // seraient toutes écrasées et l'écart deviendrait invisible.
                    style={{ width: `${(entree.valeur / max) * 100}%`, backgroundColor: couleur }}
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
