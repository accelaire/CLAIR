// =============================================================================
// Répartition de référence du Sénat, pour l'hémicycle avant / après
// =============================================================================
//
// Le soir du scrutin, les élus n'ont qu'une nuance, attribuée par le ministère
// de l'Intérieur : les groupes ne se constituent que le 5 octobre. Pour
// comparer l'avant et l'après sur une même grille, chaque siège est classé par
// la nuance que le ministère a attribuée à son titulaire LORS DE SON ÉLECTION :
//
//   — série 1 (170 sièges) : élus de 2023, feuille « Liste des élus » du fichier
//     de résultats 2023 ;
//   — série 2, avant (172 sièges) : élus de 2020. Le fichier 2020 ne désigne
//     pas les élus ; on les reconstitue depuis les voix, par les règles du code
//     électoral (plus forte moyenne au proportionnel, majorité absolue et quart
//     des inscrits au 1er tour du majoritaire, majorité relative au 2nd). La
//     reconstitution doit retomber exactement sur les sièges de chaque
//     circonscription, sans égalité à départager, sinon la commande échoue ;
//   — les 6 sièges des Français établis hors de France de la série 2 ont été
//     pourvus en septembre 2021 (report dû à la crise sanitaire), et le
//     ministère n'a publié aucune nuance pour ce scrutin : ils sont comptés
//     « nuance non publiée », jamais devinés.
//
// Limite assumée et affichée : un siège est rangé selon l'élection de son
// titulaire d'origine. Un remplaçant arrivé en cours de mandat, ou un sénateur
// qui a changé de groupe, ne change pas le classement.
// =============================================================================

import type { Feuille } from '../../utils/tableur';
import { normaliserEntete } from '../../utils/xlsx';
import { resoudreNuance } from './nuances';

export const SOURCES_REFERENCE = {
  resultats2020:
    'https://static.data.gouv.fr/resources/senatoriales-2020-resultats/20200929-104851/2020-09-28-resultats-avec-elus.xlsx',
  resultats2023:
    'https://static.data.gouv.fr/resources/elections-senatoriales-2023-resultats/20230928-104908/senatoriales-2023-resultats-publication.xlsx',
};

/** Codes de l'outre-mer dans le fichier 2020 → nos codes. */
const CODES_2020: Record<string, string> = {
  ZC: '973',
  ZY: '977',
  ZT: '978',
  ZW: '986',
  ZP: '987',
};

export function codeDepartement(brut: string): string {
  const code = brut.trim().toUpperCase();
  if (CODES_2020[code]) return CODES_2020[code];
  if (code === 'ZZ') return '997';
  return /^\d$/.test(code) ? `0${code}` : code;
}

export interface SiegeReference {
  departement: string;
  nuance: string | null;
  famille: string;
}

export interface Reference {
  serie1: SiegeReference[];
  serie2Avant: SiegeReference[];
}

const NON_PUBLIEE = 'non_publiee';

function famille(nuance: string | null): string {
  const resolue = resoudreNuance(nuance);
  if (!resolue?.famille) {
    throw new Error(`Nuance sans famille dans la grille : « ${nuance} »`);
  }
  return resolue.famille;
}

/** Série 1 : la feuille « Liste des élus » de 2023, une ligne par élu. */
export function serie1DepuisResultats2023(feuilles: Feuille[]): SiegeReference[] {
  const feuille = feuilles.find((f) => normaliserEntete(f.nom) === 'liste des elus');
  if (!feuille) throw new Error('Feuille « Liste des élus » absente du fichier 2023');

  const entetes = (feuille.lignes[0] ?? []).map(normaliserEntete);
  const iDep = entetes.indexOf('code dpt');
  const iNuance = entetes.indexOf('code nuance');
  if (iDep < 0 || iNuance < 0) throw new Error(`En-têtes inattendus : ${entetes.join(', ')}`);

  return feuille.lignes
    .slice(1)
    .filter((l) => l.some((c) => c !== ''))
    .map((l) => {
      const nuance = (l[iNuance] ?? '').trim();
      return { departement: codeDepartement(l[iDep] ?? ''), nuance, famille: famille(nuance) };
    });
}

interface Bloc {
  nuance: string;
  voix: number;
}

/**
 * Lit une feuille 2020 : un en-tête en ligne 2, puis une ligne par
 * circonscription, avec des groupes de colonnes répétés par candidat (ou liste)
 * qui commencent chacun par « N° Dépôt ».
 */
function lireFeuille2020(feuille: Feuille) {
  const entetes = (feuille.lignes[1] ?? []).map(normaliserEntete);
  const debut = entetes.indexOf('n° depot');
  const suivant = entetes.indexOf('n° depot', debut + 1);
  if (debut < 0) throw new Error(`« N° Dépôt » absent de la feuille ${feuille.nom}`);
  // L'en-tête ne décrit que le premier groupe, et la matrice est complétée de
  // cellules vides jusqu'à la largeur de la ligne la plus longue : la taille
  // d'un groupe est donc celle de la suite d'en-têtes non vides.
  let finEntetes = debut;
  while (finEntetes < entetes.length && entetes[finEntetes] !== '') finEntetes++;
  const taille = suivant > 0 ? suivant - debut : finEntetes - debut;
  const colonne = (nom: string) => {
    const i = entetes.slice(debut, debut + taille).findIndex((e) => e.startsWith(nom));
    if (i < 0) throw new Error(`Colonne « ${nom} » absente de la feuille ${feuille.nom}`);
    return i;
  };
  const iNuance = colonne('nuance');
  const iVoix = colonne('voix');
  const iDep = entetes.indexOf('code departement');
  const iInscrits = entetes.indexOf('inscrits');
  const iExprimes = entetes.indexOf('exprimes');

  return feuille.lignes
    .slice(2)
    .filter((l) => l[iDep])
    .map((l) => {
      const blocs: Bloc[] = [];
      for (let i = debut; i + taille <= l.length; i += taille) {
        const nuance = l[i + iNuance]?.trim();
        const voix = l[i + iVoix]?.trim();
        if (nuance && voix) blocs.push({ nuance, voix: Number(voix) });
      }
      return {
        departement: codeDepartement(l[iDep] ?? ''),
        inscrits: Number(l[iInscrits]),
        exprimes: Number(l[iExprimes]),
        blocs,
      };
    });
}

/** Sièges d'une liste à la plus forte moyenne ; lève en cas d'égalité décisive. */
export function plusForteMoyenne(voix: number[], sieges: number): number[] {
  const attribues = voix.map(() => 0);
  for (let s = 0; s < sieges; s++) {
    const moyennes = voix.map((v, i) => v / ((attribues[i] ?? 0) + 1));
    const max = Math.max(...moyennes);
    const exaequo = moyennes.filter((m) => m === max).length;
    if (exaequo > 1) throw new Error('Égalité de moyennes : départage non reconstituable');
    const gagnante = moyennes.indexOf(max);
    attribues[gagnante] = (attribues[gagnante] ?? 0) + 1;
  }
  return attribues;
}

/**
 * Série 2 telle qu'élue en 2020, reconstituée depuis les voix.
 *
 * `sieges` donne le nombre de sièges de chaque circonscription : la
 * reconstitution doit les pourvoir exactement, sinon elle lève.
 */
export function serie2DepuisResultats2020(
  feuilles: Feuille[],
  sieges: Map<string, number>
): SiegeReference[] {
  const trouver = (debut: string) => {
    const f = feuilles.find((x) => normaliserEntete(x.nom).startsWith(debut));
    if (!f) throw new Error(`Feuille « ${debut} » absente du fichier 2020`);
    return f;
  };

  const resultat: SiegeReference[] = [];
  const pourvus = new Map<string, number>();
  const ajouter = (departement: string, nuance: string) => {
    resultat.push({ departement, nuance, famille: famille(nuance) });
    pourvus.set(departement, (pourvus.get(departement) ?? 0) + 1);
  };

  for (const ligne of lireFeuille2020(trouver('prop'))) {
    const n = sieges.get(ligne.departement);
    if (!n) throw new Error(`Circonscription 2020 inconnue : ${ligne.departement}`);
    plusForteMoyenne(ligne.blocs.map((b) => b.voix), n).forEach((k, i) => {
      const nuance = ligne.blocs[i]?.nuance;
      if (!nuance) return;
      for (let j = 0; j < k; j++) ajouter(ligne.departement, nuance);
    });
  }

  const premierTour = lireFeuille2020(trouver('maj 1'));
  for (const ligne of premierTour) {
    const n = sieges.get(ligne.departement);
    if (!n) throw new Error(`Circonscription 2020 inconnue : ${ligne.departement}`);
    // Élu au 1er tour : majorité absolue des exprimés ET quart des inscrits.
    ligne.blocs
      .filter((b) => b.voix > ligne.exprimes / 2 && b.voix >= ligne.inscrits / 4)
      .sort((a, b) => b.voix - a.voix)
      .slice(0, n)
      .forEach((b) => ajouter(ligne.departement, b.nuance));
  }

  for (const ligne of lireFeuille2020(trouver('maj 2'))) {
    const n = sieges.get(ligne.departement) ?? 0;
    const restants = n - (pourvus.get(ligne.departement) ?? 0);
    const tries = [...ligne.blocs].sort((a, b) => b.voix - a.voix);
    const dernierElu = tries[restants - 1];
    const premierNonElu = tries[restants];
    if (dernierElu && premierNonElu && dernierElu.voix === premierNonElu.voix) {
      throw new Error(`Égalité au 2nd tour en ${ligne.departement} : départage à l'âge non reconstituable`);
    }
    tries.slice(0, restants).forEach((b) => ajouter(ligne.departement, b.nuance));
  }

  for (const [departement, n] of sieges) {
    if (departement === '997') continue;
    if ((pourvus.get(departement) ?? 0) !== n) {
      throw new Error(`${departement} : ${pourvus.get(departement) ?? 0} sièges reconstitués pour ${n}`);
    }
  }

  // Français établis hors de France : élus en 2021, aucune nuance publiée.
  for (let i = 0; i < (sieges.get('997') ?? 0); i++) {
    resultat.push({ departement: '997', nuance: null, famille: NON_PUBLIEE });
  }
  return resultat;
}

export function compterParFamille(sieges: SiegeReference[]): Record<string, number> {
  const compte: Record<string, number> = {};
  for (const s of sieges) compte[s.famille] = (compte[s.famille] ?? 0) + 1;
  return compte;
}
