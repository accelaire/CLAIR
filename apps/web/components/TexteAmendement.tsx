import { Fragment } from 'react';
import { segmenterTexteAmendement, type RenvoiDispositif } from '@/lib/texte-amendement';

interface TexteAmendementProps {
  /** Le texte tel que l'API le renvoie (dispositif ou exposé sommaire). */
  texte: string;
  /** Renvois au droit en vigueur, en positions dans `texte` (dispositif seulement). */
  renvois?: RenvoiDispositif[];
  className?: string;
}

const TITRE_LIEN = "Sur Légifrance, dans la version en vigueur au dépôt de l'amendement";

/**
 * Texte d'un amendement, rendu en texte (jamais en HTML), retours à la ligne
 * gardés. Les articles et textes de loi cités par le dispositif mènent à
 * Légifrance.
 */
export function TexteAmendement({ texte, renvois, className }: TexteAmendementProps) {
  const segments = segmenterTexteAmendement(texte, renvois);
  return (
    <p className={`whitespace-pre-line break-words ${className ?? ''}`}>
      {segments.map((s, i) =>
        s.renvoi ? (
          <a
            key={i}
            href={s.renvoi.url}
            target="_blank"
            rel="noopener noreferrer"
            title={TITRE_LIEN}
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            {s.texte}
            <span className="sr-only"> (Légifrance, nouvel onglet)</span>
          </a>
        ) : (
          <Fragment key={i}>{s.texte}</Fragment>
        ),
      )}
    </p>
  );
}
