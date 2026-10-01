/**
 * Géométrie d'un hémicycle : la position de chaque siège, rangés de la gauche
 * (angle π) vers la droite (angle 0), colonne par colonne.
 *
 * Partagée par l'hémicycle des groupes et celui des sénatoriales : deux dessins
 * du même Sénat qui ne placeraient pas les sièges au même endroit seraient
 * impossibles à comparer.
 */
export interface PositionSiege {
  x: number;
  y: number;
  angle: number;
  row: number;
}

export function positionsHemicycle(
  totalSeats: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
): PositionSiege[] {
  // Plus de sièges = plus de rangées pour garder une densité visuelle agréable
  // AN (577) → 12 rangées, Sénat (348) → 8 rangées
  const numRows = totalSeats > 500 ? 12 : totalSeats > 400 ? 10 : 8;
  const rowSpacing = (outerRadius - innerRadius) / numRows;

  // Calculer combien de sièges peuvent tenir dans chaque rangée
  const rowCapacities: number[] = [];
  let totalCapacity = 0;
  for (let row = 0; row < numRows; row++) {
    const rowRadius = innerRadius + row * rowSpacing + rowSpacing / 2;
    const capacity = Math.floor((Math.PI * rowRadius) / (rowSpacing * 0.65));
    rowCapacities.push(capacity);
    totalCapacity += capacity;
  }

  // Distribuer les sièges réels proportionnellement aux capacités de chaque rangée
  const seatsPerRow: number[] = [];
  let remainingSeats = totalSeats;
  for (let row = 0; row < numRows; row++) {
    if (row === numRows - 1) {
      seatsPerRow.push(remainingSeats);
    } else {
      const proportion = rowCapacities[row] / totalCapacity;
      const seatsInRow = Math.round(totalSeats * proportion);
      seatsPerRow.push(Math.min(seatsInRow, remainingSeats));
      remainingSeats -= seatsPerRow[row];
    }
  }

  const seatPositions: PositionSiege[] = [];
  for (let row = 0; row < numRows; row++) {
    const rowRadius = innerRadius + row * rowSpacing + rowSpacing / 2;
    const numSeatsInRow = seatsPerRow[row];
    if (numSeatsInRow === 0) continue;

    for (let i = 0; i < numSeatsInRow; i++) {
      // Angle de PI (gauche) à 0 (droite)
      const angle = Math.PI - (i / (numSeatsInRow - 1 || 1)) * Math.PI;
      seatPositions.push({
        x: centerX + rowRadius * Math.cos(angle),
        y: centerY - rowRadius * Math.sin(angle),
        angle,
        row,
      });
    }
  }

  // Trier par angle (de gauche PI vers droite 0) pour remplissage par colonnes
  seatPositions.sort((a, b) => b.angle - a.angle);
  return seatPositions;
}
