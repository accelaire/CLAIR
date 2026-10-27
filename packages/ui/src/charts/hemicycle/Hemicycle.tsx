"use client";

import { type CSSProperties, useId, useMemo, useState } from "react";
import { Link } from "../../core/link/Link.tsx";
import { couleurGroupe } from "../../parliament/groupe-badge/GroupeBadge.tsx";
import classes from "./Hemicycle.module.css";
import { assignSeats, seatPositions } from "./hemicycle-geometry.ts";

export type HemicycleGroup = {
  /** Identifiant stable (slug du groupe). */
  id: string;
  /** Sigle, toujours affiché dans la légende (jamais la couleur seule). */
  sigle: string;
  /** Nom complet du groupe. */
  nom: string;
  /** Nombre de sièges. */
  sieges: number;
  /**
   * Couleur du groupe fournie par les données (« #CC2443 » ou « 204,36,67 ») ; absente ou noire :
   * token du sigle, comme `GroupeBadge`, pour qu'un groupe garde la même couleur partout.
   */
  couleur?: string | null;
  /** Page du groupe : la ligne de légende devient un lien. */
  href?: string;
};

export type HemicycleProps = {
  /** Groupes, dans l'ordre d'affichage de gauche à droite (fourni par les données). */
  groupes: HemicycleGroup[];
  /** Nombre de sièges de la chambre (577 à l'Assemblée, 348 au Sénat) ; le reste est vacant. */
  totalSieges?: number;
  /** Titre du graphique, qui nomme aussi l'image. */
  title: string;
  /** Niveau du titre ; `false` le masque visuellement (dans un `ChartFrame` titré). */
  headingLevel?: 2 | 3 | 4 | false;
  /** Description textuelle de la répartition ; générée à partir des groupes par défaut. */
  description?: string;
};

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

const VIEW_WIDTH = 500;
const VIEW_HEIGHT = 270;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT - 10;
const INNER_RADIUS = 80;
const OUTER_RADIUS = 240;
const SEAT_RADIUS = 5;

const numberFormat = new Intl.NumberFormat("fr-FR");

const siegesLabel = (count: number) => `${numberFormat.format(count)} siège${count > 1 ? "s" : ""}`;

/** Couleur de groupe passée en variable CSS : c'est une donnée, pas un style en dur. */
const colorStyle = (color: string): CustomProperties => ({ "--siege-couleur": color });

const colorOf = (group: HemicycleGroup) => couleurGroupe(group.sigle, group.couleur);

/** Description textuelle par défaut : chaque groupe et son nombre de sièges. */
export const describeHemicycle = (groupes: HemicycleGroup[], totalSieges: number) => {
  const occupied = groupes.reduce((sum, group) => sum + group.sieges, 0);
  const parts = groupes.map(
    (group) => `${group.sigle} (${group.nom}) : ${siegesLabel(group.sieges)}`,
  );
  const vacant = totalSieges - occupied;
  if (vacant > 0) parts.push(`${siegesLabel(vacant)} vacant${vacant > 1 ? "s" : ""}`);
  return `Répartition des ${siegesLabel(totalSieges)}, de gauche à droite : ${parts.join(" ; ")}.`;
};

/**
 * Hémicycle en SVG : un point par siège, coloré par groupe. L'image est nommée par son titre et
 * décrite en texte (répartition complète) ; la légende donne sigle et nombre de sièges.
 * Survoler ou parcourir au clavier la légende met en avant les sièges d'un groupe.
 */
export const Hemicycle = ({
  groupes,
  totalSieges,
  title,
  headingLevel = 3,
  description,
}: HemicycleProps) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const occupied = groupes.reduce((sum, group) => sum + group.sieges, 0);
  const total = Math.max(totalSieges ?? occupied, occupied);

  const seats = useMemo(
    () =>
      assignSeats(
        seatPositions(total, CENTER_X, CENTER_Y, INNER_RADIUS, OUTER_RADIUS),
        groupes.map((group) => ({
          group: { id: group.id, color: colorOf(group) },
          seats: group.sieges,
        })),
      ),
    [groupes, total],
  );

  const Heading = headingLevel === false ? "p" : (`h${headingLevel}` as const);

  return (
    <div className={classes.hemicycle} data-highlighted={highlighted ?? undefined}>
      <Heading
        id={titleId}
        className={headingLevel === false ? "clair-visually-hidden" : classes.title}
      >
        {title}
      </Heading>
      <p id={descriptionId} className="clair-visually-hidden">
        {description ?? describeHemicycle(groupes, total)}
      </p>
      <svg
        className={classes.svg}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title>{title}</title>
        {seats.map(({ position, group }) => (
          <circle
            key={`${position.row}-${position.angle}`}
            className={classes.seat}
            cx={position.x}
            cy={position.y}
            r={SEAT_RADIUS}
            data-vacant={group === null || undefined}
            data-dimmed={(highlighted !== null && group?.id !== highlighted) || undefined}
            style={group ? colorStyle(group.color) : undefined}
          />
        ))}
        <text className={classes.total} x={CENTER_X} y={CENTER_Y - 12} textAnchor="middle">
          {siegesLabel(total)}
        </text>
      </svg>
      <ul className={classes.legend} aria-label={`Légende : ${title}`}>
        {groupes.map((group) => {
          const content = (
            <>
              <span
                className={classes.swatch}
                aria-hidden="true"
                style={colorStyle(colorOf(group))}
              />
              <abbr className={classes.sigle} title={group.nom}>
                {group.sigle}
              </abbr>
              <span className={classes.count}>{siegesLabel(group.sieges)}</span>
              <span className="clair-visually-hidden"> ({group.nom})</span>
            </>
          );
          return (
            <li
              key={group.id}
              className={classes.legendItem}
              data-active={highlighted === group.id || undefined}
              onMouseEnter={() => setHighlighted(group.id)}
              onMouseLeave={() => setHighlighted(null)}
              onFocus={() => setHighlighted(group.id)}
              onBlur={() => setHighlighted(null)}
            >
              {group.href ? (
                <Link href={group.href} className={classes.legendLink}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
