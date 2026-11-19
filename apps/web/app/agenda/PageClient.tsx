'use client';

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { reunionsParJour } from '@/lib/agenda';
import { jourAParis } from '@/lib/live-url';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';
import { MonthCalendar } from './components/MonthCalendar';
import { DayDetail } from './components/DayDetail';
import { SemaineMobile } from './components/SemaineMobile';
import type { AgendaReunion } from './components/ReunionCard';
import { joursCouverts, type AgendaEvenement } from './components/EvenementCard';

interface AgendaResponse {
  dateFrom: string;
  dateTo: string;
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  byDay: Record<string, AgendaReunion[]>;
  evenements: AgendaEvenement[];
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function toDateStr(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function getFirstDayOfMonth(year: number, month: number): string {
  return toDateStr(year, month, 1);
}

function getLastDayOfMonth(year: number, month: number): string {
  const last = new Date(year, month + 1, 0).getDate();
  return toDateStr(year, month, last);
}

/** Aujourd'hui à Paris : c'est le jour de l'agenda, quel que soit le fuseau du lecteur. */
function todayStr(): string {
  return jourAParis(Date.now());
}

function decalerJour(dateStr: string, jours: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function AgendaPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dateParam = searchParams.get('date');
  const initialDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(dateParam + 'T12:00:00') : new Date();

  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDateRaw] = useState<string | null>(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr(),
  );

  const setSelectedDate = useCallback(
    (date: string | null) => {
      setSelectedDateRaw(date);
      const params = new URLSearchParams(searchParams.toString());
      if (date) params.set('date', date);
      else params.delete('date');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // Restore month/year from URL date param when navigating back
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const d = new Date(dateParam + 'T12:00:00');
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setSelectedDateRaw(dateParam);
    }
  }, [dateParam]);

  const [filters, setFilter, , clearAll] = useUrlFilters<{
    chambre: string;
    type: string;
  }>(['chambre', 'type']);

  // Une semaine de marge avant le mois : une mission commencée fin octobre
  // court encore début novembre. Un jour après : l'API borne en UTC, et une
  // réunion du 1er à 0 h 30 à Paris tombe la veille en UTC.
  const premierJour = getFirstDayOfMonth(year, month);
  const dernierJour = getLastDayOfMonth(year, month);
  const dateFrom = decalerJour(premierJour, -7);
  const dateTo = decalerJour(dernierJour, 1);
  const prefixeMois = premierJour.slice(0, 7);

  const { data, isLoading, error } = useQuery<AgendaResponse>({
    queryKey: ['agenda', year, month, filters.chambre, filters.type],
    queryFn: () =>
      api
        .get('/agenda', {
          params: {
            dateFrom,
            dateTo,
            type: filters.type || undefined,
            chambre: filters.chambre || undefined,
            limit: 1000,
          },
        })
        .then((res) => res.data),
    staleTime: 60000,
  });

  // Rangées par jour À PARIS, missions de plusieurs jours à chacun de leurs jours.
  const byDay = useMemo(
    () => reunionsParJour(Object.values(data?.byDay ?? {}).flat()),
    [data],
  );

  const reunionsDuMois = useMemo(() => {
    const ids = new Set<string>();
    for (const [jour, liste] of Object.entries(byDay)) {
      if (!jour.startsWith(prefixeMois)) continue;
      for (const r of liste) if (r.etat !== 'annule') ids.add(r.id);
    }
    return ids.size;
  }, [byDay, prefixeMois]);

  // Changer de mois sélectionne un jour : aujourd'hui s'il en fait partie,
  // sinon le premier jour qui a des réunions, une fois les données arrivées.
  const [selectionEnAttente, setSelectionEnAttente] = useState(false);

  const allerAuMois = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    const aujourdhui = todayStr();
    if (aujourdhui.startsWith(toDateStr(y, m, 1).slice(0, 7))) {
      setSelectedDate(aujourdhui);
    } else {
      setSelectedDate(null);
      setSelectionEnAttente(true);
    }
  };

  useEffect(() => {
    if (!selectionEnAttente || !data) return;
    setSelectionEnAttente(false);
    const premier = Object.keys(byDay)
      .filter((j) => j.startsWith(prefixeMois))
      .sort()[0];
    if (premier) setSelectedDate(premier);
  }, [selectionEnAttente, data, byDay, prefixeMois, setSelectedDate]);

  const handlePrevMonth = () => (month === 0 ? allerAuMois(year - 1, 11) : allerAuMois(year, month - 1));
  const handleNextMonth = () => (month === 11 ? allerAuMois(year + 1, 0) : allerAuMois(year, month + 1));

  /** Un jour quelconque, mois suivant ou précédent compris. */
  const allerAuJour = useCallback(
    (jour: string) => {
      const [y, m] = jour.split('-').map(Number);
      setYear(y!);
      setMonth(m! - 1);
      setSelectedDate(jour);
    },
    [setSelectedDate],
  );

  const evenements = useMemo(() => data?.evenements ?? [], [data]);

  // Après minuit, la séance de 21 h 30 est souvent encore en direct : la
  // journée en cours reprend la veille, et n'en garde que ce qui dure encore.
  const reunionsDeLaVeille = useMemo<AgendaReunion[]>(() => {
    if (!selectedDate || selectedDate !== todayStr()) return [];
    return (byDay[decalerJour(selectedDate, -1)] ?? []) as AgendaReunion[];
  }, [selectedDate, byDay]);

  const selectedReunions = useMemo<AgendaReunion[]>(() => {
    if (!selectedDate) return [];
    return (byDay[selectedDate] ?? []) as AgendaReunion[];
  }, [selectedDate, byDay]);

  // Un jour donné hérite des événements ponctuels tombant dessus ET des périodes
  // qui le couvrent : sélectionner le 10 septembre doit rappeler que les travaux
  // sont suspendus, même si la suspension a commencé en juillet.
  const selectedEvenements = useMemo<AgendaEvenement[]>(() => {
    if (!selectedDate) return [];
    return evenements.filter((e) => joursCouverts(e).includes(selectedDate));
  }, [selectedDate, evenements]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.chambre) n++;
    if (filters.type) n++;
    return n;
  }, [filters]);

  const [moisOuvert, setMoisOuvert] = useState(false);
  const totalThisMonth = reunionsDuMois;
  const estAujourdhui = selectedDate === todayStr();

  return (
    <div className='container mx-auto px-4 pt-8'>
      {/* Header + Filtres. Plus ancrés sous le header du site : à 800 px de
          haut, ils mangeaient un tiers de l'écran et masquaient les cartes. */}
      <div className='pt-4 pb-4 border-b'>
        <div className='mb-4'>
          <h1 className='text-3xl font-bold'>Agenda parlementaire</h1>
          <p className='mt-1 text-muted-foreground'>
            {isLoading
              ? 'Chargement...'
              : [
                totalThisMonth > 0
                  ? `${totalThisMonth} réunion${totalThisMonth > 1 ? 's' : ''} en ${MOIS[month]}`
                  : null,
                evenements.length > 0
                  ? `${evenements.length} événement${evenements.length > 1 ? 's' : ''}`
                  : null,
              ].filter(Boolean).join(' · ') || 'Rien ce mois'}{' '}
            — Assemblée nationale &amp; Sénat
          </p>
        </div>

        <FilterBar
          activeFilterCount={activeFilterCount}
          onClear={() => clearAll()}
          search={
            <button
              type='button'
              onClick={() => allerAuJour(todayStr())}
              disabled={estAujourdhui}
              className='rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-background'
            >
              Aujourd&apos;hui
            </button>
          }
        >
          <div className='relative'>
            <select
              value={filters.chambre}
              onChange={(e) => setFilter('chambre', e.target.value)}
              className='appearance-none rounded-lg border bg-background px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
            >
              <option value=''>Toutes les chambres</option>
              <option value='assemblee'>Assemblée nationale</option>
              <option value='senat'>Sénat</option>
            </select>
            <ChevronDown className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
          </div>
          <div className='relative'>
            <select
              value={filters.type}
              onChange={(e) => setFilter('type', e.target.value)}
              className='appearance-none rounded-lg border bg-background px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
            >
              <option value=''>Tous les types</option>
              <option value='commission'>Commissions</option>
              <option value='seance'>Séances publiques</option>
              <option value='evenement'>Événements institutionnels</option>
            </select>
            <ChevronDown className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
          </div>
        </FilterBar>
      </div>

      {/* Error */}
      {error && (
        <div className='mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive'>
          Erreur lors du chargement de l&apos;agenda.
        </div>
      )}

      {/* Main layout: calendar sticky + day detail */}
      <div className='grid gap-6 lg:grid-cols-[380px_1fr] items-start py-6'>
        {/* Téléphone : la semaine en bande, le mois à la demande. */}
        <div className='lg:hidden'>
          <SemaineMobile
            selectedDate={selectedDate}
            byDay={byDay}
            onSelectDate={allerAuJour}
            moisOuvert={moisOuvert}
            onToggleMois={() => setMoisOuvert((v) => !v)}
          />
        </div>

        {/* Left: Calendar — sticky sous le header page */}
        <div className={`rounded-lg border bg-card p-5 lg:sticky lg:top-20 lg:block lg:self-start ${moisOuvert ? '' : 'hidden'}`}>
          {isLoading ? (
            <div className='animate-pulse space-y-3'>
              <div className='flex justify-between'>
                <div className='h-8 w-8 rounded bg-muted' />
                <div className='h-6 w-32 rounded bg-muted' />
                <div className='h-8 w-8 rounded bg-muted' />
              </div>
              <div className='grid grid-cols-7 gap-1'>
                {Array.from({ length: 42 }).map((_, i) => (
                  <div key={i} className='h-9 rounded bg-muted' />
                ))}
              </div>
            </div>
          ) : (
            <MonthCalendar
              year={year}
              month={month}
              byDay={byDay}
              evenements={evenements}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
        </div>

        {/* Right: Day detail — défile avec la page. Sans cadre sur téléphone :
            des cartes dans un cadre dans la page perdaient un tiers de la largeur. */}
        <div className='min-w-0 lg:rounded-lg lg:border lg:bg-card lg:p-5'>
          {isLoading ? (
            <div className='animate-pulse space-y-3'>
              <div className='h-6 w-48 rounded bg-muted' />
              <div className='space-y-2'>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className='h-20 rounded-lg border bg-muted' />
                ))}
              </div>
            </div>
          ) : (
            <DayDetail
              selectedDate={selectedDate}
              reunions={selectedReunions}
              veille={reunionsDeLaVeille}
              evenements={selectedEvenements}
              onNavigate={allerAuJour}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PageClient() {
  return (
    <Suspense
      fallback={
        <div className='container mx-auto px-4 py-8'>
          <div className='mb-8 animate-pulse'>
            <div className='h-8 w-56 rounded bg-muted' />
            <div className='mt-2 h-4 w-40 rounded bg-muted' />
          </div>
          <div className='grid gap-6 lg:grid-cols-[380px_1fr]'>
            <div className='animate-pulse rounded-lg border bg-card p-5 h-80' />
            <div className='animate-pulse rounded-lg border bg-card p-5 h-80' />
          </div>
        </div>
      }
    >
      <AgendaPageContent />
    </Suspense>
  );
}
