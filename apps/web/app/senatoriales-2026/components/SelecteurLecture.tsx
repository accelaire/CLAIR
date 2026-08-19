'use client';

import { LECTURES } from '@/lib/senatoriales/graphiques';
import { PastillesLecture } from './PastillesLecture';

/**
 * Choix de la lecture appliquée aux sortants.
 *
 * Ce sélecteur était d'abord une liste déroulante posée dans la barre de
 * filtres. Deux défauts, l'un et l'autre rédhibitoires : sur mobile, la barre
 * replie ses contrôles dans un tiroir, et le choix de la lecture — qui commande
 * le graphique affiché et le regroupement de la liste — disparaissait derrière
 * un bouton « Filtres » ; sur grand écran, aligné avec « Tous les départements »
 * et « Tous les groupes », il passait pour un troisième filtre et personne ne
 * comprenait que les vues importantes de la page en découlaient.
 */
export function SelecteurLecture({
  valeur,
  onChange,
}: {
  valeur: string;
  onChange: (tri: string) => void;
}) {
  return (
    <PastillesLecture
      titre="Lire les sortants par…"
      // Une URL sans tri affiche la même chose qu'un tri par département : les
      // deux doivent donc allumer la même pastille.
      actif={valeur || 'departement'}
      onSelect={onChange}
      pastilles={LECTURES.map((lecture) => ({
        cle: lecture.tri,
        label: lecture.label,
        aide: lecture.aide,
      }))}
    />
  );
}
