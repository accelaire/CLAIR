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
}

interface PresetOption {
  label: string;
  getValue: () => DateRange;
}

const PRESETS: PresetOption[] = [
  {
    label: 'Tout',
    getValue: () => ({ from: null, to: null }),
  },
  {
    label: '7 derniers jours',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { from, to };
    },
  },
  {
    label: '30 derniers jours',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from, to };
    },
  },
  {
    label: '3 derniers mois',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 3);
      return { from, to };
    },
  },
  {
    label: '12 derniers mois',
    getValue: () => {
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      return { from, to };
    },
  },
  {
    label: 'Cette année',
    getValue: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date();
      return { from, to };
    },
  },
];

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

function formatDateShort(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatDateFull(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value.from || new Date());
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [tempFrom, setTempFrom] = useState<Date | null>(value.from);
  const [tempTo, setTempTo] = useState<Date | null>(value.to);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (value.from) {
        setViewDate(value.from);
      }
    }
  }, [isOpen, value.from, value.to]);

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

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const displayValue = useMemo(() => {
    if (!value.from && !value.to) return null;
    if (value.from && value.to) {
      return `${formatDateShort(value.from)} → ${formatDateShort(value.to)}`;
    }
    if (value.from) return `À partir du ${formatDateShort(value.from)}`;
    return null;
  }, [value.from, value.to]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
        {displayValue && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 hover:bg-muted rounded transition-colors"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 rounded-lg border bg-background shadow-lg overflow-hidden">
          <div className="flex">
            {/* Presets */}
            {showPresets && (
              <div className="border-r bg-muted/30 p-2 min-w-[140px]">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                  Raccourcis
                </div>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
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
                  {tempFrom ? formatDateShort(tempFrom) : 'Début'}
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
                  {tempTo ? formatDateShort(tempTo) : 'Fin'}
                </div>
              </div>

              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-medium">
                  {MONTHS_FR[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 hover:bg-muted rounded transition-colors"
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
                      disabled={!isCurrentMonth}
                      className={`
                        h-8 w-8 flex items-center justify-center text-sm rounded transition-colors
                        ${!isCurrentMonth ? 'text-muted-foreground/30 cursor-default' : 'hover:bg-muted'}
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

// Hook for easy state management
export function useDateRange(initialValue?: DateRange): [DateRange, (v: DateRange) => void] {
  const [value, setValue] = useState<DateRange>(initialValue || { from: null, to: null });
  return [value, setValue];
}

// Helper to convert DateRange to API params
export function dateRangeToParams(range: DateRange): { dateFrom?: string; dateTo?: string } {
  return {
    ...(range.from && { dateFrom: range.from.toISOString().split('T')[0] }),
    ...(range.to && { dateTo: range.to.toISOString().split('T')[0] }),
  };
}

export default DateRangePicker;
