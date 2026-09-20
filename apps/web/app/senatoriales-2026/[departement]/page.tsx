import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
import type { ApercuSenatoriales, ListeCandidature, Sortant } from '../PageClient';
import { SortantCard } from '../components/SortantCard';
import { ListeCandidatureCard } from '../components/ListeCandidatureCard';

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
 */
export const revalidate = 3600;

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
  const [apercu, sortants, candidats] = await Promise.all([
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
  ]);
  return { apercu, sortants, candidats };
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

  const { apercu, sortants, candidats } = await chargerDonnees(code);

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
          <p className="text-muted-foreground">
            {nbSieges} {pluriel(nbSieges, 'siège')} de sénateur{' '}
            {accorde(nbSieges, 'est remis', 'sont remis')} en jeu le dimanche
            27 septembre 2026. Voici le bilan de mandature
            {liste.length > 1 ? ' des sortants' : ' du sortant'}.
          </p>
        </div>

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

        {candidaturesPubliees && (
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="text-lg font-semibold">
            {liste.length} {pluriel(liste.length, 'sénateur')}{' '}
            {pluriel(liste.length, 'sortant')} {ou}
          </h2>
          {liste.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liste.map((sortant) => (
                <SortantCard
                  key={sortant.mandatId}
                  sortant={sortant}
                  candidaturesPubliees={candidaturesPubliees}
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
