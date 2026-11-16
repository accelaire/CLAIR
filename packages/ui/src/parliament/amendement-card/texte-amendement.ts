import type { RenvoiDispositif } from "@clair/data";

/** Passage du texte d'un amendement : lié à Légifrance (`renvoi`) ou non. */
export type SegmentTexte = { texte: string; renvoi?: RenvoiDispositif };

/**
 * Le texte tel que les sources le publient, réduit à du texte : balises retirées (y compris les
 * balises échappées de l'Assemblée, « I< sup>er< /sup> »), `&nbsp;` et `&amp;` décodés, fins de
 * ligne normalisées. Le résultat s'affiche en texte, jamais en HTML.
 */
export const nettoyerTexteAmendement = (texte: string) =>
  texte
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\s*\/?\s*[a-zA-Z][^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

/**
 * Découpe le texte en passages, liés ou non (apps/web, `segmenterTexteAmendement`). Le découpage
 * se fait sur le texte brut, puisque les positions des renvois y renvoient ; chaque passage est
 * nettoyé ensuite. Un renvoi qui ne tombe pas dans le texte, ou en chevauche un autre, est ignoré.
 */
export const segmenterTexteAmendement = (
  texte: string,
  renvois: readonly RenvoiDispositif[] = [],
): SegmentTexte[] => {
  const bruts: SegmentTexte[] = [];
  let curseur = 0;
  for (const renvoi of [...renvois].sort((a, b) => a.debut - b.debut)) {
    if (renvoi.debut < curseur || renvoi.fin <= renvoi.debut || renvoi.fin > texte.length) {
      continue;
    }
    if (renvoi.debut > curseur) bruts.push({ texte: texte.slice(curseur, renvoi.debut) });
    bruts.push({ texte: texte.slice(renvoi.debut, renvoi.fin), renvoi });
    curseur = renvoi.fin;
  }
  if (curseur < texte.length) bruts.push({ texte: texte.slice(curseur) });

  const segments = bruts.map((segment) => ({
    ...segment,
    texte: nettoyerTexteAmendement(segment.texte),
  }));
  const dernier = segments.length - 1;
  return segments
    .map((segment, index) => {
      let propre = segment.texte;
      if (index === 0) propre = propre.trimStart();
      if (index === dernier) propre = propre.trimEnd();
      return { ...segment, texte: propre };
    })
    .filter((segment) => segment.texte !== "");
};

/** Longueur affichée des passages. */
export const longueurSegments = (segments: readonly SegmentTexte[]) =>
  segments.reduce((total, segment) => total + segment.texte.length, 0);

/**
 * Les passages coupés à `maxLength` caractères, au dernier mot entier (comme `ExpandableText`).
 * Un lien coupé reste un lien.
 */
export const tronquerSegments = (
  segments: readonly SegmentTexte[],
  maxLength: number,
): SegmentTexte[] => {
  const resultat: SegmentTexte[] = [];
  let reste = maxLength;
  for (const segment of segments) {
    if (reste <= 0) break;
    if (segment.texte.length <= reste) {
      resultat.push(segment);
      reste -= segment.texte.length;
      continue;
    }
    const coupe = segment.texte.slice(0, reste);
    const dernierBlanc = coupe.search(/\s\S*$/);
    const texte = (dernierBlanc > 0 ? coupe.slice(0, dernierBlanc) : coupe).trimEnd();
    if (texte) resultat.push({ ...segment, texte });
    break;
  }
  return resultat;
};
