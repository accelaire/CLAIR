import type { Metadata } from 'next';
import Link from 'next/link';
import { Gavel, Landmark, Users } from 'lucide-react';
import { fetchRessource } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { Portrait } from '@/components/gouvernements/portrait';
import {
  aujourdhui,
  de,
  dateLongue,
  duree,
  lienFiche,
  nombre,
  nomComplet,
  type GouvernementResume,
  type SourceGouvernements,
} from '@/lib/gouvernements';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Rendu côté serveur, sans paramètre d'URL : la page est servie complète aux
// moteurs. Les données ne changent qu'avec l'ingestion de la nuit.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Gouvernements de la Ve République depuis 2007',
  description:
    'Tous les gouvernements depuis Fillon I (2007) : Premier ministre, président de la République, dates et composition, ' +
    "d'après l'open data de l'Assemblée nationale.",
  alternates: { canonical: `${BASE_URL}/gouvernements` },
};

/**
 * Les gouvernements regroupés par la présidence pendant laquelle ils ont
 * commencé, dans l'ordre reçu (le plus récent d'abord).
 */
function parPresidence(gouvernements: GouvernementResume[]) {
  const groupes: { cle: string; titre: string; gouvernements: GouvernementResume[] }[] = [];
  for (const g of gouvernements) {
    const cle = g.presidence?.uid ?? 'sans';
    let groupe = groupes.find((x) => x.cle === cle);
    if (!groupe) {
      groupe = {
        cle,
        titre: g.presidence ? `Présidence ${de(nomComplet(g.presidence))}` : 'Présidence non renseignée',
        gouvernements: [],
      };
      groupes.push(groupe);
    }
    groupe.gouvernements.push(g);
  }
  return groupes;
}

/** Durée en jours, pour la barre qui compare les gouvernements entre eux. */
function jours(g: GouvernementResume, jour: string): number {
  return Math.max(1, (Date.parse(g.dateFin ?? jour) - Date.parse(g.dateDebut)) / 86_400_000);
}

/**
 * Toute la carte mène au gouvernement : le lien du titre la recouvre
 * (`after:absolute after:inset-0`). Le lien vers la fiche du Premier ministre
 * passe au-dessus (`relative z-10`) et reste cliquable, sans lien imbriqué.
 */
function CarteGouvernement({ g, plusLong, jour }: { g: GouvernementResume; plusLong: number; jour: string }) {
  const pm = g.premierMinistre;
  // Absent d'une réponse mise en cache avant le déploiement qui l'ajoute.
  const femmes = typeof g.nbFemmes === 'number' ? g.nbFemmes : null;
  return (
    <li
      className={`relative rounded-lg border p-4 transition-colors hover:border-primary/50 ${
        g.enCours ? 'border-primary/40 bg-primary/5' : 'bg-card hover:bg-muted/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {pm && <Portrait personne={pm} taille="md" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">
              <Link href={`/gouvernements/${g.slug}`} className="after:absolute after:inset-0 hover:text-primary">
                Gouvernement {g.nom}
              </Link>
            </h3>
            {g.enCours && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">En fonction</span>
            )}
          </div>
          {pm && (
            <p className="text-sm">
              {pm.civilite === 'Mme' ? 'Première ministre' : 'Premier ministre'} :{' '}
              {lienFiche(pm) ? (
                <Link href={lienFiche(pm)!} className="relative z-10 font-medium text-primary hover:underline">
                  {nomComplet(pm)}
                </Link>
              ) : (
                <span className="font-medium">{nomComplet(pm)}</span>
              )}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {dateLongue(g.dateDebut)} → {g.dateFin ? dateLongue(g.dateFin) : 'en cours'}
          </p>
          {/* Durée, à l'échelle du plus long gouvernement (légende en tête de page). */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary/60" style={{ width: `${(100 * jours(g, jour)) / plusLong}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium">{duree(g.dateDebut, g.dateFin ?? jour)}</span>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {g.nbMembres} membres
            {femmes !== null && `, dont ${femmes} femmes (${Math.round((100 * femmes) / Math.max(g.nbMembres, 1))} %)`}
          </p>
          {/* Absent d'une réponse antérieure au bilan, null avant juin 2017 (pas de données, et non zéro). */}
          {g.bilan && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Gavel className="h-3.5 w-3.5" />
              {nombre(g.bilan.engagements, 'recours au 49.3', 'recours au 49.3')}, {nombre(g.bilan.motions, 'motion de censure', 'motions de censure')}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default async function GouvernementsPage() {
  // `fetchRessource` lève sur une panne de l'API : la page garde alors sa
  // version précédente au lieu d'être remplacée par une page vide.
  const reponse = await fetchRessource<{ data: GouvernementResume[]; source: SourceGouvernements }>('/gouvernements');
  const gouvernements = reponse?.data ?? [];
  const jour = aujourdhui();

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Gouvernements', url: `${BASE_URL}/gouvernements` },
        ]}
      />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Landmark className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Gouvernements</h1>
            <p className="mt-1 text-muted-foreground">
              {gouvernements.length} gouvernements depuis 2007, du plus récent au plus ancien.
            </p>
          </div>
        </div>
        {reponse?.source && (
          <p className="mt-3 text-xs text-muted-foreground">
            Les gouvernements, leurs membres et leurs dates sont publiés par l&apos;Assemblée nationale dans son open data,
            avec l&apos;historique de ses députés : un même fichier pour les deux (
            <a href={reponse.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              {reponse.source.nom}
            </a>
            ). Les dates sont celles qu&apos;il publie, en général celles du Journal officiel.
          </p>
        )}
      </div>

      <div className="space-y-10">
        {parPresidence(gouvernements).map((groupe) => {
          // Les durées se comparent au sein d'une présidence : à l'échelle du
          // plus long gouvernement depuis 2007, les gouvernements d'un
          // quinquennat agité paraîtraient tous minuscules.
          const plusLong = Math.max(1, ...groupe.gouvernements.map((g) => jours(g, jour)));
          const reference = groupe.gouvernements.find((g) => jours(g, jour) === plusLong);
          return (
            <section key={groupe.cle}>
              <h2 className="text-xl font-semibold">{groupe.titre}</h2>
              {reference && groupe.gouvernements.length > 1 && (
                <p className="mb-3 mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-1.5 w-10 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  Durée de chaque gouvernement, comparée au plus long de cette présidence : {reference.nom} (
                  {duree(reference.dateDebut, reference.dateFin ?? jour)}).
                </p>
              )}
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {groupe.gouvernements.map((g) => (
                  <CarteGouvernement key={g.uid} g={g} plusLong={plusLong} jour={jour} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
