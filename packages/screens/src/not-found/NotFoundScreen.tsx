import { Link } from "@clair/ui";
import classes from "./NotFoundScreen.module.css";

/** Page introuvable : message et chemins de repli. */
export const NotFoundScreen = () => (
  <div className={classes.page}>
    <p className={classes.code}>404</p>
    <h1>Page introuvable</h1>
    <p className={classes.text}>
      Cette page n'existe pas ou a été déplacée. Les données de CLAIR sont mises à jour chaque jour
      : un élu, un scrutin ou un texte a pu changer d'adresse.
    </p>
    <ul className={classes.links}>
      <li>
        <Link href="/">Revenir à l'accueil</Link>
      </li>
      <li>
        <Link href="/recherche">Faire une recherche</Link>
      </li>
    </ul>
  </div>
);
