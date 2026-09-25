import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { fetchFromApi } from '@/lib/api-server';
import { codeDepuisSlug, locutionDepuisCode } from '@/lib/senatoriales/departements';
import {
  heureDeParis,
  pluriel,
  type ResultatsCirconscription,
} from '@/lib/senatoriales/resultats';
import type { ListeCandidature } from '../../PageClient';
import { SortantCard } from '../../components/SortantCard';
import { ListeCandidatureCard } from '../../components/ListeCandidatureCard';
import { BadgeCirconscription, BandeauApercu } from '../components/EnTete';
import {
  AttenteResultats,
  BlocParticipation,
  CarteElus,
  ListeEnTete,
  ListesEtCandidats,
  RepartitionSieges,
  ResultatsParListe,
  TourMajoritaire,
} from '../components/BlocsCirconscription';

/**
 * Aperçu de la page de résultats d'une circonscription. NON PUBLIQUE, comme la
 * page nationale : ni indexée, ni liée depuis le site. Revalidée chaque minute.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Sénatoriales 2026 : résultats de la circonscription (aperçu)',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const BASE = '/senatoriales-2026/apercu-resultats';

export default async function ApercuResultatsCirconscription({
  params,
}: {
  params: { departement: string };
}) {
  const code = codeDepuisSlug(params.departement);
  if (!code) notFound();

  const [resultats, candidats] = await Promise.all([
    fetchFromApi<ResultatsCirconscription>(`/senatoriales/2026/resultats/${encodeURIComponent(code)}`, 60),
    fetchFromApi<{ data: ListeCandidature[] }>(
      `/senatoriales/2026/candidats?departement=${encodeURIComponent(code)}`,
      300,
    ),
  ]);
  if (!resultats) notFound();

  const c = resultats.circonscription;
  const ou = locutionDepuisCode(code, c.nom);
  const proportionnel = c.modeScrutin === 'proportionnel';
  const listes = candidats?.data ?? [];
  const nbCandidats = listes.reduce((total, l) => total + l.candidats.length, 0);
  const sortantsCandidats = resultats.sortants.filter((s) => s.candidature).length;
  const publie = resultats.tours.length > 0;
  const premierTour = resultats.tours.find((t) => t.tour === 1);
  const secondTour = resultats.tours.find((t) => t.tour === 2);
  const dernierTour = secondTour ?? premierTour;
  const resteAPourvoir = c.nbSieges - resultats.elus.length;
  const jourJ = new Date(resultats.maintenant) >= new Date('2026-09-27T00:00:00+02:00');

  const chapeau = publie
    ? `${c.nbSieges} ${pluriel(c.nbSieges, 'siège')} de sénateur ${c.nbSieges > 1 ? 'étaient remis' : 'était remis'} en jeu le dimanche 27 septembre 2026. Voici les résultats, et le bilan de mandature ${resultats.sortants.length > 1 ? 'des sortants' : 'du sortant'}.`
    : `${c.nbSieges} ${pluriel(c.nbSieges, 'siège')} de sénateur ${c.nbSieges > 1 ? 'sont remis' : 'est remis'} en jeu ${jourJ ? "aujourd'hui, " : ''}dimanche 27 septembre 2026. Voici ${proportionnel ? 'les listes en lice' : 'les candidats'} et le bilan de mandature ${resultats.sortants.length > 1 ? 'des sortants' : 'du sortant'}.`;

  return (
    <>
      <BandeauApercu />
      <div className="container mx-auto space-y-6 px-4 py-8">
        <Link href={BASE} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Sénatoriales du 27 septembre 2026
        </Link>

        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Sénatoriales 2026 {ou}</h1>
          <p className="max-w-3xl text-muted-foreground">{chapeau}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <BadgeCirconscription statut={c.statut} />
            {dernierTour ? (
              <span>
                Publiés à <strong className="font-semibold text-foreground">{heureDeParis(dernierTour.publieA)}</strong>,
                heure de Paris
              </span>
            ) : (
              <span>
                Mis à jour à <strong className="font-semibold text-foreground">{heureDeParis(resultats.maintenant)}</strong>,
                heure de Paris
              </span>
            )}
            <span>
              Source :{' '}
              <a
                href={dernierTour?.sourceUrl ?? resultats.source}
                className="text-primary underline underline-offset-2"
                rel="noopener"
              >
                ministère de l&apos;Intérieur
              </a>
            </span>
            {publie && (
              <span className="inline-flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" aria-hidden />
                Résultats provisoires, sous réserve des décisions du juge de l&apos;élection
              </span>
            )}
          </div>
        </header>

        {!publie && (
          <>
            <AttenteResultats
              resultats={resultats}
              maintenant={resultats.maintenant}
              nbListes={listes.length}
              sortantsCandidats={sortantsCandidats}
              nbSortants={resultats.sortants.length}
            />
            {listes.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {nbCandidats} {pluriel(nbCandidats, 'candidat')} {ou}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {listes.length}{' '}
                    {proportionnel
                      ? `${pluriel(listes.length, 'liste')} en lice pour ${c.nbSieges} ${pluriel(c.nbSieges, 'siège')}, dans l'ordre du dépôt`
                      : `${pluriel(listes.length, 'candidature')} pour ${c.nbSieges} ${pluriel(c.nbSieges, 'siège')}`}
                    . Les noms en couleur renvoient vers le bilan parlementaire de la personne.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {listes.map((liste) => (
                    <ListeCandidatureCard key={liste.id} liste={liste} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {publie && proportionnel && premierTour && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {premierTour.lignes[0] && (
                <ListeEnTete
                  ligne={premierTour.lignes[0]}
                  nbSieges={c.nbSieges}
                  autres={premierTour.lignes.slice(1).filter((l) => (l.sieges ?? 0) > 0)}
                />
              )}
              <CarteElus elus={resultats.elus} ou={ou} nbSieges={c.nbSieges} resteAPourvoir={0} />
            </div>
            <ResultatsParListe tour={premierTour} nbSieges={c.nbSieges} />
            <div className="grid gap-4 lg:grid-cols-2">
              {resultats.repartition && <RepartitionSieges repartition={resultats.repartition} nbSieges={c.nbSieges} />}
              <BlocParticipation participation={premierTour.participation} titre="Participation des grands électeurs" />
            </div>
            <ListesEtCandidats tour={premierTour} />
          </>
        )}

        {publie && !proportionnel && (
          <>
            <CarteElus
              elus={resultats.elus}
              ou={ou}
              nbSieges={c.nbSieges}
              resteAPourvoir={secondTour ? 0 : resteAPourvoir}
              horaireSecondTour={
                c.horaires.ouvertureT2 && c.horaires.clotureT2
                  ? `de ${heureDeParis(c.horaires.ouvertureT2)} à ${heureDeParis(c.horaires.clotureT2)}, heure de Paris`
                  : undefined
              }
            />
            {secondTour && <TourMajoritaire tour={secondTour} rappel={false} />}
            {premierTour && <TourMajoritaire tour={premierTour} rappel={Boolean(secondTour)} />}
            <div className="grid gap-4 lg:grid-cols-2">
              {secondTour && (
                <BlocParticipation participation={secondTour.participation} titre="Participation au 2nd tour" />
              )}
              {premierTour && (
                <BlocParticipation participation={premierTour.participation} titre="Participation au 1er tour" />
              )}
            </div>
          </>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">
              {publie
                ? `Le sort ${resultats.sortants.length > 1 ? `des ${resultats.sortants.length} sénateurs sortants` : 'du sénateur sortant'}`
                : `${resultats.sortants.length} ${pluriel(resultats.sortants.length, 'sénateur sortant', 'sénateurs sortants')} ${ou}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {publie ? 'Leur bilan de mandature, arrêté à la veille du scrutin.' : 'Leur bilan de mandature.'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultats.sortants.map((s) => (
              <SortantCard key={s.mandatId} sortant={s} candidaturesPubliees sort={publie ? s.sort : undefined} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
