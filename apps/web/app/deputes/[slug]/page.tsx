import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRessource, fetchFromApi } from '@/lib/api-server';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import { PersonJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { descriptionParlementaire, fonctionParlementaire } from '@/lib/meta-parlementaire';
import PageClient from './PageClient';
import type { DeputeDetail, PageVotes } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Cette page NE PEUT PAS être générée statiquement, malgré l'absence de
// paramètre d'URL dans son propre code : elle rend `interventions-list`, qui appelle `useUrlFilters`.
// Un `useSearchParams` non enveloppé d'une `<Suspense>` fait sortir tout le
// rendu statique en « deopted into client-side rendering », ce qui répond 500.
//
// L'enrober d'une `<Suspense>` lèverait le 500 mais servirait le squelette à la
// place du contenu — précisément la panne SEO décrite dans `lib/liste-ssr`. Le
// rendu à la demande est donc le bon régime ici ; le cache edge de `vercel.json`
// est ce qui l'amortit.

async function getDepute(slug: string) {
  const res = await fetchRessource<{ data: DeputeDetail }>(
    `/deputes/${slug}?include=stats`,
  );
  return res?.data ?? null;
}

/**
 * Première page de votes, rendue côté serveur.
 *
 * `fetchFromApi` et non `fetchRessource` : une panne de l'API ne doit pas faire
 * échouer la fiche entière. La liste repart alors sur un chargement client,
 * comme avant.
 */
async function getDeputeVotes(slug: string) {
  return fetchFromApi<PageVotes>(
    `/deputes/${slug}/votes?page=1&limit=20`,
    REVALIDATE_LISTE_S,
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getDepute(params.slug);
  if (!data) return {};

  const fullName = `${data.prenom} ${data.nom}`;
  const fonction = fonctionParlementaire({
    chambre: 'assemblee',
    sexe: data.sexe,
    actif: data.actif,
    mandats: data.mandatsParlementaires,
  });
  const title = `${fullName}, ${fonction.libelle} — votes et activité`;

  const description = descriptionParlementaire({
    fullName,
    fonction: fonction.libelle,
    groupe: data.groupe?.nom,
    stats: data.stats,
    enCours: fonction.enCours,
    plusieursMandats: fonction.plusieursMandats,
  });
  const url = `${BASE_URL}/deputes/${data.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function DeputeDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const [data, votes] = await Promise.all([
    getDepute(params.slug),
    getDeputeVotes(params.slug),
  ]);

  // Sans ça, un slug inconnu rendait la coquille du client en HTTP 200 : un
  // soft 404 que Google indexe puis garde. `fetchRessource` ne renvoie `null`
  // que sur un vrai 404 de l'API, jamais sur une panne.
  if (!data) notFound();

  // Pour un ancien parlementaire, pas de `jobTitle` ni de `worksFor` : dans
  // schema.org ils décrivent l'emploi actuel, et le groupe d'un mandat terminé
  // n'emploie plus personne. Le mandat passé reste dit dans `description`.
  const fonction = data
    ? fonctionParlementaire({
        chambre: 'assemblee',
        sexe: data.sexe,
        actif: data.actif,
      })
    : null;
  const enExercice = fonction?.enCours ?? true;
  const libelleLd = fonction
    ? fonction.libelle.charAt(0).toUpperCase() + fonction.libelle.slice(1)
    : '';

  const sameAs: string[] = [];
  if (data?.twitter)
    sameAs.push(`https://x.com/${data.twitter.replace('@', '')}`);
  if (data?.siteWeb) sameAs.push(data.siteWeb);

  return (
    <>
      {data && (
        <>
          <PersonJsonLd
            name={`${data.prenom} ${data.nom}`}
            givenName={data.prenom}
            familyName={data.nom}
            jobTitle={enExercice ? (data.sexe === 'F' ? 'Députée' : 'Député') : undefined}
            image={data.photoUrl || undefined}
            url={`${BASE_URL}/deputes/${data.slug}`}
            worksFor={
              enExercice && data.groupe
                ? { name: data.groupe.nomComplet || data.groupe.nom }
                : undefined
            }
            description={
              data.circonscription
                ? `${libelleLd} de ${data.circonscription.nom} (${data.circonscription.departement})`
                : undefined
            }
            birthDate={data.dateNaissance || undefined}
            email={data.email || undefined}
            sameAs={sameAs.length > 0 ? sameAs : undefined}
          />
          <BreadcrumbJsonLd
            items={[
              { name: 'Accueil', url: BASE_URL },
              { name: 'Députés', url: `${BASE_URL}/deputes` },
              {
                name: `${data.prenom} ${data.nom}`,
                url: `${BASE_URL}/deputes/${data.slug}`,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={data ?? undefined} initialVotes={votes ?? undefined} />
    </>
  );
}
