'use client';

import { nomGroupe, type GroupeRepartition } from '../PageClient';

interface RepartitionGroupesProps {
  parGroupe: GroupeRepartition[];
  total: number;
}

export function RepartitionGroupes({ parGroupe, total }: RepartitionGroupesProps) {
  if (total === 0 || parGroupe.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full overflow-hidden rounded-md" role="img" aria-label="Répartition des sièges sortants par groupe politique">
        {parGroupe.map((groupe) => (
          <span
            key={groupe.slug}
            // Un groupe à un siège pèse 0,6 % de la barre : sans largeur plancher,
            // il disparaît complètement du rendu.
            style={{
              width: `${(groupe.sieges / total) * 100}%`,
              minWidth: '2px',
              backgroundColor: groupe.couleur || '#888',
            }}
            title={`${nomGroupe(groupe)} — ${groupe.sieges} siège${groupe.sieges > 1 ? 's' : ''}`}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {parGroupe.map((groupe) => (
          <li key={groupe.slug} className="flex items-center gap-1.5 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: groupe.couleur || '#888' }}
            />
            <span>{nomGroupe(groupe)}</span>
            <span className="text-muted-foreground">{groupe.sieges}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
