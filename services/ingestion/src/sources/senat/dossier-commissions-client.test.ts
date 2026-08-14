import { describe, it, expect } from 'vitest';
import { extractSaisines, mapLibelleToOrganeRef } from './dossier-commissions-client';

// =============================================================================
// extractSaisines
// =============================================================================

describe('extractSaisines', () => {
  it('extrait une saisine au fond et absorbe les espaces superflus', () => {
    const html = '<h4 class="h6">Commission des lois, saisie au fond </h4>';
    expect(extractSaisines(html)).toEqual([{ libelle: 'Commission des lois', role: 'fond' }]);
  });

  it('extrait une saisine pour avis', () => {
    const html = '<h4 class="h6">Commission des affaires étrangères, saisie pour avis</h4>';
    expect(extractSaisines(html)).toEqual([{ libelle: 'Commission des affaires étrangères', role: 'avis' }]);
  });

  it('retourne plusieurs saisines dans l\'ordre du document', () => {
    const html = `
      <h4 class="h6">Commission des lois, saisie au fond</h4>
      <p>Paragraphe intermédiaire</p>
      <h4 class="h6">Commission des finances, saisie pour avis</h4>
    `;
    expect(extractSaisines(html)).toEqual([
      { libelle: 'Commission des lois', role: 'fond' },
      { libelle: 'Commission des finances', role: 'avis' },
    ]);
  });

  // Piège critique : la virgule dans l'intitulé ne doit pas être confondue
  // avec la virgule séparant le libellé du rôle.
  it('préserve le libellé complet malgré les virgules internes', () => {
    const html = '<h4 class="h6">Commission de la culture, de l\'éducation, de la communication et du sport, saisie au fond</h4>';
    expect(extractSaisines(html)).toEqual([
      { libelle: 'Commission de la culture, de l\'éducation, de la communication et du sport', role: 'fond' },
    ]);
  });

  it('préserve le libellé long avec de multiples virgules', () => {
    const html = "<h4>Commission des lois constitutionnelles, de législation, du suffrage universel, du Règlement et d'administration générale, saisie au fond</h4>";
    expect(extractSaisines(html)).toEqual([
      { libelle: "Commission des lois constitutionnelles, de législation, du suffrage universel, du Règlement et d'administration générale", role: 'fond' },
    ]);
  });

  it('décode les entités HTML', () => {
    const html = '<h4 class="h6">Commission d&#039;administration générale,&nbsp;saisie au fond</h4>';
    expect(extractSaisines(html)).toEqual([
      { libelle: 'Commission d\'administration générale', role: 'fond' },
    ]);
  });

  it('retourne un tableau vide sur une page sans saisine', () => {
    expect(extractSaisines('<html><body><p>Aucune commission saisie</p></body></html>')).toEqual([]);
  });

  it('ignore un h4 qui ne contient pas le mot saisie', () => {
    const html = '<h4 class="h6">Commission des lois</h4>';
    expect(extractSaisines(html)).toEqual([]);
  });
});

// =============================================================================
// mapLibelleToOrganeRef
// =============================================================================

describe('mapLibelleToOrganeRef', () => {
  it.each([
    ['Commission des finances', 'COM-FINC'],
    ['Commission des finances, de l\'économie générale et du contrôle budgétaire', 'COM-FINC'],
    ['Commission des affaires sociales', 'COM-SOCI'],
    ['Commission des affaires sociales', 'COM-SOCI'],
    ['Commission des lois', 'COM-LOIS'],
    ['Commission des lois constitutionnelles, de législation, du suffrage universel, du Règlement et d\'administration générale', 'COM-LOIS'],
    ['Commission des affaires économiques', 'COM-CAE'],
    ['Commission des affaires économiques', 'COM-CAE'],
    ['Commission des affaires culturelles', 'COM-AFCL'],
    ['Commission des affaires culturelles, de l\'éducation et de la communication', 'COM-AFCL'],
    ['Commission des affaires étrangères', 'COM-ETRD'],
    ['Commission des affaires étrangères, de la défense et des forces armées', 'COM-ETRD'],
    ['Commission de l\'aménagement du territoire', 'COM-CDD'],
    ['Commission de l\'aménagement du territoire et du développement durable', 'COM-CDD'],
    ['Commission des affaires européennes', 'COMEUR-AFEU'],
    ['Commission des affaires européennes', 'COMEUR-AFEU'],
  ])('mappe « %s » → %s', (libelle, expected) => {
    expect(mapLibelleToOrganeRef(libelle)).toBe(expected);
  });

  it.each([
    ['Commission spéciale'],
    ['Commission mixte paritaire'],
    ["Commission d'enquête"],
    [''],
  ])('renvoie null pour %s', (libelle) => {
    expect(mapLibelleToOrganeRef(libelle)).toBeNull();
  });

  it('est insensible à la casse et aux accents', () => {
    expect(mapLibelleToOrganeRef('commission des LOIS')).toBe('COM-LOIS');
    expect(mapLibelleToOrganeRef('COMMISSION DES FINANCES')).toBe('COM-FINC');
    expect(mapLibelleToOrganeRef('Commission des affaires économiques')).toBe('COM-CAE');
  });
});