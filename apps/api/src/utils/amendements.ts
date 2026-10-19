// =============================================================================
// Métadonnées de séance des amendements (tickets #95 et #96)
// =============================================================================

import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Champs à ajouter au `select` d'un amendement partout où l'API en renvoie :
 * alinéa, discussions communes et identiques, date de modification à la
 * source, ordre d'appel, séance de discussion et, pour un sous-amendement,
 * l'amendement qu'il modifie.
 *
 * `chambre` y figure parce qu'un identifiant de discussion n'est unique qu'au
 * sein d'une chambre : retrouver les autres amendements d'une discussion
 * demande les deux.
 */
export const METADONNEES_AMENDEMENT_SELECT = {
  chambre: true,
  alinea: true,
  alineaNumero: true,
  idDiscussionCommune: true,
  positionDiscussionCommune: true,
  idDiscussionIdentique: true,
  positionDiscussionIdentique: true,
  chronotag: true,
  triAmendement: true,
  seanceDiscussionRef: true,
  amendementParentId: true,
  amendementParent: { select: { id: true, uid: true, numero: true, auteurLibelle: true } },
} satisfies Prisma.AmendementSelect;

/**
 * Ajoute `sousAmendementsCount` à chaque amendement.
 *
 * Compté après coup sur les seuls ids reçus, et non par un `_count` Prisma :
 * celui-ci agrège la table entière à chaque appel (cf. scrutins.controller).
 */
export async function avecNombreDeSousAmendements<T extends { id: string }>(
  prisma: PrismaClient,
  amendements: T[],
): Promise<Array<T & { sousAmendementsCount: number }>> {
  if (amendements.length === 0) return [];
  const comptes = await prisma.amendement.groupBy({
    by: ['amendementParentId'],
    where: { amendementParentId: { in: amendements.map((a) => a.id) } },
    _count: { _all: true },
  });
  const parParent = new Map(comptes.map((c) => [c.amendementParentId, c._count._all]));
  return amendements.map((a) => ({ ...a, sousAmendementsCount: parParent.get(a.id) ?? 0 }));
}
