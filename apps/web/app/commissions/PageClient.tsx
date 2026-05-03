'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronDown, Users, Calendar, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { FilterBar } from '@/components/FilterBar';

interface Commission {
  id: string;
  uid: string;
  slug: string;
  chambre: string;
  type: string;
  nom: string;
  nomCourt: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  actif: boolean;
  nbMembres: number;
  nbReunions: number;
}

interface CommissionsResponse {
  data: Commission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const TYPE_LABELS: Record<string, string> = {
  permanente: 'Commissions permanentes',
  enquete: "Commissions d'enquête",
  speciale: 'Commissions spéciales',
  mixte_paritaire: 'Commissions mixtes paritaires',
  hemicycle: 'Hémicycle',
  autre: 'Autres commissions',
};

const TYPE_ORDER = ['permanente', 'enquete', 'speciale', 'mixte_paritaire', 'hemicycle', 'autre'];

function ChambreBadge({ chambre }: { chambre: string }) {
  const isAN = chambre === 'assemblee';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isAN ? 'badge-assemblee' : 'badge-senat'
      }`}
    >
      {isAN ? 'AN' : 'Sénat'}
    </span>
  );
}

function CommissionCard({ commission }: { commission: Commission }) {
  return (
    <Link
      href={`/commissions/${commission.slug}`}
      className="group block rounded-lg border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
    >
      <div className='flex items-start justify-between gap-2 mb-3'>
        <h3 className='font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2'>
          {commission.nomCourt || commission.nom}
        </h3>
        <ChambreBadge chambre={commission.chambre} />
      </div>
      {commission.nomCourt && (
        <p className='text-xs text-muted-foreground mb-3 line-clamp-2'>{commission.nom}</p>
      )}
      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1'>
          <Users className='h-3.5 w-3.5' />
          {commission.nbMembres} membres
        </span>
        <span className='flex items-center gap-1'>
          <Calendar className='h-3.5 w-3.5' />
          {commission.nbReunions} réunions
        </span>
      </div>
      {!commission.actif && (
        <span className='mt-2 inline-block text-xs text-muted-foreground/60 italic'>Inactive</span>
      )}
    </Link>
  );
}

function CommissionsPageContent() {
  const [filters, setFilter, , clearAll] = useUrlFilters<{
    chambre: string;
    type: string;
  }>(['chambre', 'type']);

  const { data, isLoading, error } = useQuery<CommissionsResponse>({
    queryKey: ['commissions', filters],
    queryFn: () =>
      api
        .get('/commissions', {
          params: {
            chambre: filters.chambre || undefined,
            type: filters.type || undefined,
            limit: 200,
          },
        })
        .then((res) => res.data),
    staleTime: 60000,
  });

  const commissions = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  // Group by type, respecting order
  const grouped = useMemo(() => {
    const map: Record<string, Commission[]> = {};
    for (const c of commissions) {
      if (!map[c.type]) map[c.type] = [];
      map[c.type].push(c);
    }
    // Sort types by defined order, then alphabetically within each group
    return TYPE_ORDER.filter((t) => map[t] && map[t].length > 0).map((t) => ({
      type: t,
      label: TYPE_LABELS[t] || t,
      items: map[t],
    }));
  }, [commissions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.chambre) count++;
    if (filters.type) count++;
    return count;
  }, [filters]);

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center gap-3'>
          <Building2 className='h-8 w-8 text-primary' />
          <div>
            <h1 className='text-3xl font-bold'>Commissions parlementaires</h1>
            <p className='mt-1 text-muted-foreground'>
              {total > 0 ? `${total} commissions` : '—'} — Assemblée nationale & Sénat
            </p>
          </div>
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>
          Source :{' '}
          <a
            href='https://data.assemblee-nationale.fr'
            target='_blank'
            rel='noopener noreferrer'
            className='underline hover:text-foreground'
          >
            data.assemblee-nationale.fr
          </a>
          {' · '}
          <Link href='/comprendre/commissions' className='underline hover:text-foreground'>
            Comprendre les commissions
          </Link>
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
            <option value='permanente'>Permanentes</option>
            <option value='enquete'>Enquête</option>
            <option value='speciale'>Spéciales</option>
            <option value='mixte_paritaire'>Mixtes paritaires</option>
          </select>
          <ChevronDown className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none' />
        </div>
      </FilterBar>

      {/* Loading */}
      {isLoading && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className='animate-pulse rounded-lg border bg-card p-4'>
              <div className='h-4 w-3/4 rounded bg-muted mb-3' />
              <div className='h-3 w-1/2 rounded bg-muted mb-3' />
              <div className='flex gap-4'>
                <div className='h-3 w-20 rounded bg-muted' />
                <div className='h-3 w-20 rounded bg-muted' />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive'>
          Une erreur est survenue lors du chargement des commissions.
        </div>
      )}

      {/* Grouped list */}
      {!isLoading && !error && grouped.length === 0 && (
        <div className='py-12 text-center text-muted-foreground'>
          Aucune commission ne correspond à vos filtres.
        </div>
      )}

      {grouped.map(({ type, label, items }) => (
        <section key={type} className='mb-10'>
          <div className='mb-4 flex items-center gap-3'>
            <h2 className='text-lg font-semibold'>{label}</h2>
            <span className='text-sm text-muted-foreground'>({items.length})</span>
          </div>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {items.map((commission) => (
              <CommissionCard key={commission.id} commission={commission} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function PageClient() {
  return (
    <Suspense
      fallback={
        <div className='container mx-auto px-4 py-8'>
          <div className='mb-8'>
            <div className='h-8 w-64 animate-pulse rounded bg-muted' />
            <div className='mt-2 h-4 w-40 animate-pulse rounded bg-muted' />
          </div>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className='animate-pulse rounded-lg border bg-card p-4'>
                <div className='h-4 w-3/4 rounded bg-muted mb-3' />
                <div className='h-3 w-1/2 rounded bg-muted' />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <CommissionsPageContent />
    </Suspense>
  );
}
