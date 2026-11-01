import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Repeat, Users } from 'lucide-react';
import { fetchRessource } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import { Portrait } from '@/components/gouvernements/portrait';
import { CompositionGouvernement } from '@/components/gouvernements/composition-gouvernement';
import {
  RANGS,
  aujourdhui,
  dateLongue,
  duree,
  etapes,
  intituleAffiche,
  libellePoste,
  lienFiche,
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

type Reponse = { data: GouvernementDetail; domaines?: Domaine[]; source: SourceGouvernements };

async function getGouvernement(slug: string) {
  // `fetchRessource` : `null` sur un vrai 404 seulement, une panne de l'API lève
  // (et la version précédente de la page reste servie).
  return fetchRessource<Reponse>(`/gouvernements/${slug}`);
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const reponse = await getGouvernement(params.slug);
  if (!reponse) return {};
  const g = reponse.data;
  const title = `Gouvernement ${g.nom} : composition et dates`;
  const periode = g.dateFin ? `du ${dateLongue(g.dateDebut)} au ${dateLongue(g.dateFin)}` : `depuis le ${dateLongue(g.dateDebut)}`;
  const description =
    `Le gouvernement ${g.nom}${g.premierMinistre ? `, dirigé par ${nomComplet(g.premierMinistre)}` : ''}, ${periode} : ` +
    `${g.nbMembres} membres, leurs portefeuilles par domaine, les remaniements, d'après l'open data de l'Assemblée nationale.`;
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

function Chiffre({ icone: Icone, valeur, legende }: { icone: typeof Users; valeur: string; legende: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icone className="h-3.5 w-3.5" />
        {legende}
      </div>
      <p className="mt-1 text-lg font-semibold">{valeur}</p>
    </div>
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

export default async function GouvernementPage({ params }: { params: { slug: string } }) {
  const reponse = await getGouvernement(params.slug);
  if (!reponse) notFound();
  const g = reponse.data;
  const pm = g.premierMinistre;

  // Durée jusqu'à aujourd'hui pour le gouvernement en fonction, jusqu'à sa fin sinon.
  const jour = g.dateFin ?? aujourdhui();
  const nbChangements = etapes(g, g.postes).length - 1;
  // Absent d'une réponse mise en cache avant le déploiement qui l'ajoute.
  const femmes = typeof g.nbFemmes === 'number' ? g.nbFemmes : null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
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

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">Gouvernement {g.nom}</h1>
          {g.enCours && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">En fonction</span>
          )}
        </div>
        <p className="mt-1 text-muted-foreground">
          {g.dateFin ? `Du ${dateLongue(g.dateDebut)} au ${dateLongue(g.dateFin)}` : `Depuis le ${dateLongue(g.dateDebut)}`}
          {g.presidence && <> · présidence de {nomComplet(g.presidence)}</>}
        </p>

        {pm && (
          <div className="mt-5 flex items-center gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Portrait personne={pm} taille="lg" />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{pm.civilite === 'Mme' ? 'Première ministre' : 'Premier ministre'}</p>
              <p className="text-xl font-semibold">
                <Nom p={pm} />
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Chiffre icone={CalendarClock} legende={g.enCours ? 'En fonction depuis' : 'Durée'} valeur={duree(g.dateDebut, jour)} />
          <Chiffre icone={Users} legende="Membres" valeur={String(g.nbMembres)} />
          {femmes !== null && (
            <Chiffre
              icone={Users}
              legende="Femmes"
              valeur={`${femmes} sur ${g.nbMembres} (${Math.round((100 * femmes) / Math.max(g.nbMembres, 1))} %)`}
            />
          )}
          <Chiffre icone={Repeat} legende="Changements de composition" valeur={String(nbChangements)} />
        </div>
      </header>

      {/* `domaines` manque à une réponse mise en cache avant le déploiement qui
          l'ajoute : les postes passent alors tous sous « Autres portefeuilles ». */}
      <CompositionGouvernement
        gouvernement={{ dateDebut: g.dateDebut, dateFin: g.dateFin, enCours: g.enCours, postes: g.postes }}
        domaines={reponse.domaines ?? []}
      />

      <details className="mb-10 rounded-lg border bg-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Tous les postes depuis la nomination ({g.nbPostes}), avec leurs dates
        </summary>
        <div className="mt-4">
          <TousLesPostes postes={g.postes} />
        </div>
      </details>

      <nav className="flex flex-wrap justify-between gap-3 text-sm">
        {g.precedent ? (
          <Link href={`/gouvernements/${g.precedent.slug}`} className="inline-flex items-center gap-1 hover:text-primary">
            <ChevronLeft className="h-4 w-4" />
            Gouvernement {g.precedent.nom}
          </Link>
        ) : (
          <span />
        )}
        {g.suivant && (
          <Link href={`/gouvernements/${g.suivant.slug}`} className="inline-flex items-center gap-1 hover:text-primary">
            Gouvernement {g.suivant.nom}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </nav>

      <p className="mt-8 text-xs text-muted-foreground">
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
    </div>
  );
}
