"use client";

import { Link, ProvenanceLabel, ShareButton } from "@clair/ui";
import { Download, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { GRAPHIQUES, type SlugGraphique } from "../lib/graphiques.ts";
import classes from "./CadreGraphique.module.css";

type CadreGraphiqueProps = {
  slug: SlugGraphique;
  titre: string;
  sousTitre?: string;
  children: ReactNode;
  /** `h1` sur la page dédiée au graphique, `h2` quand il est intégré à la page mère. */
  niveauTitre?: "h1" | "h2";
  /** Affiche le lien « voir en grand », inutile sur la page dédiée elle-même. */
  lienPageDediee?: boolean;
};

/**
 * Habillage commun d'un graphique : titre, actions (voir en grand, télécharger l'image,
 * partager) et nature de la donnée. Le partage vise toujours la page dédiée du graphique : son
 * aperçu Open Graph est celui du graphique. Le PNG téléchargé est produit par la même fonction
 * que cet aperçu.
 */
export const CadreGraphique = ({
  slug,
  titre,
  sousTitre,
  children,
  niveauTitre = "h2",
  lienPageDediee = false,
}: CadreGraphiqueProps) => {
  const Titre = niveauTitre;
  const chemin = `/senatoriales-2026/graphiques/${slug}`;
  const meta = GRAPHIQUES[slug];

  return (
    <section id={slug} className={classes.cadre} aria-labelledby={`titre-graphique-${slug}`}>
      <div className={classes.entete}>
        <div className={classes.titres}>
          <Titre id={`titre-graphique-${slug}`} className={classes.titre} data-niveau={niveauTitre}>
            {titre}
          </Titre>
          {sousTitre ? <p className={classes.sousTitre}>{sousTitre}</p> : null}
          <ProvenanceLabel provenance="calculee" methodologyHref="/methodologie" />
        </div>
        <div className={classes.actions}>
          {lienPageDediee ? (
            <Link href={chemin} className={classes.action} title="Voir en grand">
              <Maximize2 aria-hidden="true" />
              <span className="clair-visually-hidden">Voir « {titre} » en grand</span>
            </Link>
          ) : null}
          <a
            href={`${chemin}/image`}
            download={`clair-senatoriales-2026-${slug}.png`}
            title="Télécharger l'image"
            className={classes.action}
          >
            <Download aria-hidden="true" />
            <span className="clair-visually-hidden">Télécharger l'image de « {titre} »</span>
          </a>
          <ShareButton
            url={chemin}
            title={`${meta.titre} — Sénatoriales 2026`}
            text={meta.sousTitre}
            iconOnly
          />
        </div>
      </div>
      {children}
    </section>
  );
};
