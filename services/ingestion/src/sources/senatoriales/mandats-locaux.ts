// =============================================================================
// Mandats locaux des candidats, lus dans le Répertoire national des élus
// =============================================================================
//
// Un sénateur nouvellement élu n'a pas encore de fiche : il n'entre dans
// l'annuaire du Sénat qu'à sa prise de fonction, le 1er octobre. D'ici là, ce
// qu'on sait de lui tient au fichier de candidature (profession, âge) et,
// presque toujours, à ses mandats locaux : les grands électeurs élisent des
// maires, des conseillers départementaux, des présidents d'intercommunalité.
//
// Le Répertoire national des élus (ministère de l'Intérieur, data.gouv) publie
// ces mandats, un fichier par type, avec nom, prénom et date de naissance. Le
// rapprochement suit exactement les règles de `rattachement.ts` : nom + prénom +
// date de naissance (A), nom + date avec un prénom d'usage divergent (B), rien
// en cas de doute. Un mandat attribué à un homonyme serait une information
// fausse publiée sous le nom de quelqu'un.
//
// Ce module est pur : il lit des lignes déjà découpées et rend des mandats. Le
// téléchargement et l'écriture sont dans `mandats-locaux-client.ts`.
// =============================================================================

import { clefDate, normaliserIdentite } from './rattachement.js';

/** Fichiers du répertoire retenus, identifiés par le suffixe de leur titre. */
export type FichierRne = 'mai' | 'cm' | 'epci' | 'cd' | 'cr' | 'ma' | 'rpe' | 'afe' | 'consfde';

export const FICHIERS_RNE: FichierRne[] = ['mai', 'cm', 'epci', 'cd', 'cr', 'ma', 'rpe', 'afe', 'consfde'];

export type TypeMandat =
  | 'maire'
  | 'executif_collectivite'
  | 'adjoint'
  | 'executif_intercommunalite'
  | 'departement'
  | 'region'
  | 'collectivite'
  | 'intercommunalite'
  | 'conseil_municipal'
  | 'europe'
  | 'francais_etranger';

/** Ordre d'affichage : l'exécutif d'abord, les simples sièges ensuite. */
const RANG: Record<TypeMandat, number> = {
  executif_collectivite: 0,
  maire: 1,
  europe: 2,
  departement: 3,
  region: 4,
  collectivite: 5,
  adjoint: 6,
  executif_intercommunalite: 7,
  francais_etranger: 8,
  intercommunalite: 9,
  conseil_municipal: 10,
};

export interface MandatLocal {
  type: TypeMandat;
  /** Libellé prêt à afficher : « Maire de Bram », « Conseillère régionale (Occitanie) ». */
  libelle: string;
  /** Début de la fonction, à défaut du mandat (AAAA-MM-JJ). */
  depuis: string | null;
}

export interface LigneRne {
  nom: string;
  prenom: string;
  sexe: 'M' | 'F' | null;
  /** AAAA-MM-JJ. */
  dateNaissance: string;
  mandat: MandatLocal;
}

// --- Mise en forme des libellés ---------------------------------------------

const PARTICULES = new Set([
  'sur', 'sous', 'les', 'le', 'la', 'de', 'des', 'du', 'en', 'et', 'aux', 'au', 'lès', 'lez', 'd', 'l',
]);

/**
 * Le répertoire écrit les noms de lieux en capitales initiales partout
 * (« Rozoy-Sur-Serre », « Cc De La Champagne Picarde ») : les particules
 * reprennent leur minuscule, sauf en tête.
 */
export function casseDeLieu(nom: string): string {
  let premier = true;
  return nom.replace(/[\p{L}]+/gu, (mot) => {
    const minuscule = mot.toLowerCase();
    const resultat = !premier && PARTICULES.has(minuscule) ? minuscule : mot;
    premier = false;
    return resultat;
  });
}

/** Les sigles d'intercommunalité, que le répertoire écrit « Cc », « Ca »… */
function casseDEpci(nom: string): string {
  return casseDeLieu(nom).replace(/^(Cc|Ca|Cu|Sm|Siv|Sivom)\b/, (sigle) => sigle.toUpperCase());
}

/** « de Bram », « d'Aguilcourt », « du Mans », « des Mureaux ». */
export function deCommune(commune: string): string {
  const nom = casseDeLieu(commune);
  if (/^Le /.test(nom)) return `du ${nom.slice(3)}`;
  if (/^Les /.test(nom)) return `des ${nom.slice(4)}`;
  if (/^[AEIOUYÀÂÉÈÊÎÔÛH]/i.test(nom)) return `d'${nom}`;
  return `de ${nom}`;
}

/** « 3ème », « 5eme » → « 3e » ; « 1er » → « 1re » au féminin. */
function ordinal(texte: string, sexe: 'M' | 'F' | null): string {
  return texte
    .replace(/\b(\d+)\s*(?:ème|eme|e)\b/gi, '$1e')
    .replace(/\b1\s*er\b/gi, sexe === 'F' ? '1re' : '1er');
}

/**
 * Accorde la personne, que le répertoire écrit toujours au masculin, sans
 * toucher à l'institution : « Présidente du conseil départemental ».
 */
function accorder(texte: string, sexe: 'M' | 'F' | null): string {
  if (sexe !== 'F') return texte;
  return texte
    .replace(/\b([Pp])résident\b/g, '$1résidente')
    .replace(/\b([Cc])onseiller municipal\b/g, '$1onseillère municipale')
    .replace(/\b([Cc])onseiller\b/g, '$1onseillère')
    .replace(/\b([Aa])djoint\b/g, '$1djointe')
    .replace(/\bdélégué\b/g, 'déléguée');
}

/** Fonction du répertoire, mise en forme : « 5eme Vice-président du … » → « 5e vice-président du … ». */
function fonction(brute: string, sexe: 'M' | 'F' | null): string {
  const texte = ordinal(brute.trim(), sexe).replace(/\bVice-président/g, 'vice-président').replace(/\bau Maire\b/g, 'au maire');
  return accorder(texte.charAt(0).toUpperCase() + texte.slice(1), sexe);
}

function champ(ligne: Record<string, string>, ...noms: string[]): string {
  for (const nom of noms) {
    const valeur = ligne[nom];
    if (valeur !== undefined && valeur.trim() !== '') return valeur.trim();
  }
  return '';
}

function date(valeur: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? valeur : null;
}

/**
 * Lit une ligne d'un fichier du répertoire. Rend `null` pour une ligne qu'on
 * ne publie pas : un « Maire » du fichier des conseillers municipaux, déjà
 * porté par le fichier des maires, ou une ligne sans date de naissance.
 */
export function lireLigneRne(fichier: FichierRne, ligne: Record<string, string>): LigneRne | null {
  const nom = champ(ligne, "Nom de l'élu");
  const prenom = champ(ligne, "Prénom de l'élu");
  const naissance = date(champ(ligne, 'Date de naissance'));
  if (!nom || !naissance) return null;

  const sexeBrut = champ(ligne, 'Code sexe');
  const sexe = sexeBrut === 'F' ? 'F' : sexeBrut === 'M' ? 'M' : null;
  const fonctionBrute = champ(ligne, 'Libellé de la fonction');
  const depuis = date(champ(ligne, 'Date de début de la fonction')) ?? date(champ(ligne, 'Date de début du mandat'));
  const feminin = sexe === 'F';

  let mandat: MandatLocal | null = null;
  switch (fichier) {
    case 'mai': {
      const commune = champ(ligne, 'Libellé de la commune');
      mandat = { type: 'maire', libelle: `Maire ${deCommune(commune)}`, depuis };
      break;
    }
    case 'cm': {
      const commune = champ(ligne, 'Libellé de la commune');
      if (/^maire$/i.test(fonctionBrute)) return null;
      if (/adjoint/i.test(fonctionBrute)) {
        mandat = { type: 'adjoint', libelle: `${fonction(fonctionBrute, sexe)} ${deCommune(commune)}`, depuis };
      } else {
        const base = fonctionBrute ? fonction(fonctionBrute, sexe) : feminin ? 'Conseillère municipale' : 'Conseiller municipal';
        mandat = { type: 'conseil_municipal', libelle: `${base} ${deCommune(commune)}`, depuis };
      }
      break;
    }
    case 'epci': {
      const epci = casseDEpci(champ(ligne, "Libellé de l'EPCI"));
      if (fonctionBrute) {
        mandat = { type: 'executif_intercommunalite', libelle: `${fonction(fonctionBrute, sexe)} (${epci})`, depuis };
      } else {
        const base = feminin ? 'Conseillère communautaire' : 'Conseiller communautaire';
        mandat = { type: 'intercommunalite', libelle: `${base} (${epci})`, depuis };
      }
      break;
    }
    case 'cd': {
      const departement = champ(ligne, 'Libellé du département', 'Libellé du  département');
      const canton = casseDeLieu(champ(ligne, 'Libellé du canton'));
      const base = fonctionBrute
        ? fonction(fonctionBrute, sexe)
        : feminin
          ? 'Conseillère départementale'
          : 'Conseiller départemental';
      const president = /^président/i.test(fonctionBrute);
      // Le canton d'élection n'apprend rien sur un président de département.
      const precision = canton && !president ? `${departement}, canton ${deCommune(canton)}` : departement;
      mandat = { type: president ? 'executif_collectivite' : 'departement', libelle: `${base} (${precision})`, depuis };
      break;
    }
    case 'cr': {
      const region = champ(ligne, 'Libellé de la région');
      const base = fonctionBrute ? fonction(fonctionBrute, sexe) : feminin ? 'Conseillère régionale' : 'Conseiller régional';
      mandat = {
        type: /^président/i.test(fonctionBrute) ? 'executif_collectivite' : 'region',
        libelle: `${base} (${region})`,
        depuis,
      };
      break;
    }
    case 'ma': {
      // Assemblées des collectivités à statut particulier : Corse, Guyane,
      // Martinique, Métropole de Lyon, Wallis-et-Futuna, Saint-Pierre-et-Miquelon…
      const collectivite = champ(ligne, 'Libellé de la collectivité à statut particulier', 'Libellé du  département');
      const executif = /président/i.test(fonctionBrute);
      const base =
        fonctionBrute && !/^autre membre$/i.test(fonctionBrute) ? fonction(fonctionBrute, sexe) : "Membre de l'assemblée";
      mandat = {
        type: executif ? 'executif_collectivite' : 'collectivite',
        libelle: `${base} (${casseDeLieu(collectivite)})`,
        depuis,
      };
      break;
    }
    case 'rpe': {
      mandat = { type: 'europe', libelle: feminin ? 'Députée européenne' : 'Député européen', depuis };
      break;
    }
    case 'afe': {
      const circonscription = champ(ligne, 'Libellé la circ. AFE', 'Libellé de la circonscription AFE');
      const base = fonctionBrute
        ? fonction(fonctionBrute, sexe)
        : feminin
          ? "Conseillère à l'Assemblée des Français de l'étranger"
          : "Conseiller à l'Assemblée des Français de l'étranger";
      mandat = { type: 'francais_etranger', libelle: `${base} (${circonscription})`, depuis };
      break;
    }
    case 'consfde': {
      const circonscription = champ(ligne, 'Libellé de la circonscription consulaire', 'Libellé la circonscription AFE');
      const base = fonctionBrute
        ? fonction(fonctionBrute, sexe)
        : feminin
          ? 'Conseillère des Français de l’étranger'
          : 'Conseiller des Français de l’étranger';
      mandat = { type: 'francais_etranger', libelle: `${base} (${circonscription})`, depuis };
      break;
    }
  }

  return { nom, prenom, sexe, dateNaissance: naissance, mandat };
}

// --- Rapprochement ------------------------------------------------------------

/** Une personne du répertoire : toutes ses lignes, tous fichiers confondus. */
export interface PersonneRne {
  nom: string;
  prenom: string;
  dateNaissance: string;
  mandats: MandatLocal[];
}

export interface CandidatIdentite {
  nom: string;
  prenom: string;
  dateNaissance: Date | null;
}

export interface MandatsRattaches {
  confiance: 'A' | 'B';
  mandats: MandatLocal[];
}

/** Regroupe les lignes par personne : même nom, même prénom, même date. */
export function regrouperPersonnes(lignes: LigneRne[]): Map<string, PersonneRne[]> {
  const personnes = new Map<string, PersonneRne>();
  for (const ligne of lignes) {
    const clef = `${normaliserIdentite(ligne.nom)}|${normaliserIdentite(ligne.prenom)}|${ligne.dateNaissance}`;
    const existante = personnes.get(clef);
    if (existante) existante.mandats.push(ligne.mandat);
    else personnes.set(clef, { nom: ligne.nom, prenom: ligne.prenom, dateNaissance: ligne.dateNaissance, mandats: [ligne.mandat] });
  }

  // Index par nom et date, comme `construireIndexPersonnes`.
  const index = new Map<string, PersonneRne[]>();
  for (const personne of personnes.values()) {
    const clef = `${normaliserIdentite(personne.nom)}|${personne.dateNaissance}`;
    const liste = index.get(clef);
    if (liste) liste.push(personne);
    else index.set(clef, [personne]);
  }
  return index;
}

/** Sans doublon (même libellé), dans l'ordre d'importance puis d'ancienneté. */
export function ordonnerMandats(mandats: MandatLocal[]): MandatLocal[] {
  const vus = new Map<string, MandatLocal>();
  for (const mandat of mandats) {
    const clef = mandat.libelle.toLowerCase();
    if (!vus.has(clef)) vus.set(clef, mandat);
  }
  return [...vus.values()].sort(
    (a, b) => RANG[a.type] - RANG[b.type] || (a.depuis ?? '9999').localeCompare(b.depuis ?? '9999') || a.libelle.localeCompare(b.libelle, 'fr')
  );
}

function distance(a: string, b: string): number {
  const ligne = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonale = ligne[0]!;
    ligne[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const haut = ligne[j]!;
      ligne[j] = Math.min(ligne[j]! + 1, ligne[j - 1]! + 1, diagonale + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonale = haut;
    }
  }
  return ligne[b.length]!;
}

/**
 * Deux prénoms peuvent-ils désigner la même personne ? Oui s'ils partagent un
 * prénom (« Loïc Murat Jean-Claude » / « Loïc », « Marie-Thérèse dite
 * Anne-Marie » / « Anne-Marie »), ou si le premier ne diffère que d'une
 * coquille (« Chistine » / « Christine », « Kamel » / « Kamal »). Non pour
 * « Bernard » / « Pascal » : même nom et même date de naissance, ce sont
 * peut-être des jumeaux.
 */
export function prenomsCompatibles(a: string, b: string): boolean {
  const jetons = (p: string) => p.split(/\s+/).map(normaliserIdentite).filter((j) => j.length > 0);
  const ja = jetons(a);
  const jb = jetons(b);
  if (ja.some((j) => jb.includes(j))) return true;
  const [pa, pb] = [ja[0] ?? '', jb[0] ?? ''];
  return pa.length >= 4 && pb.length >= 4 && distance(pa, pb) <= 2;
}

/**
 * Mandats d'un candidat, ou `null` sans certitude. Mêmes niveaux que
 * `rattacher` : A si nom, prénom et date concordent ; B si nom et date
 * concordent pour une seule personne dont le prénom est compatible (prénom
 * d'usage, prénoms multiples, coquille d'un des deux fichiers) ; rien sinon.
 */
export function mandatsDuCandidat(
  candidat: CandidatIdentite,
  index: Map<string, PersonneRne[]>
): MandatsRattaches | null {
  const naissance = clefDate(candidat.dateNaissance);
  if (!naissance) return null;
  const personnes = index.get(`${normaliserIdentite(candidat.nom)}|${naissance}`);
  if (!personnes || personnes.length === 0) return null;

  const prenom = normaliserIdentite(candidat.prenom);
  const memePrenom = personnes.filter((p) => normaliserIdentite(p.prenom) === prenom);
  if (memePrenom.length === 1) return { confiance: 'A', mandats: ordonnerMandats(memePrenom[0]!.mandats) };
  if (memePrenom.length > 1) return null;
  if (personnes.length === 1 && prenomsCompatibles(candidat.prenom, personnes[0]!.prenom)) {
    return { confiance: 'B', mandats: ordonnerMandats(personnes[0]!.mandats) };
  }
  return null;
}
