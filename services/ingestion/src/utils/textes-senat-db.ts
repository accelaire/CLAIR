// Les fragments SQL de textes-senat-sql.ts, sous forme `Prisma.Sql` pour les
// requêtes des workers. Voir ce module pour la règle et son histoire.

import { Prisma } from '@prisma/client';
import { CTE_DOSSIER_DU_TEXTE_SENAT_SQL, dossierSenatPossiblePourSql, texteSenatCouvertSql } from './textes-senat-sql';

/** Définit `signet_du_texte_senat` et `dossier_du_texte_senat`. */
export const CTE_DOSSIER_DU_TEXTE_SENAT = Prisma.raw(CTE_DOSSIER_DU_TEXTE_SENAT_SQL);

/** Le texte de l'amendement `alias` a son dossier par la source. */
export function texteSenatCouvert(alias: string): Prisma.Sql {
  return Prisma.raw(texteSenatCouvertSql(alias));
}

/** Le dossier `d` peut recevoir l'amendement `a` (session du Sénat). */
export function dossierSenatPossiblePour(d: string, a: string): Prisma.Sql {
  return Prisma.raw(dossierSenatPossiblePourSql(d, a));
}
