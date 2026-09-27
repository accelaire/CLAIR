import { describe, expect, it } from 'vitest';
import {
  casseDeLieu,
  deCommune,
  lireLigneRne,
  mandatsDuCandidat,
  ordonnerMandats,
  regrouperPersonnes,
} from './mandats-locaux';
import type { LigneRne } from './mandats-locaux';

// Lignes réelles du Répertoire national des élus (mise à jour du 11/08/2026),
// ramenées aux colonnes lues.
const identite = (nom: string, prenom: string, sexe: string, naissance: string) => ({
  "Nom de l'élu": nom,
  "Prénom de l'élu": prenom,
  'Code sexe': sexe,
  'Date de naissance': naissance,
});

describe('lireLigneRne', () => {
  it('écrit un maire avec la bonne préposition', () => {
    const ligne = lireLigneRne('mai', {
      ...identite('MOUGENOT', 'Paul', 'M', '1970-01-01'),
      'Libellé de la commune': 'Aguilcourt',
      'Date de début du mandat': '2026-03-15',
      'Date de début de la fonction': '2026-03-21',
    });
    expect(ligne?.mandat).toEqual({ type: 'maire', libelle: "Maire d'Aguilcourt", depuis: '2026-03-21' });
  });

  it('ne double pas le maire lu dans le fichier des conseillers municipaux', () => {
    expect(
      lireLigneRne('cm', {
        ...identite('MOUGENOT', 'Paul', 'M', '1970-01-01'),
        'Libellé de la commune': 'Aguilcourt',
        'Libellé de la fonction': 'Maire',
      })
    ).toBeNull();
  });

  it('accorde la fonction et normalise les ordinaux', () => {
    const adjointe = lireLigneRne('cm', {
      ...identite('FRONTONI', 'Gaëlle', 'F', '1980-01-01'),
      'Libellé de la commune': 'Nice',
      'Libellé de la fonction': '3ème adjoint au Maire',
    });
    expect(adjointe?.mandat.libelle).toBe('3e adjointe au maire de Nice');

    const vicePresidente = lireLigneRne('cd', {
      ...identite('FRONTONI', 'Gaëlle', 'F', '1980-01-01'),
      'Libellé du département': 'Alpes-Maritimes',
      'Libellé du canton': 'Nice-9',
      'Libellé de la fonction': '4ème Vice-président du conseil départemental',
    });
    expect(vicePresidente?.mandat.libelle).toBe('4e vice-présidente du conseil départemental (Alpes-Maritimes, canton de Nice-9)');
  });

  it("n'accorde pas l'institution avec la personne", () => {
    const presidente = lireLigneRne('cd', {
      ...identite('X', 'Y', 'F', '1960-01-01'),
      'Libellé du département': 'Aisne',
      'Libellé du canton': 'Vervins',
      'Libellé de la fonction': 'Président du conseil départemental',
    });
    expect(presidente?.mandat).toMatchObject({
      type: 'executif_collectivite',
      libelle: 'Présidente du conseil départemental (Aisne)',
    });
  });

  it('écrit une intercommunalité avec ses sigles et ses particules', () => {
    const ligne = lireLigneRne('epci', {
      ...identite('MOUGENOT', 'Paul', 'M', '1970-01-01'),
      "Libellé de l'EPCI": 'Cc De La Champagne Picarde',
      'Libellé de la fonction': '5eme Vice-président du conseil communautaire',
    });
    expect(ligne?.mandat).toMatchObject({
      type: 'executif_intercommunalite',
      libelle: '5e vice-président du conseil communautaire (CC de la Champagne Picarde)',
    });
  });

  it("lit les assemblées de collectivité, où siègent la Guyane et Wallis-et-Futuna", () => {
    const ligne = lireLigneRne('ma', {
      ...identite('TUKUMULI', 'Lafaele', 'M', '1972-11-05'),
      'Libellé de la collectivité à statut particulier': 'Wallis Et Futuna',
      'Date de début du mandat': '2017-03-26',
    });
    expect(ligne?.mandat).toEqual({ type: 'collectivite', libelle: "Membre de l'assemblée (Wallis et Futuna)", depuis: '2017-03-26' });
  });

  it('écarte une ligne sans date de naissance', () => {
    expect(lireLigneRne('mai', { ...identite('X', 'Y', 'M', ''), 'Libellé de la commune': 'Bram' })).toBeNull();
  });
});

describe('casseDeLieu et deCommune', () => {
  it('rend leur minuscule aux particules, sauf en tête', () => {
    expect(casseDeLieu('Rozoy-Sur-Serre')).toBe('Rozoy-sur-Serre');
    expect(casseDeLieu('La Roche-Sur-Yon')).toBe('La Roche-sur-Yon');
  });
  it('élide et contracte', () => {
    expect(deCommune('Bram')).toBe('de Bram');
    expect(deCommune('Aguilcourt')).toBe("d'Aguilcourt");
    expect(deCommune('Le Mans')).toBe('du Mans');
    expect(deCommune('Les Mureaux')).toBe('des Mureaux');
    expect(deCommune('La Rochelle')).toBe('de La Rochelle');
  });
});

describe('mandatsDuCandidat', () => {
  const ligne = (nom: string, prenom: string, naissance: string, libelle: string): LigneRne => ({
    nom,
    prenom,
    sexe: 'M',
    dateNaissance: naissance,
    mandat: { type: 'maire', libelle, depuis: '2026-03-15' },
  });

  it('rattache au niveau A sur nom, prénom et date', () => {
    const index = regrouperPersonnes([ligne('FAUCON MEJEAN', 'Claudie', '1965-01-01', 'Maire de Bram')]);
    const rattache = mandatsDuCandidat({ nom: 'Faucon-Méjean', prenom: 'Claudie', dateNaissance: new Date('1965-01-01') }, index);
    expect(rattache).toEqual({ confiance: 'A', mandats: [expect.objectContaining({ libelle: 'Maire de Bram' })] });
  });

  it('rattache au niveau B une coquille de prénom quand la personne est seule', () => {
    const index = regrouperPersonnes([ligne('BOST', 'Christine', '1956-01-01', 'Maire de Eysines')]);
    const rattache = mandatsDuCandidat({ nom: 'BOST', prenom: 'Chistine', dateNaissance: new Date('1956-01-01') }, index);
    expect(rattache?.confiance).toBe('B');
  });

  it('refuse un prénom sans rapport, même seul à ce nom et cette date (des jumeaux ?)', () => {
    const index = regrouperPersonnes([ligne('BARBIER', 'Pascal', '1960-01-01', 'Président du conseil communautaire (X)')]);
    expect(mandatsDuCandidat({ nom: 'BARBIER', prenom: 'Bernard', dateNaissance: new Date('1960-01-01') }, index)).toBeNull();
  });

  it('accepte les prénoms multiples et les prénoms d’usage', () => {
    const index = regrouperPersonnes([ligne('LICCIONI', 'Marie-Thérèse Dite Anne-Marie', '1950-01-01', 'Conseillère (X)')]);
    expect(mandatsDuCandidat({ nom: 'LICCIONI', prenom: 'Anne-Marie', dateNaissance: new Date('1950-01-01') }, index)?.confiance).toBe('B');
  });

  it('refuse de choisir entre deux personnes de même nom nées le même jour', () => {
    const index = regrouperPersonnes([
      ligne('MARTIN', 'Jean', '1970-01-01', 'Maire de A'),
      ligne('MARTIN', 'Paul', '1970-01-01', 'Maire de B'),
    ]);
    expect(mandatsDuCandidat({ nom: 'MARTIN', prenom: 'Pierre', dateNaissance: new Date('1970-01-01') }, index)).toBeNull();
  });

  it('ne rattache jamais sans date de naissance', () => {
    const index = regrouperPersonnes([ligne('MARTIN', 'Jean', '1970-01-01', 'Maire de A')]);
    expect(mandatsDuCandidat({ nom: 'MARTIN', prenom: 'Jean', dateNaissance: null }, index)).toBeNull();
  });
});

describe('ordonnerMandats', () => {
  it("met l'exécutif en tête et retire les doublons", () => {
    const tries = ordonnerMandats([
      { type: 'conseil_municipal', libelle: 'Conseiller municipal de Nice', depuis: '2026-03-15' },
      { type: 'departement', libelle: 'Conseiller départemental (Aisne)', depuis: '2021-07-01' },
      { type: 'maire', libelle: "Maire d'Aguilcourt", depuis: '2026-03-21' },
      { type: 'maire', libelle: "Maire d'Aguilcourt", depuis: '2026-03-21' },
    ]);
    expect(tries.map((m) => m.type)).toEqual(['maire', 'departement', 'conseil_municipal']);
  });
});
