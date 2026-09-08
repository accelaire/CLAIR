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
  /** Numéros d'amendement nommés par ce paragraphe (souvent vide). */
  amendementsVises: string[];
  /** Numéro du texte en discussion, tiré de `bibard`. */
  texteNumero: string | null;
  /** Vrai pour la mécanique de séance (« La parole est à… »), à ne pas afficher. */
  estPresidence: boolean;
}

/** Une mise aux voix annoncée au perchoir : la charnière vers nos scrutins. */
export interface VoteAnnonceSyceron {
  ordreAbsolu: number;
  cible: 'article' | 'amendement' | 'sous-amendement';
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
// On s'ancre donc sur ce qui ne varie pas : la proclamation chiffrée, dont le
// libellé est stable (« Nombre de votants … Pour l'adoption … Contre … »).
// L'annonce est le dernier paragraphe `SCRUT_` porteur d'une cible qui la
// précède. Sur la 17e législature, cette règle relève 7 699 mises aux voix là
// où l'énumération des trois codes les plus courants n'en voyait que 5 148.

/** Distance arrière maximale entre une proclamation et son annonce. */
const PORTEE_ANNONCE = 5;

/** Codes portant le sort d'un vote (« L'amendement n'est pas adopté ») : ils
 *  suivent la proclamation et ne doivent jamais être pris pour une annonce. */
const CODE_SORT = /_1_(?:5|9|10|100)$/;

/** Ce sur quoi porte une mise aux voix, lu dans la famille du code. */
function cibleDuCode(code: string): VoteAnnonceSyceron['cible'] {
  if (code.includes('SOUS_AMEND')) return 'sous-amendement';
  if (code.includes('_ART')) return 'article';
  return 'amendement';
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

  parcourir(contenu.get(0) as Element, { articleVise: null, texteNumero: null });

  return {
    uid,
    seanceRef: $('compteRendu > seanceRef').first().text().trim() || null,
    legislature,
    date,
    prises: paragraphes.map(enPriseDeParole).filter((p): p is PriseDeParoleSyceron => p !== null),
    votes: releverVotes(paragraphes),
  };
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
    orateurRef: idActeur && /^PA\d+$/.test(idActeur) ? idActeur : null,
    nomBrut: orateur.children('nom').text().trim(),
    qualite: orateur.children('qualite').text().trim(),
    contenu: nettoyer(noeud.children('texte').text()),
    contexte,
  };
}

function enPriseDeParole(p: ParagrapheBrut): PriseDeParoleSyceron | null {
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
    amendementsVises: numerosAmendement(p.valeur),
    texteNumero: p.contexte.texteNumero,
    estPresidence,
  };
}

/**
 * Relève les mises aux voix en partant des proclamations chiffrées.
 *
 * Chaque proclamation est remontée jusqu'à son annonce — le dernier paragraphe
 * `SCRUT_` porteur d'une cible qui la précède, en écartant les codes de sort
 * qui closent le vote précédent. Sans annonce à portée, on n'invente rien : un
 * résultat attribué au mauvais scrutin est pire qu'un résultat absent.
 */
export function releverVotes(paragraphes: ParagrapheBrut[]): VoteAnnonceSyceron[] {
  const votes: VoteAnnonceSyceron[] = [];

  for (let i = 0; i < paragraphes.length; i++) {
    const proclamation = paragraphes[i];
    if (!proclamation) continue;
    const resultat = resultatProclame(proclamation.contenu);
    if (!resultat) continue;

    let annonce: ParagrapheBrut | undefined;
    for (let k = i - 1; k >= 0 && k >= i - PORTEE_ANNONCE; k--) {
      const candidat = paragraphes[k];
      if (!candidat) continue;
      const cible = (candidat.valeur ?? '').trim();
      if (!candidat.codeGrammaire.startsWith('SCRUT_')) continue;
      if (CODE_SORT.test(candidat.codeGrammaire)) continue;
      if (cible.length === 0) continue;
      annonce = candidat;
      break;
    }
    if (!annonce || !Number.isFinite(annonce.ordreAbsolu)) continue;

    const cible = cibleDuCode(annonce.codeGrammaire);
    const numeros =
      cible === 'article'
        ? [normaliserArticle(annonce.valeur) ?? ''].filter((n) => n.length > 0)
        : numerosAmendement(annonce.valeur);

    votes.push({
      ordreAbsolu: annonce.ordreAbsolu,
      cible,
      numeros,
      articleVise: annonce.contexte.articleVise,
      texteNumero: annonce.contexte.texteNumero,
      resultat,
    });
  }

  return votes;
}

/** Texte lisible : le compte rendu encode les exposants et les insécables. */
export function nettoyer(brut: string): string {
  return brut
    .replace(/\[\[o\]\]/g, 'o')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
