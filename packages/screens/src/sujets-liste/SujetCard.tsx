import type { SujetListItem } from "@clair/data";
import { Badge, Card, type CardHeading, StatutBadge } from "@clair/ui";
import { Layers, Sparkles, Vote } from "lucide-react";
import { compte, formatMois, statutSujet } from "./format.ts";
import classes from "./SujetsListeScreen.module.css";

type SujetCardProps = {
  sujet: SujetListItem;
  /** Mise en avant « À la une » : carte plus large, nombre de dossiers affiché. */
  aLaUne?: boolean;
  titleAs?: CardHeading;
};

/**
 * Carte d'un sujet : statut en badge texte, intitulé (lien vers la fiche), dates et nombre de
 * scrutins. Le statut n'est jamais porté par la seule couleur.
 */
export const SujetCard = ({ sujet, aLaUne = false, titleAs = "h3" }: SujetCardProps) => {
  const statut = statutSujet(sujet.status);
  return (
    <Card
      as="li"
      titleAs={titleAs}
      href={`/sujets/${sujet.slug}`}
      title={sujet.label}
      padding={aLaUne ? "lg" : "md"}
      className={aLaUne ? classes.aLaUne : undefined}
      eyebrow={
        <>
          {aLaUne ? (
            <Badge tone="info" size="sm" icon={<Sparkles />}>
              À la une
            </Badge>
          ) : null}
          <StatutBadge statut={statut} size="sm" />
        </>
      }
    >
      <p className={classes.meta}>
        {sujet.dateDebut ? <span>Dépôt : {formatMois(sujet.dateDebut)}</span> : null}
        <span className={classes.metaItem}>
          <Vote className={classes.icon} aria-hidden="true" />
          {compte(sujet.scrutinCount, "scrutin")}
        </span>
        {aLaUne ? (
          <span className={classes.metaItem}>
            <Layers className={classes.icon} aria-hidden="true" />
            {compte(sujet.dossierCount, "dossier")}
          </span>
        ) : null}
        {sujet.dateDernierVote ? (
          <span>Dernier vote : {formatMois(sujet.dateDernierVote)}</span>
        ) : null}
        {statut === "promulgue" && sujet.dateFin ? (
          <span>Promulgué en {formatMois(sujet.dateFin)}</span>
        ) : null}
      </p>
    </Card>
  );
};
