"use client";

import type { ScrutinListItem } from "@clair/data";
import { Calendar } from "lucide-react";
import { Badge } from "../../core/badge/Badge.tsx";
import { Card, type CardHeading } from "../../core/card/Card.tsx";
import { ChambreBadge } from "../../core/chambre-badge/ChambreBadge.tsx";
import { StatutBadge } from "../../core/statut-badge/StatutBadge.tsx";
import { parseStatut } from "../../core/statut-badge/statuts.ts";
import { Quand } from "../../lib/dates.tsx";
import classes from "./ScrutinCard.module.css";

/** Ce qu'il faut d'un scrutin (`/scrutins`) pour en faire une carte. */
export type ScrutinCardData = Pick<
  ScrutinListItem,
  | "numero"
  | "chambre"
  | "date"
  | "titre"
  | "sort"
  | "nombrePour"
  | "nombreContre"
  | "nombreAbstention"
> &
  Partial<Pick<ScrutinListItem, "typeVote" | "importance">>;

export type ScrutinCardProps = {
  scrutin: ScrutinCardData;
  /** Adresse du scrutin : le titre est l'unique lien de la carte. */
  href: string;
  /**
   * Période qui désambiguïse le numéro (« Session 2025-2026 », « 17e législature ») :
   * il est réinitialisé à chaque session au Sénat et à chaque législature à l'Assemblée.
   */
  periode?: string | null;
  as?: "div" | "article" | "li";
  titleAs?: CardHeading;
};

const TYPES_VOTE: Record<string, string> = {
  solennel: "Vote solennel",
  ordinaire: "Vote ordinaire",
  motion: "Motion",
};

/** Seuil d'importance (classement automatique de 1 à 5) à partir duquel le scrutin est signalé. */
const SEUIL_IMPORTANT = 4;

const nombre = new Intl.NumberFormat("fr-FR");

/**
 * Carte d'un scrutin : numéro, chambre, date, titre (lien vers le scrutin), résultat chiffré
 * en texte (pour, contre, abstention) et sort (adopté, rejeté) en badge texte.
 * Remplace `scrutins/ScrutinListCard.tsx` de apps/web.
 */
export const ScrutinCard = ({
  scrutin,
  href,
  periode,
  as = "article",
  titleAs = "h3",
}: ScrutinCardProps) => {
  const statut = parseStatut(scrutin.sort);
  const important = (scrutin.importance ?? 0) >= SEUIL_IMPORTANT;
  const typeVote = scrutin.typeVote ? (TYPES_VOTE[scrutin.typeVote] ?? scrutin.typeVote) : null;

  return (
    <Card
      as={as}
      titleAs={titleAs}
      href={href}
      title={scrutin.titre}
      eyebrow={
        <>
          <span className={classes.numero}>Scrutin n° {scrutin.numero}</span>
          <ChambreBadge chambre={scrutin.chambre} short size="sm" />
          {periode ? (
            <Badge tone="neutre" size="sm">
              {periode}
            </Badge>
          ) : null}
          {important ? (
            <Badge tone="avertissement" size="sm">
              Important · calculé par CLAIR
            </Badge>
          ) : null}
        </>
      }
    >
      <div className={classes.content}>
        <p className={classes.meta}>
          <span className={classes.date}>
            <Calendar className={classes.icon} aria-hidden="true" />
            <Quand iso={scrutin.date} />
          </span>
          {typeVote ? <span>{typeVote}</span> : null}
        </p>
        <div className={classes.result}>
          <dl className={classes.counts}>
            <div className={classes.count}>
              <dt>Pour</dt>
              <dd className="clair-chiffres">{nombre.format(scrutin.nombrePour)}</dd>
            </div>
            <div className={classes.count}>
              <dt>Contre</dt>
              <dd className="clair-chiffres">{nombre.format(scrutin.nombreContre)}</dd>
            </div>
            <div className={classes.count}>
              <dt>Abstention</dt>
              <dd className="clair-chiffres">{nombre.format(scrutin.nombreAbstention)}</dd>
            </div>
          </dl>
          {statut ? <StatutBadge statut={statut} /> : <Badge tone="neutre">{scrutin.sort}</Badge>}
        </div>
      </div>
    </Card>
  );
};
