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
  /** Reposer le dossier même là où il est déjà renseigné. */
  refaireTout?: boolean;
  /** Ne rien écrire ; dire ce qui serait posé. */
  dryRun?: boolean;
}

export interface ResultatLienInterventionsDossiers {
  /** Numéros de texte distincts que les comptes rendus mentionnent. */
  numerosVus: number;
  /** Numéros pour lesquels un dossier a pu être nommé. */
  numerosResolus: number;
  /** Prises de parole qui ont reçu leur dossier. */
  interventions: number;
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
 * La correspondance (législature, numéro de dépôt) → dossier.
 *
 * Elle est bâtie sur deux sources complémentaires : les références de texte
 * portées par les amendements, et celles que l'arbre des actes législatifs de
 * chaque dossier contient. Voir l'en-tête du fichier pour le pourquoi.
 *
 * Une clé qui mène à plusieurs dossiers n'est pas retenue : mieux vaut un
 * numéro nu qu'un titre faux. C'est la même règle que pour les orateurs
 * homonymes.
 */
export async function correspondanceTexteDossier(): Promise<Map<string, string>> {
  const [parAmendement, parDossier] = await Promise.all([
    prisma.$queryRaw<Array<{ legislature: string; numero: string; dossier_id: string }>>`
      SELECT DISTINCT
             substring(a.texte_ref from 'ANR5L([0-9]+)B') AS legislature,
             substring(a.texte_ref from 'B(?:TC)?([0-9]+)$') AS numero,
             a.dossier_id
      FROM amendements a
      WHERE a.texte_ref ~ 'ANR5L[0-9]+B(?:TC)?[0-9]+$'
        AND a.dossier_id IS NOT NULL
    `,
    // Les références de documents que porte l'arbre des actes législatifs du
    // dossier : c'est ce qui rend les 15e et 16e législatures résolvables.
    prisma.$queryRaw<Array<{ legislature: string; numero: string; dossier_id: string }>>`
      SELECT DISTINCT
             substring(ref from 'ANR5L([0-9]+)B') AS legislature,
             substring(ref from 'B(?:TC)?([0-9]+)$') AS numero,
             d.id AS dossier_id
      FROM dossiers_legislatifs d,
           LATERAL regexp_matches(d.source_data::text, '([A-Z]+ANR5L[0-9]+B(?:TC)?[0-9]+)', 'g') AS m(parts),
           LATERAL (SELECT m.parts[1]) AS r(ref)
      WHERE d.source_data IS NOT NULL
    `,
  ]);

  const candidats = new Map<string, Set<string>>();
  const ajouter = (l: { legislature: string; numero: string; dossier_id: string }) => {
    if (!l.legislature || !l.numero) return;
    const cle = cleDuTexte(l.legislature, l.numero);
    const vus = candidats.get(cle) ?? new Set<string>();
    vus.add(l.dossier_id);
    candidats.set(cle, vus);
  };
  for (const l of parAmendement) ajouter(l);
  for (const l of parDossier) ajouter(l);

  const resolus = new Map<string, string>();
  let ambigus = 0;
  for (const [cle, dossiers] of candidats) {
    if (dossiers.size === 1) resolus.set(cle, [...dossiers][0]!);
    else ambigus += 1;
  }
  logger.info(
    {
      parAmendement: parAmendement.length,
      parDossier: parDossier.length,
      cles: candidats.size,
      resolus: resolus.size,
      ambigus,
    },
    'Correspondance (législature, numéro de texte) → dossier construite'
  );
  return resolus;
}

/**
 * La correspondance, en SQL, prête à être jointe.
 *
 * Les deux sources et la règle d'ambiguïté sont celles de
 * `correspondanceTexteDossier`, exprimées là où elles seront utilisées : le
 * rattachement est une jointure, pas une boucle.
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
  )
  SELECT legislature, numero, min(dossier_id) AS dossier_id
  FROM candidats
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
  const aFaire = await prisma.$queryRaw<
    Array<{ legislature: string | null; numeros: bigint; interventions: bigint }>
  >`
    WITH correspondance AS (${CORRESPONDANCE_SQL})
    SELECT c.legislature,
           count(DISTINCT c.numero) AS numeros,
           count(*) AS interventions
    FROM interventions i
    JOIN correspondance c
      ON c.numero = i.texte_numero
     AND c.legislature = substring(i.seance_uid from 'CRSANR5L([0-9]+)')
    WHERE i.texte_numero IS NOT NULL
      ${options.refaireTout ? Prisma.empty : Prisma.sql`AND i.dossier_id IS NULL`}
    GROUP BY 1
  `;

  const resultat: ResultatLienInterventionsDossiers = {
    numerosVus: aFaire.reduce((n, l) => n + Number(l.numeros), 0),
    numerosResolus: aFaire.reduce((n, l) => n + Number(l.numeros), 0),
    interventions: aFaire.reduce((n, l) => n + Number(l.interventions), 0),
  };

  if (options.dryRun) {
    logger.info(resultat, 'Rattachement des prises de parole à leur dossier (simulation)');
    return resultat;
  }

  // La législature est comparée des deux côtés : les numéros de dépôt repartent
  // de 1 à chaque législature, et le texte n° 1364 existe en 15e, en 16e ET en
  // 17e. C'est le piège qui avait rattaché 531 scrutins des 15e et 16e à des
  // amendements de la 17e.
  const modifiees = await prisma.$executeRaw`
    WITH correspondance AS (${CORRESPONDANCE_SQL})
    UPDATE interventions i
    SET dossier_id = c.dossier_id
    FROM correspondance c
    WHERE c.numero = i.texte_numero
      AND c.legislature = substring(i.seance_uid from 'CRSANR5L([0-9]+)')
      AND i.texte_numero IS NOT NULL
      ${options.refaireTout ? Prisma.empty : Prisma.sql`AND i.dossier_id IS NULL`}
  `;
  resultat.interventions = modifiees;

  logger.info(resultat, 'Rattachement des prises de parole à leur dossier terminé');
  return resultat;
}
