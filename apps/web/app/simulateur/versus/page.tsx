'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Users, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';

interface Candidat {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  parti: string;
  photoUrl?: string;
}

interface ComparaisonAxe {
  axe: string;
  label: string;
  candidats: Array<{
    slug: string;
    nom: string;
    score: number;
  }>;
}

interface CompareData {
  candidats: Array<Candidat & {
    coherenceScore: number;
    positions: any[];
  }>;
  comparaison: ComparaisonAxe[];
}

export default function VersusPage() {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  // Fetch all candidats
  const { data: candidatsData } = useQuery<{ data: Candidat[] }>({
    queryKey: ['candidats-2027'],
    queryFn: () => api.get('/simulateur/candidats').then(res => res.data),
  });

  // Fetch comparison when 2+ selected
  const { data: compareData, isLoading: isComparing } = useQuery<{ data: CompareData }>({
    queryKey: ['compare-candidats', selectedSlugs.join(',')],
    queryFn: () =>
      api.get('/simulateur/compare', {
        params: { candidats: selectedSlugs.join(',') },
      }).then(res => res.data),
    enabled: selectedSlugs.length >= 2,
  });

  const toggleCandidat = (slug: string) => {
    setSelectedSlugs(prev => {
      if (prev.includes(slug)) {
        return prev.filter(s => s !== slug);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), slug]; // Remove first, add new
      }
      return [...prev, slug];
    });
  };

  const candidats = candidatsData?.data || [];
  const comparison = compareData?.data;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/simulateur" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Retour au simulateur
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">⚔️ Mode Versus</h1>
        <p className="text-muted-foreground">
          Compare jusqu&apos;à 3 candidats sur tous les axes politiques
        </p>
      </div>

      {/* Candidat selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Sélectionne les candidats à comparer</h2>

        {/* Selected candidates */}
        <div className="flex gap-4 mb-4 flex-wrap">
          {selectedSlugs.map((slug, index) => {
            const candidat = candidats.find(c => c.slug === slug);
            if (!candidat) return null;

            return (
              <div
                key={slug}
                className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-primary/5 border-primary"
              >
                <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted">
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
                  <p className="font-medium">{candidat.prenom} {candidat.nom}</p>
                  <p className="text-xs text-muted-foreground">{candidat.parti}</p>
                </div>
                <button
                  onClick={() => toggleCandidat(slug)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {selectedSlugs.length < 3 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed text-muted-foreground">
              <Plus className="h-5 w-5" />
              <span>Ajouter un candidat</span>
            </div>
          )}
        </div>

        {/* Candidate grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {candidats.map((candidat) => {
            const isSelected = selectedSlugs.includes(candidat.slug);

            return (
              <button
                key={candidat.id}
                onClick={() => toggleCandidat(candidat.slug)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary'
                }`}
              >
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-muted mx-auto mb-2">
                  {candidat.photoUrl ? (
                    <Image
                      src={candidat.photoUrl}
                      alt={candidat.nom}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <Users className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium text-center truncate">
                  {candidat.prenom} {candidat.nom}
                </p>
                <p className="text-xs text-muted-foreground text-center truncate">
                  {candidat.parti}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison */}
      {selectedSlugs.length < 2 ? (
        <div className="rounded-lg border bg-muted/30 p-12 text-center text-muted-foreground">
          <p className="text-lg">Sélectionne au moins 2 candidats pour les comparer</p>
        </div>
      ) : isComparing ? (
        <div className="rounded-lg border p-12 text-center">
          <div className="animate-pulse">Chargement de la comparaison...</div>
        </div>
      ) : comparison ? (
        <div>
          {/* Header row */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `200px repeat(${comparison.candidats.length}, 1fr)` }}>
            <div />
            {comparison.candidats.map((c) => (
              <div key={c.slug} className="text-center">
                <div className="relative h-16 w-16 rounded-full overflow-hidden bg-muted mx-auto mb-2">
                  {c.photoUrl ? (
                    <Image src={c.photoUrl} alt={c.nom} fill className="object-cover" />
                  ) : (
                    <Users className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className="font-semibold">{c.prenom} {c.nom}</p>
                <p className="text-sm text-muted-foreground">{c.parti}</p>
                <p className="text-xs mt-1">
                  Cohérence: <span className="font-medium">{c.coherenceScore}%</span>
                </p>
              </div>
            ))}
          </div>

          {/* Axes comparison */}
          <div className="space-y-4">
            {comparison.comparaison.map((axe) => (
              <div
                key={axe.axe}
                className="grid gap-4 items-center rounded-lg border bg-card p-4"
                style={{ gridTemplateColumns: `200px repeat(${axe.candidats.length}, 1fr)` }}
              >
                <div className="font-medium">{axe.label}</div>
                {axe.candidats.map((c) => (
                  <div key={c.slug} className="text-center">
                    {/* Score bar */}
                    <div className="relative h-4 bg-gradient-to-r from-blue-200 via-gray-100 to-amber-200 rounded-full mb-1">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border border-white shadow"
                        style={{ left: `calc(${((c.score + 100) / 200) * 100}% - 6px)` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${
                      c.score < 0 ? 'text-blue-600' : c.score > 0 ? 'text-amber-600' : ''
                    }`}>
                      {c.score > 0 ? '+' : ''}{c.score}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
