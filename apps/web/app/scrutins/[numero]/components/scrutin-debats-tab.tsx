'use client';

import { useState } from 'react';
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
  precision?: 'amendement' | 'article' | 'ensemble' | 'motion' | 'fenetre' | 'finances' | null;
  chambre: string;
  interventionsSortAsc: boolean;
  onToggleSort: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Nature affichée, vide pour toutes. */
  typeFiltre: string;
  onTypeChange: (type: string) => void;
  /** Nombre de prises par nature, filtre de nature exclu. */
  parType: Record<string, number>;
}

/**
 * Les natures de prise de parole, dans l'ordre où elles se lisent.
 *
 * Les libellés viennent d'ici et non de la base, qui les écrit sans accent ni
 * espace : « reponse_gouvernement » s'afficherait « Reponse gouvernement ».
 */
const NATURES: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'explication_vote', libelle: 'Explications de vote' },
  { valeur: 'intervention', libelle: 'Interventions' },
  { valeur: 'question', libelle: 'Questions' },
  { valeur: 'reponse_gouvernement', libelle: 'Réponses du Gouvernement' },
];

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
  typeFiltre,
  onTypeChange,
  parType,
}: ScrutinDebatsTabProps) {
  // Seules les natures réellement présentes sont proposées : une option qui ne
  // mène nulle part est pire que pas d'option. Une explication de vote n'existe
  // que sur 965 scrutins sur 18 389.
  const naturesPresentes = NATURES.filter((n) => (parType[n.valeur] ?? 0) > 0);
  // La recherche reste ouverte tant qu'elle porte un terme : la replier
  // effacerait de l'écran la raison pour laquelle la liste est filtrée.
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const totalToutesNatures = Object.values(parType).reduce((n, c) => n + c, 0);

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

      {/* Au Sénat, un texte budgétaire ne se discute pas par articles mais par
          fascicules : un amendement de finances n’a pas de sujet plus fin que
          la partie du budget où il a été appelé. */}
      {rattachement === 'scrutin' && precision === 'finances' && (
        <p className="mb-4 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Voici la discussion de la partie du budget où ce vote est intervenu.
          Le compte rendu ne permet pas de le resserrer davantage.
        </p>
      )}

      {/* LA BARRE TIENT SUR UNE LIGNE, MÊME ÉTROITE. Les trois contrôles côte à
          côte débordaient sous 400 px : le champ de recherche se réduisait à
          rien et le bouton de tri sortait de l'écran. La recherche est donc
          repliée derrière une loupe, et le tri ne garde que sa flèche tant que
          la place manque. */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setRechercheOuverte((ouverte) => !ouverte)}
          aria-expanded={rechercheOuverte}
          aria-label="Chercher dans les débats"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted ${
            searchQuery ? 'border-primary text-primary' : ''
          }`}
        >
          <Search className="h-4 w-4" />
        </button>

        {naturesPresentes.length > 1 && (
          <select
            value={typeFiltre}
            onChange={(e) => onTypeChange(e.target.value)}
            aria-label="Filtrer par nature de prise de parole"
            className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary sm:px-3"
          >
            <option value="">Toutes les prises de parole ({totalToutesNatures})</option>
            {naturesPresentes.map((nature) => (
              <option key={nature.valeur} value={nature.valeur}>
                {nature.libelle} ({parType[nature.valeur]})
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onToggleSort}
          title={interventionsSortAsc ? 'Plus anciens d\u2019abord' : 'Plus récents d\u2019abord'}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:px-3"
        >
          <span className="hidden whitespace-nowrap sm:inline">
            {interventionsSortAsc ? 'Plus anciens d\u2019abord' : 'Plus récents d\u2019abord'}
          </span>
          <ArrowDown className={`h-4 w-4 transition-transform ${interventionsSortAsc ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {rechercheOuverte && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Chercher dans les débats"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

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
