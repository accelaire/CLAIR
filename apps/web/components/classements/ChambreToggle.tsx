'use client';

interface ChambreToggleProps {
  value: string;
  onChange: (chambre: string) => void;
  showAll?: boolean;
}

const options = [
  { value: '', label: 'Toutes' },
  { value: 'assemblee', label: 'Assemblée nationale' },
  { value: 'senat', label: 'Sénat' },
];

export function ChambreToggle({ value, onChange, showAll = true }: ChambreToggleProps) {
  const visibleOptions = showAll ? options : options.filter((o) => o.value !== '');

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {visibleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
