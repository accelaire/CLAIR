import { describe, expect, it } from 'vitest';
import { normalizeSenatNumero, uidAmendementSenat, uidAmendementSenatSql } from './uid-amendement-senat';

describe('normalizeSenatNumero', () => {
  it('retire la rectification, quelle qu’elle soit', () => {
    expect(normalizeSenatNumero('12')).toBe('12');
    expect(normalizeSenatNumero('12 rect.')).toBe('12');
    expect(normalizeSenatNumero('1 rect. quinquies')).toBe('1');
    expect(normalizeSenatNumero('I-361 rect. bis')).toBe('I-361');
    expect(normalizeSenatNumero('COM-1 rect. ter')).toBe('COM-1');
  });
});

describe('uidAmendementSenat', () => {
  it('session de dépôt, numéro du texte, numéro sans rectification', () => {
    // senat.fr : /amendements/2026-2027/89/Amdt_1.html est l'adresse de « 1 rect. quinquies ».
    expect(uidAmendementSenat('2026-2027', '89', '1')).toBe('SENAT-AMD-S2026-2027-89-1');
    expect(uidAmendementSenat('2026-2027', '89', '1 rect. quinquies')).toBe('SENAT-AMD-S2026-2027-89-1');
    expect(uidAmendementSenat('2025-2026', '143', 'II-1167 rect.')).toBe('SENAT-AMD-S2025-2026-143-II-1167');
  });

  it("distingue la commission de la séance d'un même numéro de texte", () => {
    expect(uidAmendementSenat('2016-2017', '155', 'COM-1')).not.toBe(uidAmendementSenat('2016-2017', '155', '1'));
  });

  it("accepte l'année d'ouverture de la session", () => {
    expect(uidAmendementSenat(2025, '689', 'COM-1 rect. ter')).toBe('SENAT-AMD-S2025-2026-689-COM-1');
  });
});

describe('uidAmendementSenatSql', () => {
  it('construit le même uid à partir de la session de dépôt du texte', () => {
    const sql = uidAmendementSenatSql('a', 't');
    expect(sql).toContain("'SENAT-AMD-S' || t.session_depot || '-' || (t.session_depot + 1) || '-' || t.numero");
    expect(sql).toContain("regexp_replace(a.numero, '\\s+rect\\M.*$', '', 'i')");
  });
});
