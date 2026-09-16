// =============================================================================
// Lecture de classeurs XLSX
// =============================================================================
//
// Le ministère de l'Intérieur ne publie les candidatures et les résultats des
// élections qu'en XLSX. Aucune autre source ne les donne : le Sénat, lui, ne
// publie que la liste des élus, une fois qu'ils le sont.
//
// Pourquoi pas `exceljs` — un `.xlsx` est un ZIP de fichiers XML, l'ingestion
// décompresse déjà des ZIP en appelant `unzip` (clients AN et HATVP) et
// `xml2js` est déjà une dépendance. Le conteneur d'ingestion se fait
// régulièrement OOM-kill et la mémoire est le premier poste de coût Railway :
// une dépendance de plus pour deux lectures par an ne se justifiait pas.
//
// Trois pièges du format, tous rencontrés en comparant les fichiers de
// candidatures 2020 et 2023, et tous couverts par les tests :
//
//  1. Les chaînes sont déportées dans `sharedStrings.xml`. Une cellule `t="s"`
//     ne contient pas son texte mais un index dans cette table. Le texte peut
//     lui-même être fragmenté en plusieurs `<r>` (texte enrichi), qu'il faut
//     concaténer.
//  2. **Les cellules vides sont absentes du XML.** Compter les cellules dans
//     l'ordre décale silencieusement toute la fin de la ligne dès qu'une valeur
//     manque — et une colonne facultative vide est exactement le cas normal
//     dans ces fichiers (la colonne `Sortant` ne vaut `OUI` que pour 6 % des
//     lignes). On lit donc la référence `r` de chaque cellule (`B12` →
//     colonne 1) et on reconstruit une matrice dense. Idem pour les lignes,
//     qui peuvent sauter.
//  3. Les dates sont tantôt du texte (`02/11/1950`, fichier 2023), tantôt des
//     séries Excel (`23154`, fichier 2020). Le lecteur ne tranche pas : il rend
//     la valeur brute et expose `serieExcelVersDate` pour le cas échéant.
// =============================================================================

import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { parseStringPromise } from 'xml2js';

import { logger } from './logger.js';
import { errorMessage } from './errors.js';
import type { Feuille } from './tableur.js';

const execAsync = promisify(exec);

/**
 * Une feuille de classeur.
 *
 * Alias du type commun à tous les formats tabulaires : le ministère a publié
 * les candidatures en XLSX jusqu'en 2023 et en CSV en 2026, et le parser des
 * candidatures travaille sur la même matrice dans les deux cas.
 */
export type FeuilleXlsx = Feuille;

/**
 * Ouvre un classeur et rend ses feuilles dans l'ordre du classeur.
 *
 * Le fichier est décompressé dans un répertoire temporaire, supprimé avant le
 * retour y compris en cas d'erreur.
 */
export async function lireClasseurXlsx(cheminXlsx: string): Promise<FeuilleXlsx[]> {
  const repertoire = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-xlsx-'));

  try {
    try {
      await execAsync(`unzip -q -o "${cheminXlsx}" -d "${repertoire}"`, {
        maxBuffer: 1024 * 1024 * 50,
      });
    } catch (error) {
      logger.error({ cheminXlsx, error: errorMessage(error) }, 'unzip du classeur a échoué');
      throw new Error(`Classeur illisible (${cheminXlsx}) : ${errorMessage(error)}`);
    }

    const chaines = await lireChainesPartagees(repertoire);
    const feuilles: FeuilleXlsx[] = [];

    for (const { nom, cible } of await lireIndexDesFeuilles(repertoire)) {
      const cheminFeuille = path.join(repertoire, 'xl', cible);
      if (!fs.existsSync(cheminFeuille)) {
        logger.warn({ nom, cible }, 'feuille déclarée mais absente de l’archive');
        continue;
      }
      feuilles.push({ nom, lignes: await lireFeuille(cheminFeuille, chaines) });
    }

    return feuilles;
  } finally {
    await fs.promises.rm(repertoire, { recursive: true, force: true });
  }
}

/**
 * Convertit une ligne d'en-tête et les lignes suivantes en objets.
 *
 * `ligneEntete` est un index 0-based : le fichier 2023 a son en-tête en ligne 1
 * (index 0), celui de 2020 en ligne 2 (index 1) parce que la première ligne
 * porte un titre. C'est précisément pour ça que l'appelant doit pouvoir le
 * dire, et pour ça qu'on n'accède jamais aux colonnes par position ailleurs.
 *
 * Les libellés d'en-tête sont normalisés (accents, casse, espaces multiples et
 * espaces de fin) : le même fichier écrit « Libellé département » une année et
 * « Libellé département  » l'autre.
 */
export function enLignesObjets(
  feuille: FeuilleXlsx,
  ligneEntete = 0
): Array<Record<string, string>> {
  const entetes = (feuille.lignes[ligneEntete] ?? []).map(normaliserEntete);

  return feuille.lignes
    .slice(ligneEntete + 1)
    .filter(ligne => ligne.some(cellule => cellule !== ''))
    .map(ligne => {
      const objet: Record<string, string> = {};
      entetes.forEach((entete, index) => {
        if (entete !== '') objet[entete] = ligne[index] ?? '';
      });
      return objet;
    });
}

/** Normalise un libellé d'en-tête : sans accents, minuscules, espaces réduits. */
export function normaliserEntete(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Convertit une série de dates Excel en `Date` (UTC, à midi).
 *
 * L'époque est le 30/12/1899 et non le 01/01/1900 : Excel a conservé le bug de
 * Lotus 1-2-3 qui tient 1900 pour bissextile. Décaler l'époque de deux jours
 * est la façon usuelle de le compenser pour toute date postérieure au
 * 01/03/1900, ce qui couvre toute date de naissance qu'on rencontrera.
 *
 * Midi UTC et non minuit : à minuit, un affichage en heure locale française
 * ferait reculer la date d'un jour en hiver.
 */
export function serieExcelVersDate(serie: number): Date {
  const EPOQUE_EXCEL_UTC = Date.UTC(1899, 11, 30);
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  return new Date(EPOQUE_EXCEL_UTC + Math.floor(serie) * MS_PAR_JOUR + 12 * 60 * 60 * 1000);
}

// =============================================================================
// Interne
// =============================================================================

/** `A` → 0, `Z` → 25, `AA` → 26. Rend -1 si la référence est illisible. */
function indexDeColonne(reference: string): number {
  const lettres = reference.replace(/[^A-Z]/gi, '').toUpperCase();
  if (lettres === '') return -1;

  let index = 0;
  for (const lettre of lettres) {
    index = index * 26 + (lettre.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** Concatène le texte d'un nœud, que xml2js l'ait rendu en chaîne ou en objet. */
function texteDeNoeud(noeud: unknown): string {
  if (noeud === null || noeud === undefined) return '';
  if (typeof noeud === 'string') return noeud;
  if (Array.isArray(noeud)) return noeud.map(texteDeNoeud).join('');
  if (typeof noeud === 'object') {
    const objet = noeud as Record<string, unknown>;
    // xml2js rend `{ _: 'texte', $: {…} }` dès que la balise porte un attribut,
    // ce qui est le cas de `<t xml:space="preserve">`.
    if ('_' in objet) return String(objet._);
    if ('t' in objet) return texteDeNoeud(objet.t);
    if ('r' in objet) return texteDeNoeud(objet.r);
  }
  return '';
}

/** Nœud XML tel que rendu par xml2js en mode `explicitArray: false`. */
type NoeudXml = Record<string, unknown>;

async function analyserXml(xml: string): Promise<NoeudXml> {
  return (await parseStringPromise(xml, {
    explicitArray: false,
    explicitRoot: true,
  })) as NoeudXml;
}

async function analyserFichierXml(chemin: string): Promise<NoeudXml> {
  return analyserXml(await fs.promises.readFile(chemin, 'utf-8'));
}

/** Rend toujours un tableau, que xml2js ait rendu 0, 1 ou n éléments. */
function enTableau<T>(valeur: T | T[] | undefined | null): T[] {
  if (valeur === undefined || valeur === null) return [];
  return Array.isArray(valeur) ? valeur : [valeur];
}

/** Lit un chemin pointé dans l'arbre xml2js sans casser sur un nœud absent. */
function descendre(racine: unknown, ...chemin: string[]): unknown {
  let courant: unknown = racine;
  for (const clef of chemin) {
    if (courant === null || courant === undefined || typeof courant !== 'object') return undefined;
    courant = (courant as NoeudXml)[clef];
  }
  return courant;
}

/** Lit un attribut XML (`$` chez xml2js). */
function attribut(noeud: unknown, nom: string): string | undefined {
  const attributs = descendre(noeud, '$');
  if (attributs === null || attributs === undefined || typeof attributs !== 'object') {
    return undefined;
  }
  const valeur = (attributs as Record<string, unknown>)[nom];
  return valeur === undefined ? undefined : String(valeur);
}

async function lireChainesPartagees(repertoire: string): Promise<string[]> {
  const chemin = path.join(repertoire, 'xl', 'sharedStrings.xml');
  if (!fs.existsSync(chemin)) return []; // classeur sans aucune chaîne partagée

  return analyserChainesPartagees(await fs.promises.readFile(chemin, 'utf-8'));
}

/**
 * Ordonne les feuilles et résout le fichier de chacune.
 *
 * `workbook.xml` donne les noms dans l'ordre d'affichage mais désigne les
 * fichiers par un `r:id`, qu'il faut résoudre dans `workbook.xml.rels` : rien
 * ne garantit que la 2e feuille soit `sheet2.xml`.
 */
async function lireIndexDesFeuilles(
  repertoire: string
): Promise<Array<{ nom: string; cible: string }>> {
  const xmlClasseur = await analyserFichierXml(path.join(repertoire, 'xl', 'workbook.xml'));

  const relations = new Map<string, string>();
  const cheminRels = path.join(repertoire, 'xl', '_rels', 'workbook.xml.rels');
  if (fs.existsSync(cheminRels)) {
    const xmlRels = await analyserFichierXml(cheminRels);
    for (const relation of enTableau(descendre(xmlRels, 'Relationships', 'Relationship'))) {
      const identifiant = attribut(relation, 'Id');
      const cible = attribut(relation, 'Target');
      if (identifiant && cible) relations.set(identifiant, cible.replace(/^\/?xl\//, ''));
    }
  }

  return enTableau(descendre(xmlClasseur, 'workbook', 'sheets', 'sheet')).map((feuille, index) => {
    const identifiant = attribut(feuille, 'r:id') ?? attribut(feuille, 'relationshipId');
    const cible = identifiant ? relations.get(identifiant) : undefined;
    return {
      nom: attribut(feuille, 'name') ?? `Feuille ${index + 1}`,
      cible: cible ?? `worksheets/sheet${index + 1}.xml`,
    };
  });
}

async function lireFeuille(chemin: string, chaines: string[]): Promise<string[][]> {
  return analyserFeuille(await fs.promises.readFile(chemin, 'utf-8'), chaines);
}

/**
 * Table des chaînes partagées, depuis le XML de `sharedStrings.xml`.
 *
 * Exportée parce que c'est là que se joue le texte enrichi : un même libellé
 * peut être découpé en plusieurs `<r>` sans que rien ne le signale, et le test
 * doit pouvoir s'en assurer sans fabriquer une archive.
 */
export async function analyserChainesPartagees(xml: string): Promise<string[]> {
  const arbre = await analyserXml(xml);
  return enTableau(descendre(arbre, 'sst', 'si')).map(texteDeNoeud);
}

/**
 * Convertit le XML d'une feuille en matrice dense.
 *
 * Exportée pour les tests : c'est ici que vivent les pièges du format (cellules
 * et lignes absentes, types de cellule), et les éprouver ne doit pas demander
 * de committer un classeur binaire.
 */
export async function analyserFeuille(xml: string, chaines: string[]): Promise<string[][]> {
  const arbre = await analyserXml(xml);
  const lignes: string[][] = [];

  enTableau(descendre(arbre, 'worksheet', 'sheetData', 'row')).forEach((ligneXml, rang) => {
    // `r` est 1-based et peut sauter des lignes ; on retombe sur le rang
    // d'apparition si l'attribut manque.
    const reference = attribut(ligneXml, 'r');
    const indexLigne = reference ? Number(reference) - 1 : rang;
    const cellules: string[] = [];

    enTableau(descendre(ligneXml, 'c')).forEach((celluleXml, position) => {
      const referenceCellule = attribut(celluleXml, 'r');
      const indexColonne = referenceCellule ? indexDeColonne(referenceCellule) : position;
      if (indexColonne < 0) return;

      cellules[indexColonne] = valeurDeCellule(celluleXml, chaines);
    });

    lignes[indexLigne] = cellules;
  });

  // Densification : ni trou de ligne, ni trou de colonne, ni `undefined`.
  const largeur = lignes.reduce((max, ligne) => Math.max(max, ligne?.length ?? 0), 0);
  for (let index = 0; index < lignes.length; index += 1) {
    const ligne = lignes[index] ?? [];
    lignes[index] = Array.from({ length: largeur }, (_, colonne) => ligne[colonne] ?? '');
  }

  return lignes;
}

function valeurDeCellule(celluleXml: unknown, chaines: string[]): string {
  const type = attribut(celluleXml, 't');

  switch (type) {
    case 's': {
      // Chaîne partagée : `<v>` porte un index, pas le texte.
      const index = Number(texteDeNoeud(descendre(celluleXml, 'v')));
      return chaines[index] ?? '';
    }
    case 'inlineStr':
      return texteDeNoeud(descendre(celluleXml, 'is'));
    case 'e':
      // Cellule en erreur (#N/A, #REF!) : traitée comme vide, sinon l'erreur
      // se propagerait en base sous forme de texte.
      return '';
    default:
      // `str` (résultat de formule), `b` (booléen 0/1), nombre, date en série :
      // valeur brute, à charge de l'appelant de l'interpréter.
      return texteDeNoeud(descendre(celluleXml, 'v'));
  }
}
