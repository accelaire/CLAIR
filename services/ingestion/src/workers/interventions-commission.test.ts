import { describe, it, expect } from 'vitest';
import {
  cleDeNom,
  indexerOrateurs,
  resoudreOrateur,
  prenomEtNom,
  sourceUidCommission,
} from './interventions-commission';

describe('cleDeNom', () => {
  it('efface les accents, la casse et la ponctuation', () => {
    expect(cleDeNom('Pieyre-Alexandre ANGLADE')).toBe('pieyre alexandre anglade');
    expect(cleDeNom('Éric Coquerel')).toBe('eric coquerel');
    expect(cleDeNom('Mme Nathalie Colin-Oesterlé')).toBe('mme nathalie colin oesterle');
  });

  it('rapproche les deux apostrophes', () => {
    expect(cleDeNom('Hervé de l’Épine')).toBe(cleDeNom("Hervé de l'Épine"));
  });
});

describe('resoudreOrateur', () => {
  const index = indexerOrateurs([
    { id: 'a', prenom: 'Thibault', nom: 'Bazin' },
    { id: 'b', prenom: 'Éric', nom: 'Coquerel' },
    { id: 'c', prenom: 'Charles', nom: 'de Courson' },
    // Deux Martin : le patronyme seul ne doit plus rien désigner.
    { id: 'd', prenom: 'Jean', nom: 'Martin' },
    { id: 'e', prenom: 'Claire', nom: 'Martin' },
  ]);

  it('résout un nom complet', () => {
    expect(resoudreOrateur('Thibault Bazin', index)).toBe('a');
    expect(resoudreOrateur('eric coquerel', index)).toBe('b');
  });

  it('résout un patronyme seul quand il est unique', () => {
    expect(resoudreOrateur('Bazin', index)).toBe('a');
  });

  it('refuse de choisir entre deux homonymes', () => {
    expect(resoudreOrateur('Martin', index)).toBeNull();
    // Les noms complets, eux, restent distincts.
    expect(resoudreOrateur('Jean Martin', index)).toBe('d');
    expect(resoudreOrateur('Claire Martin', index)).toBe('e');
  });

  it('garde la particule', () => {
    expect(resoudreOrateur('Charles de Courson', index)).toBe('c');
  });

  // Le piège qui a coûté 46 018 amendements mal attribués : chercher un nom
  // en sous-chaîne. Ici, une clé partielle ne doit RIEN rendre.
  it('ne résout pas sur une sous-chaîne', () => {
    expect(resoudreOrateur('Bazin Thibault Untel', index)).toBeNull();
    expect(resoudreOrateur('Thibault', index)).toBeNull();
    expect(resoudreOrateur('Coquerel Éric', index)).toBeNull();
  });

  it('rend null sur un orateur sans nom', () => {
    expect(resoudreOrateur(null, index)).toBeNull();
    expect(resoudreOrateur('', index)).toBeNull();
  });

  it('ne résout pas une homonymie parfaite', () => {
    const jumeaux = indexerOrateurs([
      { id: 'x', prenom: 'Jean', nom: 'Dupont' },
      { id: 'y', prenom: 'Jean', nom: 'Dupont' },
    ]);
    expect(resoudreOrateur('Jean Dupont', jumeaux)).toBeNull();
  });
});

describe('prenomEtNom', () => {
  it('sépare au premier espace', () => {
    expect(prenomEtNom('Thibault Bazin')).toEqual({ prenom: 'Thibault', nom: 'Bazin' });
    expect(prenomEtNom('Charles de Courson')).toEqual({ prenom: 'Charles', nom: 'de Courson' });
  });

  it('accepte un nom seul', () => {
    expect(prenomEtNom('Bazin')).toEqual({ prenom: null, nom: 'Bazin' });
    expect(prenomEtNom(null)).toEqual({ prenom: null, nom: null });
  });
});

describe('sourceUidCommission', () => {
  it('rend la réingestion idempotente', () => {
    expect(sourceUidCommission('CRCANR5L17S2026PO59051N090', 3)).toBe(
      'CRCANR5L17S2026PO59051N090#3'
    );
  });
});
