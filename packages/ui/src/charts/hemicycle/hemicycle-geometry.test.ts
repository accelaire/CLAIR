// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assignSeats, rowCountFor, seatPositions, seatsPerRow } from "./hemicycle-geometry.ts";

describe("géométrie de l'hémicycle", () => {
  it("choisit le nombre de rangées selon la taille de la chambre", () => {
    expect(rowCountFor(577)).toBe(12);
    expect(rowCountFor(450)).toBe(10);
    expect(rowCountFor(348)).toBe(8);
  });

  it.each([577, 348, 1, 0])("place exactement %i sièges", (total) => {
    expect(seatsPerRow(total, 80, 240).reduce((sum, n) => sum + n, 0)).toBe(total);
    expect(seatPositions(total, 250, 260, 80, 240)).toHaveLength(total);
  });

  it("ne donne jamais un nombre négatif de sièges à une rangée", () => {
    for (const total of [1, 7, 120, 348, 577, 700]) {
      expect(seatsPerRow(total, 80, 240).every((n) => n >= 0)).toBe(true);
    }
  });

  it("garde chaque siège dans le demi-disque, entre les deux rayons", () => {
    for (const seat of seatPositions(577, 250, 260, 80, 240)) {
      const distance = Math.hypot(seat.x - 250, seat.y - 260);
      expect(distance).toBeGreaterThanOrEqual(80);
      expect(distance).toBeLessThanOrEqual(240);
      expect(seat.y).toBeLessThanOrEqual(260 + 1e-9);
    }
  });

  it("trie les sièges de la gauche (π) vers la droite (0)", () => {
    const seats = seatPositions(348, 250, 260, 80, 240);
    expect(seats[0]?.angle).toBeCloseTo(Math.PI);
    expect(seats.at(-1)?.angle).toBeCloseTo(0);
    for (let i = 1; i < seats.length; i++) {
      expect(seats[i - 1]?.angle ?? 0).toBeGreaterThanOrEqual(seats[i]?.angle ?? 0);
    }
  });

  it("attribue les sièges aux groupes dans l'ordre et laisse les vacants à null", () => {
    const positions = seatPositions(10, 0, 0, 10, 20);
    const seats = assignSeats(positions, [
      { group: "A", seats: 3 },
      { group: "B", seats: 5 },
    ]);
    expect(seats.map((seat) => seat.group)).toEqual([
      "A",
      "A",
      "A",
      "B",
      "B",
      "B",
      "B",
      "B",
      null,
      null,
    ]);
  });
});
