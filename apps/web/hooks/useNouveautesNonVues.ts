'use client';

// Les sections signalées « Nouveau » que ce visiteur n'a pas encore ouvertes.
//
// Une section est vue dès qu'une de ses pages est affichée, quel que soit le
// chemin pris (menu, carrousel de l'accueil, recherche). La liste vit dans le
// navigateur : rien n'est envoyé, et un navigateur qui refuse le stockage
// garde simplement le marqueur jusqu'à sa date de fin.
//
// Rien n'est marqué avant le montage : le serveur ne connaît pas le visiteur,
// et un marqueur rendu puis retiré clignoterait à chaque page.

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { estNouveau, sectionNouvelleDe } from '@/lib/nouveautes';

const CLE = 'clair_nouveautes_vues';

function lireVues(): Set<string> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return new Set(Array.isArray(brut) ? brut.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function ecrireVues(vues: Set<string>) {
  try {
    localStorage.setItem(CLE, JSON.stringify([...vues]));
  } catch {
    // Stockage refusé (navigation privée, quota) : le marqueur reste affiché.
  }
}

/** `nonVue(chemin)` : à marquer pour ce visiteur. Toujours faux avant le montage. */
export function useNouveautesNonVues(): (chemin: string) => boolean {
  const pathname = usePathname();
  const [vues, setVues] = useState<Set<string> | null>(null);

  useEffect(() => {
    const lues = lireVues();
    const section = sectionNouvelleDe(pathname);
    if (section && !lues.has(section)) {
      lues.add(section);
      ecrireVues(lues);
    }
    setVues(lues);
  }, [pathname]);

  return useCallback((chemin: string) => vues !== null && estNouveau(chemin) && !vues.has(chemin), [vues]);
}
