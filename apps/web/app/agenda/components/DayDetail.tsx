'use client';

import { useEffect } from 'react';
import { ReunionCard, type AgendaReunion } from './ReunionCard';
import { Calendar } from 'lucide-react';

interface DayDetailProps {
  selectedDate: string | null; // 'YYYY-MM-DD'
  reunions: AgendaReunion[];
}

const DAY_NAMES_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDayTitle(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const dayName = DAY_NAMES_FULL[date.getDay()]!;
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()]!;
  const year = date.getFullYear();
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day} ${month} ${year}`;
}

export function DayDetail({ selectedDate, reunions }: DayDetailProps) {
  if (!selectedDate) {
    return (
      <div className='flex flex-col items-center justify-center py-16 text-center text-muted-foreground'>
        <Calendar className='h-10 w-10 mb-3 opacity-30' />
        <p className='text-sm'>Sélectionnez un jour dans le calendrier</p>
        <p className='text-xs mt-1'>Les jours avec un point ont des réunions</p>
      </div>
    );
  }

  if (reunions.length === 0) {
    return (
      <div>
        <h3 className='text-base font-semibold mb-4 capitalize'>{formatDayTitle(selectedDate)}</h3>
        <div className='flex flex-col items-center justify-center py-12 text-center text-muted-foreground'>
          <Calendar className='h-8 w-8 mb-3 opacity-30' />
          <p className='text-sm'>Aucune réunion ce jour</p>
        </div>
      </div>
    );
  }

  // Sort by time
  const sorted = [...reunions].sort(
    (a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime(),
  );

  // Scroll to anchor once reunions are available
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [sorted.length]);

  return (
    <div>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-base font-semibold capitalize'>{formatDayTitle(selectedDate)}</h3>
        <span className='text-sm text-muted-foreground'>
          {reunions.length} réunion{reunions.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className='space-y-2'>
        {sorted.map((reunion) => (
          <ReunionCard key={reunion.id} reunion={reunion} />
        ))}
      </div>
    </div>
  );
}
