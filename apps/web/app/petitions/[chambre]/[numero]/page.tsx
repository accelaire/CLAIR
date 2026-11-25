import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Calendar, ExternalLink, FileText, PenLine, Users } from 'lucide-react';
import { TextePetition } from '@/components/petitions/TextePetition';
import { TexteSource } from '@/components/petitions/TexteSource';
import { fetchRessource } from '@/lib/api-server';
import { BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import {
  COULEUR_ETAPE,
  LIBELLE_CHAMBRE,
  aujourdhuiParis,
  cheminPetition,
  dateLongue,
  estAVenir,
  libelleEtape,
  signaturesEnClair,
  sourceEtape,
  type ChambrePetition,
  type PetitionDetail,
} from '@/lib/petitions';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://clair.vote';

// Générée à la première visite puis resservie : la page ne lit aucun paramètre
// de recherche, ni elle ni ses composants (cf. `lib/liste-ssr`).
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Params = { chambre: string; numero: string };

async function getPetition({ chambre, numero }: Params) {
  if ((chambre !== 'assemblee' && chambre !== 'senat') || !/^[1-9]\d{0,6}$/.test(numero)) return null;
  // `null` sur un vrai 404 seulement : une panne de l'API lève, et la version
  // précédente de la page reste servie.
  const r = await fetchRessource<{ data: PetitionDetail }>(`/petitions/${chambre}/${numero}`);
  return r?.data ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getPetition(params);
  if (!p) return {};
  const url = `${BASE_URL}${cheminPetition(p)}`;
  const title = `Pétition : ${p.titre}`;
  const parcours = p.etape
    ? `${libelleEtape(p.etape, p.etapeDate)}${p.etapeDate ? ` le ${dateLongue(p.etapeDate)}` : ''}`
    : 'aucune étape en commission';
  const description =
    `Pétition n° ${p.numero} déposée sur la plateforme ${p.chambre === 'senat' ? 'du Sénat' : "de l'Assemblée nationale"} : ` +
    `${signaturesEnClair(p.signatures)}, ${parcours}. Son parcours, daté et sourcé, sur CLAIR.vote.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Seules les pétitions suivies (au moins 10 000 signatures ou une étape en
    // commission) sont indexées : 89 % des pétitions n'atteignent pas 500
    // signatures, autant de pages sans rien à apprendre à un moteur.
    robots: p.suivie ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function Chiffre({ valeur, label, couleur = '' }: { valeur: string; label: string; couleur?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className={`text-2xl font-bold ${couleur}`}>{valeur}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

const BADGE = 'px-3 py-1 text-sm font-medium rounded-full';

export default async function PetitionPage({ params }: { params: Params }) {
  const p = await getPetition(params);
  if (!p) notFound();

  const chambre = p.chambre as ChambrePetition;
  const url = `${BASE_URL}${cheminPetition(p)}`;
  const aujourdhui = aujourdhuiParis();
  const ouverte = p.collecte === 'ouverte';
  const nbEtapes = p.etapes.length;
  const dossiers = p.etapes.filter((e) => e.dossier);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Accueil', url: BASE_URL },
          { name: 'Pétitions', url: `${BASE_URL}/petitions` },
          { name: p.titre, url },
        ]}
      />
      <div className="container mx-auto px-4 py-8">
        {/* Fil d'Ariane, comme sur les fiches des dossiers */}
        <nav className="mb-6 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/petitions"
            className="inline-flex flex-shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-muted"
            aria-label="Toutes les pétitions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link href="/petitions" className="flex-shrink-0 transition-colors hover:text-foreground">Pétitions</Link>
          <span className="flex-shrink-0">/</span>
          <span className="truncate font-medium text-foreground">n° {p.numero}</span>
        </nav>

        <header className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`${BADGE} ${chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'}`}>{LIBELLE_CHAMBRE[chambre]}</span>
            <span
              className={`${BADGE} ${
                ouverte ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
              }`}
            >
              {ouverte ? 'Signatures ouvertes' : 'Collecte close'}
            </span>
            {p.etape && (
              <span className={`${BADGE} ${COULEUR_ETAPE[p.etape]}`}>
                {libelleEtape(p.etape, p.etapeDate, aujourdhui)}
                {p.etapeDate && ` · ${dateLongue(p.etapeDate)}`}
              </span>
            )}
            {p.typeSource && <span className={`${BADGE} bg-muted text-muted-foreground`}>{p.typeSource}</span>}
          </div>

          <h1 className="mb-3 text-2xl font-bold md:text-3xl">{p.titre}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" aria-hidden />
              Publiée le {dateLongue(p.datePublication)}
              {p.legislature ? ` · ${p.legislature}e législature` : ''}
            </span>
            {(p.commission || p.commissionSource) && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" aria-hidden />
                {p.commission ? (
                  <Link href={`/commissions/${p.commission.slug}#petitions`} className="hover:text-foreground hover:underline">
                    {p.commission.nom}
                  </Link>
                ) : (
                  p.commissionSource
                )}
              </span>
            )}
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" aria-hidden /> Page officielle
            </a>
            {ouverte && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <PenLine className="h-4 w-4 flex-shrink-0" aria-hidden />
                Signer sur la plateforme officielle
                <ArrowRight className="h-4 w-4 flex-shrink-0" aria-hidden />
              </a>
            )}
          </div>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Chiffre
            valeur={p.signatures === null ? '—' : p.signatures.toLocaleString('fr-FR')}
            label={p.signatures === null ? 'Compteur non publié' : `Signature${p.signatures > 1 ? 's' : ''}`}
            couleur="text-primary"
          />
          <Chiffre valeur={String(nbEtapes)} label={`Étape${nbEtapes > 1 ? 's' : ''} du parcours`} />
          <Chiffre
            valeur={ouverte ? 'Ouverte' : 'Close'}
            label={p.dateLimite ? `Collecte ${ouverte ? "jusqu'au" : 'close le'} ${dateLongue(p.dateLimite)}` : 'Collecte'}
          />
        </div>

        <div className="mb-8 rounded-lg border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4" aria-hidden />
            Le texte de la pétition
          </h2>
          {/* `extrait` en repli : une réponse mise en cache avant `texte` n'en a pas. */}
          <TextePetition texte={p.texte || p.extrait} />
          {p.texteIncomplet && (
            <p className="mt-3 text-xs text-muted-foreground">
              Le jeu de données coupe les textes vers 10 000 caractères : la fin de celui-ci peut manquer. Le texte
              intégral est sur la{' '}
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">page officielle</a>.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Texte déposé par un citoyen et publié par {chambre === 'senat' ? 'le Sénat' : "l'Assemblée nationale"} après examen
            de sa recevabilité. Courriels et numéros de téléphone masqués par CLAIR.
          </p>
        </div>

        {/* Le parcours : la raison d'être de cette page. */}
        <section className="mb-8">
          <h2 className="mb-1 text-xl font-semibold">Le parcours de la pétition</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Chaque étape est datée et renvoie à sa source : l&apos;ordre du jour de la commission, le dossier
            parlementaire ou la page officielle de la pétition.
          </p>
          {nbEtapes === 0 ? (
            <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              {p.commission
                ? <>La pétition est renvoyée à la <Link href={`/commissions/${p.commission.slug}`} className="underline hover:text-foreground">{p.commission.nom.charAt(0).toLowerCase() + p.commission.nom.slice(1)}</Link>, qui n&apos;a publié aucune étape à son sujet.</>
                : <>Aucune étape publiée pour cette pétition.</>}
            </p>
          ) : (
            <ol className="divide-y rounded-lg border bg-card">
              {p.etapes.map((e, i) => {
                const src = sourceEtape(e, p.url);
                const aVenir = estAVenir(e.date, aujourdhui);
                return (
                  <li key={`${e.type}-${e.source}-${i}`} className={`px-4 py-3 ${aVenir ? 'bg-muted/30' : ''}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${COULEUR_ETAPE[e.type]}`}>
                        {libelleEtape(e.type, e.date, aujourdhui)}
                      </span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {e.date ? dateLongue(e.date) : 'Date non publiée'}
                      </span>
                      {e.reunion?.commission && (
                        <Link href={`/commissions/${e.reunion.commission.slug}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {e.reunion.commission.nom}
                        </Link>
                      )}
                    </div>
                    <TexteSource texte={e.libelle} renvois={p.renvois} className="mt-1.5 text-sm" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Source :{' '}
                      {src.externe ? (
                        <a href={src.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline hover:text-foreground">
                          {src.libelle}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <Link href={src.href} className="underline hover:text-foreground">{src.libelle}</Link>
                      )}
                      {e.rattachement === 'titre_exact' && (
                        <> · rattachée par son titre exact, l&apos;ordre du jour ne donnant pas son numéro</>
                      )}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          {p.statutSource.toLowerCase() === 'ouverte' && !ouverte && (
            <p className="mt-3 text-xs text-muted-foreground">
              La plateforme affiche encore cette pétition comme « ouverte », mais sa date limite est passée.
            </p>
          )}
        </section>

        {dossiers.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">Le dossier parlementaire</h2>
            {dossiers.map((e) => (
              <Link
                key={e.dossier!.uid}
                href={`/dossiers/${e.dossier!.uid}`}
                className="mb-2 flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium">{e.dossier!.titre}</span>
              </Link>
            ))}
          </section>
        )}

        <p className="text-xs text-muted-foreground">
          Sources : {chambre === 'senat' ? 'jeu « Pétitions du Sénat »' : "jeu « Pétitions de l'Assemblée nationale »"} de data.gouv.fr
          (Licence Ouverte), mis à jour chaque semaine ; agenda des commissions et dossiers législatifs de l&apos;Assemblée nationale ;
          page officielle de la pétition. Dernière mise à jour : {dateLongue(p.updatedAt)}.
        </p>
      </div>
    </>
  );
}
