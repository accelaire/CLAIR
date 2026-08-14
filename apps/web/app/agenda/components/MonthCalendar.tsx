'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  TYPE_EVENEMENT_META,
  formatDateEvenement,
  joursCouverts,
  jourDe,
  type AgendaEvenement,
} from './EvenementCard';

interface MonthCalendarProps {
  year: number;
  month: number; // 0-indexed
  byDay: Record<string, unknown[]>;
  evenements: AgendaEvenement[];
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
  evenements,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Événements ponctuels : une pastille sur leur jour.
  const evenementsParJour = useMemo(() => {
    const map: Record<string, AgendaEvenement[]> = {};
    for (const e of evenements) {
      if (e.dateFin) continue; // les périodes vont dans le bandeau
      const jour = jourDe(e.dateDebut);
      (map[jour] ??= []).push(e);
    }
    return map;
  }, [evenements]);

  // Périodes (suspensions, sessions bornées) : rendues en bandeau au-dessus de
  // la grille. Une pastille par jour serait illisible sur dix semaines, et
  // surtout trompeuse : il ne se passe rien « ce jour-là », c'est un état.
  const periodes = useMemo(
    () => evenements.filter((e) => e.dateFin),
    [evenements],
  );

  // Jours couverts par une période : un simple trait sous la case, pas un aplat.
  //
  // Une suspension porte sur la SÉANCE PUBLIQUE, pas sur toute l'activité — les
  // commissions continuent de siéger (auditions, commissions d'enquête, et
  // l'agenda en affiche bien pendant l'été). Teinter le fond laisserait croire
  // qu'il ne se passe rien, en contradiction avec les réunions du même jour.
  // Le trait court d'une case à l'autre et se lit comme une frise : il dit la
  // continuité de la période sans rien retrancher au jour lui-même.
  const joursEnPeriode = useMemo(() => {
    const set = new Set<string>();
    for (const e of periodes) for (const j of joursCouverts(e)) set.add(j);
    return set;
  }, [periodes]);

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
          const evenementsDuJour = evenementsParJour[key] ?? [];
          const density = getDensity(count);
          const isToday = date.getTime() === today.getTime();
          const isSelected = key === selectedDate;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          // Un jour sans réunion mais porteur d'un événement reste cliquable :
          // c'est souvent le jour le plus intéressant du mois (un scrutin, une
          // rentrée), et le rendre inerte le rendrait invisible.
          const selectionnable = inMonth && (count > 0 || evenementsDuJour.length > 0);
          const enPeriode = inMonth && joursEnPeriode.has(key);

          const libelles = [
            count > 0 ? `${count} réunion${count > 1 ? 's' : ''}` : null,
            ...evenementsDuJour.map((e) => e.titre),
          ].filter(Boolean);

          return (
            <button
              key={key}
              onClick={() => selectionnable && onSelectDate(key)}
              disabled={!selectionnable}
              className={`
                relative flex flex-col items-center justify-start pt-1 pb-2 rounded-md transition-all
                ${inMonth ? 'cursor-pointer' : 'cursor-default opacity-30'}
                ${selectionnable ? 'hover:bg-accent' : ''}
                ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}
                ${isToday && !isSelected ? 'font-bold' : ''}
                ${isWeekend && !isSelected && inMonth ? 'text-muted-foreground' : ''}
              `}
              aria-label={`${date.getDate()} ${MONTH_NAMES[date.getMonth()]}${
                libelles.length > 0 ? ` — ${libelles.join(', ')}` : ''
              }`}
            >
              <span className={`text-sm leading-6 ${isToday && !isSelected ? 'underline underline-offset-2' : ''}`}>
                {date.getDate()}
              </span>
              <span className='mt-0.5 flex items-center gap-0.5 h-1.5'>
                {/* Densité de réunions */}
                {inMonth && density !== 'none' && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-primary-foreground/80' : DENSITY_COLORS[density]
                    }`}
                  />
                )}
                {/* Événement institutionnel — carré, pour se distinguer au coup d'œil */}
                {inMonth && evenementsDuJour.map((e) => (
                  <span
                    key={e.id}
                    className={`h-1.5 w-1.5 rounded-[1px] ${
                      isSelected ? 'bg-primary-foreground' : TYPE_EVENEMENT_META[e.type].dot
                    }`}
                  />
                ))}
              </span>

              {/* Trait de période : collé au bas de la case et pleine largeur,
                  il se raccorde d'un jour au suivant et dessine la durée. */}
              {enPeriode && (
                <span
                  className={`absolute bottom-0 inset-x-0 h-px ${
                    isSelected ? 'bg-primary-foreground/60' : 'bg-muted-foreground/30'
                  }`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Périodes en cours sur le mois affiché */}
      {periodes.length > 0 && (
        <div className='mt-4 space-y-1.5'>
          {periodes.map((e) => {
            const meta = TYPE_EVENEMENT_META[e.type];
            const Icon = meta.icon;
            return (
              <div
                key={e.id}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${meta.card}`}
              >
                <Icon className='h-3.5 w-3.5 shrink-0 mt-0.5' aria-hidden />
                {/* Empilé plutôt qu'en ligne : la colonne du calendrier est
                    étroite, et une date tronquée ne sert à rien. */}
                <div className='min-w-0'>
                  <div className='font-medium leading-snug'>{e.titre}</div>
                  <div className='opacity-75'>{formatDateEvenement(e)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground'>
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
        {Object.keys(evenementsParJour).length > 0 && (
          <span className='flex items-center gap-1.5'>
            <span className='h-2 w-2 rounded-[1px] bg-rose-500' />
            Événement
          </span>
        )}
      </div>
    </div>
  );
}
