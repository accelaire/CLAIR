import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { fetchFromApi } from '@/lib/api-server';
import { heureDeParis, type ResultatsNationaux } from '@/lib/senatoriales/resultats';
import { SuiviScrutin } from './components/SuiviScrutin';
import { HemicycleAvantApres } from './components/HemicycleAvantApres';
import { GrilleCirconscriptions } from './components/GrilleCirconscriptions';
import { BandeauApercu, BadgeEtat } from './components/EnTete';

/**
 * Aperçu de la page de résultats du 27 septembre.
 *
 * NON PUBLIQUE : ni indexée, ni listée dans le sitemap, ni liée depuis le site.
 * Elle sert à relire la mise en page sur les vraies données avant le scrutin,
 * puis à suivre la soirée. Les métadonnées `robots` s'ajoutent à l'en-tête
 * `X-Robots-Tag` posé sur ce chemin dans `vercel.json`.
 *
 * Revalidée chaque minute : le soir du scrutin, le ministère publie au fil de
 * l'eau et l'ingestion passe toutes les cinq minutes. L'API met elle-même ses
 * réponses en cache une minute.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Sénatoriales 2026 : résultats (aperçu)',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const BASE = '/senatoriales-2026/apercu-resultats';

function chapeau(d: ResultatsNationaux): string {
  const c = d.compteurs;
  if (c.pourvue === c.circonscriptions) {
    return `Les ${c.sieges} sièges remis en jeu sont attribués. Les élus prennent leurs fonctions le 1er octobre ; les groupes politiques se constituent le 5.`;
  }
  const maintenant = new Date(d.maintenant).getTime();
  const avantMidi = maintenant < new Date('2026-09-27T12:00:00+02:00').getTime();
  const avantSoir = maintenant < new Date('2026-09-27T17:30:00+02:00').getTime();
  if (c.pourvue === 0 && c.partielle === 0 && c.second_tour === 0) {
    return avantMidi
      ? '178 des 348 sièges du Sénat sont renouvelés. Premiers résultats attendus vers midi, pour le 1er tour au scrutin majoritaire. Le reste suivra en soirée.'
      : '178 des 348 sièges du Sénat sont renouvelés. Les résultats du 1er tour au scrutin majoritaire sont attendus.';
  }
  if (avantSoir) {
    return '178 des 348 sièges du Sénat sont renouvelés. Le 1er tour au scrutin majoritaire est connu. Prochaine vague en soirée : 2nd tours et scrutin proportionnel.';
  }
  return "178 des 348 sièges du Sénat sont renouvelés. Les résultats arrivent circonscription par circonscription. L'outre-mer suit dans la nuit, la Polynésie française lundi matin.";
}

export default async function ApercuResultatsPage() {
  const donnees = await fetchFromApi<ResultatsNationaux>('/senatoriales/2026/resultats', 60);

  if (!donnees) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Les résultats ne sont pas disponibles pour le moment.</p>
      </div>
    );
  }

  const complet = donnees.compteurs.pourvue === donnees.compteurs.circonscriptions;
  const resultatsPublies =
    donnees.compteurs.pourvue + donnees.compteurs.partielle + donnees.compteurs.second_tour > 0;

  return (
    <>
      <BandeauApercu />
      <div className="container mx-auto space-y-8 px-4 py-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Sénatoriales du 27 septembre 2026</h1>
          <p className="max-w-3xl text-muted-foreground">{chapeau(donnees)}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <BadgeEtat compteurs={donnees.compteurs} maintenant={donnees.maintenant} />
            <span>
              Mis à jour à{' '}
              <strong className="font-semibold text-foreground">{heureDeParis(donnees.verifieA ?? donnees.maintenant)}</strong>,
              heure de Paris
            </span>
            <span>
              Source :{' '}
              <a href={donnees.source} className="text-primary underline underline-offset-2" rel="noopener">
                ministère de l&apos;Intérieur
              </a>
            </span>
            {resultatsPublies && (
              <span className="inline-flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Résultats provisoires, sous réserve des décisions du juge de l&apos;élection
              </span>
            )}
          </div>
        </header>

        <SuiviScrutin donnees={donnees} />

        <HemicycleAvantApres
          avant={donnees.hemicycle.avant}
          apres={donnees.hemicycle.apres}
          notes={donnees.hemicycle.notes}
          complet={complet}
        />

        <GrilleCirconscriptions circonscriptions={donnees.circonscriptions} base={BASE} />
      </div>
    </>
  );
}
