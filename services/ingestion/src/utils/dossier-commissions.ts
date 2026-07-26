import { asArray, isRecord, readString } from './json';

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
export function extractCommissionSaisines(sourceData: unknown): CommissionSaisine[] {
  const results: CommissionSaisine[] = [];
  const actes = isRecord(sourceData) ? sourceData.actesLegislatifs : undefined;
  if (!isRecord(actes)) return results;

  function walk(node: unknown): void {
    if (!node) return;

    for (const item of asArray(node)) {
      if (!isRecord(item)) continue;

      const code = readString(item, 'codeActe') ?? '';
      const organeRef = readString(item, 'organeRef');

      if (organeRef && /^[A-Z0-9]+-COM-FOND$/.test(code)) {
        results.push({ organeRef, role: 'fond' });
      } else if (organeRef && /^[A-Z0-9]+-COM-AVIS$/.test(code)) {
        results.push({ organeRef, role: 'avis' });
      }

      const enfants = item.actesLegislatifs;
      if (isRecord(enfants)) {
        walk(enfants.acteLegislatif);
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
