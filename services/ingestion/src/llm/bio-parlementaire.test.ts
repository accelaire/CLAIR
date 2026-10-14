import { describe, it, expect } from 'vitest';
import { defautsBio, signatureEditoriale, type SignatureEditorialeInput } from './bio-parlementaire';

// =============================================================================
// Défauts refusés avant publication
// =============================================================================
//
// Les phrases fautives viennent de fiches réellement générées (prod ou essais
// `--preview` du 2026-10-11). Un faux négatif publie une affirmation fausse ;
// un faux positif ne coûte qu'un second appel au modèle.

const ancienDepute = { actif: false, chambre: 'assemblee' };
const senateurEnExercice = { actif: true, chambre: 'senat' };
const deputeEnExercice = { actif: true, chambre: 'assemblee' };

describe('defautsBio — âges et durées qui courent encore', () => {
  it.each([
    'À seulement 22 ans lors de son élection, il est devenu l’un des plus jeunes députés.',
    'Élu pour la première fois à 22 ans, il est aujourd’hui un visage connu.',
    'Jean Moulliere est un député français de 32 ans.',
    'Antoine Armand est un homme politique français de 33 ans, membre du groupe EPR.',
    'Âgé de 81 ans, il reste une figure du département.',
  ])('refuse l’âge « %s »', (phrase) => {
    expect(defautsBio(phrase, deputeEnExercice)[0]).toMatch(/^âge/);
  });

  it.each([
    'Il exerce ce mandat sans discontinuer depuis plus de trente ans.',
    'Elle est conseillère municipale depuis 12 ans.',
  ])('refuse la durée qui court encore « %s »', (phrase) => {
    expect(defautsBio(phrase, deputeEnExercice)[0]).toMatch(/^durée qui court encore/);
  });

  it.each([
    'Élu en 2022, il a été maire de 2014 à 2020.',
    'Il siège dans les rangs de la majorité depuis 2017.',
    'Il est l’un des plus jeunes députés de la législature.',
    'Il a voté contre le projet de loi de finances pour 2025.',
    // Durées de périodes closes : déconseillées par le prompt, pas refusées
    // (cf. commentaire de DUREE_OUVERTE).
    'Il a été député de l’Aveyron pendant près de sept ans.',
    'Alain Milon a été un sénateur du Vaucluse pendant plus de vingt ans.',
  ])('accepte « %s »', (phrase) => {
    expect(defautsBio(phrase, deputeEnExercice)).toEqual([]);
  });
});

describe("defautsBio — chiffres d'activité", () => {
  it.each([
    'Il a déposé 148 amendements.',
    'Il a déposé de nombreux amendements, dont 21 ont été adoptés.',
    'Son taux de présence aux scrutins (19%) reste modeste.',
    'avec un taux de présence de 26 %',
    'Il a participé à 1 000 votes.',
    'Il a pris la parole à 154 reprises lors de 74 interventions.',
  ])('refuse « %s »', (phrase) => {
    expect(defautsBio(phrase, deputeEnExercice).some(d => d.startsWith("chiffre d'activité"))).toBe(true);
  });

  it.each([
    'Candidat aux municipales à Montpellier, il recueille 1,67 % des suffrages.',
    'Elle est élue avec 52 % des voix au second tour.',
  ])('accepte un score électoral « %s »', (phrase) => {
    expect(defautsBio(phrase, deputeEnExercice)).toEqual([]);
  });

  it("accepte une loi ou un article chiffrés, qui ne périment pas", () => {
    expect(defautsBio("Il s'est opposé à l'usage du 49.3 sur la loi de 2023.", deputeEnExercice)).toEqual([]);
  });
});

describe('defautsBio — mandat terminé décrit au présent', () => {
  it.each([
    'David Guiraud est un député français issu de La France insoumise.',
    'Elle est une députée engagée sur les questions sociales.',
    'Il est actuellement sénateur de la Gironde.',
    "Il siège à l'Assemblée nationale depuis 2022.",
    'Elle siège au Sénat depuis 2020.',
  ])('refuse pour un ancien « %s »', (phrase) => {
    expect(defautsBio(phrase, ancienDepute).some(d => d.startsWith('mandat terminé'))).toBe(true);
  });

  it.each([
    'David Guiraud est un ancien député de la 8e circonscription du Nord.',
    'Il a été député de 2022 à 2026.',
    "Il a siégé à l'Assemblée nationale.",
    'Il est maire de Roubaix.',
  ])('accepte pour un ancien « %s »', (phrase) => {
    expect(defautsBio(phrase, ancienDepute)).toEqual([]);
  });

  it("refuse un sénateur en exercice présenté comme député (bio figée d'avant l'élection)", () => {
    const defauts = defautsBio('Edwige Diaz est une députée de la Gironde.', senateurEnExercice);
    expect(defauts.some(d => d.startsWith("présenté au présent comme membre de l'autre chambre"))).toBe(true);
  });

  it('accepte un parcours « député puis sénateur » (faux positif du 2026-10-11, Loïc Kervran)', () => {
    expect(defautsBio('Loïc Kervran est un député puis sénateur français.', senateurEnExercice)).toEqual([]);
    expect(defautsBio('Elle est une députée devenue sénatrice en 2026.', senateurEnExercice)).toEqual([]);
  });

  it('accepte un sénateur en exercice ancien député', () => {
    expect(defautsBio('Frank Giletti est sénateur du Var, ancien député du Rassemblement national.', senateurEnExercice)).toEqual([]);
  });

  it('accepte un député en exercice présenté au présent', () => {
    expect(defautsBio('Louis Boyard est député du Val-de-Marne.', deputeEnExercice)).toEqual([]);
  });

  it('cite le passage fautif pour le journal et le second essai', () => {
    expect(defautsBio('David Guiraud est un député français.', ancienDepute)[0]).toContain('est un député');
  });
});

// =============================================================================
// Empreinte éditoriale
// =============================================================================

const m16 = { chambre: 'assemblee', legislature: 16, mandature: null, dateDebut: new Date('2022-06-22T00:00:00Z'), dateFin: new Date('2024-06-09T00:00:00Z') };
const m17 = { chambre: 'assemblee', legislature: 17, mandature: null, dateDebut: new Date('2024-07-18T00:00:00Z'), dateFin: null };

const base: SignatureEditorialeInput = {
  nom: 'Guiraud',
  prenom: 'David',
  chambre: 'assemblee',
  actif: true,
  groupe: 'LFI-NFP',
  commissionPermanente: 'Commission des affaires économiques',
  circonscription: { departement: '59', numero: 8 },
  mandatsParlementaires: [m16, m17],
};

describe('signatureEditoriale', () => {
  it('change quand le mandat se termine', () => {
    const fin = {
      ...base,
      actif: false,
      mandatsParlementaires: [m16, { ...m17, dateFin: new Date('2026-04-07T00:00:00Z') }],
    };
    expect(signatureEditoriale(fin)).not.toBe(signatureEditoriale(base));
  });

  it('change avec le groupe, la commission ou la chambre', () => {
    const sig = signatureEditoriale(base);
    expect(signatureEditoriale({ ...base, groupe: 'ECOS' })).not.toBe(sig);
    expect(signatureEditoriale({ ...base, commissionPermanente: 'Commission des lois' })).not.toBe(sig);
    expect(signatureEditoriale({ ...base, chambre: 'senat' })).not.toBe(sig);
  });

  it("ne change pas pour une date de fin corrigée dans la même année", () => {
    const avril = { ...base, mandatsParlementaires: [m16, { ...m17, dateFin: new Date('2026-04-07T00:00:00Z') }] };
    const juillet = { ...base, mandatsParlementaires: [m16, { ...m17, dateFin: new Date('2026-07-22T00:00:00Z') }] };
    expect(signatureEditoriale(avril)).toBe(signatureEditoriale(juillet));
  });

  it("ne dépend pas de l'ordre de lecture des mandats", () => {
    const inverse = { ...base, mandatsParlementaires: [...base.mandatsParlementaires].reverse() };
    expect(signatureEditoriale(inverse)).toBe(signatureEditoriale(base));
  });

  it("ne dépend pas de l'ordre de deux mandats commencés le même jour", () => {
    const debut = new Date('2020-10-01T00:00:00Z');
    const avantGouvernement = { chambre: 'senat', legislature: null, mandature: 2020, dateDebut: debut, dateFin: new Date('2024-10-21T00:00:00Z') };
    const mandatComplet = { chambre: 'senat', legislature: null, mandature: 2020, dateDebut: debut, dateFin: new Date('2026-09-30T00:00:00Z') };
    const a = { ...base, mandatsParlementaires: [avantGouvernement, mandatComplet] };
    const b = { ...base, mandatsParlementaires: [mandatComplet, avantGouvernement] };
    expect(signatureEditoriale(a)).toBe(signatureEditoriale(b));
  });
});
