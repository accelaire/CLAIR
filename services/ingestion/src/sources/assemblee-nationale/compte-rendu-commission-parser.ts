// =============================================================================
// Parseur des comptes rendus de réunion de commission — Assemblée nationale
// =============================================================================
//
// POURQUOI UN PARSEUR DE PDF. Contrairement à la séance publique, dont
// l'Assemblée publie le compte rendu en XML structuré (`syceronbrut`), les
// réunions de commission n'existent qu'en **PDF**. Vérifié le 2026-09-15 :
// la page `/dyn/docs/<ref>.html` ne porte que le titre et un lien vers le PDF,
// les anciennes URLs `/17/cr-cloi/25-26/cNNNN.asp` y redirigent, et le portail
// open data ne propose aucun jeu de données de comptes rendus de commission
// (seules les *notices* de réunion, que nous ingérons déjà via l'agenda).
//
// CE QUE LE CORPUS CONTIENT RÉELLEMENT. Relevé le 2026-09-15 sur 46 comptes
// rendus (41 tirés au hasard dans les 2 842 de la 17e législature, 5 choisis
// pour varier les commissions). Aucun n'échappe aux trois familles :
//
//   · 38 portent un débat : 3 099 prises de parole, 475 orateurs distincts,
//     médiane 61 prises par réunion ;
//   · 4 sont des réunions « article 86/88/91 », consacrées aux amendements :
//     pas de parole, mais le tableau des avis de la commission — ou, quand elle
//     repousse tout en bloc, pas même de tableau ;
//   · 4 renvoient à la vidéo, en trois formulations différentes ;
//   · 45 sur 46 portent la liste des présents et des excusés.
//
// Ce module traite le débat et la liste de présence. Les réunions d'amendements
// sont reconnues — pour ne pas les confondre avec un débat qu'on aurait raté —
// mais l'extraction de leur tableau reste à écrire.
//
// LA GRAMMAIRE D'UN EN-TÊTE DE PRISE DE PAROLE. Éprouvée sur ces 46 comptes
// rendus : 3 099 en-têtes reconnus, et 43 paragraphes commençant eux aussi par
// une civilité correctement écartés. Quatre pièges, tous rencontrés :
//
//   1. L'en-tête court souvent sur DEUX lignes (« M. Éric Coquerel, » puis la
//      qualité à la ligne suivante). D'où le travail par paragraphes et non par
//      lignes : sous `pdftotext -layout`, un paragraphe commence par une ligne
//      indentée et ses suites reviennent en colonne 0.
//   2. Une phrase peut commencer par une civilité sans être un en-tête :
//      « Mme Caroline Semaille a exercé ces fonctions… », « M. Bazin a évoqué… ».
//      On exige donc que ce qui suit le nom soit une qualité introduite par une
//      virgule, un groupe entre parenthèses, ou rien — puis un point.
//   3. Ce point n'est pas toujours celui qu'on croit : « M. Hendrik Davi,
//      suppléant M. Untel. » en contient deux, seul le second clôt l'en-tête.
//      D'où la liste d'abréviations.
//   4. La liste des présents est une énumération de civilités qui ressemble à
//      un en-tête (« Mme Manon Bouquin, M. Romain Baubry, … »). On la retire du
//      corps avant de parser, et on rejette toute qualité qui commence par une
//      civilité.
//
// Le sommaire de couverture, lui, se reconnaît à ses points de conduite
// (« M. Julien Dive ......... 13 ») : 30 faux en-têtes évités.
// =============================================================================

/** Une prise de parole en réunion de commission. */
export interface PriseDeParoleCommission {
  /** Rang dans le compte rendu, à partir de 1. */
  ordre: number;
  /** L'en-tête tel qu'imprimé, sans le point final. */
  enTete: string;
  /** « M. », « Mme », « MM. », « Mmes ». */
  civilite: string;
  /** Prénom et nom, quand le compte rendu les donne. */
  nom: string | null;
  /** « rapporteur », « ministre de la culture », « président »… */
  qualite: string | null;
  /** Sigle du groupe, quand le compte rendu le mentionne : « (LFI-NFP) ». */
  groupe: string | null;
  /** Le perchoir de la commission : président, présidente, vice-président. */
  estPresidence: boolean;
  /** Le propos, paragraphes joints par une ligne vide. */
  contenu: string;
}

/** Ce qu'un compte rendu de commission apporte. */
export interface CompteRenduCommission {
  /**
   * `debat` : des prises de parole ; `avis_amendements` : le tableau des avis
   * d'une réunion « article 88/91 » ; `video_seule` : renvoi au portail vidéo ;
   * `vide` : ni l'un ni l'autre (à journaliser, c'est probablement un format
   * qu'on ne connaît pas encore).
   */
  type: 'debat' | 'avis_amendements' | 'video_seule' | 'vide';
  prises: PriseDeParoleCommission[];
  /** Noms tels qu'imprimés dans « Présents. - … ». */
  presents: string[];
  /** Noms tels qu'imprimés dans « Excusés. - … ». */
  excuses: string[];
  /** « quinze heures quarante-cinq », « 15 heure 45 » — tel quel. */
  ouverture: string | null;
}

// =============================================================================
// GRAMMAIRE
// =============================================================================

const CIVILITE = String.raw`(?:M\.|MM\.|Mme|Mmes)`;
const DEBUT_CIVILITE = new RegExp(`^(${CIVILITE})\\s+`, 'u');

/** L'apostrophe est tantôt droite, tantôt typographique — les deux existent. */
const APOSTROPHE = String.raw`[’']`;

/**
 * Un mot de nom propre : capitale initiale (accentuée comprise, que `[A-Z]`
 * laisserait passer), ou particule nobiliaire.
 */
const MOT_NOM = new RegExp(
  String.raw`^(?:[A-ZÀ-Þ][\wÀ-ɏ’'\-]*|d[eu]s?|d${APOSTROPHE}|von|van|della)(?=\s|$|[.,(])`,
  'u'
);

/**
 * L'article qui ouvre un titre placé AVANT le nom : « M. **le** président
 * Coquerel », « M. **l'**ingénieur général de l'armement Gaël Diaz de Tuesta ».
 * Un simple « de » n'en est pas un — sans quoi « M. de Courson » perdrait sa
 * particule.
 */
const ARTICLE_DE_TITRE = new RegExp(String.raw`^(?:l[ae]|l${APOSTROPHE}\w)`, 'u');

/** Un mot de titre : minuscule, ou particule. */
const MOT_TITRE = new RegExp(String.raw`^[a-zà-öø-ÿ][\wÀ-ɏ’'\-]*(?=\s|$|[.,(])`, 'u');

/**
 * Abréviations dont le point ne termine pas un en-tête. Sans cette liste,
 * « M. Hendrik Davi, suppléant M. Untel. » perd sa qualité.
 */
const ABREVIATIONS = new Set(['M', 'MM', 'Mme', 'Mmes', 'Dr', 'Pr', 'St', 'Ste', 'ex', 'cf', 'art']);

const POINTS_DE_CONDUITE = /\.{4,}|…{2,}/u;
const NUMERO_DE_PAGE = /^\s*[—–-]\s*\d+\s*[—–-]\s*$/u;
const DEBUT_DES_PRESENCES =
  /^\s*(?:Membres\s+pr[ée]sents\s+ou\s+excus[ée]s|Pr[ée]sences?\s+en\s+r[ée]union)\s*$/mu;
/**
 * Le renvoi à la vidéo, dans les trois formulations relevées : « n'a pas fait
 * l'objet d'un compte rendu écrit » (commissions permanentes), « les débats
 * sont accessibles sur le portail vidéo » (comité d'évaluation) et
 * « l'enregistrement audiovisuel de cette réunion est disponible » (finances).
 */
const MENTION_VIDEO = new RegExp(
  [
    String.raw`n[’']a\s+pas\s+fait\s+l[’']objet\s+d[’']un\s+compte\s+rendu\s+[ée]crit`,
    String.raw`d[ée]bats\s+sont\s+accessibles\s+sur\s+le\s+portail\s+vid[ée]o`,
    String.raw`enregistrement\s+audiovisuel\s+de\s+cette\s+r[ée]union\s+est\s+disponible`,
  ].join('|'),
  'u'
);

/**
 * Les réunions consacrées aux amendements se désignent elles-mêmes par
 * l'article du Règlement qui les fonde. Il faut ce signal en plus du tableau :
 * quand la commission repousse tout en bloc, il n'y a aucun tableau à lire
 * (« Les amendements qui n'ont pas été examinés […] ont été repoussés »).
 */
const REUNION_DAMENDEMENTS =
  /en\s+application\s+de\s+l[’']article\s+(?:86|88|91)\s+du\s+R[èe]glement/u;

/**
 * L'en-tête du tableau d'avis des réunions « article 88/91 ».
 *
 * Trois mises en page relevées sur six réunions : les colonnes peuvent être
 * `N° Amdt / Place / Auteur / Groupe / Position`, s'arrêter à `Groupe`, ou
 * s'ordonner `N° / N° id. / Auteur / Groupe / Place`. Le dénominateur commun
 * est la paire de colonnes « Auteur » et « Groupe » sur une même ligne.
 */
const TABLEAU_DAVIS = /^[^\S\n]*(?:N°[^\n]*)?\bAuteur\b[^\S\n]{2,}[^\n]*\bGroupe\b/mu;
const OUVERTURE =
  /^\s*\(?(?:La\s+(?:s[ée]ance|r[ée]union)\s+(?:est\s+ouverte|commence)\s+[àa]\s+)([^.)]{2,40})/mu;

const PRESENTS = /^\s*Pr[ée]sents?\s*\.\s*[-–—]\s*([\s\S]*?)(?=^\s*(?:Excus[ée]s?|Assistai(?:en)?t)\s*\.|\f|\n\s*\n\s*\n|$)/mu;
const EXCUSES = /^\s*Excus[ée]s?\s*\.\s*[-–—]\s*([\s\S]*?)(?=^\s*(?:Pr[ée]sents?|Assistai(?:en)?t)\s*\.|\f|\n\s*\n\s*\n|$)/mu;

// =============================================================================
// DÉCOUPAGE
// =============================================================================

/**
 * Sépare le corps du débat de la liste de présence.
 *
 * La première page est toujours la couverture : titre, horaire, et le sommaire
 * à points de conduite. Elle ne porte aucune parole, et son sommaire imite les
 * en-têtes — on la jette.
 */
export function corpsEtPresences(texte: string): { corps: string; presences: string } {
  const pages = texte.split('\f');
  const sansCouverture = pages.length > 1 ? pages.slice(1).join('\f') : pages.join('\f');
  const coupe = DEBUT_DES_PRESENCES.exec(sansCouverture);
  if (!coupe) return { corps: sansCouverture, presences: '' };
  return {
    corps: sansCouverture.slice(0, coupe.index),
    presences: sansCouverture.slice(coupe.index),
  };
}

/**
 * Reconstitue les paragraphes.
 *
 * `pdftotext -layout` conserve l'indentation : un paragraphe commence par une
 * ligne en retrait, ses suites reviennent en colonne 0. C'est le seul signal
 * fiable — sans lui, un en-tête coupé en deux lignes devient introuvable.
 */
export function paragraphes(corps: string): string[] {
  const out: string[] = [];
  let courant: string[] = [];
  const pousser = () => {
    if (courant.length > 0) {
      out.push(courant.join(' ').replace(/\s+/gu, ' ').trim());
      courant = [];
    }
  };

  for (const ligne of corps.replace(/\f/gu, '\n').split('\n')) {
    if (ligne.trim().length === 0 || NUMERO_DE_PAGE.test(ligne)) {
      pousser();
      continue;
    }
    if (/^[ \t]{2,}\S/u.test(ligne) && courant.length > 0) {
      pousser();
      courant.push(ligne.trim());
    } else {
      courant.push(ligne.trim());
    }
  }
  pousser();
  return out.filter((p) => p.length > 0);
}

/** Longueur maximale d'un en-tête : la plus longue qualité relevée fait 96 signes. */
const LONGUEUR_MAX_EN_TETE = 220;

/**
 * Ce qui sépare l'en-tête du propos.
 *
 * L'Assemblée enchaîne directement (« M. Untel. Mes chers collègues »), tandis
 * que les organes qu'elle partage avec le Sénat — l'OPECST, par exemple —
 * suivent la typographie du Sénat et intercalent un tiret (« M. Untel. – Nous
 * examinons »). Sans ce tiret dans la règle, un compte rendu entier de l'Office
 * ressortait « de forme inconnue ».
 */
const APRES_EN_TETE = /^\s+(?:[-–—]\s*)?[«“(A-ZÀ-Þ]/u;

/**
 * Le point qui clôt l'en-tête, ou `-1`.
 *
 * Ni le point d'une abréviation (« suppléant M. Untel. » en a deux), ni un point
 * qui n'est pas suivi d'un début de phrase, ne comptent.
 */
function finDeLEnTete(paragraphe: string, depuis: number): number {
  for (let i = depuis; i < Math.min(paragraphe.length, LONGUEUR_MAX_EN_TETE); i += 1) {
    if (paragraphe[i] !== '.') continue;
    const mot = /(\w+)$/u.exec(paragraphe.slice(0, i));
    if (mot && ABREVIATIONS.has(mot[1]!)) continue;
    if (APRES_EN_TETE.test(paragraphe.slice(i + 1))) return i;
    return -1;
  }
  return -1;
}

/**
 * L'en-tête d'un paragraphe, ou `null` si le paragraphe n'en porte pas.
 *
 * On balaie au lieu de tout confier à une regex : la borne de l'en-tête dépend
 * des abréviations, ce qu'aucun quantificateur paresseux ne sait faire.
 */
export function enTeteDuParagraphe(
  paragraphe: string
): { enTete: string; qualifBrut: string; longueur: number } | null {
  // Le sommaire de couverture et les décomptes de suffrages portent des points
  // de conduite : « M. Julien Dive ......... 13 ».
  if (POINTS_DE_CONDUITE.test(paragraphe)) return null;

  const civ = DEBUT_CIVILITE.exec(paragraphe);
  if (!civ) return null;
  let i = civ[0].length;

  const motSuivant = (): string | null => {
    const reste = paragraphe.slice(i);
    const m = /^[^\s.,()]+/u.exec(reste);
    return m ? m[0] : null;
  };
  const avancer = (n: number) => {
    i += n;
    const espace = /^\s+/u.exec(paragraphe.slice(i));
    if (espace) i += espace[0].length;
  };

  // Un titre peut précéder le nom. Il s'ouvre par un article et court en
  // minuscules jusqu'au premier mot capitalisé — ou jusqu'au point, quand le
  // compte rendu ne nomme pas l'orateur (« M. le rapporteur général. »).
  const premier = motSuivant();
  if (premier !== null && ARTICLE_DE_TITRE.test(premier)) {
    for (let garde = 0; garde < 8; garde += 1) {
      const mot = motSuivant();
      if (mot === null || !MOT_TITRE.test(mot)) break;
      avancer(mot.length);
    }
  }

  // Le nom : un à cinq mots propres.
  let motsDeNom = 0;
  while (motsDeNom < 5) {
    const mot = motSuivant();
    if (mot === null || !MOT_NOM.test(mot)) break;
    avancer(mot.length);
    motsDeNom += 1;
  }

  // Ce qui suit le nom départage un en-tête d'une phrase : seuls un point, une
  // parenthèse de groupe ou une virgule de qualité peuvent suivre. « Mme Caroline
  // Semaille a exercé ces fonctions… » tombe ici.
  const apresNom = paragraphe[i];
  if (apresNom !== '.' && apresNom !== '(' && apresNom !== ',') return null;

  const finDuNom = i;
  if (apresNom === '(') {
    const ferme = paragraphe.indexOf(')', i);
    if (ferme < 0 || ferme - i > 42) return null;
    i = ferme + 1;
  }
  if (paragraphe[i] === ',') {
    // Une énumération de noms n'est pas une qualité : c'est une liste de
    // présence égarée dans le corps du compte rendu.
    if (new RegExp(`^,\\s*${CIVILITE}\\s`, 'u').test(paragraphe.slice(i))) return null;
    i += 1;
  }

  const fin = finDeLEnTete(paragraphe, i);
  if (fin < 0) return null;

  const apres = /^\s+(?:[-–—]\s*)?/u.exec(paragraphe.slice(fin + 1));
  return {
    enTete: paragraphe.slice(0, fin).replace(/\s+/gu, ' ').trim(),
    qualifBrut: paragraphe.slice(finDuNom, fin),
    longueur: fin + 1 + (apres ? apres[0].length : 0),
  };
}

const PRESIDENCE = /\b(?:pr[ée]sident|pr[ée]sidente|vice-pr[ée]sident|vice-pr[ée]sidente)\b/u;

/** Décompose un en-tête en civilité, nom, qualité et groupe. */
export function decomposerEnTete(enTete: string): {
  civilite: string;
  nom: string | null;
  qualite: string | null;
  groupe: string | null;
  estPresidence: boolean;
} {
  const civ = new RegExp(`^(${CIVILITE})\\s*`, 'u').exec(enTete);
  const civilite = civ ? civ[1]! : '';
  let reste = enTete.slice(civ ? civ[0].length : 0);

  // Le groupe, quand le compte rendu le donne : « M. Charles Fournier (EcoS) ».
  let groupe: string | null = null;
  const parenthese = /\s*\(([^)]{1,40})\)\s*$/u.exec(reste);
  if (parenthese) {
    groupe = parenthese[1]!.trim();
    reste = reste.slice(0, parenthese.index);
  }

  // La qualité, introduite par une virgule : « , rapporteure pour avis ».
  let qualite: string | null = null;
  const virgule = reste.indexOf(', ');
  if (virgule >= 0) {
    qualite = reste.slice(virgule + 2).trim() || null;
    reste = reste.slice(0, virgule);
  }

  // Un titre placé avant le nom tient lieu de qualité : « le président Coquerel »
  // donne la qualité « président » et le nom « Coquerel ».
  const titreDevant = /^l[ae']\s?([\wÀ-ɏ’'\- ]+?)\s+((?:[A-ZÀ-Þ][\wÀ-ɏ’'\-]*)(?:\s+.*)?)$/u.exec(reste);
  let nom: string | null = reste.trim() || null;
  if (titreDevant) {
    qualite = qualite ?? titreDevant[1]!.trim();
    nom = titreDevant[2]!.trim();
  } else if (/^l[ae']/u.test(reste)) {
    // En-tête anonyme : « le rapporteur général », sans nom.
    qualite = qualite ?? reste.replace(/^l[ae']\s?/u, '').trim();
    nom = null;
  }

  return {
    civilite,
    nom,
    qualite,
    groupe,
    estPresidence: PRESIDENCE.test(qualite ?? '') || PRESIDENCE.test(enTete),
  };
}

/** Les noms d'une liste « Présents. - M. X, Mme Y, … ». */
export function nomsDeLaListe(bloc: string | undefined): string[] {
  if (!bloc) return [];
  return bloc
    .replace(/\s+/gu, ' ')
    .split(/,\s*|\set\s+/u)
    .map((n) => n.replace(/\.$/u, '').trim())
    .filter((n) => new RegExp(`^${CIVILITE}\\s+\\S`, 'u').test(n));
}

// =============================================================================
// PARSEUR
// =============================================================================

/**
 * Lit un compte rendu de commission tel que `pdftotext -layout` le rend.
 *
 * Ne lève pas : un format inconnu ressort en `type: 'vide'`, à journaliser
 * plutôt qu'à faire échouer la nuit.
 */
export function parserCompteRenduCommission(texte: string): CompteRenduCommission {
  const { corps, presences } = corpsEtPresences(texte);

  const prises: PriseDeParoleCommission[] = [];
  let courante: PriseDeParoleCommission | null = null;

  for (const paragraphe of paragraphes(corps)) {
    const tete = enTeteDuParagraphe(paragraphe);
    if (tete) {
      const { civilite, nom, qualite, groupe, estPresidence } = decomposerEnTete(tete.enTete);
      courante = {
        ordre: prises.length + 1,
        enTete: tete.enTete,
        civilite,
        nom,
        qualite,
        groupe,
        estPresidence,
        contenu: paragraphe.slice(tete.longueur).trim(),
      };
      prises.push(courante);
      continue;
    }
    // Un paragraphe sans en-tête prolonge la parole en cours. Avant la première
    // prise, c'est la didascalie d'ouverture : on la laisse de côté.
    if (courante) courante.contenu = `${courante.contenu}\n\n${paragraphe}`.trim();
  }

  const ouverture = OUVERTURE.exec(texte);
  const type: CompteRenduCommission['type'] =
    prises.length > 0
      ? 'debat'
      : TABLEAU_DAVIS.test(texte) || REUNION_DAMENDEMENTS.test(texte)
        ? 'avis_amendements'
        : MENTION_VIDEO.test(texte)
          ? 'video_seule'
          : 'vide';

  return {
    type,
    prises,
    presents: nomsDeLaListe(PRESENTS.exec(presences)?.[1]),
    excuses: nomsDeLaListe(EXCUSES.exec(presences)?.[1]),
    ouverture: ouverture ? ouverture[1]!.replace(/\s+/gu, ' ').trim() : null,
  };
}
