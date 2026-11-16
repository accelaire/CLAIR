"use client";

import type { ApercuSenatoriales } from "@clair/data";
import { useNavigation } from "@clair/ui";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { libelleCirconscription } from "../lib/circonscription.ts";
import { slugDepuisCode } from "../lib/departements.ts";
import classes from "./Cartes.module.css";

type Circonscription = ApercuSenatoriales["circonscriptions"][number];

/**
 * Index des 64 circonscriptions, toujours rendu quel que soit le tri : le chemin le plus court
 * vers « et chez moi ? », et le maillage interne des pages départementales. En mobile, la liste
 * est repliée derrière un bouton (elle occupait plusieurs écrans) ; les liens restent dans la page.
 */
export const IndexCirconscriptions = ({
  circonscriptions,
}: {
  circonscriptions: Circonscription[];
}) => {
  const { Link } = useNavigation();
  const [deplie, setDeplie] = useState(false);
  const idListe = useId();
  if (circonscriptions.length === 0) return null;

  const triees = [...circonscriptions].sort((a, b) =>
    libelleCirconscription(a.nom).localeCompare(libelleCirconscription(b.nom), "fr"),
  );
  // `typeof === 'number'` : le champ est à la fois optionnel et nullable.
  const avecCandidats = triees.some((circo) => typeof circo.nbCandidats === "number");

  return (
    <section aria-labelledby="index-circonscriptions" className={classes.pile}>
      <div>
        <h2 id="index-circonscriptions" className={classes.titreSection}>
          Les {circonscriptions.length} circonscriptions concernées
        </h2>
        <p className={classes.chapeauSection}>
          {avecCandidats
            ? "Les candidats, le mode de scrutin et le bilan des sortants, circonscription par circonscription."
            : "Le mode de scrutin et le bilan des sortants, circonscription par circonscription."}
        </p>
      </div>
      <button
        type="button"
        className={classes.indexBascule}
        aria-expanded={deplie}
        aria-controls={idListe}
        onClick={() => setDeplie((etat) => !etat)}
      >
        {deplie
          ? "Masquer la liste des circonscriptions"
          : `Afficher les ${circonscriptions.length} circonscriptions`}
        <ChevronDown className={classes.indexChevron} aria-hidden="true" />
      </button>
      <ul id={idListe} className={classes.index} data-replie={deplie ? undefined : true}>
        {triees.map((circo) => (
          <li key={circo.departement}>
            <Link
              href={`/senatoriales-2026/${slugDepuisCode(circo.departement) ?? ""}`}
              className={classes.indexLien}
            >
              <span className={classes.indexNom}>{libelleCirconscription(circo.nom)}</span>
              <span className={`${classes.indexChiffres} clair-chiffres`}>
                {typeof circo.nbCandidats === "number" ? (
                  <>
                    {circo.nbCandidats} <abbr title="candidats">cand.</abbr> ·{" "}
                  </>
                ) : null}
                {circo.nbSieges} {circo.nbSieges > 1 ? "sièges" : "siège"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
