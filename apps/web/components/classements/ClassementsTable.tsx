'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp, ArrowDown, Users } from 'lucide-react';
import { getGroupColor } from '@/lib/colors';
import { ShareButton } from '@/components/ShareButton';

interface ParlementaireRow {
  slug: string;
  nom: string;
  prenom: string;
  photoUrl: string | null;
  chambre: 'assemblee' | 'senat';
  groupe: {
    slug: string;
    nom: string;
    couleur: string | null;
    position: string | null;
  } | null;
  stats: {
    presence: number;
    loyaute: number;
    participation: number;
    amendements: number;
    interventions: number;
  } | null;
}

interface Column {
  key: string;
  label: string;
  shortLabel?: string;
  sortable: boolean;
  format?: (value: number) => string;
  getValue: (row: ParlementaireRow) => number | null;
}

const columns: Column[] = [
  {
    key: 'presence',
    label: 'Présence',
    shortLabel: 'Prés.',
    sortable: true,
    format: (v) => `${v}%`,
    getValue: (r) => r.stats?.presence ?? null,
  },
  {
    key: 'loyaute',
    label: 'Loyauté',
    shortLabel: 'Loy.',
    sortable: true,
    format: (v) => `${v}%`,
    getValue: (r) => r.stats?.loyaute ?? null,
  },
  {
    key: 'amendements',
    label: 'Amendements',
    shortLabel: 'Amend.',
    sortable: true,
    format: (v) => v.toLocaleString('fr-FR'),
    getValue: (r) => r.stats?.amendements ?? null,
  },
  {
    key: 'interventions',
    label: 'Interventions',
    shortLabel: 'Interv.',
    sortable: true,
    format: (v) => v.toLocaleString('fr-FR'),
    getValue: (r) => r.stats?.interventions ?? null,
  },
];

interface ClassementsTableProps {
  data: ParlementaireRow[];
  sort: string;
  order: string;
  onSort: (sort: string, order: string) => void;
  page: number;
  limit: number;
  /** Filtres courants — propagés au lien de partage pour un rang fidèle. */
  chambre?: string;
  groupe?: string;
  /** Slug d'une ligne à surligner et vers laquelle scroller (deep-link). */
  highlightSlug?: string;
}

/** Construit un lien /classements qui reproduit fidèlement la vue filtrée + le rang. */
function buildHighlightUrl(params: {
  sort: string;
  order: string;
  chambre?: string;
  groupe?: string;
  slug: string;
  rank: number;
}): string {
  const sp = new URLSearchParams({ tab: 'parlementaires', sort: params.sort, order: params.order });
  if (params.chambre) sp.set('chambre', params.chambre);
  if (params.groupe) sp.set('groupe', params.groupe);
  sp.set('highlight', params.slug);
  sp.set('rank', String(params.rank));
  return `/classements?${sp.toString()}`;
}

function StatBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const width = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm tabular-nums">{value}%</span>
    </div>
  );
}

function SortIcon({ column, currentSort, currentOrder }: { column: string; currentSort: string; currentOrder: string }) {
  if (column !== currentSort) {
    return <ArrowDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />;
  }
  return currentOrder === 'desc' ? (
    <ArrowDown className="h-3 w-3 text-primary" />
  ) : (
    <ArrowUp className="h-3 w-3 text-primary" />
  );
}

export function ClassementsTable({ data, sort, order, onSort, page, limit, chambre, groupe, highlightSlug }: ClassementsTableProps) {
  const handleSort = (key: string) => {
    if (sort === key) {
      onSort(key, order === 'desc' ? 'asc' : 'desc');
    } else {
      onSort(key, 'desc');
    }
  };

  const startRank = (page - 1) * limit + 1;

  // Deep-link : scroll vers la ligne surlignée (instance visible desktop/mobile)
  // + flash temporaire qui retombe en douceur via transition-colors.
  const desktopRowRef = useRef<HTMLTableRowElement | null>(null);
  const mobileRowRef = useRef<HTMLDivElement | null>(null);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!highlightSlug) return;
    const visible =
      mobileRowRef.current && mobileRowRef.current.offsetParent !== null
        ? mobileRowRef.current
        : desktopRowRef.current && desktopRowRef.current.offsetParent !== null
          ? desktopRowRef.current
          : null;
    if (!visible) {
      setFlashing(false);
      return;
    }
    visible.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 2400);
    return () => clearTimeout(t);
  }, [highlightSlug, data]);

  const highlightClass = (slug: string) =>
    slug === highlightSlug
      ? flashing
        ? 'bg-primary/15 ring-2 ring-inset ring-primary'
        : 'bg-primary/5 ring-1 ring-inset ring-primary/40'
      : '';

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-3 text-left font-medium text-muted-foreground w-12">#</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Parlementaire</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Groupe</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="group px-3 py-3 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon column={col.key} currentSort={sort} currentOrder={order} />
                  </span>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const route = row.chambre === 'assemblee' ? 'deputes' : 'senateurs';
              const groupColor = row.groupe
                ? getGroupColor(row.groupe.nom, row.groupe.couleur, row.groupe.position)
                : '#888';
              const rank = startRank + index;

              return (
                <tr
                  key={row.slug}
                  ref={row.slug === highlightSlug ? desktopRowRef : undefined}
                  className={`group/row border-b last:border-0 transition-colors duration-700 ${
                    row.slug === highlightSlug ? highlightClass(row.slug) : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{rank}</td>
                  <td className="px-3 py-3">
                    <Link href={`/${route}/${row.slug}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                        {row.photoUrl ? (
                          <Image src={row.photoUrl} alt={`${row.prenom} ${row.nom}`} fill className="object-cover" unoptimized />
                        ) : (
                          <Users className="absolute inset-0 m-auto h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{row.prenom} {row.nom}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: groupColor }} />
                      <span className="truncate text-muted-foreground max-w-[160px]">{row.groupe?.nom ?? 'NI'}</span>
                    </div>
                  </td>
                  {columns.map((col) => {
                    const val = col.getValue(row);
                    const isPercentage = col.key === 'presence' || col.key === 'loyaute';
                    return (
                      <td key={col.key} className={`px-3 py-3 text-right ${sort === col.key ? 'font-semibold' : ''}`}>
                        {val !== null ? (
                          isPercentage ? (
                            <StatBar
                              value={val}
                              color={val >= 70 ? '#22c55e' : val >= 40 ? '#eab308' : '#ef4444'}
                            />
                          ) : (
                            <span className="tabular-nums">{col.format ? col.format(val) : val}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-3">
                    <ShareButton
                      url={buildHighlightUrl({ sort, order, chambre, groupe, slug: row.slug, rank })}
                      className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {data.map((row, index) => {
          const route = row.chambre === 'assemblee' ? 'deputes' : 'senateurs';
          const groupColor = row.groupe
            ? getGroupColor(row.groupe.nom, row.groupe.couleur, row.groupe.position)
            : '#888';
          const rank = startRank + index;

          return (
            <div
              key={row.slug}
              ref={row.slug === highlightSlug ? mobileRowRef : undefined}
              className={`relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-all duration-700 hover:shadow-md hover:border-primary/30 ${highlightClass(row.slug)}`}
            >
              {/* Lien plein-carte (sous les contrôles interactifs) */}
              <Link
                href={`/${route}/${row.slug}`}
                aria-label={`${row.prenom} ${row.nom}`}
                className="absolute inset-0 rounded-lg"
              />

              {/* Rank */}
              <span className="w-8 text-center text-sm font-bold text-muted-foreground tabular-nums">
                {rank}
              </span>

              {/* Photo */}
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {row.photoUrl ? (
                  <Image src={row.photoUrl} alt={`${row.prenom} ${row.nom}`} fill className="object-cover" unoptimized />
                ) : (
                  <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.prenom} {row.nom}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: groupColor }} />
                  <span className="truncate text-xs text-muted-foreground">{row.groupe?.nom ?? 'NI'}</span>
                </div>
              </div>

              {/* Main stat */}
              {(() => {
                const col = columns.find((c) => c.key === sort);
                const val = col?.getValue(row) ?? null;
                return (
                  <div className="shrink-0 text-right">
                    {col && val !== null ? (
                      <>
                        <p className="text-sm font-bold">
                          {col.format ? col.format(val) : val}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {col.shortLabel ?? col.label}
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })()}

              {/* Partage (au-dessus du lien plein-carte) */}
              <ShareButton
                url={buildHighlightUrl({ sort, order, chambre, groupe, slug: row.slug, rank })}
                className="relative z-10 shrink-0"
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
