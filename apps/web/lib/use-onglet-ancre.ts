'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * L'onglet ouvert d'une page, porté par l'ancre de l'URL (`/scrutins/42#vote`).
 *
 * Toute page à onglets s'en sert, pour qu'un lien mène à un onglet précis. Une
 * ancre plutôt qu'un paramètre de recherche : `useSearchParams` sous Suspense
 * annule le prérendu des pages servies en statique, et l'ancre ne part pas au
 * serveur (pas de nouvelle page à mettre en cache par onglet).
 *
 * - Au premier rendu, l'onglet par défaut (le HTML servi est le même pour
 *   tous) ; l'ancre est lue au montage, puis à chaque changement.
 * - `cles` peut changer (onglets qui n'apparaissent qu'avec les données) :
 *   une ancre lue avant l'arrivée des données s'applique dès que son onglet
 *   existe.
 * - Choisir un onglet réécrit l'ancre sans ajouter d'entrée à l'historique,
 *   en gardant l'état que le routeur de Next y range (le remplacer par `null`
 *   fige la page).
 * - Une ancre valide, à l'arrivée ou pendant la visite (lien de la page vers
 *   un de ses onglets), amène la barre d'onglets à l'écran : `barre` est la
 *   référence à poser sur elle.
 */
export function useOngletAncre<T extends string>(
  cles: readonly T[],
  defaut: T,
): {
  actif: T;
  /** L'onglet demandé par l'ancre ou par un clic, `null` sinon : pour une page dont le défaut dépend des données. */
  explicite: T | null;
  choisir: (cle: T) => void;
  barre: React.RefObject<HTMLDivElement>;
} {
  const [choisi, setChoisi] = useState<T | null>(null);
  const barre = useRef<HTMLDivElement>(null);
  const signature = cles.join('|');

  useEffect(() => {
    const valides = signature.split('|');
    const lire = (defiler: boolean) => {
      const ancre = decodeURIComponent(window.location.hash.slice(1));
      if (!valides.includes(ancre)) return;
      setChoisi(ancre as T);
      if (defiler) barre.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    // Arriver par un lien vers un onglet amène aussi la barre à l'écran.
    lire(true);
    const surChangement = () => lire(true);
    window.addEventListener('hashchange', surChangement);
    return () => window.removeEventListener('hashchange', surChangement);
  }, [signature]);

  const choisir = useCallback((cle: T) => {
    setChoisi(cle);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${cle}`);
  }, []);

  // Un onglet choisi qui disparaît (données rechargées) rend la main au défaut.
  const explicite = choisi !== null && cles.includes(choisi) ? choisi : null;
  return { actif: explicite ?? defaut, explicite, choisir, barre };
}
