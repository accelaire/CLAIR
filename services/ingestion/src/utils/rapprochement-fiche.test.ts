import { describe, expect, it } from 'vitest';
import { choisirFiche, normaliserNom, slugLibre, type CandidatFiche, type PersonneSource } from './rapprochement-fiche';

const fiche = (o: Partial<CandidatFiche>): CandidatFiche => ({
  id: 'f',
  chambre: 'assemblee',
  sourceId: null,
  slug: 'jean-louis-masson',
  prenom: 'Jean-Louis',
  nom: 'Masson',
  dateNaissance: null,
  identifiantRange: false,
  ...o,
});
const masson: PersonneSource = {
  uid: 'PA346218',
  chambre: 'assemblee',
  slug: 'jean-louis-masson',
  prenom: 'Jean-Louis',
  nom: 'Masson',
  dateNaissance: new Date('1954-02-05T00:00:00Z'),
};

describe('choisirFiche', () => {
  it("retient la fiche de l'identifiant avant celle trouvée par le nom", () => {
    const parNom = fiche({ id: 'nom', dateNaissance: new Date('1954-02-05T00:00:00Z') });
    const parId = fiche({ id: 'id', sourceId: 'PA346218', slug: 'autre' });
    expect(choisirFiche([parNom, parId], masson)?.id).toBe('id');
  });

  it("retient l'identifiant rangé d'un élu passé au Sénat", () => {
    expect(choisirFiche([fiche({ id: 's', chambre: 'senat', identifiantRange: true })], masson)?.id).toBe('s');
  });

  it("n'écrase pas un homonyme né un autre jour", () => {
    expect(choisirFiche([fiche({ sourceId: 'PA1', dateNaissance: new Date('1947-03-25T00:00:00Z') })], masson)).toBeNull();
  });

  it("n'écrase pas un homonyme de l'autre chambre, même né le même jour", () => {
    expect(choisirFiche([fiche({ chambre: 'senat', dateNaissance: new Date('1954-02-05T00:00:00Z') })], masson)).toBeNull();
  });

  it('exige le nom exact : « Masson » ne trouve plus « Masson-Maret »', () => {
    const maret = fiche({ slug: 'helene-masson-maret', prenom: 'Jean-Louis', nom: 'Masson-Maret', dateNaissance: new Date('1954-02-05T00:00:00Z') });
    expect(choisirFiche([maret], masson)).toBeNull();
  });

  it('accepte le même état civil (accents, casse) sans identifiant', () => {
    const f = fiche({ id: 'ok', slug: 'x', nom: 'MASSON', prenom: 'Jean Louis', dateNaissance: new Date('1954-02-05T00:00:00Z') });
    expect(choisirFiche([f], masson)?.id).toBe('ok');
  });

  it('sans date de naissance dans la source, ne rapproche que par identifiant', () => {
    expect(choisirFiche([fiche({ dateNaissance: new Date('1954-02-05T00:00:00Z') })], { ...masson, dateNaissance: null })).toBeNull();
  });

  it('deux fiches possibles : aucune', () => {
    const n = new Date('1954-02-05T00:00:00Z');
    expect(choisirFiche([fiche({ id: 'a', dateNaissance: n }), fiche({ id: 'b', slug: 'y', dateNaissance: n })], masson)).toBeNull();
  });
});

describe('normaliserNom / slugLibre', () => {
  it('normalise accents, casse et tirets', () => {
    expect(normaliserNom('Le Pen-Élise')).toBe('le pen elise');
  });
  it("suffixe l'identifiant quand le slug est pris", () => {
    expect(slugLibre('jean-louis-masson', 'PA346218', true)).toBe('jean-louis-masson-pa346218');
    expect(slugLibre('jean-louis-masson', 'PA346218', false)).toBe('jean-louis-masson');
  });
});
