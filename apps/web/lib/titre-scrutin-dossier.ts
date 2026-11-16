// =============================================================================
// Titre d'un scrutin affiché sous son dossier
// =============================================================================

/** « … du projet de loi », « … de la proposition de loi organique », « … de la proposition de résolution ». */
const RENVOI_AU_TEXTE = /\s(?:du|de la|de l['’])\s?(?:projet|proposition)\s/i;
const LECTURE = /\(([^()]*lecture[^()]*)\)\.?\s*$/i;

/**
 * Le titre d'un scrutin sans l'intitulé de son texte, que le bloc du dossier
 * affiche déjà : « l'amendement n° 1146 de M. Balanant à l'article 30 de la
 * proposition de loi apportant une réponse… (première lecture). » devient
 * « L'amendement n° 1146 de M. Balanant à l'article 30 · première lecture ».
 *
 * Le titre complet reste celui de la page du scrutin. Un titre où l'intitulé
 * ne se repère pas (vote sur le texte lui-même, motion) est rendu tel quel.
 */
export function titreDansLeDossier(titre: string): string {
  const net = titre.trim();
  const i = net.search(RENVOI_AU_TEXTE);
  if (i <= 0) return majuscule(net.replace(/\.$/, ''));

  // Sénat : « sur l'amendement n° 304… », « sur l'ensemble du projet de loi… ».
  let tete = net.slice(0, i).replace(/^sur\s+/i, '').replace(/,\s*$/, '');
  if (/^l['’]ensemble$/i.test(tete)) tete = "l'ensemble du texte";
  const lecture = net.match(LECTURE)?.[1];
  return majuscule(tete) + (lecture ? ` · ${lecture}` : '');
}

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
