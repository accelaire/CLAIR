// =============================================================================
// La défense d'un amendement en séance
// =============================================================================
//
// POURQUOI. Sur la page d'un vote d'amendement, la prise de parole qu'on vient
// chercher est celle où l'auteur défend son amendement : « Il vise à… ». Elle
// était noyée dans le débat rattaché au vote, au même rang que l'avis de la
// commission ou la réplique d'un orateur, et derrière un onglet que la page
// n'ouvre pas par défaut.
//
// COMMENT ON LA RECONNAÎT. Le compte rendu de l'Assemblée annonce chaque
// défense au perchoir (« La parole est à Mme Rousseau, pour soutenir
// l'amendement no 1218 ») et l'ingestion reporte ce numéro sur la prise qui
// suit, dans `amendements_vises`. L'avis de la commission et celui du
// gouvernement ne le portent pas. Une prise hors présidence qui nomme
// l'amendement est donc sa défense.
//
// CE QUI MANQUE. Mesuré en prod le 9 octobre 2026 : 6 857 scrutins
// d'amendement de l'Assemblée ont un débat rattaché, 3 759 seulement ont une
// prise qui nomme l'amendement. Les autres sont surtout des sous-amendements
// défendus en série et des amendements « identiques suivants », dont le numéro
// n'est pas reporté. Le Sénat n'en reporte aucun. Sans défense reconnue, on
// n'en montre pas : mieux vaut ne rien mettre en avant que mettre en avant la
// mauvaise prise.
// =============================================================================

/**
 * Le numéro d'un amendement tel que le compte rendu le cite.
 *
 * La base écrit « 731 (Rect) » un amendement rectifié ; le compte rendu, lui,
 * dit « l'amendement no 731 ». Mesuré en prod : retirer la mention fait passer
 * le recoupement de 3 611 à 3 759 scrutins.
 */
export function numeroCite(numero: string): string {
  return numero.replace(/\s*\(.*$/u, '').trim();
}

interface PriseSituee {
  id: string;
  ordre: number | null;
  amendementsVises: string[] | null;
}

/**
 * Pour chaque amendement, la première prise de parole qui le défend.
 *
 * Les prises doivent être celles du débat rattaché au vote, présidence exclue :
 * le perchoir nomme l'amendement en donnant la parole, il ne le défend pas.
 * La première dans l'ordre de la séance : un amendement repris après une
 * suspension est cité de nouveau, mais c'est la présentation qu'on cherche.
 */
export function defensesDesAmendements<P extends PriseSituee>(
  amendements: Array<{ id: string; numero: string }>,
  prises: P[],
): Map<string, P> {
  const parOrdre = [...prises].sort(
    (a, b) => (a.ordre ?? Number.MAX_SAFE_INTEGER) - (b.ordre ?? Number.MAX_SAFE_INTEGER),
  );
  const defenses = new Map<string, P>();
  for (const amendement of amendements) {
    const cite = numeroCite(amendement.numero);
    if (!cite) continue;
    const defense = parOrdre.find((p) => (p.amendementsVises ?? []).includes(cite));
    if (defense) defenses.set(amendement.id, defense);
  }
  return defenses;
}
