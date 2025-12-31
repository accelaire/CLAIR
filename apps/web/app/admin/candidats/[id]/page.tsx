'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Save,
  Loader2,
  Users,
  Calculator,
  CheckCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

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
  createdAt: string;
}

interface IngestionLog {
  id: string;
  type: string;
  status: string;
  details?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface CandidatDetail {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  parti: string;
  photoUrl?: string;
  programmeUrl?: string;
  scoreEconomie: number;
  scoreSocial: number;
  scoreEcologie: number;
  scoreSecurite: number;
  scoreEurope: number;
  scoreImmigration: number;
  scoreInstitutions: number;
  scoreInternational: number;
  scoreType: string;
  coherenceScore: number;
  ingestionStatus: string;
  actif: boolean;
  depute?: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
  };
  positions: Position[];
  ingestionLogs: IngestionLog[];
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

export default function EditCandidatPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    parti: '',
    photoUrl: '',
    programmeUrl: '',
    actif: true,
  });
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery<{ data: CandidatDetail }>({
    queryKey: ['admin-candidat', id],
    queryFn: () => api.get(`/admin/candidats/${id}`).then((res) => res.data),
  });

  // Initialize form data when data is loaded
  if (data?.data && !initialized) {
    setFormData({
      nom: data.data.nom,
      prenom: data.data.prenom,
      parti: data.data.parti,
      photoUrl: data.data.photoUrl || '',
      programmeUrl: data.data.programmeUrl || '',
      actif: data.data.actif,
    });
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => api.put(`/admin/candidats/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidat', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-candidats'] });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: () => api.post(`/admin/candidats/${id}/recalculate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidat', id] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post(`/admin/candidats/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-candidat', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-candidats'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const candidat = data?.data;
  if (!candidat) {
    return <div className="p-8 text-center text-muted-foreground">Candidat non trouvé</div>;
  }

  const scores = [
    { key: 'economie', value: candidat.scoreEconomie },
    { key: 'social', value: candidat.scoreSocial },
    { key: 'ecologie', value: candidat.scoreEcologie },
    { key: 'securite', value: candidat.scoreSecurite },
    { key: 'europe', value: candidat.scoreEurope },
    { key: 'immigration', value: candidat.scoreImmigration },
    { key: 'institutions', value: candidat.scoreInstitutions },
    { key: 'international', value: candidat.scoreInternational },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin/candidats"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux candidats
          </Link>
          <h1 className="text-2xl font-bold">
            {candidat.prenom} {candidat.nom}
          </h1>
          <p className="text-muted-foreground">{candidat.parti}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/simulateur/candidats/${candidat.slug}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            Voir la fiche
          </Link>
          {candidat.ingestionStatus === 'ready' && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Publier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Formulaire */}
        <div className="col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Informations</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData((f) => ({ ...f, prenom: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Nom</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border bg-background"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1.5">Parti</label>
              <input
                type="text"
                value={formData.parti}
                onChange={(e) => setFormData((f) => ({ ...f, parti: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1.5">URL Photo</label>
              <input
                type="url"
                value={formData.photoUrl}
                onChange={(e) => setFormData((f) => ({ ...f, photoUrl: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1.5">URL Programme</label>
              <input
                type="url"
                value={formData.programmeUrl}
                onChange={(e) => setFormData((f) => ({ ...f, programmeUrl: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.actif}
                  onChange={(e) => setFormData((f) => ({ ...f, actif: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm font-medium">Actif</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </div>
          </form>

          {/* Scores */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Scores politiques</h2>
              <button
                onClick={() => recalculateMutation.mutate()}
                disabled={recalculateMutation.isPending || !candidat.depute}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                Recalculer
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {scores.map(({ key, value }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">{AXES_LABELS[key]}</span>
                  <span
                    className={`font-medium ${
                      value < 0 ? 'text-blue-600' : value > 0 ? 'text-amber-600' : ''
                    }`}
                  >
                    {value > 0 ? '+' : ''}
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm">
              <span
                className={`px-2 py-1 rounded ${
                  candidat.scoreType === 'verified'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {candidat.scoreType === 'verified' ? 'Vérifié par votes' : 'Estimation'}
              </span>
              <span className="text-muted-foreground">
                Cohérence: <strong>{candidat.coherenceScore}%</strong>
              </span>
            </div>
          </div>

          {/* Positions */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">
              Positions ({candidat.positions.length})
            </h2>

            {candidat.positions.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune position enregistrée</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-auto">
                {candidat.positions.map((pos) => (
                  <div
                    key={pos.id}
                    className={`p-3 rounded-lg border ${
                      pos.coherent ? 'bg-background' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{pos.sujet}</span>
                          <span className="px-1.5 py-0.5 rounded bg-muted text-xs">
                            {AXES_LABELS[pos.axe] || pos.axe}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">
                            {pos.sourceType}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{pos.position}</p>
                        {!pos.coherent && pos.explication && (
                          <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {pos.explication}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          pos.score < 0 ? 'text-blue-600' : pos.score > 0 ? 'text-amber-600' : ''
                        }`}
                      >
                        {pos.score > 0 ? '+' : ''}
                        {pos.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Photo */}
          <div className="rounded-lg border bg-card p-6">
            <div className="relative h-32 w-32 rounded-full overflow-hidden bg-muted mx-auto">
              {candidat.photoUrl ? (
                <Image
                  src={candidat.photoUrl}
                  alt={candidat.nom}
                  fill
                  className="object-cover"
                />
              ) : (
                <Users className="absolute inset-0 m-auto h-12 w-12 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Statut */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Statut</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingestion</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    candidat.ingestionStatus === 'published'
                      ? 'bg-green-100 text-green-700'
                      : candidat.ingestionStatus === 'ready'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-muted'
                  }`}
                >
                  {candidat.ingestionStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actif</span>
                <span>{candidat.actif ? 'Oui' : 'Non'}</span>
              </div>
            </div>
          </div>

          {/* Député lié */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Député lié</h3>
            {candidat.depute ? (
              <Link
                href={`/deputes/${candidat.depute.slug}`}
                className="flex items-center gap-2 text-primary hover:underline"
              >
                {candidat.depute.prenom} {candidat.depute.nom}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Non lié à un député</p>
            )}
          </div>

          {/* Logs */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">Derniers logs</h3>
            {candidat.ingestionLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun log</p>
            ) : (
              <div className="space-y-2">
                {candidat.ingestionLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      {log.status === 'completed' ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : log.status === 'failed' ? (
                        <AlertCircle className="h-3 w-3 text-red-600" />
                      ) : (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="font-medium">{log.type}</span>
                    </div>
                    <p className="text-muted-foreground ml-5">
                      {new Date(log.startedAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
