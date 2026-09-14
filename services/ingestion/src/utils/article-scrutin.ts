// =============================================================================
// Rattachement d'un scrutin à l'article qu'il vise
// =============================================================================
//
// Un scrutin ne porte jamais le numéro d'article sous forme exploitable : ni
// l'Assemblée ni le Sénat ne l'exposent en clair. Il n'existe que dans le
// libellé — « l'article 15 de la proposition de loi … » pour un vote sur
// article, « l'amendement n° 1204 de M. Bentz à l'article 15 … » pour un vote
// sur amendement.
//
// L'extraire permet d'injecter le TEXTE de l'article dans le prompt du résumé,
// au lieu de son seul numéro. Sans lui, le modèle n'a rien à dire sur ce qui a
// été voté et le comble.
// =============================================================================

/**
 * Suffixes d'ordre d'un article (« 15 bis », « 15 quater A »).
 *
 * L'Assemblée insère les articles ajoutés en cours de navette entre les
 * existants plutôt que de renuméroter : « 1er bis » s'intercale entre le 1er et
 * le 2. Les ignorer confondrait deux articles distincts.
 */
const SUFFIXES_ORDINAUX = new Set([
  'bis', 'ter', 'quater', 'quinquies', 'sexies', 'septies', 'octies',
  'nonies', 'decies', 'undecies', 'duodecies', 'terdecies', 'quaterdecies',
]);

/**
 * Le numéro se lit d'un bloc, tiret compris.
 *
 * Les articles de la Constitution s'écrivent « 34-1 », « 50-1 » : n'en retenir
 * que « 34 » invente un article qui n'existe pas, et empêche surtout de
 * reconnaître la mention pour l'écarter.
 *
 * « liminaire » est le premier article des lois de finances, qui n'est pas
 * numéroté.
 */
const BASE_RE = /l['’]article\s+(\d+(?:-\d+)?|premier|unique|liminaire)/giu;

/**
 * Une norme extérieure, citée comme fondement du vote et non comme son objet.
 *
 * « en application de l'article 34-1 de la Constitution », « prévue par
 * l'article 45 de la loi organique », « en application de l'article 44,
 * alinéa 3, du Règlement » : ces mentions disent sous quel régime on vote,
 * jamais sur quoi. Les retenir rattachait une résolution du Sénat à un
 * « article 34 » de son propre texte.
 *
 * Le texte en discussion, lui, est toujours un PROJET ou une PROPOSITION de
 * loi — jamais « la loi », « le code » ou « l'ordonnance », qui désignent du
 * droit déjà en vigueur.
 */
const NORME_EXTERIEURE =
  /^\s*(?:,\s*alin[ée]as?\s+[\dA-Za-z]+\s*,?\s*)?(?:de\s+la\s+Constitution|du\s+R[èe]glement|de\s+la\s+loi\b|de\s+l['’]ordonnance\b|du\s+code\b|de\s+la\s+charte\b)/iu;

/**
 * Numéro d'article visé par un scrutin, normalisé sur la forme de
 * `amendements.article_vise` et de `textes_articles.numero`.
 *
 * Fonctionne aussi bien pour un vote sur article que pour un vote sur
 * amendement, dont le libellé cite l'article visé (« … à l'article 15 de … »).
 */
export function articleNumeroFromTitre(titre: string | null | undefined): string | null {
  if (!titre) return null;

  // On parcourt les mentions successives plutôt que de s'arrêter à la première :
  // un libellé peut invoquer le Règlement avant de nommer l'article voté.
  // `lastIndex` impose une instance neuve à chaque appel.
  const mentions = new RegExp(BASE_RE.source, BASE_RE.flags);
  for (let base = mentions.exec(titre); base !== null; base = mentions.exec(titre)) {
    // Les suffixes sont consommés un par un, et non par une alternance unique :
    // la casse les distingue de la suite de la phrase. Les ordinaux s'écrivent en
    // minuscules (« 15 bis »), les lettres de rang en majuscules (« 15 A ») — une
    // classe `[A-Z]` sous un flag insensible à la casse avalerait « de la … ».
    let rest = titre.slice(base.index + base[0].length);
    const parts = [base[1]!];
    for (;;) {
      const next = rest.match(/^\s+([A-Za-z]{1,14})\b/);
      if (!next) break;
      const token = next[1]!;
      const estOrdinal = SUFFIXES_ORDINAUX.has(token.toLowerCase());
      const estLettreDeRang = /^[A-Z]{1,2}$/.test(token);
      if (!estOrdinal && !estLettreDeRang) break;
      parts.push(token);
      rest = rest.slice(next[0].length);
    }

    if (NORME_EXTERIEURE.test(rest)) continue;
    return normalizeArticleNumero(parts.join(' '));
  }

  return null;
}

/** Met un identifiant d'article sous la forme canonique : majuscules, espaces compactés. */
export function normalizeArticleNumero(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Clés à essayer pour retrouver l'article en base, par ordre de préférence.
 *
 * L'Assemblée écrit « Article 1er » dans ses textes et « ART. PREMIER » sur ses
 * amendements, mais « l'article 1 » dans certains libellés de scrutin — les
 * trois désignent le même article. On tente donc les deux graphies plutôt que
 * de parier sur une seule.
 */
export function articleLookupKeys(numero: string): string[] {
  const key = normalizeArticleNumero(numero);
  const keys = [key];
  if (key === '1' || key.startsWith('1 ')) {
    keys.push(key.replace(/^1\b/, 'PREMIER'));
  }
  if (key === 'PREMIER' || key.startsWith('PREMIER ')) {
    keys.push(key.replace(/^PREMIER\b/, '1'));
  }
  return keys;
}

/**
 * Un scrutin porte-t-il sur l'article lui-même, plutôt que sur un amendement ?
 *
 * Le distinguer change ce qu'il faut expliquer : le contenu de l'article dans
 * un cas, ce que l'amendement y change dans l'autre.
 */
export function porteSurArticleEntier(titre: string | null | undefined): boolean {
  if (!titre) return false;
  return /^\s*l['’]article\s/i.test(titre);
}
