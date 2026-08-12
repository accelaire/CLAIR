// =============================================================================
// Fenêtre du sync quotidien des scrutins.
// Un scrutin hors fenêtre n'est pas retraité : ses votes ne sont donc pas
// supprimés puis réinsérés pour rien (1,48 M de lignes par nuit avant bornage).
// =============================================================================

import { describe, it, expect } from 'vitest';
import { windowFloor, SCRUTINS_DAILY_WINDOW_MONTHS } from './sync.js';

describe('windowFloor', () => {
  it('ne borne rien quand la fenêtre est absente ou nulle', () => {
    // Indispensable : les rattrapages (`sync --scrutins`) doivent rester complets.
    expect(windowFloor(undefined)).toBeNull();
    expect(windowFloor(0)).toBeNull();
    expect(windowFloor(-3)).toBeNull();
  });

  it('recule bien du nombre de mois demandé', () => {
    const floor = windowFloor(6);
    expect(floor).not.toBeNull();
    const attendu = new Date();
    attendu.setMonth(attendu.getMonth() - 6);
    // Tolérance d'une minute : les deux dates sont construites à des instants
    // différents.
    expect(Math.abs(floor!.getTime() - attendu.getTime())).toBeLessThan(60_000);
  });

  it('classe correctement un scrutin de part et d’autre de la borne', () => {
    const floor = windowFloor(SCRUTINS_DAILY_WINDOW_MONTHS)!;

    const recent = new Date();
    recent.setMonth(recent.getMonth() - 1);
    expect(recent < floor).toBe(false);

    const ancien = new Date();
    ancien.setMonth(ancien.getMonth() - SCRUTINS_DAILY_WINDOW_MONTHS - 1);
    expect(ancien < floor).toBe(true);
  });

  it('garde la fenêtre quotidienne à 6 mois', () => {
    // Garde-fou : l'élargir revient à réintroduire le churn de votes.
    expect(SCRUTINS_DAILY_WINDOW_MONTHS).toBe(6);
  });
});
