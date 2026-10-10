// =============================================================================
// Le texte dont on parle, quand le compte rendu ne le numérote pas
// =============================================================================
//
// LE TROU. `link-interventions-dossiers.ts` rattache une prise de parole à son
// dossier par le numéro de texte que le compte rendu déclare sur elle (`bibard`
// du <point> qui l'englobe). Beaucoup de passages n'en portent pas : 259 des 615
// séances de la 17e n'ont aucun numéro, soit 82 000 prises de parole. Les deux
// séances du 8 octobre 2026, consacrées à quatre propositions de résolution,
// n'en avaient pas une. Leurs pages de séance retrouvaient le dossier par les
// votes, mais pas les pages des dossiers, qui comptent les prises de parole par
// leur `dossier_id`. Le début du débat sur l'espace Schengen, sans vote ce
// matin-là, n'était relié à rien.
//
// CE QUI NOMME LE TEXTE. La présidence ouvre chaque point : « L'ordre du jour
// appelle la discussion […] de la proposition de résolution […] visant à
// refonder l'espace Schengen […] (nos 3119). » Le point court jusqu'à l'annonce
// suivante : c'est le découpage du sommaire de séance côté API
// (`sommaire-de-seance.ts`), repris tel quel pour que la page de la séance et
// celle du dossier disent la même chose. Le numéro de dépôt de l'annonce (74 %
// des annonces en portent un) mène au dossier par la même correspondance
// (législature, numéro) que les prises numérotées. Des numéros qui mènent à
// deux dossiers (discussion commune) laissent le point sans dossier.
//
// LE NUMÉRO, ET RIEN D'AUTRE. Deux replis ont été essayés puis écartés après
// audit en dry-run sur la prod, le 9 octobre 2026 :
//  - les dossiers que le passage atteste (prises numérotées, votes) : les
//    questions au Gouvernement héritaient du texte voté juste après elles, un
//    vote solennel n'étant pas annoncé par « L'ordre du jour appelle » ;
//  - le titre annoncé, cherché parmi les titres des dossiers : sur les 1 415
//    points où numéro et titre donnaient chacun un dossier, ils divergeaient
//    70 fois, et c'était presque toujours le titre qui se trompait (un titre
//    court et voisin, « Sortie de l'état d'urgence sanitaire », retenu pour une
//    loi qui la prorogeait). Pour 45 points de plus, pas un passage sous le
//    mauvais titre : un débat sans dossier vaut mieux.
//
// SEULEMENT LÀ OÙ LE RANG EST SÛR. Le point se délimite par le rang
// (`ordre`) des prises de parole. Il doit donc être unique dans la séance : ce
// n'est pas le cas de 76 746 lignes de la 15e, dont les comptes rendus font
// repartir la numérotation en cours de document, ni d'un compte rendu encore
// provisoire (17 doublons dans celui du 8 octobre 2026 après-midi). Ces
// séances sont laissées de côté : un découpage faux rangerait les questions au
// Gouvernement sous le texte du matin.
//
// CE QUE ÇA TOUCHE. Seulement les prises de parole SANS numéro de texte : les
// autres restent à la passe par numéro, qui leur donne leur propre dossier. Sur
// ce périmètre, cette passe est seule à poser un dossier, et elle converge : un
// point dont la décision change est réécrit, y compris vers « aucun dossier ».
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/** L'ouverture d'une annonce d'ordre du jour (pendant de `ANNONCE_ORDRE_DU_JOUR`, API). */
export const ANNONCE_ORDRE_DU_JOUR = 'L’ordre du jour appelle';

/**
 * Abréviations dont le point ne termine pas une phrase (« de M. Dupont »).
 * Même règle que `titreDOrdreDuJour` côté API.
 */
const ABREVIATIONS = new Set(['M', 'MM', 'Mme', 'Mmes', 'no', 'nos', 'art', 'al', 'cf']);

/** La première phrase de l'annonce : la suite (« La parole est à… ») n'en fait plus partie. */
export function premierePhrase(contenu: string): string {
  const texte = contenu.replace(/\s+/gu, ' ').trim();
  const separateur = /\.\s*(?=[A-ZÀ-Þ«])/gu;
  let m: RegExpExecArray | null;
  while ((m = separateur.exec(texte)) !== null) {
    const avant = /([\p{L}]+)$/u.exec(texte.slice(0, m.index));
    if (avant && ABREVIATIONS.has(avant[1]!)) continue;
    return texte.slice(0, m.index);
  }
  return texte;
}

/** Les numéros de dépôt cités par l'annonce : « (no 3116) », « (nos 235, 273) ». */
export function numerosDeLAnnonce(contenu: string): string[] {
  const numeros: string[] = [];
  for (const parenthese of premierePhrase(contenu).matchAll(/\(n[o°s]+\s*([^)]*)\)/gu)) {
    for (const n of parenthese[1]!.matchAll(/\d+/gu)) numeros.push(String(Number(n[0])));
  }
  return [...new Set(numeros)];
}

/** Le dossier du point : celui que désignent tous ses numéros, s'ils n'en désignent qu'un. */
export function dossierDuPoint(dossiersDesNumeros: string[]): string | null {
  const dossiers = new Set(dossiersDesNumeros);
  return dossiers.size === 1 ? [...dossiers][0]! : null;
}

/** Les séances de l'Assemblée (syceron) dont chaque rang est porté par une seule prise. */
const SEANCES_AU_RANG_SUR = Prisma.sql`
  SELECT seance_uid FROM interventions
  WHERE seance_uid LIKE 'CRSANR5L%' AND reunion_id IS NULL
  GROUP BY seance_uid
  HAVING count(ordre) = count(DISTINCT ordre)
`;

export interface ResultatOrdreDuJour {
  /** Annonces d'ordre du jour lues, une par point. */
  points: number;
  /** Points rattachés à un dossier par leur numéro de dépôt. */
  rattaches: number;
  /** Points sans dossier : questions, nominations, débats, discussion commune. */
  sansDossier: number;
  /** Prises de parole sans numéro dont le dossier a été posé ou changé. */
  interventions: number;
  /**
   * Prises sans numéro d'une séance au rang incertain qui portaient un
   * dossier de cette passe : retirées, la passe ne sachant plus les situer.
   */
  retirees: number;
}

/**
 * Rattache les prises de parole sans numéro de texte au dossier du point
 * d'ordre du jour où elles tombent. `correspondance` est la requête
 * (législature, numéro) → dossier de `link-interventions-dossiers.ts`.
 */
export async function lierParOrdreDuJour(
  correspondance: Prisma.Sql,
  options: {
    dryRun?: boolean;
    /** Reçoit chaque décision, pour l'auditer (scripts de contrôle). */
    journal?: (point: { seanceUid: string; debut: number; contenu: string; dossierId: string | null }) => void;
  } = {},
): Promise<ResultatOrdreDuJour> {
  // Les annonces, bornées par la suivante de la même séance : le point court
  // jusqu'à elle (-1 : jusqu'à la fin de la séance).
  const annonces = await prisma.$queryRaw<
    Array<{ seance_uid: string; legislature: string; debut: number; fin: number; contenu: string }>
  >`
    SELECT seance_uid,
           substring(seance_uid from 'CRSANR5L([0-9]+)') AS legislature,
           ordre AS debut,
           COALESCE(LEAD(ordre) OVER (PARTITION BY seance_uid ORDER BY ordre), -1) AS fin,
           contenu
    FROM interventions
    WHERE seance_uid IN (${SEANCES_AU_RANG_SUR})
      AND reunion_id IS NULL
      AND est_presidence
      AND ordre IS NOT NULL
      AND contenu LIKE ${`${ANNONCE_ORDRE_DU_JOUR}%`}
  `;

  // Le dossier de chaque numéro cité, législature comprise.
  const parCle = new Map<string, string>();
  const correspondances = await prisma.$queryRaw<Array<{ legislature: string; numero: string; dossier_id: string }>>`
    ${correspondance}
  `;
  for (const c of correspondances) parCle.set(`${c.legislature}/${Number(c.numero)}`, c.dossier_id);

  const resultat: ResultatOrdreDuJour = {
    points: annonces.length,
    rattaches: 0,
    sansDossier: 0,
    interventions: 0,
    retirees: 0,
  };
  const seances: string[] = [];
  const debuts: number[] = [];
  const fins: number[] = [];
  const cibles: string[] = [];
  for (const a of annonces) {
    const dossierId = dossierDuPoint(
      numerosDeLAnnonce(a.contenu)
        .map((n) => parCle.get(`${a.legislature}/${n}`))
        .filter((id): id is string => !!id),
    );
    if (dossierId) resultat.rattaches++;
    else resultat.sansDossier++;
    options.journal?.({ seanceUid: a.seance_uid, debut: a.debut, contenu: a.contenu, dossierId });
    seances.push(a.seance_uid);
    debuts.push(a.debut);
    fins.push(a.fin);
    cibles.push(dossierId ?? '');
  }

  const decisions = Prisma.sql`
    SELECT * FROM unnest(${seances}::text[], ${debuts}::int[], ${fins}::int[], ${cibles}::text[])
      AS d(seance_uid, debut, fin, dossier_id)
  `;
  if (options.dryRun) {
    const [{ n }] = await prisma.$queryRaw<[{ n: bigint }]>`
      WITH d AS (${decisions})
      SELECT count(*) AS n
      FROM interventions i JOIN d ON i.seance_uid = d.seance_uid
       AND i.ordre >= d.debut AND (d.fin = -1 OR i.ordre < d.fin)
      WHERE i.texte_numero IS NULL AND i.reunion_id IS NULL
        AND i.dossier_id IS DISTINCT FROM NULLIF(d.dossier_id, '')
    `;
    resultat.interventions = Number(n);
    logger.info(resultat, 'Rattachement par l’ordre du jour (simulation)');
    return resultat;
  }

  resultat.interventions = await prisma.$executeRaw`
    WITH d AS (${decisions})
    UPDATE interventions i
    SET dossier_id = NULLIF(d.dossier_id, '')
    FROM d
    WHERE i.seance_uid = d.seance_uid
      AND i.ordre >= d.debut AND (d.fin = -1 OR i.ordre < d.fin)
      AND i.texte_numero IS NULL
      AND i.reunion_id IS NULL
      AND i.dossier_id IS DISTINCT FROM NULLIF(d.dossier_id, '')
  `;
  // Une séance devenue incertaine (compte rendu republié) ne garde pas ce que
  // la passe y avait posé. Sans numéro de texte, seule cette passe pose un
  // dossier : rien d'autre n'est effacé.
  resultat.retirees = await prisma.$executeRaw`
    UPDATE interventions
    SET dossier_id = NULL
    WHERE seance_uid LIKE 'CRSANR5L%'
      AND seance_uid NOT IN (${SEANCES_AU_RANG_SUR})
      AND reunion_id IS NULL
      AND texte_numero IS NULL
      AND dossier_id IS NOT NULL
  `;
  logger.info(resultat, 'Rattachement par l’ordre du jour terminé');
  return resultat;
}
