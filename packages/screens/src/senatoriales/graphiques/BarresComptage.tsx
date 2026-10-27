"use client";

import type { ReactNode } from "react";
import { type ContenuInfobulle, useInfobulle } from "../composants/Infobulle.tsx";
import { TableauDonnees } from "../composants/TableauDonnees.tsx";
import { COULEUR_PRINCIPALE } from "../lib/couleurs.ts";
import type { Comptage } from "../lib/graphiques.ts";
import classes from "./Graphiques.module.css";

export type Selection = (mandatIds: string[], libelle: string) => void;

/**
 * Une entrée de graphique : un bouton quand elle sert à sélectionner des sortants (clavier et
 * nom accessible natifs), un simple bloc sinon.
 */
export const EntreeGraphique = ({
  selectionnable,
  onSelect,
  gestionnaires,
  className,
  libelle,
  children,
}: {
  selectionnable: boolean;
  onSelect: () => void;
  gestionnaires: ReturnType<ReturnType<typeof useInfobulle>["gestionnaires"]>;
  className?: string;
  /** Nom accessible du bouton : ce que la sélection va surligner. */
  libelle: string;
  children: ReactNode;
}) =>
  selectionnable ? (
    <button
      type="button"
      className={`${classes.entree} ${className ?? ""}`}
      data-interactif
      onClick={onSelect}
      aria-label={libelle}
      {...gestionnaires}
    >
      {children}
    </button>
  ) : (
    <div className={`${classes.entree} ${className ?? ""}`} {...gestionnaires}>
      {children}
    </div>
  );

/**
 * Barres horizontales pour un décompte par catégorie (commissions, professions). Horizontales :
 * les libellés sont des phrases. L'échelle est celle du maximum, pas du total, pour que les
 * écarts restent visibles.
 */
export const BarresComptage = ({
  donnees,
  couleur = COULEUR_PRINCIPALE,
  total,
  onSelection,
  sortantsParLabel,
  legende = "Sortants par catégorie",
}: {
  donnees: Comptage[];
  couleur?: string;
  /** Base des pourcentages. Par défaut, la somme des valeurs. */
  total?: number;
  onSelection?: Selection;
  /** Association des libellés aux identifiants de mandats, pour la sélection. */
  sortantsParLabel?: Record<string, string[]>;
  /** Légende du tableau des données. */
  legende?: string;
}) => {
  const { infobulle, gestionnaires } = useInfobulle();

  if (donnees.length === 0) {
    return <p className={classes.vide}>Aucune donnée disponible.</p>;
  }

  const max = Math.max(...donnees.map((d) => d.valeur));
  const base = total ?? donnees.reduce((somme, d) => somme + d.valeur, 0);
  const pct = (valeur: number) => Math.round((valeur / base) * 100);
  const interactif = onSelection !== undefined && sortantsParLabel !== undefined;

  return (
    <>
      <ul className={classes.barres}>
        {donnees.map((entree) => {
          const contenu: ContenuInfobulle = {
            titre: entree.label,
            lignes: [
              { label: "Sortants", valeur: String(entree.valeur) },
              { label: "Part", valeur: `${pct(entree.valeur)} %` },
            ],
            couleur,
          };
          return (
            <li key={entree.label}>
              <EntreeGraphique
                selectionnable={interactif}
                onSelect={() => onSelection?.(sortantsParLabel?.[entree.label] ?? [], entree.label)}
                gestionnaires={gestionnaires(contenu)}
                libelle={`Surligner les sortants : ${entree.label}, ${entree.valeur}`}
              >
                <span className={classes.ligneTexte}>
                  <span className={classes.libelleTronque}>{entree.label}</span>
                  <span className="clair-chiffres">
                    <strong>{entree.valeur}</strong>
                    <span className={classes.mention}> · {pct(entree.valeur)} %</span>
                  </span>
                </span>
                <span className={classes.piste} data-taille="fine">
                  <span
                    className={classes.remplissage}
                    style={{ width: `${(entree.valeur / max) * 100}%`, backgroundColor: couleur }}
                  />
                </span>
              </EntreeGraphique>
            </li>
          );
        })}
      </ul>
      <TableauDonnees
        legende={legende}
        colonnes={[
          { cle: "label", libelle: "Catégorie" },
          { cle: "valeur", libelle: "Sortants", numerique: true },
          { cle: "part", libelle: "Part", numerique: true },
        ]}
        lignes={donnees.map((d) => ({
          label: d.label,
          valeur: d.valeur,
          part: `${pct(d.valeur)} %`,
        }))}
      />
      {infobulle}
    </>
  );
};
