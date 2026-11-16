"use client";

import type { Circonscription, GroupeResume, ParlementaireListItem } from "@clair/data";
import { Checkbox } from "@mantine/core";
import { Badge, type BadgeTone } from "../../core/badge/Badge.tsx";
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
  /**
   * Fonction dans un organe (« Président », « Secrétaire »), en badge à côté du nom : elle fait
   * partie du nom accessible du lien, comme dans apps/web.
   */
  fonction?: string | null;
  /** Ton du badge de fonction (`info` par défaut ; la présidence peut ressortir davantage). */
  fonctionTone?: BadgeTone;
  /** Carte resserrée (marges, détails sur une ligne), pour les longues listes de membres. */
  compact?: boolean;
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
 * et statut. En mode comparateur, une case à cocher distincte du lien, sous le nom, sélectionne la
 * personne.
 * Remplace `.depute-card`, les cartes des listes /deputes et /senateurs et `SortantCard`.
 */
export const ParlementaireCard = ({
  parlementaire,
  chambre,
  href,
  statut,
  fonction = null,
  fonctionTone = "info",
  compact = false,
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

  const details =
    groupe || circonscription || statutAffiche ? (
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
    ) : null;
  // Sous le nom, et non à côté : le nom garde toute la largeur de la carte.
  const selection = selectable ? (
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
  ) : null;

  return (
    <Root
      className={classes.root}
      data-chambre={chambre}
      data-compact={compact || undefined}
      data-selectable={selectable || undefined}
      data-selected={(selectable && selected) || undefined}
    >
      <Card
        as="article"
        titleAs={titleAs}
        href={href}
        className={classes.card}
        padding={compact ? "sm" : "md"}
        title={
          <span className={classes.identity}>
            <ParlementaireAvatar
              nom={nomAffiche}
              photoUrl={parlementaire.photoUrl}
              size={compact ? "sm" : "md"}
              decorative
            />
            <span className={classes.nom}>
              <span>{nomAffiche}</span>
              {fonction ? (
                <Badge tone={fonctionTone} size="sm">
                  {fonction}
                </Badge>
              ) : null}
            </span>
          </span>
        }
      >
        {selection || details ? (
          <div className={classes.contenu}>
            {selection}
            {details}
          </div>
        ) : undefined}
      </Card>
    </Root>
  );
};
