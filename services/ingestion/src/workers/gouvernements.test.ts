import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { construireDonnees, type MembreSource } from '../sources/assemblee-nationale/gouvernements-client';
import { lienParPA, lierFiches, numerosGouvernements, slugGouvernement, slugLibre, type FicheCandidate } from './gouvernements';
import { estFonctionGouvernementale } from './parlementaire-enrichment';

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, '../sources/assemblee-nationale/__fixtures__/amo30-gouvernements.json'), 'utf-8'),
) as { organes: unknown[]; acteurs: unknown[] };

describe('slugGouvernement', () => {
  it('suit le libellé de la source, chiffres romains convertis', () => {
    expect(slugGouvernement('LECORNU II')).toBe('lecornu-2');
    expect(slugGouvernement('VALLS 2')).toBe('valls-2');
    expect(slugGouvernement('VALLS')).toBe('valls');
    expect(slugGouvernement('FILLON 1')).toBe('fillon-1');
  });
});

describe('slugLibre', () => {
  it('suffixe un slug déjà pris, et réserve celui qu’il rend', () => {
    const pris = new Set(['jean-martin']);
    expect(slugLibre('jean-martin', ['1970', 'pa1'], pris)).toBe('jean-martin-1970');
    expect(slugLibre('jean-martin', ['1970', 'pa2'], pris)).toBe('jean-martin-pa2');
    expect(pris.has('jean-martin-pa2')).toBe(true);
  });
});

describe('numerosGouvernements', () => {
  it('numérote les gouvernements d’un même Premier ministre, dans l’ordre', () => {
    // Les extraits portent les Premiers ministres Valls, Bayrou, Lecornu et Fillon.
    const d = construireDonnees(fixture.organes, fixture.acteurs);
    const n = numerosGouvernements(d.gouvernements, d.postes);
    expect(n.get('PO700706')).toBe(1); // Valls
    expect(n.get('PO702883')).toBe(2); // Valls 2
    expect(n.get('PO873418')).toBe(1); // Lecornu
    expect(n.get('PO873634')).toBe(2); // Lecornu II
    expect(n.get('PO855052')).toBe(1); // Bayrou
    expect(n.get('PO425695')).toBe(3); // Fillon 3
  });
});

describe('lierFiches', () => {
  const membre = (m: Partial<MembreSource> & { acteurUid: string }): MembreSource => ({
    civilite: 'M.', prenom: 'Jean', nom: 'Martin', dateNaissance: '1970-01-02', senateur: false, ...m,
  });
  const fiche = (f: Partial<FicheCandidate> & { id: string }): FicheCandidate => ({
    sourceId: null, nom: 'Martin', prenom: 'Jean', dateNaissance: '1970-01-02', ...f,
  });

  it('lie par PA, puis par identifiant de l’Assemblée', () => {
    const { liens } = lierFiches(
      [membre({ acteurUid: 'PA1' }), membre({ acteurUid: 'PA2', nom: 'Autre' })],
      [fiche({ id: 'f1', sourceId: 'PA1' }), fiche({ id: 'f2', sourceId: '12345A', nom: 'Autre' })],
      new Map([['PA2', 'f2']]),
    );
    expect(liens.get('PA1')).toEqual({ parlementaireId: 'f1', liaison: 'source_id' });
    expect(liens.get('PA2')).toEqual({ parlementaireId: 'f2', liaison: 'identifiant' });
  });

  it('lie par état civil un ministre que l’AMO30 dit sénateur, accents et tirets neutralisés', () => {
    const { liens } = lierFiches(
      [membre({ acteurUid: 'PA1', prenom: 'Jean-Édouard', senateur: true })],
      [fiche({ id: 's1', sourceId: '12345A', prenom: 'Jean Edouard' })],
      new Map(),
    );
    expect(liens.get('PA1')).toEqual({ parlementaireId: 's1', liaison: 'etat_civil' });
  });

  it('ne lie pas par état civil un ministre que l’AMO30 ne dit pas sénateur', () => {
    const { liens } = lierFiches([membre({ acteurUid: 'PA1' })], [fiche({ id: 's1', sourceId: '12345A' })], new Map());
    expect(liens.size).toBe(0);
  });

  it('ne lie pas sans date de naissance, ni quand deux fiches ou deux membres partagent l’état civil', () => {
    const sansDate = lierFiches([membre({ acteurUid: 'PA1', senateur: true, dateNaissance: null })], [fiche({ id: 's1', dateNaissance: null })], new Map());
    expect(sansDate.liens.size).toBe(0);

    const deuxFiches = lierFiches([membre({ acteurUid: 'PA1', senateur: true })], [fiche({ id: 's1' }), fiche({ id: 's2' })], new Map());
    expect(deuxFiches.liens.size).toBe(0);
    expect(deuxFiches.ambiguites).toHaveLength(1);

    const deuxMembres = lierFiches(
      [membre({ acteurUid: 'PA1', senateur: true }), membre({ acteurUid: 'PA2', senateur: true })],
      [fiche({ id: 's1' })],
      new Map(),
    );
    expect(deuxMembres.liens.size).toBe(0);
  });

  it('retire un lien qui désignerait la même fiche pour deux personnes', () => {
    const { liens, ambiguites } = lierFiches(
      [membre({ acteurUid: 'PA1' }), membre({ acteurUid: 'PA2', nom: 'Autre' })],
      [fiche({ id: 'f1', sourceId: 'PA1' })],
      new Map([['PA2', 'f1']]),
    );
    expect(liens.size).toBe(0);
    expect(ambiguites.some((a) => a.includes('f1'))).toBe(true);
  });

  it('refuse un PA porté par deux fiches', () => {
    expect(lienParPA('PA1', [fiche({ id: 'a', sourceId: 'PA1' }), fiche({ id: 'b', sourceId: 'PA1' })], new Map())).toEqual({ ambigu: 2 });
  });
});

describe('estFonctionGouvernementale', () => {
  it('écarte de mandats les fonctions gouvernementales, pas les missions de parlementaires', () => {
    expect(estFonctionGouvernementale({ typeOrgane: 'GOUVERNEMENT', qualite: 'membre' })).toBe(true);
    expect(estFonctionGouvernementale({ typeOrgane: 'PRESREP', qualite: 'Président de la République' })).toBe(true);
    expect(estFonctionGouvernementale({ typeOrgane: 'MINISTERE', qualite: 'Ministre' })).toBe(true);
    expect(estFonctionGouvernementale({ typeOrgane: 'MINISTERE', qualite: 'en mission' })).toBe(false);
    expect(estFonctionGouvernementale({ typeOrgane: 'COMPER', qualite: 'Membre' })).toBe(false);
  });
});
