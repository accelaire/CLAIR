// =============================================================================
// Feuilles tabulaires, quel que soit le format du fichier
// =============================================================================
//
// Le ministère de l'Intérieur a publié les candidatures en XLSX en 2017, 2020
// et 2023, puis en **CSV** en 2026 — et en deux fichiers séparés là où les
// éditions précédentes tenaient dans un classeur à deux feuilles.
//
// D'où ce type commun : le parser des candidatures raisonne sur une matrice de
// chaînes nommée, et ignore complètement d'où elle vient. Changer de format
// une fois de plus ne demandera qu'un lecteur de plus, pas une réécriture.
// =============================================================================

import fs from 'fs';
import { parse } from 'csv-parse/sync';

export interface Feuille {
  /**
   * Nom de la feuille.
   *
   * Sert à reconnaître le mode de scrutin. Pour un CSV, l'appelant y met le
   * nom du fichier, qui porte la même information (« …Scrutin Proportionnel »).
   */
  nom: string;
  /**
   * Matrice dense. Les cellules absentes valent `''`, jamais `undefined` : un
   * appelant qui lit `ligne[7]` ne doit pas avoir à savoir si la colonne était
   * vide ou absente.
   */
  lignes: string[][];
}

/**
 * Lit un CSV en feuille.
 *
 * Le séparateur est détecté sur la première ligne plutôt que codé en dur : le
 * ministère livre du point-virgule, mais rien ne garantit qu'il s'y tienne, et
 * se tromper de séparateur ne produit pas une erreur — ça produit une feuille
 * d'une seule colonne, donc une ingestion vide et silencieuse.
 *
 * L'encodage est lu en `utf-8` avec retrait explicite du BOM : présent dans les
 * fichiers 2026, il collerait sinon à l'en-tête de la première colonne, qui ne
 * serait plus reconnue.
 */
export async function lireCsvEnFeuille(chemin: string, nom: string): Promise<Feuille> {
  const brut = (await fs.promises.readFile(chemin, 'utf-8')).replace(/^\ufeff/, '');

  const lignes = parse(brut, {
    delimiter: detecterSeparateur(brut),
    // Le fichier n'a pas d'en-tête déclaré : la première ligne en est un, mais
    // c'est au parser des candidatures de le décider — il doit pouvoir sauter
    // une ligne de titre comme en 2020.
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    bom: true,
    trim: false,
  }) as string[][];

  return { nom, lignes: densifier(lignes) };
}

/**
 * Sépare sur le caractère le plus fréquent de la première ligne, parmi les
 * candidats usuels.
 *
 * La virgule perd volontairement les égalités : un libellé de liste français
 * en contient souvent, un point-virgule presque jamais.
 */
export function detecterSeparateur(contenu: string): string {
  const premiere = contenu.split(/\r?\n/, 1)[0] ?? '';
  const candidats = [';', '\t', ','];

  let meilleur = ';';
  let occurrences = 0;
  for (const separateur of candidats) {
    const compte = premiere.split(separateur).length - 1;
    if (compte > occurrences) {
      meilleur = separateur;
      occurrences = compte;
    }
  }

  return meilleur;
}

/** Complète les lignes courtes pour que toutes aient la même largeur. */
function densifier(lignes: string[][]): string[][] {
  const largeur = lignes.reduce((max, ligne) => Math.max(max, ligne.length), 0);
  return lignes.map((ligne) =>
    Array.from({ length: largeur }, (_, colonne) => ligne[colonne] ?? '')
  );
}
