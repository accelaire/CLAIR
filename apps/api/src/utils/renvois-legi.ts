// =============================================================================
// Renvois au droit en vigueur dans le dispositif des amendements (T5, #46)
// =============================================================================
//
// L'ingestion repère dans le dispositif d'un amendement les articles et textes
// de loi qu'il cite et les rattache à l'index de la base LEGI
// (`amendements_renvois`, services/ingestion/src/workers/renvois-legi.ts). Ici,
// ces renvois deviennent des liens Légifrance, en positions dans le dispositif
// tel que l'API le renvoie.

import type { Prisma } from '@prisma/client';

const LEGIFRANCE = 'https://www.legifrance.gouv.fr';

/** Un renvoi tel que l'ingestion l'écrit dans `amendements_renvois.renvois`. */
interface RenvoiStocke {
  debut: number;
  fin: number;
  type: 'article' | 'texte';
  article?: string;
  cid: string;
  nature: string | null;
}

/** Un renvoi tel que l'API le renvoie. */
export interface RenvoiDispositif {
  /** Positions dans `dispositif`, en unités de code UTF-16 (`String#slice`). */
  debut: number;
  fin: number;
  type: 'article' | 'texte';
  /** Identifiant Légifrance de la version de l'article citée (LEGIARTI). */
  article: string | null;
  /** Identifiant Légifrance du texte : LEGITEXT d'un code, JORFTEXT d'un texte paru au JO. */
  texte: string;
  /** Nature du texte (CODE, LOI, ORDONNANCE, DECRET, CONSTITUTION…), si l'index la connaît. */
  nature: string | null;
  url: string;
}

/**
 * Champs à ajouter au `select` d'un amendement pour en calculer les renvois.
 * `updatedAt` sert à reconnaître un calcul antérieur à la dernière
 * modification ; `avecRenvois` le retire de la réponse.
 */
export const RENVOIS_SELECT = {
  dispositif: true,
  dateDepot: true,
  updatedAt: true,
  renvoisLegi: { select: { renvois: true, calculeLe: true } },
} satisfies Prisma.AmendementSelect;

const ARTICLE = /^LEGIARTI\d{12}$/;
const TEXTE = /^(?:LEGITEXT|JORFTEXT)\d{12}$/;

/**
 * Adresse Légifrance d'un renvoi, dans la version en vigueur au dépôt de
 * l'amendement : celle que l'ingestion a retenue. Sans la date, Légifrance
 * montre la version d'aujourd'hui, même sous l'identifiant d'une version
 * ancienne (vérifié le 11/11/2026 sur l'article 793 bis du CGI, LEGIARTI000046868402).
 * Les codes et les autres textes n'ont pas le même chemin.
 */
export function urlLegifrance(
  r: Pick<RenvoiStocke, 'type' | 'article' | 'cid' | 'nature'>,
  dateDepot: Date | null,
): string | null {
  const date = dateDepot ? `/${dateDepot.toISOString().slice(0, 10)}` : '';
  const chemin = r.nature === 'CODE' ? 'codes' : 'loda';
  if (r.type === 'article') {
    return r.article && ARTICLE.test(r.article) ? `${LEGIFRANCE}/${chemin}/article_lc/${r.article}${date}` : null;
  }
  if (!TEXTE.test(r.cid)) return null;
  return r.nature === 'CODE' && r.cid.startsWith('LEGITEXT')
    ? `${LEGIFRANCE}/codes/texte_lc/${r.cid}${date}`
    : `${LEGIFRANCE}/loda/id/${r.cid}${date}`;
}

function estRenvoiStocke(r: unknown): r is RenvoiStocke {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return Number.isInteger(o.debut) && Number.isInteger(o.fin)
    && (o.type === 'article' || o.type === 'texte') && typeof o.cid === 'string';
}

/**
 * Renvois d'un dispositif, prêts à servir. Ceux qui ne tombent plus dans le
 * texte (dispositif raccourci ou effacé depuis le calcul) sont écartés, comme
 * ceux qui se chevauchent ou dont l'adresse ne peut pas être construite :
 * un lien faux est pire qu'un lien absent.
 */
export function renvoisDuDispositif(
  dispositif: string | null,
  dateDepot: Date | null,
  stockes: unknown,
): RenvoiDispositif[] {
  if (!dispositif || !Array.isArray(stockes)) return [];
  const renvois: RenvoiDispositif[] = [];
  let finPrecedente = 0;
  for (const r of [...stockes].filter(estRenvoiStocke).sort((a, b) => a.debut - b.debut)) {
    if (r.debut < finPrecedente || r.fin <= r.debut || r.fin > dispositif.length) continue;
    const url = urlLegifrance(r, dateDepot);
    if (!url) continue;
    renvois.push({
      debut: r.debut,
      fin: r.fin,
      type: r.type,
      article: r.type === 'article' ? r.article ?? null : null,
      texte: r.cid,
      nature: r.nature ?? null,
      url,
    });
    finPrecedente = r.fin;
  }
  return renvois;
}

/**
 * Remplace la relation `renvoisLegi` d'un amendement lu avec `RENVOIS_SELECT`
 * par ses renvois servis (`renvois`, tableau vide sans calcul ou sans renvoi).
 *
 * Un calcul antérieur à la dernière modification de l'amendement n'est pas
 * servi : le dispositif a pu changer, et les positions avec lui. L'étape des
 * renvois suit celle des amendements dans le batch de la nuit, et aucune étape
 * suivante n'écrit dans `amendements` : l'écart dure le temps du recalcul, ou
 * jusqu'à la nuit suivante si l'étape a échoué.
 */
export function avecRenvois<T extends {
  dispositif: string | null;
  dateDepot: Date | null;
  updatedAt: Date;
  renvoisLegi: { renvois: unknown; calculeLe: Date } | null;
}>(amendement: T): Omit<T, 'renvoisLegi' | 'updatedAt'> & { renvois: RenvoiDispositif[] } {
  const { renvoisLegi, updatedAt, ...reste } = amendement;
  const aJour = renvoisLegi != null && renvoisLegi.calculeLe >= updatedAt;
  return { ...reste, renvois: aJour ? renvoisDuDispositif(amendement.dispositif, amendement.dateDepot, renvoisLegi.renvois) : [] };
}
