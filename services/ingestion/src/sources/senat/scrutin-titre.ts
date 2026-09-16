// =============================================================================
// Ce sur quoi porte un scrutin du Sénat, lu dans son libellé
// =============================================================================
//
// Le Sénat n'expose pas l'objet de ses scrutins sous forme exploitable : ni
// référence de séance, ni numéro d'amendement en clair. Tout est dans le
// libellé, et le libellé est régulier :
//
//   « sur l'amendement n° 1363 rectifié, présenté par Mme … »
//   « sur les amendements identiques n° 3, présenté par … et n° 12 … »
//   « sur l'article 2 quater du projet de loi … »
//   « sur l'ensemble de la proposition de loi … »
//   « sur la motion n° 57, présentée par … »
//   « sur les crédits de la mission « Sport » figurant à l'état B … »
//
// Sur les 812 scrutins couverts par nos comptes rendus (16/01/2024 →
// 21/07/2026), cette lecture en classe 811. C'est elle qui porte le
// rattachement : sans la cible, le rapprochement avec les sections du débat
// tombe à 45,9 % ; avec, il atteint 98,4 %.
// =============================================================================

import { articleNumeroFromTitre } from '../../utils/article-scrutin';

/**
 * Ce que le vote tranche.
 *
 * `credits` est le vote budgétaire sur une mission, qui ne se discute pas dans
 * une section d'article mais dans le fascicule de la loi de finances.
 * `declaration` est le débat sur une déclaration du Gouvernement, qui n'a pas
 * de texte et donc pas de section propre.
 */
export type CibleDuScrutinSenat =
  | 'amendement'
  | 'sous-amendement'
  | 'article'
  | 'ensemble'
  | 'motion'
  | 'credits'
  | 'declaration'
  | 'autre';

export interface ObjetDuScrutinSenat {
  cible: CibleDuScrutinSenat;
  /** Numéros d'amendement, de sous-amendement ou de motion, normalisés. */
  numeros: string[];
  /** Article visé, à la forme de `articleNumeroFromTitre`, ou `null`. */
  article: string | null;
}

/**
 * Un numéro d'amendement du Sénat.
 *
 * Les textes budgétaires préfixent le numéro par la partie (« I-2 »,
 * « II-455 ») ou par une lettre (« A-5 ») ; la rectification s'écrit en toutes
 * lettres et peut être ordonnée (« 8 rectifié ter »).
 */
const NUMERO =
  "(?:[IVX]+-|[A-Z]-)?\\d+(?:\\s+rectifi[ée]e?)?(?:\\s+(?:bis|ter|quater|quinquies))?";

const NUMERO_CITE = new RegExp(`(?:n°\\s*|amendements?\\s+)(${NUMERO})`, 'gi');

/**
 * Met un numéro d'amendement sous sa forme d'identité.
 *
 * Une rectification ne crée pas un autre amendement : « 8 rectifié ter » et
 * « 8 » sont le même, et le compte rendu les écrit indifféremment. On retire
 * donc la mention, comme `normalizeNumero` le fait des suffixes `(Rect)` de
 * l'Assemblée.
 */
export function normaliserNumeroAmendementSenat(brut: string): string {
  return brut
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*rectifi[ée]e?.*$/i, '')
    .replace(/\s*(?:bis|ter|quater|quinquies)$/i, '')
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Clé de comparaison d'une désignation d'article entre les deux sources.
 *
 * Le Sénat accole à ses désignations un qualificatif de procédure —
 * « (priorité) », « (texte supprimé par la commission) », « (précédemment
 * réservé) », « (suite) ». Il dit l'état de l'examen, jamais l'identité de
 * l'article : deux libellés qui n'en diffèrent que par là désignent le même
 * article, et doivent se rapprocher. On les retire en bloc plutôt que
 * d'énumérer des formulations qu'on découvrirait sans fin.
 */
export function cleArticleSenat(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const cle = brut
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    // Le premier article s'écrit de trois façons selon la source : le compte
    // rendu dit « Article 1er », le libellé du scrutin « l'article 1er » — dont
    // on ne lit que le nombre — et certains textes « article premier ». Sans
    // cette mise en forme commune, 116 scrutins du Sénat perdaient leur débat.
    .replace(/^1(?:ER|ÈRE|RE)\b/, '1')
    .replace(/^PREMIER\b/, '1');
  return cle.length > 0 ? cle : null;
}

/**
 * Le libellé désigne-t-il une motion ?
 *
 * Le Sénat nomme le genre entre le mot et le numéro : « la motion
 * préjudicielle n° 42 », « la motion tendant au renvoi à la commission n° 1 ».
 */
const MOTION = /\bmotions?\b(?:\s+\S+){0,5}?\s+n°/i;

/** « l'amendement n° 8 », « les amendements identiques n° 3 … », « l'amendement 72 ». */
const AMENDEMENT = /(?:l['’]|les\s+)amendements?\b|\bamendements?\s+(?:identiques\s+)?n°/i;

export function lireTitreScrutinSenat(
  titre: string | null | undefined,
): ObjetDuScrutinSenat {
  if (!titre) return { cible: 'autre', numeros: [], article: null };

  return {
    cible: cibleDuTitre(titre),
    numeros: numerosDuTitre(titre),
    article: articleNumeroFromTitre(titre),
  };
}

/**
 * L'ordre des essais est la règle elle-même.
 *
 * Un sous-amendement se présente d'abord comme un amendement (« le
 * sous-amendement n° 9 … à l'amendement n° 884 »), et un vote sur amendement
 * nomme presque toujours l'article visé : tester l'article en premier les
 * classerait tous les deux comme des votes sur article.
 */
function cibleDuTitre(titre: string): CibleDuScrutinSenat {
  if (/\bsous-amendements?\b/i.test(titre)) return 'sous-amendement';
  if (MOTION.test(titre)) return 'motion';

  // Ce que le libellé annonce d'emblée prime sur ce qu'il mentionne ensuite.
  // Le vote bloqué de l'article 44, alinéa 3, de la Constitution se dit « sur
  // l'ensemble du texte, en ne retenant que les amendements proposés ou
  // acceptés par le Gouvernement » : c'est un vote sur l'ensemble, que le mot
  // « amendements » ferait autrement passer pour un vote sur amendement.
  if (/^\s*(?:sur\s+)?l['’]article\b/i.test(titre)) return 'article';
  if (/^\s*(?:sur\s+)?l['’]ensemble\b/i.test(titre)) return 'ensemble';

  if (AMENDEMENT.test(titre)) return 'amendement';
  if (/\bcr[ée]dits\s+de\s+la\s+mission\b|figurant\s+à\s+l['’][ée]tat\s+[A-Z]\b/i.test(titre)) {
    return 'credits';
  }
  // Une seconde délibération rouvre un article déjà voté : c'est bien sur lui
  // que le Sénat se prononce à nouveau.
  if (/seconde\s+d[ée]lib[ée]ration/i.test(titre)) return 'article';
  if (/d[ée]claration\s+du\s+Gouvernement/i.test(titre)) return 'declaration';
  return 'autre';
}

/** Tous les numéros cités, dédoublonnés, dans l'ordre d'apparition. */
function numerosDuTitre(titre: string): string[] {
  const vus = new Set<string>();
  const numeros: string[] = [];
  // `lastIndex` impose une instance neuve à chaque appel.
  const cites = new RegExp(NUMERO_CITE.source, NUMERO_CITE.flags);
  for (let m = cites.exec(titre); m !== null; m = cites.exec(titre)) {
    const numero = normaliserNumeroAmendementSenat(m[1]!);
    if (numero.length === 0 || vus.has(numero)) continue;
    vus.add(numero);
    numeros.push(numero);
  }
  return numeros;
}

export default lireTitreScrutinSenat;
