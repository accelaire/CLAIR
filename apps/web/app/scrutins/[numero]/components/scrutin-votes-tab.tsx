'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, XCircle, MinusCircle, Users } from 'lucide-react';

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

interface ScrutinVotesTabProps {
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  votesByPosition: {
    pour: Vote[];
    contre: Vote[];
    abstention: Vote[];
    absent: Vote[];
  };
  votesByGroupe: Record<string, { pour: number; contre: number; abstention: number; absent: number }>;
  totalVotes: number;
  chambre: string;
}

export function ScrutinVotesTab({
  nombrePour,
  nombreContre,
  nombreAbstention,
  votesByPosition,
  votesByGroupe,
  totalVotes,
  chambre,
}: ScrutinVotesTabProps) {
  const [expandedPosition, setExpandedPosition] = useState<string | null>('pour');
  const [groupeFilter, setGroupeFilter] = useState<string | null>(null);

  const totalExprime = nombrePour + nombreContre + nombreAbstention;
  const pourPct = totalExprime > 0 ? (nombrePour / totalExprime) * 100 : 0;
  const contrePct = totalExprime > 0 ? (nombreContre / totalExprime) * 100 : 0;
  const abstPct = totalExprime > 0 ? (nombreAbstention / totalExprime) * 100 : 0;

  const parlementaireLabel = chambre === 'senat' ? 'sénateurs' : 'députés';

  const getParlementaireRoute = (parlementaire: Vote['parlementaire']) => {
    return parlementaire.chambre === 'senat'
      ? `/senateurs/${parlementaire.slug}`
      : `/deputes/${parlementaire.slug}`;
  };

  const getFilteredVotes = (position: keyof typeof votesByPosition) => {
    const votes = votesByPosition[position] || [];
    if (!groupeFilter) return votes;
    return votes.filter(v => v.parlementaire.groupe?.nom === groupeFilter);
  };

  return (
    <div className="space-y-6">
      {/* Vote bar */}
      <div className="space-y-3">
        <div className="relative h-8 rounded-full overflow-hidden bg-gray-200 flex">
          <div
            className="bg-green-500 flex items-center justify-center text-white text-xs font-bold transition-all"
            style={{ width: `${pourPct}%` }}
            title={`Pour: ${nombrePour} (${pourPct.toFixed(1)}%)`}
          >
            {pourPct > 10 && `${nombrePour}`}
          </div>
          <div
            className="bg-amber-400 flex items-center justify-center text-white text-xs font-bold transition-all"
            style={{ width: `${abstPct}%` }}
            title={`Abstention: ${nombreAbstention} (${abstPct.toFixed(1)}%)`}
          >
            {abstPct > 10 && `${nombreAbstention}`}
          </div>
          <div
            className="bg-red-500 flex items-center justify-center text-white text-xs font-bold transition-all"
            style={{ width: `${contrePct}%` }}
            title={`Contre: ${nombreContre} (${contrePct.toFixed(1)}%)`}
          >
            {contrePct > 10 && `${nombreContre}`}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <button
            onClick={() => setExpandedPosition('pour')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
              expandedPosition === 'pour' ? 'bg-green-100' : 'hover:bg-muted'
            }`}
          >
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-600">{nombrePour}</span>
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
            <span className="font-semibold text-amber-600">{nombreAbstention}</span>
            <span className="text-muted-foreground">abstention</span>
          </button>
          <button
            onClick={() => setExpandedPosition('contre')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
              expandedPosition === 'contre' ? 'bg-red-100' : 'hover:bg-muted'
            }`}
          >
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="font-semibold text-red-600">{nombreContre}</span>
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
            <span className="font-semibold text-gray-500">{votesByPosition.absent?.length || 0}</span>
            <span className="text-muted-foreground">non-votants</span>
          </button>
        </div>
      </div>

      {/* Two-column: groupes + detail */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Groupes */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Par groupe politique</h3>
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
              {Object.entries(votesByGroupe)
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
                      <div className="h-2 rounded-full overflow-hidden bg-gray-100 flex">
                        {total > 0 && (
                          <>
                            <div className="bg-green-500" style={{ width: `${(votes.pour / total) * 100}%` }} />
                            <div className="bg-amber-400" style={{ width: `${(votes.abstention / total) * 100}%` }} />
                            <div className="bg-red-500" style={{ width: `${(votes.contre / total) * 100}%` }} />
                          </>
                        )}
                      </div>
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

        {/* Vote detail */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border bg-card">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Détail des votes
                  {groupeFilter && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      — {groupeFilter}
                    </span>
                  )}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {totalVotes} {parlementaireLabel}
                </span>
              </div>
            </div>

            {/* Position tabs — hide positions with 0 votes */}
            <div className="border-b flex flex-wrap">
              {(['pour', 'contre', 'abstention', 'absent'] as const)
                .filter((position) => getFilteredVotes(position).length > 0)
                .map((position) => {
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
                  {getFilteredVotes(expandedPosition as keyof typeof votesByPosition).length === 0 ? (
                    <p className="text-muted-foreground text-sm p-4 text-center">
                      {groupeFilter ? `Aucun vote "${expandedPosition}" pour ce groupe` : 'Aucun vote'}
                    </p>
                  ) : (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {getFilteredVotes(expandedPosition as keyof typeof votesByPosition)
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
                                  unoptimized
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
