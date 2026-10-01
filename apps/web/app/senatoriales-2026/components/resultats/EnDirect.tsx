'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const INTERVALLE_MS = 60_000;

/**
 * Pastille « En direct », et la page qui se tient à jour d'elle-même.
 *
 * `router.refresh()` redemande au serveur le rendu de la page sans la recharger :
 * les chiffres changent, l'état de la page (détail ouvert, défilement) reste. Le
 * serveur répond depuis son cache, renouvelé chaque minute comme celui de l'API ;
 * rafraîchir plus souvent ne montrerait rien de plus.
 *
 * Un onglet en arrière-plan ne rafraîchit pas : il se remet à jour dès qu'on y
 * revient.
 */
export function EnDirect() {
  const router = useRouter();

  useEffect(() => {
    const rafraichir = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const minuterie = setInterval(rafraichir, INTERVALLE_MS);
    document.addEventListener('visibilitychange', rafraichir);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', rafraichir);
    };
  }, [router]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 font-medium text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
      title="La page se met à jour chaque minute"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      En direct
    </span>
  );
}
