'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  /** Show preset options */
  showPresets?: boolean;
  /**
   * Date la plus ancienne pertinente (ex: début du mandat). Borne le calendrier
   * vers le passé et alimente les raccourcis par année + « depuis le début ».
   */
  minDate?: Date;
  /** Date la plus récente sélectionnable (défaut: aujourd'hui). */
  maxDate?: Date;
  /**
   * Libellé du raccourci « depuis minDate jusqu'à maintenant »
   * (ex: « Depuis le début du mandat »). Affiché uniquement si minDate est fourni.
   */
  startLabel?: string;
  /** Nombre de résultats sur la période active, affiché en badge sur le bouton. */
  resultCount?: number | null;
}

interface PresetOption {
  label: string;
  getValue: () => DateRange;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "28 juin" (sans année) */
function formatDay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** "28 juin 2025" */
function formatDayYear(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isJan1(d: Date): boolean {
  return d.getMonth() === 0 && d.getDate() === 1;
}

function isDec31(d: Date): boolean {
  return d.getMonth() === 11 && d.getDate() === 31;
}

function isSameDay(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return d1.toDateString() === d2.toDateString();
}

function isInRange(date: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

/** Formate une date en YYYY-MM-DD dans le fuseau local (évite le décalage d'un jour de toISOString). */
function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
  // Convert to Monday-based (0 = Monday, 6 = Sunday)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  // Add days from previous month to fill the first week
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  // Add all days of the current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to fill the last week
  const remaining = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une période',
  showPresets = true,
  minDate,
  maxDate,
  startLabel,
  resultCount,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value.from || new Date());
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [tempFrom, setTempFrom] = useState<Date | null>(value.from);
  const [tempTo, setTempTo] = useState<Date | null>(value.to);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const effectiveMax = useMemo(
    () => startOfDay(maxDate ?? today),
    [maxDate, today]
  );
  const maxYear = effectiveMax.getFullYear();
  // Borne basse de navigation du calendrier : large par défaut pour ne masquer
  // aucune donnée historique sur les pages sans contexte de mandat.
  const navMinYear = minDate ? minDate.getFullYear() : maxYear - 12;
  // Raccourcis « par année » : depuis le début du mandat si connu, sinon 3 ans récents.
  const yearPresetMinYear = minDate ? minDate.getFullYear() : maxYear - 2;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset temp values when opening
  useEffect(() => {
    if (isOpen) {
      setTempFrom(value.from);
      setTempTo(value.to);
      setSelecting('from');
      setViewDate(value.from || effectiveMax);
    }
  }, [isOpen, value.from, value.to, effectiveMax]);

  const { quickPresets, yearPresets } = useMemo(() => {
    const quick: PresetOption[] = [
      { label: 'Tout', getValue: () => ({ from: null, to: null }) },
    ];
    if (startLabel && minDate) {
      quick.push({ label: startLabel, getValue: () => ({ from: startOfDay(minDate), to: null }) });
    }
    quick.push(
      {
        label: '30 derniers jours',
        getValue: () => {
          const to = new Date(effectiveMax);
          const from = new Date(effectiveMax);
          from.setDate(from.getDate() - 30);
          return { from, to };
        },
      },
      {
        label: '3 derniers mois',
        getValue: () => {
          const to = new Date(effectiveMax);
          const from = new Date(effectiveMax);
          from.setMonth(from.getMonth() - 3);
          return { from, to };
        },
      },
      {
        label: '12 derniers mois',
        getValue: () => {
          const to = new Date(effectiveMax);
          const from = new Date(effectiveMax);
          from.setFullYear(from.getFullYear() - 1);
          return { from, to };
        },
      },
    );

    const years: PresetOption[] = [];
    for (let y = maxYear; y >= yearPresetMinYear; y--) {
      years.push({
        label: String(y),
        getValue: () => ({
          from: new Date(y, 0, 1),
          to: y === maxYear ? new Date(effectiveMax) : new Date(y, 11, 31),
        }),
      });
    }

    return { quickPresets: quick, yearPresets: years };
  }, [minDate, effectiveMax, startLabel, yearPresetMinYear, maxYear]);

  const days = useMemo(
    () => getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const handleDayClick = (day: Date) => {
    if (selecting === 'from') {
      setTempFrom(day);
      setTempTo(null);
      setSelecting('to');
    } else {
      // If clicked date is before tempFrom, swap them
      if (tempFrom && day < tempFrom) {
        setTempTo(tempFrom);
        setTempFrom(day);
      } else {
        setTempTo(day);
      }
      // Apply the selection
      const finalFrom = tempFrom && day < tempFrom ? day : tempFrom;
      const finalTo = tempFrom && day < tempFrom ? tempFrom : day;
      onChange({ from: finalFrom, to: finalTo });
      setIsOpen(false);
    }
  };

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getValue();
    onChange(range);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  // Borne la vue du calendrier à [minYear janvier, maxMonth]
  const clampView = (year: number, month: number) => {
    let d = new Date(year, month, 1);
    const maxMonthStart = new Date(maxYear, effectiveMax.getMonth(), 1);
    const minMonthStart = new Date(navMinYear, 0, 1);
    if (d > maxMonthStart) d = maxMonthStart;
    if (d < minMonthStart) d = minMonthStart;
    setViewDate(d);
  };

  const canPrev =
    viewDate.getFullYear() > navMinYear ||
    (viewDate.getFullYear() === navMinYear && viewDate.getMonth() > 0);
  const canNext =
    viewDate.getFullYear() < maxYear ||
    (viewDate.getFullYear() === maxYear && viewDate.getMonth() < effectiveMax.getMonth());

  const prevMonth = () => {
    if (canPrev) clampView(viewDate.getFullYear(), viewDate.getMonth() - 1);
  };

  const nextMonth = () => {
    if (canNext) clampView(viewDate.getFullYear(), viewDate.getMonth() + 1);
  };

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= navMinYear; y--) arr.push(y);
    return arr;
  }, [navMinYear, maxYear]);

  const displayValue = useMemo(() => {
    const { from, to } = value;
    if (!from && !to) return null;
    if (from && to) {
      const sameYear = from.getFullYear() === to.getFullYear();
      // Année calendaire complète (ou année en cours jusqu'à aujourd'hui)
      if (sameYear && isJan1(from) && (isDec31(to) || isSameDay(to, effectiveMax))) {
        return `Année ${from.getFullYear()}`;
      }
      if (sameYear) {
        // L'année n'apparaît qu'une fois, à la fin
        return `${formatDay(from)} → ${formatDayYear(to)}`;
      }
      return `${formatDayYear(from)} → ${formatDayYear(to)}`;
    }
    if (from) {
      if (startLabel && minDate && isSameDay(from, minDate)) return startLabel;
      return `Depuis le ${formatDayYear(from)}`;
    }
    return null;
  }, [value, startLabel, minDate, effectiveMax]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 rounded-lg border bg-background px-4 py-2
          hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary
          transition-colors min-w-[200px]
          ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}
        `}
      >
        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className={`flex-1 text-left ${displayValue ? '' : 'text-muted-foreground'}`}>
          {displayValue || placeholder}
        </span>
        {displayValue && typeof resultCount === 'number' && (
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
            {resultCount.toLocaleString('fr-FR')}
          </span>
        )}
        {displayValue && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Effacer le filtre de période"
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClear(e as unknown as React.MouseEvent);
              }
            }}
            className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div data-date-dropdown className="absolute top-full right-0 mt-2 z-50 rounded-lg border bg-background shadow-lg overflow-hidden">
          <div className="flex">
            {/* Presets */}
            {showPresets && (
              <div className="border-r bg-muted/30 p-2 min-w-[150px] max-h-[340px] overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                  Raccourcis
                </div>
                {quickPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
                {yearPresets.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1 mt-2 border-t pt-2">
                      Par année
                    </div>
                    {yearPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Calendar */}
            <div className="p-3">
              {/* Header with selection state */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <div
                  className={`flex-1 px-3 py-1.5 rounded border text-center cursor-pointer transition-colors ${
                    selecting === 'from'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent hover:bg-muted'
                  }`}
                  onClick={() => setSelecting('from')}
                >
                  {tempFrom ? formatDay(tempFrom) : 'Début'}
                </div>
                <span className="text-muted-foreground">→</span>
                <div
                  className={`flex-1 px-3 py-1.5 rounded border text-center cursor-pointer transition-colors ${
                    selecting === 'to'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent hover:bg-muted'
                  }`}
                  onClick={() => setSelecting('to')}
                >
                  {tempTo ? formatDay(tempTo) : 'Fin'}
                </div>
              </div>

              {/* Month / year navigation */}
              <div className="flex items-center justify-between gap-1 mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  disabled={!canPrev}
                  className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  <select
                    value={viewDate.getMonth()}
                    onChange={(e) => clampView(viewDate.getFullYear(), Number(e.target.value))}
                    className="text-sm font-medium bg-transparent rounded px-1 py-0.5 hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    aria-label="Mois"
                  >
                    {MONTHS_FR.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={viewDate.getFullYear()}
                    onChange={(e) => clampView(Number(e.target.value), viewDate.getMonth())}
                    className="text-sm font-medium bg-transparent rounded px-1 py-0.5 hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    aria-label="Année"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  disabled={!canNext}
                  className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS_FR.map((day) => (
                  <div
                    key={day}
                    className="h-8 w-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                  const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                  const isFuture = startOfDay(day) > effectiveMax;
                  const isDisabled = !isCurrentMonth || isFuture;
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, tempFrom) || isSameDay(day, tempTo);
                  const isRangeStart = isSameDay(day, tempFrom);
                  const isRangeEnd = isSameDay(day, tempTo);
                  const inRange = isInRange(day, tempFrom, tempTo);

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      disabled={isDisabled}
                      className={`
                        h-8 w-8 flex items-center justify-center text-sm rounded transition-colors
                        ${isDisabled ? 'text-muted-foreground/30 cursor-default' : 'hover:bg-muted'}
                        ${isToday && !isSelected ? 'font-bold text-primary' : ''}
                        ${isSelected ? 'bg-primary text-primary-foreground font-medium' : ''}
                        ${inRange && !isSelected ? 'bg-primary/10' : ''}
                        ${isRangeStart && tempTo ? 'rounded-r-none' : ''}
                        ${isRangeEnd && tempFrom ? 'rounded-l-none' : ''}
                        ${inRange && !isRangeStart && !isRangeEnd ? 'rounded-none' : ''}
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to convert DateRange to API params (dates locales, sans décalage de fuseau)
export function dateRangeToParams(range: DateRange): { dateFrom?: string; dateTo?: string } {
  return {
    ...(range.from && { dateFrom: toLocalYMD(range.from) }),
    ...(range.to && { dateTo: toLocalYMD(range.to) }),
  };
}

export default DateRangePicker;
