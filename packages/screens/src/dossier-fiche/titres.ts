import type { DossierDetail } from "@clair/data";

/**
 * Titres d'un dossier, sans React : utilisables par la route (métadonnées, côté serveur) comme
 * par l'écran.
 */

/** Le titre court n'est affichable que s'il n'est pas un code technique (uid, `mots_lies`). */
export const titreCourtLisible = (dossier: Pick<DossierDetail, "titreCourt" | "uid">) =>
  dossier.titreCourt && !dossier.titreCourt.includes("_") && dossier.titreCourt !== dossier.uid
    ? dossier.titreCourt
    : null;

/** « relative à… » devient « Proposition de loi ordinaire relative à… » (comme apps/web). */
export const titreDossier = (dossier: Pick<DossierDetail, "titre" | "procedureLibelle">) => {
  const premier = dossier.titre.charAt(0);
  return premier !== premier.toUpperCase() && dossier.procedureLibelle
    ? `${dossier.procedureLibelle} ${dossier.titre}`
    : dossier.titre;
};
