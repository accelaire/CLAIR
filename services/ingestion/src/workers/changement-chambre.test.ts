import { describe, expect, it } from 'vitest';
import { normaliserIdentite, personneDuNouveauSenateur, type CandidatureRattachee } from './changement-chambre';

const candidature = (extra: Partial<CandidatureRattachee> = {}): CandidatureRattachee => ({
  personneId: 'depute-aube',
  nom: 'BAZIN-MALGRAS',
  prenom: 'Valérie',
  departement: '10',
  ...extra,
});

describe('normaliserIdentite', () => {
  it('rend comparables la casse de l’annuaire du Sénat et celle du ministère', () => {
    expect(normaliserIdentite('BAZIN-MALGRAS')).toBe(normaliserIdentite('Bazin-Malgras'));
    expect(normaliserIdentite('Loïc')).toBe('loic');
    expect(normaliserIdentite("D'HAUTEFEUILLE")).toBe('d hautefeuille');
  });
});

describe('personneDuNouveauSenateur', () => {
  const senatrice = { nom: 'Bazin-Malgras', prenom: 'Valérie', departement: '10' };

  it('retrouve la députée élue sénatrice par sa candidature dans la circonscription', () => {
    expect(personneDuNouveauSenateur(senatrice, [candidature()])).toBe('depute-aube');
  });

  it('ignore un homonyme candidat dans une autre circonscription', () => {
    expect(personneDuNouveauSenateur(senatrice, [candidature({ departement: '51' })])).toBeNull();
  });

  it('refuse de trancher entre deux personnes', () => {
    const deux = [candidature(), candidature({ personneId: 'homonyme' })];
    expect(personneDuNouveauSenateur(senatrice, deux)).toBeNull();
  });

  it('accepte deux candidatures de la même personne (deux tours, deux listes)', () => {
    expect(personneDuNouveauSenateur(senatrice, [candidature(), candidature()])).toBe('depute-aube');
  });

  it('exige le prénom, pas seulement le nom', () => {
    expect(personneDuNouveauSenateur({ ...senatrice, prenom: 'Valentin' }, [candidature()])).toBeNull();
  });

  it('ne rattache rien sans circonscription', () => {
    expect(personneDuNouveauSenateur({ ...senatrice, departement: null }, [candidature()])).toBeNull();
  });
});
