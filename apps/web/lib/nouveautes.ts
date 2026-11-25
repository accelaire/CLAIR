// =============================================================================
// Sections récentes, signalées « Nouveau »
// =============================================================================
//
// Le menu et l'accueil marquent ces pages jusqu'à une date fixée à l'avance :
// le marqueur s'éteint seul, sans retouche ni redéploiement à prévoir. Pour
// signaler une nouvelle section, ajouter son chemin et la date du dernier jour
// où elle est marquée (jour civil à Paris).
//
// Le menu retire aussi le marqueur d'une section que le visiteur a déjà
// ouverte (cf. `hooks/useNouveautesNonVues`). L'accueil le garde : ses cartes
// sont rendues côté serveur, sans rien savoir du visiteur.
// =============================================================================

import { aujourdhuiParis } from './petitions';

const NOUVEAUTES: Record<string, string> = {
  '/gouvernements': '2027-01-31',
  '/petitions': '2027-01-31',
};

/** Ce chemin mène à une section encore signalée comme nouvelle. */
export function estNouveau(chemin: string, aujourdhui: string = aujourdhuiParis()): boolean {
  const fin = NOUVEAUTES[chemin];
  return fin !== undefined && aujourdhui <= fin;
}

/** La section signalée qui contient ce chemin (`/petitions/senat/742` → `/petitions`). */
export function sectionNouvelleDe(chemin: string): string | null {
  return Object.keys(NOUVEAUTES).find((section) => chemin === section || chemin.startsWith(`${section}/`)) ?? null;
}
