import { describe, expect, it } from 'vitest';
import { familleSort } from './amendements-sort';

describe('familleSort', () => {
  it('reconnaît adoption et rejet dans les deux chambres', () => {
    for (const s of ['Adopté', 'adopte', 'adopte_modifie']) expect(familleSort(s)).toBe('adopte');
    for (const s of ['Rejeté', 'rejete']) expect(familleSort(s)).toBe('rejete');
  });

  it("range ce qui n'est pas encore examiné en attente, sort inconnu compris", () => {
    for (const s of [null, undefined, '', '  ', 'En traitement', 'A discuter', 'en_attente_de_recevabilité_financière', 'recevable_art._40_c_/_lolf']) {
      expect(familleSort(s)).toBe('attente');
    }
  });

  it('range retraits, chutes et irrecevabilités en non mis aux voix', () => {
    for (const s of [
      'Tombé', 'tombe', 'R', 'Retiré', 'cet_amendement_est_retiré_avant_séance', 'Non soutenu', 'non_soutenu',
      'Charge', 'Cavalier (45)', 'Sous-amendement (98)', 'irrecevable', 'Irr en première partie', 'satisfait', 'Doublon',
    ]) {
      expect(familleSort(s)).toBe('non_vote');
    }
  });
});
