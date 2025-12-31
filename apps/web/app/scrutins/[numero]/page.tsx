'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle, XCircle, MinusCircle, Users, Tag, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface Vote {
  id: string;
  position: 'pour' | 'contre' | 'abstention' | 'absent';
  parlementaire: {
    id: string;
    slug: string;
    chambre: string;
    nom: string;
    prenom: string;
    photoUrl: string | null;
    groupe: {
      slug: string;
      nom: string;
      couleur: string | null;
    } | null;
  };
}

interface ScrutinDetail {
  id: string;
  numero: number;
  chambre: string;
  date: string;
  titre: string;
  sort: string;
  typeVote: string;
  pour: number;
  contre: number;
  abstention: number;
  importance: number;
  tags: string[];
  urlAN: string | null;
  votesByPosition: {
    pour: Vote[];
    contre: Vote[];
    abstention: Vote[];
    absent: Vote[];
  };
  votesByGroupe: Record<string, { pour: number; contre: number; abstention: number; absent: number }>;
  totalVotes: number;
}

const chambreLabels: Record<string, string> = {
  assemblee: 'Assemblée nationale',
  senat: 'Sénat',
};

const sortLabels: Record<string, { label: string; color: string }> = {
  adopte: { label: 'Adopté', color: 'text-green-600 bg-green-100' },
  rejete: { label: 'Rejeté', color: 'text-red-600 bg-red-100' },
};

const positionIcons = {
  pour: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Pour' },
  contre: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Contre' },
  abstention: { icon: MinusCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Abstention' },
  absent: { icon: Users, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Non-votant' },
};

export default function ScrutinDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const numero = params.numero as string;
  const chambre = searchParams.get('chambre') || 'assemblee';

  const { data, isLoading, error } = useQuery<{ data: ScrutinDetail }>({
    queryKey: ['scrutin', numero, chambre],
    queryFn: () => api.get(`/scrutins/${numero}`, { params: { chambre } }).then((res) => res.data),
  });

  // Helper to get the correct route based on chambre
  const getParlementaireRoute = (parlementaire: Vote['parlementaire']) => {
    return parlementaire.chambre === 'senat'
      ? `/senateurs/${parlementaire.slug}`
      : `/deputes/${parlementaire.slug}`;
  };

  const parlementaireLabel = chambre === 'senat' ? 'sénateurs' : 'députés';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-12 w-3/4 rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
          Scrutin non trouvé.
        </div>
      </div>
    );
  }

  const scrutin = data.data;
  const total = scrutin.pour + scrutin.contre + scrutin.abstention;
  const pourPct = total > 0 ? (scrutin.pour / total) * 100 : 0;
  const contrePct = total > 0 ? (scrutin.contre / total) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/scrutins" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour aux scrutins
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Scrutin n°{scrutin.numero}
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {chambreLabels[scrutin.chambre] || 'Assemblée nationale'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${sortLabels[scrutin.sort]?.color || 'bg-muted text-muted-foreground'}`}>
            {sortLabels[scrutin.sort]?.label || scrutin.sort}
          </span>
          {scrutin.importance >= 4 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
              Vote important
            </span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-4">{scrutin.titre}</h1>

        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(scrutin.date)}
          </span>
          <span className="px-2 py-0.5 bg-muted rounded text-sm">
            {scrutin.typeVote}
          </span>
          {scrutin.tags && scrutin.tags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {scrutin.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-sm">
                  {t}
                </span>
              ))}
            </div>
          )}
          {scrutin.urlAN && (
            <a
              href={scrutin.urlAN}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {scrutin.chambre === 'senat' ? 'Voir sur senat.fr' : 'Voir sur assemblee-nationale.fr'}
            </a>
          )}
        </div>
      </div>

      {/* Vote summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {(['pour', 'contre', 'abstention', 'absent'] as const).map((position) => {
          const config = positionIcons[position];
          const Icon = config.icon;
          const count = scrutin.votesByPosition[position]?.length || 0;

          return (
            <div key={position} className={`rounded-lg border p-4 ${config.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  <span className="font-medium">{config.label}</span>
                </div>
                <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-8 p-4 rounded-lg border bg-card">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-green-600 font-medium">{scrutin.pour} pour ({pourPct.toFixed(1)}%)</span>
          <span className="text-red-600 font-medium">{scrutin.contre} contre ({contrePct.toFixed(1)}%)</span>
        </div>
        <div className="h-4 rounded-full bg-muted overflow-hidden flex">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${pourPct}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${contrePct}%` }}
          />
        </div>
      </div>

      {/* Votes by groupe */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Votes par groupe politique</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Groupe</th>
                <th className="px-4 py-3 text-center font-medium text-green-600">Pour</th>
                <th className="px-4 py-3 text-center font-medium text-red-600">Contre</th>
                <th className="px-4 py-3 text-center font-medium text-amber-600">Abstention</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(scrutin.votesByGroupe)
                .sort(([, a], [, b]) => (b.pour + b.contre + b.abstention) - (a.pour + a.contre + a.abstention))
                .map(([groupeNom, votes]) => (
                  <tr key={groupeNom} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{groupeNom}</td>
                    <td className="px-4 py-3 text-center text-green-600">{votes.pour || '-'}</td>
                    <td className="px-4 py-3 text-center text-red-600">{votes.contre || '-'}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{votes.abstention || '-'}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{votes.absent || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed votes by position */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Détail des votes ({scrutin.totalVotes} {parlementaireLabel})</h2>

        <div className="grid gap-6 lg:grid-cols-2">
          {(['pour', 'contre'] as const).map((position) => {
            const config = positionIcons[position];
            const Icon = config.icon;
            const votes = scrutin.votesByPosition[position] || [];

            return (
              <div key={position} className="rounded-lg border">
                <div className={`px-4 py-3 border-b ${config.bg} flex items-center gap-2`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  <span className="font-semibold">{config.label} ({votes.length})</span>
                </div>
                <div className="max-h-96 overflow-y-auto p-2">
                  {votes.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-2">Aucun vote</p>
                  ) : (
                    <div className="grid gap-1">
                      {votes.slice(0, 50).map((vote) => (
                        <Link
                          key={vote.id}
                          href={getParlementaireRoute(vote.parlementaire)}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                        >
                          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                            {vote.parlementaire.photoUrl ? (
                              <Image
                                src={vote.parlementaire.photoUrl}
                                alt={`${vote.parlementaire.prenom} ${vote.parlementaire.nom}`}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {vote.parlementaire.prenom} {vote.parlementaire.nom}
                            </p>
                            {vote.parlementaire.groupe && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <span
                                  className="h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: vote.parlementaire.groupe.couleur || '#888' }}
                                />
                                {vote.parlementaire.groupe.nom}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                      {votes.length > 50 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          +{votes.length - 50} autres {parlementaireLabel}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
