import { describe, it, expect } from 'vitest';
import { perimetreAmendements } from './amendements-role';

describe('perimetreAmendements', () => {
  it('depose : filtre sur l’auteur, sans passer par les cosignatures', () => {
    const p = perimetreAmendements('depose');
    expect(p).toEqual({ cte: '', jointure: '', condition: 'a.parlementaire_id = $1' });
  });

  it('cosigne : les cosignatures, moins les amendements dont il est l’auteur', () => {
    const p = perimetreAmendements('cosigne');
    expect(p.cte).toContain('SELECT "A" AS id FROM "_AmendementCosignataires" WHERE "B" = $1');
    expect(p.cte).toMatch(/EXCEPT\s+SELECT id FROM amendements WHERE parlementaire_id = \$1/);
    expect(p.jointure).toBe('JOIN candidats c ON c.id = a.id');
    expect(p.condition).toBeNull();
  });

  it('tous : UNION des deux branches indexables, jamais un OR', () => {
    const p = perimetreAmendements('tous');
    expect(p.cte).toMatch(
      /SELECT id FROM amendements WHERE parlementaire_id = \$1\s+UNION\s+SELECT "A" AS id FROM "_AmendementCosignataires" WHERE "B" = \$1/,
    );
    expect(p.cte).not.toMatch(/\bOR\b/);
    expect(p.condition).toBeNull();
  });
});
