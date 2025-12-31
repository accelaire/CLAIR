'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
}

interface Candidat {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  parti: string;
  photoUrl?: string;
  scoreEconomie: number;
  scoreSocial: number;
  scoreEcologie: number;
  scoreSecurite: number;
  scoreEurope: number;
  scoreImmigration: number;
  scoreInstitutions: number;
  scoreInternational: number;
  coherenceScore: number;
  scoreType: string;
  positions: Position[];
  depute?: {
    id: string;
    slug: string;
    nom: string;
    prenom: string;
    photoUrl?: string;
    groupe?: { nom: string; couleur?: string };
  };
}

const AXES_CONFIG: Record<string, { label: string; gauche: string; droite: string }> = {
  economie: { label: 'Économie', gauche: 'Interventionnisme', droite: 'Libéralisme' },
  social: { label: 'Social', gauche: 'Redistribution', droite: 'Responsabilité' },
  ecologie: { label: 'Écologie', gauche: 'Transition forte', droite: 'Pragmatisme' },
  securite: { label: 'Sécurité', gauche: 'Libertés', droite: 'Autorité' },
  europe: { label: 'Europe', gauche: 'Souverainisme', droite: 'Fédéralisme' },
  immigration: { label: 'Immigration', gauche: 'Ouverture', droite: 'Restriction' },
  institutions: { label: 'Institutions', gauche: 'Réforme', droite: 'Stabilité' },
  international: { label: 'International', gauche: 'Multilatéralisme', droite: 'Indépendance' },
};

export default function CandidatDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading, error } = useQuery<{ data: Candidat }>({
    queryKey: ['candidat-2027', slug],
    queryFn: () => api.get(`/simulateur/candidats/${slug}`).then(res => res.data),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="flex gap-6">
            <div className="h-32 w-32 rounded-full bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 rounded bg-muted" />
              <div className="h-6 w-40 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Candidat non trouvé.
        </div>
      </div>
    );
  }

  const candidat = data.data;

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
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/simulateur" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour au simulateur
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Photo */}
        <div className="relative h-32 w-32 rounded-full overflow-hidden bg-muted flex-shrink-0">
          {candidat.photoUrl ? (
            <Image
              src={candidat.photoUrl}
              alt={`${candidat.prenom} ${candidat.nom}`}
              fill
              className="object-cover"
            />
          ) : (
            <Users className="absolute inset-0 m-auto h-16 w-16 text-muted-foreground" />
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-1">
            {candidat.prenom} {candidat.nom}
          </h1>
          <p className="text-lg text-muted-foreground mb-3">{candidat.parti}</p>

          <div className="flex flex-wrap items-center gap-4">
            {/* Coherence score */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Cohérence :</span>
              <span className={`font-semibold ${
                candidat.coherenceScore >= 80 ? 'text-green-600' :
                candidat.coherenceScore >= 60 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {candidat.coherenceScore}%
              </span>
            </div>

            {/* Score type */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              candidat.scoreType === 'verified'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {candidat.scoreType === 'verified' ? '✓ Vérifié par votes' : '⚠ Estimation programme'}
            </span>

            {/* Link to depute if exists */}
            {candidat.depute && (
              <Link
                href={`/deputes/${candidat.depute.slug}`}
                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
              >
                Voir sa fiche député
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Scores par axe */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Positionnement politique</h2>
        <div className="space-y-4">
          {scores.map(({ key, value }) => {
            const config = AXES_CONFIG[key];
            const position = ((value + 100) / 200) * 100; // Convert -100/+100 to 0-100%

            return (
              <div key={key} className="rounded-lg border bg-card p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{config.gauche}</span>
                  <span className="font-medium">{config.label}</span>
                  <span className="text-muted-foreground">{config.droite}</span>
                </div>
                <div className="relative h-3 bg-gradient-to-r from-blue-200 via-gray-100 to-amber-200 rounded-full">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow"
                    style={{ left: `calc(${position}% - 8px)` }}
                  />
                </div>
                <div className="text-center mt-1">
                  <span className={`text-sm font-medium ${value < 0 ? 'text-blue-600' : value > 0 ? 'text-amber-600' : ''}`}>
                    {value > 0 ? '+' : ''}{value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Positions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Positions sur les sujets clés</h2>

        {candidat.positions.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
            Aucune position documentée pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {candidat.positions.map((pos) => (
              <div key={pos.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  {/* Coherence indicator */}
                  <div className="mt-1">
                    {pos.coherent ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{pos.sujet}</span>
                      <span className="px-2 py-0.5 bg-muted rounded text-xs">
                        {AXES_CONFIG[pos.axe]?.label || pos.axe}
                      </span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                        {pos.sourceType}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{pos.position}</p>

                    {!pos.coherent && pos.explication && (
                      <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded p-2">
                        ⚠ Incohérence : {pos.explication}
                      </p>
                    )}

                    {pos.sourceUrl && (
                      <a
                        href={pos.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                      >
                        Voir la source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Score */}
                  <div className={`text-lg font-bold ${pos.score < 0 ? 'text-blue-600' : pos.score > 0 ? 'text-amber-600' : ''}`}>
                    {pos.score > 0 ? '+' : ''}{pos.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-8">
        <Link
          href="/simulateur/versus"
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
        >
          ⚔️ Comparer avec un autre candidat
        </Link>
        <Link
          href="/simulateur"
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Refaire le test
        </Link>
      </div>
    </div>
  );
}
