import { describe, expect, it } from 'vitest';
import { fonctionsEnVue, type FonctionEnCours } from './fonctions-en-vue';

const f = (typeOrgane: string, qualite: string, institution: string | null, dateFin: string | null = null): FonctionEnCours => ({
  typeOrgane,
  qualite,
  institution,
  dateFin,
});

describe('fonctionsEnVue', () => {
  it('met en avant la présidence du Sénat, pas les fonctions passées', () => {
    expect(
      fonctionsEnVue([
        f('BUREAU', 'Président du Sénat', 'Bureau du Sénat'),
        f('BUREAU', 'Vice-président du Sénat', 'Bureau du Sénat', '2001-10-02'),
        f('COMMISSION', 'Président', 'Commission des affaires économiques', '2004-04-30'),
      ]),
    ).toEqual(['Président du Sénat']);
  });

  it('nomme la commission présidée, à partir de la commission liée', () => {
    expect(
      fonctionsEnVue([
        { ...f('COMMISSION', 'Présidente', null), commission: { nom: 'Commission des finances' } },
        f('COMMISSION', 'Rapporteure générale', 'Commission des finances'),
        f('COMMISSION', 'Vice-Président', 'Commission des lois'),
        f('COMMISSION', 'Membre', 'Commission des lois'),
      ]),
    ).toEqual(['Présidente de la commission des finances', 'Rapporteure générale de la commission des finances']);
  });

  it('nomme le groupe présidé', () => {
    expect(fonctionsEnVue([f('GP', 'Président', 'Groupe Les Républicains'), f('GP', 'Vice-Président', 'Groupe Les Républicains')])).toEqual([
      'Président du groupe Les Républicains',
    ]);
  });

  it("écarte les fonctions d'âge de l'Assemblée", () => {
    expect(fonctionsEnVue([f('BUREAU', "Secrétaire d'âge de l'Assemblée nationale", "Bureau de l'Assemblée")])).toEqual([]);
  });

  it('classe le bureau avant les commissions et les groupes', () => {
    expect(
      fonctionsEnVue([
        f('GP', 'Président', 'Groupe Union Centriste'),
        f('COMMISSION', 'Président', 'Commission des lois'),
        f('BUREAU', 'Questeur du Sénat', 'Bureau du Sénat'),
      ]),
    ).toEqual(['Questeur du Sénat', 'Président de la commission des lois', 'Président du groupe Union Centriste']);
  });
});
