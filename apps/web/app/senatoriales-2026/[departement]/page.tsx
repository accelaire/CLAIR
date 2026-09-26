import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd, ElectionJsonLd, JsonLd } from '@/components/seo/JsonLd';
import { SENATORIALES_2026 } from '@/lib/senatoriales';
import { SoutenirCallout } from '@/components/donations/SoutenirCallout';
import {
  SLUGS_DEPARTEMENTS,
  codeDepuisSlug,
  locutionDepuisCode,
} from '@/lib/senatoriales/departements';
import {
  accorde,
  circonscriptionDepuisSlug,
  libelleCirconscription,
  modeDeScrutin,
  pluriel,
} from '@/lib/senatoriales/circonscription';
import { heureDeParis, type ResultatsCirconscription } from '@/lib/senatoriales/resultats';
import type { ApercuSenatoriales, ListeCandidature, Sortant } from '../PageClient';
import { SortantCard } from '../components/SortantCard';
import { ListeCandidatureCard } from '../components/ListeCandidatureCard';
import { BadgeCirconscription } from '../components/resultats/EnTete';
import {
  AttenteResultats,
  BlocParticipation,
  CarteElus,
  ListeEnTete,
  ListesEtCandidats,
  RepartitionSieges,
  ResultatsParListe,
  TourMajoritaire,
} from '../components/resultats/BlocsCirconscription';

/**
 * Une page par circonscription — et non le filtre `?departement=` de la page mère.
 *
 * Les 64 circonscriptions de la série 2 sont déjà interrogeables depuis la page
 * mère, mais derrière une chaîne de requête et sous un canonique figé sur
 * `/senatoriales-2026`. Ce canonique est correct — c'est bien la même page,
 * filtrée — et il a une conséquence : les 64 listes n'existent nulle part comme
 * document indexable. La requête réellement tapée n'est pourtant pas
 * « sénatoriales 2026 », déjà tenue par le site officiel du Sénat, le ministère
 * de l'Intérieur et Wikipédia, mais « sénatoriales 2026 » suivi d'un nom de
 * département. Sur celle-là, il n'y a en face qu'une page de préfecture sans
 * contenu, et nous sommes seuls à publier le bilan de mandature des sortants.
 *
 * Ces pages ne lisent aucun paramètre de recherche : elles sont pré-rendues et
 * revalidées, comme les pages de graphiques et contrairement à la page mère.
 *
 * Revalidées chaque minute depuis qu'elles portent les résultats : le soir du
 * scrutin, l'ingestion passe toutes les cinq minutes et l'API met ses réponses
 * en cache une minute. Les autres appels gardent leur cache d'une heure.
 */
export const revalidate = 60;

/** Minuit à Paris le jour du vote : avant, la page reste celle des candidats. */
const JOUR_DU_SCRUTIN = new Date('2026-09-27T00:00:00+02:00');

export function generateStaticParams() {
  return SLUGS_DEPARTEMENTS.map((departement) => ({ departement }));
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

type ListeSortants = { data: Sortant[]; meta: { total: number } };
type ListeCandidats = {
  data: ListeCandidature[];
  meta: { total: number; candidats: number };
};

async function chargerDonnees(code: string) {
  const [apercu, sortants, candidats, resultats] = await Promise.all([
    fetchFromApi<ApercuSenatoriales>('/senatoriales/2026', 3600),
    // Le filtre est appliqué par l'API et non sur la liste complète reçue côté
    // page : c'est une entrée de cache par circonscription, mais chacune pèse
    // quelques kilo-octets là où la liste entière en fait trois cents.
    fetchFromApi<ListeSortants>(
      `/senatoriales/2026/sortants?departement=${encodeURIComponent(code)}&tri=nom`,
      3600,
    ),
    fetchFromApi<ListeCandidats>(
      `/senatoriales/2026/candidats?departement=${encodeURIComponent(code)}`,
      3600,
    ),
    chargerResultats(code),
  ]);
  return { apercu, sortants, candidats, resultats };
}

/**
 * Les résultats de la circonscription. `null` si l'API ne répond pas : la page
 * se rend alors comme avant le scrutin, plutôt que de tomber.
 */
function chargerResultats(code: string) {
  return fetchFromApi<ResultatsCirconscription>(
    `/senatoriales/2026/resultats/${encodeURIComponent(code)}`,
    60,
  );
}

export async function generateMetadata({
  params,
}: {
  params: { departement: string };
}): Promise<Metadata> {
  const circo = await circonscriptionDepuisSlug(params.departement);
  if (!circo) return {};

  const url = `${BASE_URL}/senatoriales-2026/${params.departement}`;
  const ou = locutionDepuisCode(circo.code, circo.nom);

  // Une fois les premiers résultats publiés, le titre et la description disent
  // ce que la page montre désormais ; sans rien promettre avant.
  const resultats = await chargerResultats(circo.code);
  if (resultats && resultats.tours.length > 0) {
    const titreResultats = `Sénatoriales 2026 — ${circo.nom} : résultats et élus`;
    const descriptionResultats =
      `Résultats des sénatoriales du 27 septembre 2026 ${ou} : ` +
      `${resultats.circonscription.modeScrutin === 'proportionnel' ? 'les voix et les sièges par liste' : 'les voix par candidat'}, ` +
      `les élus, la participation des grands électeurs, et le bilan de mandature de chaque sénateur sortant.`;
    return {
      title: titreResultats,
      description: descriptionResultats,
      alternates: { canonical: url },
      openGraph: { title: titreResultats, description: descriptionResultats, url, type: 'article' },
      twitter: { card: 'summary_large_image', title: titreResultats, description: descriptionResultats },
    };
  }

  const titre = `Sénatoriales 2026 — ${circo.nom} : ${circo.nbSieges} ${pluriel(circo.nbSieges, 'siège')} à pourvoir`;
  // Le nombre de candidats n'apparaît qu'une fois le fichier du ministère
  // publié — soit une quinzaine de jours avant le scrutin. Avant, la
  // description reste celle du bilan seul, sans promettre une liste qui
  // n'existe pas encore.
  const candidats =
    circo.nbCandidats && circo.nbCandidats > 0
      ? `Les ${circo.nbCandidats} candidats en lice, et le bilan de mandature`
      : 'Présence, loyauté, interventions et amendements : le bilan de mandature';
  const description =
    `Le 27 septembre 2026, ${circo.nbSieges} ${pluriel(circo.nbSieges, 'siège')} de sénateur ` +
    `${accorde(circo.nbSieges, 'est renouvelé', 'sont renouvelés')} ${ou}, au scrutin ` +
    `${modeDeScrutin(circo.nbSieges).court}. ${candidats} de chaque sénateur sortant.`;

  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: { title: titre, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: titre, description },
  };
}

export default async function CirconscriptionPage({
  params,
}: {
  params: { departement: string };
}) {
  const code = codeDepuisSlug(params.departement);
  if (!code) notFound();

  const { apercu, sortants, candidats, resultats } = await chargerDonnees(code);

  const trouvee = apercu?.circonscriptions?.find((c) => c.departement === code);
  // Le slug est connu mais l'API ne rend pas la circonscription : plutôt qu'une
  // page vide et indexable, la même réponse que pour un slug inventé.
  if (!trouvee) notFound();

  const nom = libelleCirconscription(trouvee.nom);
  const nbSieges = trouvee.nbSieges;
  const scrutinLocal = modeDeScrutin(nbSieges);
  const ou = locutionDepuisCode(code, nom);
  const liste = sortants?.data ?? [];
  const listesCandidats = candidats?.data ?? [];
  // Les candidatures ne paraissent qu'une quinzaine de jours avant le scrutin :
  // avant, la page se rend sans cette section, et sans rien affirmer sur les
  // intentions des sortants.
  const candidaturesPubliees = listesCandidats.length > 0;
  const nbCandidats = candidats?.meta.candidats ?? 0;
  const url = `${BASE_URL}/senatoriales-2026/${params.departement}`;

  const nbCirconscriptions =
    apercu?.circonscriptions?.length ?? apercu?.scrutin.nbCirconscriptions ?? 64;

  // Résultats : tout ce qui suit vaut `false` quand l'API des résultats ne
  // répond pas, et la page retombe sur sa version d'avant le scrutin.
  const circoResultats = resultats?.circonscription ?? null;
  const proportionnel = circoResultats?.modeScrutin === 'proportionnel';
  const publie = Boolean(resultats && resultats.tours.length > 0);
  const premierTour = resultats?.tours.find((t) => t.tour === 1);
  const secondTour = resultats?.tours.find((t) => t.tour === 2);
  const dernierTour = secondTour ?? premierTour;
  const maintenant = resultats ? new Date(resultats.maintenant) : new Date();
  // Le jour même, ou dès l'ouverture des bureaux : à Wallis-et-Futuna, le vote
  // commence le samedi à 22h30, heure de Paris.
  const jourJ = maintenant >= JOUR_DU_SCRUTIN || (circoResultats !== null && circoResultats.statut !== 'pas_ouvert');
  const sortantsCandidats = liste.filter((s) => s.candidature).length;
  // Le sort de chaque sortant (réélu, battu…) vient des résultats ; la liste
  // affichée reste celle de l'API des sortants, qui porte aussi le JSON-LD.
  const sortDuSortant = new Map((resultats?.sortants ?? []).map((s) => [s.mandatId, s.sort]));

  const chapeau = publie
    ? `${nbSieges} ${pluriel(nbSieges, 'siège')} de sénateur ${accorde(nbSieges, 'était remis', 'étaient remis')} en jeu le dimanche 27 septembre 2026. Voici les résultats, et le bilan de mandature ${liste.length > 1 ? 'des sortants' : 'du sortant'}.`
    : jourJ
      ? `${nbSieges} ${pluriel(nbSieges, 'siège')} de sénateur ${accorde(nbSieges, 'est remis', 'sont remis')} en jeu ${maintenant >= JOUR_DU_SCRUTIN ? "aujourd'hui, " : ''}dimanche 27 septembre 2026. Voici ${scrutinLocal.unite === 'liste' ? 'les listes en lice' : 'les candidats'} et le bilan de mandature ${liste.length > 1 ? 'des sortants' : 'du sortant'}.`
      : `${nbSieges} ${pluriel(nbSieges, 'siège')} de sénateur ${accorde(nbSieges, 'est remis', 'sont remis')} en jeu le dimanche 27 septembre 2026. Voici le bilan de mandature${liste.length > 1 ? ' des sortants' : ' du sortant'}.`;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Sénatoriales 2026', url: `${BASE_URL}/senatoriales-2026` },
          { name: nom, url },
        ]}
      />
      <ElectionJsonLd
        name={`Élections sénatoriales 2026 — ${nom}`}
        description={`Renouvellement de ${nbSieges} ${pluriel(nbSieges, 'siège')} de sénateur ${ou}, au scrutin ${scrutinLocal.court}.`}
        url={url}
        startDate={SENATORIALES_2026.scrutin}
        location={nom}
      />
      {/* Les sortants en `ItemList` : c'est la liste qui fait l'intérêt de la
          page, et le seul endroit du web où elle existe département par
          département avec les chiffres du mandat. */}
      {liste.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            // Le nom du département en tête plutôt qu'en complément : « de
            // ${nom} » demandait un génitif que les libellés ne supportent pas
            // tous — « de Alpes-Maritimes », « de Ain ». Contourné plutôt que
            // décliné, une colonne de plus dans la table n'ayant pas lieu d'être
            // pour un champ que seules les machines lisent.
            name: `${nom} — sénateurs sortants de la série 2`,
            numberOfItems: liste.length,
            itemListElement: liste.map((sortant, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'Person',
                name: `${sortant.personne.prenom} ${sortant.personne.nom}`,
                url: `${BASE_URL}/senateurs/${sortant.personne.slug}`,
                jobTitle: sortant.personne.sexe === 'F' ? 'Sénatrice' : 'Sénateur',
                ...(sortant.groupe
                  ? { affiliation: { '@type': 'Organization', name: sortant.groupe.nomComplet ?? sortant.groupe.nom } }
                  : {}),
              },
            })),
          }}
        />
      )}

      <div className="container mx-auto space-y-6 px-4 py-8">
        <Link
          href="/senatoriales-2026"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sénatoriales du 27 septembre 2026
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Sénatoriales 2026 {ou}
          </h1>
          <p className="text-muted-foreground">{chapeau}</p>
          {circoResultats && (jourJ || publie) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm text-muted-foreground">
              <BadgeCirconscription statut={circoResultats.statut} />
              {dernierTour ? (
                <span>
                  Publiés à <strong className="font-semibold text-foreground">{heureDeParis(dernierTour.publieA)}</strong>,
                  heure de Paris
                </span>
              ) : (
                <span>
                  Mis à jour à <strong className="font-semibold text-foreground">{heureDeParis(resultats!.maintenant)}</strong>,
                  heure de Paris
                </span>
              )}
              <span>
                Source :{' '}
                <a
                  href={dernierTour?.sourceUrl ?? resultats!.source}
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
          )}
        </div>

        {resultats && circoResultats && !publie && jourJ && (
          <AttenteResultats
            resultats={resultats}
            maintenant={resultats.maintenant}
            nbListes={listesCandidats.length}
            sortantsCandidats={sortantsCandidats}
            nbSortants={liste.length}
          />
        )}

        {resultats && publie && proportionnel && premierTour && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {premierTour.lignes[0] && (
                <ListeEnTete
                  ligne={premierTour.lignes[0]}
                  nbSieges={nbSieges}
                  autres={premierTour.lignes.slice(1).filter((l) => (l.sieges ?? 0) > 0)}
                />
              )}
              <CarteElus elus={resultats.elus} ou={ou} nbSieges={nbSieges} resteAPourvoir={0} />
            </div>
            <ResultatsParListe tour={premierTour} nbSieges={nbSieges} />
            {/* L'un sous l'autre : côte à côte, la participation (six chiffres)
                s'étirait à la hauteur du tableau de répartition, à moitié vide. */}
            {resultats.repartition && <RepartitionSieges repartition={resultats.repartition} nbSieges={nbSieges} />}
            <BlocParticipation participation={premierTour.participation} titre="Participation des grands électeurs" large />
            <ListesEtCandidats tour={premierTour} />
          </>
        )}

        {resultats && circoResultats && publie && !proportionnel && (
          <>
            <CarteElus
              elus={resultats.elus}
              ou={ou}
              nbSieges={nbSieges}
              resteAPourvoir={secondTour ? 0 : nbSieges - resultats.elus.length}
              horaireSecondTour={
                circoResultats.horaires.ouvertureT2 && circoResultats.horaires.clotureT2
                  ? `de ${heureDeParis(circoResultats.horaires.ouvertureT2)} à ${heureDeParis(circoResultats.horaires.clotureT2)}, heure de Paris`
                  : undefined
              }
            />
            {secondTour && <TourMajoritaire tour={secondTour} rappel={false} />}
            {premierTour && <TourMajoritaire tour={premierTour} rappel={Boolean(secondTour)} />}
            {secondTour ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BlocParticipation participation={secondTour.participation} titre="Participation au 2nd tour" />
                {premierTour && (
                  <BlocParticipation participation={premierTour.participation} titre="Participation au 1er tour" />
                )}
              </div>
            ) : (
              premierTour && (
                <BlocParticipation participation={premierTour.participation} titre="Participation au 1er tour" large />
              )
            )}
          </>
        )}

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Comment se déroule le scrutin {ou} ?</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{scrutinLocal.phrase}</p>
            <p>
              Les électeurs ne sont pas les habitants du département mais un collège
              de <strong>grands électeurs</strong> — députés, conseillers régionaux et
              départementaux, et surtout délégués des conseils municipaux, qui forment
              près de 95 % du collège.
            </p>
            <p>
              Les élus prennent leurs fonctions le <strong>1er octobre 2026</strong>,
              pour un mandat de six ans.
            </p>
          </div>
        </div>

        {/* Une fois les résultats publiés, les candidats sont dans les blocs
            ci-dessus : chaque liste avec ses candidats et ses élus, ou chaque
            candidat avec ses voix au scrutin majoritaire. */}
        {candidaturesPubliees && !publie && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">
                {nbCandidats} {pluriel(nbCandidats, 'candidat')} {ou}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {listesCandidats.length}{' '}
                {scrutinLocal.unite === 'liste'
                  ? `${pluriel(listesCandidats.length, 'liste')} en lice pour ${nbSieges} ${pluriel(nbSieges, 'siège')}`
                  : `${pluriel(listesCandidats.length, 'candidature')} pour ${nbSieges} ${pluriel(nbSieges, 'siège')}`}
                . Les noms en couleur renvoient vers le bilan parlementaire de la personne.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {listesCandidats.map((listeCandidature) => (
                <ListeCandidatureCard key={listeCandidature.id} liste={listeCandidature} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Source : candidatures déposées en préfecture, publiées par le ministère de
              l&apos;Intérieur. La nuance politique est attribuée par l&apos;administration et
              ne présume pas de l&apos;appartenance déclarée du candidat.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">
              {publie
                ? `Le sort ${liste.length > 1 ? `des ${liste.length} sénateurs sortants` : 'du sénateur sortant'}`
                : `${liste.length} ${pluriel(liste.length, 'sénateur')} ${pluriel(liste.length, 'sortant')} ${ou}`}
            </h2>
            {publie && (
              <p className="mt-1 text-sm text-muted-foreground">
                Leur bilan de mandature, arrêté à la veille du scrutin.
              </p>
            )}
          </div>
          {liste.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((sortant) => (
                <SortantCard
                  key={sortant.mandatId}
                  sortant={sortant}
                  candidaturesPubliees={candidaturesPubliees}
                  sort={publie ? sortDuSortant.get(sortant.mandatId) : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Le bilan de mandature des sortants de cette circonscription n&apos;est pas
              encore disponible.
            </p>
          )}
        </div>

        {/* Un lien vers le répertoire, et non les 63 autres circonscriptions.
            La liste complète en pied de page servait à la découverte ; elle
            n'est plus nécessaire depuis que la page mère porte les 64 liens sur
            les titres de ses sections. Un moteur qui a trouvé cette page-ci est
            passé par là, et y retrouvera les autres. Restait le coût : soixante-
            trois noms sous chaque fiche, pour un lecteur qui en cherchait un. */}
        <div className="border-t pt-6">
          <Link
            href="/senatoriales-2026"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Voir les {nbCirconscriptions} départements concernés par le renouvellement
          </Link>
        </div>

        <SoutenirCallout />
      </div>
    </>
  );
}
