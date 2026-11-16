"use client";

import { Timeline } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
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

/**
 * Poste au Gouvernement ou présidence de la République : une entrée de la frise au même rang
 * qu'un mandat (un député nommé ministre cède son siège : ce n'est pas une fonction exercée
 * pendant son mandat).
 */
export type PosteGouvernemental = {
  id: string;
  /** Nature du poste, dite en texte dans l'entrée ; « gouvernement » par défaut. */
  nature?: "gouvernement" | "presidence";
  /** Libellé du poste (« Ministre · Armées », « Premier ministre »). */
  libelle: string;
  /** Dates ISO ; sans fin, le poste est en cours. */
  dateDebut: string;
  dateFin?: string | null;
  /** Gouvernement du poste : « Gouvernement <nom> », lien vers sa page s'il y en a une. */
  gouvernement?: { nom: string; href?: string } | null;
  /** Contenu ajouté sous l'entrée, par exemple le bilan du poste. */
  details?: ReactNode;
};

export type MandatsTimelineProps = {
  /** Mandats, dans n'importe quel ordre : ils sont affichés du plus récent au plus ancien. */
  mandats: Mandat[];
  /**
   * Postes au Gouvernement et présidence de la République, insérés dans la frise à leur date
   * parmi les mandats. Pastille carrée, et nature du poste écrite en toutes lettres.
   */
  postes?: PosteGouvernemental[];
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

const NATURES: Record<NonNullable<PosteGouvernemental["nature"]>, string> = {
  gouvernement: "Gouvernement",
  presidence: "Présidence de la République",
};

/** Entrée d'un poste au Gouvernement : libellé, nature, dates, gouvernement, détails. */
const posteItem = (poste: PosteGouvernemental) => {
  const enCours = !poste.dateFin;
  return (
    <Timeline.Item
      key={`poste-${poste.id}`}
      role="listitem"
      data-poste={poste.nature ?? "gouvernement"}
      data-current={enCours || undefined}
      title={
        <span className={classes.heading}>
          <span>{poste.libelle}</span>
          {enCours ? (
            <Badge tone="info" size="sm">
              En cours
            </Badge>
          ) : null}
        </span>
      }
    >
      <div className={classes.meta}>
        <Badge size="sm">{NATURES[poste.nature ?? "gouvernement"]}</Badge>
        <Periode debut={poste.dateDebut} fin={poste.dateFin} />
      </div>
      {poste.gouvernement ? (
        <div className={classes.meta}>
          {poste.gouvernement.href ? (
            <Link href={poste.gouvernement.href}>Gouvernement {poste.gouvernement.nom}</Link>
          ) : (
            <span>Gouvernement {poste.gouvernement.nom}</span>
          )}
        </div>
      ) : null}
      {poste.details ? <div className={classes.details}>{poste.details}</div> : null}
    </Timeline.Item>
  );
};

/**
 * Frise des mandats d'un parlementaire, du plus récent au plus ancien : chambre, période,
 * dates, groupe d'époque (couleur toujours doublée du sigle et du nom), circonscription et
 * fonctions exercées. Le mandat en cours est signalé en texte. Les postes au Gouvernement
 * s'insèrent à leur date (pastille carrée, nature du poste en texte). Base : `Timeline` de
 * Mantine. Fusionne `MandatsBlock`, `EntreeGouvernementale` et `FonctionsMandat` de apps/web.
 */
export const MandatsTimeline = ({
  mandats,
  postes = [],
  sexe,
  title = "Mandats",
  headingLevel = 2,
}: MandatsTimelineProps) => {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;
  const sorted = [...mandats].sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  const deuxChambres = new Set(sorted.map((mandat) => mandat.chambre)).size > 1;
  // Mandats et postes dans une seule frise : les dates ISO (jour seul ou horodatage) se
  // comparent comme des chaînes.
  const entrees = [
    ...sorted.map((mandat) => ({ type: "mandat" as const, debut: mandat.dateDebut, mandat })),
    ...postes.map((poste) => ({ type: "poste" as const, debut: poste.dateDebut, poste })),
  ].sort((a, b) => b.debut.localeCompare(a.debut));

  return (
    <section className={classes.root} aria-labelledby={titleId}>
      <Heading id={titleId} className={classes.title}>
        {title}
      </Heading>
      {entrees.length === 0 ? (
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
          {entrees.map((entree) => {
            if (entree.type === "poste") return posteItem(entree.poste);
            const { mandat } = entree;
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
