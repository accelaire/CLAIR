"use client";

import type { CandidatureSortant, Sortant, SortDuSortant } from "@clair/data";
import { couleurGroupe, ParlementaireAvatar, useNavigation } from "@clair/ui";
import { nomGroupe } from "../lib/format.ts";
import classes from "./Cartes.module.css";

/** Une statistique absente s'affiche « — », jamais « 0 » : l'absence de mesure n'est pas zéro. */
const fmt = (v: number | null | undefined, suffixe = "") =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("fr-FR")}${suffixe}`;

/**
 * Détail de la candidature, en infobulle : au proportionnel, le rang sur la liste vaut d'être
 * dit ; au majoritaire, il ne veut rien dire.
 */
const titreCandidature = (candidature: CandidatureSortant): string => {
  const morceaux: string[] = [];
  if (candidature.libelle) morceaux.push(`Liste « ${candidature.libelle} »`);
  if (candidature.modeScrutin === "proportionnel") {
    morceaux.push(`${candidature.ordre}${candidature.ordre === 1 ? "re" : "e"} position`);
  }
  if (candidature.role === "suppleant") morceaux.push("en remplaçant");
  return morceaux.length > 0 ? morceaux.join(" — ") : "Candidat au renouvellement du 27 septembre";
};

const libelleSort = (sort: SortDuSortant, sexe: string | null) => {
  if (sort === "reelu") return `${sexe === "F" ? "Réélue" : "Réélu"} le 27 septembre`;
  if (sort === "battu") return sexe === "F" ? "Battue" : "Battu";
  return "Ne se représentait pas";
};

/**
 * Carte d'un sénateur sortant : groupe, circonscription, commission, candidature ou sort au
 * scrutin, et bilan de mandature (statistiques calculées, identiques à celles de sa fiche).
 */
export const SortantCard = ({
  sortant,
  surbrillance = false,
  candidaturesPubliees = false,
  sort,
}: {
  sortant: Sortant;
  /** Carte désignée par une sélection faite dans un graphique (anneau, et mention lue). */
  surbrillance?: boolean;
  /**
   * Les candidatures sont-elles publiées ? Sans ce drapeau, une candidature absente serait
   * indiscernable d'un fichier pas encore paru : la donnée manquante doit rester muette.
   */
  candidaturesPubliees?: boolean;
  /** Issue du scrutin pour ce sortant, une fois les résultats publiés. */
  sort?: SortDuSortant;
}) => {
  const { Link } = useNavigation();
  const nom = `${sortant.personne.prenom} ${sortant.personne.nom}`;
  const sortConnu = sort !== undefined && sort !== "en_attente";

  return (
    <Link
      href={`/senateurs/${sortant.personne.slug}`}
      className={classes.sortant}
      data-surbrillance={surbrillance || undefined}
    >
      <span className={classes.sortantTete}>
        <ParlementaireAvatar nom={nom} photoUrl={sortant.personne.photoUrl} size="lg" decorative />
        <span className={classes.sortantIdentite}>
          <span className={classes.sortantNom}>
            {nom}
            {surbrillance ? <span className="clair-visually-hidden"> (surligné)</span> : null}
          </span>
          <span className={classes.groupe}>
            <span
              className={classes.pointGroupe}
              style={{
                backgroundColor: couleurGroupe(nomGroupe(sortant.groupe), sortant.groupe?.couleur),
              }}
              aria-hidden="true"
            />
            <span>{nomGroupe(sortant.groupe)}</span>
          </span>
          {sortant.circonscription ? (
            <span className={classes.petit}>{sortant.circonscription.nom}</span>
          ) : null}
        </span>
      </span>

      {sortant.commissionPermanente ? (
        <span className={classes.commission}>{sortant.commissionPermanente}</span>
      ) : null}

      <span className={classes.badges}>
        {sortConnu ? (
          <span className={classes.badge} data-ton={sort}>
            {libelleSort(sort, sortant.personne.sexe)}
          </span>
        ) : null}
        {!sortConnu && candidaturesPubliees ? (
          sortant.candidature ? (
            <span
              className={classes.badge}
              data-ton="candidat"
              title={titreCandidature(sortant.candidature)}
            >
              Se représente
            </span>
          ) : (
            <span className={classes.badge} data-ton="pointille">
              Ne se représente pas
            </span>
          )
        ) : null}
        {!sortant.mandat.mandatComplet ? (
          <span className={classes.badge} data-ton="neutre">
            En fonction depuis{" "}
            {new Date(sortant.mandat.dateDebut).toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
              timeZone: "Europe/Paris",
            })}
          </span>
        ) : null}
        {sortant.mandat.interrompu ? (
          <span
            className={classes.badge}
            data-ton="neutre"
            title="Mandat exercé en plusieurs périodes, une entrée au gouvernement l'ayant suspendu. Les chiffres ci-dessous couvrent l'ensemble du passage au Sénat."
          >
            Mandat interrompu
          </span>
        ) : null}
      </span>

      <span className={classes.bilan}>
        {(
          [
            [fmt(sortant.bilan.presence, " %"), "Présence"],
            [fmt(sortant.bilan.loyaute, " %"), "Loyauté"],
            [fmt(sortant.bilan.interventions), "Interventions"],
            [fmt(sortant.bilan.amendements), "Amendements"],
          ] as const
        ).map(([valeur, libelle]) => (
          <span key={libelle}>
            <span className={`${classes.bilanValeur} clair-chiffres`}>{valeur}</span>
            <span className={classes.petit}>{libelle}</span>
          </span>
        ))}
      </span>
    </Link>
  );
};
