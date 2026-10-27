/**
 * Géométrie d'un hémicycle, en fonctions pures : la position de chaque siège, rangés de la
 * gauche (angle π) vers la droite (angle 0), colonne par colonne.
 * Portée de apps/web lib/hemicycle-geometrie.ts : deux dessins de la même chambre doivent
 * placer les sièges au même endroit pour rester comparables.
 */

export type SeatPosition = {
  x: number;
  y: number;
  /** Angle en radians, de π (gauche) à 0 (droite). */
  angle: number;
  /** Rangée, de 0 (intérieure) à `rowCount - 1` (extérieure). */
  row: number;
};

/** Nombre de rangées selon la taille de la chambre (AN 577 → 12, Sénat 348 → 8). */
export const rowCountFor = (totalSeats: number) =>
  totalSeats > 500 ? 12 : totalSeats > 400 ? 10 : 8;

/** Rayon du milieu d'une rangée. */
const rowRadius = (row: number, innerRadius: number, rowSpacing: number) =>
  innerRadius + row * rowSpacing + rowSpacing / 2;

/**
 * Répartit les sièges entre les rangées, proportionnellement à leur longueur d'arc.
 * La dernière rangée reçoit le reste : la somme vaut toujours `totalSeats`.
 */
export const seatsPerRow = (
  totalSeats: number,
  innerRadius: number,
  outerRadius: number,
): number[] => {
  const rows = rowCountFor(totalSeats);
  const rowSpacing = (outerRadius - innerRadius) / rows;
  const capacities = Array.from({ length: rows }, (_, row) =>
    Math.floor((Math.PI * rowRadius(row, innerRadius, rowSpacing)) / (rowSpacing * 0.65)),
  );
  const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  let remaining = totalSeats;
  return capacities.map((capacity, row) => {
    if (row === rows - 1) return remaining;
    const seats = Math.min(Math.round((totalSeats * capacity) / totalCapacity), remaining);
    remaining -= seats;
    return seats;
  });
};

/**
 * Positions de `totalSeats` sièges dans un demi-disque de centre (`centerX`, `centerY`),
 * entre `innerRadius` et `outerRadius`, triées de gauche à droite (angle décroissant).
 */
export const seatPositions = (
  totalSeats: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
): SeatPosition[] => {
  const rowSpacing = (outerRadius - innerRadius) / rowCountFor(totalSeats);
  const positions = seatsPerRow(totalSeats, innerRadius, outerRadius).flatMap((count, row) => {
    const radius = rowRadius(row, innerRadius, rowSpacing);
    return Array.from({ length: count }, (_, index) => {
      const angle = Math.PI - (index / (count - 1 || 1)) * Math.PI;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY - radius * Math.sin(angle),
        angle,
        row,
      };
    });
  });
  return positions.sort((a, b) => b.angle - a.angle);
};

/**
 * Attribue les positions (déjà triées de gauche à droite) aux groupes, dans l'ordre fourni.
 * Les positions restantes (sièges vacants) reçoivent `null`.
 */
export const assignSeats = <G>(
  positions: SeatPosition[],
  groups: { group: G; seats: number }[],
): { position: SeatPosition; group: G | null }[] => {
  const owners = groups.flatMap(({ group, seats }) =>
    Array.from({ length: Math.max(0, seats) }, () => group),
  );
  return positions.map((position, index) => ({ position, group: owners[index] ?? null }));
};
