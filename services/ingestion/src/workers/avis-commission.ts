// =============================================================================
// Ingestion des avis de commission sur les amendements
// =============================================================================
//
// Avant qu'un texte passe en séance, la commission se réunit au titre des
// articles 86, 88 ou 91 du Règlement pour dire ce qu'elle pense des amendements
// qui y seront débattus. Elle ne les adopte pas — ils sont déposés sur le texte
// qui part en séance, pas sur le sien : elle donne un avis, qui oriente le vote.
// Son compte rendu ne porte alors aucun débat, juste un tableau, que
// `sources/assemblee-nationale/avis-commission-parser.ts` sait lire.
//
// LE RAPPROCHEMENT VERS LES AMENDEMENTS. Le tableau ne donne qu'un numéro nu.
// Un numéro n'est unique qu'au sein d'un TEXTE, jamais d'un dossier : sur le
// dossier « Création du cadre d'emploi des secrétaires de mairie », deux
// amendements portent le n° 1, un par lecture ; sur un projet de loi de
// transposition, quatre. Chercher par (dossier, numéro) donnerait 7 042 couples
// ambigus — c'est la même famille de fautes que les 531 scrutins de la 15e et de
// la 16e rattachés à des amendements de la 17e.
//
// L'ancre est donc le texte, que le compte rendu nomme lui-même : « des
// amendements à la première partie du projet de loi de finances pour 2026
// (n° 1906) ». Avec (texte, numéro), il ne reste que 51 couples ambigus sur
// 189 734 amendements, et ceux-là ne reçoivent pas d'amendement plutôt qu'un
// mauvais. L'avis reste lisible sans : le numéro, l'auteur et le groupe sont
// imprimés dans le tableau.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { ComptesRendusCommissionClient } from '../sources/assemblee-nationale/comptes-rendus-commission-client';
import {
  parserAvisCommission,
  numerosDeTexteDuCompteRendu,
} from '../sources/assemblee-nationale/avis-commission-parser';

const prisma = new PrismaClient();

const CHAMBRE = 'assemblee';

export interface OptionsAvisCommission {
  /** Ne regarder que les réunions tenues depuis cette date. */
  depuis?: Date;
  /** Ne traiter que ces références de compte rendu (mise au point). */
  seulement?: string[];
  /** Borne de sécurité : nombre maximum de réunions traitées. */
  maxReunions?: number;
  /** Relire les réunions déjà ingérées et y remplacer les avis. */
  reingerer?: boolean;
  /** Ne rien écrire ; compter ce qui serait écrit. */
  dryRun?: boolean;
}

export interface ResultatAvisCommission {
  reunionsLues: number;
  avis: number;
  /** Avis rapprochés d'un amendement en base. */
  avisRattaches: number;
  /** Réunions sans compte rendu publié, ou illisible. */
  sansCompteRendu: number;
  /** Réunions dont le compte rendu ne porte aucun tableau : ce sont des débats. */
  sansTableau: number;
  /** Réunions dont le tableau a été reconnu sans pouvoir être lu. À regarder. */
  tableauxNonLus: number;
  /** Comptes rendus dont le préambule ne nomme aucun texte. */
  sansTexteNomme: number;
}

// =============================================================================
// INDEX DES AMENDEMENTS
// =============================================================================

/**
 * Le numéro de dépôt contenu dans une référence de texte.
 * `PIONANR5L17BTC1364` → `1364`. Le `TC` marque le texte de la commission, qui
 * porte le même numéro que le texte initial : le compte rendu ne dit pas lequel
 * il examine, et les deux répondent au même numéro.
 */
export function numeroDuTexteDeLaRef(texteRef: string | null | undefined): string | null {
  if (!texteRef) return null;
  const m = /(?:BTC|B)(\d+)$/u.exec(texteRef);
  return m ? m[1]! : null;
}

/** La clé d'un amendement : son texte et son numéro. */
export function cleAmendement(numeroTexte: string, numero: string): string {
  return `${numeroTexte}#${numero.replace(/\s+/gu, '').toUpperCase()}`;
}

/**
 * Construit l'index (texte, numéro) → amendement.
 *
 * Une clé qui désigne plus d'un amendement est retirée : 51 cas sur 189 734,
 * où deux versions du même texte portent le même numéro. Mieux vaut un avis
 * sans amendement qu'un avis accroché au mauvais.
 */
export async function indexerAmendements(): Promise<Map<string, string>> {
  const lignes = await prisma.amendement.findMany({
    where: { chambre: CHAMBRE, texteRef: { not: null } },
    select: { id: true, numero: true, texteRef: true },
  });

  const candidats = new Map<string, Set<string>>();
  for (const a of lignes) {
    const numeroTexte = numeroDuTexteDeLaRef(a.texteRef);
    if (!numeroTexte) continue;
    const cle = cleAmendement(numeroTexte, a.numero);
    const vus = candidats.get(cle) ?? new Set<string>();
    vus.add(a.id);
    candidats.set(cle, vus);
  }

  const index = new Map<string, string>();
  let ambigus = 0;
  for (const [cle, ids] of candidats) {
    if (ids.size === 1) index.set(cle, [...ids][0]!);
    else ambigus += 1;
  }
  logger.info(
    { amendements: lignes.length, cles: index.size, ambigues: ambigus },
    'Index des amendements par texte et numéro construit'
  );
  return index;
}

// =============================================================================
// WORKER
// =============================================================================

export async function syncAvisCommission(
  options: OptionsAvisCommission = {}
): Promise<ResultatAvisCommission> {
  const resultat: ResultatAvisCommission = {
    reunionsLues: 0,
    avis: 0,
    avisRattaches: 0,
    sansCompteRendu: 0,
    sansTableau: 0,
    tableauxNonLus: 0,
    sansTexteNomme: 0,
  };

  const reunions = await prisma.reunion.findMany({
    where: {
      // Voir `interventions-commission.ts` : `CRCANR…` désigne exactement les
      // comptes rendus de commission de l'Assemblée. Filtrer sur la commission
      // rattachée écartait en silence les 28 réunions qui n'en ont pas.
      compteRenduRef: { startsWith: 'CRCANR' },
      ...(options.seulement && options.seulement.length > 0
        ? { compteRenduRef: { in: options.seulement } }
        : {}),
      ...(options.depuis ? { dateDebut: { gte: options.depuis } } : {}),
      // Comme pour les débats : on ne relit pas ce qu'on a déjà lu. Une réunion
      // sans tableau n'en aura jamais, d'où la fenêtre dans la moisson nocturne.
      ...(options.reingerer ? {} : { avisCommission: { none: {} } }),
    },
    select: { id: true, compteRenduRef: true, dateDebut: true },
    orderBy: { dateDebut: 'desc' },
    ...(options.maxReunions ? { take: options.maxReunions } : {}),
  });

  logger.info(
    {
      reunions: reunions.length,
      depuis: options.depuis?.toISOString().slice(0, 10) ?? null,
      dryRun: options.dryRun ?? false,
    },
    'Ingestion des avis de commission...'
  );
  if (reunions.length === 0) return resultat;

  // L'index se construit une fois : 189 734 amendements, un balayage. Le faire
  // par réunion coûterait ce balayage 193 fois.
  const amendements = await indexerAmendements();
  const client = new ComptesRendusCommissionClient();

  for (const reunion of reunions) {
    const compteRenduRef = reunion.compteRenduRef!;
    try {
      const telecharge = await client.texteDuCompteRendu(compteRenduRef);
      if (!telecharge) {
        resultat.sansCompteRendu += 1;
        continue;
      }

      const { avis, tableauNonLu } = parserAvisCommission(telecharge.texte);
      if (tableauNonLu) {
        resultat.tableauxNonLus += 1;
        logger.warn(
          { compteRenduRef, url: telecharge.url },
          'Tableau d’avis reconnu mais illisible'
        );
      }
      if (avis.length === 0) {
        resultat.sansTableau += 1;
        continue;
      }

      const numerosDeTexte = numerosDeTexteDuCompteRendu(telecharge.texte);
      if (numerosDeTexte.length === 0) {
        resultat.sansTexteNomme += 1;
        logger.warn({ compteRenduRef }, 'Compte rendu d’avis sans texte nommé');
      }

      const lignes = avis.map((a) => {
        // Plusieurs textes quand le compte rendu en nomme plusieurs (le budget
        // de la sécurité sociale en porte deux) : le premier qui répond gagne.
        let amendementId: string | null = null;
        for (const numeroTexte of numerosDeTexte) {
          const trouve = amendements.get(cleAmendement(numeroTexte, a.numero));
          if (trouve) {
            amendementId = trouve;
            break;
          }
        }
        return {
          reunionId: reunion.id,
          numero: a.numero,
          amendementId,
          position: a.position,
          sens: a.sens,
          place: a.place,
          auteur: a.auteur,
          groupe: a.groupe,
          ordre: a.ordre,
        };
      });

      resultat.avis += lignes.length;
      resultat.avisRattaches += lignes.filter((l) => l.amendementId !== null).length;
      resultat.reunionsLues += 1;

      if (options.dryRun) continue;

      if (options.reingerer) {
        await prisma.$transaction(async (tx) => {
          await tx.avisCommission.deleteMany({ where: { reunionId: reunion.id } });
          await tx.avisCommission.createMany({ data: lignes });
        });
      } else {
        await prisma.avisCommission.createMany({ data: lignes, skipDuplicates: true });
      }
    } catch (err) {
      logger.warn({ compteRenduRef, error: errorMessage(err) }, 'Avis de commission non ingérés');
      resultat.sansCompteRendu += 1;
    }
  }

  logger.info(resultat, 'Ingestion des avis de commission terminée');
  return resultat;
}
