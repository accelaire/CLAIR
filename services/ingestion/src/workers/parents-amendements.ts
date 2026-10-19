// =============================================================================
// Sous-amendements de l'AN : résolution de l'amendement modifié (ticket #96)
// =============================================================================
//
// L'archive AN donne, pour un sous-amendement, l'uid de l'amendement qu'il
// modifie (`amendementParentRef`, 6 978 sur 140 814 au 18/10/2026). La synchro
// l'écrit tel quel dans `amendement_parent_ref` ; cette passe le traduit en
// `amendement_parent_id`, une fois tous les amendements écrits : dans
// l'archive, un sous-amendement peut précéder son parent.
//
// Par `uid`, puis par `uid_canonique` : l'AN republie un amendement sous un
// second uid quand le texte passe en commission (cf. uidCanoniqueAmendement),
// et le parent peut être cité sous l'un ou l'autre. Jamais par numéro : un
// numéro n'est pas unique d'une lecture ou d'une version de texte à l'autre.
//
// Seule cette passe écrit `amendement_parent_id` sur les lignes de l'AN : elle
// pose la valeur voulue, null compris, et n'écrit que ce qui change.
// =============================================================================

import type { PrismaClient } from '@prisma/client';
import { uidCanoniqueAmendement } from '../utils/uid-amendement';
import { logger } from '../utils/logger';

/** L'id du parent d'après sa référence, ou null s'il n'est pas en base. */
export function parentAN(
  ref: string,
  parUid: Map<string, string>,
  parCanonique: Map<string, string>,
): string | null {
  return parUid.get(ref) ?? parCanonique.get(uidCanoniqueAmendement(ref)) ?? null;
}

export interface ResultatParents {
  references: number;
  resolus: number;
  ecrits: number;
}

export async function resoudreParentsAmendementsAN(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<ResultatParents> {
  const lignes = await prisma.$queryRaw<Array<{
    id: string; uid: string; uid_canonique: string;
    amendement_parent_ref: string | null; amendement_parent_id: string | null;
  }>>`
    SELECT id, uid, uid_canonique, amendement_parent_ref, amendement_parent_id
    FROM amendements WHERE chambre = 'assemblee'
  `;
  const parUid = new Map(lignes.map((l) => [l.uid, l.id]));
  const parCanonique = new Map(lignes.map((l) => [l.uid_canonique, l.id]));

  let references = 0;
  let resolus = 0;
  const aEcrire: Array<{ id: string; parent: string | null }> = [];
  for (const l of lignes) {
    let voulu: string | null = null;
    if (l.amendement_parent_ref) {
      references++;
      voulu = parentAN(l.amendement_parent_ref, parUid, parCanonique);
      if (voulu === l.id) voulu = null;
      if (voulu) resolus++;
    }
    if (voulu !== l.amendement_parent_id) aEcrire.push({ id: l.id, parent: voulu });
  }

  if (!options.dryRun) await ecrireParents(prisma, aEcrire);

  const resultat = { references, resolus, ecrits: aEcrire.length };
  logger.info({ ...resultat, nonResolus: references - resolus, dryRun: !!options.dryRun },
    'Sous-amendements AN : parents résolus');
  return resultat;
}

/** Pose `amendement_parent_id`, par lots, sans toucher aux lignes déjà à jour. */
export async function ecrireParents(
  prisma: PrismaClient,
  aEcrire: Array<{ id: string; parent: string | null }>,
): Promise<void> {
  const LOT = 2000;
  for (let i = 0; i < aEcrire.length; i += LOT) {
    const lot = aEcrire.slice(i, i + LOT);
    await prisma.$executeRaw`
      UPDATE amendements a SET amendement_parent_id = v.parent
      FROM UNNEST(${lot.map((e) => e.id)}::text[], ${lot.map((e) => e.parent)}::text[]) AS v(id, parent)
      WHERE a.id = v.id AND a.amendement_parent_id IS DISTINCT FROM v.parent
    `;
  }
}
