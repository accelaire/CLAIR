"use client";

import type { RenvoiDispositif } from "@clair/data";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import classes from "./TexteAmendement.module.css";
import {
  longueurSegments,
  type SegmentTexte,
  segmenterTexteAmendement,
  tronquerSegments,
} from "./texte-amendement.ts";

export type TexteAmendementProps = {
  /** Le texte tel que l'API le renvoie (dispositif ou exposé sommaire, HTML de la source accepté). */
  texte: string;
  /** Renvois au droit en vigueur, en positions dans `texte` (dispositif seulement). */
  renvois?: readonly RenvoiDispositif[];
  /** Caractères affichés replié ; au-delà, le bouton « Lire la suite » apparaît. */
  maxLength?: number;
};

const TITRE_LIEN = "Sur Légifrance, dans la version en vigueur au dépôt de l'amendement";

const Passages = ({ segments }: { segments: readonly SegmentTexte[] }) =>
  segments.map((segment, index) =>
    segment.renvoi ? (
      <a
        key={index}
        href={segment.renvoi.url}
        target="_blank"
        rel="noopener noreferrer"
        title={TITRE_LIEN}
        className={classes.lien}
      >
        {segment.texte}
        <span className="clair-visually-hidden"> (Légifrance, nouvel onglet)</span>
      </a>
    ) : (
      <span key={index}>{segment.texte}</span>
    ),
  );

/**
 * Texte d'un amendement, rendu en texte (jamais en HTML injecté), retours à la ligne gardés.
 * Les articles et textes de loi cités par le dispositif (`renvois`) mènent à Légifrance, dans la
 * version en vigueur au dépôt. Un texte long est replié, avec « Lire la suite » (`aria-expanded`).
 * Reprend `TexteAmendement` de apps/web.
 */
export const TexteAmendement = ({ texte, renvois, maxLength = 280 }: TexteAmendementProps) => {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const segments = segmenterTexteAmendement(texte, renvois);
  const long = longueurSegments(segments) > maxLength;

  if (!long) {
    return (
      <p className={classes.text}>
        <Passages segments={segments} />
      </p>
    );
  }

  return (
    <div className={classes.root}>
      <p id={id} className={classes.text}>
        {expanded ? (
          <Passages segments={segments} />
        ) : (
          <>
            <Passages segments={tronquerSegments(segments, maxLength)} />…
          </>
        )}
      </p>
      <button
        type="button"
        className={classes.toggle}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Réduire" : "Lire la suite"}
        <ChevronDown className={classes.chevron} aria-hidden="true" />
      </button>
    </div>
  );
};
