import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRessource } from '@/lib/api-server';
import { PersonJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { DeputeDetail } from './PageClient';

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

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getDepute(params.slug);
  if (!data) return {};

  const fullName = `${data.prenom} ${data.nom}`;
  const isFemale = data.sexe === 'F';
  const title = `${fullName}, ${isFemale ? 'députée' : 'député'} — votes et activité`;

  const parts = [
    `Fiche de ${fullName}, ${isFemale ? 'députée' : 'député'}`,
    data.groupe ? `${data.groupe.nom}` : null,
    data.circonscription
      ? `${data.circonscription.nom} (${data.circonscription.departement})`
      : null,
    'Votes, présence, interventions et amendements sur CLAIR.vote.',
  ];
  const description = parts.filter(Boolean).join(' — ');
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
  const data = await getDepute(params.slug);

  // Sans ça, un slug inconnu rendait la coquille du client en HTTP 200 : un
  // soft 404 que Google indexe puis garde. `fetchRessource` ne renvoie `null`
  // que sur un vrai 404 de l'API, jamais sur une panne.
  if (!data) notFound();

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
            jobTitle={data.sexe === 'F' ? 'Députée' : 'Député'}
            image={data.photoUrl || undefined}
            url={`${BASE_URL}/deputes/${data.slug}`}
            worksFor={
              data.groupe
                ? { name: data.groupe.nomComplet || data.groupe.nom }
                : undefined
            }
            description={
              data.circonscription
                ? `${data.sexe === 'F' ? 'Députée' : 'Député'} de ${data.circonscription.nom} (${data.circonscription.departement})`
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
      <PageClient initialData={data ?? undefined} />
    </>
  );
}
