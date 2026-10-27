"use client";

import { Button } from "@clair/ui";
import { useId, useState } from "react";
import { pointsDeLOrdreDuJour } from "../shared/reunions/reunions.ts";
import classes from "./CommissionFicheScreen.module.css";

/** Points affichés avant de replier : au-delà, la carte devient illisible. */
const VISIBLES = 3;

/**
 * Ordre du jour d'une réunion, un point par ligne et en entier (jamais rogné en plein mot).
 * Au-delà de trois points, la suite se déplie (`aria-expanded`).
 */
export const OrdreDuJour = ({
  resume,
  complet,
}: {
  resume: string | null;
  complet: string | null;
}) => {
  const [deplie, setDeplie] = useState(false);
  const id = useId();
  const points = pointsDeLOrdreDuJour(resume, complet);
  if (points.length === 0) return null;
  const visibles = deplie ? points : points.slice(0, VISIBLES);
  const masques = points.length - VISIBLES;
  return (
    <div className={classes.odj}>
      <ul id={id} className={classes.odjListe} aria-label="Ordre du jour">
        {visibles.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
      {masques > 0 ? (
        <Button
          variant="tertiaire"
          size="sm"
          aria-expanded={deplie}
          aria-controls={id}
          onClick={() => setDeplie((etat) => !etat)}
        >
          {deplie
            ? "Réduire l'ordre du jour"
            : `Voir ${masques === 1 ? "l'autre point" : `les ${masques} autres points`} de l'ordre du jour`}
        </Button>
      ) : null}
    </div>
  );
};
