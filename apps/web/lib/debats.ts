// =============================================================================
// Lecture d'un débat : le découper comme la séance l'a mené
// =============================================================================
//
// Le compte rendu de l'Assemblée déclare, sur chaque prise de parole, le texte
// en discussion, l'article examiné et l'amendement défendu. Une liste à plat
// perd cette structure : on y lit cinquante prises de parole d'affilée sans
// savoir laquelle répond à laquelle, ni sur quoi porte le passage qu'on lit.
//
// Le regroupement suit l'ordre de la séance au lieu de le recomposer : un
// débat se déroule, il ne se trie pas. Deux passages sur le même article, de
// part et d'autre d'un autre sujet, restent donc deux passages distincts —
// c'est ainsi que la séance s'est tenue.

/** Ce qu'il faut d'une prise de parole pour la situer dans le débat. */
export interface InterventionSituee {
  articleVise?: string | null;
  amendementsVises?: string[] | null;
  texteNumero?: string | null;
}

export interface GroupeDeDebat<T> {
  /** Stable au sein d'une liste : sert de clé de rendu. */
  cle: string;
  /** L'intertitre à afficher, ou `null` quand la séance ne dit rien. */
  titre: string | null;
  interventions: T[];
}

/**
 * Découpe une suite de prises de parole en passages consécutifs de même sujet.
 *
 * Le sujet est l'amendement quand il est nommé, l'article sinon. Les prises de
 * parole que le compte rendu ne situe pas forment leurs propres passages, sans
 * intertitre : mieux vaut ne rien annoncer que d'annoncer à tort.
 */
export function grouperParSujet<T extends InterventionSituee>(
  interventions: T[],
): GroupeDeDebat<T>[] {
  const groupes: GroupeDeDebat<T>[] = [];

  for (const intervention of interventions) {
    const cle = cleDuSujet(intervention);
    const dernier = groupes[groupes.length - 1];

    if (dernier && dernier.cle.startsWith(`${cle}#`)) {
      dernier.interventions.push(intervention);
      continue;
    }

    groupes.push({
      // Le rang suffixé distingue deux passages sur le même article séparés
      // par un autre sujet, que React confondrait sous une clé identique.
      cle: `${cle}#${groupes.length}`,
      titre: titreDuSujet(intervention),
      interventions: [intervention],
    });
  }

  return groupes;
}

function cleDuSujet(i: InterventionSituee): string {
  const amendements = (i.amendementsVises ?? []).join(',');
  return `${i.articleVise ?? ''}|${amendements}`;
}

function titreDuSujet(i: InterventionSituee): string | null {
  const article = libelleArticle(i.articleVise);
  const amendements = i.amendementsVises ?? [];

  if (amendements.length > 0) {
    const numeros = amendements.map((n) => `n° ${n}`).join(', ');
    const libelle = amendements.length > 1 ? `Amendements ${numeros}` : `Amendement ${numeros}`;
    return article ? `${article} · ${libelle}` : libelle;
  }

  return article;
}

/**
 * `"15"` → `"Article 15"`, `"unique"` → `"Article unique"`.
 *
 * Le compte rendu écrit le rang tel qu'il le prononce — « unique », « 1er »,
 * « 4 bis » — et on le reprend sans chercher à le normaliser.
 */
function libelleArticle(article: string | null | undefined): string | null {
  if (!article) return null;
  const propre = article.trim();
  if (propre.length === 0) return null;
  return /^article\b/i.test(propre) ? propre : `Article ${propre}`;
}
