'use client';

// =============================================================================
// Le parcours d'un dossier : où il est passé, et ce qui s'y est décidé
// =============================================================================
//
// La page montrait le résultat — les amendements, les scrutins — jamais le
// chemin. Impossible d'y lire quelle commission avait examiné le texte, quand
// il était venu en séance, ni combien de fois : il fallait le déduire des dates
// de scrutins.
//
// Chaque étape mène à sa page : la réunion ou la séance, avec son débat entier.

import Link from 'next/link';
import { Users, Landmark } from 'lucide-react';
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
  type: 'seance' | 'commission';
  date: string;
  chambre: string | null;
  commission: { slug: string; nom: string } | null;
  nbPrises: number | null;
  nbAvis: number | null;
  scrutins: VoteDEtape[];
}

export function ChronologieDuDossier({ etapes }: { etapes: EtapeDuParcours[] }) {
  if (etapes.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Aucune réunion ni séance n&apos;est rattachée à ce texte pour l&apos;instant.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {etapes.map((etape) => (
        <li key={etape.uid}>
          <Link
            href={`/reunions/${encodeURIComponent(etape.uid)}`}
            className="block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {etape.type === 'commission' ? (
                  <Users className="h-3.5 w-3.5" />
                ) : (
                  <Landmark className="h-3.5 w-3.5" />
                )}
                {etape.type === 'commission' ? 'Commission' : 'Séance publique'}
              </span>
              {etape.chambre && (
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    etape.chambre === 'senat' ? 'badge-senat' : 'badge-assemblee'
                  }`}
                >
                  {etape.chambre === 'senat' ? 'Sénat' : 'AN'}
                </span>
              )}
              {/* Avec l'heure quand la source la donne : l'Assemblée siège deux
                  ou trois fois le même jour, et deux étapes « 24 octobre 2025 »
                  à la suite ne se distinguaient pas. */}
              <span className="text-xs text-muted-foreground">{libelleDeSeance(etape.date)}</span>
            </div>

            <h3 className="mb-1 font-semibold leading-tight">
              {etape.commission?.nom ?? (etape.type === 'commission' ? 'Réunion de commission' : 'Séance publique')}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {etape.nbPrises !== null && etape.nbPrises > 0 && (
                <span>
                  {etape.nbPrises} prise{etape.nbPrises > 1 ? 's' : ''} de parole sur ce texte
                </span>
              )}
              {etape.nbAvis !== null && etape.nbAvis > 0 && (
                <span>
                  {etape.nbAvis} avis sur amendement{etape.nbAvis > 1 ? 's' : ''}
                </span>
              )}
              {etape.scrutins.length > 0 && (
                <span>
                  {etape.scrutins.length} vote{etape.scrutins.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </Link>

          {/* Les votes sous leur étape, hors du lien de la carte : chacun mène
              à son propre scrutin. */}
          {etape.scrutins.length > 0 && (
            <ul className="mt-1 space-y-1 border-l-2 border-muted pl-4">
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
        </li>
      ))}
    </ol>
  );
}
