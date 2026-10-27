"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { type LinkProps as RouterLinkProps, useNavigation } from "../../lib/navigation.tsx";
import classes from "./Link.module.css";

export type LinkProps = Omit<RouterLinkProps, "children"> & {
  /** Lien vers un autre site : ouvert dans un nouvel onglet, annoncé aux lecteurs d'écran. */
  external?: boolean;
  children: ReactNode;
};

/**
 * Lien de texte. Interne : rendu par le routeur de l'application (aucun `next/*` ici).
 * Externe : nouvel onglet, icône et mention « nouvelle fenêtre » pour les lecteurs d'écran.
 */
export const Link = ({ external = false, children, className, ...props }: LinkProps) => {
  const { Link: RouterLink } = useNavigation();
  const classNames = [classes.link, className].filter(Boolean).join(" ");
  if (external) {
    return (
      <a {...props} className={classNames} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink className={classes.icon} aria-hidden="true" />
        <span className="clair-visually-hidden"> (nouvelle fenêtre)</span>
      </a>
    );
  }
  return (
    <RouterLink {...props} className={classNames}>
      {children}
    </RouterLink>
  );
};
