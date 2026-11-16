"use client";

import type { ScrutinListItem } from "@clair/data";
import { Calendar, Tag } from "lucide-react";
import { Badge } from "../../core/badge/Badge.tsx";
import { Card, type CardHeading } from "../../core/card/Card.tsx";
import { ChambreBadge } from "../../core/chambre-badge/ChambreBadge.tsx";
import { StatutBadge } from "../../core/statut-badge/StatutBadge.tsx";
import { parseStatut } from "../../core/statut-badge/statuts.ts";
import { Quand } from "../../lib/dates.tsx";
import { libelleThematique } from "../../lib/thematiques.ts";
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
  Partial<Pick<ScrutinListItem, "typeVote" | "importance" | "tags">>;

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

/** Thématiques montrées sur la carte ; les suivantes sont comptées (« +2 »), comme apps/web. */
const TAGS_MAX = 3;

/** Seuil d'importance (classement automatique de 1 à 5) à partir duquel le scrutin est signalé. */
const SEUIL_IMPORTANT = 4;

const nombre = new Intl.NumberFormat("fr-FR");

/**
 * Carte d'un scrutin : numéro, chambre, sort (adopté, rejeté) en badge texte près du titre, titre
 * (lien vers le scrutin, coupé à deux lignes à l'écran mais lu en entier), puis date, mode,
 * thématiques (trois au plus) et résultat chiffré en texte (pour, contre, abstention) sur une ligne.
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
  const tags = scrutin.tags ?? [];
  const autresTags = tags.length - TAGS_MAX;

  return (
    <Card
      as={as}
      titleAs={titleAs}
      href={href}
      title={<span className={classes.titre}>{scrutin.titre}</span>}
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
          {/* Le sort remonte près du titre, comme dans apps/web : on le lit d'un coup d'œil. */}
          <span className={classes.sort}>
            {statut ? (
              <StatutBadge statut={statut} size="sm" />
            ) : (
              <Badge tone="neutre" size="sm">
                {scrutin.sort}
              </Badge>
            )}
          </span>
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
          {tags.length > 0 ? (
            <span className={classes.date}>
              <Tag className={classes.icon} aria-hidden="true" />
              <span>
                <span className="clair-visually-hidden">Thématiques : </span>
                {tags.slice(0, TAGS_MAX).map(libelleThematique).join(", ")}
                {autresTags > 0 ? (
                  <>
                    {" "}
                    <span aria-hidden="true">+{autresTags}</span>
                    <span className="clair-visually-hidden">
                      {` et ${autresTags} autre${autresTags > 1 ? "s" : ""}`}
                    </span>
                  </>
                ) : null}
              </span>
            </span>
          ) : null}
        </p>
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
      </div>
    </Card>
  );
};
