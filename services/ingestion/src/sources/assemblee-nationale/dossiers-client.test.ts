// =============================================================================
// Tests — État d'un dossier AN après une décision de séance
// =============================================================================

import { describe, it, expect } from 'vitest';
import { etatApresDecision } from './dossiers-client.js';

describe('etatApresDecision', () => {
  it('un texte modifié par une chambre repart en navette, même après un rejet', () => {
    // Loi d'approbation des comptes 2025 (DLR5L17N54196) : AN1 rejeté le
    // 9 juin 2026, SN1 « modifié » le 22. Restait « rejeté » = procédure close.
    let etat = etatApresDecision('en_cours', 'rejeté');
    expect(etat).toBe('rejete');
    etat = etatApresDecision(etat, 'modifié');
    expect(etat).toBe('en_cours');
  });

  it('reconnaît les variantes de « modifié »', () => {
    expect(etatApresDecision('adopte', 'modifiée')).toBe('en_cours');
    expect(etatApresDecision('adopte', 'adoptée avec modifications')).toBe('en_cours');
    expect(etatApresDecision('adopte', '  Modifié ')).toBe('en_cours');
  });

  it('« sans modification » reste une adoption', () => {
    expect(etatApresDecision('en_cours', 'adopté sans modification')).toBe('adopte');
    expect(etatApresDecision('en_cours', "adoptée, dans les conditions prévues à l'article 45, alinéa 3, de la Constitution")).toBe('adopte');
  });

  it('garde les rejets', () => {
    expect(etatApresDecision('en_cours', 'rejetée')).toBe('rejete');
    expect(etatApresDecision('en_cours', 'rejeté définitivement')).toBe('rejete');
  });

  it("laisse l'état inchangé sur une conclusion qui n'est pas une décision sur le texte", () => {
    expect(etatApresDecision('adopte', 'Accord')).toBe('adopte');
    expect(etatApresDecision('en_cours', '')).toBe('en_cours');
  });
});
