"use client";

import type { EntreeDuSommaire } from "@clair/data";
import { formatDossierTitre, Link } from "@clair/ui";
import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { pluriel } from "../shared/reunions/reunions.ts";
import { LigneDeScrutin } from "../shared/reunions/ScrutinsDeSeance.tsx";
import classes from "./ReunionScreen.module.css";

const titreDe = (entree: EntreeDuSommaire) => {
  const dossier = entree.dossiers[0];
  return entree.source === "dossier" && dossier
    ? formatDossierTitre(dossier.titre, dossier.procedureLibelle)
    : entree.titre;
};

const Point = ({
  entree,
  hrefDuRang,
}: {
  entree: EntreeDuSommaire;
  hrefDuRang: (rang: number) => string;
}) => {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  const depliable = entree.scrutins.length > 0 || entree.dossiers.length > 0;
  const prises =
    entree.nbPrises !== null && entree.nbPrises > 0
      ? pluriel(entree.nbPrises, "prise de parole", "prises de parole")
      : null;
  return (
    <li className={classes.point}>
      <div className={classes.pointLigne}>
        {depliable ? (
          <button
            type="button"
            className={classes.pointBouton}
            aria-expanded={ouvert}
            aria-controls={id}
            onClick={() => setOuvert((etat) => !etat)}
          >
            <ChevronRight
              className={classes.chevron}
              data-ouvert={ouvert || undefined}
              aria-hidden="true"
            />
            <span>{titreDe(entree)}</span>
          </button>
        ) : (
          <span className={classes.pointTitre}>{titreDe(entree)}</span>
        )}
        <span className={classes.pointAnnexes}>
          {entree.scrutins.length > 0 ? (
            <span className={classes.mention}>{pluriel(entree.scrutins.length, "vote")}</span>
          ) : null}
          {prises && entree.ordre !== null ? (
            <Link href={hrefDuRang(entree.ordre)}>
              {prises}
              <span className="clair-visually-hidden"> : {titreDe(entree)}</span>
            </Link>
          ) : prises ? (
            <span className={classes.mention}>{prises}</span>
          ) : null}
        </span>
      </div>
      {depliable ? (
        <div id={id} hidden={!ouvert} className={classes.pointDetail}>
          {entree.dossiers.length > 0 ? (
            <ul className={classes.listeSimple}>
              {entree.dossiers.map((dossier) => (
                <li key={dossier.id}>
                  <Link href={`/dossiers/${encodeURIComponent(dossier.uid)}`}>
                    {entree.source === "dossier"
                      ? "Voir le dossier législatif"
                      : formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {entree.scrutins.length > 0 ? (
            <ul className={classes.listeSimple}>
              {entree.scrutins.map((scrutin) => (
                <LigneDeScrutin key={scrutin.id} scrutin={scrutin} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

/**
 * Sommaire d'une séance : les points annoncés par la présidence (ou, au Sénat, les textes mis
 * aux voix), dépliables sur leurs textes et leurs votes ; le nombre de prises de parole mène au
 * passage du débat.
 */
export const SommaireDeSeance = ({
  entrees,
  votesDuJour,
  hrefDuRang,
}: {
  entrees: EntreeDuSommaire[];
  votesDuJour: boolean;
  hrefDuRang: (rang: number) => string;
}) => {
  if (entrees.length === 0) return null;
  const annonce = entrees.some((entree) => entree.source === "annonce");
  return (
    <section className={classes.section} aria-labelledby="sommaire">
      <h2 id="sommaire" className={classes.titreSection}>
        {annonce ? "Ordre du jour de la séance" : "Textes examinés"}
      </h2>
      <p className={classes.aide}>
        {annonce
          ? "Les points tels que la présidence les a appelés en séance. Dépliez-en un pour voir ce qui y a été voté."
          : "Les textes mis aux voix ce jour-là. Dépliez-en un pour voir ses votes."}
        {votesDuJour
          ? " Le compte rendu ne nomme pas la séance à laquelle chaque scrutin se rattache : ceux-ci sont les votes de la journée."
          : null}
      </p>
      <ul className={classes.sommaire}>
        {entrees.map((entree) => (
          <Point key={entree.cle} entree={entree} hrefDuRang={hrefDuRang} />
        ))}
      </ul>
    </section>
  );
};
