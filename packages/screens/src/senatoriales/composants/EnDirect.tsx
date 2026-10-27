import classes from "./Cartes.module.css";

/**
 * Pastille « En direct ». La mise à jour de la page (chaque minute, onglet visible) est faite par
 * la route de l'application, qui seule peut redemander le rendu serveur.
 */
export const EnDirect = () => (
  <span className={classes.direct} title="La page se met à jour chaque minute">
    <span className={classes.directPoint} aria-hidden="true">
      <span className={classes.directOnde} />
    </span>
    En direct
  </span>
);
