// =============================================================================
// Utilitaire — URL de l'édition du Journal officiel (Légifrance)
//
// L'open data ne fournit pas d'URL d'édition du JO : seulement, dans
// actesLegislatifs.infoJO, le numéro (numJO) et la date (dateJO). Légifrance
// expose l'édition du JO à l'URL stable :
//   https://www.legifrance.gouv.fr/jorf/jo/AAAA/MM/JJ/NNNN
// où NNNN est le numéro de JO zéro-paddé à 4 chiffres (format validé).
//
// On utilise la date issue de infoJO (et non le timestamp DB) pour éviter tout
// décalage de fuseau qui changerait le jour.
// =============================================================================

interface InfoJO {
  numJO: string;
  dateJO: string;
}

/** Recherche récursive du premier nœud infoJO (numJO + dateJO) dans source_data. */
function findInfoJO(node: unknown): InfoJO | null {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findInfoJO(item);
      if (found) return found;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;

  // Le nœud lui-même porte numJO + dateJO
  const numJO = obj.numJO;
  const dateJO = obj.dateJO;
  if ((typeof numJO === 'string' || typeof numJO === 'number') && typeof dateJO === 'string') {
    return { numJO: String(numJO), dateJO };
  }

  for (const key of Object.keys(obj)) {
    const found = findInfoJO(obj[key]);
    if (found) return found;
  }
  return null;
}

/**
 * Construit l'URL de l'édition du Journal officiel depuis source_data.
 * Retourne null si numJO/dateJO absents ou invalides.
 */
export function buildJournalOfficielUrl(sourceData: unknown): string | null {
  const info = findInfoJO(sourceData);
  if (!info) return null;

  const dateMatch = info.dateJO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;

  const num = info.numJO.replace(/\D/g, '').padStart(4, '0');
  if (!num || num === '0000') return null;

  const [, year, month, day] = dateMatch;
  return `https://www.legifrance.gouv.fr/jorf/jo/${year}/${month}/${day}/${num}`;
}
