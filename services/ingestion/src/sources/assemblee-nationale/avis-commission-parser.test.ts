import { describe, it, expect } from 'vitest';
import {
  parserAvisCommission,
  colonnesDeLEnTete,
  lireLigneDeTableau,
  sensDeLAvis,
  avisAnnonce,
  numerosDeTexteDuCompteRendu,
} from './avis-commission-parser';

// Toutes les mises en page ci-dessous sont recopiées de comptes rendus réels
// passés par `pdftotext -layout` : commissions des finances, des lois, des
// affaires sociales, des affaires économiques et des affaires culturelles.

describe('colonnesDeLEnTete', () => {
  it('lit l’ordre des colonnes, quel que soit leur nom', () => {
    expect(
      colonnesDeLEnTete('   N° Amdt           Place               Auteur          Groupe     Position de la commission')
        ?.map((c) => c.role)
    ).toEqual(['numero', 'place', 'auteur', 'groupe', 'position']);

    expect(
      colonnesDeLEnTete('  Article       Amendement                     Auteur                      Groupe                Sort')
        ?.map((c) => c.role)
    ).toEqual(['place', 'numero', 'auteur', 'groupe', 'position']);

    expect(
      colonnesDeLEnTete('       N°              N° id.        Auteur          Groupe      Place')
        ?.map((c) => c.role)
    ).toEqual(['numero', 'identique', 'auteur', 'groupe', 'place']);
  });

  it('écarte ce qui n’est pas un tableau d’avis', () => {
    expect(colonnesDeLEnTete('Membres présents ou excusés')).toBeNull();
    // Il faut au moins un numéro, un auteur et un groupe.
    expect(colonnesDeLEnTete('   Auteur        Groupe')).toBeNull();
  });
});

describe('lireLigneDeTableau', () => {
  const avecPosition = colonnesDeLEnTete(
    '   N° Amdt           Place               Auteur          Groupe     Position de la commission'
  )!;
  const placeDevant = colonnesDeLEnTete(
    '  Article       Amendement                     Auteur                      Groupe                Sort'
  )!;
  const placeDerriere = colonnesDeLEnTete(
    '       N°              N° id.        Auteur          Groupe      Place'
  )!;

  it('lit une ligne ordinaire', () => {
    const l = lireLigneDeTableau(
      '  2848       11              Mme LEJEUNE Claire          LFI-NFP Repoussé',
      avecPosition
    );
    expect(Object.fromEntries(l!)).toEqual({
      numero: '2848',
      place: '11',
      auteur: 'Mme LEJEUNE Claire',
      groupe: 'LFI-NFP',
      position: 'Repoussé',
    });
  });

  // Un seul espace sépare parfois le groupe de l'avis : découper la ligne sur
  // les blancs multiples collait « LFI-NFP Repoussé » en une seule cellule.
  it('sépare le groupe de l’avis même sans double espace', () => {
    const l = lireLigneDeTableau(
      '  2195       11              Mme MAXIMI Marianne         LFI-NFP Repoussé',
      avecPosition
    );
    expect(l!.get('groupe')).toBe('LFI-NFP');
    expect(l!.get('position')).toBe('Repoussé');
  });

  // Quand la place précède le numéro, les deux sont des nombres : « 2 70 » se
  // lit article 2, amendement 70.
  it('ne confond pas l’article et le numéro d’amendement', () => {
    const l = lireLigneDeTableau(
      '     2                70                    Gouvernement                          Accepté',
      placeDevant
    );
    expect(l!.get('place')).toBe('2');
    expect(l!.get('numero')).toBe('70');
    expect(l!.get('auteur')).toBe('Gouvernement');
    expect(l!.has('groupe')).toBe(false);
  });

  it('lit un article littéral et ses suffixes', () => {
    expect(
      lireLigneDeTableau('   ap 3 bis        4        M. COLOMBANI Paul-André    LIOT   Repoussé', placeDevant)
        ?.get('place')
    ).toBe('ap 3 bis');
    expect(
      lireLigneDeTableau('   PREMIER      27       M. DUFAU Peio          SOC     Accepté', placeDevant)
        ?.get('place')
    ).toBe('PREMIER');
  });

  it('lit un groupe écrit en toutes lettres', () => {
    const l = lireLigneDeTableau(
      '      1er            21          Mme HERVIEU Catherine          Écologiste et Social        Repoussé',
      placeDevant
    );
    expect(l!.get('place')).toBe('1er');
    expect(l!.get('numero')).toBe('21');
    expect(l!.get('auteur')).toBe('Mme HERVIEU Catherine');
    expect(l!.get('groupe')).toBe('Écologiste et Social');
    expect(l!.get('position')).toBe('Repoussé');
  });

  it('garde un patronyme en plusieurs mots', () => {
    expect(
      lireLigneDeTableau(
        '  1        PREMIER       Mme PIRÈS BEAUNE Christine        SOC      Accepté',
        avecPosition
      )?.get('auteur')
    ).toBe('Mme PIRÈS BEAUNE Christine');
  });

  it('absorbe une colonne d’identiques vide', () => {
    expect(
      Object.fromEntries(
        lireLigneDeTableau('      1706                       M. BAZIN Thibault       DR      18', placeDerriere)!
      )
    ).toEqual({ numero: '1706', auteur: 'M. BAZIN Thibault', groupe: 'DR', place: '18' });
  });

  it('lit une colonne d’identiques renseignée', () => {
    const l = lireLigneDeTableau('      1759    334       M. WAUQUIEZ Laurent        DR      Ap. 18', placeDerriere);
    expect(l!.get('identique')).toBe('334');
    expect(l!.get('numero')).toBe('1759');
    expect(l!.get('place')).toBe('Ap. 18');
  });

  it('refuse une ligne de prose', () => {
    expect(
      lireLigneDeTableau('La commission a repoussé tous les amendements.', avecPosition)
    ).toBeNull();
    expect(lireLigneDeTableau('', avecPosition)).toBeNull();
  });
});

describe('sensDeLAvis', () => {
  it('range les libellés des commissions', () => {
    expect(sensDeLAvis('Accepté')).toBe('favorable');
    expect(sensDeLAvis('Avis favorable')).toBe('favorable');
    // « Repoussé » n'est pas « Rejeté » : la commission n'a pas le pouvoir de
    // rejeter un amendement déposé sur le texte qui part en séance.
    expect(sensDeLAvis('Repoussé')).toBe('defavorable');
    expect(sensDeLAvis('Défavorable')).toBe('defavorable');
    expect(sensDeLAvis('Sagesse')).toBe('autre');
  });
});

describe('avisAnnonce', () => {
  it('lit l’avis annoncé au-dessus d’un tableau qui n’en porte pas', () => {
    expect(avisAnnonce('La commission a accepté les amendements figurant dans le tableau ci-après (*) :'))
      .toBe('Accepté');
    expect(avisAnnonce('auxquels il est proposé de donner un avis favorable')).toBe('Avis favorable');
    expect(avisAnnonce('Les amendements suivants ont été repoussés')).toBe('Repoussé');
    expect(avisAnnonce('La commission a procédé à l’examen des amendements.')).toBeNull();
  });
});

describe('parserAvisCommission', () => {
  it('reprend l’avis annoncé quand le tableau n’a pas de colonne d’avis', () => {
    const { avis } = parserAvisCommission(`
       La commission a accepté les amendements figurant dans le tableau ci-après (*) :

       N°              N° id.        Auteur          Groupe      Place

      1706                       M. BAZIN Thibault       DR          18
       334     X                 M. PAUGET Éric          DR      Ap. 18
`);
    expect(avis).toHaveLength(2);
    expect(avis[0]).toMatchObject({ numero: '1706', position: 'Accepté', sens: 'favorable', ordre: 1 });
    expect(avis[1]).toMatchObject({ numero: '334', place: 'Ap. 18', ordre: 2 });
  });

  it('signale un tableau reconnu mais illisible plutôt que de se taire', () => {
    // La mise en page où les cellules larges débordent sur plusieurs lignes.
    const { avis, tableauNonLu } = parserAvisCommission(`
Article     Amendement                Auteur                        Groupe                  Avis

                                                         La France insoumise - Nouveau
  2              1er            M. KERBRAT Andy                                           Repoussé
                                                                Front Populaire
`);
    expect(avis).toEqual([]);
    expect(tableauNonLu).toBe(true);
  });

  it('ne signale rien sur un compte rendu qui n’a pas de tableau', () => {
    const { avis, tableauNonLu } = parserAvisCommission(`
       La séance est ouverte à 15 heures.

       La commission a repoussé tous les amendements.
`);
    expect(avis).toEqual([]);
    expect(tableauNonLu).toBe(false);
  });
});

describe('numerosDeTexteDuCompteRendu', () => {
  it('lit le numéro du texte examiné', () => {
    expect(
      numerosDeTexteDuCompteRendu(
        'des amendements à la première partie du projet de loi de finances pour 2026 (n° 1906)'
      )
    ).toEqual(['1906']);
  });

  it('lit les deux numéros d’un texte qui en porte deux', () => {
    expect(
      numerosDeTexteDuCompteRendu(
        'les amendements à la troisième partie du projet de loi de financement de la sécurité sociale pour 2026 (n°s 1906 et 1999)'
      )
    ).toEqual(['1906', '1999']);
  });

  it('ignore les numéros qui ne désignent pas un texte', () => {
    expect(numerosDeTexteDuCompteRendu('en application de l’article 88 du Règlement')).toEqual([]);
    expect(numerosDeTexteDuCompteRendu('Compte rendu n° 90')).toEqual([]);
  });
});

// =============================================================================
// Les quatre mises en page qui restaient illisibles
// =============================================================================
//
// Relevées sur les 39 comptes rendus dont le tableau était reconnu mais dont
// aucune ligne ne se lisait. Toutes les lignes ci-dessous sont copiées de PDF
// réels : c'est ce qui a montré que ma première explication — « des cellules
// qui débordent sur plusieurs lignes » — était fausse. Les tableaux sont bien
// formés ; c'est la grammaire de la place et la phrase d'annonce qui manquaient.

describe('mises en page longtemps illisibles', () => {
  it('lit « N° Amdt | Place | Auteur | Groupe », dont la place vaut « unique »', () => {
    const colonnes = colonnesDeLEnTete(
      '             N° Amdt         Place                   Auteur              Groupe'
    );
    expect(colonnes?.map((c) => c.role)).toEqual(['numero', 'place', 'auteur', 'groupe']);
    const lu = lireLigneDeTableau(
      '                4            unique           M. POTIER Dominique          SOC',
      colonnes!
    );
    expect(lu?.get('numero')).toBe('4');
    expect(lu?.get('place')).toBe('unique');
    expect(lu?.get('auteur')).toBe('M. POTIER Dominique');
    expect(lu?.get('groupe')).toBe('SOC');
  });

  // Onze tableaux portent les deux colonnes. Rangées sous le même rôle, leurs
  // valeurs se collaient : la place se lisait « 2 13 ».
  it('sépare « Place » et « Alinéa »', () => {
    const colonnes = colonnesDeLEnTete(
      '        N°                       Auteur            Groupe       Place      Alinéa'
    );
    expect(colonnes?.map((c) => c.role)).toEqual(['numero', 'auteur', 'groupe', 'place', 'alinea']);
    const lu = lireLigneDeTableau(
      '        48        Mme LE GRIP Constance              EPR           2         13',
      colonnes!
    );
    expect(lu?.get('place')).toBe('2');
    expect(lu?.get('alinea')).toBe('13');
  });

  it('sépare aussi la place de l’alinéa avec une colonne d’identiques', () => {
    const colonnes = colonnesDeLEnTete(
      '   N°       N° Id                Auteur                Groupe           Place      Alinéa'
    );
    expect(colonnes?.map((c) => c.role)).toEqual([
      'numero', 'identique', 'auteur', 'groupe', 'place', 'alinea',
    ]);
    const lu = lireLigneDeTableau(
      '   114        X     Mme DUBY-MULLER Virginie          DR        2                    3',
      colonnes!
    );
    expect(lu?.get('identique')).toBe('X');
    expect(lu?.get('place')).toBe('2');
    expect(lu?.get('alinea')).toBe('3');
  });

  // 19 des 39 comptes rendus annoncent au présent de narration. La règle
  // n'attendait que le passé composé, si bien que le tableau entier — qui n'a
  // pas de colonne d'avis — restait sans sens et n'était pas écrit.
  it('reconnaît l’annonce au présent', () => {
    expect(avisAnnonce('La commission accepte les amendements figurant dans le tableau ci-après (*) :'))
      .toBe('Accepté');
    // Majuscule à Commission, et la coquille « me tableau » relevée telle quelle.
    expect(avisAnnonce('La Commission accepte les amendements figurant dans me tableau ci-après :'))
      .toBe('Accepté');
  });

  // Séparer les rôles ne doit pas faire perdre sa position à un tableau qui
  // n'a que la colonne « Alinéa » : elle est alors la seule position donnée.
  it('traite « Alinéa » seul comme la place', () => {
    const colonnes = colonnesDeLEnTete(
      '        N°            Auteur            Groupe       Alinéa'
    );
    expect(colonnes?.map((c) => c.role)).toEqual(['numero', 'auteur', 'groupe', 'place']);
  });

  it('n’invente pas de sens quand la phrase n’en donne pas', () => {
    // Celle-ci annonce un tableau QUI PORTE sa propre colonne d'avis : lui
    // prêter un sens global les écraserait tous.
    expect(
      avisAnnonce('Le tableau ci-dessous récapitule le sens des avis émis par la commission sur les amendements :')
    ).toBeNull();
  });
});
