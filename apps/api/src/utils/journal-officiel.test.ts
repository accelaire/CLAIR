// =============================================================================
// Tests — buildJournalOfficielUrl
// =============================================================================

import { describe, it, expect } from 'vitest';
import { buildJournalOfficielUrl } from './journal-officiel';

describe('buildJournalOfficielUrl', () => {
  it('construit l\'URL depuis un infoJO à plat (numJO + dateJO)', () => {
    const url = buildJournalOfficielUrl({ numJO: '300', dateJO: '2025-12-23' });
    expect(url).toBe('https://www.legifrance.gouv.fr/jorf/jo/2025/12/23/0300');
  });

  it('zéro-padde le numéro de JO à 4 chiffres', () => {
    expect(buildJournalOfficielUrl({ numJO: '7', dateJO: '2024-01-05' })).toBe(
      'https://www.legifrance.gouv.fr/jorf/jo/2024/01/05/0007',
    );
    expect(buildJournalOfficielUrl({ numJO: '1234', dateJO: '2024-01-05' })).toBe(
      'https://www.legifrance.gouv.fr/jorf/jo/2024/01/05/1234',
    );
  });

  it('accepte un numJO numérique', () => {
    expect(buildJournalOfficielUrl({ numJO: 42, dateJO: '2023-07-14' })).toBe(
      'https://www.legifrance.gouv.fr/jorf/jo/2023/07/14/0042',
    );
  });

  it('cherche infoJO en profondeur dans actesLegislatifs', () => {
    const sourceData = {
      actesLegislatifs: {
        acte: [
          { codeActe: 'AN1', infoJO: null },
          { codeActe: 'PROM', infoJO: { numJO: '0099', dateJO: '2025-05-02' } },
        ],
      },
    };
    expect(buildJournalOfficielUrl(sourceData)).toBe(
      'https://www.legifrance.gouv.fr/jorf/jo/2025/05/02/0099',
    );
  });

  it('utilise la date de dateJO (string) et ignore l\'heure éventuelle', () => {
    expect(
      buildJournalOfficielUrl({ numJO: '12', dateJO: '2025-03-01T00:00:00.000Z' }),
    ).toBe('https://www.legifrance.gouv.fr/jorf/jo/2025/03/01/0012');
  });

  it('renvoie null si infoJO absent', () => {
    expect(buildJournalOfficielUrl({ foo: 'bar' })).toBeNull();
    expect(buildJournalOfficielUrl({})).toBeNull();
  });

  it('renvoie null pour des entrées nulles ou non-objet', () => {
    expect(buildJournalOfficielUrl(null)).toBeNull();
    expect(buildJournalOfficielUrl(undefined)).toBeNull();
    expect(buildJournalOfficielUrl('string')).toBeNull();
    expect(buildJournalOfficielUrl(42)).toBeNull();
  });

  it('renvoie null si la date est invalide', () => {
    expect(buildJournalOfficielUrl({ numJO: '300', dateJO: 'pas-une-date' })).toBeNull();
  });

  it('renvoie null si le numéro est vide ou nul après nettoyage', () => {
    expect(buildJournalOfficielUrl({ numJO: '0', dateJO: '2025-12-23' })).toBeNull();
    expect(buildJournalOfficielUrl({ numJO: 'abc', dateJO: '2025-12-23' })).toBeNull();
  });
});
