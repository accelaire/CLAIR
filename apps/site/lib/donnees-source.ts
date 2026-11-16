/**
 * Retire `sourceData` (le brut de la source officielle : JSON de l'Assemblée, du Sénat, de la
 * HATVP…) à toute profondeur d'une réponse de l'API. Aucun écran ne le lit ; laissé dans une
 * réponse passée à un composant client, il est sérialisé dans le HTML (8 à 24 Ko par fiche).
 * Même règle que `sansDonneesSource` de apps/web (commit ce9d67c), appliquée ici à l'objet déjà
 * lu par le client HTTP. Renvoie une copie : la réponse d'origine n'est pas modifiée.
 */
export const sansDonneesSource = <T>(valeur: T): T => nettoyer(valeur) as T;

const nettoyer = (valeur: unknown): unknown => {
  if (Array.isArray(valeur)) return valeur.map(nettoyer);
  if (valeur === null || typeof valeur !== "object") return valeur;
  const copie: Record<string, unknown> = {};
  for (const [cle, contenu] of Object.entries(valeur)) {
    if (cle !== "sourceData") copie[cle] = nettoyer(contenu);
  }
  return copie;
};
