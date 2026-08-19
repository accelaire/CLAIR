'use client';

import { useMemo } from 'react';
import { pointsActivite } from '@/lib/senatoriales/graphiques';
import { useChartTooltip } from '@/components/charts/ChartTooltip';
import type { Sortant } from '../../PageClient';

const LARGEUR = 1000;
const HAUTEUR = 560;
const MARGE_GAUCHE = 78;
const MARGE_BASSE = 56;

/**
 * Interventions et amendements des sortants, ramenés au mois de mandat.
 *
 * Les compteurs bruts mesurent surtout la durée du mandat : un sénateur arrivé
 * en remplacement en 2024 ne pouvait pas déposer autant d'amendements qu'un
 * autre présent depuis 2020. Le nuage brut aurait donc surtout dessiné la date
 * d'arrivée. Divisés par la durée réellement couverte, les deux axes redeviennent
 * comparables.
 */
export function NuageActivite({
  sortants,
  onSelection,
}: {
  sortants: Sortant[];
  /** Sélection d'un sortant depuis son point. */
  onSelection?: (mandatIds: string[], libelle: string) => void;
}) {
  const { tooltip, handlers } = useChartTooltip();

  const { points, maxX, maxY } = useMemo(() => {
    const points = pointsActivite(sortants);
    return {
      points,
      maxX: Math.max(...points.map((p) => p.interventions), 1),
      maxY: Math.max(...points.map((p) => p.amendements), 1),
    };
  }, [sortants]);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>;
  }

  const largeurUtile = LARGEUR - MARGE_GAUCHE;
  const hauteurUtile = HAUTEUR - MARGE_BASSE;
  const x = (valeur: number) => MARGE_GAUCHE + (valeur / maxX) * largeurUtile;
  const y = (valeur: number) => hauteurUtile - (valeur / maxY) * hauteurUtile;

  const graduationsX = graduations(maxX);
  const graduationsY = graduations(maxY);

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Nuage de points des ${points.length} sénateurs sortants, interventions par mois en abscisse et amendements par mois en ordonnée`}
      >
        {graduationsY.map((valeur) => (
          <g key={`y-${valeur}`}>
            <line
              x1={MARGE_GAUCHE}
              x2={LARGEUR}
              y1={y(valeur)}
              y2={y(valeur)}
              className="stroke-border"
              strokeWidth={1.5}
            />
            <text
              x={MARGE_GAUCHE - 12}
              y={y(valeur) + 8}
              textAnchor="end"
              className="fill-muted-foreground text-[15px]"
            >
              {formater(valeur)}
            </text>
          </g>
        ))}

        {graduationsX.map((valeur) => (
          <text
            key={`x-${valeur}`}
            x={x(valeur)}
            y={HAUTEUR - 20}
            textAnchor="middle"
            className="fill-muted-foreground text-[15px]"
          >
            {formater(valeur)}
          </text>
        ))}

        {points.map((point) => (
          <circle
            key={point.mandatId}
            cx={x(point.interventions)}
            cy={y(point.amendements)}
            r={7}
            fill={point.couleur}
            fillOpacity={0.75}
            // Le point survolé passe en pleine opacité et prend un liseré : c'est
            // le seul repère possible dans un nuage où les disques se chevauchent.
            className="transition-opacity hover:opacity-100 hover:stroke-foreground [stroke-width:2]"
            opacity={0.85}
            // Décrit par `aria-label` plutôt que par un `<title>` : ce dernier
            // déclenche l'infobulle native du navigateur, qui doublonnerait.
            aria-label={`${point.nom} (${point.groupe}) — ${point.interventions.toFixed(1)} interventions et ${point.amendements.toFixed(1)} amendements par mois`}
            cursor={onSelection ? 'pointer' : undefined}
            onClick={onSelection ? () => onSelection([point.mandatId], point.nom) : undefined}
            {...handlers({
              titre: point.nom,
              couleur: point.couleur,
              lignes: [
                { label: 'Groupe', valeur: point.groupe },
                { label: 'Interventions / mois', valeur: point.interventions.toFixed(1) },
                { label: 'Amendements / mois', valeur: point.amendements.toFixed(1) },
              ],
            })}
          />
        ))}
      </svg>

      {/* L'ordre suit celui des axes : la légende de l'axe vertical se lit à
          gauche, là où l'axe se trouve, celle de l'axe horizontal sous lui. */}
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>↑ Amendements par mois de mandat</span>
        <span>Interventions par mois de mandat →</span>
      </div>
      {tooltip}
    </div>
  );
}

/** Quatre repères ronds, suffisants pour situer un ordre de grandeur. */
function graduations(max: number): number[] {
  const pas = max / 4;
  return [1, 2, 3, 4].map((i) => pas * i);
}

function formater(valeur: number): string {
  return valeur >= 10 ? Math.round(valeur).toString() : valeur.toFixed(1);
}
