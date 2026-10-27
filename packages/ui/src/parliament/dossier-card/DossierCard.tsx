"use client";

import { Calendar, FileText, Scale, Vote } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../core/badge/Badge.tsx";
import { Card, type CardHeading } from "../../core/card/Card.tsx";
import { type Chambre, ChambreBadge } from "../../core/chambre-badge/ChambreBadge.tsx";
import { Link } from "../../core/link/Link.tsx";
import { StatutBadge } from "../../core/statut-badge/StatutBadge.tsx";
import { parseStatut } from "../../core/statut-badge/statuts.ts";
import { Quand } from "../../lib/dates.tsx";
import classes from "./DossierCard.module.css";

/**
 * Ce qu'il faut d'un dossier législatif (`/dossiers`) pour en faire une carte.
 * Tout est facultatif sauf le titre : chaque contexte affiche ce qu'il connaît.
 */
export type DossierCardData = {
  titre: string;
  procedureLibelle?: string | null;
  /** État brut de l'API : `en_cours`, `adopte`, `rejete`, `promulgue`, `caduc`… */
  etat?: string | null;
  chambre?: Chambre | null;
  dateDepot?: string | null;
  lastScrutinDate?: string | null;
  nbScrutins?: number | null;
  nbAmendements?: number | null;
  /** Loi promulguée : numéro, date de publication et liens officiels. */
  loiNumero?: string | null;
  loiDateJO?: string | null;
  urlLegifrance?: string | null;
  urlJournalOfficiel?: string | null;
};

export type DossierCardProps = {
  dossier: DossierCardData;
  /**
   * Adresse du dossier : le titre devient l'unique lien de la carte (liste de dossiers).
   * Sans adresse, la carte est statique et affiche les liens officiels de la loi (Légifrance,
   * Journal officiel) : c'est l'usage « loi promulguée » de la page d'un dossier.
   */
  href?: string;
  /** Badge de contexte placé en premier (rôle de saisine d'une commission…). */
  contexte?: ReactNode;
  as?: "div" | "article" | "li";
  titleAs?: CardHeading;
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Les titres commencent souvent par un complément (« relatif à… ») : on les préfixe alors de la
 * procédure (« Proposition de loi relative à… »).
 */
export const formatDossierTitre = (titre: string, procedureLibelle?: string | null) => {
  const premier = titre.charAt(0);
  return premier !== premier.toUpperCase() && procedureLibelle
    ? `${procedureLibelle} ${titre}`
    : titre;
};

/**
 * Carte d'un dossier législatif : titre, état en badge texte, chambre, dates, nombre de scrutins
 * et d'amendements, loi promulguée. Fusionne `dossiers/DossierCard.tsx` et `LoiPromulgueeCard.tsx`.
 */
export const DossierCard = ({
  dossier,
  href,
  contexte,
  as = "article",
  titleAs = "h3",
}: DossierCardProps) => {
  const statut = parseStatut(dossier.etat);
  const titre = formatDossierTitre(dossier.titre, dossier.procedureLibelle);
  const liensLoi =
    href === undefined && (dossier.urlLegifrance || dossier.urlJournalOfficiel) ? (
      <div className={classes.links}>
        {dossier.urlLegifrance ? (
          <Link href={dossier.urlLegifrance} external>
            Texte de la loi sur Légifrance
          </Link>
        ) : null}
        {dossier.urlJournalOfficiel ? (
          <Link href={dossier.urlJournalOfficiel} external>
            Journal officiel
          </Link>
        ) : null}
      </div>
    ) : undefined;

  const eyebrow = (
    <>
      {contexte}
      {dossier.chambre ? <ChambreBadge chambre={dossier.chambre} short size="sm" /> : null}
      {statut ? (
        <StatutBadge statut={statut} size="sm" />
      ) : dossier.etat ? (
        <Badge tone="neutre" size="sm">
          {dossier.etat}
        </Badge>
      ) : null}
      {dossier.procedureLibelle ? (
        <Badge tone="neutre" size="sm">
          {dossier.procedureLibelle}
        </Badge>
      ) : null}
    </>
  );

  const contenu = (
    <div className={classes.content}>
      <p className={classes.meta}>
        {dossier.lastScrutinDate ? (
          <span className={classes.item}>
            <Calendar className={classes.icon} aria-hidden="true" />
            Dernier vote le <Quand iso={dossier.lastScrutinDate} />
          </span>
        ) : dossier.dateDepot ? (
          <span className={classes.item}>
            <Calendar className={classes.icon} aria-hidden="true" />
            Déposé le <Quand iso={dossier.dateDepot} />
          </span>
        ) : null}
        {dossier.nbScrutins ? (
          <span className={classes.item}>
            <Vote className={classes.icon} aria-hidden="true" />
            {pluriel(dossier.nbScrutins, "scrutin")}
          </span>
        ) : null}
        {dossier.nbAmendements ? (
          <span className={classes.item}>
            <FileText className={classes.icon} aria-hidden="true" />
            {pluriel(dossier.nbAmendements, "amendement")}
          </span>
        ) : null}
      </p>
      {dossier.loiNumero ? (
        <p className={classes.loi}>
          <Scale className={classes.icon} aria-hidden="true" />
          <span>
            Loi n° {dossier.loiNumero}
            {dossier.loiDateJO ? (
              <>
                , publiée au Journal officiel le <Quand iso={dossier.loiDateJO} />
              </>
            ) : null}
          </span>
        </p>
      ) : null}
    </div>
  );

  return href === undefined ? (
    <Card as={as} titleAs={titleAs} title={titre} eyebrow={eyebrow} footer={liensLoi}>
      {contenu}
    </Card>
  ) : (
    <Card as={as} titleAs={titleAs} href={href} title={titre} eyebrow={eyebrow}>
      {contenu}
    </Card>
  );
};
