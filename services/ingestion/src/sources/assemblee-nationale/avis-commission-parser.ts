// =============================================================================
// Le tableau des avis : ce que la commission recommande avant le vote
// =============================================================================
//
// Avant qu'un texte passe en séance, la commission se réunit au titre des
// articles 86, 88 ou 91 du Règlement pour dire ce qu'elle pense des amendements
// qui y seront débattus. Son compte rendu ne porte alors aucun débat : juste un
// tableau. 193 réunions de l'Assemblée sur 3 443 sont dans ce cas.
//
// SEPT MISES EN PAGE, RELEVÉES SUR DOUZE COMPTES RENDUS. Les colonnes changent
// de nom, d'ordre et de nombre d'une commission à l'autre :
//
//   Article  Amendement  Auteur  Groupe  Avis                        (7 tableaux)
//   N°  Auteur  Groupe  Place                                        (6)
//   Article  Amendement  Auteur  Groupe  Sort                        (4)
//   N° Amdt  Place  Auteur  Groupe  Position de la commission        (2)
//   N° Amdt  Place  Auteur  Groupe                                   (2)
//   N°  N° Id  Auteur  Groupe  Place                                 (1)
//   N°  Auteur  Groupe  Place  Alinéa                                (1)
//
// D'où un parseur piloté par l'en-tête : on lit la ligne de titres, on en
// déduit le rôle et la position de chaque colonne, et on découpe les lignes
// suivantes à ces abscisses. `pdftotext -layout` conserve l'alignement, c'est
// ce qui rend la découpe possible.
//
// L'AVIS N'EST PAS TOUJOURS DANS LE TABLEAU. Dans un cas sur deux il n'y a pas
// de colonne d'avis : le tableau entier porte un seul sens, annoncé dans la
// phrase qui le précède — « La commission a accepté les amendements figurant
// dans le tableau ci-après », « auxquels il est proposé de donner un avis
// favorable », « ont été repoussés ». Un compte rendu peut enchaîner plusieurs
// tableaux, chacun avec son annonce. On remonte donc au préambule le plus
// proche au-dessus du tableau.
// =============================================================================

/** Ce qu'une ligne de tableau dit d'un amendement. */
export interface AvisSurAmendement {
  /** Rang dans le compte rendu, à partir de 1. */
  ordre: number;
  /** Le numéro d'amendement tel qu'imprimé. */
  numero: string;
  /** L'avis tel qu'imprimé : « Accepté », « Repoussé », « Favorable »… */
  position: string;
  /** Ce que cet avis veut dire, une fois normalisé. */
  sens: SensDeLAvis;
  /** L'article visé, tel qu'imprimé : « 11 », « Ap. 18 », « ap 3 bis ». */
  place: string | null;
  auteur: string | null;
  groupe: string | null;
}

export type SensDeLAvis = 'favorable' | 'defavorable' | 'autre';

/** Le rôle d'une colonne, déduit de son titre. */
type Role = 'numero' | 'identique' | 'place' | 'auteur' | 'groupe' | 'position';

const ROLE_DES_TITRES: Array<[RegExp, Role]> = [
  // L'ordre compte : « N° Id » doit être reconnu avant « N° ».
  [/^N°\s*Id\.?$/iu, 'identique'],
  [/^N°\s*(?:Amdt|Amdt\.|Amendement)?$/iu, 'numero'],
  [/^Amendements?$/iu, 'numero'],
  [/^(?:Place|Article|Alin[ée]a)$/iu, 'place'],
  [/^Auteurs?$/iu, 'auteur'],
  [/^Groupes?$/iu, 'groupe'],
  [/^(?:Avis|Sort|Position(?:\s+de\s+la\s+commission)?)$/iu, 'position'],
];

function roleDuTitre(titre: string): Role | null {
  const propre = titre.replace(/\s+/gu, ' ').trim();
  for (const [motif, role] of ROLE_DES_TITRES) {
    if (motif.test(propre)) return role;
  }
  return null;
}

/**
 * Les libellés d'avis, tels que les commissions les écrivent.
 *
 * « Repoussé » est le mot de l'Assemblée pour un avis défavorable sur un
 * amendement qu'elle n'a pas le pouvoir de rejeter : il partira quand même en
 * séance. Le distinguer d'un « Rejeté » importe, c'est pourquoi on garde aussi
 * le libellé brut.
 */
const FAVORABLE = /^(?:accept[ée]e?s?|favorables?|avis\s+favorables?|adopt[ée]e?s?)$/iu;
const DEFAVORABLE = /^(?:repouss[ée]e?s?|d[ée]favorables?|avis\s+d[ée]favorables?|rejet[ée]e?s?)$/iu;

export function sensDeLAvis(position: string): SensDeLAvis {
  const propre = position.replace(/\s+/gu, ' ').trim();
  if (FAVORABLE.test(propre)) return 'favorable';
  if (DEFAVORABLE.test(propre)) return 'defavorable';
  return 'autre';
}

/**
 * L'avis annoncé par la phrase qui précède un tableau, quand celui-ci n'a pas
 * de colonne d'avis.
 */
const ANNONCES: Array<[RegExp, string]> = [
  [/il\s+est\s+propos[ée]\s+de\s+donner\s+un\s+avis\s+favorable/iu, 'Avis favorable'],
  [/il\s+est\s+propos[ée]\s+de\s+donner\s+un\s+avis\s+d[ée]favorable/iu, 'Avis défavorable'],
  [/la\s+commission\s+a\s+accept[ée]/iu, 'Accepté'],
  [/la\s+commission\s+a\s+repouss[ée]/iu, 'Repoussé'],
  [/ont\s+[ée]t[ée]\s+accept[ée]s/iu, 'Accepté'],
  [/ont\s+[ée]t[ée]\s+repouss[ée]s/iu, 'Repoussé'],
  [/avis\s+favorable/iu, 'Avis favorable'],
  [/avis\s+d[ée]favorable/iu, 'Avis défavorable'],
];

export function avisAnnonce(preambule: string): string | null {
  const propre = preambule.replace(/\s+/gu, ' ');
  for (const [motif, libelle] of ANNONCES) {
    if (motif.test(propre)) return libelle;
  }
  return null;
}

/** Une colonne : son rôle, dans l'ordre où l'en-tête l'annonce. */
type Colonne = { role: Role };

/**
 * Lit une ligne d'en-tête et en déduit l'ordre des colonnes.
 *
 * Rend `null` si la ligne ne porte pas au moins un numéro, un auteur et un
 * groupe : ces trois-là figurent dans les sept mises en page relevées, et leur
 * absence signale qu'on regarde autre chose qu'un tableau d'avis.
 */
export function colonnesDeLEnTete(ligne: string): Colonne[] | null {
  const colonnes: Colonne[] = [];
  // Deux espaces au moins séparent deux titres ; un seul peut appartenir à un
  // titre (« N° Amdt », « Position de la commission »).
  for (const m of ligne.matchAll(/\S(?:[^\s]|\s(?!\s))*/gu)) {
    const role = roleDuTitre(m[0].trim());
    if (role) colonnes.push({ role });
  }
  const roles = new Set(colonnes.map((c) => c.role));
  if (!roles.has('auteur') || !roles.has('groupe') || !roles.has('numero')) return null;
  return colonnes;
}

// =============================================================================
// LECTURE D'UNE LIGNE
// =============================================================================
//
// Ni les abscisses des titres ni les blancs multiples ne suffisent à découper
// une ligne. Les premières se trompent parce qu'une cellule ne s'aligne pas sur
// son titre — « Place » est imprimé huit caractères à droite de ses valeurs.
// Les seconds échouent parce qu'un seul espace sépare parfois deux cellules :
// « LFI-NFP Repoussé », quand le sigle est assez long pour manger la marge.
//
// On lit donc au contenu. Le vocabulaire est clos et connaissable : douze
// sigles de groupe, une poignée de mots d'avis, et un auteur qui commence
// toujours par une civilité ou par « Gouvernement ». L'en-tête ne sert plus
// qu'à donner l'ORDRE des rôles.

/**
 * Les sigles de groupe, relevés sur le corpus.
 *
 * Certains comptes rendus écrivent le groupe en toutes lettres — « Socialistes
 * et apparentés », « Rassemblement National », « Les Démocrates », « Écologiste
 * et Social ». La liste ne sert donc pas à reconnaître un groupe, seulement à
 * repérer d'un coup les tableaux qui l'abrègent.
 */
const GROUPES = new Set([
  'LFI-NFP', 'RN', 'DR', 'SOC', 'EPR', 'EcoS', 'Dem', 'LIOT', 'GDR', 'HOR', 'UDR', 'NI',
  // La 16e et la 15e, pour les comptes rendus plus anciens.
  'LFI', 'NUPES', 'LR', 'MODEM', 'UDI', 'LT', 'AE', 'GDR-NUPES', 'RE', 'LaREM',
]);

/** Un auteur : une civilité, ou l'une des deux institutions qui déposent. */
const DEBUT_DAUTEUR = /^(?:M\.|MM\.|Mme|Mmes|Gouvernement|Le|La|Commission)$/u;

/**
 * Le patronyme, que le tableau imprime toujours en capitales — « M. JACOBELLI
 * Laurent », « Mme PIRÈS BEAUNE Christine », « Mme K/BIDI Émeline ».
 *
 * C'est ce qui permet de séparer l'auteur de son groupe quand celui-ci est
 * écrit en toutes lettres : après les capitales vient le prénom, un seul mot,
 * et tout ce qui suit appartient au groupe.
 */
const PATRONYME = /^[A-ZÀ-Þ][A-ZÀ-Þ'’/-]+$/u;

const MOTS_DAVIS =
  /^(?:accept[ée]e?s?|repouss[ée]e?s?|favorables?|d[ée]favorables?|rejet[ée]e?s?|retir[ée]e?s?|tomb[ée]e?s?|sagesse|satisfait[e]?s?|adopt[ée]e?s?)$/iu;

const NUMERO_DE_CELLULE = /^[IVX]*-?\d+$/u;
/** La colonne « N° Id. » ne porte qu'une croix, ou le numéro de l'identique. */
const IDENTIQUE = /^(?:X|[IVX]*-?\d+)$/u;

/**
 * Une référence d'article, telle que la colonne « Place » ou « Article » l'écrit :
 * « 2 », « PREMIER », « premier 3 », « ap 3 bis », « Ap. 18 », « 4 bis A ».
 *
 * Il faut une grammaire, et pas seulement « tout ce qui précède l'auteur » :
 * dans la mise en page `Article | Amendement | Auteur | …`, la place précède le
 * numéro d'amendement et les deux sont des nombres. « 2 70 » se lit place 2,
 * amendement 70 — sans quoi la ligne entière est perdue.
 */
const PREFIXE_DE_PLACE = /^(?:ap\.?|apr[èe]s|av\.?|avant)$/iu;
const RANG_DE_PLACE = /^(?:premier|1er|1re|1[èe]re|titre|intitul[ée]|annexe|[ée]tat|[IVX]*-?\d+)$/iu;
const SUFFIXE_DE_PLACE = /^(?:bis|ter|quater|quinquies|sexies|septies|[A-Z])$/u;

/**
 * Consomme une référence d'article à partir de `i`. Rend l'indice d'arrêt.
 *
 * `numeroDejaLu` départage les deux lectures de « PREMIER 27 » : quand le
 * numéro d'amendement a déjà été pris, c'est la place entière (« premier 3 ») ;
 * quand il reste à prendre, « PREMIER » est la place et « 27 » l'amendement.
 */
function finDeLaPlace(mots: string[], i: number, numeroDejaLu: boolean): number {
  let j = i;
  if (j < mots.length && PREFIXE_DE_PLACE.test(mots[j]!)) j += 1;
  if (j >= mots.length || !RANG_DE_PLACE.test(mots[j]!)) return i;
  j += 1;
  if (numeroDejaLu && j < mots.length && /^premier$/iu.test(mots[j - 1]!) && RANG_DE_PLACE.test(mots[j]!)) {
    j += 1;
  }
  while (j < mots.length && SUFFIXE_DE_PLACE.test(mots[j]!)) j += 1;
  return j;
}

/**
 * Lit une ligne de tableau selon l'ordre des rôles annoncé par l'en-tête.
 *
 * Rend `null` dès qu'un rôle obligatoire — le numéro, l'auteur, le groupe — ne
 * trouve pas sa cellule : une ligne de prose qui traîne sous un tableau ne doit
 * pas produire un avis.
 */
export function lireLigneDeTableau(ligne: string, colonnes: Colonne[]): Map<Role, string> | null {
  const mots = ligne.trim().split(/\s+/u).filter((m) => m.length > 0);
  if (mots.length === 0) return null;

  const out = new Map<Role, string>();
  let i = 0;

  // Quand la place est imprimée APRÈS le groupe, celui-ci ne peut être qu'un
  // sigle : lui laisser avaler les mots suivants lui ferait manger l'article.
  const rangDuGroupe = colonnes.findIndex((c) => c.role === 'groupe');
  const placeApresGroupe = colonnes.some((c, rang) => c.role === 'place' && rang > rangDuGroupe);

  for (const { role } of colonnes) {
    if (i >= mots.length) break;

    if (role === 'numero') {
      if (!NUMERO_DE_CELLULE.test(mots[i]!)) return null;
      out.set('numero', mots[i]!);
      i += 1;
      continue;
    }

    if (role === 'identique') {
      // Presque toujours vide : on ne prend que si le mot en a la forme ET
      // qu'il reste de quoi servir les rôles suivants.
      if (IDENTIQUE.test(mots[i]!) && i + 1 < mots.length) {
        out.set('identique', mots[i]!);
        i += 1;
      }
      continue;
    }

    if (role === 'place') {
      // Quand la place suit l'auteur — « N° | Auteur | Groupe | Place » —, elle
      // court jusqu'au bout ou jusqu'à l'avis. Quand elle le précède, il faut
      // sa grammaire : sinon elle avale aussi le numéro d'amendement.
      const dejaVuLAuteur = out.has('auteur');
      const debut = i;
      if (dejaVuLAuteur) {
        while (i < mots.length && !MOTS_DAVIS.test(mots[i]!)) i += 1;
      } else {
        i = finDeLaPlace(mots, i, out.has('numero'));
      }
      if (i > debut) out.set('place', mots.slice(debut, i).join(' '));
      continue;
    }

    if (role === 'auteur') {
      if (!DEBUT_DAUTEUR.test(mots[i]!)) return null;
      const debut = i;
      if (/^(?:Gouvernement|Commission)$/u.test(mots[i]!)) {
        // Le Gouvernement et la commission déposent sans groupe.
        i += 1;
      } else {
        i += 1; // la civilité
        while (i < mots.length && PATRONYME.test(mots[i]!)) i += 1;
        // Puis le prénom : un seul mot, ce que le corpus confirme sur 573 cas.
        if (i < mots.length && !MOTS_DAVIS.test(mots[i]!) && !GROUPES.has(mots[i]!)) i += 1;
      }
      if (i === debut) return null;
      out.set('auteur', mots.slice(debut, i).join(' '));
      continue;
    }

    if (role === 'groupe') {
      // Facultatif : le Gouvernement n'en a pas. Abrégé en sigle dans certains
      // tableaux, écrit en toutes lettres dans d'autres — d'où les deux
      // lectures. Quand une colonne de place suit, le groupe s'arrête au sigle
      // pour ne pas avaler l'article.
      if (i >= mots.length) continue;
      if (GROUPES.has(mots[i]!)) {
        out.set('groupe', mots[i]!);
        i += 1;
        continue;
      }
      if (placeApresGroupe) continue;
      const debut = i;
      while (i < mots.length && !MOTS_DAVIS.test(mots[i]!)) i += 1;
      if (i > debut) out.set('groupe', mots.slice(debut, i).join(' '));
      continue;
    }

    if (role === 'position') {
      if (i < mots.length && MOTS_DAVIS.test(mots[i]!)) {
        out.set('position', mots[i]!);
        i += 1;
      }
      continue;
    }
  }

  if (!out.has('numero') || !out.has('auteur')) return null;
  return out;
}

/** Ce qu'une lecture de tableau a donné, et ce qu'elle a manqué. */
export interface LectureDesAvis {
  avis: AvisSurAmendement[];
  /**
   * Un en-tête de tableau a été reconnu mais aucune ligne n'a pu être lue.
   *
   * Signale une mise en page qu'on ne sait pas encore lire — celle où les
   * cellules larges débordent sur plusieurs lignes physiques, le groupe
   * « La France insoumise - Nouveau Front Populaire » s'étalant au-dessus et
   * au-dessous de sa ligne. À journaliser : une réunion muette doit se voir.
   */
  tableauNonLu: boolean;
}

/**
 * Lit tous les tableaux d'avis d'un compte rendu.
 *
 * Ne lève pas : une ligne qui ne ressemble pas à une ligne de tableau est
 * ignorée, un tableau sans avis identifiable l'est aussi. Mieux vaut rendre
 * moins que d'inventer une position — mais le dire.
 */
export function parserAvisCommission(texte: string): LectureDesAvis {
  const lignes = texte.replace(/\f/gu, '\n').split('\n');
  const avis: AvisSurAmendement[] = [];

  let colonnes: Colonne[] | null = null;
  let annonce: string | null = null;
  let enTeteVu = false;
  /** Ce qui a été lu depuis le dernier tableau : le préambule du prochain. */
  let preambule: string[] = [];

  for (const ligne of lignes) {
    if (ligne.trim().length === 0) continue;

    const enTete = colonnesDeLEnTete(ligne);
    if (enTete) {
      colonnes = enTete;
      enTeteVu = true;
      annonce = avisAnnonce(preambule.join(' '));
      preambule = [];
      continue;
    }

    if (!colonnes) {
      preambule.push(ligne);
      continue;
    }

    const cel = lireLigneDeTableau(ligne, colonnes);
    const numero = cel?.get('numero');
    if (!cel || !numero) {
      // Une ligne qui n'ouvre pas sur un numéro clôt le tableau : c'est du
      // texte, et ce texte annonce peut-être le tableau suivant.
      preambule.push(ligne);
      if (preambule.length > 3) colonnes = null;
      continue;
    }
    preambule = [];

    const position = cel.get('position') ?? annonce;
    if (!position) continue;

    avis.push({
      ordre: avis.length + 1,
      numero: numero.replace(/\s+/gu, ' ').trim(),
      position,
      sens: sensDeLAvis(position),
      place: cel.get('place') ?? null,
      auteur: cel.get('auteur') ?? null,
      groupe: cel.get('groupe') ?? null,
    });
  }

  return { avis, tableauNonLu: enTeteVu && avis.length === 0 };
}
