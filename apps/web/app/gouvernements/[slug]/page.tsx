import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchRessource } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { Portrait } from '@/components/gouvernements/portrait';
import { CompositionGouvernement } from '@/components/gouvernements/composition-gouvernement';
import { BilanCensure, BilanTextes } from '@/components/gouvernements/bilan-gouvernement';
import { Onglets, type Onglet } from '@/components/gouvernements/onglets';
import {
  RANGS,
  aujourdhui,
  dateLongue,
  duree,
  etapes,
  intituleAffiche,
  libellePoste,
  lienFiche,
  nombre,
  nomComplet,
  titreDuRang,
  type Domaine,
  type GouvernementDetail,
  type PersonneGouvernement,
  type PosteMinisteriel,
  type SourceGouvernements,
} from '@/lib/gouvernements';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

export const revalidate = 3600;

type Reponse = { data: GouvernementDetail; domaines?: Domaine[]; source: SourceGouvernements; sourceBilan?: SourceGouvernements };

async function getGouvernement(slug: string) {
  // `fetchRessource` : `null` sur un vrai 404 seulement, une panne de l'API lève
  // (et la version précédente de la page reste servie).
  return fetchRessource<Reponse>(`/gouvernements/${slug}`);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const reponse = await getGouvernement(params.slug);
  if (!reponse) return {};
  const g = reponse.data;
  const title = g.bilan ? `Gouvernement ${g.nom} : composition, bilan et dates` : `Gouvernement ${g.nom} : composition et dates`;
  const periode = g.dateFin ? `du ${dateLongue(g.dateDebut)} au ${dateLongue(g.dateFin)}` : `depuis le ${dateLongue(g.dateDebut)}`;
  const description =
    `Le gouvernement ${g.nom}${g.premierMinistre ? `, dirigé par ${nomComplet(g.premierMinistre)}` : ''}, ${periode} : ` +
    `${g.nbMembres} membres, leurs portefeuilles par domaine, les remaniements` +
    (g.bilan
      ? `, ${g.bilan.textes.portes} projets de loi portés, ${g.bilan.engagements.length} recours au 49.3 et ${g.bilan.motions.total} motions de censure`
      : '') +
    `, d'après l'open data de l'Assemblée nationale.`;
  const url = `${BASE_URL}/gouvernements/${g.slug}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url } };
}

/** Le nom, lié à la fiche quand la personne en a une. */
function Nom({ p, className = '' }: { p: PersonneGouvernement; className?: string }) {
  const fiche = lienFiche(p);
  return fiche ? (
    <Link href={fiche} className={`text-primary hover:underline ${className}`}>
      {nomComplet(p)}
    </Link>
  ) : (
    <span className={className}>{nomComplet(p)}</span>
  );
}

/** La liste complète, par rang protocolaire, avec les dates et l'identifiant de chaque poste dans la source. */
function TousLesPostes({ postes }: { postes: PosteMinisteriel[] }) {
  const sections = [
    ...RANGS.map((r) => ({ titre: r.titre, postes: postes.filter((p) => (r.rangs as readonly number[]).includes(p.rangProtocolaire)) })),
    { titre: 'Autres membres', postes: postes.filter((p) => titreDuRang(p.rangProtocolaire) === 'Autres membres') },
  ].filter((s) => s.postes.length > 0);
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.titre}>
          <h3 className="mb-1 text-sm font-semibold">
            {s.titre} <span className="font-normal text-muted-foreground">({s.postes.length})</span>
          </h3>
          <ul>
            {s.postes.map((p) => {
              const portefeuille = intituleAffiche(p.intituleCourt, p.intitule);
              return (
                <li key={p.uid} className="flex flex-col gap-1 border-b py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 text-sm">
                    <Nom p={p.membre} className="font-medium" /> · {libellePoste(p.qualite, p.intituleCourt, p.intitule)}
                    {p.intitule.toLowerCase() !== portefeuille.toLowerCase() && (
                      <p className="text-xs text-muted-foreground">{p.intitule}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-muted-foreground sm:text-right">
                    <p>
                      {dateLongue(p.dateDebut)} → {p.dateFin ? dateLongue(p.dateFin) : 'en cours'}
                    </p>
                    <p className="font-mono">{p.uid}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Une ligne de la colonne de faits : libellé à gauche, valeur à droite. */
function Fait({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function GouvernementPage({ params }: { params: { slug: string } }) {
  const reponse = await getGouvernement(params.slug);
  if (!reponse) notFound();
  const g = reponse.data;
  const pm = g.premierMinistre;
  const bilan = g.bilan ?? null;

  // Durée jusqu'à aujourd'hui pour le gouvernement en fonction, jusqu'à sa fin sinon.
  const jour = g.dateFin ?? aujourdhui();
  const nbChangements = etapes(g, g.postes).length - 1;
  // Absent d'une réponse mise en cache avant le déploiement qui l'ajoute.
  const femmes = typeof g.nbFemmes === 'number' ? g.nbFemmes : null;
  const domaines = reponse.domaines ?? [];

  // Le bilan est sur le même plan que la composition : un onglet chacun. Avant
  // juin 2017, pas d'onglet : la colonne de faits dit qu'il n'y a pas de données.
  const onglets: Onglet[] = [
    {
      cle: 'composition',
      libelle: 'Composition',
      compte: g.nbMembres,
      contenu: (
        <CompositionGouvernement
          gouvernement={{ dateDebut: g.dateDebut, dateFin: g.dateFin, enCours: g.enCours, postes: g.postes }}
          domaines={domaines}
        />
      ),
    },
    ...(bilan
      ? [
          { cle: 'textes', libelle: 'Textes portés', compte: bilan.textes.portes, contenu: <BilanTextes bilan={bilan} domaines={domaines} /> },
          {
            cle: 'censure',
            libelle: '49.3 et censure',
            compte: `${bilan.engagements.length} · ${bilan.motions.total}`,
            contenu: <BilanCensure bilan={bilan} />,
          },
        ]
      : []),
    { cle: 'postes', libelle: 'Tous les postes', compte: g.nbPostes, contenu: <TousLesPostes postes={g.postes} /> },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Gouvernements', url: `${BASE_URL}/gouvernements` },
          { name: `Gouvernement ${g.nom}`, url: `${BASE_URL}/gouvernements/${g.slug}` },
        ]}
      />

      <Link href="/gouvernements" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Tous les gouvernements
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold md:text-3xl">Gouvernement {g.nom}</h1>
          {g.enCours && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">En fonction</span>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">
          {g.dateFin ? `Du ${dateLongue(g.dateDebut)} au ${dateLongue(g.dateFin)}` : `Depuis le ${dateLongue(g.dateDebut)}`}
          {g.presidence && <> · présidence de {nomComplet(g.presidence)}</>}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        {/* Les faits du gouvernement, fixes à côté des onglets en grand écran, au-dessus en petit. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5">
            {pm && (
              <div className="flex items-center gap-3">
                <Portrait personne={pm} taille="lg" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{pm.civilite === 'Mme' ? 'Première ministre' : 'Premier ministre'}</p>
                  <p className="font-semibold">
                    <Nom p={pm} />
                  </p>
                </div>
              </div>
            )}

            <dl className="mt-4 divide-y">
              <Fait libelle={g.enCours ? 'En fonction depuis' : 'Durée'}>{duree(g.dateDebut, jour)}</Fait>
              <Fait libelle="Membres">{g.nbMembres}</Fait>
              {femmes !== null && (
                <Fait libelle="Femmes">
                  {femmes} ({Math.round((100 * femmes) / Math.max(g.nbMembres, 1))} %)
                </Fait>
              )}
              <Fait libelle="Changements de composition">{nbChangements}</Fait>
            </dl>

            {bilan && (
              <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bilan</p>
                <dl className="mt-1 divide-y">
                  <Fait libelle="Textes portés">
                    <a href="#textes" className="hover:text-primary hover:underline">
                      {bilan.textes.portes}
                    </a>
                  </Fait>
                  <Fait libelle="dont promulgués">{bilan.textes.parStadePortes.promulgue}</Fait>
                  {bilan.textes.total > bilan.textes.portes && (
                    <Fait libelle="Ratifications et conventions">{bilan.textes.total - bilan.textes.portes}</Fait>
                  )}
                  <Fait libelle="Recours au 49.3">
                    <a href="#censure" className="hover:text-primary hover:underline">
                      {bilan.engagements.length}
                    </a>
                  </Fait>
                  <Fait libelle="Motions de censure">
                    <a href="#censure" className="hover:text-primary hover:underline">
                      {bilan.motions.total}
                    </a>
                    {bilan.motions.adoptees > 0 && (
                      <span className="ml-1 text-red-700 dark:text-red-400">
                        ({nombre(bilan.motions.adoptees, 'adoptée')})
                      </span>
                    )}
                  </Fait>
                </dl>
              </>
            )}
            {g.couverture === 'avant_2017' && (
              <p className="mt-4 text-xs text-muted-foreground">Pas de données de bilan avant juin 2017.</p>
            )}
          </div>

          <nav className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
            {g.precedent ? (
              <Link href={`/gouvernements/${g.precedent.slug}`} className="inline-flex items-center gap-1 hover:text-primary">
                <ChevronLeft className="h-4 w-4" />
                {g.precedent.nom}
              </Link>
            ) : (
              <span />
            )}
            {g.suivant && (
              <Link href={`/gouvernements/${g.suivant.slug}`} className="inline-flex items-center gap-1 hover:text-primary">
                {g.suivant.nom}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </aside>

        <div className="min-w-0">
          <Onglets onglets={onglets} etiquette={`Gouvernement ${g.nom}`} />
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Source :{' '}
        <a href={reponse.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          {reponse.source.nom}
        </a>
        , gouvernement <span className="font-mono">{g.uid}</span>. Chaque poste porte l&apos;identifiant de son mandat
        (<span className="font-mono">PM…</span>) dans cette source. Les dates sont celles qu&apos;elle publie, en général
        celles de la publication au Journal officiel ; un membre sorti reste en fonction jusqu&apos;à la nomination de
        son successeur, d&apos;où des fins de poste au lendemain de la fin du gouvernement. Le classement des
        portefeuilles par domaine est celui de CLAIR : la source n&apos;en donne pas.
      </p>
      {reponse.sourceBilan && bilan && (
        <p className="mt-2 text-xs text-muted-foreground">
          Bilan :{' '}
          <a href={reponse.sourceBilan.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            {reponse.sourceBilan.nom}
          </a>
          . Un projet est rattaché au poste de chacun de ses signataires ; l&apos;Assemblée ne nomme que le Premier
          ministre pour un projet déposé d&apos;abord au Sénat, ses ministres viennent alors de la base DOSLEG du Sénat.
          Le stade est celui que le texte a atteint : promulgué, adopté définitivement, examiné en séance, ou déposé sans
          jamais l&apos;être. Une motion de censure vise le gouvernement en fonction le jour du vote.
        </p>
      )}
    </div>
  );
}
