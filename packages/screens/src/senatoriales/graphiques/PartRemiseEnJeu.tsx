"use client";

import type { GroupeRepartition, Sortant } from "@clair/data";
import { couleurGroupe } from "@clair/ui";
import { useInfobulle } from "../composants/Infobulle.tsx";
import { TableauDonnees } from "../composants/TableauDonnees.tsx";
import { partsRemisesEnJeu } from "../lib/graphiques.ts";
import { EntreeGraphique, type Selection } from "./BarresComptage.tsx";
import classes from "./Graphiques.module.css";

/**
 * Part des sièges que chaque groupe remet en jeu : la barre montre la proportion, le chiffre à
 * droite rappelle l'effectif (remettre 100 % de trois sièges n'est pas remettre la moitié de cent).
 */
export const PartRemiseEnJeu = ({
  parGroupe,
  sortants,
  onSelection,
}: {
  parGroupe: GroupeRepartition[];
  /** Sortants complets, pour résoudre les mandats d'un groupe. */
  sortants?: Sortant[];
  onSelection?: Selection;
}) => {
  const { infobulle, gestionnaires } = useInfobulle();
  const parts = partsRemisesEnJeu(parGroupe);
  if (parts.length === 0) return null;
  const interactif = onSelection !== undefined && sortants !== undefined;

  return (
    <>
      <ul className={classes.barres} data-espace="large">
        {parts.map((groupe) => {
          const couleur = couleurGroupe(groupe.nom, groupe.couleur);
          const mandatIds = (sortants ?? [])
            .filter((s) => (s.groupe?.slug ?? "sans-groupe") === groupe.slug)
            .map((s) => s.mandatId);
          const part = Math.round(groupe.part);
          return (
            <li key={groupe.slug}>
              <EntreeGraphique
                selectionnable={interactif}
                onSelect={() => onSelection?.(mandatIds, groupe.nom)}
                libelle={`Surligner les sortants du groupe ${groupe.nom}, ${groupe.sieges} sur ${groupe.siegesSenat} sièges, ${part} %`}
                gestionnaires={gestionnaires({
                  titre: groupe.nom,
                  lignes: [
                    { label: "Remis en jeu", valeur: String(groupe.sieges) },
                    { label: "Total au Sénat", valeur: String(groupe.siegesSenat) },
                    { label: "Part", valeur: `${part} %` },
                  ],
                  couleur,
                })}
              >
                <span className={classes.ligneTexte}>
                  <span className={classes.libelleAvecPastille}>
                    <span
                      className={classes.pastille}
                      style={{ backgroundColor: couleur }}
                      aria-hidden="true"
                    />
                    <strong className={classes.libelleTronque}>{groupe.nom}</strong>
                  </span>
                  <span className={`${classes.mention} clair-chiffres`}>
                    {groupe.sieges}/{groupe.siegesSenat} siège{groupe.siegesSenat > 1 ? "s" : ""} ·{" "}
                    <strong className={classes.fort}>{part} %</strong>
                  </span>
                </span>
                <span className={classes.piste}>
                  <span
                    className={classes.remplissage}
                    style={{ width: `${Math.max(groupe.part, 1.5)}%`, backgroundColor: couleur }}
                  />
                </span>
              </EntreeGraphique>
            </li>
          );
        })}
      </ul>
      <TableauDonnees
        legende="Part des sièges remise en jeu, par groupe"
        colonnes={[
          { cle: "groupe", libelle: "Groupe" },
          { cle: "sieges", libelle: "Sièges remis en jeu", numerique: true },
          { cle: "senat", libelle: "Sièges au Sénat", numerique: true },
          { cle: "part", libelle: "Part", numerique: true },
        ]}
        lignes={parts.map((g) => ({
          groupe: g.nom,
          sieges: g.sieges,
          senat: g.siegesSenat,
          part: `${Math.round(g.part)} %`,
        }))}
      />
      {infobulle}
    </>
  );
};
