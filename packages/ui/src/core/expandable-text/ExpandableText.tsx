"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import classes from "./ExpandableText.module.css";

export type ExpandableTextProps = {
  /** Texte complet (les retours à la ligne sont conservés). */
  children: string;
  /** Nombre de caractères affichés replié ; au-delà, le bouton « Lire la suite » apparaît. */
  maxLength?: number;
  /** Texte déplié au premier rendu. */
  defaultExpanded?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
};

/** Coupe le texte au dernier mot entier avant `maxLength`. */
const truncate = (text: string, maxLength: number) => {
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.search(/\s\S*$/);
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
};

/**
 * Texte long replié, avec un bouton « Lire la suite » / « Réduire » (`aria-expanded`,
 * `aria-controls`). Un texte court s'affiche entier, sans bouton. La coupe se fait au nombre
 * de caractères : le rendu est identique côté serveur et côté navigateur.
 * Remplace `ExpandableText` de apps/web (qui chargeait lui-même la suite du texte).
 */
export const ExpandableText = ({
  children,
  maxLength = 280,
  defaultExpanded = false,
  expandLabel = "Lire la suite",
  collapseLabel = "Réduire",
}: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const id = useId();
  const text = children.trim();
  const long = text.length > maxLength;

  if (!long) {
    return <p className={classes.text}>{text}</p>;
  }

  return (
    <div className={classes.root}>
      <p id={id} className={classes.text}>
        {expanded ? text : `${truncate(text, maxLength)}…`}
      </p>
      <button
        type="button"
        className={classes.toggle}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? collapseLabel : expandLabel}
        <ChevronDown className={classes.chevron} aria-hidden="true" />
      </button>
    </div>
  );
};
