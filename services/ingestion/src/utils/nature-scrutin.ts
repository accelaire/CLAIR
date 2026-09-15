// =============================================================================
// Nature d'un scrutin — sur QUOI porte le vote
// =============================================================================
//
// `typeVote` (solennel / ordinaire / motion) décrit COMMENT on vote : c'est le
// mode de scrutin, fourni par l'Assemblée dans `typeVote.codeTypeVote`. Il ne dit
// rien de l'objet voté — 99 % des scrutins sont « ordinaires », qu'ils portent sur
// un amendement de séance ou sur l'adoption finale d'une loi.
//
// Ni l'AN ni le Sénat ne publient l'objet sous forme machine : la seule donnée
// disponible est `objet.libelle`, une phrase en français. Elle est en revanche très
// stéréotypée (« l'amendement n° 212 de Mme Santiago à l'article 2 de… », « sur
// l'ensemble du projet de loi… »), ce qui rend une classification par motifs fiable :
// 99,5 % des 21 731 scrutins de production tombent dans une nature explicite.
//
// Le libellé Sénat est préfixé de « sur », l'AN non ; les deux chambres se
// distinguent aussi par les accents, les apostrophes typographiques et quelques
// coquilles de saisie (« sous-amendmeent », « amenedement »). D'où l'étape de
// normalisation avant toute comparaison.

/** Natures reconnues. `autre` est le fourre-tout, jamais une erreur. */
export const NATURES_SCRUTIN = [
  'ensemble',
  'article',
  'amendement',
  'credits',
  'motion',
  'declaration',
  'autre',
] as const;

export type NatureScrutin = (typeof NATURES_SCRUTIN)[number];

/**
 * Normalise un libellé d'objet pour la comparaison :
 * minuscules, accents retirés, apostrophes typographiques uniformisées,
 * espaces compactés, préfixe « sur » du Sénat retiré.
 */
function normaliser(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents combinants
    .toLowerCase()
    .replace(/[‘’ʼ´`]/g, "'") // ’ ‘ ʼ ´ ` → '
    .replace(/\s+/g, ' ')
    .trim()
    // « qur l'amendement… » : la coquille existe telle quelle dans les données Sénat.
    .replace(/^[sq]ur\s+/, '')
    // Renvoi partitif vers un autre objet : « le III de l'amendement n° 1180 »,
    // « le paragraphe II bis de l'article 22 bis ». Ce qui compte est ce sur quoi
    // pointe le renvoi, pas le fragment — on retire la tête et on classe la cible.
    .replace(/^(?:le |la |les )?(?:paragraphe |alinea )?[ivx]+(?: bis| ter| quater)? de /, '')
    .trim();
}

// Bruit de tête : déterminants, contractions et quantièmes qui précèdent le mot
// porteur de sens. « les quatre amendements n° 330… » et « a l'article 55 du… »
// doivent se ramener à « amendements… » / « article 55… ».
// L'espace après l'apostrophe (« sur l' amendement n° 82 ») vient de la saisie Sénat.
const DETERMINANT = "(?:a |de |d')?(?:l' ?|le |la |les |des |du |aux |un |une |ce |cet |cette )";
const QUANTIEME = '(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\\d+) ';

/** Ancre un motif au début du libellé, en tolérant déterminants et quantièmes. */
function tete(motif: string): RegExp {
  return new RegExp(`^(?:${DETERMINANT})*(?:${QUANTIEME})?(?:${DETERMINANT})*(?:${motif})`);
}

// « amend » couvre amendement / amendements / amendmeent (coquille AN) ;
// « amened » couvre amenedement. Le préfixe « sous- » reste dans la même nature :
// un sous-amendement est un amendement du point de vue de l'utilisateur.
const AMENDEMENT = tete("(?:sous[- ]?)?(?:amend|amened)");
// Le « r » facultatif absorbe la coquille « l'aticle 6 du projet de loi » (AN).
const ARTICLE = tete('ar?ticles?\\b');
const CREDITS = tete('credits\\b');
const MOTION = tete(
  "motions?\\b|question prealable|exception d'irrecevabilite|renvoi (?:en|a la) commission|(?:demande de )?seconde deliberation",
);
// Art. 49-1 / 50-1 (déclarations du Gouvernement) et art. 35 (autorisation de
// prolonger une intervention des forces armées) : des votes politiques majeurs
// qui ne portent sur aucun texte, d'où leur nature propre.
const DECLARATION = tete(
  "declaration\\b" +
    "|(?:demande (?:du gouvernement )?d')?autorisation (?:de (?:la )?prolongation|de prolonger)" +
    "|(?:demande d')?approbation de la declaration",
);
const ENSEMBLE = tete(
  "ensemble\\b" +
    '|(?:premiere|deuxieme|seconde|troisieme|quatrieme) partie\\b' +
    '|propositions? de (?:loi|resolution)\\b' +
    '|projet de loi\\b' +
    '|texte elabore par la commission mixte paritaire' +
    '|conclusions (?:negatives |de rejet )?de la commission',
);

// « l'article unique constituant l'ensemble de la proposition de loi » est le vote
// final d'un texte à article unique, pas un vote d'article : l'intitulé le dit.
const ARTICLE_UNIQUE_ENSEMBLE = /^(?:l'|le )?article unique constituant l'ensemble/;

// Repêchage global, appliqué seulement une fois les natures de tête écartées :
// « sur les conclusions de la commission des affaires economiques sur la motion,
// presentee par M. X » est une motion, pas un vote de conclusions de commission.
// La borne de mot évite de confondre « motion » avec « promotion ».
const MOTION_GLOBALE = /\b(?:motion|question prealable|exception d'irrecevabilite)\b/;

/**
 * Détermine sur quoi porte un scrutin à partir de son libellé d'objet.
 *
 * L'ordre des tests est significatif : les natures ancrées en tête priment sur le
 * repêchage global, sans quoi un amendement à une loi dont le titre contient
 * « motion » basculerait dans la mauvaise catégorie.
 *
 * @param objetLibelle Libellé de l'objet voté (`objet.libelle` AN, titre Sénat).
 * @param titre Repli quand l'objet est absent — le Sénat renseigne les deux à l'identique.
 */
export function classifyNatureScrutin(
  objetLibelle: string | null | undefined,
  titre?: string | null | undefined,
): NatureScrutin {
  const source = objetLibelle?.trim() || titre?.trim();
  if (!source) return 'autre';

  const o = normaliser(source);
  if (!o) return 'autre';

  if (MOTION.test(o)) return 'motion';
  if (AMENDEMENT.test(o)) return 'amendement';
  if (ARTICLE_UNIQUE_ENSEMBLE.test(o)) return 'ensemble';
  if (ARTICLE.test(o)) return 'article';
  if (CREDITS.test(o)) return 'credits';
  if (DECLARATION.test(o)) return 'declaration';
  if (MOTION_GLOBALE.test(o)) return 'motion';
  if (ENSEMBLE.test(o)) return 'ensemble';

  return 'autre';
}
