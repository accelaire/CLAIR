'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Search, Check, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface DeputeSearch {
  id: string;
  slug: string;
  nom: string;
  prenom: string;
  groupe?: { nom: string };
  alreadyLinked: boolean;
}

export default function NouveauCandidatPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    parti: '',
    photoUrl: '',
    programmeUrl: '',
    deputeSlug: '',
  });
  const [deputeSearch, setDeputeSearch] = useState('');
  const [showDeputeResults, setShowDeputeResults] = useState(false);
  const [selectedDepute, setSelectedDepute] = useState<DeputeSearch | null>(null);

  // Search deputes
  const { data: deputesData, isLoading: isSearching } = useQuery<{ data: DeputeSearch[] }>({
    queryKey: ['admin-deputes-search', deputeSearch],
    queryFn: () => api.get(`/admin/deputes/search?q=${encodeURIComponent(deputeSearch)}`).then((res) => res.data),
    enabled: deputeSearch.length >= 2,
  });

  // Create candidat
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/admin/candidats', data),
    onSuccess: () => {
      router.push('/admin/candidats');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      deputeSlug: selectedDepute?.slug || '',
    });
  };

  const handleSelectDepute = (depute: DeputeSearch) => {
    setSelectedDepute(depute);
    setDeputeSearch('');
    setShowDeputeResults(false);
  };

  const deputes = deputesData?.data || [];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/candidats"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux candidats
        </Link>
        <h1 className="text-2xl font-bold">Ajouter un candidat</h1>
        <p className="text-muted-foreground">
          Renseignez les informations du candidat pour le simulateur 2027
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Informations de base</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Prénom *</label>
              <input
                type="text"
                required
                value={formData.prenom}
                onChange={(e) => setFormData((f) => ({ ...f, prenom: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border bg-background"
                placeholder="Jean-Luc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Nom *</label>
              <input
                type="text"
                required
                value={formData.nom}
                onChange={(e) => setFormData((f) => ({ ...f, nom: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border bg-background"
                placeholder="Mélenchon"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1.5">Parti politique *</label>
            <input
              type="text"
              required
              value={formData.parti}
              onChange={(e) => setFormData((f) => ({ ...f, parti: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
              placeholder="La France Insoumise"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1.5">URL de la photo</label>
            <input
              type="url"
              value={formData.photoUrl}
              onChange={(e) => setFormData((f) => ({ ...f, photoUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
              placeholder="https://..."
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1.5">URL du programme</label>
            <input
              type="url"
              value={formData.programmeUrl}
              onChange={(e) => setFormData((f) => ({ ...f, programmeUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lien vers le programme officiel (PDF ou page web)
            </p>
          </div>
        </div>

        {/* Lien député */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Lier à un député</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Si le candidat est ou a été député, liez-le pour calculer automatiquement ses scores
            depuis ses votes réels.
          </p>

          {selectedDepute ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
              <div>
                <p className="font-medium text-green-800">
                  {selectedDepute.prenom} {selectedDepute.nom}
                </p>
                {selectedDepute.groupe && (
                  <p className="text-sm text-green-600">{selectedDepute.groupe.nom}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDepute(null)}
                className="p-1 rounded hover:bg-green-100"
              >
                <X className="h-4 w-4 text-green-600" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={deputeSearch}
                  onChange={(e) => {
                    setDeputeSearch(e.target.value);
                    setShowDeputeResults(true);
                  }}
                  onFocus={() => setShowDeputeResults(true)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
                  placeholder="Rechercher un député..."
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {showDeputeResults && deputes.length > 0 && (
                <div className="absolute z-10 w-full mt-1 rounded-lg border bg-card shadow-lg max-h-60 overflow-auto">
                  {deputes.map((depute) => (
                    <button
                      key={depute.id}
                      type="button"
                      disabled={depute.alreadyLinked}
                      onClick={() => handleSelectDepute(depute)}
                      className={`w-full text-left px-4 py-2 hover:bg-muted flex items-center justify-between ${
                        depute.alreadyLinked ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {depute.prenom} {depute.nom}
                        </p>
                        {depute.groupe && (
                          <p className="text-sm text-muted-foreground">{depute.groupe.nom}</p>
                        )}
                      </div>
                      {depute.alreadyLinked && (
                        <span className="text-xs text-amber-600">Déjà lié</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/admin/candidats"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border font-medium hover:bg-muted transition-colors"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending || !formData.nom || !formData.prenom || !formData.parti}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Créer le candidat
              </>
            )}
          </button>
        </div>

        {createMutation.isError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            Une erreur est survenue lors de la création du candidat.
          </div>
        )}
      </form>
    </div>
  );
}
