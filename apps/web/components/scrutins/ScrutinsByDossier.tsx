'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export interface ScrutinGroupItem {
  id: string;
  numero: number;
  titre: string;
  sort: string;
  chambre: string;
  session?: string;
  nombrePour: number;
  nombreContre: number;
  nombreAbstention: number;
  dossier: { id: string; uid: string; titre: string; titreCourt: string | null; procedureLibelle?: string | null } | null;
}

const MAX_VISIBLE = 3;

function formatDossierTitre(titre: string, procedureLibelle?: string | null): string {
  const firstChar = titre.charAt(0);
  if (firstChar !== firstChar.toUpperCase() && procedureLibelle) {
    return `${procedureLibelle} ${titre}`;
  }
  return titre;
}

function groupByDossier(scrutins: ScrutinGroupItem[]) {
  const groups: Array<{
    key: string;
    dossier: ScrutinGroupItem['dossier'];
    scrutins: ScrutinGroupItem[];
  }> = [];
  const map = new Map<string, (typeof groups)[number]>();

  for (const s of scrutins) {
    const key = s.dossier?.uid ?? 'no-dossier';
    let group = map.get(key);
    if (!group) {
      group = { key, dossier: s.dossier, scrutins: [] };
      map.set(key, group);
      groups.push(group);
    }
    group.scrutins.push(s);
  }
  return groups;
}

function ScrutinRow({ scrutin }: { scrutin: ScrutinGroupItem }) {
  const adopte = scrutin.sort === 'adopte';
  const badgeClass = adopte
    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800';

  return (
    <Link
      href={`/scrutins/${scrutin.numero}?chambre=${scrutin.chambre || 'assemblee'}${scrutin.chambre === 'senat' && scrutin.session ? `&session=${scrutin.session}` : ''}`}
      className='flex items-center gap-2 min-w-0 hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors'
    >
      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium border ${badgeClass}`}>
        {adopte ? 'Adopté' : 'Rejeté'}
      </span>
      <span className='flex-1 min-w-0 text-xs text-muted-foreground line-clamp-1'>
        {scrutin.titre}
      </span>
      <span className='shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap'>
        {scrutin.nombrePour} / {scrutin.nombreContre}
      </span>
    </Link>
  );
}

function DossierGroup({ group }: { group: ReturnType<typeof groupByDossier>[number] }) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = group.scrutins.length > MAX_VISIBLE;
  const visible = showAll ? group.scrutins : group.scrutins.slice(0, MAX_VISIBLE);

  return (
    <div className='space-y-1'>
      {group.dossier && (
        <Link
          href={`/dossiers/${group.dossier.uid}`}
          className='block text-xs font-medium text-primary/80 hover:text-primary transition-colors line-clamp-2'
        >
          {formatDossierTitre(group.dossier.titre, group.dossier.procedureLibelle)}
        </Link>
      )}
      {visible.map((scrutin) => (
        <ScrutinRow key={scrutin.id} scrutin={scrutin} />
      ))}
      {hasMore && !showAll && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
          className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5'
        >
          <ChevronDown className='h-3 w-3' />
          Voir {group.scrutins.length - MAX_VISIBLE} scrutin{group.scrutins.length - MAX_VISIBLE > 1 ? 's' : ''} de plus
        </button>
      )}
    </div>
  );
}

export function ScrutinsByDossier({
  scrutins,
  label,
}: {
  scrutins: ScrutinGroupItem[];
  label?: string;
}) {
  const groups = groupByDossier(scrutins);

  return (
    <div className='space-y-3'>
      {label && (
        <div className='text-sm font-medium text-foreground'>
          {label} ({scrutins.length})
        </div>
      )}
      {groups.map((group) => (
        <DossierGroup key={group.key} group={group} />
      ))}
    </div>
  );
}
