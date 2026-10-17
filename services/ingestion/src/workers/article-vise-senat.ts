// =============================================================================
// Article visé des amendements du Sénat, depuis le dump AMELI
// =============================================================================
//
// Le CSV par texte renseigne l'article visé ; le chemin AMELI ne le faisait
// pas. Relevé le 14/10/2026 : 17 011 amendements du Sénat sur 66 849 avaient un
// `article_vise`, presque tous venus du CSV. Les ~50 000 rows `SENAT-AMD-{id}`
// du full sync AMELI n'en avaient aucun, alors que le dump le donne pour 94 %
// de ses amendements (`amd.subid` → table `sub`).
//
// Ce passage comble les `article_vise` nuls, et seulement eux : une valeur déjà
// écrite vient du CSV, qui fait foi quand AMELI rattache l'amendement à une
// autre subdivision. Il tourne chaque nuit après la synchro CSV, sur le dump
// qu'elle a déjà lu, et se lance seul par `fill-article-vise-senat`.
// =============================================================================

import { Prisma, type PrismaClient } from '@prisma/client';
import { normalizeSenatNumero } from '../sources/senat/amendements-client';
import { logger } from '../utils/logger';

export interface ArticlesVisesAmeli {
  texteMapping: Map<number, { num: string; session: string }>;
  articlesVisesByKey: Map<string, string>;
  articlesVisesByAmdId: Map<number, string>;
}

export interface AmendementSansArticle {
  uid: string;
  numero: string;
  texteRef: string | null;
}

/**
 * L'article visé d'un amendement du Sénat selon AMELI, ou `null`.
 *
 * Une row `SENAT-AMD-{id}` porte l'id AMELI : la correspondance est exacte.
 * Les rows du CSV (`SENAT-AMD-S…`, `SENAT-AMD-T…`) passent par la clé
 * `session/texteNum:numero` des cosignataires, retrouvée depuis leur
 * `texte_ref`.
 */
export function articleViseAmeli(amd: AmendementSansArticle, ameli: ArticlesVisesAmeli): string | null {
  const idAmeli = /^SENAT-AMD-(\d+)$/.exec(amd.uid);
  if (idAmeli) return ameli.articlesVisesByAmdId.get(Number(idAmeli[1])) ?? null;

  const texteId = /^SENAT-TXT-(\d+)$/.exec(amd.texteRef ?? '');
  if (!texteId) return null;
  const texte = ameli.texteMapping.get(Number(texteId[1]));
  if (!texte) return null;
  return ameli.articlesVisesByKey.get(`${texte.session}/${texte.num}:${normalizeSenatNumero(amd.numero)}`) ?? null;
}

export interface ResultatArticlesVises {
  sansArticle: number;
  remplis: number;
}

/** Comble les `article_vise` nuls des amendements du Sénat. N'écrase jamais une valeur. */
export async function remplirArticlesVisesSenat(
  prisma: PrismaClient,
  ameli: ArticlesVisesAmeli,
  options: { dryRun?: boolean } = {},
): Promise<ResultatArticlesVises> {
  const lignes = await prisma.$queryRaw<Array<{ id: string; uid: string; numero: string; texte_ref: string | null }>>`
    SELECT id, uid, numero, texte_ref FROM amendements
    WHERE chambre = 'senat' AND article_vise IS NULL
  `;

  const aEcrire: Array<{ id: string; article: string }> = [];
  for (const l of lignes) {
    const article = articleViseAmeli({ uid: l.uid, numero: l.numero, texteRef: l.texte_ref }, ameli);
    if (article) aEcrire.push({ id: l.id, article });
  }

  if (!options.dryRun) {
    const CHUNK = 2000;
    for (let i = 0; i < aEcrire.length; i += CHUNK) {
      const lot = aEcrire.slice(i, i + CHUNK);
      // `article_vise IS NULL` est revérifié à l'écriture : une synchro CSV
      // passée entre-temps a pu poser la valeur qui fait foi.
      await prisma.$executeRaw`
        UPDATE amendements a SET article_vise = v.article
        FROM UNNEST(
          ${Prisma.sql`ARRAY[${Prisma.join(lot.map(e => e.id))}]::text[]`},
          ${Prisma.sql`ARRAY[${Prisma.join(lot.map(e => e.article))}]::text[]`}
        ) AS v(id, article)
        WHERE a.id = v.id AND a.article_vise IS NULL
      `;
    }
  }

  const resultat = { sansArticle: lignes.length, remplis: aEcrire.length };
  logger.info({ ...resultat, dryRun: !!options.dryRun }, 'Article visé des amendements Sénat comblé depuis AMELI');
  return resultat;
}
