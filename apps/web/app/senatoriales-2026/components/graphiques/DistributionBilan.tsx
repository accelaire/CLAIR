'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  bandesBilan,
  extremesBilan,
  mediane,
  type MetriqueBilan,
} from '@/lib/senatoriales/graphiques';
import { useChartTooltip } from '@/components/charts/ChartTooltip';
import type { Sortant } from '../../PageClient';

/** En deçà, la liste des plus bas recouvrirait l'essentiel de la sélection. */
const SEUIL_EXTREMES = 15;

const LIBELLES: Record<MetriqueBilan, { nom: string; couleur: string }> = {
  presence: { nom: 'présence en séance', couleur: '#3b82f6' },
  loyaute: { nom: 'loyauté au groupe', couleur: '#8b5cf6' },
};

/**
 * Répartition des sortants par tranche de présence ou de loyauté.
 *
 * Le premier essai plaçait un point par sénateur sur un axe de 0 à 100 : la
 * forme est séduisante, mais elle ne survit pas à ces données. Les deux taux
 * sont écrasés vers le haut — médiane 98 % dans les deux cas — et tous les points
 * se superposaient en une colonne contre le bord droit. Les tranches, elles,
 * montrent ce qui compte : la masse est au-dessus de 95 %, et une dizaine de
 * sortants en sont très loin.
 */
export function DistributionBilan({
  sortants,
  metrique,
  onSelection,
}: {
  sortants: Sortant[];
  metrique: MetriqueBilan;
  /** Sélection des sortants d'une tranche pour filtrer la liste. */
  onSelection?: (mandatIds: string[], libelle: string) => void;
}) {
  const { tooltip, handlers } = useChartTooltip();

  const { bandes, valeurMediane, extremes, mesures } = useMemo(() => {
    const bandes = bandesBilan(sortants, metrique);
    const valeurs = sortants
      .map((s) => s.bilan[metrique])
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    return {
      bandes,
      valeurMediane: mediane(valeurs),
      extremes: extremesBilan(sortants, metrique, 5),
      mesures: valeurs.length,
    };
  }, [sortants, metrique]);

  if (mesures === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>;
  }

  const max = Math.max(...bandes.map((b) => b.effectif), 1);
  const { nom, couleur } = LIBELLES[metrique];

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {bandes.map((bande) => {
          const contenuTooltip = {
            titre: bande.label,
            lignes: [{ label: 'Sortants', valeur: String(bande.effectif) }],
          };
          const mandatIds = sortants
            .filter((s) => {
              const v = s.bilan[metrique];
              if (v === null) return false;
              return bande.max === 100 ? v >= bande.min : v >= bande.min && v < bande.max;
            })
            .map((s) => s.mandatId);

          return (
            <li
              key={bande.label}
              className={`flex items-center gap-3 text-sm ${onSelection ? 'cursor-pointer hover:opacity-80' : ''}`}
              {...handlers(contenuTooltip)}
              {...(onSelection
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onSelection(mandatIds, bande.label),
                    onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelection(mandatIds, bande.label);
                      }
                    },
                  }
                : {})}
            >
              <span className="w-28 shrink-0 text-right text-muted-foreground">
                {bande.label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                {bande.effectif > 0 && (
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${(bande.effectif / max) * 100}%`,
                      backgroundColor: couleur,
                    }}
                  />
                )}
              </div>
              <span className="w-8 shrink-0 tabular-nums text-right font-medium">
                {bande.effectif}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        {mesures} sortants mesurés, médiane à{' '}
        {valeurMediane !== null ? Math.round(valeurMediane) : '—'} % de {nom}.{' '}
        <Link href="/methodologie" className="underline hover:text-foreground">
          Comment ce taux est calculé
        </Link>
        .
      </p>

      {/* La queue ne se détache que s'il y a une masse dont se détacher. Sur une
          sélection de six sortants, « les cinq taux les plus bas » désignent
          presque tout le monde et n'apprennent plus rien. */}
      {mesures >= SEUIL_EXTREMES && extremes.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-semibold">Les cinq taux les plus bas</h4>
          <ul className="space-y-1">
            {extremes.map((point) => (
              <li key={point.slug} className="flex items-baseline gap-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
                  style={{ backgroundColor: point.couleur }}
                />
                <Link
                  href={`/senateurs/${point.slug}`}
                  className="truncate hover:underline"
                >
                  {point.nom}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{point.groupe}</span>
                <span className="ml-auto shrink-0 tabular-nums font-medium">
                  {Math.round(point.valeur)} %
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Un taux bas peut refléter une absence de longue durée, un mandat interrompu
            ou une entrée tardive au Sénat : le chiffre ne dit pas la raison.
          </p>
        </div>
      )}
      {tooltip}
    </div>
  );
}
