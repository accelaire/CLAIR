// =============================================================================
// Texte d'un amendement : nettoyage et liens Légifrance du dispositif (T5, #46)
// =============================================================================

/** Renvoi au droit en vigueur repéré dans le dispositif, tel que l'API le sert. */
export interface RenvoiDispositif {
  /** Positions dans le dispositif brut, en unités de code UTF-16 (`String#slice`). */
  debut: number;
  fin: number;
  type: 'article' | 'texte';
  article: string | null;
  texte: string;
  nature: string | null;
  url: string;
}

export interface SegmentTexte {
  texte: string;
  renvoi?: RenvoiDispositif;
}

/**
 * Le texte tel que les sources le publient : quelques `&nbsp;` et balises
 * échappées (« I< sup>er< /sup> ») à l'Assemblée. Rendu en texte, jamais en
 * HTML.
 */
export function nettoyerTexteAmendement(texte: string): string {
  return texte
    .replace(/<\s*\/?\s*[a-zA-Z][^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\r\n?/g, '\n');
}

/**
 * Découpe le texte en passages, liés ou non. Le découpage se fait sur le texte
 * brut, puisque les positions des renvois y renvoient ; chaque passage est
 * nettoyé ensuite. Un renvoi qui ne tombe pas dans le texte, ou en chevauche
 * un autre, est ignoré.
 */
export function segmenterTexteAmendement(texte: string, renvois: RenvoiDispositif[] = []): SegmentTexte[] {
  const bruts: SegmentTexte[] = [];
  let curseur = 0;
  for (const r of [...renvois].sort((a, b) => a.debut - b.debut)) {
    if (r.debut < curseur || r.fin <= r.debut || r.fin > texte.length) continue;
    if (r.debut > curseur) bruts.push({ texte: texte.slice(curseur, r.debut) });
    bruts.push({ texte: texte.slice(r.debut, r.fin), renvoi: r });
    curseur = r.fin;
  }
  if (curseur < texte.length) bruts.push({ texte: texte.slice(curseur) });

  const segments = bruts.map((s) => ({ ...s, texte: nettoyerTexteAmendement(s.texte) }));
  if (segments.length > 0) {
    segments[0]!.texte = segments[0]!.texte.trimStart();
    segments[segments.length - 1]!.texte = segments[segments.length - 1]!.texte.trimEnd();
  }
  return segments.filter((s) => s.texte !== '');
}
