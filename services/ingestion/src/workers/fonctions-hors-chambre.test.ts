import { describe, it, expect } from 'vitest';
import { libellePoste, nomsDesGouvernements } from './fonctions-hors-chambre';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe('nomsDesGouvernements', () => {
  it('nomme comme l’API : « Valls I », « Valls II », « Borne »', () => {
    const noms = nomsDesGouvernements([
      { id: 'v1', numero: 1, dateDebut: d('2014-04-02'), rangUn: [{ uid: 'a', acteurUid: 'PA1', nom: 'Valls', dateDebut: d('2014-04-02') }] },
      { id: 'v2', numero: 2, dateDebut: d('2014-08-26'), rangUn: [{ uid: 'b', acteurUid: 'PA1', nom: 'Valls', dateDebut: d('2014-08-26') }] },
      { id: 'b', numero: 1, dateDebut: d('2022-05-16'), rangUn: [{ uid: 'c', acteurUid: 'PA2', nom: 'Borne', dateDebut: d('2022-05-16') }] },
    ]);
    expect([...noms]).toEqual([['v1', 'Valls I'], ['v2', 'Valls II'], ['b', 'Borne']]);
  });

  it('prend le PM nommé le premier jour, pas un intérim', () => {
    const noms = nomsDesGouvernements([
      {
        id: 'g', numero: 1, dateDebut: d('2024-01-10'),
        rangUn: [
          { uid: 'z', acteurUid: 'PA9', nom: 'Intérim', dateDebut: d('2024-01-01') },
          { uid: 'y', acteurUid: 'PA3', nom: 'Attal', dateDebut: d('2024-01-10') },
        ],
      },
    ]);
    expect(noms.get('g')).toBe('Attal');
  });
});

describe('libellePoste', () => {
  it('compose qualité accordée et complément, sauf pour le Premier ministre', () => {
    expect(libellePoste({ qualite: 'Ministre', qualiteAccordee: 'Ministre', intitule: "Ministère de l'intérieur", intituleComplement: "de l'intérieur" }))
      .toBe("Ministre de l'intérieur");
    expect(libellePoste({ qualite: 'Ministre délégué', qualiteAccordee: 'Ministre déléguée', intitule: 'Ministère X', intituleComplement: 'auprès du ministre X, chargée de Y' }))
      .toBe('Ministre déléguée auprès du ministre X, chargée de Y');
    expect(libellePoste({ qualite: 'Premier ministre', qualiteAccordee: 'Première ministre', intitule: 'Premier ministre', intituleComplement: null }))
      .toBe('Première ministre');
    expect(libellePoste({ qualite: 'Secrétaire d’État', qualiteAccordee: null, intitule: 'Secrétariat d’État au numérique', intituleComplement: null }))
      .toBe('Secrétaire d’État, Secrétariat d’État au numérique');
  });
});
