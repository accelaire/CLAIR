// =============================================================================
// Liens scrutin → amendement dont l'article contredit le libellé du scrutin
// =============================================================================
//
// Le libellé d'un scrutin d'amendement nomme son article (« l'amendement n° 848
// … à l'article 5 du projet de loi de financement de la sécurité sociale pour
// 2026 (nouvelle lecture) »). Quand l'amendement lié vise un autre article, le
// lien est suspect. Instruit le 10 octobre 2026 sur 156 discordances :
//
//  - 100 liens visaient un homonyme du même dossier, quand un amendement de
//    même numéro, sur l'article du libellé et déposé avant le vote, existait :
//    la première lecture du PLFSS 2026 (texte 1907) au lieu de sa nouvelle
//    lecture (texte 2141), « n° 1774 » lié au 774, « n° 408 » au 409 ;
//  - 7 liens n'avaient pas de remplaçant mais tombaient sur une lecture déjà
//    dépassée au jour du vote, ou sur un autre dossier que celui du scrutin
//    (la page AN du scrutin 7375, sur ArcelorMittal, renvoie à un autre texte) ;
//  - 49 étaient des conventions d'écriture, pas des erreurs : « à l'article
//    4 » pour un amendement « après l'article 4 », « article premier » d'un
//    texte à article unique, sous-lettres d'articles insérés en navette.
//
// D'où les trois décisions : remplacer, retirer, garder. Deux signaux
// indépendants sont exigés pour retirer sans remplaçant.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { articleLookupKeys, articleNumeroFromTitre } from '../utils/article-scrutin';
import { articleKeyFromArticleVise } from '../sources/assemblee-nationale/textes-client';

const prisma = new PrismaClient();

/** L'article de l'amendement est-il celui que nomme le libellé ? `null` : on ne sait pas comparer. */
export function articleConcorde(titreScrutin: string, articleVise: string | null): boolean | null {
  const numero = articleNumeroFromTitre(titreScrutin);
  if (!numero || !articleVise) return null;
  const vise = articleKeyFromArticleVise(articleVise);
  if (!vise) return null;
  const apres = /apr[èe]s\s+l['’]article\s/i.test(titreScrutin);
  return new Set(articleLookupKeys(numero)).has(vise.key.toUpperCase()) && vise.apres === apres;
}

/** Le numéro d'amendement que nomme le libellé (« n° 1774 »), le premier cité. */
export function numeroDuLibelle(titre: string): string | null {
  return /n[°º]\s*([A-Z]*-?\d+)/u.exec(titre)?.[1] ?? null;
}

/** Numéro de séance d'un amendement : « I-989 » et « 989 (Rect) » se lisent « 989 ». */
export function numeroDeSeance(numero: string): string {
  return numero.split(' ')[0]!.replace(/^(?:I|II|III)-(\d+)$/, '$1');
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

export interface AmendementCandidat {
  id: string;
  numero: string;
  articleVise: string | null;
  texteRef: string | null;
  dateDepot: Date | null;
  dossierId: string | null;
}

export interface LienExamine {
  scrutin: { id: string; titre: string; date: Date; dossierId: string | null };
  amendement: AmendementCandidat;
  /** Homonymes du libellé : même législature, même numéro de séance. */
  homonymes: AmendementCandidat[];
  /** Une lecture plus récente du dossier de l'amendement existait-elle au jour du vote ? */
  lecturePlusRecente: boolean;
}

export type Decision =
  | { action: 'garder'; raison: string }
  | { action: 'remplacer'; par: string }
  | { action: 'retirer'; raison: string };

/** La décision pour un lien dont l'article contredit le libellé. */
export function deciderLien(l: LienExamine): Decision {
  const vote = jour(l.scrutin.date);
  const candidats = l.homonymes.filter(
    (a) => a.id !== l.amendement.id
      && (!a.dateDepot || jour(a.dateDepot) <= vote)
      && articleConcorde(l.scrutin.titre, a.articleVise) === true,
  );
  const dansLeDossier = candidats.filter((a) => a.dossierId && a.dossierId === l.scrutin.dossierId);
  if (dansLeDossier.length === 1) return { action: 'remplacer', par: dansLeDossier[0]!.id };
  if (l.amendement.dossierId !== l.scrutin.dossierId) {
    return { action: 'retirer', raison: 'autre dossier et autre article' };
  }
  if (l.lecturePlusRecente) {
    return { action: 'retirer', raison: 'lecture dépassée au jour du vote, autre article' };
  }
  return { action: 'garder', raison: dansLeDossier.length > 1 ? 'remplaçants ambigus' : 'convention d’écriture probable' };
}

export interface ResultatDiscordants {
  comparables: number;
  discordants: number;
  remplaces: number;
  retires: number;
  gardes: number;
}

/**
 * Examine tous les liens scrutin AN → amendement et corrige ceux que
 * `deciderLien` désigne. Les décisions sont journalisées une à une.
 */
export async function corrigerLiensArticleDiscordant(options: { dryRun?: boolean } = {}): Promise<ResultatDiscordants> {
  const liens = await prisma.$queryRaw<Array<{
    sid: string; titre: string; date: Date; sd: string | null;
    aid: string; numero: string; article_vise: string | null; texte_ref: string | null; date_depot: Date | null; ad: string | null;
    legislature: number;
  }>>`
    SELECT s.id AS sid, s.titre, s.date, s.dossier_id AS sd, s.legislature,
           a.id AS aid, a.numero, a.article_vise, a.texte_ref, a.date_depot, a.dossier_id AS ad
    FROM "_AmendementToScrutin" ats
    JOIN scrutins s ON s.id = ats."B"
    JOIN amendements a ON a.id = ats."A"
    WHERE s.chambre = 'assemblee'
  `;
  const resultat: ResultatDiscordants = { comparables: 0, discordants: 0, remplaces: 0, retires: 0, gardes: 0 };
  const discordants = liens.filter((l) => {
    const c = articleConcorde(l.titre, l.article_vise);
    if (c !== null) resultat.comparables++;
    return c === false;
  });
  resultat.discordants = discordants.length;
  if (discordants.length === 0) return resultat;

  const amendements = await prisma.$queryRaw<Array<{
    id: string; numero: string; article_vise: string | null; texte_ref: string | null;
    date_depot: Date | null; dossier_id: string | null; legislature: number;
  }>>`
    SELECT id, numero, article_vise, texte_ref, date_depot, dossier_id, legislature
    FROM amendements WHERE chambre = 'assemblee'
  `;
  const parNumero = new Map<string, AmendementCandidat[]>();
  // Pour chaque dossier, les jours de dépôt de chaque texte (hors rapports).
  const depotsParDossier = new Map<string, Array<{ texteRef: string; jour: string }>>();
  for (const a of amendements) {
    const candidat: AmendementCandidat = {
      id: a.id, numero: a.numero, articleVise: a.article_vise, texteRef: a.texte_ref,
      dateDepot: a.date_depot, dossierId: a.dossier_id,
    };
    const cle = `${a.legislature}-${numeroDeSeance(a.numero)}`;
    const homonymes = parNumero.get(cle);
    if (homonymes) homonymes.push(candidat);
    else parNumero.set(cle, [candidat]);
    if (a.dossier_id && a.texte_ref && a.date_depot && !a.texte_ref.startsWith('RAPP')) {
      const liste = depotsParDossier.get(a.dossier_id) ?? [];
      liste.push({ texteRef: a.texte_ref, jour: jour(a.date_depot) });
      depotsParDossier.set(a.dossier_id, liste);
    }
  }

  for (const l of discordants) {
    const numero = numeroDuLibelle(l.titre);
    const amendement: AmendementCandidat = {
      id: l.aid, numero: l.numero, articleVise: l.article_vise, texteRef: l.texte_ref,
      dateDepot: l.date_depot, dossierId: l.ad,
    };
    const vote = jour(l.date);
    const depuis = l.date_depot ? jour(l.date_depot) : null;
    const lecturePlusRecente = !!(l.ad && depuis && (depotsParDossier.get(l.ad) ?? []).some(
      (d) => d.texteRef !== l.texte_ref && d.jour > depuis && d.jour <= vote,
    ));
    const decision = deciderLien({
      scrutin: { id: l.sid, titre: l.titre, date: l.date, dossierId: l.sd },
      amendement,
      homonymes: numero ? parNumero.get(`${l.legislature}-${numero}`) ?? [] : [],
      lecturePlusRecente,
    });
    logger.info(
      { scrutin: l.sid, amendement: l.numero, article: l.article_vise, ...decision, dryRun: !!options.dryRun },
      'Lien à l’article discordant',
    );
    if (decision.action === 'garder') { resultat.gardes++; continue; }
    if (decision.action === 'remplacer') resultat.remplaces++;
    else resultat.retires++;
    if (options.dryRun) continue;

    await prisma.$executeRaw`DELETE FROM "_AmendementToScrutin" WHERE "A" = ${l.aid} AND "B" = ${l.sid}`;
    if (decision.action === 'remplacer') {
      await prisma.$executeRaw`
        INSERT INTO "_AmendementToScrutin" ("A", "B") VALUES (${decision.par}, ${l.sid}) ON CONFLICT DO NOTHING
      `;
    }
  }

  logger.info({ ...resultat, dryRun: !!options.dryRun }, 'Liens à l’article discordant examinés');
  return resultat;
}
