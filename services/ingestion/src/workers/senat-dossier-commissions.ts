// =============================================================================
// Worker — Commissions saisies des dossiers législatifs Sénat
// =============================================================================
//
// POURQUOI DU SCRAPING. Les 10 472 dossiers d'origine Sénat n'ont aucun lien
// commission : `dossier_commissions` n'est alimentée que par l'open data AN,
// qui ne couvre que les dossiers suivis par l'Assemblée.
//
// L'open data Sénat ne comble pas ce trou. La chaîne DOSLEG
// (`loi → lecture → texte.orgcod → org.senorgcod`) fonctionne mais ne couvre
// que 22 % des textes, et de façon très déséquilibrée : 1 163 dossiers pour la
// commission des lois contre 14 pour l'aménagement du territoire et 8 pour les
// affaires européennes. `texte.orgcod` n'est pas la saisine, c'est le « texte
// de la commission », qui n'existe que depuis 2009 et pour certaines
// procédures. Publier ça laisserait croire que deux commissions ne travaillent
// pas.
//
// La page HTML du dossier, elle, porte la saisine explicitement — « Commission
// des lois, saisie au fond ». Mesuré sur un tirage aléatoire de 45 dossiers :
// 56 % en portent une, avec une répartition conforme entre commissions.
//
// L'URL est déjà en base (`urlSenat`), il n'y a donc aucune découverte à faire.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { SenatDossierCommissionsClient } from '../sources/senat/dossier-commissions-client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';

const prisma = new PrismaClient();

export interface SenatDossierCommissionsResult {
  dossiersScanned: number;
  dossiersWithSaisine: number;
  linksCreated: number;
  /** Libellés rencontrés qu'aucun organe_ref ne couvre (commissions spéciales…). */
  libellesUnmapped: number;
  pagesUnreachable: number;
}

export interface SenatDossierCommissionsOptions {
  /** Nombre maximum de dossiers traités (utile pour un essai). */
  limit?: number;
  /**
   * Retraiter les dossiers qui ont déjà au moins un lien. Par défaut on les
   * saute : sur ~10 000 pages à 400 ms, un run complet coûte plus d'une heure,
   * et une saisine ne change plus une fois la lecture engagée.
   */
  force?: boolean;
}

export async function syncSenatDossierCommissions(
  options: SenatDossierCommissionsOptions = {}
): Promise<SenatDossierCommissionsResult> {
  const result: SenatDossierCommissionsResult = {
    dossiersScanned: 0,
    dossiersWithSaisine: 0,
    linksCreated: 0,
    libellesUnmapped: 0,
    pagesUnreachable: 0,
  };

  const dossiers = await prisma.dossierLegislatif.findMany({
    where: {
      uid: { startsWith: 'SENAT-' },
      urlSenat: { not: null },
      ...(options.force ? {} : { dossierCommissions: { none: {} } }),
    },
    select: { id: true, uid: true, urlSenat: true },
    // Les dossiers récents d'abord : ce sont eux qui sont consultés, et un run
    // interrompu aura au moins traité ce qui compte.
    orderBy: { dateDepot: 'desc' },
    ...(options.limit ? { take: options.limit } : {}),
  });

  logger.info(
    { dossiers: dossiers.length, force: options.force ?? false },
    'Starting Sénat dossier commissions scraping...'
  );

  // Le rattachement se fait sur `organe_ref`, jamais sur le slug : les slugs des
  // commissions Sénat ont déjà été renommés une fois, ce qui avait orphelin
  // 141 réunions.
  const commissions = await prisma.commission.findMany({
    where: { chambre: 'senat' },
    select: { id: true, organeRef: true },
  });
  const commissionByOrganeRef = new Map(
    commissions.filter((c) => c.organeRef).map((c) => [c.organeRef!, c.id])
  );

  const client = new SenatDossierCommissionsClient();

  for (const dossier of dossiers) {
    result.dossiersScanned++;

    try {
      const saisines = await client.fetchSaisines(dossier.urlSenat!);

      if (saisines === null) {
        result.pagesUnreachable++;
        continue;
      }
      if (saisines.length === 0) continue;

      result.dossiersWithSaisine++;

      for (const saisine of saisines) {
        const commissionId = commissionByOrganeRef.get(saisine.organeRef);
        if (!commissionId) {
          result.libellesUnmapped++;
          logger.debug(
            { organeRef: saisine.organeRef, uid: dossier.uid },
            'No commission for organeRef — saisine skipped'
          );
          continue;
        }

        await prisma.dossierCommission.upsert({
          where: {
            dossierId_commissionId_role: {
              dossierId: dossier.id,
              commissionId,
              role: saisine.role,
            },
          },
          create: { dossierId: dossier.id, commissionId, role: saisine.role },
          update: {},
        });
        result.linksCreated++;
      }
    } catch (err) {
      logger.warn(
        { uid: dossier.uid, error: errorMessage(err) },
        'Failed to scrape dossier commissions'
      );
      result.pagesUnreachable++;
    }

    if (result.dossiersScanned % 250 === 0) {
      logger.info(result, 'Sénat dossier commissions progress');
    }
  }

  logger.info(result, 'Sénat dossier commissions sync completed');
  return result;
}

export default syncSenatDossierCommissions;
