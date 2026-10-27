import classes from "./SkipLink.module.css";

export type SkipLinkProps = {
  /** Identifiant de la zone de contenu principal (sans `#`). */
  target?: string;
  children?: string;
};

/**
 * Lien d'évitement : premier élément atteint au clavier, il mène directement au contenu.
 * Invisible tant qu'il n'a pas le focus (RGAA 12.7).
 */
export const SkipLink = ({ target = "contenu", children = "Aller au contenu" }: SkipLinkProps) => (
  <a className={classes.skipLink} href={`#${target}`}>
    {children}
  </a>
);
