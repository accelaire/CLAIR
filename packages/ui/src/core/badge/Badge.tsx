import type { ReactNode } from "react";
import classes from "./Badge.module.css";

export type BadgeTone = "neutre" | "info" | "succes" | "erreur" | "avertissement";

export type BadgeProps = {
  /** Ton du badge. La couleur n'est jamais seule : le libellé porte l'information. */
  tone?: BadgeTone;
  /** Icône décorative placée avant le libellé (masquée aux lecteurs d'écran). */
  icon?: ReactNode;
  size?: "sm" | "md";
  children: ReactNode;
};

/**
 * Étiquette courte de statut ou de catégorie (« Adopté », « En cours »…).
 * Remplace les classes `.badge-*` de apps/web.
 */
export const Badge = ({ tone = "neutre", icon, size = "md", children }: BadgeProps) => (
  <span className={classes.badge} data-tone={tone} data-size={size}>
    {icon ? (
      <span className={classes.icon} aria-hidden="true">
        {icon}
      </span>
    ) : null}
    {children}
  </span>
);
