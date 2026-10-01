'use client';

/** '' = les deux chambres. */
export type ChambreFiltre = '' | 'assemblee' | 'senat';

/**
 * Ce que les listes d'une fiche doivent savoir du parcours de la personne :
 * depuis quand elle siège, et si elle a siégé dans les deux chambres.
 */
export interface ParcoursFiche {
  /** Début de son premier mandat, toutes chambres confondues. */
  debut?: Date;
  /** Passée par l'Assemblée ET par le Sénat (Valérie Boyer, un député élu sénateur). */
  deuxChambres: boolean;
}

export function parcoursFiche(mandats: { chambre?: string; dateDebut: string }[] | undefined): ParcoursFiche {
  if (!mandats || mandats.length === 0) return { deuxChambres: false };
  const premier = mandats.reduce((min, m) => (m.dateDebut < min ? m.dateDebut : min), mandats[0]!.dateDebut);
  const chambres = new Set(mandats.map((m) => m.chambre).filter(Boolean));
  return { debut: new Date(premier), deuxChambres: chambres.size > 1 };
}

/** Paramètre d'API du filtre, absent quand il vaut « les deux chambres ». */
export function paramChambre(filtre: ChambreFiltre): { chambre?: 'assemblee' | 'senat' } {
  return filtre ? { chambre: filtre } : {};
}

/**
 * Choix de la chambre sur les listes d'une fiche. Affiché seulement pour une
 * personne passée par les deux : ailleurs il n'aurait qu'une réponse possible.
 */
export function FiltreChambre({
  value,
  onChange,
}: {
  value: ChambreFiltre;
  onChange: (value: ChambreFiltre) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ChambreFiltre)}
      aria-label="Filtrer par chambre"
      className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="">Les deux chambres</option>
      <option value="assemblee">Assemblée nationale</option>
      <option value="senat">Sénat</option>
    </select>
  );
}
