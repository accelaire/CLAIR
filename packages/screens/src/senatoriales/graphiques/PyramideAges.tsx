"use client";

import type { Sortant } from "@clair/data";
import { useInfobulle } from "../composants/Infobulle.tsx";
import { TableauDonnees } from "../composants/TableauDonnees.tsx";
import { SENATORIALES_2026 } from "../lib/calendrier.ts";
import { COULEUR_FEMMES, COULEUR_HOMMES, COULEUR_NEUTRE } from "../lib/couleurs.ts";
import { ageA, PAS_TRANCHE, pyramideAges } from "../lib/graphiques.ts";
import { EntreeGraphique, type Selection } from "./BarresComptage.tsx";
import classes from "./Graphiques.module.css";

const Barre = ({
  valeur,
  max,
  couleur,
  alignement,
}: {
  valeur: number;
  max: number;
  couleur: string;
  alignement: "gauche" | "droite";
}) =>
  valeur === 0 ? null : (
    <span
      className={classes.barrePyramide}
      data-alignement={alignement}
      style={{ width: `${(valeur / max) * 100}%`, backgroundColor: couleur }}
    />
  );

/**
 * Pyramide des âges des sortants au jour du scrutin (âge figé au 27 septembre 2026 : c'est
 * l'âge au moment où le siège est remis en jeu qui a un sens, et il ne bouge plus).
 */
export const PyramideAges = ({
  sortants,
  onSelection,
}: {
  sortants: Sortant[];
  onSelection?: Selection;
}) => {
  const { infobulle, gestionnaires } = useInfobulle();
  const scrutin = new Date(`${SENATORIALES_2026.scrutin}T00:00:00Z`);
  const tranches = pyramideAges(sortants, scrutin);

  if (tranches.length === 0) {
    return (
      <p className={classes.vide}>
        Les dates de naissance ne sont pas encore disponibles pour ces sénateurs.
      </p>
    );
  }

  const maxCote = tranches.reduce((max, t) => Math.max(max, t.hommes, t.femmes + t.autres), 0);
  const totaux = tranches.reduce(
    (acc, t) => ({
      hommes: acc.hommes + t.hommes,
      femmes: acc.femmes + t.femmes,
      autres: acc.autres + t.autres,
    }),
    { hommes: 0, femmes: 0, autres: 0 },
  );
  const sansDate = sortants.filter((s) => !s.personne.dateNaissance).length;
  const total = totaux.hommes + totaux.femmes + totaux.autres;

  return (
    <div className={classes.pile}>
      <ul className={classes.pyramide}>
        {tranches.map((tranche) => {
          const lignes = [
            ...(tranche.hommes > 0 ? [{ label: "Hommes", valeur: String(tranche.hommes) }] : []),
            ...(tranche.femmes > 0 ? [{ label: "Femmes", valeur: String(tranche.femmes) }] : []),
            ...(tranche.autres > 0
              ? [{ label: "Non renseigné", valeur: String(tranche.autres) }]
              : []),
          ];
          const mandatIds = sortants
            .filter((s) => {
              if (!s.personne.dateNaissance) return false;
              const age = ageA(s.personne.dateNaissance, scrutin);
              return age >= tranche.debut && age < tranche.debut + PAS_TRANCHE;
            })
            .map((s) => s.mandatId);
          const libelle = `${tranche.label} ans`;
          return (
            <li key={tranche.debut}>
              <EntreeGraphique
                selectionnable={onSelection !== undefined}
                onSelect={() => onSelection?.(mandatIds, libelle)}
                libelle={`Surligner les sortants de ${libelle} : ${tranche.hommes} hommes, ${tranche.femmes} femmes${tranche.autres > 0 ? `, ${tranche.autres} non renseignés` : ""}`}
                className={classes.tranche}
                gestionnaires={gestionnaires({ titre: libelle, lignes })}
              >
                <span className={classes.coteHommes}>
                  <Barre
                    valeur={tranche.hommes}
                    max={maxCote}
                    couleur={COULEUR_HOMMES}
                    alignement="droite"
                  />
                </span>
                <span className={`${classes.trancheLibelle} clair-chiffres`}>{tranche.label}</span>
                <span className={classes.coteFemmes}>
                  <Barre
                    valeur={tranche.femmes}
                    max={maxCote}
                    couleur={COULEUR_FEMMES}
                    alignement="gauche"
                  />
                  <Barre
                    valeur={tranche.autres}
                    max={maxCote}
                    couleur={COULEUR_NEUTRE}
                    alignement="gauche"
                  />
                </span>
              </EntreeGraphique>
            </li>
          );
        })}
      </ul>

      <div className={classes.legende}>
        <span className={classes.legendeEntree}>
          <span
            className={classes.carre}
            style={{ backgroundColor: COULEUR_HOMMES }}
            aria-hidden="true"
          />
          {totaux.hommes} hommes
        </span>
        <span className={classes.legendeEntree}>
          <span
            className={classes.carre}
            style={{ backgroundColor: COULEUR_FEMMES }}
            aria-hidden="true"
          />
          {totaux.femmes} femmes
        </span>
        {totaux.autres > 0 ? (
          <span className={classes.legendeEntree}>
            <span
              className={classes.carre}
              style={{ backgroundColor: COULEUR_NEUTRE }}
              aria-hidden="true"
            />
            {totaux.autres} non renseigné{totaux.autres > 1 ? "s" : ""}
          </span>
        ) : null}
        <span>
          Âge au 27 septembre 2026, sur {total} sortant{total > 1 ? "s" : ""}
          {sansDate > 0 ? ` (${sansDate} sans date de naissance connue)` : ""}.
        </span>
      </div>
      <TableauDonnees
        legende="Sortants par tranche d'âge et par sexe"
        colonnes={[
          { cle: "tranche", libelle: "Âge" },
          { cle: "hommes", libelle: "Hommes", numerique: true },
          { cle: "femmes", libelle: "Femmes", numerique: true },
          { cle: "autres", libelle: "Non renseigné", numerique: true },
        ]}
        lignes={tranches.map((t) => ({
          tranche: `${t.label} ans`,
          hommes: t.hommes,
          femmes: t.femmes,
          autres: t.autres,
        }))}
      />
      {infobulle}
    </div>
  );
};
