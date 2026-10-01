import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { fetchRessource, fetchFromApi } from '@/lib/api-server';
import { chambreDeLaFiche } from '@/lib/chambre-de-la-fiche';
import { REVALIDATE_LISTE_S } from '@/lib/liste-ssr';
import { PersonJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { descriptionParlementaire, fonctionParlementaire } from '@/lib/meta-parlementaire';
import PageClient from './PageClient';
import type { SenateurDetail, PageVotes } from './PageClient';
import { FicheEluProvisoire, titreElu } from './FicheEluProvisoire';
import { nomComplet, type FicheEluProvisoire as FicheProvisoire } from '@/lib/senatoriales/resultats';

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

async function getSenateur(slug: string) {
  const res = await fetchRessource<{ data: SenateurDetail }>(
    `/senateurs/${slug}?include=stats`,
  );
  return res?.data ?? null;
}

/**
 * Sénateur élu le 27 septembre qui n'a pas encore de fiche : il n'entre dans
 * l'annuaire du Sénat qu'à sa prise de fonction. D'ici là, son adresse sert une
 * fiche provisoire ; ensuite, la vraie fiche la remplace à la même adresse.
 */
async function getEluProvisoire(slug: string) {
  return fetchRessource<FicheProvisoire>(`/senatoriales/2026/elus/${slug}`, 60);
}

function metadataProvisoire(fiche: FicheProvisoire): Metadata {
  const nom = nomComplet(fiche.elu.prenom, fiche.elu.nom);
  const title = `${nom}, ${titreElu(fiche)}`;
  const mandat = fiche.elu.mandatsLocaux?.mandats[0]?.libelle;
  const description =
    `${nom} a été ${titreElu(fiche)} le 27 septembre 2026` +
    (fiche.elu.nuanceLibelle ? ` (${fiche.elu.nuanceLibelle})` : '') +
    '. ' +
    (mandat ? `${mandat}. ` : '') +
    'Son élection, ses mandats locaux et son profil, en attendant sa prise de fonction le 1er octobre.';
  const url = `${BASE_URL}/senateurs/${fiche.elu.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Première page de votes, rendue côté serveur.
 *
 * `fetchFromApi` et non `fetchRessource` : une panne de l'API ne doit pas faire
 * échouer la fiche entière. La liste repart alors sur un chargement client,
 * comme avant.
 */
async function getSenateurVotes(slug: string) {
  return fetchFromApi<PageVotes>(
    `/senateurs/${slug}/votes?page=1&limit=20`,
    REVALIDATE_LISTE_S,
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getSenateur(params.slug);
  if (!data) {
    const provisoire = await getEluProvisoire(params.slug);
    return provisoire ? metadataProvisoire(provisoire) : {};
  }

  const fullName = `${data.prenom} ${data.nom}`;
  const fonction = fonctionParlementaire({
    chambre: 'senat',
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
  const [data, votes] = await Promise.all([
    getSenateur(params.slug),
    getSenateurVotes(params.slug),
  ]);

  // Sans ça, un slug inconnu rendait la coquille du client en HTTP 200 : un
  // soft 404 que Google indexe puis garde. `fetchRessource` ne renvoie `null`
  // que sur un vrai 404 de l'API, jamais sur une panne.
  if (!data) {
    const provisoire = await getEluProvisoire(params.slug);
    if (!provisoire) {
      // Fiche rangée à l'Assemblée : un ancien sénateur redevenu député, ou un
      // député élu sénateur dont la fiche n'est pas encore passée au Sénat.
      // Redirection temporaire, puisque la seconde situation se résout d'elle-même.
      if ((await chambreDeLaFiche(params.slug)) === 'assemblee') redirect(`/deputes/${params.slug}`);
      notFound();
    }
    const nom = nomComplet(provisoire.elu.prenom, provisoire.elu.nom);
    const url = `${BASE_URL}/senateurs/${provisoire.elu.slug}`;
    return (
      <>
        <PersonJsonLd
          name={nom}
          givenName={provisoire.elu.prenom}
          familyName={nomComplet('', provisoire.elu.nom)}
          url={url}
          description={`${titreElu(provisoire).charAt(0).toUpperCase()}${titreElu(provisoire).slice(1)} le 27 septembre 2026`}
        />
        <BreadcrumbJsonLd
          items={[
            { name: 'Accueil', url: BASE_URL },
            { name: 'Sénatoriales 2026', url: `${BASE_URL}/senatoriales-2026` },
            { name: nom, url },
          ]}
        />
        <FicheEluProvisoire fiche={provisoire} />
      </>
    );
  }

  // Pour un ancien parlementaire, pas de `jobTitle` ni de `worksFor` : dans
  // schema.org ils décrivent l'emploi actuel, et le groupe d'un mandat terminé
  // n'emploie plus personne. Le mandat passé reste dit dans `description`.
  const fonction = data
    ? fonctionParlementaire({
        chambre: 'senat',
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
            jobTitle={enExercice ? (data.sexe === 'F' ? 'Sénatrice' : 'Sénateur') : undefined}
            image={data.photoUrl || undefined}
            url={`${BASE_URL}/senateurs/${data.slug}`}
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
              { name: 'Sénateurs', url: `${BASE_URL}/senateurs` },
              {
                name: `${data.prenom} ${data.nom}`,
                url: `${BASE_URL}/senateurs/${data.slug}`,
              },
            ]}
          />
        </>
      )}
      <PageClient initialData={data ?? undefined} initialVotes={votes ?? undefined} />
    </>
  );
}
