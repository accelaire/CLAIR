"use client";

import { Link } from "@clair/ui";
import classes from "./ErrorScreen.module.css";

/** Erreur de chargement d'une page : message, nouvelle tentative et retour à l'accueil. */
export const ErrorScreen = ({ onRetry }: { onRetry?: () => void }) => (
  <div className={classes.page} role="alert">
    <h1>Une erreur est survenue</h1>
    <p className={classes.text}>
      La page n'a pas pu être chargée. Réessayez dans un instant ; si l'erreur persiste, l'équipe de
      CLAIR en est informée.
    </p>
    <div className={classes.actions}>
      {onRetry ? (
        <button type="button" className={classes.retry} onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
      <Link href="/">Revenir à l'accueil</Link>
    </div>
  </div>
);
