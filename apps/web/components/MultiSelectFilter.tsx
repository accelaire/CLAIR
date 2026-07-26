'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder = 'Filtrer...',
  className = '',
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const toggle = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange]
  );

  const clear = useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className={`relative md:w-[200px] ${className}`}>
      {/* Trigger button — matches native <select> styling */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full appearance-none rounded-lg border bg-background px-4 py-2 pr-10 text-left truncate focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {selected.length === 0 ? (
          placeholder
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
              {selected.length}
            </span>
            <span className="truncate">
              {selected.length === 1
                ? options.find((o) => o.value === selected[0])?.label || selected[0]
                : `${selected.length} secteurs`}
            </span>
          </span>
        )}
      </button>
      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      {selected.length > 0 && (
        <span
          role="button"
          tabIndex={0}
          onClick={clear}
          onKeyDown={(e) => { if (e.key === 'Enter') clear(e); }}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted z-10"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      )}

      {/* Dropdown */}
      {open && (
        <div data-multiselect-dropdown className="absolute z-50 mt-1 min-w-[280px] rounded-lg border bg-popover shadow-lg">
          {/* Search input */}
          {options.length > 8 && (
            <div className="border-b px-3 py-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-transparent text-sm focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</p>
            )}
            {filtered.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate flex-1 text-left">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {option.count.toLocaleString('fr-FR')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
