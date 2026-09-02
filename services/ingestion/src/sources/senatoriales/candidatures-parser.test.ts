import { describe, it, expect } from 'vitest';

import { lireClasseurXlsx } from '../../utils/xlsx.js';
import type { FeuilleXlsx } from '../../utils/xlsx.js';
import {
  analyserClasseurCandidatures,
  lireDateNaissance,
  lireProfession,
  normaliserCodeCirconscription,
  reconnaitreModeScrutin,
  sourceUidListe,
  trouverLigneEntete,
} from './candidatures-parser.js';

describe('normaliserCodeCirconscription', () => {
  it('complète les codes à un chiffre du fichier 2020', () => {
    // 2020 écrit « 1 » pour l'Ain là où 2023 écrit « 01 » et où notre table
    // des circonscriptions stocke « 01 ».
    expect(normaliserCodeCirconscription('1')).toBe('01');
    expect(normaliserCodeCirconscription('01')).toBe('01');
  });

  it('traduit le code des Français établis hors de France', () => {
    // Le ministère code ZZ, nous codons 997. Sans cette traduction, les six
    // sièges de l'étranger se rattacheraient à aucune circonscription.
    expect(normaliserCodeCirconscription('ZZ')).toBe('997');
  });

  it('laisse intacts la Corse et l’outre-mer', () => {
    expect(normaliserCodeCirconscription('2a')).toBe('2A');
    expect(normaliserCodeCirconscription('973')).toBe('973');
    expect(normaliserCodeCirconscription('987')).toBe('987');
  });
});

describe('lireDateNaissance', () => {
  it('lit le format texte de 2023', () => {
    expect(lireDateNaissance('02/11/1950')?.toISOString().slice(0, 10)).toBe('1950-11-02');
  });

  it('lit la série Excel de 2020', () => {
    // Claude Malhuret, série 18330 dans le fichier 2020, né le 8 mars 1950.
    expect(lireDateNaissance('18330')?.toISOString().slice(0, 10)).toBe('1950-03-08');
  });

  it('rend null sur une valeur vide ou illisible', () => {
    expect(lireDateNaissance('')).toBeNull();
    expect(lireDateNaissance('inconnue')).toBeNull();
  });
});

describe('lireProfession', () => {
  it('sépare le code du libellé quand 2023 les fusionne', () => {
    expect(lireProfession('', '(31) - Profession libérale')).toEqual({
      code: '31',
      libelle: 'Profession libérale',
    });
  });

  it('conserve les deux colonnes distinctes de 2020', () => {
    expect(lireProfession('34', 'Professeur, profession scientifique')).toEqual({
      code: '34',
      libelle: 'Professeur, profession scientifique',
    });
  });

  it('rend deux nulls quand la profession manque', () => {
    expect(lireProfession('', '')).toEqual({ code: null, libelle: null });
  });
});

describe('trouverLigneEntete', () => {
  const feuille = (lignes: string[][]): FeuilleXlsx => ({ nom: 'test', lignes });

  it('trouve l’en-tête en première ligne (2023)', () => {
    expect(trouverLigneEntete(feuille([['Code département', 'Nom candidat']]))).toBe(0);
  });

  it('saute la ligne de titre (2020)', () => {
    expect(
      trouverLigneEntete(
        feuille([['Scrutin proportionnel'], ['Code du département', 'Nom candidat']])
      )
    ).toBe(1);
  });
});

describe('reconnaitreModeScrutin', () => {
  it('reconnaît le mode par le nom de la feuille', () => {
    expect(reconnaitreModeScrutin({ nom: 'Scrutin proportionnel', lignes: [] }, [])).toBe(
      'proportionnel'
    );
    expect(reconnaitreModeScrutin({ nom: 'MAJ - T1', lignes: [] }, [])).toBeNull();
  });

  it('retombe sur le schéma quand le nom ne dit rien', () => {
    // Un libellé de liste n'existe qu'au proportionnel, un suppléant qu'au
    // majoritaire : le schéma suffit à trancher si l'onglet est renommé.
    expect(reconnaitreModeScrutin({ nom: 'Feuil1', lignes: [] }, ['libelle de la liste'])).toBe(
      'proportionnel'
    );
    expect(reconnaitreModeScrutin({ nom: 'Feuil1', lignes: [] }, ['nom suppleant'])).toBe(
      'majoritaire'
    );
  });
});

describe('analyserClasseurCandidatures', () => {
  it('regroupe les lignes d’une même liste et respecte l’ordre déposé', () => {
    const feuille: FeuilleXlsx = {
      nom: 'Scrutin proportionnel',
      lignes: [
        ['Code département', 'Libellé département', 'Libellé de la liste', 'Code nuance de liste', 'Ordre dans la liste', 'Nom candidat', 'Prénom candidat', 'Sortant'],
        ['37', 'Indre-et-Loire', 'UNE SEULE VOIX', 'LDVC', '1', 'MARTIN', 'Claire', 'OUI'],
        ['37', 'Indre-et-Loire', 'UNE SEULE VOIX', 'LDVC', '2', 'DURAND', 'Paul', ''],
        ['37', 'Indre-et-Loire', 'AUTRE LISTE', 'LRN', '1', 'PETIT', 'Jean', ''],
      ],
    };

    const listes = analyserClasseurCandidatures([feuille]);

    expect(listes).toMatchObject([
      {
        libelle: 'UNE SEULE VOIX',
        candidats: [
          { nom: 'MARTIN', ordre: 1, sortantDeclare: true },
          { nom: 'DURAND', ordre: 2, sortantDeclare: false },
        ],
      },
      { libelle: 'AUTRE LISTE', candidats: [{ nom: 'PETIT' }] },
    ]);
  });

  it('fait du binôme majoritaire une seule unité de vote', () => {
    const feuille: FeuilleXlsx = {
      nom: 'Scrutin majoritaire',
      lignes: [
        ['Code département', 'Libellé département', 'N° dépôt', 'Nom du candidat', 'Prénom du candidat', 'Code nuance', 'Nom suppléant', 'Prénom suppléant'],
        ['39', 'Jura', '1', 'ASNAR', 'Véronique', 'FI', 'BONNEVILLE', 'François'],
      ],
    };

    const listes = analyserClasseurCandidatures([feuille]);

    expect(listes).toMatchObject([
      {
        nuance: 'FI',
        libelle: null,
        candidats: [
          { role: 'titulaire', nom: 'ASNAR' },
          { role: 'suppleant', nom: 'BONNEVILLE' },
        ],
      },
    ]);
  });

  it('n’invente pas de profession pour le suppléant', () => {
    // Le fichier n'en donne pas. La recopier depuis le titulaire créerait une
    // donnée fausse impossible à distinguer d'une vraie.
    const feuille: FeuilleXlsx = {
      nom: 'Scrutin majoritaire',
      lignes: [
        ['Code département', 'N° dépôt', 'Nom du candidat', 'Profession', 'Nom suppléant'],
        ['39', '1', 'ASNAR', '(47) - Technicien', 'BONNEVILLE'],
      ],
    };

    expect(analyserClasseurCandidatures([feuille])).toMatchObject([
      {
        candidats: [
          { role: 'titulaire', professionLabel: 'Technicien', professionCode: '47' },
          { role: 'suppleant', professionLabel: null, professionCode: null },
        ],
      },
    ]);
  });

  it('ignore une feuille dont le mode de scrutin est inconnu', () => {
    const feuille: FeuilleXlsx = { nom: 'Notice', lignes: [['Blabla']] };

    expect(analyserClasseurCandidatures([feuille])).toEqual([]);
  });
});

describe('sourceUidListe', () => {
  const base = {
    codeDepartement: '37',
    libelleDepartement: 'Indre-et-Loire',
    modeScrutin: 'proportionnel' as const,
    nuance: 'LDVC',
    candidats: [],
  };

  it('préfère le numéro de dépôt quand le fichier le donne', () => {
    expect(sourceUidListe('senatoriales-2026', { ...base, numeroDepot: 2, libelle: 'UNE VOIX' })).toBe(
      'senatoriales-2026:37:p:d2'
    );
  });

  it('retombe sur le libellé normalisé quand il manque', () => {
    // Cas du fichier 2023, qui ne donne pas de numéro de dépôt au
    // proportionnel.
    expect(sourceUidListe('senatoriales-2026', { ...base, numeroDepot: null, libelle: "D'UNE SEULE VOIX POUR LA TOURAINE" })).toBe(
      'senatoriales-2026:37:p:d-une-seule-voix-pour-la-touraine'
    );
  });

  it('distingue les deux modes de scrutin', () => {
    const majoritaire = sourceUidListe('senatoriales-2026', {
      ...base,
      modeScrutin: 'majoritaire',
      numeroDepot: 2,
      libelle: null,
    });

    expect(majoritaire).toBe('senatoriales-2026:37:m:d2');
  });
});

// =============================================================================
// Intégration sur les vrais fichiers du ministère
// =============================================================================
//
// Aucun des deux n'est dans le dépôt. Pour les jouer :
//
//   curl -sLo /tmp/candidatures-2023.xlsx 'https://static.data.gouv.fr/resources/elections-senatoriales-2023-candidatures-t1/20230918-172919/senatoriales-2023-candidatures-18-09-23-publication.xlsx'
//   curl -sLo /tmp/candidatures-2020.xlsx 'https://static.data.gouv.fr/resources/senatoriales-2020-candidatures-au-t1/20200918-184808/livre-des-listes-et-candidats-2020-t1-france-entiere-data.xlsx'
//   XLSX_CANDIDATURES_2023=/tmp/candidatures-2023.xlsx \
//   XLSX_CANDIDATURES_2020=/tmp/candidatures-2020.xlsx \
//     pnpm --filter @clair/ingestion test

describe('sur le fichier de candidatures 2023', () => {
  const fichier = process.env.XLSX_CANDIDATURES_2023;

  it.skipIf(!fichier)('retrouve la volumétrie publiée', async () => {
    const listes = analyserClasseurCandidatures(await lireClasseurXlsx(fichier as string));

    const proportionnelles = listes.filter(l => l.modeScrutin === 'proportionnel');
    const majoritaires = listes.filter(l => l.modeScrutin === 'majoritaire');

    expect(proportionnelles).toHaveLength(227);
    expect(majoritaires).toHaveLength(150);

    const candidatsProp = proportionnelles.reduce((n, l) => n + l.candidats.length, 0);
    expect(candidatsProp).toBe(1679);

    // 27 circonscriptions au proportionnel, 18 au majoritaire, soit les 45 de
    // la série 1. Recoupé sur une source indépendante : la feuille « Liste des
    // élus » du fichier de résultats 2023 donne 170 élus répartis sur 45
    // circonscriptions, dont 27 à trois sièges ou plus.
    expect(new Set(proportionnelles.map(l => l.codeDepartement)).size).toBe(27);
    expect(new Set(majoritaires.map(l => l.codeDepartement)).size).toBe(18);
  });

  it.skipIf(!fichier)('applique la règle « sièges + 2 » de l’article L. 300', async () => {
    const listes = analyserClasseurCandidatures(await lireClasseurXlsx(fichier as string));

    // Dans une circonscription donnée, toutes les listes ont exactement le
    // même nombre de candidats — le nombre de sièges plus deux. Vérifié sans
    // une seule exception sur les 27 circonscriptions de 2023, c'est le
    // contrôle d'intégrité le plus fort dont on dispose sur ce fichier.
    const taillesParCirco = new Map<string, Set<number>>();
    for (const liste of listes.filter(l => l.modeScrutin === 'proportionnel')) {
      const tailles = taillesParCirco.get(liste.codeDepartement) ?? new Set<number>();
      tailles.add(liste.candidats.length);
      taillesParCirco.set(liste.codeDepartement, tailles);
    }

    const heterogenes = [...taillesParCirco.entries()].filter(([, tailles]) => tailles.size > 1);
    expect(heterogenes).toEqual([]);

    // Paris, 12 sièges renouvelés en série 1 : 14 candidats par liste.
    expect([...(taillesParCirco.get('75') ?? [])]).toEqual([14]);
    // Français établis hors de France, 6 sièges : 8 candidats.
    expect([...(taillesParCirco.get('997') ?? [])]).toEqual([8]);
  });

  it.skipIf(!fichier)('retrouve les 119 sortants déclarés', async () => {
    const listes = analyserClasseurCandidatures(await lireClasseurXlsx(fichier as string));
    const sortants = listes.flatMap(l => l.candidats).filter(c => c.sortantDeclare);

    expect(sortants).toHaveLength(119);
  });

  it.skipIf(!fichier)('rattache un suppléant à chaque candidat au majoritaire', async () => {
    const listes = analyserClasseurCandidatures(await lireClasseurXlsx(fichier as string));
    const majoritaires = listes.filter(l => l.modeScrutin === 'majoritaire');

    // Le suppléant est obligatoire : une candidature sans suppléant est
    // irrecevable, donc son absence signalerait une colonne mal lue.
    const sansSuppleant = majoritaires.filter(
      l => !l.candidats.some(c => c.role === 'suppleant')
    );
    expect(sansSuppleant).toEqual([]);
  });
});

describe('sur le fichier de candidatures 2020', () => {
  const fichier = process.env.XLSX_CANDIDATURES_2020;

  it.skipIf(!fichier)('lit l’édition précédente malgré ses différences de format', async () => {
    const listes = analyserClasseurCandidatures(await lireClasseurXlsx(fichier as string));

    expect(listes.length).toBeGreaterThan(0);

    // Les codes à un chiffre sont complétés.
    expect(listes.some(l => l.codeDepartement === '01')).toBe(true);
    expect(listes.some(l => l.codeDepartement.length === 1)).toBe(false);

    // Les séries Excel sont converties : aucune date au 20e siècle ne peut
    // tomber avant 1900 ni après aujourd'hui.
    const dates = listes.flatMap(l => l.candidats).map(c => c.dateNaissance);
    expect(dates.every(d => d === null || (d.getFullYear() > 1900 && d.getFullYear() < 2010))).toBe(
      true
    );

    // La colonne « Sortant » n'existe pas dans cette édition : personne n'est
    // déclaré sortant, et surtout rien n'est inventé.
    expect(listes.flatMap(l => l.candidats).some(c => c.sortantDeclare)).toBe(false);
  });
});
