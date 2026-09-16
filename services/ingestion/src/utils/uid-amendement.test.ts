import { describe, it, expect } from 'vitest';
import { uidCanoniqueAmendement } from './uid-amendement';

describe('uidCanoniqueAmendement', () => {
  it('fait retomber les deux émissions AN sur la même clé', () => {
    const surTexteInitial = 'AMANR5L17PO838901B1364P0D2N000001';
    const surTexteCommission = 'AMANR5L17PO838901BTC1364P0D2N000001';
    expect(uidCanoniqueAmendement(surTexteCommission)).toBe(surTexteInitial);
    expect(uidCanoniqueAmendement(surTexteInitial)).toBe(surTexteInitial);
  });

  it('laisse intact un uid AN déjà sur le texte initial', () => {
    const uid = 'AMANR5L17PO838901B2697P0D1N000003';
    expect(uidCanoniqueAmendement(uid)).toBe(uid);
  });

  it('préserve la délibération et le numéro', () => {
    expect(uidCanoniqueAmendement('AMANR5L17PO838901BTC2755P0D1N000137'))
      .toBe('AMANR5L17PO838901B2755P0D1N000137');
    expect(uidCanoniqueAmendement('AMANR5L17PO838901BTC2755P0D2N000137'))
      .toBe('AMANR5L17PO838901B2755P0D2N000137');
  });

  it('distingue deux textes dont le numéro ne diffère que par le TC retiré', () => {
    // Le TC n'est pas un chiffre : le retirer ne peut pas fusionner 1364 et 11364.
    expect(uidCanoniqueAmendement('AMANR5L17PO838901BTC1364P0D1N000001'))
      .not.toBe(uidCanoniqueAmendement('AMANR5L17PO838901B11364P0D1N000001'));
  });

  it('ne touche pas aux uid d’un autre organe', () => {
    // Les amendements de commission portent un organe différent : la clé les
    // sépare toujours, TC ou pas.
    const commission = uidCanoniqueAmendement('AMANR5L17PO59047BTC1376P0D1N000012');
    const seance = uidCanoniqueAmendement('AMANR5L17PO838901BTC1376P0D1N000012');
    expect(commission).not.toBe(seance);
  });

  it('laisse un uid Sénat inchangé', () => {
    for (const uid of ['SENAT-AMD-123456', 'AMELI-2024-0001', 'senat-ppl24-718-1']) {
      expect(uidCanoniqueAmendement(uid)).toBe(uid);
    }
  });

  it('est idempotente', () => {
    const uid = 'AMANR5L17PO838901BTC1364P0D2N000001';
    const une = uidCanoniqueAmendement(uid);
    expect(uidCanoniqueAmendement(une)).toBe(une);
  });
});
