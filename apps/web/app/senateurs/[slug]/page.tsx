import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRessource } from '@/lib/api-server';
import { PersonJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import PageClient from './PageClient';
import type { SenateurDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Rendue à la demande puis conservée, au lieu d'être rejouée à chaque visite.
// Motif et garde-fous dans `lib/liste-ssr`.
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

async function getSenateur(slug: string) {
  const res = await fetchRessource<{ data: SenateurDetail }>(
    `/senateurs/${slug}?include=stats`,
  );
  return res?.data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getSenateur(params.slug);
  if (!data) return {};

  const fullName = `${data.prenom} ${data.nom}`;
  const isFemale = data.sexe === 'F';
  const title = `${fullName}, ${isFemale ? 'sénatrice' : 'sénateur'} — votes et activité`;

  const parts = [
    `Fiche de ${fullName}, ${isFemale ? 'sénatrice' : 'sénateur'}`,
    data.groupe ? `${data.groupe.nom}` : null,
    data.circonscription
      ? `${data.circonscription.nom} (${data.circonscription.departement})`
      : null,
    'Votes, présence, interventions et amendements sur CLAIR.vote.',
  ];
  const description = parts.filter(Boolean).join(' — ');
  const url = `${BASE_URL}/senateurs/${data.slug}`;

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

export default async function SenateurDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getSenateur(params.slug);

  // Sans ça, un slug inconnu rendait la coquille du client en HTTP 200 : un
  // soft 404 que Google indexe puis garde. `fetchRessource` ne renvoie `null`
  // que sur un vrai 404 de l'API, jamais sur une panne.
  if (!data) notFound();

  const sameAs: string[] = [];
  if (data?.twitter)
    sameAs.push(`https://x.com/${data.twitter.replace('@', '')}`);
  if (data?.facebook) sameAs.push(data.facebook);
  if (data?.siteWeb) sameAs.push(data.siteWeb);

  return (
    <>
      {data && (
        <>
          <PersonJsonLd
            name={`${data.prenom} ${data.nom}`}
            givenName={data.prenom}
            familyName={data.nom}
            jobTitle={data.sexe === 'F' ? 'Sénatrice' : 'Sénateur'}
            image={data.photoUrl || undefined}
            url={`${BASE_URL}/senateurs/${data.slug}`}
            worksFor={
              data.groupe
                ? { name: data.groupe.nomComplet || data.groupe.nom }
                : undefined
            }
            description={
              data.circonscription
                ? `${data.sexe === 'F' ? 'Sénatrice' : 'Sénateur'} de ${data.circonscription.nom} (${data.circonscription.departement})`
                : undefined
            }
            birthDate={data.dateNaissance || undefined}
            email={data.email || undefined}
            sameAs={sameAs.length > 0 ? sameAs : undefined}
          />
          <BreadcrumbJsonLd
            items={[
              { name: 'Accueil', url: BASE_URL },
              { name: 'Sénateurs', url: `${BASE_URL}/senateurs` },
              {
                name: `${data.prenom} ${data.nom}`,
                url: `${BASE_URL}/senateurs/${data.slug}`,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={data ?? undefined} />
    </>
  );
}
