'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Video,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { grouperParSujet, libelleDeSeance } from '@/lib/debats';
import { urlDuCompteRendu } from '@/lib/compte-rendu-url';
import { pointsDeLOrdreDuJour } from '@/lib/ordre-du-jour';

export interface ReunionDetail {
  id: string;
  uid: string;
  type: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  etat: string | null;
  odjResume: string | null;
  odjComplet: string | null;
  captationVideo: boolean;
  urlVideo: string | null;
  compteRenduRef: string | null;
  commission: {
    id: string;
    slug: string;
    nom: string;
    nomCourt: string | null;
    chambre: string;
    type: string;
  } | null;
  participants: Array<{
    presence: string | null;
    parlementaire: {
      id: string;
      slug: string;
      nom: string;
      prenom: string;
      photoUrl: string | null;
      chambre: string;
      groupe: { nom: string; couleur: string | null; slug: string } | null;
    };
  }>;
  interventions: Array<{
    id: string;
    type: string;
    contenu: string;
    date: string;
    hasMore: boolean;
    ordre: number | null;
    sourceUrl: string | null;
    orateurNom: string | null;
    orateurPrenom: string | null;
    orateurQualite: string | null;
    orateurGroupe: string | null;
    estPresidence: boolean;
    articleVise: string | null;
    amendementsVises: string[] | null;
    texteNumero: string | null;
    dossier: { uid: string; titre: string } | null;
    parlementaire: {
      id: string;
      slug: string;
      nom: string;
      prenom: string;
      photoUrl: string | null;
      groupe: { nom: string; couleur: string | null } | null;
    } | null;
  }>;
  avisCommission: Array<{
    id: string;
    numero: string;
    position: string;
    sens: string;
    place: string | null;
    auteur: string | null;
    groupe: string | null;
    ordre: number;
    amendement: { id: string; numero: string; sort: string | null; dossierId: string | null } | null;
  }>;
}

/** Couleurs du sens d'un avis. `autre` couvre les retraits et les irrecevabilités. */
const COULEUR_DU_SENS: Record<string, string> = {
  favorable:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  defavorable:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
  autre: 'bg-muted text-muted-foreground border-border',
};

export default function PageClient({ reunion }: { reunion: ReunionDetail }) {
  const router = useRouter();
  const chambreLabel = reunion.commission?.chambre === 'senat' ? 'Sénat' : 'Assemblée nationale';
  const crUrl = urlDuCompteRendu(reunion.compteRenduRef);
  const groupes = grouperParSujet(reunion.interventions, { avecTexte: true });

  const points = pointsDeLOrdreDuJour(reunion.odjResume, reunion.odjComplet);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      {/* Retour et fil d'Ariane, comme sur la page d'un scrutin : une réunion
          est un objet imbriqué dans sa commission, et le lecteur y arrive aussi
          bien depuis l'agenda que depuis la commission. La flèche revient d'où
          l'on vient, le fil dit où l'on est. */}
      <nav className="mb-6 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => router.back()}
          className="inline-flex flex-shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-muted"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link href="/commissions" className="flex-shrink-0 transition-colors hover:text-foreground">
          Commissions
        </Link>
        {reunion.commission && (
          <>
            <span className="hidden flex-shrink-0 sm:inline">/</span>
            <Link
              href={`/commissions/${reunion.commission.slug}`}
              className="hidden max-w-[16rem] truncate transition-colors hover:text-foreground sm:inline md:max-w-sm"
            >
              {reunion.commission.nom}
            </Link>
          </>
        )}
        <span className="flex-shrink-0">/</span>
        <span className="truncate font-medium text-foreground">
          {libelleDeSeance(reunion.dateDebut)}
        </span>
      </nav>

      <header className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {chambreLabel}
        </p>
        <h1 className="text-balance text-2xl font-bold sm:text-3xl">
          {reunion.commission?.nom || 'Réunion'}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0" />
            {libelleDeSeance(reunion.dateDebut)}
          </span>
          {reunion.lieu && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {reunion.lieu}
            </span>
          )}
          {reunion.participants.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" />
              {reunion.participants.length} participant
              {reunion.participants.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {(reunion.urlVideo || crUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {reunion.urlVideo && (
              <a
                href={reunion.urlVideo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-950/50"
              >
                <Video className="h-3.5 w-3.5" />
                Voir la vidéo
              </a>
            )}
            {crUrl && (
              <a
                href={crUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded border bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" />
                Compte rendu intégral
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </header>

      {points.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ordre du jour
          </h2>
          <ul className="space-y-1.5 text-sm">
            {points.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 opacity-50">•</span>
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groupes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Débat — {reunion.interventions.length} prise
            {reunion.interventions.length > 1 ? 's' : ''} de parole
          </h2>
          <div className="divide-y rounded-lg border bg-card">
            {groupes.map((groupe) => (
              <div key={groupe.cle}>
                {groupe.titre && (
                  <p className="bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {groupe.dossier ? (
                      <>
                        <Link
                          href={`/dossiers/${groupe.dossier.uid}`}
                          title={groupe.dossier.titre}
                          className="align-bottom text-primary hover:underline"
                        >
                          {groupe.dossier.titre}
                        </Link>
                        {groupe.sousTitre && <span> · {groupe.sousTitre}</span>}
                      </>
                    ) : (
                      groupe.titre
                    )}
                  </p>
                )}
                <div className="divide-y">
                  {groupe.interventions.map((i) => (
                    <PriseDeParole key={i.id} intervention={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reunion.avisCommission.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Avis sur les amendements — {reunion.avisCommission.length}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Position de la commission sur les amendements qu&apos;elle a examinés, telle que le
            compte rendu l&apos;imprime.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Place</th>
                  <th className="px-3 py-2 font-medium">Auteur</th>
                  <th className="px-3 py-2 font-medium">Groupe</th>
                  <th className="px-3 py-2 font-medium">Avis</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reunion.avisCommission.map((avis) => (
                  <tr key={avis.id}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">
                      {avis.numero}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {avis.place || '—'}
                    </td>
                    <td className="px-3 py-2">{avis.auteur || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {avis.groupe || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-xs ${
                          COULEUR_DU_SENS[avis.sens] ?? COULEUR_DU_SENS.autre
                        }`}
                      >
                        {avis.position}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {reunion.participants.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Participants
          </h2>
          <div className="flex flex-wrap gap-2">
            {reunion.participants.map(({ parlementaire: p }) => (
              <Link
                key={p.id}
                href={p.chambre === 'senat' ? `/senateurs/${p.slug}` : `/deputes/${p.slug}`}
                className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm transition-colors hover:bg-accent"
              >
                {p.photoUrl ? (
                  <Image
                    src={p.photoUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-muted" />
                )}
                <span className="whitespace-nowrap">
                  {p.prenom} {p.nom}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function PriseDeParole({
  intervention: i,
}: {
  intervention: ReunionDetail['interventions'][number];
}) {
  // Le compte rendu de commission nomme souvent le groupe de l'orateur là où
  // celui de la séance ne le fait pas. On préfère le groupe de la fiche quand
  // on a résolu la personne, et on retombe sur celui qu'annonce le compte rendu.
  const groupe = i.parlementaire?.groupe?.nom ?? i.orateurGroupe;
  const nomAffiche = i.parlementaire
    ? `${i.parlementaire.prenom} ${i.parlementaire.nom}`
    : [i.orateurPrenom, i.orateurNom].filter(Boolean).join(' ') || 'Orateur non identifié';

  return (
    <article className="px-4 py-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {i.parlementaire ? (
          <Link
            href={`/deputes/${i.parlementaire.slug}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {nomAffiche}
          </Link>
        ) : (
          <span className="text-sm font-semibold">{nomAffiche}</span>
        )}
        {groupe && <span className="text-xs text-muted-foreground">{groupe}</span>}
        {/* La qualité dit ce que la personne était ce jour-là : rapporteure,
            présidente, ou la fonction au titre de laquelle elle est auditionnée.
            C'est souvent le seul repère pour une personne extérieure. */}
        {i.orateurQualite && (
          <span className="text-xs italic text-muted-foreground">{i.orateurQualite}</span>
        )}
      </div>
      <ExpandableText
        text={i.contenu}
        hasMore={i.hasMore}
        interventionId={i.id}
        sourceUrl={i.sourceUrl}
        maxLines={6}
      />
    </article>
  );
}
