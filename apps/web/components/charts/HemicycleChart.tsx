'use client';

import { useMemo, useState } from 'react';
import { getGroupColor } from '@/lib/colors';
import { positionsHemicycle } from '@/lib/hemicycle-geometrie';

interface GroupeData {
  id: string;
  slug: string;
  nom: string;
  nomComplet?: string | null;
  couleur: string | null;
  logoUrl?: string | null;
  position: string | null;
  membresCount: number;
  ordre: number;
}

interface HemicycleChartProps {
  groupes: GroupeData[];
  chambre: 'assemblee' | 'senat';
  onGroupClick?: (groupe: GroupeData) => void;
  selectedSlug?: string;
  highlightedSlugs?: string[]; // Si défini, seuls ces groupes sont mis en avant
}

// Ordre des positions de gauche à droite
const POSITION_ORDER: Record<string, number> = {
  extreme_gauche: 0,
  gauche: 1,
  centre_gauche: 2,
  centre: 3,
  centre_droit: 4,
  droite: 5,
  extreme_droite: 6,
};

// Fonction pour déterminer la position effective d'un groupe
// Les Non-Inscrits (NI) sont toujours placés à l'extrême droite
function getEffectivePosition(groupe: GroupeData): number {
  if (groupe.slug === 'ni' || groupe.nom === 'NI') {
    return 7; // Après extreme_droite
  }
  return POSITION_ORDER[groupe.position || 'centre'] ?? 3;
}

interface Seat {
  x: number;
  y: number;
  groupe: GroupeData;
  index: number;
}

function generateHemicycleSeats(
  groupes: GroupeData[],
  totalSeats: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number
): Seat[] {
  // Trier les groupes par position politique (gauche à droite)
  const sortedGroupes = [...groupes].sort((a, b) => {
    const posA = getEffectivePosition(a);
    const posB = getEffectivePosition(b);
    if (posA !== posB) return posA - posB;
    return a.ordre - b.ordre;
  });

  // Créer une liste plate de tous les sièges avec leur groupe assigné
  // Chaque groupe a exactement membresCount sièges
  const allSeatsWithGroups: GroupeData[] = [];
  for (const groupe of sortedGroupes) {
    for (let i = 0; i < groupe.membresCount; i++) {
      allSeatsWithGroups.push(groupe);
    }
  }

  const seatPositions = positionsHemicycle(totalSeats, centerX, centerY, innerRadius, outerRadius);

  // Assigner les groupes aux positions triées par angle
  const seats: Seat[] = [];
  for (let i = 0; i < Math.min(seatPositions.length, allSeatsWithGroups.length); i++) {
    const pos = seatPositions[i];
    seats.push({
      x: pos.x,
      y: pos.y,
      groupe: allSeatsWithGroups[i],
      index: i,
    });
  }

  return seats;
}

export function HemicycleChart({
  groupes,
  chambre,
  onGroupClick,
  selectedSlug,
  highlightedSlugs,
}: HemicycleChartProps) {
  const [hoveredGroupe, setHoveredGroupe] = useState<string | null>(null);
  const [tappedGroupe, setTappedGroupe] = useState<string | null>(null);

  // Handle click/tap: first tap selects, second tap on same group navigates
  const handleGroupInteraction = (groupe: GroupeData) => {
    if (tappedGroupe === groupe.slug) {
      // Second tap on same group -> navigate
      onGroupClick?.(groupe);
      setTappedGroupe(null);
    } else {
      // First tap -> select this group
      setTappedGroupe(groupe.slug);
    }
  };

  // Active group is either hovered (desktop) or tapped (mobile)
  const activeGroupe = hoveredGroupe || tappedGroupe;

  // Si highlightedSlugs est défini et non vide, on est en mode "filtrage"
  const isFiltering = highlightedSlugs && highlightedSlugs.length > 0;
  const highlightedSet = new Set(highlightedSlugs || []);

  const totalSeats = useMemo(
    () => groupes.reduce((acc, g) => acc + g.membresCount, 0),
    [groupes]
  );

  const viewBoxWidth = 500;
  const viewBoxHeight = 280;
  const centerX = viewBoxWidth / 2;
  const centerY = viewBoxHeight - 20;
  const innerRadius = 80;
  const outerRadius = 240;

  const seats = useMemo(
    () =>
      generateHemicycleSeats(groupes, totalSeats, centerX, centerY, innerRadius, outerRadius),
    [groupes, totalSeats, centerX, centerY]
  );

  const seatRadius = 5;

  return (
    <div className="w-full h-full flex flex-col">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full flex-1 min-h-0"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Sièges */}
        {seats.map((seat, i) => {
          const color = getGroupColor(seat.groupe.nom, seat.groupe.couleur, seat.groupe.position);
          const isActive = activeGroupe === seat.groupe.slug;
          const isSelected = selectedSlug === seat.groupe.slug;
          const isOther = activeGroupe && activeGroupe !== seat.groupe.slug;
          const isHighlighted = !isFiltering || highlightedSet.has(seat.groupe.slug);
          const isDimmed = (isFiltering && !isHighlighted) || isOther;

          return (
            <circle
              key={i}
              cx={seat.x}
              cy={seat.y}
              r={seatRadius}
              fill={isDimmed ? '#e5e7eb' : color}
              opacity={isDimmed ? 0.5 : 1}
              stroke={isSelected ? '#000' : isActive ? '#fff' : isHighlighted && isFiltering ? color : 'none'}
              strokeWidth={isSelected || isActive ? 1.5 : isHighlighted && isFiltering ? 0.5 : 0}
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => setHoveredGroupe(seat.groupe.slug)}
              onMouseLeave={() => setHoveredGroupe(null)}
              onClick={() => handleGroupInteraction(seat.groupe)}
            />
          );
        })}

        {/* Centre label - shows tapped group or total seats */}
        {tappedGroupe ? (
          <>
            <text
              x={centerX}
              y={centerY - 25}
              textAnchor="middle"
              className="fill-foreground font-semibold"
              style={{ fontSize: '14px' }}
            >
              {groupes.find(g => g.slug === tappedGroupe)?.nom}
            </text>
            <text
              x={centerX}
              y={centerY - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: '11px' }}
            >
              Tapez à nouveau pour voir →
            </text>
          </>
        ) : (
          <text
            x={centerX}
            y={centerY - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-xs font-medium"
            style={{ fontSize: '14px' }}
          >
            {totalSeats} {chambre === 'assemblee' ? 'sièges' : 'sièges'}
          </text>
        )}
      </svg>

      {/* Légende */}
      <div className="flex flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-4 justify-center shrink-0">
        {[...groupes]
          .sort((a, b) => {
            const posA = getEffectivePosition(a);
            const posB = getEffectivePosition(b);
            return posA - posB;
          })
          .map((g) => {
            const color = getGroupColor(g.nom, g.couleur, g.position);
            const isActive = activeGroupe === g.slug;
            return (
              <button
                key={g.slug}
                className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-full transition-all cursor-pointer border ${
                  isActive || selectedSlug === g.slug
                    ? 'bg-accent ring-2 ring-primary border-primary'
                    : 'hover:bg-accent hover:border-primary/50 border-transparent'
                }`}
                onMouseEnter={() => setHoveredGroupe(g.slug)}
                onMouseLeave={() => setHoveredGroupe(null)}
                onClick={() => handleGroupInteraction(g)}
              >
                {g.logoUrl ? (
                  <img
                    src={g.logoUrl}
                    alt={g.nom}
                    className="w-3 h-3 sm:w-4 sm:h-4 object-contain"
                  />
                ) : (
                  <div
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="text-muted-foreground hover:text-foreground transition-colors">
                  {g.nom}
                </span>
                <span className="font-semibold" style={{ color }}>
                  {g.membresCount}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
