import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { dossierTitreCourtLisible, formatDossierTitre } from '@/lib/dossiers';
import PageClient from './PageClient';
import type { DossierDetail } from './PageClient';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

async function getDossier(uid: string) {
  return fetchFromApi<DossierDetail>(`/dossiers/${uid}`);
}

/**
 * Titre de l'onglet, du partage et du fil d'Ariane. `titreCourt` vaut un
 * identifiant (« rapport_sur_petition_3014_du_10_juillet_2025… ») sur 8 086
 * dossiers de prod sur 21 689 (25/11/2026) : on prend alors le titre affiché
 * en tête de page.
 */
function titreDuDossier(d: Pick<DossierDetail, 'titre' | 'titreCourt' | 'procedureLibelle'>): string {
  return dossierTitreCourtLisible(d.titreCourt) || formatDossierTitre(d.titre, d.procedureLibelle);
}

export async function generateMetadata({
  params,
}: {
  params: { uid: string };
}): Promise<Metadata> {
  const data = await getDossier(params.uid);
  if (!data) return {};

  const title = titreDuDossier(data);
  const chambreLabel =
    data.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';

  const parts = [
    `Dossier législatif : ${data.titre}`,
    data.procedureLibelle ? `Procédure : ${data.procedureLibelle}` : null,
    data.etat ? `État : ${data.etat}` : null,
    chambreLabel,
    'Scrutins, amendements et débats sur CLAIR.vote.',
  ];
  const description = parts.filter(Boolean).join('. ');
  const url = `${BASE_URL}/dossiers/${data.uid}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function DossierDetailPage({
  params,
}: {
  params: { uid: string };
}) {
  const data = await getDossier(params.uid);

  return (
    <>
      {data && (
        <BreadcrumbJsonLd
          items={[
            { name: 'Accueil', url: BASE_URL },
            { name: 'Dossiers législatifs', url: `${BASE_URL}/dossiers` },
            {
              name: titreDuDossier(data),
              url: `${BASE_URL}/dossiers/${data.uid}`,
            },
          ]}
        />
      )}
      <PageClient initialData={data ?? undefined} />
    </>
  );
}
