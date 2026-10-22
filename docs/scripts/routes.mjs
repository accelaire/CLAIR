// Adresse publique d'une page, à partir de son chemin dans docs/.
//
// Les préfixes numériques des dossiers (`01-guide`, `02-donnees`) ne servent
// qu'à ordonner la navigation : ils ne doivent pas apparaître dans les URLs,
// sans quoi renommer ou réordonner une section casserait tous les liens.
// La navigation et le contrôle des liens partagent cette fonction pour ne
// jamais diverger.

/** Chemin relatif d'un fichier (`01-guide/stack-technique.mdx`) → URL (`/guide/stack-technique`). */
export function routeFromRelPath(relPath) {
  const sansExtension = relPath.replace(/\\/g, "/").replace(/\.mdx?$/, "");
  const segments = sansExtension
    .split("/")
    .map((segment) => segment.replace(/^(\d+-)+/, ""))
    .filter((segment, i, all) => !(segment === "index" && i === all.length - 1));
  return "/" + segments.join("/");
}

/** Ancienne URL de la page, préfixes compris, telle que servie jusqu'en octobre 2026. */
export function legacyRouteFromRelPath(relPath) {
  const sansExtension = relPath.replace(/\\/g, "/").replace(/\.mdx?$/, "");
  const segments = sansExtension
    .split("/")
    .filter((segment, i, all) => !(segment === "index" && i === all.length - 1));
  return "/" + segments.join("/");
}
