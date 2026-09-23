// =============================================================================
// Le texte dont on parle : rattacher les prises de parole à leur dossier
// =============================================================================
//
// Le compte rendu de l'Assemblée déclare, sur chaque prise de parole, l'article
// discuté, l'amendement défendu, et le texte — mais le texte n'est qu'un numéro
// de dépôt : « 1364 ». Sur la fiche d'un député, le lecteur voyait donc
// « ARTICLE 2 · AMENDEMENT N° 512 » sans savoir de quelle loi il s'agit. C'était
// « Fin de vie ».
//
// POURQUOI À L'INGESTION ET PAS À LA LECTURE. Rien ne relie directement un
// numéro de texte à un dossier : la seule table qui porte les deux est
// `amendements`, dont le `texte_ref` (`PIONANR5L17BTC1364`) contient le numéro.
// Le résoudre à la volée oblige à balayer les 189 734 amendements au motif
// qu'aucun index ne peut servir une comparaison par la fin — mesuré à 5,8 s par
// requête. On le pose donc une fois, en base.
//
// DEUX SOURCES, PARCE QUE LES AMENDEMENTS NE COUVRENT QUE LA 17e. La table
// `amendements` ne porte de `texte_ref` de l'Assemblée que pour la législature
// en cours : les comptes rendus des 15e et 16e citent 703 numéros de texte dont
// aucun n'y figure, et le rattachement n'en résolvait donc pas un seul. Le
// `source_data` des dossiers, lui, contient l'arbre des actes législatifs et
// ses références de documents — 3 102 sur 2 417 dossiers de la 15e, 1 803 sur
// 1 384 de la 16e. C'est la même correspondance, disponible sans rien
// retélécharger.
//
// LA CLÉ EST (LÉGISLATURE, NUMÉRO), JAMAIS LE NUMÉRO SEUL. Les numéros de dépôt
// repartent de 1 à chaque législature : le texte n° 1364 existe en 15e, en 16e
// et en 17e. Chercher sur le numéro nu, c'est le piège qui avait déjà rattaché
// 531 scrutins des 15e et 16e à des amendements de la 17e. La législature se lit
// sur la référence elle-même (`PIONANR5L15B1234`) et, côté prise de parole, sur
// l'identifiant de son compte rendu (`CRSANR5L15S2018O1N001`).
//
// CE QUE ÇA NE COUVRE PAS. Les textes dont aucun document n'est référencé :
// textes du Sénat, textes anciens. Le compte rendu garde alors son numéro et la
// page l'affiche tel quel plutôt que d'inventer un titre.
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface OptionsLienInterventionsDossiers {
  /** Ne rien écrire ; dire ce qui serait posé. */
  dryRun?: boolean;
}

export interface ResultatLienInterventionsDossiers {
  /** Numéros de texte distincts que les comptes rendus mentionnent. */
  numerosVus: number;
  /** Numéros pour lesquels un dossier a pu être nommé. */
  numerosResolus: number;
  /** Prises de parole qui ont reçu leur dossier, ou un autre que le leur. */
  interventions: number;
  /** Parmi elles, celles qui portaient déjà un dossier — et le mauvais. */
  corrigees: number;
  /** Liens vers le dossier d'une autre législature, effacés faute de mieux. */
  effaces: number;
}

/**
 * Le numéro de dépôt contenu dans une référence de texte de l'Assemblée.
 *
 * `PIONANR5L17BTC1364` → `1364`. Le `TC` marque le texte de la commission,
 * qui porte le même numéro que le texte initial : les deux mènent au même
 * dossier, et le compte rendu ne distingue pas lequel il discute.
 */
export function numeroDuTexte(texteRef: string | null | undefined): string | null {
  if (!texteRef) return null;
  const m = /(?:BTC|B)(\d+)$/u.exec(texteRef);
  return m ? m[1]! : null;
}

/** La clé d'un texte : sa législature et son numéro de dépôt, jamais l'un sans l'autre. */
export function cleDuTexte(legislature: string | number, numero: string): string {
  return `${legislature}/${numero}`;
}

/**
 * La correspondance, en SQL, prête à être jointe.
 *
 * Deux sources complémentaires : les références de texte portées par les
 * amendements, et celles que l'arbre des actes législatifs de chaque dossier
 * contient — ce sont elles qui rendent les 15e et 16e législatures résolvables.
 * Une clé menant à plusieurs dossiers n'est pas retenue : mieux vaut un numéro
 * nu qu'un titre faux, comme pour les orateurs homonymes. Le tout est exprimé
 * là où il sert : le rattachement est une jointure, pas une boucle.
 */
const CORRESPONDANCE_SQL = Prisma.sql`
  WITH par_amendement AS (
    SELECT DISTINCT
           substring(a.texte_ref from 'ANR5L([0-9]+)B') AS legislature,
           substring(a.texte_ref from 'B(?:TC)?([0-9]+)$') AS numero,
           a.dossier_id
    FROM amendements a
    WHERE a.texte_ref ~ 'ANR5L[0-9]+B(?:TC)?[0-9]+$'
      AND a.dossier_id IS NOT NULL
  ),
  par_dossier AS (
    SELECT DISTINCT
           substring(r.ref from 'ANR5L([0-9]+)B') AS legislature,
           substring(r.ref from 'B(?:TC)?([0-9]+)$') AS numero,
           d.id AS dossier_id
    FROM dossiers_legislatifs d,
         LATERAL regexp_matches(d.source_data::text, '([A-Z]+ANR5L[0-9]+B(?:TC)?[0-9]+)', 'g') AS m(parts),
         LATERAL (SELECT m.parts[1]) AS r(ref)
    WHERE d.source_data IS NOT NULL
  ),
  candidats AS (
    SELECT * FROM par_amendement
    UNION
    SELECT * FROM par_dossier
  ),
  -- Un dossier de l'Assemblée porte sa législature dans son uid (\`DLR5L17N…\`)
  -- et n'en change jamais. Une référence d'une autre législature qui y mène
  -- est une erreur d'amont : 518 amendements de la 17e étaient rattachés à
  -- « Bioéthique » (15e) ou à un dossier de la 16e, et faisaient pointer vers
  -- eux les débats de la 17e sur les mêmes numéros.
  coherents AS (
    SELECT c.*
    FROM candidats c
    JOIN dossiers_legislatifs d ON d.id = c.dossier_id
    WHERE d.uid NOT LIKE 'DLR5L%'
       OR substring(d.uid from 'DLR5L([0-9]+)N') = c.legislature
  )
  SELECT legislature, numero, min(dossier_id) AS dossier_id
  FROM coherents
  GROUP BY legislature, numero
  HAVING count(DISTINCT dossier_id) = 1
`;

export async function lierInterventionsAuxDossiers(
  options: OptionsLienInterventionsDossiers = {}
): Promise<ResultatLienInterventionsDossiers> {
  // UNE SEULE PASSE, PAS UNE PAR NUMÉRO. La version précédente lançait un
  // `updateMany` par numéro de texte en s'annonçant couverte par « l'index sur
  // texte_numero » — cet index n'existe pas. Chacune des 480 mises à jour
  // balayait donc les 1,4 million de lignes de la table, depuis un poste
  // distant. La correspondance est une jointure : on la joint.
  //
  // La jointure est à GAUCHE, et c'est tout l'intérêt de ce dénombrement. Une
  // jointure interne ne rend que des numéros résolus : compter « vus » et
  // « résolus » dessus donnait deux fois le même nombre, et le rapport
  // annonçait 100 % de couverture quoi qu'il arrive — précisément le chiffre
  // censé signaler une régression du rattachement.
  const aFaire = await prisma.$queryRaw<
    Array<{
      legislature: string | null;
      vus: bigint;
      resolus: bigint;
      interventions: bigint;
      corrigees: bigint;
      effaces: bigint;
    }>
  >`
    WITH correspondance AS (${CORRESPONDANCE_SQL})
    SELECT substring(i.seance_uid from 'CRSANR5L([0-9]+)') AS legislature,
           count(DISTINCT i.texte_numero) AS vus,
           count(DISTINCT c.numero) AS resolus,
           count(*) FILTER (WHERE i.dossier_id IS DISTINCT FROM c.dossier_id
                              AND c.numero IS NOT NULL) AS interventions,
           count(*) FILTER (WHERE i.dossier_id <> c.dossier_id) AS corrigees,
           -- Ce que l'effacement final retirera : un lien vers une autre
           -- législature que la correspondance ne remplace pas.
           count(*) FILTER (WHERE c.numero IS NULL
                              AND i.chambre = 'assemblee'
                              AND d.uid LIKE 'DLR5L%'
                              AND substring(i.seance_uid from 'CRSANR5L([0-9]+)')
                                  <> substring(d.uid from 'DLR5L([0-9]+)N')) AS effaces
    FROM interventions i
    LEFT JOIN correspondance c
      ON c.numero = i.texte_numero
     AND c.legislature = substring(i.seance_uid from 'CRSANR5L([0-9]+)')
    LEFT JOIN dossiers_legislatifs d ON d.id = i.dossier_id
    WHERE i.texte_numero IS NOT NULL
    GROUP BY 1
  `;

  const resultat: ResultatLienInterventionsDossiers = {
    numerosVus: aFaire.reduce((n, l) => n + Number(l.vus), 0),
    numerosResolus: aFaire.reduce((n, l) => n + Number(l.resolus), 0),
    interventions: aFaire.reduce((n, l) => n + Number(l.interventions), 0),
    corrigees: aFaire.reduce((n, l) => n + Number(l.corrigees), 0),
    effaces: aFaire.reduce((n, l) => n + Number(l.effaces), 0),
  };

  if (options.dryRun) {
    logger.info(resultat, 'Rattachement des prises de parole à leur dossier (simulation)');
    return resultat;
  }

  // La législature est comparée des deux côtés : les numéros de dépôt repartent
  // de 1 à chaque législature, et le texte n° 1364 existe en 15e, en 16e ET en
  // 17e. C'est le piège qui avait rattaché 531 scrutins des 15e et 16e à des
  // amendements de la 17e.
  //
  // LA PASSE CONVERGE, ELLE NE SE CONTENTE PAS DE COMBLER. Elle n'écrivait que
  // là où le dossier était vide : les liens posés par une version antérieure,
  // sans garde de législature, n'étaient donc jamais revus. 53 093 prises de
  // parole des 15e et 16e restaient rattachées à des dossiers d'une AUTRE
  // législature — « Fin de vie » (17e) portait les débats de 2019 sur
  // l'engagement dans la vie locale. On réécrit donc tout lien qui diffère de
  // la correspondance, et seulement ceux-là.
  //
  // Un lien que la correspondance ne sait plus nommer (numéro devenu ambigu)
  // est laissé tel quel : l'effacer chaque nuit ferait dépendre les fiches d'un
  // `source_data` momentanément incomplet. Sauf s'il mène à une autre
  // législature : celui-là est faux quoi qu'en dise la source (voir plus bas).
  const modifiees = await prisma.$executeRaw`
    WITH correspondance AS (${CORRESPONDANCE_SQL})
    UPDATE interventions i
    SET dossier_id = c.dossier_id
    FROM correspondance c
    WHERE c.numero = i.texte_numero
      AND c.legislature = substring(i.seance_uid from 'CRSANR5L([0-9]+)')
      AND i.texte_numero IS NOT NULL
      AND i.dossier_id IS DISTINCT FROM c.dossier_id
  `;
  resultat.interventions = modifiees;

  // Ce qui reste rattaché au dossier d'une autre législature n'a pas de bon
  // dossier connu : un numéro nu vaut mieux qu'un titre faux. La législature
  // du compte rendu se lit sur son uid, celle du dossier sur le sien, sans
  // rien demander à la correspondance.
  resultat.effaces = await prisma.$executeRaw`
    UPDATE interventions i
    SET dossier_id = NULL
    FROM dossiers_legislatifs d
    WHERE d.id = i.dossier_id
      AND i.chambre = 'assemblee'
      AND i.seance_uid LIKE 'CRSANR5L%'
      AND d.uid LIKE 'DLR5L%'
      AND substring(i.seance_uid from 'CRSANR5L([0-9]+)')
          <> substring(d.uid from 'DLR5L([0-9]+)N')
  `;

  logger.info(resultat, 'Rattachement des prises de parole à leur dossier terminé');
  return resultat;
}
