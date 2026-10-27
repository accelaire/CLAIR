"use client";

import { Loader, Skeleton } from "@mantine/core";
import { CircleAlert, Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import classes from "./QueryStates.module.css";

export type LoadingStateProps = {
  /** Message annoncé aux lecteurs d'écran (et affiché avec l'indicateur rotatif). */
  label?: string;
  /** `loader` : indicateur rotatif et message ; `skeleton` : lignes fantômes à la place du contenu. */
  variant?: "loader" | "skeleton";
  /** Nombre de lignes fantômes (variante `skeleton`). */
  lines?: number;
};

/**
 * État de chargement d'un écran ou d'un bloc. Annoncé poliment (`role="status"`) ; les
 * squelettes sont décoratifs, seul le message est lu.
 */
export const LoadingState = ({
  label = "Chargement en cours…",
  variant = "loader",
  lines = 3,
}: LoadingStateProps) => (
  <div className={classes.state} data-state="loading" data-variant={variant}>
    <div role="status" aria-live="polite" className={classes.status}>
      {variant === "loader" ? (
        <>
          <Loader size="sm" color="var(--clair-fond-action)" aria-hidden="true" />
          <span>{label}</span>
        </>
      ) : (
        <span className="clair-visually-hidden">{label}</span>
      )}
    </div>
    {variant === "skeleton" ? (
      <div className={classes.skeleton} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            height="var(--clair-texte-md-interligne)"
            width={index === lines - 1 ? "60%" : "100%"}
            radius="var(--clair-rayon-sm)"
          />
        ))}
      </div>
    ) : null}
  </div>
);

export type ErrorStateProps = {
  /** Titre court de l'erreur. */
  title?: string;
  /** Explication et, si possible, ce que la personne peut faire. */
  message?: ReactNode;
  /** Relance la requête : affiche le bouton « Réessayer ». Sans elle, pas de bouton. */
  onRetry?: () => void;
  /** Libellé du bouton de relance. */
  retryLabel?: string;
};

/**
 * Erreur récupérable d'un écran ou d'un bloc, annoncée immédiatement (`role="alert"`),
 * avec un bouton « Réessayer » quand la requête peut être relancée.
 */
export const ErrorState = ({
  title = "Le chargement a échoué",
  message = "Les données n'ont pas pu être récupérées. Vérifiez votre connexion puis réessayez.",
  onRetry,
  retryLabel = "Réessayer",
}: ErrorStateProps) => (
  <div className={classes.state} data-state="error">
    <div role="alert" className={classes.body}>
      <span className={classes.iconWrapper} aria-hidden="true">
        <CircleAlert />
      </span>
      <p className={classes.title}>{title}</p>
      {message ? <div className={classes.description}>{message}</div> : null}
    </div>
    {onRetry ? (
      <button type="button" className={classes.button} onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        {retryLabel}
      </button>
    ) : null}
  </div>
);

export type EmptyStateProps = {
  /** Ce qui est vide (« Aucun scrutin trouvé »). */
  title: string;
  /** Pourquoi c'est vide, ou comment obtenir des résultats. */
  description?: ReactNode;
  /** Action proposée (lien ou bouton, par exemple « Effacer les filtres »). */
  action?: ReactNode;
  /** Icône décorative ; une boîte vide par défaut. */
  icon?: ReactNode;
};

/** État vide : la requête a réussi mais ne renvoie rien. Propose une action si possible. */
export const EmptyState = ({ title, description, action, icon }: EmptyStateProps) => (
  <div className={classes.state} data-state="empty">
    <div className={classes.body}>
      <span className={classes.iconWrapper} aria-hidden="true">
        {icon ?? <Inbox />}
      </span>
      <p className={classes.title}>{title}</p>
      {description ? <div className={classes.description}>{description}</div> : null}
    </div>
    {action ? <div className={classes.action}>{action}</div> : null}
  </div>
);
