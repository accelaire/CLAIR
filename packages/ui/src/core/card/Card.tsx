"use client";

import type { ReactNode } from "react";
import { useNavigation } from "../../lib/navigation.tsx";
import classes from "./Card.module.css";

export type CardHeading = "h2" | "h3" | "h4" | "h5" | "h6";

type CardBaseProps = {
  /** Élément racine : `article` pour un contenu autonome, `li` dans une liste de cartes. */
  as?: "div" | "article" | "section" | "li";
  /** Niveau du titre, à choisir selon la hiérarchie de la page (`h3` par défaut). */
  titleAs?: CardHeading;
  /** Contenu placé au-dessus du titre (badge, catégorie). */
  eyebrow?: ReactNode;
  /** Pied de carte (date, source, métadonnées). */
  footer?: ReactNode;
  /** Marges intérieures. */
  padding?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
};

/** Carte simple : titre facultatif, aucune adresse. */
type StaticCardProps = CardBaseProps & {
  title?: ReactNode;
  href?: undefined;
  external?: undefined;
};

/**
 * Carte cliquable : le titre est l'unique lien et sa zone cliquable couvre toute la carte.
 * Le contenu et le pied ne doivent contenir aucun autre élément interactif.
 */
type LinkCardProps = CardBaseProps & {
  title: ReactNode;
  href: string;
  /** Lien vers un autre site : nouvel onglet, annoncé aux lecteurs d'écran. */
  external?: boolean;
};

export type CardProps = StaticCardProps | LinkCardProps;

/**
 * Surface (bordure, rayon, marges) qui regroupe un contenu. Cliquable avec `href` :
 * motif « lien bloc », un seul lien (le titre) dont la zone couvre toute la carte, sans liens
 * imbriqués. Remplace `.depute-card` et `.stat-card` de apps/web.
 */
export const Card = ({
  as: Root = "div",
  titleAs: Heading = "h3",
  title,
  eyebrow,
  footer,
  padding = "md",
  href,
  external = false,
  className,
  children,
}: CardProps) => {
  const { Link: RouterLink } = useNavigation();

  const titleContent =
    href === undefined ? (
      title
    ) : external ? (
      <a href={href} className={classes.link} target="_blank" rel="noopener noreferrer">
        {title}
        <span className="clair-visually-hidden"> (nouvelle fenêtre)</span>
      </a>
    ) : (
      <RouterLink href={href} className={classes.link}>
        {title}
      </RouterLink>
    );

  const hasHeader = title !== undefined || eyebrow !== undefined;

  return (
    <Root
      className={[classes.card, className].filter(Boolean).join(" ")}
      data-padding={padding}
      data-clickable={href !== undefined || undefined}
    >
      {hasHeader ? (
        <div className={classes.header}>
          {title !== undefined ? <Heading className={classes.title}>{titleContent}</Heading> : null}
          {eyebrow !== undefined ? <div className={classes.eyebrow}>{eyebrow}</div> : null}
        </div>
      ) : null}
      {children !== undefined ? <div className={classes.body}>{children}</div> : null}
      {footer !== undefined ? <div className={classes.footer}>{footer}</div> : null}
    </Root>
  );
};
