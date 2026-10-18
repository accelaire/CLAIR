import { describe, it, expect } from 'vitest';
import { regrouperModifications } from './ecriture-votes';

describe('regrouperModifications', () => {
  it('fait une requête par valeur cible, pas par vote', () => {
    const groupes = regrouperModifications([
      { existant: { id: 'v1' }, voulu: { parlementaireId: 'p1', position: 'contre', parDelegation: false } },
      { existant: { id: 'v2' }, voulu: { parlementaireId: 'p2', position: 'contre', parDelegation: false } },
      { existant: { id: 'v3' }, voulu: { parlementaireId: 'p3', position: 'contre', parDelegation: true } },
      { existant: { id: 'v4' }, voulu: { parlementaireId: 'p4', position: 'pour', parDelegation: false } },
    ]);
    expect(groupes).toEqual([
      { valeurs: { position: 'contre', parDelegation: false }, ids: ['v1', 'v2'] },
      { valeurs: { position: 'contre', parDelegation: true }, ids: ['v3'] },
      { valeurs: { position: 'pour', parDelegation: false }, ids: ['v4'] },
    ]);
  });

  it('ne produit rien sans modification', () => {
    expect(regrouperModifications([])).toEqual([]);
  });
});
