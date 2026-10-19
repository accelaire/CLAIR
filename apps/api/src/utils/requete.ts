import { z } from 'zod';

/**
 * Un booléen de chaîne de requête : `true` ou `false`, tout le reste refusé.
 *
 * Jamais `z.coerce.boolean()` : il lit « false » comme vrai, toute chaîne non
 * vide l'étant pour JavaScript. Les routes qui déclarent le paramètre dans leur
 * schéma Fastify reçoivent déjà un booléen (converti par Ajv), d'où le `true` /
 * `false` accepté aussi ; celles qui n'en déclarent pas reçoivent la chaîne.
 * `voted=false` renvoyait ainsi les seuls amendements mis aux voix.
 */
export const booleenDeRequete = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');
