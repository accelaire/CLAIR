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
  /** `uid` AN, qui encode la délibération : `…P0D1…`, `…P0D2…`. */
  uid: string;
}

/** Le libellé du scrutin porte-t-il sur un ajout APRÈS l'article, et non dessus ? */
function viseApres(titre: string): boolean {
  return /apr[èe]s\s+l['’]article\s/i.test(titre);
}

/**
 * Délibération que le libellé du scrutin désigne.
 *
 * Une seconde délibération rouvre des articles déjà votés et renumérote ses
 * amendements à partir de 1 : sur le texte constitutionnel corse, l'amendement
 * n°3 de la première délibération et celui de la seconde visent tous deux
 * l'article unique. Seul le libellé du scrutin les sépare, et il le dit.
 */
function deliberationVisee(titre: string): 1 | 2 {
  return /(?:seconde|deuxi[èe]me|nouvelle)\s+d[ée]lib[ée]ration/i.test(titre) ? 2 : 1;
}

/** Délibération encodée dans l'uid AN, ou `null` si l'uid ne suit pas le schéma. */
function deliberationDeLUid(uid: string): number | null {
  const m = uid.match(/P0D(\d+)N/);
  return m ? Number(m[1]) : null;
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
  if (restants.length === 1) return restants[0]!;
  if (restants.length === 0) return null;

  // Même article des deux côtés : il ne reste que la délibération pour trancher.
  const deliberation = deliberationVisee(titreScrutin);
  const surLaBonneDeliberation = restants.filter(
    (c) => deliberationDeLUid(c.uid) === deliberation,
  );

  return surLaBonneDeliberation.length === 1 ? surLaBonneDeliberation[0]! : null;
}
