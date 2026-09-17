/**
 * Familles politiques des candidats.
 *
 * Elles dérivent de la nuance attribuée par la préfecture, et reprennent le
 * découpage large que le ministère de l'Intérieur utilise pour agréger ses
 * propres résultats.
 *
 * **Ce ne sont pas les positions des groupes parlementaires.** L'échelle
 * interne de CLAIR (`gauche`, `centre_gauche`, `centre`, `droite`,
 * `extreme_droite`) qualifie un groupe réel, constitué et déclaré ; une famille
 * qualifie une étiquette administrative posée sur un candidat. D'où des
 * couleurs distinctes : emprunter celles des groupes suggérerait une
 * équivalence qui n'existe pas.
 */
export const FAMILLES: Record<string, { libelle: string; couleur: string }> = {
  gauche: { libelle: 'Gauche', couleur: '#d04a4a' },
  centre: { libelle: 'Centre', couleur: '#e8a33d' },
  droite: { libelle: 'Droite', couleur: '#3d6fb4' },
  /**
   * Ni une position intermédiaire, ni une catégorie fourre-tout : le constat
   * que le ministère ne place pas ces nuances et que les observateurs ne
   * s'accordent pas. Debout la France, Droite souverainiste, Union des droites
   * pour la République. Le dire vaut mieux que laisser un blanc.
   */
  droite_ou_extreme_droite: { libelle: 'Droite ou extrême droite', couleur: '#7a5ba6' },
  extreme_droite: { libelle: 'Extrême droite', couleur: '#5b4a8a' },
  regionaliste: { libelle: 'Régionaliste', couleur: '#3f9e7c' },
  divers: { libelle: 'Divers', couleur: '#8a8a8a' },
};

/** Ordre d'affichage, de la gauche à l'extrême droite puis les inclassables. */
export const ORDRE_FAMILLES = [
  'gauche',
  'centre',
  'droite',
  'droite_ou_extreme_droite',
  'extreme_droite',
  'regionaliste',
  'divers',
] as const;

/** Libellé lisible d'une famille ; « Nuance non classée » pour un code inconnu. */
export function libelleFamille(famille: string | null | undefined): string {
  if (!famille) return 'Nuance non classée';
  return FAMILLES[famille]?.libelle ?? 'Nuance non classée';
}

/** Couleur d'une famille. Le gris signale qu'on ne sait pas, et doit se voir. */
export function couleurFamille(famille: string | null | undefined): string {
  if (!famille) return '#9ca3af';
  return FAMILLES[famille]?.couleur ?? '#9ca3af';
}
