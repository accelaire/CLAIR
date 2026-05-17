export interface CommissionSaisine {
  organeRef: string;
  role: 'fond' | 'avis';
}

/**
 * Parcourt récursivement l'arbre actesLegislatifs et extrait les saisines
 * de commission (COM-FOND et COM-AVIS).
 *
 * Piège : `acteLegislatif` peut être un objet OU un tableau selon
 * le nombre d'enfants. On normalise systématiquement en tableau.
 */
export function extractCommissionSaisines(sourceData: any): CommissionSaisine[] {
  const results: CommissionSaisine[] = [];
  const actes = sourceData?.actesLegislatifs;
  if (!actes) return results;

  function walk(node: any): void {
    if (!node) return;

    const items = Array.isArray(node) ? node : [node];

    for (const item of items) {
      const code: string = item.codeActe || '';

      if (/^[A-Z0-9]+-COM-FOND$/.test(code) && item.organeRef) {
        results.push({ organeRef: item.organeRef, role: 'fond' });
      } else if (/^[A-Z0-9]+-COM-AVIS$/.test(code) && item.organeRef) {
        results.push({ organeRef: item.organeRef, role: 'avis' });
      }

      if (item.actesLegislatifs) {
        walk(item.actesLegislatifs.acteLegislatif);
      }
    }
  }

  walk(actes.acteLegislatif);

  const seen = new Set<string>();
  return results.filter((s) => {
    const key = `${s.organeRef}:${s.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
