// =============================================================================
// Backfill — nature des scrutins
//
// Classe `nature_vote` à partir de `objet_libelle` pour les scrutins déjà en
// base. La colonne est nullable : NULL veut dire « pas encore classé », jamais
// « pas classable » (les libellés que le classifieur ne reconnaît pas repartent
// avec la nature `autre`). C'est ce qui rend l'opération incrémentale — on ne
// relit que ce qui manque — et rejouable sans effet de bord.
//
// Deux modes :
//   - par défaut, on ne traite que les lignes à NULL (rattrapage du cron) ;
//   - `--force` reclasse tout le corpus, à utiliser quand les règles de
//     classification changent.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { classifyNatureScrutin, NatureScrutin } from '../utils/nature-scrutin';

const prisma = new PrismaClient();

// Les scrutins sont lus par paquets pour ne pas charger 21 731 libellés d'un
// coup : la mémoire du conteneur d'ingestion est déjà le facteur limitant du
// batch de 5 h (OOM kills constatés).
const TAILLE_LOT = 2000;

export interface BackfillNatureVoteResult {
  scanned: number;
  updated: number;
  parNature: Record<string, number>;
}

export interface BackfillNatureVoteOptions {
  /** Reclasser aussi les scrutins qui ont déjà une nature. */
  force?: boolean;
}

export async function backfillNatureVote(
  options: BackfillNatureVoteOptions = {},
): Promise<BackfillNatureVoteResult> {
  const where = options.force ? {} : { natureVote: null };

  const total = await prisma.scrutin.count({ where });
  logger.info({ total, force: Boolean(options.force) }, 'Backfill nature_vote: démarrage');

  const parNature: Record<string, number> = {};
  let scanned = 0;
  let updated = 0;
  let curseur: string | undefined;

  for (;;) {
    // Pagination par `id > curseur` plutôt que par l'option `cursor` de Prisma :
    // celle-ci se traduit par `id >= curseur OFFSET 1`, et en mode incrémental la
    // ligne du curseur vient justement de quitter le `where` (sa nature n'est plus
    // NULL). L'OFFSET sauterait alors une ligne encore à traiter.
    const lot = await prisma.scrutin.findMany({
      where: { ...where, ...(curseur ? { id: { gt: curseur } } : {}) },
      select: { id: true, titre: true, objetLibelle: true, natureVote: true },
      orderBy: { id: 'asc' },
      take: TAILLE_LOT,
    });
    if (lot.length === 0) break;

    // Une écriture par nature plutôt qu'une par scrutin : 7 `updateMany` au lieu
    // de 2 000 `update`, sur une colonne sans contrainte ni relation.
    const parNatureDuLot = new Map<NatureScrutin, string[]>();
    for (const scrutin of lot) {
      const nature = classifyNatureScrutin(scrutin.objetLibelle, scrutin.titre);
      parNature[nature] = (parNature[nature] ?? 0) + 1;
      if (scrutin.natureVote === nature) continue; // déjà à jour (mode --force)
      const ids = parNatureDuLot.get(nature) ?? [];
      ids.push(scrutin.id);
      parNatureDuLot.set(nature, ids);
    }

    for (const [nature, ids] of parNatureDuLot) {
      const res = await prisma.scrutin.updateMany({
        where: { id: { in: ids } },
        data: { natureVote: nature },
      });
      updated += res.count;
    }

    scanned += lot.length;
    curseur = lot[lot.length - 1].id;
    logger.info({ scanned, total, updated }, 'Backfill nature_vote: progression');
  }

  logger.info({ scanned, updated, parNature }, 'Backfill nature_vote: terminé');
  return { scanned, updated, parNature };
}
