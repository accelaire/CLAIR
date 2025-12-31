'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, Calendar, Users, Briefcase, Globe, TrendingUp, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

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

export default function LobbyisteDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, error } = useQuery<{ data: LobbyisteDetail }>({
    queryKey: ['lobbyiste', id],
    queryFn: () => api.get(`/lobbying/${id}`).then((res) => res.data),
  });

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
      {/* Back link */}
      <Link href="/lobbying" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux lobbyistes
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-muted">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
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
          <p className="text-xl font-bold">{lobbyiste.nbLobbyistes || 'Non déclaré'}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Briefcase className="h-4 w-4" />
            <span className="text-sm">Actions déclarées</span>
          </div>
          <p className="text-xl font-bold">{lobbyiste.actions.length}</p>
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

      {/* Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          Actions de lobbying ({lobbyiste.actions.length})
        </h2>

        {lobbyiste.actions.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
            Aucune action de lobbying déclarée.
          </div>
        ) : (
          <div className="space-y-3">
            {lobbyiste.actions.map((action) => (
              <div key={action.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3">
                  {/* Description */}
                  <p className="font-medium">{action.description || 'Objet non précisé'}</p>

                  {/* Metadata tags */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {action.cible && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        {action.cible === 'depute' ? 'Parlement' :
                         action.cible === 'ministre' ? 'Gouvernement' :
                         action.cible === 'presidence' ? 'Présidence' :
                         action.cible === 'collectivite' ? 'Collectivités' :
                         action.cible === 'autorite' ? 'AAI/API' :
                         'Administration'}
                      </span>
                    )}
                    {action.texteViseNom && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                        {action.texteViseNom.length > 50
                          ? action.texteViseNom.substring(0, 50) + '...'
                          : action.texteViseNom}
                      </span>
                    )}
                    {action.dateDebut && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(action.dateDebut)}
                      </span>
                    )}
                  </div>

                  {/* Cible details */}
                  {action.cibleNom && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Cible :</strong> {action.cibleNom.length > 100
                        ? action.cibleNom.substring(0, 100) + '...'
                        : action.cibleNom}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
