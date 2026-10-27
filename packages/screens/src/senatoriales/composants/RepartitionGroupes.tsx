"use client";

import type { GroupeRepartition } from "@clair/data";
import { couleurGroupe } from "@clair/ui";
import { nomGroupe } from "../lib/format.ts";
import classes from "./Cartes.module.css";

/**
 * Barre empilée des sièges sortants par groupe, et sa légende chiffrée (qui porte l'information
 * en texte : la barre seule est décorative pour un lecteur d'écran).
 */
export const RepartitionGroupes = ({
  parGroupe,
  total,
}: {
  parGroupe: GroupeRepartition[];
  total: number;
}) => {
  if (total === 0 || parGroupe.length === 0) return null;
  return (
    <div className={classes.repartition}>
      <div
        className={classes.barreEmpilee}
        role="img"
        aria-label="Répartition des sièges sortants par groupe politique"
      >
        {parGroupe.map((groupe) => (
          <span
            key={groupe.slug}
            className={classes.segment}
            style={{
              width: `${(groupe.sieges / total) * 100}%`,
              backgroundColor: couleurGroupe(nomGroupe(groupe), groupe.couleur),
            }}
            title={`${nomGroupe(groupe)} — ${groupe.sieges} siège${groupe.sieges > 1 ? "s" : ""}`}
          />
        ))}
      </div>
      <ul className={classes.legendeGroupes}>
        {parGroupe.map((groupe) => (
          <li key={groupe.slug}>
            <span
              className={classes.pointGroupe}
              style={{ backgroundColor: couleurGroupe(nomGroupe(groupe), groupe.couleur) }}
              aria-hidden="true"
            />
            <span>{nomGroupe(groupe)}</span>
            <span className={`${classes.texteMention} clair-chiffres`}>
              {groupe.sieges}
              <span className="clair-visually-hidden"> siège{groupe.sieges > 1 ? "s" : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
