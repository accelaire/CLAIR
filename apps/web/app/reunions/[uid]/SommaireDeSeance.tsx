'use client';

// =============================================================================
// Le sommaire d'une séance : ce qu'elle a examiné, ce qu'elle a voté
// =============================================================================
//
// POURQUOI. Une séance publique n'a pas d'ordre du jour en base — la colonne
// est vide sur les 926 séances de l'Assemblée. Il est dans le compte rendu,
// dispersé au fil de 1 600 prises de parole : la présidence annonce un point au
// micro, et le suivant arrive deux cents paragraphes plus loin. Sans index, la
// page ouvre sur un mur de texte qui ne dit ni ce que la journée a traité, ni
// ce qu'elle a voté.
//
// CE QUE ÇA DONNE. Un point par annonce, dans l'ordre, dépliable sur ses votes.
// Le débat complet reste dessous, inchangé : le sommaire y mène, il ne le
// remplace pas.
//
// AU SÉNAT, C'EST L'INVERSE. Son compte rendu ne porte pas ces annonces, et
// aucune de ses prises de parole ne nomme le texte discuté. Ce qu'on sait de sa
// journée vient des scrutins : le sommaire s'y réduit donc aux textes mis aux
// voix — ce qui est déjà tout ce que la carte de l'agenda montrait.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { scrutinHref } from '@/lib/scrutin-url';
import { formatDossierTitre } from '@/lib/dossiers';
import type { ScrutinDeSeance } from './DebatDeReunion';

export interface DossierDuSommaire {
  id: string;
  uid: string;
  titre: string;
  procedureLibelle: string | null;
}

export interface EntreeDuSommaire {
  cle: string;
  source: 'annonce' | 'dossier' | 'autres';
  titre: string;
  ordre: number | null;
  dossiers: DossierDuSommaire[];
  /** Le nombre de prises de parole du passage, ou `null` quand on l'ignore. */
  nbPrises: number | null;
  scrutins: ScrutinDeSeance[];
}

export function SommaireDeSeance({
  entrees,
  votesDuJour,
}: {
  entrees: EntreeDuSommaire[];
  /** Le Sénat ne rattache ses scrutins qu'à une journée, pas à une séance. */
  votesDuJour: boolean;
}) {
  if (entrees.length === 0) return null;

  // Le titre dit d'où vient le découpage. Annoncé par la présidence, c'est
  // l'ordre du jour de la séance ; reconstitué texte par texte, ce n'en est
  // pas un et on ne le présente pas comme tel.
  const annonce = entrees.some((entree) => entree.source === 'annonce');

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {annonce ? 'Ordre du jour' : 'Textes examinés'}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {annonce
          ? 'Les points tels que la présidence les a appelés en séance. Dépliez-en un pour voir ce qui y a été voté.'
          : 'Les textes mis aux voix ce jour-là. Dépliez-en un pour voir ses votes.'}
        {votesDuJour && (
          <>
            {' '}
            Le compte rendu ne nomme pas la séance à laquelle chaque scrutin se rattache : ceux-ci
            sont les votes de la journée.
          </>
        )}
      </p>

      <div className="divide-y rounded-lg border bg-card">
        {entrees.map((entree) => (
          <PointDuSommaire key={entree.cle} entree={entree} />
        ))}
      </div>
    </section>
  );
}

function PointDuSommaire({ entree }: { entree: EntreeDuSommaire }) {
  const [ouvert, setOuvert] = useState(false);
  const depliable = entree.scrutins.length > 0 || entree.dossiers.length > 0;

  const titre =
    entree.source === 'dossier' && entree.dossiers[0]
      ? formatDossierTitre(entree.dossiers[0].titre, entree.dossiers[0].procedureLibelle)
      : entree.titre;

  const entete = (
    <>
      <span className="min-w-0 flex-1 text-sm">{titre}</span>
      <span className="flex shrink-0 items-center gap-2">
        {entree.scrutins.length > 0 && (
          <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300">
            {entree.scrutins.length} vote{entree.scrutins.length > 1 ? 's' : ''}
          </span>
        )}
        {entree.nbPrises !== null && entree.nbPrises > 0 && (
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {entree.nbPrises} prise{entree.nbPrises > 1 ? 's' : ''} de parole
          </span>
        )}
      </span>
    </>
  );

  if (!depliable) {
    return (
      <div className="flex items-start gap-3 px-4 py-2.5">
        {/* La place du chevron, laissée vide : sans elle, un point sans vote
            démarrerait 28 px à gauche de ses voisins. */}
        <span className="h-4 w-4 shrink-0" aria-hidden />
        {entete}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOuvert((etat) => !etat)}
        aria-expanded={ouvert}
        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        {ouvert ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {entete}
      </button>

      {ouvert && (
        <div className="space-y-2 border-t bg-muted/20 px-4 py-3 pl-11">
          {/* Le texte d'abord : un point de l'ordre du jour ne le nomme pas
              toujours, et c'est lui qui mène au dossier complet. */}
          {entree.dossiers.length > 0 && entree.source !== 'dossier' && (
            <ul className="space-y-1">
              {entree.dossiers.map((dossier) => (
                <li key={dossier.id}>
                  <Link
                    href={`/dossiers/${dossier.uid}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {formatDossierTitre(dossier.titre, dossier.procedureLibelle)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {entree.source === 'dossier' && entree.dossiers[0] && (
            <Link
              href={`/dossiers/${entree.dossiers[0].uid}`}
              className="block text-xs font-medium text-primary hover:underline"
            >
              Voir le dossier législatif
            </Link>
          )}

          {entree.scrutins.map((scrutin) => (
            <LigneDeVote key={scrutin.id} scrutin={scrutin} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Un vote du sommaire, dans la forme de la carte d'agenda : verdict, objet,
 * et les voix pour et contre — « adopté par 84 voix contre 79 » et « adopté par
 * 400 voix contre 12 » ne racontent pas la même séance.
 */
function LigneDeVote({ scrutin }: { scrutin: ScrutinDeSeance }) {
  const adopte = scrutin.sort === 'adopte';
  return (
    <Link
      href={scrutinHref(scrutin)}
      className="-mx-1 flex min-w-0 items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-muted/60"
    >
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
          adopte ? 'badge-adopte' : 'badge-rejete'
        }`}
      >
        {adopte ? 'Adopté' : 'Rejeté'}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{scrutin.titre}</span>
      <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        {scrutin.nombrePour} / {scrutin.nombreContre}
      </span>
    </Link>
  );
}
