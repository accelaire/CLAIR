'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useState } from 'react';

interface Position {
  id: string;
  axe: string;
  sujet: string;
  position: string;
  score: number;
  sourceType: string;
  sourceUrl?: string;
  coherent: boolean;
  explication?: string;
  candidat: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    parti: string;
  };
}

interface ValidationData {
  incoherentPositions: Position[];
  pendingValidation: any[];
  counts: {
    incoherent: number;
    pending: number;
  };
}

const AXES_LABELS: Record<string, string> = {
  economie: 'Économie',
  social: 'Social',
  ecologie: 'Écologie',
  securite: 'Sécurité',
  europe: 'Europe',
  immigration: 'Immigration',
  institutions: 'Institutions',
  international: 'International',
};

export default function ValidationPage() {
  const queryClient = useQueryClient();
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [explication, setExplication] = useState('');

  const { data, isLoading } = useQuery<{ data: ValidationData }>({
    queryKey: ['admin-validation-queue'],
    queryFn: () => api.get('/admin/validation-queue').then((res) => res.data),
  });

  const validateMutation = useMutation({
    mutationFn: ({ id, coherent, explication }: { id: string; coherent: boolean; explication?: string }) =>
      api.post(`/admin/positions/${id}/validate`, { coherent, explication }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-validation-queue'] });
      setSelectedPosition(null);
      setExplication('');
    },
  });

  const validationData = data?.data;
  const positions = validationData?.incoherentPositions || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">File de validation</h1>
        <p className="text-muted-foreground">
          Validez les positions incohérentes détectées automatiquement
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{validationData?.counts.incoherent || 0}</div>
              <div className="text-sm text-muted-foreground">Incohérences détectées</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{validationData?.counts.pending || 0}</div>
              <div className="text-sm text-muted-foreground">En attente de validation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions list */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Positions à valider</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Chargement...</div>
        ) : positions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune position à valider</p>
          </div>
        ) : (
          <div className="divide-y">
            {positions.map((position) => (
              <div key={position.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Candidat info */}
                    <div className="flex items-center gap-2 mb-2">
                      <Link
                        href={`/admin/candidats/${position.candidat.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {position.candidat.prenom} {position.candidat.nom}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        ({position.candidat.parti})
                      </span>
                    </div>

                    {/* Position details */}
                    <div className="rounded-lg bg-muted/50 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{position.sujet}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-xs">
                          {AXES_LABELS[position.axe] || position.axe}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                          {position.sourceType}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{position.position}</p>
                      {position.sourceUrl && (
                        <a
                          href={position.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                        >
                          Voir la source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {/* Incohérence explanation */}
                    {position.explication && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-3">
                        <p className="text-sm text-amber-800">
                          <strong>Incohérence détectée :</strong> {position.explication}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {selectedPosition === position.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={explication}
                          onChange={(e) => setExplication(e.target.value)}
                          placeholder="Explication (optionnel)..."
                          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              validateMutation.mutate({
                                id: position.id,
                                coherent: true,
                                explication: explication || undefined,
                              })
                            }
                            disabled={validateMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Marquer cohérent
                          </button>
                          <button
                            onClick={() =>
                              validateMutation.mutate({
                                id: position.id,
                                coherent: false,
                                explication: explication || position.explication,
                              })
                            }
                            disabled={validateMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                            Confirmer incohérence
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPosition(null);
                              setExplication('');
                            }}
                            className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedPosition(position.id)}
                        className="text-sm text-primary hover:underline"
                      >
                        Valider cette position
                      </button>
                    )}
                  </div>

                  {/* Score */}
                  <div
                    className={`text-lg font-bold ${
                      position.score < 0
                        ? 'text-blue-600'
                        : position.score > 0
                        ? 'text-amber-600'
                        : ''
                    }`}
                  >
                    {position.score > 0 ? '+' : ''}
                    {position.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
