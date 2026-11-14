import { describe, it, expect } from 'vitest';
import { dateFinMandatAN } from './date-fin-mandat-an';

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
