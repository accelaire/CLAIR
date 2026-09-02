import { describe, it, expect } from 'vitest';

import type { FeuilleXlsx } from './xlsx.js';
import {
  analyserChainesPartagees,
  analyserFeuille,
  enLignesObjets,
  lireClasseurXlsx,
  normaliserEntete,
  serieExcelVersDate,
} from './xlsx.js';

/**
 * Ces tests portent sur la conversion XML → matrice, et pas sur la
 * décompression : c'est là que sont tous les pièges du format, et les éprouver
 * ne doit pas demander de committer un classeur binaire dans le dépôt.
 *
 * Chaque cas reproduit une situation réellement rencontrée dans les fichiers de
 * candidatures du ministère de l'Intérieur (éditions 2020 et 2023).
 */

const enveloppeFeuille = (contenu: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
   <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
     <sheetData>${contenu}</sheetData>
   </worksheet>`;

describe('analyserChainesPartagees', () => {
  it('concatène le texte enrichi éclaté en plusieurs fragments', async () => {
    // Excel scinde un libellé en plusieurs <r> dès qu'une portion porte un
    // style différent. Ne lire que le premier fragment tronquerait le nom.
    const xml = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <si><r><t>BÉ</t></r><r><t>JEAU</t></r></si>
        <si><t>Lionel</t></si>
      </sst>`;

    expect(await analyserChainesPartagees(xml)).toEqual(['BÉJEAU', 'Lionel']);
  });

  it('conserve les espaces significatifs des balises à attribut', async () => {
    // `<t xml:space="preserve">` fait rendre à xml2js un objet `{ _, $ }` et
    // non une chaîne : lire le nœud tel quel donnerait « [object Object] ».
    const xml = `<sst><si><t xml:space="preserve">  Indre-et-Loire </t></si></sst>`;

    expect(await analyserChainesPartagees(xml)).toEqual(['  Indre-et-Loire ']);
  });

  it('rend un tableau vide quand le classeur n’a aucune chaîne', async () => {
    expect(await analyserChainesPartagees('<sst/>')).toEqual([]);
  });
});

describe('analyserFeuille', () => {
  it('ne décale pas la ligne quand une cellule est absente du XML', async () => {
    // Le cas central : la colonne `Sortant` n'est écrite que pour 6 % des
    // lignes. En comptant les cellules dans l'ordre, « OUI » remonterait dans
    // la colonne de la profession et toute la fin de ligne serait fausse.
    const xml = enveloppeFeuille(`
      <row r="1">
        <c r="A1" t="s"><v>0</v></c>
        <c r="D1" t="s"><v>1</v></c>
      </row>`);

    expect(await analyserFeuille(xml, ['37', 'OUI'])).toEqual([['37', '', '', 'OUI']]);
  });

  it('ne décale pas la feuille quand une ligne entière est absente', async () => {
    const xml = enveloppeFeuille(`
      <row r="1"><c r="A1" t="inlineStr"><is><t>en-tête</t></is></c></row>
      <row r="3"><c r="A3" t="inlineStr"><is><t>après le trou</t></is></c></row>`);

    expect(await analyserFeuille(xml, [])).toEqual([['en-tête'], [''], ['après le trou']]);
  });

  it('résout les références de colonne au-delà de Z', async () => {
    const xml = enveloppeFeuille(`<row r="1"><c r="AB1" t="inlineStr"><is><t>x</t></is></c></row>`);

    // A..Z = 26 colonnes, AA la 27e, AB la 28e.
    expect(await analyserFeuille(xml, [])).toEqual([[...Array<string>(27).fill(''), 'x']]);
  });

  it('lit chaque type de cellule, et neutralise les cellules en erreur', async () => {
    const xml = enveloppeFeuille(`
      <row r="1">
        <c r="A1" t="s"><v>1</v></c>
        <c r="B1" t="inlineStr"><is><t>Ain</t></is></c>
        <c r="C1"><v>23154</v></c>
        <c r="D1" t="str"><v>résultat de formule</v></c>
        <c r="E1" t="b"><v>1</v></c>
        <c r="F1" t="e"><v>#N/A</v></c>
      </row>`);

    expect(await analyserFeuille(xml, ['ignorée', 'Indre-et-Loire'])).toEqual([
      ['Indre-et-Loire', 'Ain', '23154', 'résultat de formule', '1', ''],
    ]);
  });

  it('rend une feuille vide sans lever', async () => {
    expect(await analyserFeuille(enveloppeFeuille(''), [])).toEqual([]);
  });
});

describe('enLignesObjets', () => {
  const feuille = {
    nom: 'Scrutin proportionnel',
    lignes: [
      ['Scrutin proportionnel', '', ''], // ligne de titre, comme en 2020
      ['Code département', 'Libellé département ', 'Sortant'],
      ['37', 'Indre-et-Loire', 'OUI'],
      ['', '', ''],
      ['39', 'Jura', ''],
    ],
  };

  it('lit l’en-tête à l’index demandé et normalise les libellés', async () => {
    // L'en-tête est en ligne 1 dans le fichier 2023 et en ligne 2 dans celui
    // de 2020 : l'appelant doit pouvoir le dire, sinon on lit le titre.
    const lignes = enLignesObjets(feuille, 1);

    // « Libellé département » porte une espace finale une année sur deux.
    expect(lignes[0]).toEqual({
      'code departement': '37',
      'libelle departement': 'Indre-et-Loire',
      sortant: 'OUI',
    });
  });

  it('écarte les lignes entièrement vides', () => {
    // La feuille majoritaire de 2023 se termine par sept lignes réduites à une
    // cellule vide : les compter surestimerait les candidats de 4,7 %.
    const lignes = enLignesObjets(feuille, 1);

    expect(lignes).toHaveLength(2);
    expect(lignes.map(ligne => ligne['code departement'])).toEqual(['37', '39']);
  });

  it('rend une chaîne vide, jamais undefined, pour une colonne manquante', () => {
    const lignes = enLignesObjets(feuille, 1);

    expect(lignes.map(ligne => ligne.sortant)).toEqual(['OUI', '']);
  });
});

describe('normaliserEntete', () => {
  it('efface accents, casse et espaces surnuméraires', () => {
    expect(normaliserEntete('  Libellé   DÉPARTEMENT ')).toBe('libelle departement');
  });
});

/**
 * Intégration sur le vrai classeur du ministère.
 *
 * Le fichier n'est pas dans le dépôt : 146 Ko de données publiques qui n'ont
 * rien à y faire. Pour jouer ce test :
 *
 *   curl -sLo /tmp/candidatures-2023.xlsx \
 *     'https://static.data.gouv.fr/resources/elections-senatoriales-2023-candidatures-t1/20230918-172919/senatoriales-2023-candidatures-18-09-23-publication.xlsx'
 *   XLSX_CANDIDATURES_2023=/tmp/candidatures-2023.xlsx pnpm --filter @clair/ingestion test
 *
 * Il vaut surtout pour le jour J : quand le fichier 2026 sortira, le pointer
 * ici dit en une commande si le lecteur tient toujours.
 */
describe('lireClasseurXlsx sur le fichier de candidatures 2023', () => {
  const fichier = process.env.XLSX_CANDIDATURES_2023;

  /** Retrouve une feuille par son nom, plutôt que par sa position. */
  const feuilleNommee = (feuilles: FeuilleXlsx[], nom: string): FeuilleXlsx => {
    const trouvee = feuilles.find(feuille => feuille.nom === nom);
    if (!trouvee) throw new Error(`feuille « ${nom} » absente du classeur`);
    return trouvee;
  };

  it.skipIf(!fichier)('retrouve les deux feuilles et leur volumétrie connue', async () => {
    const feuilles = await lireClasseurXlsx(fichier as string);

    expect(feuilles.map(feuille => feuille.nom)).toEqual([
      'Scrutin proportionnel',
      'Scrutin majoritaire',
    ]);

    const proportionnel = enLignesObjets(feuilleNommee(feuilles, 'Scrutin proportionnel'));
    const majoritaire = enLignesObjets(feuilleNommee(feuilles, 'Scrutin majoritaire'));

    // Volumétrie relevée sur le fichier publié le 18/09/2023.
    //
    // 150 et non 157 : la feuille majoritaire se termine par sept lignes
    // fantômes, chacune réduite à une cellule vide. Compter les `<row>` du XML
    // surestimerait le nombre de candidats de 4,7 %, et ces lignes créeraient
    // autant de candidatures sans nom en base.
    expect(proportionnel).toHaveLength(1679);
    expect(majoritaire).toHaveLength(150);

    // La colonne `Sortant`, vide sur 94 % des lignes, est le témoin du piège
    // des cellules absentes : un décalage la ferait disparaître ou déborder.
    expect(proportionnel.filter(ligne => ligne.sortant === 'OUI')).toHaveLength(95);
    expect(majoritaire.filter(ligne => ligne.sortant === 'OUI')).toHaveLength(24);

    // Les dates sont du texte dans cette édition, des séries en 2020.
    expect(proportionnel[0]?.['date de naissance candidat']).toBe('02/11/1950');
  });

  it.skipIf(!fichier)('lit les colonnes propres au scrutin majoritaire', async () => {
    const feuilles = await lireClasseurXlsx(fichier as string);
    const majoritaire = enLignesObjets(feuilleNommee(feuilles, 'Scrutin majoritaire'));

    // Le suppléant n'existe qu'au majoritaire : c'est la principale différence
    // de schéma entre les deux feuilles.
    expect(majoritaire[0]?.['nom suppleant']).toBe('BONNEVILLE');
    expect(majoritaire[0]?.['code nuance']).toBe('FI');
  });
});

describe('serieExcelVersDate', () => {
  it('convertit une série du fichier 2020 en la bonne date', () => {
    // Vérifié sur une donnée réelle : la série 18330 est celle de Claude
    // Malhuret dans le fichier de candidatures 2020, né le 8 mars 1950.
    expect(serieExcelVersDate(18330).toISOString().slice(0, 10)).toBe('1950-03-08');
    expect(serieExcelVersDate(23154).toISOString().slice(0, 10)).toBe('1963-05-23');
  });

  it('reste au bon jour une fois affichée en heure locale française', () => {
    // À minuit UTC, un rendu en Europe/Paris ferait reculer la date d'un jour
    // en hiver. La conversion vise midi pour cette seule raison.
    const date = serieExcelVersDate(18330);
    expect(date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })).toBe('08/03/1950');
  });
});
