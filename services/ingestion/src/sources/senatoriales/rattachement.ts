// =============================================================================
// Rattachement d'une candidature à une personne déjà connue
// =============================================================================
//
// C'est le cœur du lot : relier un candidat à sa fiche, donc à son historique
// de votes. Aucun autre site ne le fait, et personne d'autre que nous ne le
// peut — il faut le corpus parlementaire en face.
//
// La clef est **nom + prénom + date de naissance**, et elle est solide ici : la
// table `parlementaires` compte 2 133 personnes dont 100 % ont une date de
// naissance renseignée, et le fichier du ministère donne la date de naissance
// de chaque candidat. Il n'y a donc aucune raison de faire du rapprochement
// approximatif, et de bonnes raisons de s'y refuser : un faux rattachement
// afficherait le bilan de vote de quelqu'un d'autre sous le nom d'un candidat.
//
// Trois niveaux, et le troisième n'écrit rien :
//
//   A  nom + prénom + date de naissance concordants
//   B  nom + date de naissance concordants, prénom divergent (prénom d'usage)
//   C  tout le reste — pas de rattachement, journalisé
//
// Deux personnes de même nom nées le même jour (des jumeaux, par exemple)
// rendent le rapprochement ambigu : on ne tranche pas, on ne rattache pas.
// =============================================================================

import { logger } from '../../utils/logger.js';

export type NiveauConfiance = 'A' | 'B';

export interface PersonneReferentiel {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: Date | null;
}

export interface CandidatARattacher {
  nom: string;
  prenom: string;
  dateNaissance: Date | null;
}

export interface Rattachement {
  personneId: string;
  confiance: NiveauConfiance;
}

export interface StatistiquesRattachement {
  /** Candidats rattachés avec nom, prénom et date concordants. */
  niveauA: number;
  /** Candidats rattachés sur le nom et la date, avec un prénom divergent. */
  niveauB: number;
  /** Candidats sans date de naissance exploitable : jamais rattachés. */
  sansDate: number;
  /** Plusieurs personnes portent ce nom et cette date : on ne tranche pas. */
  ambigus: number;
  /** Inconnus du corpus, ce qui est le cas de l'immense majorité. */
  inconnus: number;
}

/**
 * Normalise un nom ou un prénom pour la comparaison.
 *
 * Retire les diacritiques, la casse, et tout ce qui n'est ni lettre ni
 * chiffre : le trait d'union, l'apostrophe et l'espace sont écrits
 * différemment d'une source à l'autre pour la même personne
 * (« GOY-CHAVENT » / « Goy Chavent », « D'HAUTEFEUILLE » / « d'Hautefeuille »).
 */
export function normaliserIdentite(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Clef de date en UTC, au jour près.
 *
 * En UTC et non en heure locale : les dates viennent de deux chaînes
 * différentes (le fichier du ministère d'un côté, l'open data parlementaire de
 * l'autre) et rien ne garantit qu'elles portent la même heure. Comparer les
 * horodatages ferait échouer un rapprochement pourtant exact.
 */
export function clefDate(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Index des personnes connues, groupées par nom normalisé et date de naissance.
 *
 * Les personnes sans date de naissance sont écartées de l'index : elles ne
 * pourraient être rapprochées que sur le nom, ce qu'on s'interdit.
 */
export type IndexPersonnes = Map<string, PersonneReferentiel[]>;

export function construireIndexPersonnes(personnes: PersonneReferentiel[]): IndexPersonnes {
  const index: IndexPersonnes = new Map();

  for (const personne of personnes) {
    const date = clefDate(personne.dateNaissance);
    if (!date) continue;

    const clef = `${normaliserIdentite(personne.nom)}|${date}`;
    const existantes = index.get(clef);
    if (existantes) existantes.push(personne);
    else index.set(clef, [personne]);
  }

  return index;
}

/**
 * Rattache un candidat, ou rend `null` s'il n'y a pas de certitude.
 *
 * `null` n'est pas un échec : c'est le cas normal. Sur ~2 000 candidats, seule
 * une petite minorité est déjà passée par le Parlement.
 */
export function rattacher(
  candidat: CandidatARattacher,
  index: IndexPersonnes
): Rattachement | null {
  const date = clefDate(candidat.dateNaissance);
  if (!date) return null;

  const candidates = index.get(`${normaliserIdentite(candidat.nom)}|${date}`);
  if (!candidates || candidates.length === 0) return null;

  const prenomCandidat = normaliserIdentite(candidat.prenom);
  const memePrenom = candidates.filter(
    personne => normaliserIdentite(personne.prenom) === prenomCandidat
  );

  // Un seul homonyme exact : c'est le cas de très loin le plus fréquent.
  if (memePrenom.length === 1) return { personneId: memePrenom[0]!.id, confiance: 'A' };

  // Plusieurs personnes de même nom, même prénom et même date de naissance :
  // le corpus ne permet pas de choisir, et deviner serait pire que se taire.
  if (memePrenom.length > 1) return null;

  // Nom et date concordants, prénom divergent — typiquement un prénom d'usage
  // (« Jean-Pierre » en base, « Pierre » dans le fichier). On rattache, mais on
  // marque le rattachement pour pouvoir le relire.
  if (candidates.length === 1) return { personneId: candidates[0]!.id, confiance: 'B' };

  return null;
}

/**
 * Rattache un lot et rend les statistiques du passage.
 *
 * Les compteurs ne sont pas décoratifs : c'est sur eux que porte le contrôle
 * qualité. Si les candidats déclarés sortants par le fichier ne ressortent pas
 * quasiment tous en niveau A, c'est le rapprochement qui est cassé, pas la
 * réalité.
 */
export function rattacherLot<T extends CandidatARattacher>(
  candidats: T[],
  personnes: PersonneReferentiel[]
): { rattachements: Map<T, Rattachement>; statistiques: StatistiquesRattachement } {
  const index = construireIndexPersonnes(personnes);
  const rattachements = new Map<T, Rattachement>();
  const statistiques: StatistiquesRattachement = {
    niveauA: 0,
    niveauB: 0,
    sansDate: 0,
    ambigus: 0,
    inconnus: 0,
  };

  for (const candidat of candidats) {
    const date = clefDate(candidat.dateNaissance);
    if (!date) {
      statistiques.sansDate += 1;
      continue;
    }

    const rattachement = rattacher(candidat, index);
    if (rattachement) {
      rattachements.set(candidat, rattachement);
      if (rattachement.confiance === 'A') statistiques.niveauA += 1;
      else statistiques.niveauB += 1;
      continue;
    }

    // Distinguer « inconnu » d'« ambigu » : le premier est attendu, le second
    // mérite un œil.
    const homonymes = index.get(`${normaliserIdentite(candidat.nom)}|${date}`);
    if (homonymes && homonymes.length > 0) {
      statistiques.ambigus += 1;
      logger.warn(
        { nom: candidat.nom, prenom: candidat.prenom, homonymes: homonymes.length },
        'rattachement ambigu, candidature laissée sans personne'
      );
    } else {
      statistiques.inconnus += 1;
    }
  }

  return { rattachements, statistiques };
}
