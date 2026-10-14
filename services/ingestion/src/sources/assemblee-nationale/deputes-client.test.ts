import { describe, it, expect } from 'vitest';
import { debutReelMandat } from './deputes-client';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('debutReelMandat', () => {
  it("un suppléant commence à sa prise de fonction, pas à l'élection du titulaire", () => {
    // Suppléant de Gabriel Amard (Rhône, 6e) : élection du 7 juillet 2024, entrée le 8 octobre 2026.
    expect(debutReelMandat(d('2024-07-07'), d('2026-10-08'))).toEqual(d('2026-10-08'));
  });

  it("un élu commence le lendemain de l'élection", () => {
    expect(debutReelMandat(d('2024-07-07'), d('2024-07-08'))).toEqual(d('2024-07-08'));
  });

  it('garde la date publiée sans prise de fonction, ou si elle la précède', () => {
    expect(debutReelMandat(d('2024-07-07'), null)).toEqual(d('2024-07-07'));
    expect(debutReelMandat(d('2024-07-07'), d('2024-07-01'))).toEqual(d('2024-07-07'));
    expect(debutReelMandat(null, d('2024-07-08'))).toEqual(d('2024-07-08'));
  });
});
