'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, GitCompareArrows, Trash2, Users } from 'lucide-react';
import { SelectedParlementaire } from './useComparisonSelection';

interface ComparisonSelectionBarProps {
  selected: SelectedParlementaire[];
  chambre: 'deputes' | 'senateurs';
  onRemove: (slug: string) => void;
  onClear: () => void;
  compareUrl: string;
  canCompare: boolean;
}

export function ComparisonSelectionBar({
  selected,
  chambre,
  onRemove,
  onClear,
  compareUrl,
  canCompare,
}: ComparisonSelectionBarProps) {
  const router = useRouter();

  if (selected.length === 0) {
    return null;
  }

  const handleCompare = () => {
    router.push(compareUrl);
  };

  const chambreLabel = chambre === 'deputes' ? 'députés' : 'sénateurs';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Parlementaires sélectionnés */}
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {selected.length} {chambreLabel} sélectionné{selected.length > 1 ? 's' : ''}
              </span>

              <div className="flex items-center gap-2">
                {selected.map((p) => (
                  <div
                    key={p.slug}
                    className="flex items-center gap-2 rounded-full bg-muted pl-1 pr-2 py-1"
                  >
                    {/* Avatar */}
                    <div className="relative h-7 w-7 overflow-hidden rounded-full bg-muted-foreground/20">
                      {p.photoUrl ? (
                        <Image
                          src={p.photoUrl}
                          alt={`${p.prenom} ${p.nom}`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Nom */}
                    <span className="text-sm font-medium whitespace-nowrap">
                      {p.prenom} {p.nom}
                    </span>

                    {/* Indicateur groupe */}
                    {p.groupe && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.groupe.couleur || '#888' }}
                        title={p.groupe.nom}
                      />
                    )}

                    {/* Bouton supprimer */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(p.slug);
                      }}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      aria-label={`Retirer ${p.prenom} ${p.nom}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Bouton effacer */}
              <button
                onClick={onClear}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Effacer</span>
              </button>

              {/* Bouton comparer */}
              <button
                onClick={handleCompare}
                disabled={!canCompare}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GitCompareArrows className="h-4 w-4" />
                <span>Comparer</span>
              </button>
            </div>
          </div>

          {/* Message d'aide si pas assez de sélection */}
          {!canCompare && (
            <p className="mt-2 text-xs text-muted-foreground text-center sm:text-left">
              Sélectionnez au moins 2 {chambreLabel} pour les comparer
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
