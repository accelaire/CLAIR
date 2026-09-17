'use client';

import Link from 'next/link';
import { Vote, ArrowRight } from 'lucide-react';
import { SENATORIALES_2026, siegeRenouvelable } from '@/lib/senatoriales';
import { locutionDepuisCode, slugDepuisCode } from '@/lib/senatoriales/departements';

interface SiegeRenouvelableCalloutProps {
  parlementaire: {
    chambre?: string | null;
    serie?: string | null;
    actif?: boolean | null;
    circonscription?: { departement: string; nom: string } | null;
  };
}

/**
 * Signale, sur la fiche d'un sénateur de la série 2, que son siège est remis en
 * jeu — et renvoie vers sa circonscription.
 *
 * Placé ici plutôt que dans une bannière globale : le lecteur qui arrive sur une
 * fiche depuis une recherche ne verra jamais la page d'accueil, et l'information
 * ne concerne que la moitié des sénateurs. Le composant se retire tout seul à la
 * prise de fonction des élus (cf. `renouvellementAVenir`).
 *
 * La destination est la **page de la circonscription** et non plus la page mère.
 * Le lecteur d'une fiche a déjà choisi son département : le renvoyer vers une
 * liste nationale lui demandait de le choisir une seconde fois, alors que la
 * page qui l'intéresse — ses candidats, son mode de scrutin, ses sortants —
 * existe et n'était atteignable que par un détour. La page mère reste la
 * destination quand la circonscription est inconnue.
 */
export function SiegeRenouvelableCallout({ parlementaire }: SiegeRenouvelableCalloutProps) {
  if (!siegeRenouvelable(parlementaire)) return null;

  const code = parlementaire.circonscription?.departement;
  const slug = code ? slugDepuisCode(code) : null;
  const nom = parlementaire.circonscription?.nom?.replace(/\s*\(Série \d+\)\s*$/, '').trim();

  const href = slug ? `${SENATORIALES_2026.href}/${slug}` : SENATORIALES_2026.href;

  return (
    <Link
      href={href}
      className="mb-8 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
    >
      <Vote className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-sm">
        <strong className="font-semibold">Siège remis en jeu le 27 septembre 2026.</strong>{' '}
        {/*
          « dans l'Ain », « en Gironde », « pour les Français établis hors de
          France » : la locution est tabulée par code, un « en {nom} » naïf
          donnant « en Ain » et « en Bouches-du-Rhône ».
        */}
        {slug && code && nom
          ? `Les candidats et le bilan des sortants ${locutionDepuisCode(code, nom)}.`
          : 'Il fait partie des 178 sièges renouvelés avec la série 2 du Sénat.'}
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium sm:inline-flex">
        {slug ? 'Voir les candidats' : 'Voir le bilan'}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
    </Link>
  );
}
