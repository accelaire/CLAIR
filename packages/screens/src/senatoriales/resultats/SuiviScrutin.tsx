"use client";

import type { ResultatsNationaux, StatutCirconscription } from "@clair/data";
import { etapesJournee } from "../lib/resultats.ts";
import { BarreEtats } from "./BarreEtats.tsx";
import classes from "./Resultats.module.css";

/**
 * États de la barre, dans l'ordre où une circonscription les traverse à rebours : pourvue, à
 * moitié, en attente de 2nd tour, close sans résultat, vote en cours, pas encore ouverte.
 */
const ORDRE: { statut: StatutCirconscription; libelle: string }[] = [
  { statut: "pourvue", libelle: "Pourvues" },
  { statut: "partielle", libelle: "Pourvues à moitié" },
  { statut: "second_tour", libelle: "2nd tour à venir ou en cours" },
  { statut: "resultats_attendus", libelle: "Scrutin clos, résultats attendus" },
  { statut: "vote_en_cours", libelle: "Vote en cours" },
  { statut: "pas_ouvert", libelle: "Vote pas encore ouvert" },
];

const Compteur = ({
  valeur,
  total,
  libelle,
}: {
  valeur: number;
  total: number;
  libelle: string;
}) => (
  <div>
    <p className={classes.compteur}>
      <span className={`${classes.compteurValeur} clair-chiffres`}>{valeur}</span>
      <span className={classes.compteurTotal}>/ {total}</span>
    </p>
    <p className={classes.compteurLibelle}>{libelle}</p>
  </div>
);

const ETAT_LU = { fait: " (fait)", en_cours: " (en cours)", a_venir: " (à venir)" } as const;

/** Compteurs de la soirée et déroulé de la journée. */
export const SuiviScrutin = ({ donnees }: { donnees: ResultatsNationaux }) => {
  const c = donnees.compteurs;
  const presents = ORDRE.filter((o) => c[o.statut] > 0);

  return (
    <section className={classes.bloc} aria-labelledby="suivi-scrutin">
      <div className={classes.blocEntete}>
        <h2 id="suivi-scrutin" className={classes.titreBloc}>
          Suivi du scrutin
        </h2>
        <p className={classes.petit}>Les pages sont mises à jour toutes les quelques minutes.</p>
      </div>

      <div className={classes.deuxColonnes}>
        <div className={classes.pile}>
          <Compteur
            valeur={c.pourvue}
            total={c.circonscriptions}
            libelle="circonscriptions pourvues"
          />
          <BarreEtats
            etats={presents.map((o) => ({ ...o, nombre: c[o.statut] }))}
            total={c.circonscriptions}
            circonscriptions={donnees.circonscriptions.map(({ departement, nom, statut }) => ({
              departement,
              nom,
              statut,
            }))}
          />
        </div>
        <div className={classes.pile}>
          <Compteur valeur={c.siegesAttribues} total={c.sieges} libelle="sièges attribués" />
          <div className={classes.barre}>
            <span
              className={classes.jaugePleine}
              style={{ width: `${(c.siegesAttribues / c.sieges) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className={classes.deroule}>
        <p className={classes.derouleTitre}>
          <strong className={classes.fort}>Le déroulé de la journée</strong>
          <span className={classes.mention}>
            , heure de Paris : les bureaux ferment à l'heure locale
          </span>
        </p>
        <ol className={classes.etapes}>
          {etapesJournee(donnees).map((e) => (
            <li key={e.heure} className={classes.etape} data-etat={e.etat}>
              <span className={classes.etapeRepere} aria-hidden="true">
                <span className={classes.etapePoint} />
                <span className={classes.etapeTrait} />
              </span>
              <span className={classes.etapeHeure}>{e.heure}</span>
              <span className={classes.etapeLibelle}>
                {e.libelle}
                <span className="clair-visually-hidden">{ETAT_LU[e.etat]}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
