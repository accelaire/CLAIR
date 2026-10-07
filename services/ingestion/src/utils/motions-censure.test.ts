// =============================================================================
// Tests — Clé d'appariement des motions de censure
// =============================================================================

import { describe, it, expect } from 'vitest';
import { cleMotion, dossierMotionSansReferences } from './motions-censure.js';

describe('cleMotion', () => {
  it('produit une expression SQL sur la colonne fournie', () => {
    const sql = cleMotion('s.titre');
    expect(sql).toContain("substring(s.titre from ' par ");
    expect(sql).toContain("substring(s.titre from ' et (\\d+) ')");
  });

  it('refuse une colonne qui ne serait pas un identifiant', () => {
    expect(() => cleMotion("s.titre); DROP TABLE scrutins; --")).toThrow();
  });
});

describe('dossierMotionSansReferences', () => {
  it('teste l’absence de voteRefs sur le dossier', () => {
    expect(dossierMotionSansReferences('d')).toContain("jsonb_path_query(d.source_data, 'strict $.**.voteRefs.voteRef')");
    expect(() => dossierMotionSansReferences('d;')).toThrow();
  });
});
