"use client";

import { CornerDownRight } from "lucide-react";
import { Badge } from "../../core/badge/Badge.tsx";
import { Card, type CardHeading } from "../../core/card/Card.tsx";
import { ExpandableText } from "../../core/expandable-text/ExpandableText.tsx";
import { Link } from "../../core/link/Link.tsx";
import { StatutBadge } from "../../core/statut-badge/StatutBadge.tsx";
import { parseStatut } from "../../core/statut-badge/statuts.ts";
import { Quand } from "../../lib/dates.tsx";
import { GroupeBadge, type GroupeBadgeProps } from "../groupe-badge/GroupeBadge.tsx";
import classes from "./AmendementCard.module.css";

/** Ce qu'il faut d'un amendement (`/dossiers/:uid/amendements`, fiches) pour en faire une carte. */
export type AmendementCardData = {
  numero: string;
  articleVise?: string | null;
  /** Alinéa visé, tel que publié (« alinéa 3 »). */
  alinea?: string | null;
  auteurLibelle?: string | null;
  /** Sort brut de l'API (« Adopté », `rejete`, « Irrecevable (art. 40) »…). */
  sort?: string | null;
  /** Exposé sommaire (HTML de la source accepté : il est réduit à son texte). */
  exposeSommaire?: string | null;
  dispositif?: string | null;
  dateDepot?: string | null;
  texteRef?: string | null;
  /** Amendement que celui-ci sous-amende. */
  amendementParent?: { numero: string; auteurLibelle?: string | null } | null;
};

export type AmendementCardLink = { label: string; href: string };

export type AmendementCardProps = {
  amendement: AmendementCardData;
  /** Groupe de l'auteur (sigle, nom complet, couleur de l'API). */
  groupe?: Pick<GroupeBadgeProps, "sigle" | "nom" | "couleur"> | null;
  /** Affiche l'auteur (masqué sur la fiche de l'auteur lui-même). */
  showAuteur?: boolean;
  /** Adresse de l'amendement parent : la mention « Sous-amendement à… » devient un lien. */
  parentHref?: string;
  /** Scrutins publics où l'amendement a été mis aux voix. */
  scrutins?: Array<{ numero: number | string; href: string }>;
  /** Dossier législatif de l'amendement. */
  dossier?: AmendementCardLink | null;
  /** Amendement visé par le lien qui a ouvert la page : mis en évidence. */
  highlighted?: boolean;
  /** Ancre de la carte (`id`), pour y renvoyer depuis un autre amendement. */
  id?: string;
  as?: "div" | "article" | "li";
  titleAs?: CardHeading;
};

/** Texte d'un fragment HTML de la source (balises retirées, espaces insécables remplacés). */
const texteDe = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Premier nom d'une liste de signataires (« Mme A, M. B et M. C » → « Mme A »). */
const premierAuteur = (libelle: string | null | undefined) =>
  libelle?.split(/,\s*|\s+et\s+/u)[0]?.trim() || null;

/** « de M. X », mais « du Gouvernement ». */
const deLAuteur = (auteur: string) =>
  /^le gouvernement$/iu.test(auteur) ? "du Gouvernement" : `de ${auteur}`;

const SOUS_TITRE: Record<CardHeading, CardHeading> = {
  h2: "h3",
  h3: "h4",
  h4: "h5",
  h5: "h6",
  h6: "h6",
};

/**
 * Carte d'un amendement : numéro, sort, article visé, auteur et groupe, exposé sommaire repliable
 * (« Lire la suite »), dispositif, mention de sous-amendement, liens vers les scrutins et le dossier.
 * Fusionne `ExpandableAmendementCard.tsx`, son doublon de la fiche sénateur et `AmendementSeance.tsx`.
 */
export const AmendementCard = ({
  amendement,
  groupe,
  showAuteur = true,
  parentHref,
  scrutins = [],
  dossier,
  highlighted = false,
  id,
  as = "article",
  titleAs = "h3",
}: AmendementCardProps) => {
  const SubHeading = SOUS_TITRE[titleAs];
  const sort = amendement.sort?.trim() || null;
  const statut = parseStatut(sort);
  const libelleSort = sort && !sort.includes("_") && sort !== sort.toLowerCase() ? sort : undefined;
  const cible = [amendement.articleVise, amendement.alinea].filter(Boolean).join(", ");
  const parent = amendement.amendementParent;
  const auteurParent = premierAuteur(parent?.auteurLibelle);
  const expose = amendement.exposeSommaire ? texteDe(amendement.exposeSommaire) : "";
  const dispositif = amendement.dispositif ? texteDe(amendement.dispositif) : "";

  const libelleParent = parent
    ? `l'amendement n° ${parent.numero}${auteurParent ? ` ${deLAuteur(auteurParent)}` : ""}`
    : "";

  return (
    <div id={id} className={classes.root} data-highlighted={highlighted || undefined}>
      <Card
        as={as}
        titleAs={titleAs}
        title={`Amendement n° ${amendement.numero}`}
        eyebrow={
          sort || parent ? (
            <>
              {statut ? (
                <StatutBadge statut={statut} label={libelleSort} size="sm" />
              ) : sort ? (
                <Badge tone="neutre" size="sm">
                  {sort}
                </Badge>
              ) : null}
              {parent ? (
                <Badge tone="info" size="sm">
                  Sous-amendement
                </Badge>
              ) : null}
            </>
          ) : undefined
        }
        footer={
          amendement.dateDepot || amendement.texteRef ? (
            <p className={classes.footer}>
              {amendement.dateDepot ? (
                <span>
                  Déposé le <Quand iso={amendement.dateDepot} />
                </span>
              ) : null}
              {amendement.texteRef ? <span>Texte {amendement.texteRef}</span> : null}
            </p>
          ) : undefined
        }
      >
        <div className={classes.content}>
          {cible ? <p className={classes.cible}>{cible}</p> : null}
          {parent ? (
            <p className={classes.parent}>
              <CornerDownRight className={classes.icon} aria-hidden="true" />
              <span>
                Sous-amendement à{" "}
                {parentHref ? <Link href={parentHref}>{libelleParent}</Link> : libelleParent}
              </span>
            </p>
          ) : null}
          {showAuteur && (amendement.auteurLibelle || groupe) ? (
            <p className={classes.auteur}>
              {amendement.auteurLibelle ? <span>{amendement.auteurLibelle}</span> : null}
              {groupe ? (
                <GroupeBadge
                  sigle={groupe.sigle}
                  nom={groupe.nom}
                  couleur={groupe.couleur}
                  size="sm"
                />
              ) : null}
            </p>
          ) : null}
          {expose ? (
            <section className={classes.section}>
              <SubHeading className="clair-visually-hidden">Exposé sommaire</SubHeading>
              <ExpandableText maxLength={200}>{expose}</ExpandableText>
            </section>
          ) : null}
          {dispositif ? (
            <section className={classes.section}>
              <SubHeading className={classes.sectionTitle}>Dispositif</SubHeading>
              <ExpandableText maxLength={160}>{dispositif}</ExpandableText>
            </section>
          ) : null}
          {scrutins.length > 0 || dossier ? (
            <ul className={classes.links}>
              {scrutins.map((scrutin) => (
                <li key={scrutin.href}>
                  <Link href={scrutin.href}>Voir le scrutin n° {scrutin.numero}</Link>
                </li>
              ))}
              {dossier ? (
                <li>
                  <Link href={dossier.href}>
                    <span className="clair-visually-hidden">Dossier : </span>
                    {dossier.label}
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
