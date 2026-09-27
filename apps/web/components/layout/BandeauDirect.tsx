'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';
import { SENATORIALES_2026, resultatsEnDirect } from '@/lib/senatoriales';

const CLE_FERME = 'clair:bandeau-direct-senatoriales';

/**
 * Bandeau « En direct » au-dessus du header, le temps que les résultats des
 * sénatoriales arrivent. Il renvoie à la page du scrutin, où il n'a rien à
 * apprendre : il s'y efface.
 *
 * Le layout décide de l'afficher au rendu, puis le navigateur revérifie l'heure :
 * une page gardée en cache après la fin du direct le porterait encore. L'état
 * initial vient du serveur, pour que l'hydratation retombe sur le même HTML.
 */
export function BandeauDirect({ actifAuRendu }: { actifAuRendu: boolean }) {
  const pathname = usePathname();
  const [actif, setActif] = useState(actifAuRendu);

  useEffect(() => {
    let ferme = false;
    try {
      ferme = sessionStorage.getItem(CLE_FERME) === '1';
    } catch {
      // Stockage indisponible (navigation privée, cookies bloqués) : on affiche.
    }
    setActif(resultatsEnDirect() && !ferme);
  }, []);

  if (!actif || pathname?.startsWith(SENATORIALES_2026.href)) return null;

  const fermer = () => {
    setActif(false);
    try {
      sessionStorage.setItem(CLE_FERME, '1');
    } catch {
      // Sans stockage, le bandeau reviendra à la page suivante : sans gravité.
    }
  };

  return (
    <div className="border-b border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <div className="container mx-auto flex h-10 items-center gap-2 px-3 text-sm sm:px-4">
        <Link
          href={`${SENATORIALES_2026.href}#resultats`}
          className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap hover:underline sm:gap-2"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide">En direct</span>
          <span className="text-[13px] font-medium sm:hidden">Résultats des sénatoriales</span>
          <span className="hidden font-medium sm:inline">
            Sénatoriales 2026 : les résultats arrivent, circonscription par circonscription
          </span>
          {/* Tout le bandeau est un lien : sous 360 px, la flèche cède sa place au texte. */}
          <ArrowRight className="hidden h-4 w-4 shrink-0 min-[360px]:block" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={fermer}
          aria-label="Masquer le bandeau du direct"
          className="shrink-0 rounded p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-950/60"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
