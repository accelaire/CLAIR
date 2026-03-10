'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Calendar, Users, Briefcase, Globe, TrendingUp, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useUrlDateRange } from '@/hooks/useUrlFilters';
import { LobbyisteLogo } from '@/components/lobbying';

interface Action {
  id: string;
  description: string;
  cible: string | null;
  cibleNom: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  texteVise: string | null;
  texteViseNom: string | null;
  depute: {
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

interface LobbyisteDetail {
  id: string;
  siren: string | null;
  nom: string;
  type: string | null;
  secteur: string | null;
  budgetAnnuel: number | null;
  nbLobbyistes: number | null;
  adresse: string | null;
  ville: string | null;
  siteWeb: string | null;
  actions: Action[];
}

const typeLabels: Record<string, string> = {
  entreprise: 'Entreprise',
  association: 'Association',
  cabinet: 'Cabinet de conseil',
  syndicat: 'Syndicat',
  organisation_pro: 'Organisation professionnelle',
};

const formatBudget = (budget: number | null): string => {
  if (!budget) return 'Non déclaré';
  if (budget >= 1000000) return `${(budget / 1000000).toFixed(1)} M€`;
  if (budget >= 1000) return `${(budget / 1000).toFixed(0)} k€`;
  return `${budget} €`;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Extraire le secteur entre crochets de la description
const extractSecteur = (description: string): { secteur: string | null; cleanDescription: string } => {
  const match = description.match(/^\[([^\]]+)\]\s*/);
  if (match) {
    return {
      secteur: match[1],
      cleanDescription: description.replace(match[0], ''),
    };
  }
  return { secteur: null, cleanDescription: description };
};

// Couleurs pour les secteurs (basées sur un hash simple du nom)
const secteurColorClasses = [
  'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
];

const getSecteurColor = (secteur: string): string => {
  let hash = 0;
  for (let i = 0; i < secteur.length; i++) {
    hash = secteur.charCodeAt(i) + ((hash << 5) - hash);
  }
  return secteurColorClasses[Math.abs(hash) % secteurColorClasses.length];
};

const cibleLabels: Record<string, string> = {
  parlementaire: 'Parlement',
  depute: 'Parlement',
  ministre: 'Gouvernement',
  presidence: 'Présidence',
  collectivite: 'Collectivités',
  autorite: 'AAI/API',
  administration: 'Administration',
};

export default function LobbyisteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [dateRange, setDateRange] = useUrlDateRange();

  const { data, isLoading, error } = useQuery<{ data: LobbyisteDetail }>({
    queryKey: ['lobbyiste', id],
    queryFn: () => api.get(`/lobbying/${id}`).then((res) => res.data),
  });

  // Filtrer les actions par période
  const filteredActions = useMemo(() => {
    if (!data?.data.actions) return [];

    return data.data.actions.filter((action) => {
      if (!dateRange.from && !dateRange.to) return true;

      const actionDate = action.dateDebut ? new Date(action.dateDebut) : null;
      if (!actionDate) return true; // Inclure les actions sans date

      if (dateRange.from && actionDate < dateRange.from) return false;
      if (dateRange.to && actionDate > dateRange.to) return false;

      return true;
    });
  }, [data?.data.actions, dateRange.from, dateRange.to]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-12 w-3/4 rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Lobbyiste non trouvé.
        </div>
      </div>
    );
  }

  const lobbyiste = data.data;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 min-w-0">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link href="/lobbying" className="hover:text-foreground transition-colors flex-shrink-0">Lobbying</Link>
        <span className="flex-shrink-0">/</span>
        <span className="text-foreground font-medium truncate">{lobbyiste.nom}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <LobbyisteLogo siteWeb={lobbyiste.siteWeb} nom={lobbyiste.nom} size="lg" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{lobbyiste.nom}</h1>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              {lobbyiste.type && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-sm">
                  {typeLabels[lobbyiste.type] || lobbyiste.type}
                </span>
              )}
              {lobbyiste.secteur && (
                <span className="text-sm">{lobbyiste.secteur}</span>
              )}
              {lobbyiste.siren && (
                <span className="text-sm font-mono">SIREN: {lobbyiste.siren}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional info */}
      {(lobbyiste.adresse || lobbyiste.siteWeb) && (
        <div className="rounded-lg border bg-card p-4 mb-8">
          <h2 className="text-lg font-semibold mb-3">Informations</h2>
          <div className="space-y-2 text-sm">
            {lobbyiste.adresse && (
              <p className="text-muted-foreground">
                <strong>Adresse :</strong> {lobbyiste.adresse}
              </p>
            )}
            {lobbyiste.siteWeb && (
              <p className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={lobbyiste.siteWeb.startsWith('http') ? lobbyiste.siteWeb : `https://${lobbyiste.siteWeb}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {lobbyiste.siteWeb}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Budget annuel</span>
          </div>
          <p className="text-xl font-bold">{formatBudget(lobbyiste.budgetAnnuel)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Lobbyistes déclarés</span>
          </div>
          <p className="text-xl font-bold">{lobbyiste.nbLobbyistes ? lobbyiste.nbLobbyistes.toLocaleString('fr-FR') : 'Non déclaré'}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Briefcase className="h-4 w-4" />
            <span className="text-sm">Actions déclarées</span>
          </div>
          <p className="text-xl font-bold">{lobbyiste.actions.length.toLocaleString('fr-FR')}</p>
        </div>
        {lobbyiste.ville && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Ville</span>
            </div>
            <p className="text-xl font-bold">{lobbyiste.ville}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Actions de lobbying ({filteredActions.length.toLocaleString('fr-FR')}{filteredActions.length !== lobbyiste.actions.length ? ` / ${lobbyiste.actions.length.toLocaleString('fr-FR')}` : ''})
          </h2>
        </div>

        {/* Filtre par période */}
        <div className="mb-6">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Filtrer par période"
          />
        </div>

        {filteredActions.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
            {lobbyiste.actions.length === 0
              ? 'Aucune action de lobbying déclarée.'
              : 'Aucune action trouvée pour cette période.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActions.map((action) => {
              const { secteur, cleanDescription } = extractSecteur(action.description || '');

              return (
              <div key={action.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3">
                  {/* Tags: Secteur + Cible type + Date */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {secteur && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSecteurColor(secteur)}`}>
                        {secteur}
                      </span>
                    )}
                    {action.cible && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs">
                        {cibleLabels[action.cible] || action.cible}
                      </span>
                    )}
                    {action.dateDebut && (
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Calendar className="h-3 w-3" />
                        {formatDate(action.dateDebut)}
                      </span>
                    )}
                  </div>

                  {/* Description (nettoyée du secteur) */}
                  <p className="font-medium">{cleanDescription || 'Objet non précisé'}</p>

                  {/* Texte visé */}
                  {action.texteViseNom && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Texte visé :</strong> {action.texteViseNom}
                    </p>
                  )}

                  {/* Cible details */}
                  {action.cibleNom && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Cible :</strong> {action.cibleNom}
                    </p>
                  )}

                  {/* Linked depute if any */}
                  {action.depute && (
                    <Link
                      href={`/deputes/${action.depute.slug}`}
                      className="inline-flex items-center gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition-colors w-fit"
                    >
                      <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                        {action.depute.photoUrl ? (
                          <Image
                            src={action.depute.photoUrl}
                            alt={`${action.depute.prenom} ${action.depute.nom}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {action.depute.prenom} {action.depute.nom}
                        </p>
                        {action.depute.groupe && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: action.depute.groupe.couleur || '#888' }}
                            />
                            {action.depute.groupe.nom}
                          </p>
                        )}
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
