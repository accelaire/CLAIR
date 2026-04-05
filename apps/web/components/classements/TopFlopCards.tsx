'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Trophy, TrendingDown, Users } from 'lucide-react';
import { getGroupColor } from '@/lib/colors';

interface ParlementaireItem {
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

interface TopFlopCardsProps {
  top: ParlementaireItem[];
  flop: ParlementaireItem[];
  criterionLabel: string;
  getValue: (item: ParlementaireItem) => number | null;
  formatValue: (value: number) => string;
}

function MiniCard({
  item,
  rank,
  value,
  formatValue,
  variant,
}: {
  item: ParlementaireItem;
  rank: number;
  value: number | null;
  formatValue: (v: number) => string;
  variant: 'top' | 'flop';
}) {
  const route = item.chambre === 'assemblee' ? 'deputes' : 'senateurs';
  const groupColor = item.groupe
    ? getGroupColor(item.groupe.nom, item.groupe.couleur, item.groupe.position)
    : '#888';

  return (
    <Link
      href={`/${route}/${item.slug}`}
      className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:shadow-md hover:border-primary/30"
    >
      {/* Rank badge */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          variant === 'top'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}
      >
        {rank}
      </div>

      {/* Photo */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={`${item.prenom} ${item.nom}`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <Users className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
          {item.prenom} {item.nom}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: groupColor }}
          />
          <span className="truncate text-xs text-muted-foreground">
            {item.groupe?.nom ?? 'Non inscrit'}
          </span>
        </div>
      </div>

      {/* Value */}
      <span
        className={`shrink-0 text-sm font-bold ${
          variant === 'top'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {value !== null ? formatValue(value) : '—'}
      </span>
    </Link>
  );
}

export function TopFlopCards({
  top,
  flop,
  criterionLabel,
  getValue,
  formatValue,
}: TopFlopCardsProps) {
  if (top.length === 0 && flop.length === 0) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2 mb-8">
      {/* Top 5 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold">
            Top 5 — {criterionLabel}
          </h3>
        </div>
        <div className="space-y-2">
          {top.map((item, i) => (
            <MiniCard
              key={item.slug}
              item={item}
              rank={i + 1}
              value={getValue(item)}
              formatValue={formatValue}
              variant="top"
            />
          ))}
        </div>
      </div>

      {/* Flop 5 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h3 className="font-semibold">
            Flop 5 — {criterionLabel}
          </h3>
        </div>
        <div className="space-y-2">
          {flop.map((item, i) => (
            <MiniCard
              key={item.slug}
              item={item}
              rank={flop.length - i}
              value={getValue(item)}
              formatValue={formatValue}
              variant="flop"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
