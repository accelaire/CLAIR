'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Calendar, CheckCircle, XCircle, MinusCircle, Users,
  Tag, ExternalLink, FileText, Info, ChevronDown, ChevronUp
} from 'lucide-react';
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
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  nombreVotants: number;
  importance: number;
  tags: string[];
  texteNumero: string | null;
  texteTitre: string | null;
  sourceUrl: string | null;
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

const typeVoteLabels: Record<string, string> = {
  solennel: 'Vote solennel',
  ordinaire: 'Vote ordinaire',
  motion: 'Motion',
};

export default function ScrutinDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const numero = params.numero as string;
  const chambre = searchParams.get('chambre') || 'assemblee';

  const [expandedPosition, setExpandedPosition] = useState<string | null>('pour');
  const [groupeFilter, setGroupeFilter] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ data: ScrutinDetail }>({
    queryKey: ['scrutin', numero, chambre],
    queryFn: () => api.get(`/scrutins/${numero}`, { params: { chambre } }).then((res) => res.data),
  });

  const getParlementaireRoute = (parlementaire: Vote['parlementaire']) => {
    return parlementaire.chambre === 'senat'
      ? `/senateurs/${parlementaire.slug}`
      : `/deputes/${parlementaire.slug}`;
  };

  const parlementaireLabel = chambre === 'senat' ? 'sénateurs' : 'députés';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
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
  const totalExprime = scrutin.nombrePour + scrutin.nombreContre + scrutin.nombreAbstention;
  const pourPct = totalExprime > 0 ? (scrutin.nombrePour / totalExprime) * 100 : 0;
  const contrePct = totalExprime > 0 ? (scrutin.nombreContre / totalExprime) * 100 : 0;
  const abstPct = totalExprime > 0 ? (scrutin.nombreAbstention / totalExprime) * 100 : 0;
  const isAdopted = scrutin.sort === 'adopte';

  // Filter votes by groupe if selected
  const getFilteredVotes = (position: keyof typeof scrutin.votesByPosition) => {
    const votes = scrutin.votesByPosition[position] || [];
    if (!groupeFilter) return votes;
    return votes.filter(v => v.parlementaire.groupe?.nom === groupeFilter);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Back link */}
      <Link href="/scrutins" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" />
        Tous les scrutins
      </Link>

      {/* Compact Header Card */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        {/* Top row: badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            isAdopted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {isAdopted ? '✓ Adopté' : '✗ Rejeté'}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            scrutin.chambre === 'senat' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {chambreLabels[scrutin.chambre]}
          </span>
          <span className="px-2 py-1 text-xs bg-muted rounded">
            {typeVoteLabels[scrutin.typeVote] || scrutin.typeVote}
          </span>
          {scrutin.importance >= 4 && (
            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
              ★ Important
            </span>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            Scrutin n°{scrutin.numero}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl md:text-2xl font-bold mb-3 leading-tight">{scrutin.titre}</h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(scrutin.date)}
          </span>
          {scrutin.tags && scrutin.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              {scrutin.tags.slice(0, 3).map((t) => (
                <Link
                  key={t}
                  href={`/scrutins?tag=${encodeURIComponent(t)}`}
                  className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20"
                >
                  {t}
                </Link>
              ))}
              {scrutin.tags.length > 3 && (
                <span className="text-xs">+{scrutin.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Texte de loi context if available */}
        {scrutin.texteTitre && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 mb-4 text-sm">
            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">Texte concerné : </span>
              <span className="font-medium">{scrutin.texteTitre}</span>
              {scrutin.texteNumero && (
                <span className="text-muted-foreground"> (n°{scrutin.texteNumero})</span>
              )}
            </div>
          </div>
        )}

        {/* Vote Summary - Compact visual */}
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="relative h-8 rounded-full overflow-hidden bg-gray-200 flex">
            <div
              className="bg-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${pourPct}%` }}
              title={`Pour: ${scrutin.nombrePour} (${pourPct.toFixed(1)}%)`}
            >
              {pourPct > 10 && `${scrutin.nombrePour}`}
            </div>
            <div
              className="bg-amber-400 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${abstPct}%` }}
              title={`Abstention: ${scrutin.nombreAbstention} (${abstPct.toFixed(1)}%)`}
            >
              {abstPct > 10 && `${scrutin.nombreAbstention}`}
            </div>
            <div
              className="bg-red-500 flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${contrePct}%` }}
              title={`Contre: ${scrutin.nombreContre} (${contrePct.toFixed(1)}%)`}
            >
              {contrePct > 10 && `${scrutin.nombreContre}`}
            </div>
          </div>

          {/* Legend with clickable counts */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => setExpandedPosition('pour')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'pour' ? 'bg-green-100' : 'hover:bg-muted'
              }`}
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-600">{scrutin.nombrePour}</span>
              <span className="text-muted-foreground">pour</span>
              <span className="text-xs text-muted-foreground">({pourPct.toFixed(0)}%)</span>
            </button>
            <button
              onClick={() => setExpandedPosition('abstention')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'abstention' ? 'bg-amber-100' : 'hover:bg-muted'
              }`}
            >
              <MinusCircle className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-amber-600">{scrutin.nombreAbstention}</span>
              <span className="text-muted-foreground">abstention</span>
            </button>
            <button
              onClick={() => setExpandedPosition('contre')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'contre' ? 'bg-red-100' : 'hover:bg-muted'
              }`}
            >
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-red-600">{scrutin.nombreContre}</span>
              <span className="text-muted-foreground">contre</span>
              <span className="text-xs text-muted-foreground">({contrePct.toFixed(0)}%)</span>
            </button>
            <button
              onClick={() => setExpandedPosition('absent')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                expandedPosition === 'absent' ? 'bg-gray-200' : 'hover:bg-muted'
              }`}
            >
              <Users className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-500">{scrutin.votesByPosition.absent?.length || 0}</span>
              <span className="text-muted-foreground">non-votants</span>
            </button>
          </div>
        </div>

        {/* External link - only show if sourceUrl exists */}
        {scrutin.sourceUrl && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <a
              href={scrutin.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Voir le scrutin sur {scrutin.chambre === 'senat' ? 'senat.fr' : 'assemblee-nationale.fr'}
            </a>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Votes by groupe */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Par groupe politique</h2>
              {groupeFilter && (
                <button
                  onClick={() => setGroupeFilter(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Voir tous
                </button>
              )}
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {Object.entries(scrutin.votesByGroupe)
                .sort(([, a], [, b]) => (b.pour + b.contre + b.abstention) - (a.pour + a.contre + a.abstention))
                .map(([groupeNom, votes]) => {
                  const total = votes.pour + votes.contre + votes.abstention;
                  const isSelected = groupeFilter === groupeNom;

                  return (
                    <button
                      key={groupeNom}
                      onClick={() => setGroupeFilter(isSelected ? null : groupeNom)}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-medium text-sm truncate pr-2">{groupeNom}</span>
                        <span className="text-xs text-muted-foreground">{total} votes</span>
                      </div>
                      {/* Mini bar chart */}
                      <div className="h-2 rounded-full overflow-hidden bg-gray-100 flex">
                        {total > 0 && (
                          <>
                            <div
                              className="bg-green-500"
                              style={{ width: `${(votes.pour / total) * 100}%` }}
                              title={`Pour: ${votes.pour}`}
                            />
                            <div
                              className="bg-amber-400"
                              style={{ width: `${(votes.abstention / total) * 100}%` }}
                              title={`Abstention: ${votes.abstention}`}
                            />
                            <div
                              className="bg-red-500"
                              style={{ width: `${(votes.contre / total) * 100}%` }}
                              title={`Contre: ${votes.contre}`}
                            />
                          </>
                        )}
                      </div>
                      {/* Numbers */}
                      <div className="flex gap-3 mt-1.5 text-xs">
                        <span className="text-green-600">{votes.pour} pour</span>
                        <span className="text-amber-600">{votes.abstention} abst.</span>
                        <span className="text-red-600">{votes.contre} contre</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right: Vote lists */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  Détail des votes
                  {groupeFilter && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      — {groupeFilter}
                    </span>
                  )}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {scrutin.totalVotes} {parlementaireLabel}
                </span>
              </div>
            </div>

            {/* Position tabs */}
            <div className="border-b">
              {(['pour', 'contre', 'abstention', 'absent'] as const).map((position) => {
                const config = {
                  pour: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Pour' },
                  contre: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Contre' },
                  abstention: { icon: MinusCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Abstention' },
                  absent: { icon: Users, color: 'text-gray-400', bg: 'bg-gray-50', label: 'Non-votant' },
                }[position];
                const Icon = config.icon;
                const count = getFilteredVotes(position).length;
                const isExpanded = expandedPosition === position;

                return (
                  <button
                    key={position}
                    onClick={() => setExpandedPosition(isExpanded ? null : position)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      isExpanded
                        ? `${config.color} border-current`
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    {config.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${isExpanded ? config.bg : 'bg-muted'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Vote list */}
            <div className="max-h-[400px] overflow-y-auto p-2">
              {expandedPosition && (
                <>
                  {getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition).length === 0 ? (
                    <p className="text-muted-foreground text-sm p-4 text-center">
                      {groupeFilter ? `Aucun vote "${expandedPosition}" pour ce groupe` : 'Aucun vote'}
                    </p>
                  ) : (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition)
                        .slice(0, 100)
                        .map((vote) => (
                          <Link
                            key={vote.id}
                            href={getParlementaireRoute(vote.parlementaire)}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                          >
                            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                              {vote.parlementaire.photoUrl ? (
                                <Image
                                  src={vote.parlementaire.photoUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate group-hover:text-primary">
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
                    </div>
                  )}
                  {getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition).length > 100 && (
                    <p className="text-sm text-muted-foreground text-center py-3 border-t mt-2">
                      +{getFilteredVotes(expandedPosition as keyof typeof scrutin.votesByPosition).length - 100} autres {parlementaireLabel}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
