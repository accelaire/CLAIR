"use client";

import {
  CalendarDays,
  Coins,
  DoorOpen,
  Landmark,
  type LucideIcon,
  MapPin,
  PauseCircle,
  Users,
  Vote,
} from "lucide-react";
import { Badge } from "../../core/badge/Badge.tsx";
import { Card, type CardHeading } from "../../core/card/Card.tsx";
import { type Chambre, ChambreBadge } from "../../core/chambre-badge/ChambreBadge.tsx";
import { Link } from "../../core/link/Link.tsx";
import { DATE_INCONNUE, estDateValide } from "../../lib/dates.tsx";
import classes from "./EvenementCard.module.css";

/** Type d'événement : réunions parlementaires et repères institutionnels de l'agenda. */
export type EvenementType =
  | "seance"
  | "commission"
  | "reunion"
  | "election"
  | "session"
  | "suspension"
  | "budget"
  | "institution";

export const EVENEMENT_TYPES: Record<EvenementType, { label: string; icon: LucideIcon }> = {
  seance: { label: "Séance publique", icon: Landmark },
  commission: { label: "Réunion de commission", icon: Users },
  reunion: { label: "Réunion", icon: CalendarDays },
  election: { label: "Élection", icon: Vote },
  session: { label: "Session", icon: DoorOpen },
  suspension: { label: "Suspension", icon: PauseCircle },
  budget: { label: "Budget", icon: Coins },
  institution: { label: "Institution", icon: Landmark },
};

export type EvenementCardProps = {
  /** Titre : organe réuni, objet de la séance ou intitulé de l'échéance. */
  title: string;
  type: EvenementType;
  chambre?: Chambre | null;
  /** Début, ISO : date seule (`2026-03-03`) ou date et heure (`2026-03-03T15:00:00+01:00`). */
  start: string;
  /** Fin, même format que le début. */
  end?: string | null;
  /** `false` : date non encore fixée officiellement, seul le mois est affiché. */
  datePrecise?: boolean;
  /** Ordre du jour ou description. */
  description?: string | null;
  lieu?: string | null;
  /** Page de l'événement : le titre devient un lien. */
  href?: string;
  /** L'événement a lieu maintenant (calculé par l'application, voir `isHappeningNow`). */
  live?: boolean;
  /** Retransmission en direct (lien externe), affichée pendant l'événement. */
  liveHref?: string;
  /** Sources officielles de l'échéance. */
  sources?: { label: string; href?: string }[];
  /** Niveau du titre. */
  titleAs?: CardHeading;
};

const TIME_ZONE = "Europe/Paris";
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const monthFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const hasTime = (iso: string) => iso.includes("T");

/** Libellé de date et d'heure, en heure de Paris. */
export const formatEvenementDate = (
  start: string,
  end?: string | null,
  datePrecise = true,
): string => {
  if (!estDateValide(start)) return DATE_INCONNUE;
  const debut = new Date(start);
  // Une fin invalide est ignorée : le début suffit à situer l'événement.
  if (end && !estDateValide(end)) return formatEvenementDate(start, null, datePrecise);
  if (!datePrecise) return `Courant ${monthFormat.format(debut)} (date non encore fixée)`;
  const jour = dayFormat.format(debut);
  if (hasTime(start)) {
    const heures = end
      ? `${timeFormat.format(debut)} – ${timeFormat.format(new Date(end))}`
      : timeFormat.format(debut);
    return `${jour}, ${heures}`;
  }
  if (end && end.slice(0, 10) !== start.slice(0, 10)) {
    return `Du ${jour} au ${dayFormat.format(new Date(end))}`;
  }
  return jour;
};

/** Durée retenue pour une réunion sans heure de fin. */
const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000;

/** L'événement a-t-il lieu à l'instant `now` ? (sans fin connue : 4 heures après le début). */
export const isHappeningNow = (start: string, end: string | null | undefined, now: Date) => {
  const debut = new Date(start).getTime();
  const fin = end ? new Date(end).getTime() : debut + DEFAULT_DURATION_MS;
  return now.getTime() >= debut && now.getTime() <= fin;
};

/**
 * Événement de l'agenda parlementaire : date et heure (heure de Paris), chambre, type (séance,
 * commission, réunion, échéance), titre, lieu et lien. Pendant l'événement, la mention
 * « En direct » est un texte, pas seulement un style. Une date non fixée n'affiche que son mois.
 * Fusionne `EvenementCard` et `ReunionCard` de apps/web.
 */
export const EvenementCard = ({
  title,
  type,
  chambre,
  start,
  end,
  datePrecise = true,
  description,
  lieu,
  href,
  live = false,
  liveHref,
  sources = [],
  titleAs = "h3",
}: EvenementCardProps) => {
  const { label, icon: Icon } = EVENEMENT_TYPES[type];
  return (
    <Card
      as="article"
      titleAs={titleAs}
      className={classes.card}
      title={href ? <Link href={href}>{title}</Link> : title}
      eyebrow={
        <>
          <span className={classes.type}>
            <Icon className={classes.icon} aria-hidden="true" />
            {label}
          </span>
          {chambre ? <ChambreBadge chambre={chambre} size="sm" /> : null}
          {live ? (
            <Badge tone="erreur" size="sm" icon={<span className={classes.dot} />}>
              En direct
            </Badge>
          ) : null}
        </>
      }
    >
      <p className={classes.when}>
        <time dateTime={start}>{formatEvenementDate(start, end, datePrecise)}</time>
      </p>
      {description ? <p className={classes.description}>{description}</p> : null}
      {lieu || (live && liveHref) || sources.length > 0 ? (
        <div className={classes.meta}>
          {lieu ? (
            <span className={classes.lieu}>
              <MapPin className={classes.icon} aria-hidden="true" />
              <span className="clair-visually-hidden">Lieu : </span>
              {lieu}
            </span>
          ) : null}
          {live && liveHref ? (
            <Link href={liveHref} external>
              Suivre en direct
            </Link>
          ) : null}
          {sources.length > 0 ? (
            <span>
              {sources.length > 1 ? "Sources" : "Source"} :{" "}
              {sources.map((source, index) => (
                <span key={source.label}>
                  {index > 0 ? ", " : null}
                  {source.href ? (
                    <Link href={source.href} external>
                      {source.label}
                    </Link>
                  ) : (
                    source.label
                  )}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
};
