// =============================================================================
// Worker — Fonctions au bureau des commissions Sénat
// =============================================================================
//
// `senateurs.json` ne dit pas QUEL RÔLE un sénateur occupe dans sa commission :
// tous les mandats de commission Sénat étaient donc créés avec `qualite:
// 'Membre'` (sync.ts). Résultat côté site : ni badge de fonction, ni bloc
// « Présidé par » sur les 8 pages de commission Sénat, alors que le front sait
// déjà les afficher dès que la donnée existe.
//
// Ce worker récupère la composition des bureaux (scraping senat.fr) et
// repositionne `mandats.qualite` en conséquence.
//
// Idempotence & réversibilité : chaque exécution recalcule l'état complet d'une
// commission. Un sénateur qui quitte le bureau est explicitement redescendu à
// « Membre » — sans ça, une fonction perdue resterait affichée indéfiniment.
//
// Le `qualite` posé ici survit aux syncs suivants : la branche `update` de la
// création des mandats Sénat (sync.ts) ne touche que `commissionId` et
// `institution`, jamais `qualite`.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { SenatBureauClient } from '../sources/senat/bureau-client';
import { SenatSenateursClient } from '../sources/senat/senateurs-client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';

const prisma = new PrismaClient();

/** Qualité par défaut d'un membre de commission sans fonction au bureau. */
const DEFAULT_QUALITE = 'Membre';

export interface SenatBureauxSyncResult {
  /** Mandats passés d'une qualité à une autre (promotions). */
  updated: number;
  /** Mandats redescendus à « Membre » (sortie du bureau). */
  reset: number;
  /** Membres de bureau sans mandat correspondant en DB. */
  unmatched: number;
  commissionsProcessed: number;
  pagesErrored: number;
  pagesUnresolved: number;
}

/**
 * Construit matricule → codes d'organismes de type COMMISSION, à partir de
 * `senateurs.json`. Sert au client à rattacher chaque page de bureau à sa
 * commission sans dépendre des URLs.
 */
async function buildCodesByMatricule(): Promise<Map<string, Set<string>>> {
  const { senateurs } = await new SenatSenateursClient().getSenateurs();

  const map = new Map<string, Set<string>>();
  for (const s of senateurs) {
    const codes = new Set<string>(
      (s.sourceData?.organismes ?? [])
        .filter((o) => o.type === 'COMMISSION' && o.code)
        .map((o) => o.code)
    );
    map.set(s.uid.toUpperCase(), codes);
  }

  logger.info({ senateurs: map.size }, 'Matricule → organismes map built');
  return map;
}

export async function syncSenatBureaux(): Promise<SenatBureauxSyncResult> {
  const result: SenatBureauxSyncResult = {
    updated: 0,
    reset: 0,
    unmatched: 0,
    commissionsProcessed: 0,
    pagesErrored: 0,
    pagesUnresolved: 0,
  };

  const codesByMatricule = await buildCodesByMatricule();
  const { bureaux, pagesErrored, pagesUnresolved } = await new SenatBureauClient().getBureaux(
    codesByMatricule
  );

  result.pagesErrored = pagesErrored;
  result.pagesUnresolved = pagesUnresolved;

  if (bureaux.length === 0) {
    logger.warn('No bureau parsed — aborting without touching mandats');
    return result;
  }

  // matricule → parlementaireId (source_id est le matricule Sénat, en majuscules)
  const senateursDb = await prisma.parlementaire.findMany({
    where: { chambre: 'senat', sourceId: { not: null } },
    select: { id: true, sourceId: true },
  });
  const idByMatricule = new Map<string, string>();
  for (const s of senateursDb) {
    if (s.sourceId) idByMatricule.set(s.sourceId.toUpperCase(), s.id);
  }

  for (const bureau of bureaux) {
    try {
      const qualiteByParlementaireId = new Map<string, string>();

      for (const membre of bureau.membres) {
        const parlementaireId = idByMatricule.get(membre.matricule);
        if (!parlementaireId) {
          logger.warn(
            { matricule: membre.matricule, organeRef: bureau.organeRef },
            'Bureau member not found in DB'
          );
          result.unmatched++;
          continue;
        }
        qualiteByParlementaireId.set(parlementaireId, membre.qualite);
      }

      if (qualiteByParlementaireId.size === 0) {
        logger.warn({ organeRef: bureau.organeRef }, 'No bureau member matched — skipping');
        continue;
      }

      // Promotions : on cible le mandat de commission en cours de ce sénateur.
      for (const [parlementaireId, qualite] of qualiteByParlementaireId) {
        const updated = await prisma.mandat.updateMany({
          where: {
            parlementaireId,
            organeRef: bureau.organeRef,
            dateFin: null,
            qualite: { not: qualite },
          },
          data: { qualite },
        });
        result.updated += updated.count;
      }

      // Sorties du bureau : tout mandat en cours de cette commission qui porte
      // encore une fonction alors que son titulaire n'est plus listé.
      const reset = await prisma.mandat.updateMany({
        where: {
          organeRef: bureau.organeRef,
          dateFin: null,
          qualite: { not: DEFAULT_QUALITE },
          parlementaireId: { notIn: [...qualiteByParlementaireId.keys()] },
        },
        data: { qualite: DEFAULT_QUALITE },
      });
      result.reset += reset.count;

      result.commissionsProcessed++;
      logger.debug(
        { organeRef: bureau.organeRef, membres: qualiteByParlementaireId.size, reset: reset.count },
        'Bureau synced'
      );
    } catch (err) {
      logger.error(
        { organeRef: bureau.organeRef, error: errorMessage(err) },
        'Failed to sync bureau'
      );
      result.pagesErrored++;
    }
  }

  logger.info(result, 'Sénat bureaux sync completed');
  return result;
}

export default syncSenatBureaux;
