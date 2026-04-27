'use client';

import { useState, useMemo, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';
import { MonthCalendar } from './components/MonthCalendar';
import { DayDetail } from './components/DayDetail';
import type { AgendaReunion } from './components/ReunionCard';

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
}

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

function todayStr(): string {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

function AgendaPageContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const initialDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(dateParam + 'T12:00:00') : new Date();

  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr(),
  );

  const [filters, setFilter, , clearAll] = useUrlFilters<{
    chambre: string;
    type: string;
  }>(['chambre', 'type']);

  const dateFrom = getFirstDayOfMonth(year, month);
  const dateTo = getLastDayOfMonth(year, month);

  const { data, isLoading, error } = useQuery<AgendaResponse>({
    queryKey: ['agenda', year, month, filters.chambre, filters.type],
    queryFn: () =>
      api
        .get('/agenda', {
          params: {
            dateFrom,
            dateTo,
            type: filters.type || 'tous',
            chambre: filters.chambre || undefined,
            limit: 1000,
          },
        })
        .then((res) => res.data),
    staleTime: 60000,
  });

  const byDay = data?.byDay ?? {};

  // When month changes, select the first day that has reunions (or null)
  const handlePrevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const selectedReunions = useMemo<AgendaReunion[]>(() => {
    if (!selectedDate) return [];
    return (byDay[selectedDate] ?? []) as AgendaReunion[];
  }, [selectedDate, byDay]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.chambre) n++;
    if (filters.type) n++;
    return n;
  }, [filters]);

  const totalThisMonth = data?.total ?? 0;

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Agenda parlementaire</h1>
        <p className='mt-1 text-muted-foreground'>
          {isLoading
            ? 'Chargement...'
            : totalThisMonth > 0
              ? `${totalThisMonth} réunion${totalThisMonth > 1 ? 's' : ''} ce mois`
              : 'Aucune réunion ce mois'}{' '}
          — Assemblée nationale &amp; Sénat
        </p>
      </div>

      {/* Filtres */}
      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={() => clearAll()}
        search={<div />}
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
          </select>
          <ChevronDown className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
        </div>
      </FilterBar>

      {/* Error */}
      {error && (
        <div className='mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive'>
          Erreur lors du chargement de l&apos;agenda.
        </div>
      )}

      {/* Main layout: calendar + day detail */}
      <div className='grid gap-6 lg:grid-cols-[380px_1fr]'>
        {/* Left: Calendar */}
        <div className='rounded-lg border bg-card p-5'>
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
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          )}
        </div>

        {/* Right: Day detail */}
        <div className='rounded-lg border bg-card p-5'>
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
            <DayDetail selectedDate={selectedDate} reunions={selectedReunions} />
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
