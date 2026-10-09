// Les fragments SQL de legislatures-dossier-sql.ts, sous forme `Prisma.Sql` pour
// les requêtes des workers. Voir ce module pour la règle et son histoire.

import { Prisma } from '@prisma/client';
import {
  CTE_LEGISLATURES_DOSSIER_SQL,
  CTE_TEXTE_DU_DOSSIER_SQL,
  dossierValantPourSql,
} from './legislatures-dossier-sql';

/** Définit le CTE `legislatures_dossier` : `WITH ${CTE_LEGISLATURES_DOSSIER} …`. */
export const CTE_LEGISLATURES_DOSSIER = Prisma.raw(CTE_LEGISLATURES_DOSSIER_SQL);

/** Définit le CTE `texte_du_dossier` (et son intermédiaire `textes_cites`). */
export const CTE_TEXTE_DU_DOSSIER = Prisma.raw(CTE_TEXTE_DU_DOSSIER_SQL);

/**
 * Le dossier `alias` vaut pour la législature `legislature` (expression SQL
 * écrite par le code, jamais une donnée). Suppose `legislatures_dossier`.
 */
export function dossierValantPour(alias: string, legislature: string): Prisma.Sql {
  return Prisma.raw(dossierValantPourSql(alias, legislature));
}
