'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed
  byDay: Record<string, unknown[]>;
  selectedDate: string | null; // 'YYYY-MM-DD'
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_NAMES = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

// Returns the density bucket for a count
function getDensity(count: number): 'none' | 'low' | 'medium' | 'high' {
  if (count === 0) return 'none';
  if (count === 1) return 'low';
  if (count <= 4) return 'medium';
  return 'high';
}

const DENSITY_COLORS = {
  none: '',
  low: 'bg-primary/30',
  medium: 'bg-primary/60',
  high: 'bg-primary',
};

export function MonthCalendar({
  year,
  month,
  byDay,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = useMemo(() => {
    // First day of the month (0=Sun, 1=Mon, ...)
    const firstDay = new Date(year, month, 1);
    // Convert to Monday-based (0=Mon ... 6=Sun)
    const startDow = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Days from previous month to fill start
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Format date as YYYY-MM-DD without timezone conversion
    const toKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      cells.push({ date: d, inMonth: false, key: toKey(d) });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      cells.push({ date, inMonth: true, key: toKey(date) });
    }

    // Next month padding to complete the grid (always 6 rows = 42 cells)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      cells.push({ date, inMonth: false, key: toKey(date) });
    }

    return cells;
  }, [year, month]);

  return (
    <div className='select-none'>
      {/* Month navigation */}
      <div className='flex items-center justify-between mb-4'>
        <button
          onClick={onPrevMonth}
          className='rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
          aria-label='Mois précédent'
        >
          <ChevronLeft className='h-5 w-5' />
        </button>
        <h2 className='text-base font-semibold'>
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={onNextMonth}
          className='rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors'
          aria-label='Mois suivant'
        >
          <ChevronRight className='h-5 w-5' />
        </button>
      </div>

      {/* Day names header */}
      <div className='grid grid-cols-7 mb-1'>
        {DAY_NAMES.map((d) => (
          <div key={d} className='text-center text-xs font-medium text-muted-foreground py-1'>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className='grid grid-cols-7 gap-px'>
        {cells.map(({ date, inMonth, key }) => {
          const count = byDay[key]?.length ?? 0;
          const density = getDensity(count);
          const isToday = date.getTime() === today.getTime();
          const isSelected = key === selectedDate;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          return (
            <button
              key={key}
              onClick={() => inMonth && count > 0 && onSelectDate(key)}
              disabled={!inMonth || count === 0}
              className={`
                relative flex flex-col items-center justify-start pt-1 pb-2 rounded-md transition-all
                ${inMonth ? 'cursor-pointer' : 'cursor-default opacity-30'}
                ${inMonth && count > 0 ? 'hover:bg-accent' : ''}
                ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}
                ${isToday && !isSelected ? 'font-bold' : ''}
                ${isWeekend && !isSelected && inMonth ? 'text-muted-foreground' : ''}
              `}
              aria-label={`${date.getDate()} ${MONTH_NAMES[date.getMonth()]} — ${count} réunion${count > 1 ? 's' : ''}`}
            >
              <span className={`text-sm leading-6 ${isToday && !isSelected ? 'underline underline-offset-2' : ''}`}>
                {date.getDate()}
              </span>
              {/* Density dot */}
              {inMonth && density !== 'none' && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-primary-foreground/80' : DENSITY_COLORS[density]
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className='mt-4 flex items-center gap-4 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1.5'>
          <span className='h-2 w-2 rounded-full bg-primary/30' />
          1 réunion
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='h-2 w-2 rounded-full bg-primary/60' />
          2–4
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='h-2 w-2 rounded-full bg-primary' />
          5+
        </span>
      </div>
    </div>
  );
}
