'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export interface SelectedParlementaire {
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  groupe: {
    nom: string;
    couleur: string | null;
  } | null;
}

export interface UseComparisonSelectionOptions {
  chambre: 'deputes' | 'senateurs';
  maxSelection?: number;
  storageKey?: string;
}

export interface UseComparisonSelectionReturn {
  selected: SelectedParlementaire[];
  isSelected: (slug: string) => boolean;
  toggle: (parlementaire: SelectedParlementaire) => void;
  remove: (slug: string) => void;
  clear: () => void;
  canCompare: boolean;
  compareUrl: string;
  count: number;
}

const MAX_SELECTION = 4;
const MIN_SELECTION = 2;

export function useComparisonSelection({
  chambre,
  maxSelection = MAX_SELECTION,
  storageKey,
}: UseComparisonSelectionOptions): UseComparisonSelectionReturn {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<SelectedParlementaire[]>([]);

  // Clé de stockage unique par chambre
  const sessionKey = storageKey || `comparison-${chambre}`;

  // Charger depuis sessionStorage au montage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelected(parsed);
        }
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }, [sessionKey]);

  // Gérer le paramètre URL ?compare=slug pour présélection
  useEffect(() => {
    const compareSlug = searchParams.get('compare');
    if (compareSlug) {
      // On ne peut pas ajouter automatiquement car on n'a pas les infos complètes
      // Cette logique sera gérée côté page avec les données chargées
    }
  }, [searchParams]);

  // Sauvegarder dans sessionStorage à chaque changement
  useEffect(() => {
    try {
      if (selected.length > 0) {
        sessionStorage.setItem(sessionKey, JSON.stringify(selected));
      } else {
        sessionStorage.removeItem(sessionKey);
      }
    } catch {
      // Ignorer les erreurs de stockage
    }
  }, [selected, sessionKey]);

  const isSelected = useCallback(
    (slug: string) => selected.some((p) => p.slug === slug),
    [selected]
  );

  const toggle = useCallback(
    (parlementaire: SelectedParlementaire) => {
      setSelected((prev) => {
        const exists = prev.some((p) => p.slug === parlementaire.slug);
        if (exists) {
          return prev.filter((p) => p.slug !== parlementaire.slug);
        }
        if (prev.length >= maxSelection) {
          // Retirer le premier et ajouter le nouveau
          return [...prev.slice(1), parlementaire];
        }
        return [...prev, parlementaire];
      });
    },
    [maxSelection]
  );

  const remove = useCallback((slug: string) => {
    setSelected((prev) => prev.filter((p) => p.slug !== slug));
  }, []);

  const clear = useCallback(() => {
    setSelected([]);
  }, []);

  const canCompare = selected.length >= MIN_SELECTION;
  const compareUrl = `/${chambre}/comparer?slugs=${selected.map((p) => p.slug).join(',')}`;

  return {
    selected,
    isSelected,
    toggle,
    remove,
    clear,
    canCompare,
    compareUrl,
    count: selected.length,
  };
}
