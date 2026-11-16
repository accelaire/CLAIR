'use client';

/** Présentation d'un onglet de fiche : rangé par dossier, ou en liste chronologique. */
export type VueFiche = 'dossier' | 'chrono';

/** Bascule entre la vue par dossier et la liste chronologique. */
export function BasculeVue({ value, onChange }: { value: VueFiche; onChange: (v: VueFiche) => void }) {
  const options: Array<{ v: VueFiche; libelle: string }> = [
    { v: 'dossier', libelle: 'Par dossier' },
    { v: 'chrono', libelle: 'Chronologique' },
  ];
  return (
    <div role="radiogroup" aria-label="Présentation" className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
            value === o.v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}
