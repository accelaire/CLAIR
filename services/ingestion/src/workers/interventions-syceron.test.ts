import { describe, it, expect } from 'vitest';
import { regrouperPrises, estMembreDuGouvernement } from './interventions-syceron';
import { TYPE_INTERRUPTION, TYPE_REPONSE } from '../utils/interventions';
import type { PriseDeParoleSyceron } from '../sources/assemblee-nationale/syceron-parser';

function prise(p: Partial<PriseDeParoleSyceron> & { ordreAbsolu: number }): PriseDeParoleSyceron {
  return {
    sourceUid: `s${p.ordreAbsolu}`,
    codeGrammaire: 'PAROLE_GENERIQUE',
    orateurRef: 'PA1',
    orateurNom: 'Monnet',
    orateurPrenom: 'Yannick',
    orateurQualite: null,
    contenu: 'Un propos suffisamment long pour être conservé.',
    articleVise: '15',
    amendementsVises: [],
    texteNumero: '1364',
    codeRubrique: null,
    dansExplicationDeVote: false,
    estPresidence: false,
    ...p,
  };
}

describe('regrouperPrises', () => {
  it("fond les paragraphes consécutifs d'un même orateur en un seul tour", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'Premier paragraphe de mon propos.' }),
      prise({ ordreAbsolu: 2, contenu: 'Second paragraphe de mon propos.' }),
    ]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.contenu).toBe('Premier paragraphe de mon propos.\n\nSecond paragraphe de mon propos.');
    expect(groupes[0]?.sourceUid).toBe('s1');
    expect(groupes[0]?.ordreAbsolu).toBe(1);
  });

  it('sépare deux orateurs différents', () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, orateurRef: 'PA1' }),
      prise({ ordreAbsolu: 2, orateurRef: 'PA2', orateurNom: 'Juvin' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it("ne fond pas deux prises séparées par un changement d'article", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, articleVise: '15' }),
      prise({ ordreAbsolu: 2, articleVise: '16' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('laisse chaque paragraphe de présidence isolé, car il segmente le débat', () => {
    // Deux annonces consécutives du perchoir : les fondre effacerait la
    // frontière entre deux mises aux voix.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, estPresidence: true, orateurRef: 'PA9', orateurNom: 'présidente',
        codeGrammaire: 'SCRUT_PUB_ADT_1_2', contenu: 'Je mets aux voix l’amendement no 1.' }),
      prise({ ordreAbsolu: 2, estPresidence: true, orateurRef: 'PA9', orateurNom: 'présidente',
        codeGrammaire: 'SCRUT_PUB_ADT_1_4', contenu: 'Voici le résultat du scrutin.' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('ne fond jamais deux orateurs non identifiés entre eux', () => {
    // Sans `id_acteur`, rien ne prouve que deux paragraphes sont du même orateur.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, orateurRef: null, orateurNom: 'Un député' }),
      prise({ ordreAbsolu: 2, orateurRef: null, orateurNom: 'Un député' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('écarte les prises trop courtes pour dire quoi que ce soit', () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'Non !' }),
      prise({ ordreAbsolu: 2, orateurRef: 'PA2', contenu: 'Un propos de longueur normale, lui.' }),
    ]);
    expect(groupes.map((g) => g.ordreAbsolu)).toEqual([2]);
  });

  it('conserve une annonce de séance même très courte', () => {
    // Elle ne s'affiche pas, mais elle porte la segmentation.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, estPresidence: true, codeGrammaire: 'SCRUT_ART_PUB_1_7', contenu: 'Scrutin.' }),
    ]);
    expect(groupes).toHaveLength(1);
  });

  it('classe le type sur le code de grammaire, pas sur le texte', () => {
    // L'ancien parseur classait en « question » tout propos contenant ce mot.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'La question posée par cet amendement est délicate.' }),
    ]);
    expect(groupes[0]?.type).toBe('intervention');
  });

  it('type les interruptions à part, pour les tenir hors des compteurs', () => {
    const groupes = regrouperPrises([
      prise({
        ordreAbsolu: 1,
        codeGrammaire: 'INTERRUPTION_1_10',
        contenu: 'Nous avons déjà entendu ce discours !',
      }),
    ]);
    expect(groupes[0]?.type).toBe(TYPE_INTERRUPTION);
  });

  it('fond les paragraphes consécutifs d\'un ministre, qui n\'a pas de fiche', () => {
    const ministre = { orateurRef: null, orateurNom: 'Bayrou', orateurQualite: 'premier ministre' };
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, ...ministre, contenu: 'Premier paragraphe de mon propos.' }),
      prise({ ordreAbsolu: 2, ...ministre, contenu: 'Second paragraphe de mon propos.' }),
    ]);
    expect(groupes).toHaveLength(1);
  });

  it('ne fond pas des paroles collectives, qui recouvrent plusieurs personnes', () => {
    // « députés du groupe SOC » n'est pas quelqu'un : sans qualité, pas de fusion.
    const collectif = { orateurRef: null, orateurNom: 'députés du groupe SOC', orateurQualite: null };
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, ...collectif, contenu: 'Une première exclamation de la part du groupe.' }),
      prise({ ordreAbsolu: 2, ...collectif, contenu: 'Une seconde exclamation, d\'un autre député.' }),
    ]);
    expect(groupes).toHaveLength(2);
  });

  it('type en question ce qui relève de la rubrique des questions au Gouvernement', () => {
    // Le paragraphe porte un code générique : seule la rubrique le dit.
    const groupes = regrouperPrises([
      prise({
        ordreAbsolu: 1,
        codeGrammaire: 'PAROLE_GENERIQUE',
        codeRubrique: 'QG_1_1',
        contenu: 'La canicule frappe durement les plus fragiles de nos concitoyens.',
      }),
    ]);
    expect(groupes[0]?.type).toBe('question');
  });

  it.each([
    ['QG_1_1', 'au Gouvernement'],
    ['QOSD_1_1', 'orale sans débat'],
    ['QPM_1_1', 'au Premier ministre'],
  ])('type en question une prise sous la rubrique %s (question %s)', (codeRubrique) => {
    const groupes = regrouperPrises([
      prise({
        ordreAbsolu: 1,
        codeGrammaire: 'PAROLE_GENERIQUE',
        codeRubrique,
        contenu: 'Ma question porte sur la fermeture des services d\'urgence.',
      }),
    ]);
    expect(groupes[0]?.type).toBe('question');
  });

  it('laisse une interruption sous rubrique QG au type interruption', () => {
    const groupes = regrouperPrises([
      prise({
        ordreAbsolu: 1,
        codeGrammaire: 'INTERRUPTION_1_10',
        codeRubrique: 'QG_1_1',
        contenu: 'Oui, c\'est un peu léger !',
      }),
    ]);
    expect(groupes[0]?.type).toBe(TYPE_INTERRUPTION);
  });

  it("n'agrège pas une interruption avec le tour de parole qu'elle coupe", () => {
    // Même orateur de part et d'autre : sans distinction de type, les deux
    // prises fusionneraient et le chahut se retrouverait dans le propos.
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'Je défends cet amendement de repli.' }),
      prise({ ordreAbsolu: 2, codeGrammaire: 'INTERRUPTION_1_10', contenu: 'Mais bien sûr !' }),
    ]);
    expect(groupes.map((g) => g.type)).toEqual(['intervention', TYPE_INTERRUPTION]);
  });
});

describe('estMembreDuGouvernement', () => {
  it('reconnaît les qualités gouvernementales, quelle que soit leur forme', () => {
    for (const qualite of [
      'ministre',
      'ministre déléguée chargée de l’énergie',
      'Premier ministre',
      'Première ministre',
      'secrétaire d’État',
      'garde des sceaux, ministre de la justice',
      'porte-parole du gouvernement, ministre déléguée chargée de l’énergie',
    ]) {
      expect(estMembreDuGouvernement(qualite)).toBe(true);
    }
  });

  it("ne prend pas un député pour un ministre à cause d'une sous-chaîne", () => {
    // « administration » contient « ministr » : 562 paragraphes de la 17e
    // législature portent cette qualité, tous des députés.
    for (const qualite of [
      'rapporteur de la commission des lois constitutionnelles, de la législation et de l’administration générale de la République',
      'président de la commission des finances',
      'rapporteure',
      'administratrice nationale de la FCPE',
    ]) {
      expect(estMembreDuGouvernement(qualite)).toBe(false);
    }
  });

  it('traite une qualité absente comme non gouvernementale', () => {
    expect(estMembreDuGouvernement(null)).toBe(false);
  });
});

describe('typage des questions au Gouvernement', () => {
  const sousRubriqueQG = { codeRubrique: 'QG_1_1', codeGrammaire: 'PAROLE_GENERIQUE' };

  it('compte la question du député qui interroge', () => {
    const [groupe] = regrouperPrises([prise({ ordreAbsolu: 1, ...sousRubriqueQG })]);
    expect(groupe?.type).toBe('question');
  });

  it("range la réponse du ministre à part, pour qu'elle ne compte pas comme une question", () => {
    const [groupe] = regrouperPrises([
      prise({ ordreAbsolu: 1, ...sousRubriqueQG, orateurRef: null, orateurQualite: 'Premier ministre' }),
    ]);
    expect(groupe?.type).toBe(TYPE_REPONSE);
  });

  it("ne sépare pas la réponse hors d'une séquence de questions", () => {
    const [groupe] = regrouperPrises([
      prise({ ordreAbsolu: 1, orateurRef: null, orateurQualite: 'ministre' }),
    ]);
    expect(groupe?.type).toBe('intervention');
  });
});

describe('explications de vote', () => {
  it('type la prise de parole marquée par le parseur', () => {
    const [groupe] = regrouperPrises([prise({ ordreAbsolu: 1, dansExplicationDeVote: true })]);
    expect(groupe?.type).toBe('explication_vote');
  });

  it("ne fond pas une explication de vote avec le propos de fond du même orateur", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 1, contenu: 'Mon propos dans la discussion générale.' }),
      prise({ ordreAbsolu: 2, contenu: 'Mon explication de vote, ensuite.', dansExplicationDeVote: true }),
    ]);
    expect(groupes.map((g) => g.type)).toEqual(['intervention', 'explication_vote']);
  });
});

describe('tours de parole traversés par le chahut', () => {
  it("recolle un propos que des interruptions ont coupé", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 9, contenu: 'Je me fais le relais de nombreux Français.' }),
      prise({
        ordreAbsolu: 10,
        codeGrammaire: 'INTERRUPTION_1_10',
        orateurRef: 'PA2',
        orateurNom: 'Cordier',
        contenu: 'Moi, je ne suis pas d’accord !',
      }),
      prise({ ordreAbsolu: 11, contenu: '…il y voit un pacte de réconciliation.' }),
    ]);

    const fond = groupes.filter((g) => g.type !== TYPE_INTERRUPTION);
    expect(fond).toHaveLength(1);
    expect(fond[0]?.contenu).toContain('Je me fais le relais');
    expect(fond[0]?.contenu).toContain('pacte de réconciliation');
  });

  it("garde l'interruption comme prise de parole distincte, à son auteur", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 9, contenu: 'Mon propos, première partie.' }),
      prise({
        ordreAbsolu: 10,
        codeGrammaire: 'INTERRUPTION_1_10',
        orateurRef: 'PA2',
        orateurNom: 'Cordier',
        contenu: 'Moi, je ne suis pas d’accord !',
      }),
      prise({ ordreAbsolu: 11, contenu: 'Mon propos, seconde partie.' }),
    ]);
    const chahut = groupes.filter((g) => g.type === TYPE_INTERRUPTION);
    expect(chahut).toHaveLength(1);
    expect(chahut[0]?.orateurNom).toBe('Cordier');
  });

  it('ne recolle pas par-dessus la présidence, qui donne la parole à un autre', () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 9, contenu: 'Mon propos sur cet article.' }),
      prise({
        ordreAbsolu: 10,
        orateurRef: null,
        orateurNom: 'présidente',
        estPresidence: true,
        contenu: 'La parole est à Mme Géraldine Bannier.',
      }),
      prise({ ordreAbsolu: 11, contenu: 'Je reprends la parole plus tard, autre tour.' }),
    ]);
    expect(groupes.filter((g) => !g.estPresidence)).toHaveLength(2);
  });

  it("ne recolle pas deux orateurs différents séparés par une interruption", () => {
    const groupes = regrouperPrises([
      prise({ ordreAbsolu: 9, contenu: 'Le propos du premier orateur.' }),
      prise({
        ordreAbsolu: 10,
        codeGrammaire: 'INTERRUPTION_1_10',
        orateurRef: 'PA3',
        orateurNom: 'Taurinya',
        contenu: 'Ça ne règle rien !',
      }),
      prise({ ordreAbsolu: 11, orateurRef: 'PA9', orateurNom: 'Autre', contenu: 'Le propos du second orateur.' }),
    ]);
    expect(groupes.filter((g) => g.type !== TYPE_INTERRUPTION)).toHaveLength(2);
  });
});
