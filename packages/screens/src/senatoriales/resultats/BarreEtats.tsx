"use client";

import type { ResumeCirconscription, StatutCirconscription } from "@clair/data";
import { useNavigation } from "@clair/ui";
import { type PointerEvent, useState } from "react";
import { slugDepuisCode } from "../lib/departements.ts";
import classes from "./Resultats.module.css";

export type EtatBarre = { statut: StatutCirconscription; libelle: string; nombre: number };

/**
 * La barre des états de la soirée, et les circonscriptions derrière chacun : au survol à la
 * souris, au toucher, au clavier (la légende est faite de boutons). Le survol n'est écouté que
 * pour une vraie souris : sur écran tactile, le survol simulé rouvrirait le détail refermé.
 */
export const BarreEtats = ({
  etats,
  total,
  circonscriptions,
}: {
  etats: EtatBarre[];
  total: number;
  circonscriptions: Pick<ResumeCirconscription, "departement" | "nom" | "statut">[];
}) => {
  const { Link } = useNavigation();
  const [survol, setSurvol] = useState<StatutCirconscription | null>(null);
  const [epingle, setEpingle] = useState<StatutCirconscription | null>(null);
  const affiche = survol ?? epingle;
  const etatAffiche = etats.find((e) => e.statut === affiche);
  const liste = affiche
    ? circonscriptions
        .filter((c) => c.statut === affiche)
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    : [];

  const entree = (statut: StatutCirconscription) => (e: PointerEvent) => {
    if (e.pointerType === "mouse") setSurvol(statut);
  };
  const sortie = (e: PointerEvent) => {
    if (e.pointerType === "mouse") setSurvol(null);
  };
  const basculer = (statut: StatutCirconscription) => {
    setSurvol(null);
    setEpingle((actuel) => (actuel === statut ? null : statut));
  };

  return (
    <div className={classes.barreEtats} onPointerLeave={sortie}>
      <div className={classes.barre}>
        {etats.map((o) => (
          <button
            key={o.statut}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={classes.segmentEtat}
            data-statut={o.statut}
            data-estompe={(affiche !== null && affiche !== o.statut) || undefined}
            style={{ width: `${(o.nombre / total) * 100}%` }}
            onPointerEnter={entree(o.statut)}
            onClick={() => basculer(o.statut)}
          />
        ))}
      </div>
      <ul className={classes.legendeEtats}>
        {etats.map((o) => (
          <li key={o.statut}>
            <button
              type="button"
              aria-expanded={affiche === o.statut}
              aria-controls="detail-etats"
              className={classes.boutonEtat}
              data-actif={affiche === o.statut || undefined}
              onPointerEnter={entree(o.statut)}
              onClick={() => basculer(o.statut)}
            >
              <span className={classes.carreEtat} data-statut={o.statut} aria-hidden="true" />
              {o.libelle} <strong className={classes.fort}>{o.nombre}</strong>
            </button>
          </li>
        ))}
      </ul>
      <div id="detail-etats" aria-live="polite">
        {etatAffiche ? (
          <div className={classes.detailEtats}>
            <p className={classes.detailTitre}>
              {etatAffiche.libelle} : {etatAffiche.nombre}
            </p>
            <ul className={classes.detailListe}>
              {liste.map((c) => {
                const slug = slugDepuisCode(c.departement);
                return (
                  <li key={c.departement}>
                    {slug ? (
                      <Link href={`/senatoriales-2026/${slug}`} className={classes.puce}>
                        {c.nom}
                      </Link>
                    ) : (
                      <span className={classes.puce}>{c.nom}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className={classes.aideEtats}>
            Survolez ou touchez un état pour voir les circonscriptions concernées.
          </p>
        )}
      </div>
    </div>
  );
};
