'use client';

import Link from 'next/link';
import { Vote, ArrowRight } from 'lucide-react';
import { SENATORIALES_2026, siegeRenouvelable } from '@/lib/senatoriales';

interface SiegeRenouvelableCalloutProps {
  parlementaire: { chambre?: string | null; serie?: string | null; actif?: boolean | null };
}

/**
 * Signale, sur la fiche d'un sénateur de la série 2, que son siège est remis en
 * jeu — et renvoie vers le bilan de mandature.
 *
 * Placé ici plutôt que dans une bannière globale : le lecteur qui arrive sur une
 * fiche depuis une recherche ne verra jamais la page d'accueil, et l'information
 * ne concerne que la moitié des sénateurs. Le composant se retire tout seul à la
 * prise de fonction des élus (cf. `renouvellementAVenir`).
 */
export function SiegeRenouvelableCallout({ parlementaire }: SiegeRenouvelableCalloutProps) {
  if (!siegeRenouvelable(parlementaire)) return null;

  return (
    <Link
      href={SENATORIALES_2026.href}
      className="mb-8 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
    >
      <Vote className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-sm">
        <strong className="font-semibold">Siège remis en jeu le 27 septembre 2026.</strong>{' '}
        Il fait partie des 178 sièges renouvelés avec la série 2 du Sénat.
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium sm:inline-flex">
        Voir le bilan
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
    </Link>
  );
}
