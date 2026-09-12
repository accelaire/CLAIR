'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Users, ExternalLink, ArrowDown, Loader2, Search,
} from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { grouperParSujet } from '@/lib/debats';

interface InterventionScrutin {
  id: string;
  type: string;
  contenu: string;
  hasMore?: boolean;
  date: string;
  ordre: number | null;
  sourceUrl: string | null;
  orateurNom: string | null;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  articleVise: string | null;
  amendementsVises: string[] | null;
  texteNumero: string | null;
  parlementaire: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    groupe: {
      nom: string;
      couleur: string | null;
    } | null;
  } | null;
}

interface ScrutinDebatsTabProps {
  interventions: InterventionScrutin[];
  /** D'où vient cette sélection : du vote lui-même, ou de sa seule journée. */
  rattachement?: 'scrutin' | 'journee';
  /** À quelle finesse le débat a été reconnu, quand il l'a été. */
  precision?: 'amendement' | 'article' | 'fenetre' | null;
  chambre: string;
  interventionsSortAsc: boolean;
  onToggleSort: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ScrutinDebatsTab({
  interventions,
  rattachement,
  precision,
  chambre,
  interventionsSortAsc,
  onToggleSort,
  hasNextPage,
  isFetchingNextPage,
  loadMoreRef,
  searchQuery,
  onSearchChange,
}: ScrutinDebatsTabProps) {
  return (
    <div>
      {/* Une journée de séance porte souvent plusieurs dizaines de scrutins.
          Quand le compte rendu ne permet pas de savoir lequel ce débat a
          précédé, on montre la journée entière — et on le dit, plutôt que de
          laisser croire que ces prises de parole portent sur ce vote. */}
      {rattachement === 'journee' && (
        <p className="mb-4 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Ce vote n’a pas pu être relié à un moment précis du compte rendu :
          voici les débats de la journée, qui peuvent porter sur d’autres textes.
        </p>
      )}

      {/* Un vote sur l’ensemble d’un texte, ou sur un amendement que le compte
          rendu ne nomme jamais, n’a pas de sujet plus fin que le texte : on
          montre alors tout ce qui s’est dit avant lui sur ce texte. */}
      {rattachement === 'scrutin' && precision === 'fenetre' && (
        <p className="mb-4 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Voici le débat qui a précédé ce vote sur ce texte. Le compte rendu ne
          permet pas de le resserrer davantage.
        </p>
      )}

      {/* Search + sort controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Chercher dans les débats"
            className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={onToggleSort}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground border rounded-lg hover:bg-muted transition-colors whitespace-nowrap"
        >
          {interventionsSortAsc ? 'Plus anciens d\u2019abord' : 'Plus récents d\u2019abord'}
          <ArrowDown className={`h-4 w-4 transition-transform ${interventionsSortAsc ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Interventions list */}
      <div className="space-y-5 max-h-[600px] overflow-y-auto pr-2">
        {interventions.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {searchQuery.trim()
              ? <>Aucun résultat pour &quot;{searchQuery}&quot;</>
              : 'Aucune intervention'}
          </p>
        ) : (
          grouperParSujet(interventions).map((groupe) => (
            <div key={groupe.cle} className="space-y-5">
              {/* L’intertitre dit sur quoi porte le passage qu’on lit. Absent
                  quand le compte rendu ne situe pas la prise de parole : mieux
                  vaut ne rien annoncer que d’annoncer à tort. */}
              {groupe.titre && (
                <h4 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {groupe.titre}
                </h4>
              )}
              {groupe.interventions.map((intervention) => {
            const p = intervention.parlementaire;
            const displayNom = p ? `${p.prenom} ${p.nom}` : `${intervention.orateurPrenom || ''} ${intervention.orateurNom || ''}`.trim();
            const profileHref = p ? (chambre === 'senat' ? `/senateurs/${p.slug}` : `/deputes/${p.slug}`) : null;

            return (
              <div key={intervention.id} className="flex items-start gap-3">
                {/* Avatar */}
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted"
                  >
                    {p?.photoUrl ? (
                      <Image
                        src={p.photoUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                    )}
                  </Link>
                ) : (
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                    <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {displayNom}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">
                        {displayNom}
                      </span>
                    )}
                    {p?.groupe ? (
                      <span
                        className="px-2 py-0.5 text-xs rounded-full text-white font-medium"
                        style={{ backgroundColor: p.groupe.couleur || '#888' }}
                      >
                        {p.groupe.nom}
                      </span>
                    ) : intervention.orateurQualite ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground font-medium">
                        {intervention.orateurQualite}
                      </span>
                    ) : null}
                  </div>
                  <div className="rounded-lg p-3 bg-muted/50">
                    <ExpandableText
                      text={intervention.contenu}
                      hasMore={intervention.hasMore}
                      interventionId={intervention.id}
                      sourceUrl={intervention.sourceUrl}
                    />
                  </div>
                </div>
              </div>
            );
              })}
            </div>
          ))
        )}

        {/* Infinite scroll trigger */}
        <div ref={loadMoreRef} className="flex justify-center py-2">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          )}
          {!hasNextPage && interventions.length > 0 && interventions.length >= 10 && (
            <p className="text-xs text-muted-foreground">
              Toutes les interventions ont été chargées
            </p>
          )}
        </div>
      </div>

      {/* Source link global */}
      {interventions.some(i => i.sourceUrl) && (
        <div className="mt-4 pt-4 flex justify-start">
          <a
            href={(() => {
              const url = interventions.find(i => i.sourceUrl)?.sourceUrl || '';
              // Retirer l'ancre #par_N pour le lien global
              return url.replace(/#par_\d+$/, '');
            })()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Voir le compte-rendu intégral
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
