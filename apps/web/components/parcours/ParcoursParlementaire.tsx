'use client';

// =============================================================================
// Le parcours parlementaire d'un texte ou d'un sujet
// =============================================================================
//
// La page montrait le résultat — les amendements, les scrutins — jamais le
// chemin. Impossible d'y lire quelle commission avait examiné le texte, quand
// il était venu en séance, ni combien de fois : il fallait le déduire des dates
// de scrutins.
//
// Chaque étape mène à sa page : la réunion ou la séance, avec son débat entier.

import { useState } from 'react';
import Link from 'next/link';
import { Users, Landmark, ChevronDown } from 'lucide-react';
import { scrutinHref } from '@/lib/scrutin-url';
import { libelleDeSeance } from '@/lib/debats';

export interface VoteDEtape {
  id: string;
  numero: number;
  titre: string;
  sort: string;
  chambre: string;
  session: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
}

export interface EtapeDuParcours {
  uid: string;
  /** Les textes examinés à cette étape. Vide sur la page d'un dossier. */
  textes?: Array<{ uid: string; titre: string }>;
  type: 'seance' | 'commission';
  date: string;
  chambre: string | null;
  commission: { slug: string; nom: string } | null;
  nbPrises: number | null;
  nbAvis: number | null;
  /**
   * Faux quand nous ne détenons pas la séance que le scrutin nomme.
   *
   * L'API ne pose cette étape que parce qu'un vote la désigne ; 3 524 scrutins
   * de l'Assemblée, dont 3 497 sur la 15e législature, nomment une séance dont
   * nous n'avons ni la réunion ni le compte rendu. L'étape reste affichée — le
   * vote a bien eu lieu ce jour-là — mais sans lien, puisqu'il n'y a rien à
   * ouvrir. Absent d'une réponse servie d'un cache antérieur : on s'abstient
   * alors de lier, ce qui est le sens prudent.
   */
  consultable?: boolean;
  scrutins: VoteDEtape[];
}

export function ParcoursParlementaire({ etapes }: { etapes: EtapeDuParcours[] }) {
  if (etapes.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Aucune réunion ni séance n&apos;est rattachée à ce texte pour l&apos;instant.
      </p>
    );
  }

  return (
    <ol className="divide-y rounded-lg border bg-card">
      {etapes.map((etape) => (
        <li key={etape.uid}>
          <EtapeDuParcoursRendue etape={etape} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Une étape, toujours bâtie pareil.
 *
 * Les grandes cartes pleine largeur donnaient une page interminable pour trois
 * mots par étape : un parcours en compte jusqu'à soixante. D'où ces lignes
 * denses, les votes dépliés dessous.
 *
 * POURQUOI DEUX LIGNES FIXES ET NON UN RETOUR AUTOMATIQUE. Tout tenait d'abord
 * sur une seule ligne qui se repliait au besoin : la largeur des compteurs
 * décidait alors de la mise en page. « 1 351 prises · 74 votes » repoussait le
 * titre à la ligne suivante quand « 92 prises » le laissait à côté de la date,
 * et deux étapes voisines ne se présentaient plus de la même façon. Le repère
 * est donc figé : l'identité de la séance en haut — date, chambre, volume —
 * son objet dessous, les votes à droite.
 */
function EtapeDuParcoursRendue({ etape }: { etape: EtapeDuParcours }) {
  const [ouvert, setOuvert] = useState(false);
  const textes = etape.textes ?? [];
  const consultable = etape.consultable === true;
  // Même gabarit dans les deux cas : seule l'enveloppe change, pour que la
  // ligne garde exactement la même allure qu'elle mène quelque part ou non.
  const Enveloppe = consultable ? Link : 'div';
  const proprietes = consultable
    ? { href: `/reunions/${encodeURIComponent(etape.uid)}`, className: 'group min-w-0 flex-1' }
    : { className: 'min-w-0 flex-1' };

  return (
    <div>
      <div className="flex items-start gap-3 px-3 py-2">
        <Enveloppe {...(proprietes as { href: string; className: string })}>
          <span className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              {etape.type === 'commission' ? (
                <Users className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Landmark className="h-3.5 w-3.5 shrink-0" />
              )}
              {libelleDeSeance(etape.date)}
            </span>
            {etape.chambre && (
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  etape.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
                }`}
              >
                {etape.chambre === 'senat' ? 'Sénat' : 'AN'}
              </span>
            )}
            {etape.nbPrises !== null && etape.nbPrises > 0 && (
              <span className="whitespace-nowrap tabular-nums">
                {etape.nbPrises} prise{etape.nbPrises > 1 ? 's' : ''}
              </span>
            )}
            {etape.nbAvis !== null && etape.nbAvis > 0 && (
              <span className="whitespace-nowrap tabular-nums">
                {etape.nbAvis} avis
              </span>
            )}
          </span>

          <span
            className={`mt-0.5 block truncate text-sm font-medium ${
              consultable ? 'group-hover:text-primary group-hover:underline' : ''
            }`}
          >
            {etape.commission?.nom
              ?? (etape.type === 'commission' ? 'Réunion de commission' : 'Séance publique')}
          </span>

          {textes.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              {textes.map((t) => t.titre).join(' · ')}
            </span>
          )}
        </Enveloppe>

        {etape.scrutins.length > 0 && (
          <button
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
          >
            {etape.scrutins.length} vote{etape.scrutins.length > 1 ? 's' : ''}
            <ChevronDown className={`h-3 w-3 transition-transform ${ouvert ? '' : '-rotate-90'}`} />
          </button>
        )}
      </div>

      {ouvert && etape.scrutins.length > 0 && (
        <ul className="space-y-1 border-t bg-muted/20 px-3 py-2">
          {etape.scrutins.map((scrutin) => (
            <li key={scrutin.id}>
              <Link
                href={scrutinHref(scrutin)}
                className="-mx-1 flex min-w-0 items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-muted/60"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                    scrutin.sort === 'adopte' ? 'badge-adopte' : 'badge-rejete'
                  }`}
                >
                  {scrutin.sort === 'adopte' ? 'Adopté' : 'Rejeté'}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {scrutin.titre}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {scrutin.nombrePour} / {scrutin.nombreContre}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
