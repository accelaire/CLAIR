'use client';

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { jourAParis } from '@/lib/live-url';

interface ReunionDuJour {
  etat?: string | null;
  commission?: { chambre?: string | null } | null;
}

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const PASTILLE: Record<string, string> = {
  assemblee: 'bg-purple-500 dark:bg-purple-400',
  senat: 'bg-blue-500 dark:bg-blue-400',
};

function decaler(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Le lundi de la semaine d'un jour. */
function lundi(jour: string): string {
  const dow = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;
  return decaler(jour, -dow);
}

/**
 * La semaine du jour choisi, en bande, pour le téléphone : le mois entier
 * prenait tout le premier écran et repoussait la journée sous la ligne de
 * flottaison. Le mois reste à un appui.
 */
export function SemaineMobile({
  selectedDate,
  byDay,
  onSelectDate,
  moisOuvert,
  onToggleMois,
}: {
  selectedDate: string | null;
  byDay: Record<string, ReunionDuJour[]>;
  onSelectDate: (jour: string) => void;
  moisOuvert: boolean;
  onToggleMois: () => void;
}) {
  const aujourdhui = jourAParis(Date.now());
  const reference = selectedDate ?? aujourdhui;
  const debut = lundi(reference);
  const jours = Array.from({ length: 7 }, (_, i) => decaler(debut, i));

  return (
    <div className='mx-auto max-w-md space-y-2'>
      <div className='flex items-center gap-1'>
        <button
          type='button'
          onClick={() => onSelectDate(decaler(reference, -7))}
          className='rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          aria-label='Semaine précédente'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>
        <div className='grid flex-1 grid-cols-7 gap-1'>
          {jours.map((jour, i) => {
            const actives = (byDay[jour] ?? []).filter((r) => r.etat !== 'annule');
            const chambres = (['assemblee', 'senat'] as const).filter((c) =>
              actives.some((r) => r.commission?.chambre === c),
            );
            const choisi = jour === selectedDate;
            const estAujourdhui = jour === aujourdhui;
            return (
              <button
                key={jour}
                type='button'
                onClick={() => onSelectDate(jour)}
                aria-pressed={choisi}
                aria-label={`${Number(jour.slice(8))} — ${actives.length} réunion${actives.length > 1 ? 's' : ''}`}
                className={`flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                  choisi
                    ? 'bg-primary text-primary-foreground'
                    : estAujourdhui
                      ? 'text-primary ring-1 ring-inset ring-primary/40'
                      : i >= 5
                        ? 'text-muted-foreground hover:bg-accent'
                        : 'hover:bg-accent'
                }`}
              >
                <span className={`text-[11px] ${choisi ? 'opacity-80' : 'text-muted-foreground'}`}>{LETTRES[i]}</span>
                <span className='text-sm font-semibold tabular-nums'>{Number(jour.slice(8))}</span>
                <span className='mt-0.5 flex h-1.5 items-center gap-0.5'>
                  {chambres.map((c) => (
                    <span
                      key={c}
                      className={`h-1.5 w-1.5 rounded-full ${choisi ? 'bg-primary-foreground/80' : PASTILLE[c]}`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type='button'
          onClick={() => onSelectDate(decaler(reference, 7))}
          className='rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          aria-label='Semaine suivante'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>
      <button
        type='button'
        onClick={onToggleMois}
        aria-expanded={moisOuvert}
        className='mx-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
      >
        <CalendarDays className='h-3.5 w-3.5' aria-hidden />
        {moisOuvert ? 'Masquer le mois' : 'Voir le mois'}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moisOuvert ? 'rotate-180' : ''}`} aria-hidden />
      </button>
    </div>
  );
}
