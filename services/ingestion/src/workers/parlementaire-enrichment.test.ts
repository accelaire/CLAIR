import { describe, it, expect } from 'vitest';
import { dateFinMandatAN, miseAJourMandatEnrichi } from './parlementaire-enrichment';

// Organe de F. Boccaletti tel que le gardait le snapshot AMO10 de sa fiche
// après son départ de l'Assemblée, le 10/11/2026.
const commission = {
  typeOrgane: 'COMPER',
  institution: 'Commission permanente',
  qualite: 'Membre',
  dateDebut: '2024-07-20',
  sourceUid: 'PM846159',
  organeRef: 'PO59046',
};

describe('miseAJourMandatEnrichi', () => {
  it('ne rouvre pas un mandat que la source donne sans date de fin', () => {
    expect(miseAJourMandatEnrichi({ ...commission, dateFin: null })).not.toHaveProperty('dateFin');
    expect(miseAJourMandatEnrichi(commission)).not.toHaveProperty('dateFin');
  });

  it('écrit la date de fin que la source publie', () => {
    expect(miseAJourMandatEnrichi({ ...commission, dateFin: '2026-11-10' }).dateFin).toEqual(new Date('2026-11-10'));
  });
});

describe('dateFinMandatAN', () => {
  const age = { typeOrgane: 'BUREAU', dateDebut: '2024-07-18', dateFin: null };

  it("clôt une fonction d'âge publiée sans fin à sa date de début (bureau d'âge du 18/07/2024)", () => {
    expect(dateFinMandatAN({ ...age, qualite: "Président d'âge de l'Assemblée nationale" })).toBe('2024-07-18');
    expect(dateFinMandatAN({ ...age, qualite: 'Secrétaire d’âge de l’Assemblée nationale' })).toBe('2024-07-18');
  });

  it('garde la date de fin publiée', () => {
    expect(dateFinMandatAN({ ...age, qualite: "Secrétaire d'âge de l'Assemblée nationale", dateFin: '2016-01-27' })).toBe('2016-01-27');
  });

  it("laisse ouvertes les autres fonctions du bureau et les fonctions d'âge hors bureau", () => {
    expect(dateFinMandatAN({ ...age, qualite: "Président de l'Assemblée nationale" })).toBeNull();
    expect(dateFinMandatAN({ ...age, qualite: 'Questeur de l’Assemblée nationale' })).toBeNull();
    expect(dateFinMandatAN({ ...age, typeOrgane: 'COMPER', qualite: "Président d'âge" })).toBeNull();
  });
});
