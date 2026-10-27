"use client";

import { Timeline } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { type CSSProperties, useId, useState } from "react";
import { Badge } from "../../core/badge/Badge.tsx";
import { type Chambre, ChambreBadge } from "../../core/chambre-badge/ChambreBadge.tsx";
import { Link } from "../../core/link/Link.tsx";
import { EmptyState } from "../../core/query-states/QueryStates.tsx";
import { moisParis, Quand } from "../../lib/dates.tsx";
import { couleurGroupe } from "../groupe-badge/GroupeBadge.tsx";
import classes from "./MandatsTimeline.module.css";

/** Fonction exercée pendant un mandat (commission, groupe d'études, mission…). */
export type MandatFonction = {
  id: string;
  /** Qualité (« Présidente », « Membre ») ; « Membre » par défaut. */
  qualite?: string | null;
  /** Organe (« Commission des finances »). */
  organe: string;
  /** Page de l'organe : son nom devient un lien. */
  href?: string;
  /** Dates ISO ; sans fin, la fonction est en cours. */
  dateDebut: string;
  dateFin?: string | null;
};

/** Mandat parlementaire : une législature (Assemblée) ou une mandature (Sénat). */
export type Mandat = {
  id: string;
  /** Chambre du mandat, qui peut différer de celle de la fiche (député devenu sénateur). */
  chambre: Chambre;
  /** Période (« XVIIe législature », « Mandature 2023 »). */
  periode: string;
  /** Dates ISO ; sans fin, le mandat est en cours. */
  dateDebut: string;
  dateFin?: string | null;
  /** Groupe d'époque : celui du mandat, pas l'actuel. */
  groupe?: { sigle: string; nom: string; couleur?: string | null; href?: string } | null;
  /** Circonscription ou département d'élection. */
  circonscription?: string | null;
  fonctions?: MandatFonction[];
};

export type MandatsTimelineProps = {
  /** Mandats, dans n'importe quel ordre : ils sont affichés du plus récent au plus ancien. */
  mandats: Mandat[];
  /** Accord de la fonction (« Députée », « Sénateur ») quand les deux chambres se suivent. */
  sexe?: "F" | "M" | null;
  /** Titre du bloc. */
  title?: string;
  /** Niveau du titre dans la page. */
  headingLevel?: 2 | 3 | 4;
};

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

const roleOf = (chambre: Chambre, sexe: MandatsTimelineProps["sexe"]) => {
  if (chambre === "assemblee") return sexe === "F" ? "Députée" : "Député";
  return sexe === "F" ? "Sénatrice" : "Sénateur";
};

/** Période « de … à … » d'un mandat ou d'une fonction. */
const Periode = ({ debut, fin }: { debut: string; fin?: string | null }) => (
  <span className={classes.dates}>
    <Quand iso={debut} format={moisParis} />
    {" – "}
    {fin ? <Quand iso={fin} format={moisParis} /> : "en cours"}
  </span>
);

const FonctionItem = ({ fonction }: { fonction: MandatFonction }) => (
  <li className={classes.fonction}>
    <span className={classes.qualite}>{fonction.qualite || "Membre"}</span>
    <span>
      {fonction.href ? <Link href={fonction.href}>{fonction.organe}</Link> : fonction.organe}
    </span>
    <Periode debut={fonction.dateDebut} fin={fonction.dateFin} />
  </li>
);

/**
 * Fonctions d'un mandat. Mandat en cours : fonctions actives visibles, fonctions terminées
 * repliées. Mandat passé : tout est replié, la frise reste lisible.
 */
const Fonctions = ({ fonctions, enCours }: { fonctions: MandatFonction[]; enCours: boolean }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (fonctions.length === 0) return null;
  const visibles = enCours ? fonctions.filter((fonction) => !fonction.dateFin) : [];
  const repliees = enCours ? fonctions.filter((fonction) => fonction.dateFin) : fonctions;
  return (
    <div className={classes.fonctions}>
      {visibles.length > 0 ? (
        <ul className={classes.fonctionList} aria-label="Fonctions en cours">
          {visibles.map((fonction) => (
            <FonctionItem key={fonction.id} fonction={fonction} />
          ))}
        </ul>
      ) : null}
      {repliees.length > 0 ? (
        <>
          <button
            type="button"
            className={classes.toggle}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown className={classes.chevron} aria-hidden="true" />
            {enCours ? "Anciennes fonctions" : "Fonctions"} ({repliees.length})
          </button>
          <ul id={listId} className={classes.fonctionList} hidden={!open}>
            {repliees.map((fonction) => (
              <FonctionItem key={fonction.id} fonction={fonction} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
};

/**
 * Frise des mandats d'un parlementaire, du plus récent au plus ancien : chambre, période,
 * dates, groupe d'époque (couleur toujours doublée du sigle et du nom), circonscription et
 * fonctions exercées. Le mandat en cours est signalé en texte. Base : `Timeline` de Mantine.
 * Fusionne `MandatsBlock` et `FonctionsMandat` de apps/web.
 */
export const MandatsTimeline = ({
  mandats,
  sexe,
  title = "Mandats",
  headingLevel = 2,
}: MandatsTimelineProps) => {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;
  const sorted = [...mandats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  const deuxChambres = new Set(sorted.map((mandat) => mandat.chambre)).size > 1;

  return (
    <section className={classes.root} aria-labelledby={titleId}>
      <Heading id={titleId} className={classes.title}>
        {title}
      </Heading>
      {sorted.length === 0 ? (
        <EmptyState title="Aucun mandat connu" />
      ) : (
        <Timeline
          bulletSize={14}
          lineWidth={2}
          role="list"
          aria-labelledby={titleId}
          classNames={{
            root: classes.timeline,
            item: classes.item,
            itemBullet: classes.bullet,
            itemTitle: classes.itemTitle,
          }}
        >
          {sorted.map((mandat) => {
            const enCours = !mandat.dateFin;
            const style: CustomProperties | undefined = mandat.groupe
              ? { "--groupe-couleur": couleurGroupe(mandat.groupe.sigle, mandat.groupe.couleur) }
              : undefined;
            return (
              <Timeline.Item
                key={mandat.id}
                role="listitem"
                style={style}
                data-current={enCours || undefined}
                title={
                  <span className={classes.heading}>
                    <span>
                      {deuxChambres ? `${roleOf(mandat.chambre, sexe)} · ` : null}
                      {mandat.periode}
                    </span>
                    {enCours ? (
                      <Badge tone="info" size="sm">
                        En cours
                      </Badge>
                    ) : null}
                  </span>
                }
              >
                <div className={classes.meta}>
                  <ChambreBadge chambre={mandat.chambre} short size="sm" />
                  <Periode debut={mandat.dateDebut} fin={mandat.dateFin} />
                </div>
                {mandat.groupe || mandat.circonscription ? (
                  <div className={classes.meta}>
                    {mandat.groupe ? (
                      <span className={classes.groupe}>
                        <span className={classes.swatch} aria-hidden="true" />
                        <span className="clair-visually-hidden">Groupe : </span>
                        {mandat.groupe.href ? (
                          <Link href={mandat.groupe.href}>{mandat.groupe.nom}</Link>
                        ) : (
                          mandat.groupe.nom
                        )}{" "}
                        ({mandat.groupe.sigle})
                      </span>
                    ) : null}
                    {mandat.circonscription ? <span>{mandat.circonscription}</span> : null}
                  </div>
                ) : null}
                <Fonctions fonctions={mandat.fonctions ?? []} enCours={enCours} />
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
    </section>
  );
};
