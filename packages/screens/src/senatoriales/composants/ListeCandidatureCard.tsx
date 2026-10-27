"use client";

import type { ListeCandidature } from "@clair/data";
import { Link } from "@clair/ui";
import { couleurFamille, libelleFamille } from "../lib/familles.ts";
import { lienPersonne } from "../lib/format.ts";
import classes from "./Cartes.module.css";

/**
 * Une unité de vote : une liste au proportionnel, un binôme titulaire-remplaçant au majoritaire
 * (ce pour quoi l'électeur vote d'un bloc). Les noms des candidats déjà passés par le Parlement
 * renvoient à leur fiche.
 */
export const ListeCandidatureCard = ({ liste }: { liste: ListeCandidature }) => {
  const proportionnel = liste.modeScrutin === "proportionnel";
  const titulaires = liste.candidats.filter((c) => c.role === "titulaire");
  const remplacants = liste.candidats.filter((c) => c.role === "suppleant");
  const premier = titulaires[0];
  const titre = liste.libelle ?? (premier ? `${premier.prenom} ${premier.nom}` : "Candidature");

  return (
    <article className={classes.carte}>
      <div className={classes.listeTete}>
        <span
          className={classes.pointFamille}
          style={{ backgroundColor: couleurFamille(liste.famille) }}
          aria-hidden="true"
          title={libelleFamille(liste.famille)}
        />
        <div className={classes.listeTitres}>
          <h3 className={classes.titreCarte}>{titre}</h3>
          {liste.nuanceLibelle ? (
            <p className={classes.texteMention}>
              {liste.nuanceLibelle}
              {liste.famille === "droite_ou_extreme_droite" ? (
                <span className={classes.etiquette}>{libelleFamille(liste.famille)}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      <ol className={classes.candidats}>
        {titulaires.map((candidat) => (
          <li key={candidat.id}>
            {proportionnel ? (
              <span className={`${classes.rang} clair-chiffres`}>{candidat.ordre}</span>
            ) : null}
            <span className={classes.candidat}>
              {candidat.personne ? (
                <Link href={lienPersonne(candidat.personne)} className={classes.nomLien}>
                  {candidat.prenom} {candidat.nom}
                </Link>
              ) : (
                <span>
                  {candidat.prenom} {candidat.nom}
                </span>
              )}
              {candidat.sortant ? (
                <span className={classes.badge} data-ton="candidat">
                  sortant
                </span>
              ) : null}
              {candidat.profession ? (
                <span className={classes.petitBloc}>
                  {candidat.profession}
                  {candidat.anneeNaissance
                    ? ` · né${candidat.sexe === "F" ? "e" : ""} en ${candidat.anneeNaissance}`
                    : ""}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>

      {remplacants.length > 0 ? (
        <p className={classes.remplacants}>
          Remplaçant{remplacants.length > 1 ? "s" : ""} :{" "}
          {remplacants.map((c) => `${c.prenom} ${c.nom}`).join(", ")}
        </p>
      ) : null}
    </article>
  );
};
