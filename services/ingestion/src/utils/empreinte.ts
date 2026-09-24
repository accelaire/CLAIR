import { createHash } from 'crypto';

/**
 * Empreinte stable d'une valeur, pour savoir si une ligne a changé depuis sa
 * dernière écriture sans relire la ligne elle-même.
 *
 * Stable veut dire : indépendante de l'ordre d'insertion des clés d'un objet,
 * et d'une date prise sous sa forme ISO. `undefined` et `null` se confondent,
 * comme en base, où Prisma n'écrit pas un champ `undefined` et où la colonne
 * reste donc à NULL.
 */
export function empreinte(valeur: unknown): string {
  return createHash('sha256').update(serialiser(valeur), 'utf8').digest('hex');
}

function serialiser(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return 'null';
  if (valeur instanceof Date) return JSON.stringify(valeur.toISOString());
  if (Array.isArray(valeur)) return `[${valeur.map(serialiser).join(',')}]`;
  if (typeof valeur === 'object') {
    const cles = Object.keys(valeur as Record<string, unknown>).sort();
    return `{${cles
      .map((c) => `${JSON.stringify(c)}:${serialiser((valeur as Record<string, unknown>)[c])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valeur);
}
