"use client";

import type { Sortant } from "@clair/data";
import { couleurGroupe } from "@clair/ui";
import { useInfobulle } from "../composants/Infobulle.tsx";
import { TableauDonnees } from "../composants/TableauDonnees.tsx";
import { pointsActivite } from "../lib/graphiques.ts";
import type { Selection } from "./BarresComptage.tsx";
import classes from "./Graphiques.module.css";

/* Géométrie du dessin, en unités du `viewBox` (comme apps/web). */
const LARGEUR = 1000;
const HAUTEUR = 560;
const MARGE_GAUCHE = 78;
const MARGE_BASSE = 56;
const TAILLE_GRADUATION = 15;

/** Quatre repères ronds, suffisants pour situer un ordre de grandeur. */
const graduations = (max: number): number[] => [1, 2, 3, 4].map((i) => (max / 4) * i);

const formater = (valeur: number): string =>
  valeur >= 10 ? Math.round(valeur).toString() : valeur.toFixed(1);

/**
 * Interventions et amendements des sortants, ramenés au mois de mandat : les compteurs bruts
 * mesureraient surtout la durée du mandat.
 */
export const NuageActivite = ({
  sortants,
  onSelection,
}: {
  sortants: Sortant[];
  onSelection?: Selection;
}) => {
  const { infobulle, gestionnaires } = useInfobulle();
  const points = pointsActivite(sortants);
  if (points.length === 0) return <p className={classes.vide}>Aucune donnée disponible.</p>;

  const maxX = Math.max(...points.map((p) => p.interventions), 1);
  const maxY = Math.max(...points.map((p) => p.amendements), 1);
  const largeurUtile = LARGEUR - MARGE_GAUCHE;
  const hauteurUtile = HAUTEUR - MARGE_BASSE;
  const x = (valeur: number) => MARGE_GAUCHE + (valeur / maxX) * largeurUtile;
  const y = (valeur: number) => hauteurUtile - (valeur / maxY) * hauteurUtile;

  return (
    <div className={classes.pile}>
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className={classes.nuage}
        role="img"
        aria-label={`Nuage de points des ${points.length} sénateurs sortants, interventions par mois en abscisse et amendements par mois en ordonnée`}
      >
        {graduations(maxY).map((valeur) => (
          <g key={`y-${valeur}`}>
            <line
              x1={MARGE_GAUCHE}
              x2={LARGEUR}
              y1={y(valeur)}
              y2={y(valeur)}
              className={classes.grille}
              strokeWidth={1.5}
            />
            <text
              x={MARGE_GAUCHE - 12}
              y={y(valeur) + 8}
              textAnchor="end"
              fontSize={TAILLE_GRADUATION}
              className={classes.graduation}
            >
              {formater(valeur)}
            </text>
          </g>
        ))}
        {graduations(maxX).map((valeur) => (
          <text
            key={`x-${valeur}`}
            x={x(valeur)}
            y={HAUTEUR - 20}
            textAnchor="middle"
            fontSize={TAILLE_GRADUATION}
            className={classes.graduation}
          >
            {formater(valeur)}
          </text>
        ))}
        {points.map((point) => {
          const couleur = couleurGroupe(point.groupe, point.couleur);
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: le tableau des données donne l'accès clavier à chaque point ; le clic n'est qu'un raccourci de surbrillance.
            <circle
              key={point.mandatId}
              cx={x(point.interventions)}
              cy={y(point.amendements)}
              r={7}
              style={{ fill: couleur }}
              fillOpacity={0.75}
              opacity={0.85}
              className={classes.point}
              cursor={onSelection ? "pointer" : undefined}
              onClick={onSelection ? () => onSelection([point.mandatId], point.nom) : undefined}
              {...gestionnaires({
                titre: point.nom,
                couleur,
                lignes: [
                  { label: "Groupe", valeur: point.groupe },
                  { label: "Interventions / mois", valeur: point.interventions.toFixed(1) },
                  { label: "Amendements / mois", valeur: point.amendements.toFixed(1) },
                ],
              })}
            />
          );
        })}
      </svg>
      <div className={classes.axes}>
        <span>↑ Amendements par mois de mandat</span>
        <span>Interventions par mois de mandat →</span>
      </div>
      <TableauDonnees
        legende="Activité mensuelle des sortants"
        colonnes={[
          { cle: "nom", libelle: "Sortant" },
          { cle: "groupe", libelle: "Groupe" },
          { cle: "interventions", libelle: "Interventions par mois", numerique: true },
          { cle: "amendements", libelle: "Amendements par mois", numerique: true },
        ]}
        lignes={points.map((p) => ({
          nom: p.nom,
          groupe: p.groupe,
          interventions: p.interventions.toFixed(1).replace(".", ","),
          amendements: p.amendements.toFixed(1).replace(".", ","),
        }))}
      />
      {infobulle}
    </div>
  );
};
