// =============================================================================
// Départage des amendements homonymes rattachés à un scrutin
// =============================================================================
//
// Le lien vers un amendement extrait de la page d'un scrutin AN a la forme
// `/amendements/{numeroTexte}/{organe}/{numeroAmendement}`. Ce couple ne
// désigne pas un amendement unique :
//
//   - `B3018` (texte initial) et `BTC3018` (texte de la commission) sont deux
//     textes distincts qui partagent le même numéro ;
//   - une seconde délibération renumérote ses amendements à partir de 1, sur le
//     même texte que la première.
//
// 396 couples de la 17e législature portent ainsi plusieurs amendements. Sans
// départage, c'est l'ordre de la requête qui tranchait — et le scrutin n°8429,
// « rétablissement de l'article 11 », se voyait rattacher l'amendement n°1
// portant sur l'article premier. Son résumé public décrivait donc le mauvais
// article.
//
// On départage sur le seul élément fiable dont on dispose : l'article que le
// libellé du scrutin nomme lui-même.
// =============================================================================

import { articleKeyFromArticleVise } from '../sources/assemblee-nationale/textes-client';
import { articleNumeroFromTitre, articleLookupKeys } from './article-scrutin';

export interface CandidatAmendement {
  id: string;
  dossierId: string | null;
  articleVise: string | null;
}

/** Le libellé du scrutin porte-t-il sur un ajout APRÈS l'article, et non dessus ? */
function viseApres(titre: string): boolean {
  return /apr[èe]s\s+l['’]article\s/i.test(titre);
}

/**
 * Choisit l'amendement que vise un scrutin parmi des homonymes.
 *
 * Rend `null` quand le doute subsiste. C'est délibéré : un lien faux fabrique un
 * résumé faux, publié, sur une page consultable. L'absence de lien ne coûte
 * qu'un résumé plus pauvre.
 */
export function choisirAmendement(
  candidats: CandidatAmendement[],
  titreScrutin: string,
  dossierIdScrutin: string | null,
): CandidatAmendement | null {
  // Règle historique : deux dossiers connus et différents = faux positif.
  let restants = candidats.filter(
    (c) => !(dossierIdScrutin && c.dossierId && c.dossierId !== dossierIdScrutin),
  );
  if (restants.length === 0) return null;
  if (restants.length === 1) return restants[0]!;

  const numero = articleNumeroFromTitre(titreScrutin);
  if (!numero) return null;

  const cles = new Set(articleLookupKeys(numero));
  const apres = viseApres(titreScrutin);

  restants = restants.filter((c) => {
    if (!c.articleVise) return false;
    const vise = articleKeyFromArticleVise(c.articleVise);
    if (!vise) return false;
    return vise.apres === apres && cles.has(vise.key.toUpperCase());
  });

  return restants.length === 1 ? restants[0]! : null;
}
