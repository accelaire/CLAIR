import type { HTMLAttributes, ReactNode } from "react";
import classes from "./Container.module.css";

export type ContainerSize = "etroit" | "normal";

export type ContainerProps = HTMLAttributes<HTMLElement> & {
  /** Largeur maximale : `normal` (largeur du site) ou `etroit` (colonne de lecture). */
  size?: ContainerSize;
  /** Élément rendu : `div` par défaut, `section` ou `article` pour une zone qui a un titre. */
  as?: "div" | "section" | "article";
  children: ReactNode;
};

/**
 * Conteneur de contenu : centre la page, limite sa largeur (`--clair-largeur-contenu`, ou une
 * colonne de lecture en `etroit`) et pose les marges latérales. Ne porte aucune sémantique en
 * `div` ; utiliser `as="section"` avec un titre (`aria-labelledby`) pour une zone nommée.
 */
export const Container = ({
  size = "normal",
  as: Element = "div",
  className,
  children,
  ...props
}: ContainerProps) => (
  <Element
    {...props}
    className={[classes.container, className].filter(Boolean).join(" ")}
    data-size={size}
  >
    {children}
  </Element>
);
