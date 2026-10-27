"use client";

import type { TriSortants } from "@clair/data";
import { useNavigation } from "@clair/ui";
import { LECTURES } from "../lib/graphiques.ts";
import classes from "./PastillesLecture.module.css";

export type Pastille = {
  cle: string;
  label: string;
  /** Phrase de survol : ce que la pastille montre. */
  aide?: string;
  /** Renseignée, la pastille devient un lien ; sinon elle appelle `onSelect`. */
  href?: string;
};

/**
 * Bande de pastilles horizontale, partagée par la page mère (elles changent le tri et le
 * graphique affiché) et les pages de graphique (elles changent de page). La pastille courante
 * ne se lie pas à elle-même.
 */
export const PastillesLecture = ({
  titre,
  pastilles,
  actif,
  onSelect,
}: {
  titre: string;
  pastilles: Pastille[];
  actif: string;
  onSelect?: (cle: string) => void;
}) => {
  const { Link } = useNavigation();
  return (
    <section className={classes.section}>
      <h2 className={classes.titre}>{titre}</h2>
      <div className={classes.bande}>
        {pastilles.map((pastille) => {
          const selectionne = actif === pastille.cle;
          if (pastille.href) {
            return selectionne ? (
              <span key={pastille.cle} aria-current="page" className={classes.pastille} data-actif>
                {pastille.label}
              </span>
            ) : (
              <Link
                key={pastille.cle}
                href={pastille.href}
                title={pastille.aide}
                className={classes.pastille}
              >
                {pastille.label}
              </Link>
            );
          }
          return (
            <button
              key={pastille.cle}
              type="button"
              onClick={() => onSelect?.(pastille.cle)}
              title={pastille.aide}
              aria-pressed={selectionne}
              className={classes.pastille}
              data-actif={selectionne || undefined}
            >
              {pastille.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

/**
 * Choix de la lecture appliquée aux sortants : il commande le graphique affiché et le
 * regroupement de la liste, d'où des pastilles toujours visibles plutôt qu'une liste déroulante.
 */
export const SelecteurLecture = ({
  valeur,
  onChange,
}: {
  valeur: TriSortants | "";
  onChange: (tri: TriSortants) => void;
}) => (
  <PastillesLecture
    titre="Lire les sortants par…"
    actif={valeur || "departement"}
    onSelect={(cle) => {
      const lecture = LECTURES.find((l) => l.tri === cle);
      if (lecture) onChange(lecture.tri);
    }}
    pastilles={LECTURES.map((lecture) => ({
      cle: lecture.tri,
      label: lecture.label,
      aide: lecture.aide,
    }))}
  />
);
