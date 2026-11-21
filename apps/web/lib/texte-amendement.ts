// =============================================================================
// Texte d'un amendement : nettoyage et liens Légifrance (T5, #46)
// =============================================================================

/** Renvoi au droit en vigueur repéré dans le dispositif ou l'exposé, tel que l'API le sert. */
export interface RenvoiDroit {
  /** Positions dans le texte brut qui le porte, en unités de code UTF-16 (`String#slice`). */
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
  renvoi?: RenvoiDroit;
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
export function segmenterTexteAmendement(
  texte: string,
  renvois: RenvoiDroit[] = [],
  { compact = false }: { compact?: boolean } = {},
): SegmentTexte[] {
  const bruts: SegmentTexte[] = [];
  let curseur = 0;
  for (const r of [...renvois].sort((a, b) => a.debut - b.debut)) {
    if (r.debut < curseur || r.fin <= r.debut || r.fin > texte.length) continue;
    if (r.debut > curseur) bruts.push({ texte: texte.slice(curseur, r.debut) });
    bruts.push({ texte: texte.slice(r.debut, r.fin), renvoi: r });
    curseur = r.fin;
  }
  if (curseur < texte.length) bruts.push({ texte: texte.slice(curseur) });

  // Compact (carte repliée, coupée à trois lignes) : sans les lignes vides
  // entre paragraphes, qui prenaient une des trois lignes pour rien.
  const segments = bruts.map((s) => {
    const net = nettoyerTexteAmendement(s.texte);
    return { ...s, texte: compact ? net.replace(/\n\s*\n/g, '\n') : net };
  });
  if (segments.length > 0) {
    segments[0]!.texte = segments[0]!.texte.trimStart();
    segments[segments.length - 1]!.texte = segments[segments.length - 1]!.texte.trimEnd();
  }
  return segments.filter((s) => s.texte !== '');
}
