'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Vote } from 'lucide-react';
import { api } from '@/lib/api';
import { SENATORIALES_2026, resultatsALaUne } from '@/lib/senatoriales';
import {
  CATEGORIES_HEMICYCLE,
  FAMILLES_ARC,
  HORS_ARC,
  nombre,
  type ResultatsNationaux,
} from '@/lib/senatoriales/resultats';
import { Arc } from '@/app/senatoriales-2026/components/resultats/HemicycleAvantApres';

/**
 * Encart de l'accueil, sous l'agenda : les résultats des sénatoriales du
 * 27 septembre, le temps que le nouveau Sénat s'installe.
 *
 * L'accroche d'avant le scrutin a disparu à la prise de fonction, et avec elle
 * le seul chemin de l'accueil vers les résultats : le lecteur qui cherche qui a
 * été élu chez lui n'avait plus que Google. Les chiffres viennent de la même
 * route que la page du scrutin ; sans elle, l'encart garde son texte et ses
 * liens.
 */
export function EncartResultatsSenatoriales() {
  const visible = resultatsALaUne();
  const { data } = useQuery<ResultatsNationaux>({
    queryKey: ['senatoriales-resultats-nationaux'],
    queryFn: () => api.get('/senatoriales/2026/resultats').then((res) => res.data),
    enabled: visible,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!visible) return null;

  const elus = data?.elus;
  const apres = data?.hemicycle.apres;
  const chiffres: { valeur: number | undefined; libelle: string }[] = [
    { valeur: elus?.reelus, libelle: 'sortants réélus' },
    { valeur: elus?.nouveaux, libelle: 'nouveaux au Parlement' },
    { valeur: elus?.parlementaires, libelle: 'déjà passés par le Parlement' },
    { valeur: elus?.femmes, libelle: 'sénatrices élues' },
  ];
  const legende = apres
    ? [...FAMILLES_ARC, ...HORS_ARC.filter((c) => c !== 'non_attribue')].filter((c) => (apres[c] ?? 0) > 0)
    : [];

  return (
    <section
      aria-labelledby="encart-senatoriales-titre"
      className="mt-10 overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="grid md:grid-cols-5">
        <div className="relative p-6 md:col-span-3 md:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-500/[0.07] via-transparent to-primary/[0.07]"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <Vote className="h-3.5 w-3.5" aria-hidden />
              Sénatoriales du 27 septembre 2026
            </span>

            <h3 id="encart-senatoriales-titre" className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
              Le nouveau Sénat est installé
            </h3>
            <p className="mt-2 max-w-xl text-muted-foreground">
              178 sièges renouvelés : qui a été élu dans votre département, qui fait son entrée au
              Parlement et comment l&apos;hémicycle a bougé.
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {chiffres.map((c) => (
                <div key={c.libelle} className="rounded-xl border bg-background/70 p-3 backdrop-blur-sm">
                  <dd className="text-2xl font-bold tabular-nums">
                    {c.valeur === undefined ? '—' : nombre(c.valeur)}
                  </dd>
                  <dt className="mt-0.5 text-xs leading-snug text-muted-foreground">{c.libelle}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`${SENATORIALES_2026.href}#resultats`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Voir les résultats
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={`${SENATORIALES_2026.href}#index-circonscriptions`}
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                <MapPin className="h-4 w-4" aria-hidden />
                Trouver mon département
              </Link>
            </div>
          </div>
        </div>

        <figure className="flex flex-col justify-center gap-3 border-t bg-muted/30 p-6 md:col-span-2 md:border-l md:border-t-0 md:p-8">
          <figcaption className="text-sm font-medium">Le Sénat après le 27 septembre</figcaption>
          {apres ? (
            <Arc repartition={apres} etiquette="Hémicycle du Sénat après le scrutin, par famille politique" />
          ) : (
            <div className="aspect-[500/270] w-full animate-pulse rounded-t-full bg-muted" aria-hidden />
          )}
          {legende.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {legende.map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORIES_HEMICYCLE[c]?.couleur }}
                    aria-hidden
                  />
                  {CATEGORIES_HEMICYCLE[c]?.libelle} · {nombre(apres![c] ?? 0)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Par famille de la nuance attribuée par le ministère de l&apos;Intérieur à l&apos;élection, pas par
            groupe politique.
          </p>
        </figure>
      </div>
    </section>
  );
}
