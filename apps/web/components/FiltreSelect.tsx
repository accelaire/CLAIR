'use client';

import { ChevronDown } from 'lucide-react';

export interface OptionFiltre<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Menu déroulant d'une barre de filtres (`FilterBar`) : `<select>` natif, donc
 * accessible et adapté au mobile, avec le chevron et la largeur des autres.
 *
 * Largeur fixe dès le format tablette : un `<select>` natif prend la largeur
 * de son option la plus longue, pas celle de la valeur affichée, et poussait
 * les filtres voisins sur une deuxième ligne. La liste déroulante, elle,
 * s'affiche plus large que le champ.
 */
export function FiltreSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  largeur = 'md:w-[180px]',
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<OptionFiltre<T>>;
  ariaLabel: string;
  /** Classe de largeur, `md:w-[180px]` par défaut. */
  largeur?: string;
}) {
  return (
    <div className={`relative ${largeur}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
