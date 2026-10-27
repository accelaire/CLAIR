"use client";

import "@clair/theme/tokens.css";
import { useEffect } from "react";
import classes from "./global-error.module.css";

type Props = { error: Error & { digest?: string }; retry: () => void };

/**
 * Erreur du layout racine : elle remplace tout le document (ni en-tête, ni thème Mantine, ni
 * styles globaux). Page autonome et minimale : HTML simple, tokens CSS, aucun composant qui
 * pourrait lui-même échouer. L'erreur est journalisée avec son `digest`.
 */
const GlobalError = ({ error, retry }: Props) => {
  useEffect(() => {
    console.error("[site] erreur du layout racine", { digest: error.digest }, error);
  }, [error]);
  return (
    <html lang="fr">
      <body className={classes.body}>
        <title>Erreur | CLAIR.vote</title>
        <main className={classes.page}>
          <p className={classes.marque}>CLAIR.vote</p>
          <h1 className={classes.titre}>Le site a rencontré une erreur</h1>
          <p className={classes.texte}>
            La page n'a pas pu s'afficher. Réessayez dans un instant ; si l'erreur persiste, revenez
            plus tard.
          </p>
          {error.digest ? (
            <p className={classes.texte}>
              Référence de l'erreur : <code>{error.digest}</code>
            </p>
          ) : null}
          <div className={classes.actions}>
            <button type="button" className={classes.bouton} onClick={() => retry()}>
              Réessayer
            </button>
            <a href="/" className={classes.lien}>
              Revenir à l'accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
