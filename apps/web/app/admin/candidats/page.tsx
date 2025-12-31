'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  MoreVertical,
  Trash2,
  Edit,
  Calculator,
  Eye,
} from 'lucide-react';
import { api } from '@/lib/api';

interface Candidat {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  parti: string;
  photoUrl?: string;
  hasDeputeLink: boolean;
  depute?: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
  };
  scores: {
    economie: number;
    social: number;
    ecologie: number;
    securite: number;
    europe: number;
    immigration: number;
    institutions: number;
    international: number;
  };
  scoreType: 'verified' | 'estimated';
  coherenceScore: number;
  ingestionStatus: 'pending' | 'processing' | 'ready' | 'published';
  actif: boolean;
  positionsCount: number;
  logsCount: number;
  createdAt: string;
}

const STATUS_CONFIG = {
  pending: { label: 'En attente', icon: Clock, color: 'text-muted-foreground bg-muted' },
  processing: { label: 'En cours', icon: RefreshCw, color: 'text-blue-600 bg-blue-100' },
  ready: { label: 'Prêt', icon: CheckCircle, color: 'text-amber-600 bg-amber-100' },
  published: { label: 'Publié', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
};

export default function AdminCandidatsPage() {
  const queryClient = useQueryClient();
  const [selectedCandidat, setSelectedCandidat] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ data: Candidat[] }>({
    queryKey: ['admin-candidats'],
    queryFn: () => api.get('/admin/candidats').then((res) => res.data),
  });

  const recalculateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/candidats/${id}/recalculate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidats'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/candidats/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidats'] });
    },
  });

  const recalculateAllMutation = useMutation({
    mutationFn: () => api.post('/admin/candidats/recalculate-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidats'] });
    },
  });

  const candidats = data?.data || [];
  const publishedCount = candidats.filter((c) => c.ingestionStatus === 'published').length;
  const pendingCount = candidats.filter((c) => c.ingestionStatus === 'pending').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Candidats 2027</h1>
          <p className="text-muted-foreground">
            {candidats.length} candidats ({publishedCount} publiés, {pendingCount} en attente)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => recalculateAllMutation.mutate()}
            disabled={recalculateAllMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${recalculateAllMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculer tout
          </button>
          <Link
            href="/admin/candidats/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter un candidat
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{candidats.length}</div>
          <div className="text-sm text-muted-foreground">Total candidats</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-green-600">{publishedCount}</div>
          <div className="text-sm text-muted-foreground">Publiés</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-blue-600">
            {candidats.filter((c) => c.hasDeputeLink).length}
          </div>
          <div className="text-sm text-muted-foreground">Liés à un député</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-amber-600">
            {candidats.filter((c) => c.scoreType === 'verified').length}
          </div>
          <div className="text-sm text-muted-foreground">Scores vérifiés</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Chargement...</div>
        ) : candidats.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Aucun candidat pour le moment</p>
            <Link
              href="/admin/candidats/nouveau"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Ajouter le premier candidat
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium">Candidat</th>
                <th className="text-left p-4 font-medium">Parti</th>
                <th className="text-left p-4 font-medium">Député lié</th>
                <th className="text-center p-4 font-medium">Score</th>
                <th className="text-center p-4 font-medium">Cohérence</th>
                <th className="text-center p-4 font-medium">Statut</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidats.map((candidat) => {
                const status = STATUS_CONFIG[candidat.ingestionStatus];
                const StatusIcon = status.icon;

                return (
                  <tr key={candidat.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {candidat.photoUrl ? (
                            <Image
                              src={candidat.photoUrl}
                              alt={candidat.nom}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {candidat.prenom} {candidat.nom}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {candidat.positionsCount} positions
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">{candidat.parti}</td>
                    <td className="p-4">
                      {candidat.depute ? (
                        <Link
                          href={`/deputes/${candidat.depute.slug}`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {candidat.depute.prenom} {candidat.depute.nom}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">Non lié</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          candidat.scoreType === 'verified'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {candidat.scoreType === 'verified' ? 'Vérifié' : 'Estimé'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`font-medium ${
                          candidat.coherenceScore >= 80
                            ? 'text-green-600'
                            : candidat.coherenceScore >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {candidat.coherenceScore}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/simulateur/candidats/${candidat.slug}`}
                          className="p-2 rounded hover:bg-muted"
                          title="Voir la fiche"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => recalculateMutation.mutate(candidat.id)}
                          disabled={recalculateMutation.isPending}
                          className="p-2 rounded hover:bg-muted"
                          title="Recalculer les scores"
                        >
                          <Calculator className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/admin/candidats/${candidat.id}`}
                          className="p-2 rounded hover:bg-muted"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        {candidat.ingestionStatus === 'ready' && (
                          <button
                            onClick={() => publishMutation.mutate(candidat.id)}
                            disabled={publishMutation.isPending}
                            className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700"
                          >
                            Publier
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
