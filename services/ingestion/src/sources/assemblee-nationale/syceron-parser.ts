// =============================================================================
// Parser du compte rendu de séance AN (« syceron brut »)
// Source: https://data.assemblee-nationale.fr/static/openData/repository/{legislature}/vp/syceronbrut/syseron.xml.zip
// =============================================================================
//
// Ce schéma remplace celui de DILA, qui ne publie plus rien depuis janvier 2026
// et ne portait de toute façon aucun rattachement exploitable : le lien entre
// une prise de parole et l'amendement discuté n'y existait que dans le texte
// libre du compte rendu.
//
// Ici chaque <point> porte l'article (`art`) et le texte (`bibard`) en clair,
// chaque <paragraphe> un `code_grammaire` typé et l'identifiant de l'orateur
// (`id_acteur`), et les mises aux voix sont explicites :
//
//   SCRUT_PUB_ADT_1_2  valeur=" 2407"  « Je mets aux voix l'amendement no 2407. »
//   SCRUT_PUB_ADT_1_4                  « Nombre de votants 125 … »
//   SCRUT_ART_PUB_1_6  valeur=" 15"    « Je mets aux voix l'article 15. »
//
// Les <point> sont IMBRIQUÉS (nivpoint 1 à 4) : un paragraphe hérite de
// l'article du plus proche point englobant qui en déclare un. Un parcours à
// plat perdrait ce rattachement.

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';

// =============================================================================
// TYPES
// =============================================================================

/** Une prise de parole rattachée à son contexte de discussion. */
export interface PriseDeParoleSyceron {
  /** `id_syceron` du paragraphe : clé d'idempotence entre deux ingestions. */
  sourceUid: string;
  /** `ordre_absolu_seance` : ordre total et stable dans la séance. */
  ordreAbsolu: number;
  codeGrammaire: string;
  /** `PA123456`, tiré de `id_acteur` — plus aucun rapprochement par le nom. */
  orateurRef: string | null;
  orateurNom: string;
  orateurPrenom: string | null;
  orateurQualite: string | null;
  contenu: string;
  /** Article en discussion : `15`, `Après 14`, `Avant 16`. */
  articleVise: string | null;
  /**
   * Numéros d'amendement nommés par ce paragraphe, lus sur l'attribut `adt`.
   *
   * Surtout pas sur `valeur`, qui porte le rang du point à l'ordre du jour et
   * de petits compteurs de séance : l'avoir pris pour la source des numéros
   * laissait le champ vide sur 276 137 paragraphes et faux sur les 4 autres.
   *
   * On ne l'hérite pas du `<point>` englobant, contrairement à l'article et au
   * texte. La contre-épreuve sur la 17e législature est sans appel : quand le
   * paragraphe porte son propre `adt`, 77,9 % de ceux qui citent un numéro
   * citent bien celui-là ; hérité du point, 41,5 % seulement. Un `<point>`
   * ouvert sur l'amendement 46 couvre la discussion commune des suivants, si
   * bien que l'héritage prête à l'un ce qui se dit d'un autre — 131 064 lignes
   * mal rattachées contre 33 680 justes. Un rattachement faux est pire qu'un
   * rattachement absent.
   */
  amendementsVises: string[];
  /** Numéro du texte en discussion, tiré de `bibard`. */
  texteNumero: string | null;
  /**
   * Code de grammaire de la rubrique englobante (le `<point>` le plus proche
   * qui en déclare un). C'est là, et non sur le paragraphe, que le compte
   * rendu dit qu'on est dans les questions au Gouvernement : les paragraphes
   * y portent un code générique.
   */
  codeRubrique: string | null;
  /**
   * Vrai si la prise de parole s'inscrit dans une séquence d'explications de
   * vote ouverte au perchoir.
   *
   * L'Assemblée ne marque pas ses explications de vote dans la grammaire du
   * compte rendu : `EXPL_VOTE` n'apparaît que 7 fois sur les 601 séances de la
   * 17e législature, et les orateurs qui s'y succèdent portent le code
   * générique `PAROLE_GENERIQUE`, sous la rubrique du texte débattu. Le seul
   * repère est l'annonce de la présidence — « Dans les explications de vote,
   * la parole est à… » — qui ouvre une séquence courant jusqu'au scrutin.
   */
  dansExplicationDeVote: boolean;
  /** Vrai pour la mécanique de séance (« La parole est à… »), à ne pas afficher. */
  estPresidence: boolean;
}

/**
 * Ce sur quoi porte une mise aux voix.
 *
 * Les trois premières valeurs désignent une portion du texte : elles portent un
 * numéro, et le débat s'y rattache par ce numéro. Les trois dernières n'en ont
 * pas — un vote sur l'ensemble, une motion ou une demande de suspension portent
 * sur le texte entier ou sur la séance — et ne se rattachent que par la
 * chronologie.
 */
export type CibleDuVote =
  | 'article'
  | 'amendement'
  | 'sous-amendement'
  | 'ensemble'
  | 'motion'
  | 'autre';

/** Une mise aux voix annoncée au perchoir : la charnière vers nos scrutins. */
export interface VoteAnnonceSyceron {
  ordreAbsolu: number;
  cible: CibleDuVote;
  /** Numéro d'article, ou numéros d'amendements mis aux voix ensemble. */
  numeros: string[];
  articleVise: string | null;
  texteNumero: string | null;
  /** Chiffres proclamés, quand le scrutin est public. Sert de contre-épreuve. */
  resultat: { votants: number; exprimes: number; pour: number; contre: number } | null;
}

export interface SeanceSyceron {
  /** `CRSANR5L17S2025O1N214`. */
  uid: string;
  /** `RUANR5L17S2025IDS29400`, la réunion correspondante. */
  seanceRef: string | null;
  legislature: number;
  date: Date;
  prises: PriseDeParoleSyceron[];
  votes: VoteAnnonceSyceron[];
}

// =============================================================================
// CODES DE GRAMMAIRE
// =============================================================================

// L'AN numérote deux fois chaque famille de vote — `_1_2` à `_1_5` et `_1_6` à
// `_1_9` — selon que le scrutin public est direct ou fait suite à un vote à
// main levée non concluant. En ajoutant les sous-amendements et les variantes
// `_ANN_`, une énumération des codes d'annonce en compte une quinzaine, et
// toute liste incomplète perd des votes sans rien signaler.
//
// On s'ancre donc sur ce qui ne varie pas : les deux phrases du perchoir. La
// proclamation — « Nombre de votants … Pour l'adoption … Contre … » — et
// l'annonce qui la précède — « Je mets aux voix … ». Le code de grammaire ne
// sert qu'en second recours, pour les annonces dont la formulation sort de
// l'ordinaire (« Je le mets donc aux voix », « Je vais maintenant mettre aux
// voix ») mais qui portent leur cible dans l'attribut `valeur`.
//
// La contre-épreuve sur la 17e législature justifie ce renversement. Sur 8 407
// proclamations, la lecture par le code seul en appariait 7 699 ; les deux
// phrases réunies en apparient 8 401, sans changer d'annonce dans aucun des
// 7 644 cas que l'ancienne règle traitait déjà.
//
// Les 708 votes qui manquaient n'étaient pas des cas rares : ce sont les votes
// sur l'ensemble d'un texte (`VOTE_ENS_*`) et les motions (`SCR_MRJ_*`), dont
// le code ne commence pas par `SCRUT_` et dont la cible — « l'ensemble de la
// proposition de loi », « la motion de rejet préalable » — n'est pas un numéro
// et ne figure donc jamais dans `valeur`.

/** L'annonce d'une mise aux voix, dans ses formulations attestées. */
const MISE_AUX_VOIX = /\bje\s+(?:\S+\s+){0,3}?(?:mets|mettre)\s+(?:\S+\s+){0,2}?aux\s+voix\b/i;

/** Codes portant le sort d'un vote (« L'amendement n'est pas adopté ») : ils
 *  suivent la proclamation et ne doivent jamais être pris pour une annonce. */
const CODE_SORT = /_1_(?:5|9|10|100)$/;

/** Ce sur quoi porte une mise aux voix, lu dans la famille du code. */
function cibleDuCode(code: string): CibleDuVote {
  if (code.includes('SOUS_AMEND')) return 'sous-amendement';
  if (code.includes('_ART')) return 'article';
  if (code.startsWith('VOTE_ENS_')) return 'ensemble';
  if (code.includes('_MRJ')) return 'motion';
  return 'amendement';
}

/**
 * Ce sur quoi porte une mise aux voix, lu dans la phrase du perchoir.
 *
 * Sert quand l'attribut `valeur` est vide — 568 fois sur la 17e législature —
 * ce qui est le cas systématique des votes sur l'ensemble et des motions, dont
 * la cible n'est pas un numéro.
 *
 * L'ordre des essais compte : « le sous-amendement » contient « amendement »,
 * et « l'ensemble de la première partie » contient « partie » mais reste un
 * vote sur un ensemble.
 */
export function cibleDeLAnnonce(
  texte: string,
): { cible: CibleDuVote; numeros: string[] } | null {
  const m = texte.match(MISE_AUX_VOIX);
  if (!m || m.index === undefined) return null;
  const suite = texte.slice(m.index + m[0].length);

  if (/\bl['’]ensemble\b|\bla\s+proposition\s+de\s+r[ée]solution\b/i.test(suite)) {
    return { cible: 'ensemble', numeros: [] };
  }
  if (/\bla\s+motion\b/i.test(suite)) return { cible: 'motion', numeros: [] };
  if (/\bsous-amendements?\b/i.test(suite)) {
    return { cible: 'sous-amendement', numeros: numerosAmendement(suite) };
  }
  if (/\bamendements?\b/i.test(suite)) {
    return { cible: 'amendement', numeros: numerosAmendement(suite) };
  }
  if (/\bl['’]article\b/i.test(suite)) {
    return { cible: 'article', numeros: numeroArticleAnnonce(suite) };
  }
  return { cible: 'autre', numeros: [] };
}

/**
 * Le rang de l'article annoncé : `"l'article 4 bis, tel qu'il a…"` → `["4 bis"]`.
 *
 * « L'article unique » en est un comme un autre — c'est ainsi que le compte
 * rendu le nomme, et l'attribut `art` du point le reprend tel quel.
 */
function numeroArticleAnnonce(suite: string): string[] {
  // Le groupe « er » porte sa propre espace : sans cela `\s*` la consommerait
  // pour rien et « l'article 4 bis » se lirait « 4 ».
  const m = suite.match(/\bl['’]article\s+(unique|\d+(?:\s*(?:er|ère))?(?:\s+(?:bis|ter|quater))?)/i);
  if (!m || !m[1]) return [];
  return [m[1].replace(/\s+/g, ' ').trim()];
}

// =============================================================================
// NORMALISATION
// =============================================================================

/**
 * `" 15"` → `"15"`, `"Après_ 9"` → `"Après 9"`.
 * L'AN sépare le rang de l'article par un tiret bas.
 */
export function normaliserArticle(brut: string | undefined): string | null {
  if (!brut) return null;
  const propre = brut.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return propre.length > 0 ? propre : null;
}

/**
 * Numéros d'amendement portés par `valeur`.
 *
 * `" 2407"` → `['2407']`
 * `" 74, 1300 et 2598"` → `['74', '1300', '2598']`
 * `" 2066 rectifié"` → `['2066']` — la mention de rectification ne fait pas
 * partie du numéro, exactement comme `normalizeNumero()` côté amendements.
 */
export function numerosAmendement(brut: string | undefined): string[] {
  if (!brut) return [];
  return [...brut.matchAll(/\d+/g)].map((m) => m[0]);
}

/**
 * Numéro du texte en discussion, tiré de `bibard`.
 * `" (n[[o]] 1364)"` → `"1364"`. Le `[[o]]` est l'exposant « o » de « n° ».
 */
export function numeroTexte(brut: string | undefined): string | null {
  if (!brut) return null;
  const m = brut.match(/\d+/);
  return m ? m[0] : null;
}

/**
 * `20250523213000000` → 23 mai 2025, 21h30.
 * Les 3 derniers chiffres sont des millisecondes toujours nulles.
 */
export function dateDeSeance(brut: string | undefined): Date | null {
  if (!brut) return null;
  const m = brut.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, a, mo, j, h, mi, s] = m;
  const date = new Date(
    Date.UTC(Number(a), Number(mo) - 1, Number(j), Number(h), Number(mi), Number(s)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Découpe `"M. Yannick Monnet"` en prénom et nom.
 * La civilité n'appartient pas au nom, et l'AN la préfixe systématiquement.
 */
export function decouperNom(brut: string): { prenom: string | null; nom: string } {
  const sansCivilite = brut.replace(/^(M\.|MM\.|Mme|Mmes)\s+/u, '').trim();
  const parts = sansCivilite.split(/\s+/);
  if (parts.length < 2) return { prenom: null, nom: sansCivilite };
  return { prenom: parts[0] ?? null, nom: parts.slice(1).join(' ') };
}

/**
 * Vrai si `nom` (déjà débarrassé de sa civilité par `decouperNom`) désigne la
 * présidence de séance, jamais un président de commission.
 *
 * L'AN anonymise systématiquement qui préside au perchoir : `<nom>` porte
 * `M. le président` ou `Mme la présidente`, quelle que soit la personne réelle
 * — même le doyen d'âge qui ouvre une législature. Un président de commission
 * qui prend la parole sur le fond, lui, est nommé (`M. Éric Coquerel`) et
 * c'est sa `<qualite>` qui porte le titre (`président de la commission des
 * finances`).
 *
 * Vérifié sur l'archive complète de la 17e législature (601 comptes rendus,
 * ~330 000 paragraphes) : les deux formes génériques couvrent 99 790
 * paragraphes de mécanique de séance (mises aux voix, distributions de
 * parole, suspensions…) contre seulement 2 anomalies isolées où le nom réel
 * fuite dans `<nom>` — négligeable. À l'inverse, 2 512 paragraphes ont une
 * `<qualite>` commençant par « président » sans qu'aucun ne soit la
 * présidence de séance : ancien code qui testait `qualite`, ça aurait
 * effacé des présidents de commission de finances/lois/affaires sociales qui
 * parlent sur le fond. On ne regarde donc plus `qualite` du tout.
 */
export function estPresidenceDeSeance(nom: string): boolean {
  return /^(le |la )?pr[ée]sident/i.test(nom);
}

/** Chiffres proclamés au perchoir, dans l'ordre fixe du compte rendu. */
export function resultatProclame(
  texte: string,
): { votants: number; exprimes: number; pour: number; contre: number } | null {
  const m = texte.match(
    /Nombre de votants\s*:?\s*(\d+).*?suffrages exprim\S*\s*:?\s*(\d+).*?adoption\s*:?\s*(\d+).*?[Cc]ontre\s*:?\s*(\d+)/s,
  );
  if (!m) return null;
  return {
    votants: Number(m[1]),
    exprimes: Number(m[2]),
    pour: Number(m[3]),
    contre: Number(m[4]),
  };
}

// =============================================================================
// PARSER
// =============================================================================

/** Contexte hérité du plus proche <point> englobant qui le déclare. */
interface ContextePoint {
  articleVise: string | null;
  texteNumero: string | null;
  codeRubrique: string | null;
}

/**
 * Transforme un compte rendu de séance en prises de parole et mises aux voix.
 *
 * Retourne `null` si le document n'est pas exploitable (métadonnées absentes),
 * plutôt que de lever : une séance illisible ne doit pas interrompre la
 * moisson des 600 autres.
 */
export function parseCompteRendu(xml: string): SeanceSyceron | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(xml, { xmlMode: true });
  } catch (error) {
    logger.warn({ error: errorMessage(error) }, 'Compte rendu illisible');
    return null;
  }

  const uid = $('compteRendu > uid').first().text().trim();
  const date = dateDeSeance($('metadonnees > dateSeance').first().text().trim());
  const legislature = Number($('metadonnees > legislature').first().text().trim());

  if (!uid || !date || !Number.isFinite(legislature)) {
    logger.warn({ uid, legislature }, 'Compte rendu sans métadonnées exploitables');
    return null;
  }

  // On collecte d'abord tous les paragraphes à plat, dans l'ordre du document,
  // avant d'en tirer les prises de parole et les mises aux voix : le
  // rattachement d'une proclamation à son annonce est une lecture arrière, qui
  // suppose la séquence complète.
  const paragraphes: ParagrapheBrut[] = [];

  const contenu = $('compteRendu > contenu').first();
  if (contenu.length === 0) return null;

  // Parcours en profondeur, dans l'ordre du document, en empilant le contexte
  // porté par chaque <point>. Les points étant imbriqués sur quatre niveaux,
  // c'est cet héritage qui rattache un paragraphe à son article.
  const parcourir = (noeud: Element, herite: ContextePoint): void => {
    for (const enfant of noeud.children) {
      if (!estElement(enfant)) continue;

      if (enfant.name === 'point') {
        const propre: ContextePoint = {
          articleVise: normaliserArticle(enfant.attribs['art']) ?? herite.articleVise,
          texteNumero: numeroTexte(enfant.attribs['bibard']) ?? herite.texteNumero,
          codeRubrique: enfant.attribs['code_grammaire'] || herite.codeRubrique,
        };
        parcourir(enfant, propre);
        continue;
      }

      if (enfant.name === 'paragraphe') {
        paragraphes.push(lireParagraphe($, enfant, herite));
        continue;
      }

      parcourir(enfant, herite);
    }
  };

  parcourir(contenu.get(0) as Element, { articleVise: null, texteNumero: null, codeRubrique: null });

  return {
    uid,
    seanceRef: $('compteRendu > seanceRef').first().text().trim() || null,
    legislature,
    date,
    prises: prisesDeParole(paragraphes),
    votes: releverVotes(paragraphes),
  };
}

/** Prises de parole du compte rendu, chacune sachant si elle explique un vote. */
function prisesDeParole(paragraphes: ParagrapheBrut[]): PriseDeParoleSyceron[] {
  const explications = marquerExplicationsDeVote(paragraphes);
  return paragraphes
    .map((p, i) => enPriseDeParole(p, explications[i] ?? false))
    .filter((p): p is PriseDeParoleSyceron => p !== null);
}

function estElement(noeud: AnyNode): noeud is Element {
  return noeud.type === 'tag';
}

/** Un paragraphe tel qu'il figure au compte rendu, avec le contexte hérité. */
interface ParagrapheBrut {
  sourceUid: string;
  ordreAbsolu: number;
  codeGrammaire: string;
  valeur: string | undefined;
  /** `adt` du paragraphe : l'amendement qu'il nomme, quand il en nomme un. */
  adt: string | undefined;
  orateurRef: string | null;
  nomBrut: string;
  qualite: string;
  contenu: string;
  contexte: ContextePoint;
}

function lireParagraphe(
  $: cheerio.CheerioAPI,
  paragraphe: Element,
  contexte: ContextePoint,
): ParagrapheBrut {
  const attribs = paragraphe.attribs;
  const noeud = $(paragraphe);
  const orateur = noeud.children('orateurs').children('orateur').first();
  const idActeur = attribs['id_acteur'];
  const ordreAbsolu = Number(attribs['ordre_absolu_seance']);

  return {
    sourceUid: attribs['id_syceron'] ?? `${attribs['id_preparation'] ?? ordreAbsolu}`,
    ordreAbsolu,
    codeGrammaire: attribs['code_grammaire'] ?? '',
    valeur: attribs['valeur'],
    adt: attribs['adt'],
    orateurRef: idActeur && /^PA\d+$/.test(idActeur) ? idActeur : null,
    nomBrut: orateur.children('nom').text().trim(),
    qualite: orateur.children('qualite').text().trim(),
    contenu: nettoyer(noeud.children('texte').text()),
    contexte,
  };
}

function enPriseDeParole(p: ParagrapheBrut, dansExplicationDeVote: boolean): PriseDeParoleSyceron | null {
  if (!p.nomBrut || !Number.isFinite(p.ordreAbsolu)) return null;

  const { prenom, nom } = decouperNom(p.nomBrut);
  const estPresidence = estPresidenceDeSeance(nom);


  return {
    sourceUid: p.sourceUid,
    ordreAbsolu: p.ordreAbsolu,
    codeGrammaire: p.codeGrammaire,
    orateurRef: p.orateurRef,
    orateurNom: nom,
    orateurPrenom: prenom,
    orateurQualite: p.qualite.length > 0 ? p.qualite : null,
    contenu: p.contenu,
    articleVise: p.contexte.articleVise,
    amendementsVises: numerosAmendement(p.adt),
    texteNumero: p.contexte.texteNumero,
    codeRubrique: p.contexte.codeRubrique,
    dansExplicationDeVote,
    estPresidence,
  };
}

// =============================================================================
// SÉQUENCES D'EXPLICATIONS DE VOTE
// =============================================================================

/**
 * Annonce d'ouverture des explications de vote, au perchoir.
 *
 * Les formes relevées sur la 17e législature : « Dans les explications de
 * vote, la parole est à… », « Nous en venons aux explications de vote », « Pour
 * les explications de vote, la parole est à… ». Elles ont en commun de nommer
 * l'exercice ; les orateurs suivants, eux, sont appelés d'un simple « La parole
 * est à M. X » et ne se distinguent plus de n'importe quelle prise de parole.
 */
const ANNONCE_EXPLICATION_VOTE = /explications?\s+de\s+vote/i;

/**
 * Codes du scrutin lui-même, qui closent la séquence.
 *
 * L'AN en a trois familles — `SCR_MRJ_1_3` « Il est procédé au scrutin »,
 * `SCRUT_ART_PUB_1_6`, `SCRUPUB_SSADTS_…` — et rien ne les rassemble qu'un
 * préfixe commun.
 *
 * On ne ferme pas sur `ANN_SCR…` : cette annonce-là — « je suis saisi par le
 * groupe X d'une demande de scrutin public » — tombe au milieu des
 * explications de vote, avant que les derniers orateurs aient parlé.
 */
const CODE_SCRUTIN = /^SCR(?:UT|UPUB)?_/;

/**
 * Marque les paragraphes appartenant à une séquence d'explications de vote.
 *
 * La séquence s'ouvre sur l'annonce de la présidence et court jusqu'au
 * scrutin. Elle se ferme aussi au changement de rubrique : les explications de
 * vote se tiennent sous le `<point>` du texte débattu, et en sortir signifie
 * qu'on est passé à autre chose — garde-fou contre une séquence qui resterait
 * ouverte jusqu'à la fin de la séance faute d'avoir vu son scrutin.
 */
export function marquerExplicationsDeVote(paragraphes: ParagrapheBrut[]): boolean[] {
  const marques = new Array<boolean>(paragraphes.length).fill(false);
  let ouverte = false;
  let rubrique: string | null = null;

  for (let i = 0; i < paragraphes.length; i++) {
    const p = paragraphes[i];
    if (!p) continue;

    if (ouverte && (p.contexte.codeRubrique !== rubrique || CODE_SCRUTIN.test(p.codeGrammaire))) {
      ouverte = false;
    }

    const estPresidence = estPresidenceDeSeance(decouperNom(p.nomBrut).nom);
    if (estPresidence && ANNONCE_EXPLICATION_VOTE.test(p.contenu)) {
      ouverte = true;
      rubrique = p.contexte.codeRubrique;
      continue;
    }

    // L'annonce et les distributions de parole restent de la mécanique de
    // séance : c'est ce que disent les orateurs qui est une explication de vote.
    marques[i] = ouverte && !estPresidence;
  }

  return marques;
}

/**
 * Relève les mises aux voix en partant des proclamations chiffrées.
 *
 * Chaque proclamation est remontée jusqu'à son annonce. On ne fixe pas de
 * portée en nombre de paragraphes : la borne naturelle est la proclamation
 * précédente, qui clôt le vote d'avant. Entre les deux se glissent les
 * explications de vote et le chahut, d'où une distance qui va de 0 — annonce et
 * résultat dans le même paragraphe, 29 fois — à 46.
 *
 * Sans annonce dans cet intervalle, on n'invente rien : un résultat attribué au
 * mauvais scrutin est pire qu'un résultat absent.
 */
export function releverVotes(paragraphes: ParagrapheBrut[]): VoteAnnonceSyceron[] {
  const votes: VoteAnnonceSyceron[] = [];

  for (let i = 0; i < paragraphes.length; i++) {
    const proclamation = paragraphes[i];
    if (!proclamation) continue;
    const resultat = resultatProclame(proclamation.contenu);
    if (!resultat) continue;

    const annonce = annonceDuVote(paragraphes, i);
    if (!annonce || !Number.isFinite(annonce.ordreAbsolu)) continue;

    votes.push({
      ordreAbsolu: annonce.ordreAbsolu,
      ...cibleEtNumeros(annonce),
      articleVise: annonce.contexte.articleVise,
      texteNumero: annonce.contexte.texteNumero,
      resultat,
    });
  }

  return votes;
}

/**
 * L'annonce dont cette proclamation est le résultat.
 *
 * On remonte depuis la proclamation elle-même — elle porte parfois l'annonce
 * dans le même paragraphe — jusqu'à la proclamation précédente exclue.
 */
function annonceDuVote(
  paragraphes: ParagrapheBrut[],
  indexProclamation: number,
): ParagrapheBrut | undefined {
  for (let k = indexProclamation; k >= 0; k--) {
    const candidat = paragraphes[k];
    if (!candidat) continue;
    if (k < indexProclamation && resultatProclame(candidat.contenu)) return undefined;
    if (MISE_AUX_VOIX.test(candidat.contenu)) return candidat;
    // Second recours : l'annonce ne dit pas « je mets aux voix » mais son code
    // la désigne et son attribut `valeur` porte la cible.
    if (
      k < indexProclamation &&
      candidat.codeGrammaire.startsWith('SCRUT_') &&
      !CODE_SORT.test(candidat.codeGrammaire) &&
      (candidat.valeur ?? '').trim().length > 0
    ) {
      return candidat;
    }
  }
  return undefined;
}

/**
 * La cible d'une annonce : l'attribut `valeur` d'abord, la phrase ensuite.
 *
 * `valeur` est la déclaration de la source et prime quand elle existe. Elle est
 * vide pour tous les votes sur l'ensemble et toutes les motions, dont la cible
 * n'est pas un numéro, et parfois pour un amendement que seule la phrase nomme.
 */
function cibleEtNumeros(annonce: ParagrapheBrut): { cible: CibleDuVote; numeros: string[] } {
  const valeur = (annonce.valeur ?? '').trim();
  if (valeur.length > 0) {
    const cible = cibleDuCode(annonce.codeGrammaire);
    const numeros =
      cible === 'article'
        ? [normaliserArticle(annonce.valeur) ?? ''].filter((n) => n.length > 0)
        : numerosAmendement(annonce.valeur);
    return { cible, numeros };
  }
  return cibleDeLAnnonce(annonce.contenu) ?? { cible: cibleDuCode(annonce.codeGrammaire), numeros: [] };
}

/** Texte lisible : le compte rendu encode les exposants et les insécables. */
export function nettoyer(brut: string): string {
  return brut
    .replace(/\[\[o\]\]/g, 'o')
    // \u00A0 plutôt que le caractère lui-même : une espace insécable dans une
    // expression régulière est indiscernable d'une espace ordinaire à la lecture.
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
