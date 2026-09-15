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
// CE QUE ÇA COUVRE. 157 numéros de texte sur les 226 que la 17e législature
// mentionne, soit 95 634 prises de parole sur 107 936 (88,6 %). Les 69 numéros
// restants sont des textes dont aucun amendement n'est en base : textes du
// Sénat, textes anciens, ou textes sans amendement. Le compte rendu garde son
// numéro et la page l'affiche tel quel plutôt que d'inventer un titre.
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

/**
 * La correspondance numéro de texte → dossier, construite depuis les amendements.
 *
 * Un même numéro peut mener à plusieurs dossiers quand deux textes de
 * législatures différentes le partagent — les numéros de dépôt repartent de 1 à
 * chaque législature. On ne retient alors rien : mieux vaut un numéro nu qu'un
 * titre faux. C'est la même règle que pour les orateurs homonymes.
 */
export async function correspondanceTexteDossier(): Promise<Map<string, string>> {
  const lignes = await prisma.$queryRaw<Array<{ numero: string; dossier_id: string; n: bigint }>>`
    SELECT regexp_replace(a.texte_ref, '^.*?(?:BTC|B)([0-9]+)$', '\\1') AS numero,
           a.dossier_id,
           count(*) AS n
    FROM amendements a
    WHERE a.texte_ref ~ '(?:BTC|B)[0-9]+$'
      AND a.dossier_id IS NOT NULL
    GROUP BY 1, 2
  `;

  const candidats = new Map<string, Set<string>>();
  for (const l of lignes) {
    const vus = candidats.get(l.numero) ?? new Set<string>();
    vus.add(l.dossier_id);
    candidats.set(l.numero, vus);
  }

  const resolus = new Map<string, string>();
  let ambigus = 0;
  for (const [numero, dossiers] of candidats) {
    if (dossiers.size === 1) resolus.set(numero, [...dossiers][0]!);
    else ambigus += 1;
  }
  logger.info(
    { numeros: candidats.size, resolus: resolus.size, ambigus },
    'Correspondance numéro de texte → dossier construite'
  );
  return resolus;
}

export async function lierInterventionsAuxDossiers(
  options: OptionsLienInterventionsDossiers = {}
): Promise<ResultatLienInterventionsDossiers> {
  const correspondance = await correspondanceTexteDossier();

  const aFaire = await prisma.$queryRaw<Array<{ texte_numero: string; n: bigint }>>`
    SELECT texte_numero, count(*) AS n
    FROM interventions
    WHERE texte_numero IS NOT NULL
      ${options.refaireTout ? Prisma.empty : Prisma.sql`AND dossier_id IS NULL`}
    GROUP BY 1
  `;

  const resultat: ResultatLienInterventionsDossiers = {
    numerosVus: aFaire.length,
    numerosResolus: 0,
    interventions: 0,
  };

  for (const { texte_numero: numero, n } of aFaire) {
    const dossierId = correspondance.get(numero);
    if (!dossierId) continue;
    resultat.numerosResolus += 1;

    if (options.dryRun) {
      resultat.interventions += Number(n);
      continue;
    }

    // Une mise à jour par numéro : chacune tient dans l'index sur
    // `texte_numero`, et un lot qui échoue n'emporte pas les autres.
    const { count } = await prisma.intervention.updateMany({
      where: {
        texteNumero: numero,
        ...(options.refaireTout ? {} : { dossierId: null }),
      },
      data: { dossierId },
    });
    resultat.interventions += count;
  }

  logger.info(resultat, 'Rattachement des prises de parole à leur dossier terminé');
  return resultat;
}
