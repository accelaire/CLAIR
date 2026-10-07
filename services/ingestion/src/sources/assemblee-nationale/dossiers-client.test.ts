// =============================================================================
// Tests — État d'un dossier AN après une décision de séance
// =============================================================================

import { describe, it, expect } from 'vitest';
import { etatApresDecision, parcoursDossier } from './dossiers-client.js';

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

describe('parcoursDossier', () => {
  // Extrait de DLR5L17N54196 (loi d'approbation des comptes 2025).
  const sourceData = {
    actesLegislatifs: { acteLegislatif: [
      { codeActe: 'AN1', actesLegislatifs: { acteLegislatif: [
        { codeActe: 'AN1-DEPOT', dateActe: '2026-04-22T00:00:00.000+02:00' },
        { codeActe: 'AN1-COM', actesLegislatifs: { acteLegislatif: { codeActe: 'AN1-COM-FOND-DEC', dateActe: '2026-05-27T00:00:00.000+02:00', statutConclusion: { libelle: 'rejet du texte par la commission préalable' } } } },
        { codeActe: 'AN1-DEBATS', actesLegislatifs: { acteLegislatif: { codeActe: 'AN1-DEBATS-DEC', dateActe: '2026-06-09T00:00:00.000+02:00', statutConclusion: { libelle: 'rejeté' } } } },
      ] } },
      { codeActe: 'SN1', actesLegislatifs: { acteLegislatif: [
        { codeActe: 'SN1-DEBATS', actesLegislatifs: { acteLegislatif: { codeActe: 'SN1-DEBATS-DEC', dateActe: '2026-06-22T00:00:00.000+02:00', statutConclusion: { libelle: 'modifié' } } } },
      ] } },
    ] },
  };

  it('liste les décisions de séance datées, dans l’ordre, sans les étapes de commission', () => {
    expect(parcoursDossier(sourceData)).toEqual([
      '09/06/2026 — Assemblée nationale, 1re lecture : rejeté',
      '22/06/2026 — Sénat, 1re lecture : modifié',
    ]);
  });

  it('nomme la CMP, les lectures et la promulgation', () => {
    const lignes = parcoursDossier({ actesLegislatifs: { acteLegislatif: [
      { codeActe: 'CMP-DEC', dateActe: '2025-12-10T00:00:00.000+01:00', statutConclusion: { libelle: 'Désaccord' } },
      { codeActe: 'ANNLEC-DEBATS-DEC', dateActe: '2025-12-15T00:00:00.000+01:00', statutConclusion: { libelle: 'adopté' } },
      { codeActe: 'ANLDEF-DEBATS-DEC', dateActe: '2025-12-19T00:00:00.000+01:00', statutConclusion: { libelle: 'adopté' } },
      { codeActe: 'PROM-PUB', dateActe: '2025-12-30T00:00:00.000+01:00', codeLoi: '2025-1403' },
    ] } });
    expect(lignes).toEqual([
      '10/12/2025 — Commission mixte paritaire : Désaccord',
      '15/12/2025 — Assemblée nationale, nouvelle lecture : adopté',
      '19/12/2025 — Assemblée nationale, lecture définitive : adopté',
      '30/12/2025 — Promulgation (loi n° 2025-1403)',
    ]);
  });

  it('renvoie une liste vide sans données source', () => {
    expect(parcoursDossier(null)).toEqual([]);
    expect(parcoursDossier({})).toEqual([]);
  });
});
