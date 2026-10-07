// =============================================================================
// Tests — Fragment SQL du groupe d'époque
// =============================================================================

import { describe, it, expect } from 'vitest';
import { groupeDuVote } from './groupe-epoque.js';

describe('groupeDuVote', () => {
  it('branche le mandat sur les alias de la requête englobante', () => {
    const sql = groupeDuVote('v', 'sc').sql;
    expect(sql).toContain('m.personne_id = v.parlementaire_id');
    expect(sql).toContain('m.legislature = sc.legislature');
    expect(sql).toContain('m.date_debut <= sc.date');
    expect(sql).not.toMatch(/\bs\.(chambre|date|legislature)/);
    expect(sql).toContain('JOIN groupes_politiques gp ON gp.id = groupe_epoque.groupe_id');
  });

  it("n'utilise jamais le groupe actuel de la personne", () => {
    expect(groupeDuVote('v', 's').sql).not.toContain('p.groupe_id');
  });

  it('refuse un alias qui ne serait pas un identifiant', () => {
    expect(() => groupeDuVote('v; DROP TABLE votes', 's')).toThrow();
    expect(() => groupeDuVote('v', 'S')).toThrow();
  });
});
