import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowLeft, Calendar, Landmark, ScrollText } from 'lucide-react';
import { fetchRessource } from '@/lib/api-server';
import { BreadcrumbJsonLd, PersonJsonLd } from '@/components/seo/JsonLd';
import { Portrait } from '@/components/gouvernements/portrait';
import { BilanEntreeDeplie, EntreeParcours } from '@/components/gouvernements/parcours';
import { StatsGouvernement } from '@/components/parlementaire/stats-parlementaire';
import { TitresFiche, titresDeLaFiche } from '@/components/parlementaire/titres-fiche';
import {
  dateLongue,
  fonctionEnCours,
  fonctionsDuMembre,
  lienFiche,
  nombre,
  nomComplet,
  rattachementDuMembre,
  regrouperPostes,
  type MembreGouvernement,
  type PhotoCommons,
  type SourceGouvernements,
} from '@/lib/gouvernements';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

export const revalidate = 3600;

type Reponse = { data: MembreGouvernement; source: SourceGouvernements; sourceBilan?: SourceGouvernements };

async function getMembre(slug: string) {
  // `null` sur un vrai 404 seulement : une panne de l'API lève, et la version
  // précédente de la page reste servie.
  return fetchRessource<Reponse>(`/gouvernements/membres/${encodeURIComponent(slug)}`);
}

/** Ce que la page dit de la personne, en tête et dans ses métadonnées. */
function lecture(m: MembreGouvernement) {
  const fonctions = fonctionsDuMembre(m);
  const enCours = fonctionEnCours(fonctions, m.civilite === 'Mme' ? 'F' : null);
  const debut = fonctions.map((f) => f.dateDebut).sort()[0] ?? null;
  const ancien = m.civilite === 'Mme' ? 'Ancienne membre du Gouvernement' : 'Ancien membre du Gouvernement';
  const gouvernements = new Set(m.postes.flatMap((p) => (p.gouvernement ? [p.gouvernement.slug] : [])));
  return { fonctions, entrees: regrouperPostes(fonctions), enCours, debut, ancien, nbGouvernements: gouvernements.size };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const reponse = await getMembre(params.slug);
  if (!reponse || reponse.data.parlementaire) return {};
  const m = reponse.data;
  const { enCours, debut, ancien, nbGouvernements } = lecture(m);
  const nom = nomComplet(m);
  const title = `${nom} : parcours et bilan au Gouvernement`;
  const description =
    `${nom}, ${enCours ? enCours.dansUnTitre : ancien.charAt(0).toLowerCase() + ancien.slice(1)} : ` +
    `${nombre(m.postes.length, 'poste ministériel', 'postes ministériels')}` +
    (nbGouvernements > 0 ? ` dans ${nombre(nbGouvernements, 'gouvernement')}` : '') +
    (debut ? ` depuis ${debut.slice(0, 4)}` : '') +
    `, les projets de loi signés et les réponses en séance, d'après l'open data de l'Assemblée nationale et du Sénat.`;
  const url = `${BASE_URL}/gouvernements/membres/${m.slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

/**
 * La page d'un membre du Gouvernement qui n'a pas de fiche de député ou de
 * sénateur (166 sur 311 depuis 2007), au gabarit d'une fiche : en-tête, bilan
 * au Gouvernement avec les mêmes cartes, parcours avec la même frise. Une
 * personne qui a une fiche y est redirigée : une seule page par personne.
 */
export default async function MembrePage({ params }: { params: { slug: string } }) {
  const reponse = await getMembre(params.slug);
  if (!reponse) notFound();
  const m = reponse.data;
  const fiche = lienFiche(m);
  if (fiche) permanentRedirect(fiche);

  const { fonctions, entrees, enCours, ancien, nbGouvernements } = lecture(m);
  const nom = nomComplet(m);
  const url = `${BASE_URL}/gouvernements/membres/${m.slug}`;
  // Fil d'Ariane : la personne sous sa fonction la plus récente.
  const rattachement = rattachementDuMembre(m);
  const parent = rattachement ?? { nom: 'Gouvernements', href: '/gouvernements' };
  const bilanAvant2017 = m.postes.some((p) => !p.bilan);
  const unBilan = m.postes.some((p) => p.bilan);

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Gouvernements', url: `${BASE_URL}/gouvernements` },
          ...(rattachement ? [{ name: parent.nom, url: `${BASE_URL}${parent.href}` }] : []),
          { name: nom, url },
        ]}
      />
      <PersonJsonLd name={nom} givenName={m.prenom} familyName={m.nom} jobTitle={enCours?.titre} image={m.photo?.url} url={url} />

      {/* Fil d'Ariane, comme sur une fiche */}
      <nav className="mb-6 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={parent.href}
          className="inline-flex flex-shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-muted"
          aria-label={`Retour : ${parent.nom}`}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {rattachement && (
          // Masqué sur mobile pour laisser la place au nom : la flèche ramène au niveau parent.
          <span className="hidden flex-shrink-0 items-center gap-2 sm:flex">
            <Link href="/gouvernements" className="transition-colors hover:text-foreground">
              Gouvernements
            </Link>
            <span>/</span>
          </span>
        )}
        <Link href={parent.href} className="flex-shrink-0 transition-colors hover:text-foreground">
          {parent.nom}
        </Link>
        <span className="flex-shrink-0">/</span>
        <span className="truncate font-medium text-foreground">{nom}</span>
      </nav>

      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-8 md:flex-row">
        <div className="mx-auto md:mx-0">
          <Portrait personne={m} taille="xl" />
        </div>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold">{nom}</h1>

          {enCours ? (
            <TitresFiche titres={titresDeLaFiche(enCours, [])} />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{ancien}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-muted-foreground md:justify-start">
            <div className="flex items-center gap-1">
              <Landmark className="h-4 w-4" />
              <span>
                {nombre(m.postes.length, 'poste ministériel', 'postes ministériels')}
                {nbGouvernements > 1 && `, ${nbGouvernements} gouvernements`}
              </span>
            </div>
            {m.dateNaissance && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{dateLongue(m.dateNaissance)}</span>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Source :{' '}
            <a href={reponse.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              {reponse.source.nom}
            </a>
            . Pas de fiche de député ou de sénateur sur CLAIR.
          </p>
        </div>
      </div>

      <StatsGouvernement fonctions={fonctions} />

      {/* Parcours, titré et dessiné comme le bloc « Mandats » d'une fiche */}
      <section aria-labelledby="parcours">
        <div className="mb-4 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-blue-500" />
          <h2 id="parcours" className="text-xl font-semibold">
            Parcours
          </h2>
        </div>
        <ol className="relative space-y-5 border-l-2 border-muted pl-6">
          {entrees.map((e) => (
            <EntreeParcours key={e.postes[0]!.uid} entree={e}>
              <BilanEntreeDeplie entree={e} />
            </EntreeParcours>
          ))}
        </ol>
      </section>

      <div className="mt-10 space-y-2 text-xs text-muted-foreground">
        <p>
          Personne <span className="font-mono">{m.acteurUid}</span> dans la source. Les dates sont celles qu&apos;elle publie, en
          général celles de la publication au Journal officiel. Les postes reconduits d&apos;un gouvernement à l&apos;autre (même
          portefeuille, même rang, sans interruption) sont regroupés par CLAIR.
        </p>
        {reponse.sourceBilan && unBilan && (
          <p>
            Bilan :{' '}
            <a href={reponse.sourceBilan.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              {reponse.sourceBilan.nom}
            </a>
            . Un projet de loi est rattaché au poste de chacun de ses signataires ; son stade est celui que le texte a atteint.
            Les projets que le Premier ministre signe au nom du gouvernement sont sur la page de chaque gouvernement.
            {bilanAvant2017 && ' Pas de données de bilan avant juin 2017.'}
          </p>
        )}
        {m.photo && <CreditPhoto photo={m.photo} />}
      </div>
    </div>
  );
}

/**
 * Crédit d'une photo de Wikimedia Commons, exigé par la plupart de ses
 * licences : avec les notes de bas de page, comme les autres sources.
 */
function CreditPhoto({ photo }: { photo: PhotoCommons }) {
  const lien = 'underline hover:text-foreground';
  return (
    <p>
      Photo : {photo.auteur && <>{photo.auteur}, </>}
      {photo.licenceUrl ? (
        <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer license" className={lien}>
          {photo.licence}
        </a>
      ) : (
        photo.licence
      )}
      , via{' '}
      <a href={photo.source} target="_blank" rel="noopener noreferrer" className={lien}>
        Wikimedia Commons
      </a>{' '}
      (image principale de la personne sur Wikidata).
    </p>
  );
}
