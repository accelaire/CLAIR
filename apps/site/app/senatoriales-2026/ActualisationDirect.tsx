"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVALLE_MS = 60_000;

/**
 * Tient la page à jour pendant le direct des résultats (repris de `EnDirect` de apps/web) :
 * `router.refresh()` redemande au serveur le rendu de la page sans la recharger, l'état de la
 * page (détail ouvert, défilement) reste. Le serveur répond depuis son cache, renouvelé chaque
 * minute comme celui de l'API. Un onglet en arrière-plan ne rafraîchit pas : il se remet à jour
 * dès qu'on y revient. Ne rend rien : la pastille « En direct » est affichée par l'écran.
 */
export const ActualisationDirect = () => {
  const router = useRouter();
  useEffect(() => {
    const rafraichir = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const minuterie = setInterval(rafraichir, INTERVALLE_MS);
    document.addEventListener("visibilitychange", rafraichir);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", rafraichir);
    };
  }, [router]);
  return null;
};
