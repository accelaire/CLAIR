"use client";

import type { CommissionAncienMembre, CommissionMembre, MembreParlementaire } from "@clair/data";
import { Button, EmptyState, ParlementaireCard } from "@clair/ui";
import { useId, useState } from "react";
import { jourCourt } from "../shared/reunions/reunions.ts";
import { parlementaireHref } from "../shared/scrutins.ts";
import classes from "./CommissionFicheScreen.module.css";

/** Rang d'une qualité : présidence, vice-présidences, secrétaires, rapporteurs, puis membres. */
export const rangQualite = (qualite: string | null) => {
  const libelle = qualite?.toLowerCase() ?? "";
  if (libelle.startsWith("président")) return 0;
  if (libelle.startsWith("vice-président") || libelle.startsWith("vice président")) return 1;
  if (libelle.startsWith("secrétaire")) return 2;
  if (libelle.startsWith("rapporteur")) return 3;
  return libelle ? 10 : 99;
};

/**
 * Membres actuels sans doublon, présidence d'abord. L'API renvoie un mandat par qualité : une
 * présidente apparaît aussi comme simple « Membre ». On garde sa qualité la plus haute.
 */
export const membresUniques = (membres: CommissionMembre[]) => {
  const vus = new Set<string>();
  return [...membres]
    .sort((a, b) => rangQualite(a.qualite) - rangQualite(b.qualite))
    .filter(({ parlementaire }) => {
      if (vus.has(parlementaire.id)) return false;
      vus.add(parlementaire.id);
      return true;
    });
};

/** Qualité affichée en badge ; « Membre » n'apprend rien et n'est pas affiché. */
const qualiteAffichee = (qualite: string | null) =>
  qualite && qualite.toLowerCase() !== "membre" ? qualite : null;

const chambreDe = (parlementaire: MembreParlementaire) =>
  parlementaire.chambre === "senat" ? "senat" : "assemblee";

const CarteMembre = ({
  parlementaire,
  statut,
}: {
  parlementaire: MembreParlementaire;
  statut: string | null;
}) => (
  <ParlementaireCard
    as="li"
    titleAs="h3"
    chambre={chambreDe(parlementaire)}
    href={parlementaireHref(parlementaire.chambre, parlementaire.slug)}
    statut={statut}
    parlementaire={{
      prenom: parlementaire.prenom,
      nom: parlementaire.nom,
      photoUrl: parlementaire.photoUrl,
      groupe: parlementaire.groupe
        ? {
            nom: parlementaire.groupe.nom,
            nomComplet: parlementaire.groupe.nom,
            couleur: parlementaire.groupe.couleur,
          }
        : null,
      circonscription: null,
    }}
  />
);

/**
 * Membres actuels (présidence d'abord), puis anciens membres repliés avec leur période. Chaque
 * carte mène à la fiche du parlementaire ; la qualité est écrite en badge.
 */
export const MembresCommission = ({
  membres,
  anciens,
}: {
  membres: CommissionMembre[];
  anciens: CommissionAncienMembre[];
}) => {
  const [voirAnciens, setVoirAnciens] = useState(false);
  const idAnciens = useId();
  const tries = membresUniques(membres);

  if (tries.length === 0 && anciens.length === 0) {
    return <EmptyState title="Aucun membre enregistré pour cet organe" />;
  }

  return (
    <div className={classes.pile}>
      {tries.length > 0 ? (
        <ul className={classes.grille}>
          {tries.map(({ qualite, parlementaire }) => (
            <CarteMembre
              key={parlementaire.id}
              parlementaire={parlementaire}
              statut={qualiteAffichee(qualite)}
            />
          ))}
        </ul>
      ) : (
        <p className={classes.mention}>Aucun membre actuel enregistré.</p>
      )}
      {anciens.length > 0 ? (
        <div className={classes.pile}>
          <Button
            variant="secondaire"
            aria-expanded={voirAnciens}
            aria-controls={idAnciens}
            onClick={() => setVoirAnciens((etat) => !etat)}
          >
            {voirAnciens ? "Masquer" : "Afficher"} les anciens membres ({anciens.length})
          </Button>
          <div id={idAnciens} hidden={!voirAnciens}>
            {voirAnciens ? (
              <ul className={classes.grille}>
                {anciens.map((membre) => (
                  <CarteMembre
                    key={`${membre.parlementaire.id}-${membre.dateDebut}`}
                    parlementaire={membre.parlementaire}
                    statut={[
                      qualiteAffichee(membre.qualite),
                      `${jourCourt(membre.dateDebut)}${membre.dateFin ? ` au ${jourCourt(membre.dateFin)}` : ""}`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
