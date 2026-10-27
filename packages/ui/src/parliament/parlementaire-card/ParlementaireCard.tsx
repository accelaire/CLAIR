"use client";

import type { Circonscription, GroupeResume, ParlementaireListItem } from "@clair/data";
import { Checkbox } from "@mantine/core";
import { Badge } from "../../core/badge/Badge.tsx";
import { Card, type CardHeading } from "../../core/card/Card.tsx";
import type { Chambre } from "../../core/chambre-badge/ChambreBadge.tsx";
import { GroupeBadge } from "../groupe-badge/GroupeBadge.tsx";
import { ParlementaireAvatar } from "../parlementaire-avatar/ParlementaireAvatar.tsx";
import classes from "./ParlementaireCard.module.css";

/** Ce qu'il faut d'un parlementaire (`/deputes`, `/senateurs`) pour en faire une carte. */
export type ParlementaireCardData = Pick<ParlementaireListItem, "prenom" | "nom" | "photoUrl"> &
  Partial<Pick<ParlementaireListItem, "actif" | "sexe">> & {
    /** Groupe : `nom` porte le sigle, `nomComplet` le nom lu par les lecteurs d'écran. */
    groupe: Pick<GroupeResume, "nom" | "nomComplet" | "couleur"> | null;
    circonscription: Pick<Circonscription, "nom" | "departement" | "numero"> | null;
  };

export type ParlementaireCardProps = {
  parlementaire: ParlementaireCardData;
  /** Chambre du mandat : règle le libellé du statut et de la circonscription. */
  chambre: Chambre;
  /** Adresse de la fiche : le nom est l'unique lien de la carte. */
  href: string;
  /**
   * Statut affiché en badge (« Ancienne députée », « Sortant »). Par défaut, un parlementaire
   * dont `actif` vaut `false` est présenté comme ancien élu de sa chambre.
   */
  statut?: string | null;
  /** Ajoute une case à cocher « Comparer » (comparateur), distincte du lien de la fiche. */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Case désactivée (nombre maximal de parlementaires déjà sélectionnés). */
  selectionDisabled?: boolean;
  /** Élément racine : `li` dans une liste de cartes. */
  as?: "div" | "li";
  titleAs?: CardHeading;
};

const ordinal = (numero: number) => (numero === 1 ? "1re" : `${numero}e`);

/** « Exemple-sur-Mer (99), 1re circonscription » pour un député, « Exemple-sur-Mer (99) » sinon. */
const libelleCirconscription = (
  circonscription: NonNullable<ParlementaireCardData["circonscription"]>,
  chambre: Chambre,
) => {
  const lieu = circonscription.departement
    ? `${circonscription.nom} (${circonscription.departement})`
    : circonscription.nom;
  return chambre === "assemblee" && circonscription.numero > 0
    ? `${lieu}, ${ordinal(circonscription.numero)} circonscription`
    : lieu;
};

const statutParDefaut = (parlementaire: ParlementaireCardData, chambre: Chambre) => {
  if (parlementaire.actif !== false) return null;
  const femme = parlementaire.sexe === "F";
  if (chambre === "senat") return femme ? "Ancienne sénatrice" : "Ancien sénateur";
  return femme ? "Ancienne députée" : "Ancien député";
};

/**
 * Carte d'un député ou d'un sénateur : photo, nom (lien vers la fiche), groupe, circonscription
 * et statut. En mode comparateur, une case à cocher distincte du lien sélectionne la personne.
 * Remplace `.depute-card`, les cartes des listes /deputes et /senateurs et `SortantCard`.
 */
export const ParlementaireCard = ({
  parlementaire,
  chambre,
  href,
  statut,
  selectable = false,
  selected = false,
  onSelectedChange,
  selectionDisabled = false,
  as: Root = "div",
  titleAs = "h3",
}: ParlementaireCardProps) => {
  const nomAffiche = `${parlementaire.prenom} ${parlementaire.nom}`;
  const statutAffiche = statut === undefined ? statutParDefaut(parlementaire, chambre) : statut;
  const { groupe, circonscription } = parlementaire;

  return (
    <Root
      className={classes.root}
      data-chambre={chambre}
      data-selectable={selectable || undefined}
      data-selected={(selectable && selected) || undefined}
    >
      <Card
        as="article"
        titleAs={titleAs}
        href={href}
        className={classes.card}
        title={
          <span className={classes.identity}>
            <ParlementaireAvatar nom={nomAffiche} photoUrl={parlementaire.photoUrl} decorative />
            <span>{nomAffiche}</span>
          </span>
        }
      >
        {groupe || circonscription || statutAffiche ? (
          <div className={classes.details}>
            {groupe ? (
              <GroupeBadge
                sigle={groupe.nom}
                nom={groupe.nomComplet}
                couleur={groupe.couleur}
                size="sm"
              />
            ) : null}
            {circonscription ? (
              <p className={classes.circonscription}>
                {libelleCirconscription(circonscription, chambre)}
              </p>
            ) : null}
            {statutAffiche ? (
              <Badge tone="neutre" size="sm">
                {statutAffiche}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </Card>
      {selectable ? (
        <Checkbox
          className={classes.selection}
          checked={selected}
          disabled={selectionDisabled}
          onChange={(event) => onSelectedChange?.(event.currentTarget.checked)}
          label={
            <>
              Comparer<span className="clair-visually-hidden"> {nomAffiche}</span>
            </>
          }
        />
      ) : null}
    </Root>
  );
};
