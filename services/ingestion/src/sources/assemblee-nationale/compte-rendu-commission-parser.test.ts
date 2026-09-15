import { describe, it, expect } from 'vitest';
import {
  parserCompteRenduCommission,
  enTeteDuParagraphe,
  decomposerEnTete,
  paragraphes,
  corpsEtPresences,
  nomsDeLaListe,
} from './compte-rendu-commission-parser';

// Tous les extraits ci-dessous sont recopiés de comptes rendus réels passés par
// `pdftotext -layout` (commissions des lois, des finances, des affaires
// sociales, des affaires étrangères, et commission d'enquête sur la protection
// de l'enfance), afin que les tests portent sur la mise en page effective et
// non sur une reconstitution.

const COUVERTURE = `           A SSEM B LÉE                         N A T IO N A L E

                         17e            L É G IS L A T U R E

             Compte rendu                            Mardi 8 septembre 2026

– Réunion sur la communication des rapporteures .......... 2
\f`;

describe('corpsEtPresences', () => {
  it('jette la couverture, dont le sommaire imite les en-têtes', () => {
    const { corps } = corpsEtPresences(`${COUVERTURE}                                  — 2 —

         La séance est ouverte à 11 heures.`);
    expect(corps).not.toContain('A SSEM B LÉE');
    expect(corps).toContain('La séance est ouverte');
  });

  it('coupe le corps à la liste de présence', () => {
    const { corps, presences } = corpsEtPresences(`${COUVERTURE}        M. Alain David, président. Bonjour.

                             Membres présents ou excusés

      Présents. - M. Alain David, Mme Amélia Lakrafi`);
    expect(corps).toContain('Bonjour');
    expect(corps).not.toContain('Présents. -');
    expect(presences).toContain('Présents. -');
  });

  it('accepte le libellé « Présences en réunion » de la commission des affaires sociales', () => {
    const { presences } = corpsEtPresences(`${COUVERTURE}        M. X, président. Bonjour.

                             Présences en réunion

      Présents. - M. Thibault Bazin`);
    expect(presences).toContain('Thibault Bazin');
  });
});

describe('paragraphes', () => {
  it('recolle une phrase coupée sur plusieurs lignes', () => {
    const p = paragraphes(`        M. le président Éric Coquerel. Mes chers collègues, je suis
heureux de vous accueillir pour cette réunion.`);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('je suis heureux de vous accueillir');
  });

  it('sépare deux paragraphes sur leur indentation', () => {
    const p = paragraphes(`        Premier paragraphe qui court
sur deux lignes.

        Second paragraphe.`);
    expect(p).toHaveLength(2);
  });

  it('retire les numéros de page insérés au milieu d’une phrase', () => {
    const p = paragraphes(`        Un propos commencé ici
                                   — 3 —


et poursuivi après le saut de page.`);
    expect(p.join(' ')).not.toContain('— 3 —');
  });
});

describe('enTeteDuParagraphe', () => {
  it('reconnaît la présidence nommée', () => {
    expect(enTeteDuParagraphe('M. le président Éric Coquerel. Mes chers collègues, bonjour.')?.enTete)
      .toBe('M. le président Éric Coquerel');
  });

  it('reconnaît une qualité introduite par une virgule', () => {
    expect(enTeteDuParagraphe('M. Denis Masséglia, rapporteur spécial de la mission Médias. Merci.')?.enTete)
      .toBe('M. Denis Masséglia, rapporteur spécial de la mission Médias');
  });

  it('reconnaît un groupe entre parenthèses', () => {
    expect(enTeteDuParagraphe('M. Charles Fournier (EcoS). Je voudrais revenir sur ce point.')?.enTete)
      .toBe('M. Charles Fournier (EcoS)');
  });

  it('reconnaît un membre du Gouvernement', () => {
    expect(enTeteDuParagraphe('Mme Catherine Pégard, ministre de la culture. Monsieur le président.')?.enTete)
      .toBe('Mme Catherine Pégard, ministre de la culture');
  });

  it('reconnaît une personne auditionnée', () => {
    expect(
      enTeteDuParagraphe(
        'M. Gaëtan Bruel, président du centre national du cinéma et de l’image animée. Merci.'
      )?.enTete
    ).toContain('président du centre national du cinéma');
  });

  it('reconnaît un en-tête sans nom', () => {
    expect(enTeteDuParagraphe('M. le rapporteur général. Je vais essayer de donner des réponses.')?.enTete)
      .toBe('M. le rapporteur général');
  });

  it('reconnaît un titre placé avant le nom', () => {
    expect(
      enTeteDuParagraphe(
        'M. l’ingénieur général de l’armement Gaël Diaz de Tuesta. Monsieur le député, merci.'
      )
    ).not.toBeNull();
  });

  it('accepte le tiret qu’intercalent les organes partagés avec le Sénat', () => {
    const t = enTeteDuParagraphe(
      'M. Stéphane Piednoir, sénateur, président de l’Office. – Nous examinons ce matin le rapport.'
    );
    expect(t?.enTete).toBe('M. Stéphane Piednoir, sénateur, président de l’Office');
    // Le tiret relève de la typographie, pas du propos.
    expect(
      'M. Stéphane Piednoir, sénateur, président de l’Office. – Nous examinons ce matin le rapport.'.slice(
        t!.longueur
      )
    ).toBe('Nous examinons ce matin le rapport.');
  });

  // Les quatre pièges du corpus, chacun rencontré pour de bon.

  it('ne prend pas une phrase pour un en-tête', () => {
    expect(
      enTeteDuParagraphe(
        'Mme Caroline Semaille a exercé ces fonctions du 23 février 2023 au 22 février 2026, puis en a assuré l’intérim. Elle nous rejoint.'
      )
    ).toBeNull();
    expect(
      enTeteDuParagraphe('M. Bazin a évoqué la prise en compte de la mobilité professionnelle. Cela dit.')
    ).toBeNull();
  });

  it('ne s’arrête pas au point d’une abréviation', () => {
    const t = enTeteDuParagraphe('M. Hendrik Davi, suppléant M. Untel. Je reprends la parole.');
    expect(t?.enTete).toBe('M. Hendrik Davi, suppléant M. Untel');
  });

  it('ne prend pas une énumération de noms pour un en-tête', () => {
    expect(
      enTeteDuParagraphe('Mme Manon Bouquin, M. Romain Baubry, Mme Anne Bergantz. Présents.')
    ).toBeNull();
  });

  it('ignore le sommaire de couverture et ses points de conduite', () => {
    expect(enTeteDuParagraphe('M. Julien Dive ................................................ 13')).toBeNull();
    expect(
      enTeteDuParagraphe('M. Matthieu Marchio………………………………………………………1 suffrage')
    ).toBeNull();
  });
});

describe('decomposerEnTete', () => {
  it('sépare le titre du nom', () => {
    expect(decomposerEnTete('M. le président Éric Coquerel')).toMatchObject({
      civilite: 'M.',
      nom: 'Éric Coquerel',
      qualite: 'président',
      estPresidence: true,
    });
  });

  it('retient le groupe sans le confondre avec la qualité', () => {
    expect(decomposerEnTete('M. Charles Fournier (EcoS)')).toMatchObject({
      nom: 'Charles Fournier',
      groupe: 'EcoS',
      qualite: null,
      estPresidence: false,
    });
  });

  it('retient la qualité gouvernementale', () => {
    expect(decomposerEnTete('Mme Catherine Pégard, ministre de la culture')).toMatchObject({
      nom: 'Catherine Pégard',
      qualite: 'ministre de la culture',
      estPresidence: false,
    });
  });

  it('accepte un en-tête sans nom', () => {
    expect(decomposerEnTete('M. le rapporteur général')).toMatchObject({
      nom: null,
      qualite: 'rapporteur général',
    });
  });

  it('marque la présidence même quand elle est vice', () => {
    expect(decomposerEnTete('M. Max Brisson, vice-président').estPresidence).toBe(true);
  });
});

describe('nomsDeLaListe', () => {
  it('sépare les noms et laisse tomber le reste', () => {
    expect(
      nomsDeLaListe('M. Benoît Biteau, M. Jean-Luc Bourgeaux, Mme Nicole Le Peih et M. Frédéric Weber.')
    ).toEqual([
      'M. Benoît Biteau',
      'M. Jean-Luc Bourgeaux',
      'Mme Nicole Le Peih',
      'M. Frédéric Weber',
    ]);
  });

  it('rend une liste vide plutôt que de lever', () => {
    expect(nomsDeLaListe(undefined)).toEqual([]);
  });
});

describe('parserCompteRenduCommission', () => {
  const DEBAT = `${COUVERTURE}                                  — 2 —


                    La séance est ouverte à 11 heures.

         M. le président Vincent Caure. Mes chers collègues, je suis très heureux de vous
accueillir, aux côtés du président Valletoux.

         Nos deux commissions ont auditionné conjointement le Collectif de victimes.

          Mme Sandrine Rousseau, rapporteure. Merci, monsieur le président Valletoux, de
l’attention que vous avez prêtée à ce sujet.

         M. Stéphane Viry (LIOT). Je partage ce constat.

                             Membres présents ou excusés

      Présents. - M. Vincent Caure, Mme Sandrine Rousseau, M. Stéphane Viry

      Excusés. - Mme Annie Vidal
`;

  it('rend les prises de parole dans l’ordre, avec leur suite', () => {
    const cr = parserCompteRenduCommission(DEBAT);
    expect(cr.type).toBe('debat');
    expect(cr.prises).toHaveLength(3);
    expect(cr.prises[0]?.nom).toBe('Vincent Caure');
    expect(cr.prises[0]?.estPresidence).toBe(true);
    // Le paragraphe sans en-tête prolonge la parole précédente.
    expect(cr.prises[0]?.contenu).toContain('Collectif de victimes');
    expect(cr.prises[1]?.qualite).toBe('rapporteure');
    expect(cr.prises[2]?.groupe).toBe('LIOT');
    expect(cr.prises.map((p) => p.ordre)).toEqual([1, 2, 3]);
  });

  it('n’attribue à personne ce qui précède la première prise de parole', () => {
    const cr = parserCompteRenduCommission(DEBAT);
    expect(cr.prises.some((p) => p.contenu.includes('La séance est ouverte'))).toBe(false);
  });

  it('relève l’heure d’ouverture et les listes de présence', () => {
    const cr = parserCompteRenduCommission(DEBAT);
    expect(cr.ouverture).toBe('11 heures');
    expect(cr.presents).toHaveLength(3);
    expect(cr.excuses).toEqual(['Mme Annie Vidal']);
  });

  it('distingue un renvoi à la vidéo d’un compte rendu vide', () => {
    const cr = parserCompteRenduCommission(`${COUVERTURE}                — 2 —

       La commission a auditionné M. Olivier Le Nézet.

         Ce point de l’ordre du jour n’a pas fait l’objet d’un compte rendu écrit. Les débats sont
accessibles sur le portail vidéo de l’Assemblée nationale à l’adresse suivante :
`);
    expect(cr.type).toBe('video_seule');
    expect(cr.prises).toEqual([]);
  });

  it('reconnaît le renvoi vidéo dans sa seconde formulation', () => {
    const cr = parserCompteRenduCommission(`${COUVERTURE}                — 2 —

       Le comité a procédé à l’examen du rapport d’évaluation du programme Action
cœur de ville.

         Les débats sont accessibles sur le portail vidéo du site de l’Assemblée nationale à
l’adresse suivante :
`);
    expect(cr.type).toBe('video_seule');
  });

  it('reconnaît le tableau d’avis même quand les colonnes changent d’ordre', () => {
    const colonnesInversees = parserCompteRenduCommission(`${COUVERTURE}            — 2 —

La commission a accepté les amendements figurant dans le tableau ci-après (*) :

               N°
       N°                              Auteur                     Groupe      Place
               id.

      1706                       M. BAZIN Thibault                  DR            18
`);
    expect(colonnesInversees.type).toBe('avis_amendements');

    const colonnesTronquees = parserCompteRenduCommission(`${COUVERTURE}            — 2 —

                N° Amdt        Place                Auteur           Groupe
                                                             Position de la commission
`);
    expect(colonnesTronquees.type).toBe('avis_amendements');
  });

  it('reconnaît une réunion d’amendements même sans tableau', () => {
    const cr = parserCompteRenduCommission(`${COUVERTURE}                — 2 —

        La Commission examine, en deuxième lecture, en application de l’article 88 du
Règlement, des amendements à la proposition de loi portant création d’un statut de l'élu local.

          Les amendements qui n’ont pas été examinés lors de la réunion tenue en application
de l’article 86 du Règlement ont été repoussés.
`);
    expect(cr.type).toBe('avis_amendements');
  });

  it('reconnaît le renvoi à l’enregistrement audiovisuel', () => {
    const cr = parserCompteRenduCommission(`${COUVERTURE}                — 2 —

        La Commission entend M. Rémy Rioux, directeur général de l’Agence française de
développement

        L’enregistrement audiovisuel de cette réunion est disponible sur le site internet de
l’Assemblée nationale.
`);
    expect(cr.type).toBe('video_seule');
  });

  it('reconnaît une réunion « article 91 » à son tableau d’avis', () => {
    const cr = parserCompteRenduCommission(`${COUVERTURE}               — 2 —

         La commission procède à l’examen, en application de l’article 91 du Règlement, des
amendements à la première partie du projet de loi de finances pour 2026.

   N° Amdt           Place               Auteur          Groupe     Position de la commission
  2848       11              Mme LEJEUNE Claire          LFI-NFP Repoussé
`);
    expect(cr.type).toBe('avis_amendements');
    expect(cr.prises).toEqual([]);
  });
});
