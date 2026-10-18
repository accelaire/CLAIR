// =============================================================================
// Ingestion des candidatures en base
// =============================================================================
//
// Le fichier du ministère est un instantané complet du scrutin, et il est
// republié corrigé (l'édition 2023 l'a été le jour même de sa parution).
// L'ingestion **aligne donc tout le périmètre du scrutin sur le fichier**, dans
// une transaction : une candidature retirée entre deux publications doit
// disparaître, pas survivre parce qu'aucune ligne ne la contredit.
//
// L'alignement se fait par différence, sur les clés stables de la source : la
// liste par son `source_uid`, la candidature par (liste, rôle, rang). Effacer
// puis réécrire le scrutin aurait le même résultat visible, mais redonnait
// chaque nuit un identifiant neuf aux 1 936 candidatures et 483 listes, alors
// que les réutilisateurs des données (dumps, Data for Good) suivent les lignes
// par identifiant et par `updated_at`.
//
// Ce module n'écrit jamais rien qu'il ne sache justifier :
//   — une circonscription introuvable fait échouer l'ingestion, elle n'est pas
//     silencieusement ignorée ;
//   — une nuance inconnue est écrite telle quelle, sans famille ;
//   — un candidat non rattaché reste sans personne, et c'est le cas normal.
// =============================================================================

import path from 'path';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';

import { logger } from '../../utils/logger.js';
import { lireClasseurXlsx } from '../../utils/xlsx.js';
import { lireCsvEnFeuille } from '../../utils/tableur.js';
import type { Feuille } from '../../utils/tableur.js';
import { analyserClasseurCandidatures, sourceUidListe } from './candidatures-parser.js';
import type { ListeBrute } from './candidatures-parser.js';
import { nuanceInconnue, resoudreNuance } from './nuances.js';
import { rattacherLot } from './rattachement.js';
import type { StatistiquesRattachement } from './rattachement.js';
import { differencier } from '../../utils/synchro-differentielle.js';

/**
 * Baisse maximale tolérée du nombre de candidats d'un passage à l'autre.
 *
 * Généreux à dessein : une candidature peut être retirée, jamais un cinquième
 * d'entre elles. Au-delà, c'est la source qui est en cause, pas la réalité.
 */
const CHUTE_MAX = 0.2;

export interface OptionsIngestionCandidatures {
  /**
   * Fichiers locaux publiés par le ministère.
   *
   * Un seul classeur XLSX à deux feuilles jusqu'en 2023, deux CSV distincts en
   * 2026 — un par mode de scrutin. D'où un tableau, et non un chemin.
   */
  fichiers: string[];
  /** Identifiant du scrutin, ex. `senatoriales-2026`. */
  scrutin: string;
  /** Écrit le rapport sans rien modifier en base. */
  simulation?: boolean;
  /**
   * Autorise un effondrement du nombre de candidats.
   *
   * Par défaut, une ingestion qui ferait perdre plus de `CHUTE_MAX` du corpus
   * déjà en place échoue au lieu d'écrire. Ce garde-fou n'existait pas tant que
   * l'ingestion était un acte manuel et vérifié ; il devient indispensable dès
   * lors qu'elle tourne toutes les nuits, parce que l'écriture **aligne tout le
   * scrutin sur le fichier** : un fichier tronqué par la source effacerait
   * des candidats d'une page publique, à dix jours du scrutin, sans que
   * personne ne l'ait demandé.
   */
  forcerChute?: boolean;
}

export interface RapportIngestionCandidatures {
  scrutin: string;
  listes: number;
  candidats: number;
  circonscriptions: number;
  /** Codes du fichier absents de la table des circonscriptions. */
  circonscriptionsInconnues: string[];
  /** Codes de nuance absents de la grille, écrits sans famille. */
  nuancesInconnues: string[];
  rattachement: StatistiquesRattachement;
  sortantsDeclares: number;
  sortantsDeclaresRattaches: number;
  /** Candidats déjà en base pour ce scrutin, avant écriture. */
  candidatsAvant: number;
  simulation: boolean;
}

interface CandidatureAEcrire {
  id: string;
  listeId: string;
  ordre: number;
  role: string;
  nom: string;
  prenom: string;
  sexe: string | null;
  anneeNaissance: number | null;
  dateNaissance: Date | null;
  professionCode: string | null;
  professionLabel: string | null;
  sortantDeclare: boolean;
  personneId: string | null;
  matchConfiance: string | null;
}

interface ListeAEcrire {
  id: string;
  scrutin: string;
  circonscriptionId: string;
  modeScrutin: string;
  numeroDepot: number | null;
  libelle: string | null;
  nuance: string | null;
  nuanceLibelle: string | null;
  famille: string | null;
  sourceUid: string;
}

/**
 * Lit le classeur, rattache, puis réécrit le scrutin en base.
 *
 * Rend un rapport complet même en simulation : c'est ce rapport qui sert de
 * contrôle avant publication.
 */
export async function ingererCandidatures(
  prisma: PrismaClient,
  options: OptionsIngestionCandidatures
): Promise<RapportIngestionCandidatures> {
  const { fichiers, scrutin, simulation = false } = options;

  const feuilles = (await Promise.all(fichiers.map(chargerFeuilles))).flat();
  const listesBrutes = analyserClasseurCandidatures(feuilles);
  if (listesBrutes.length === 0) {
    throw new Error(`Aucune candidature lue dans ${fichiers.join(', ')} : format inattendu`);
  }

  const circonscriptions = await chargerCirconscriptions(prisma);
  const inconnues = [
    ...new Set(
      listesBrutes
        .map(liste => liste.codeDepartement)
        .filter(code => !circonscriptions.has(code))
    ),
  ].sort();

  // Une circonscription introuvable n'est pas un incident mineur : elle
  // effacerait tout un département de la page. On refuse d'écrire.
  if (inconnues.length > 0) {
    throw new Error(
      `Circonscriptions introuvables pour ${inconnues.join(', ')} — ` +
        'vérifier la table circonscriptions et la table de correspondance des codes'
    );
  }

  const { listes, candidats, nuancesInconnues, rattachement, sortants } = preparerEcritures(
    listesBrutes,
    circonscriptions,
    scrutin,
    await chargerPersonnes(prisma)
  );

  const existants = await prisma.candidature.count({
    where: { liste: { scrutin } },
  });
  const chute = existants > 0 ? 1 - candidats.length / existants : 0;

  if (chute > CHUTE_MAX && !options.forcerChute) {
    throw new Error(
      `Le fichier ne contient que ${candidats.length} candidats contre ${existants} en base ` +
        `(${Math.round(chute * 100)} % de moins). L'ingestion aligne l'intégralité du ` +
        'scrutin : elle est interrompue plutôt que d\'effacer des candidatures publiées. ' +
        'Vérifier la source, puis relancer avec --forcer-chute si la baisse est réelle.',
    );
  }

  if (!simulation) {
    await ecrire(prisma, scrutin, listes, candidats);
  }

  return {
    scrutin,
    listes: listes.length,
    candidats: candidats.length,
    circonscriptions: new Set(listes.map(liste => liste.circonscriptionId)).size,
    circonscriptionsInconnues: inconnues,
    nuancesInconnues,
    rattachement,
    sortantsDeclares: sortants.declares,
    sortantsDeclaresRattaches: sortants.rattaches,
    candidatsAvant: existants,
    simulation,
  };
}

/**
 * Lit un fichier en feuilles, quel que soit son format.
 *
 * Le CSV prend le nom du fichier comme nom de feuille : celui du ministère
 * porte le mode de scrutin (« …Scrutin Proportionnel.csv »), qui est
 * exactement ce dont la reconnaissance a besoin.
 */
async function chargerFeuilles(fichier: string): Promise<Feuille[]> {
  if (path.extname(fichier).toLowerCase() === '.csv') {
    return [await lireCsvEnFeuille(fichier, path.basename(fichier, '.csv'))];
  }
  return lireClasseurXlsx(fichier);
}

/** Code de département → identifiant de la circonscription sénatoriale. */
async function chargerCirconscriptions(prisma: PrismaClient): Promise<Map<string, string>> {
  const lignes = await prisma.circonscription.findMany({
    where: { type: 'senatoriale' },
    select: { id: true, departement: true },
  });

  return new Map(lignes.map(ligne => [ligne.departement, ligne.id]));
}

/**
 * Corpus de rapprochement : toutes les personnes connues, toutes chambres et
 * toutes époques confondues.
 *
 * Le périmètre est volontairement large — l'intérêt du rattachement est
 * justement de retrouver l'ancien député qui se présente au Sénat.
 */
async function chargerPersonnes(prisma: PrismaClient) {
  return prisma.parlementaire.findMany({
    select: { id: true, nom: true, prenom: true, dateNaissance: true },
  });
}

function preparerEcritures(
  listesBrutes: ListeBrute[],
  circonscriptions: Map<string, string>,
  scrutin: string,
  personnes: Array<{ id: string; nom: string; prenom: string; dateNaissance: Date | null }>
) {
  const tousLesCandidats = listesBrutes.flatMap(liste => liste.candidats);
  const { rattachements, statistiques } = rattacherLot(tousLesCandidats, personnes);

  const listes: ListeAEcrire[] = [];
  const candidats: CandidatureAEcrire[] = [];
  const nuancesInconnues = new Set<string>();

  for (const brute of listesBrutes) {
    const nuance = resoudreNuance(brute.nuance);
    if (brute.nuance && nuanceInconnue(brute.nuance)) nuancesInconnues.add(brute.nuance);

    const listeId = randomUUID();
    listes.push({
      id: listeId,
      scrutin,
      // La présence a été vérifiée avant l'appel : toute absence a fait échouer
      // l'ingestion.
      circonscriptionId: circonscriptions.get(brute.codeDepartement) as string,
      modeScrutin: brute.modeScrutin,
      numeroDepot: brute.numeroDepot,
      libelle: brute.libelle,
      nuance: nuance?.code ?? null,
      // Le libellé du ministère quand il le publie, le nôtre sinon : citer la
      // source vaut mieux que la paraphraser.
      nuanceLibelle: brute.nuanceLibelle ?? nuance?.libelle ?? null,
      famille: nuance?.famille ?? null,
      sourceUid: sourceUidListe(scrutin, brute),
    });

    for (const candidat of brute.candidats) {
      const rattachement = rattachements.get(candidat);

      candidats.push({
        id: randomUUID(),
        listeId,
        ordre: candidat.ordre,
        role: candidat.role,
        nom: candidat.nom,
        prenom: candidat.prenom,
        sexe: candidat.sexe,
        anneeNaissance: candidat.dateNaissance?.getUTCFullYear() ?? null,
        dateNaissance: candidat.dateNaissance,
        professionCode: candidat.professionCode,
        professionLabel: candidat.professionLabel,
        sortantDeclare: candidat.sortantDeclare,
        personneId: rattachement?.personneId ?? null,
        matchConfiance: rattachement?.confiance ?? null,
      });
    }
  }

  const declares = tousLesCandidats.filter(candidat => candidat.sortantDeclare);

  return {
    listes,
    candidats,
    nuancesInconnues: [...nuancesInconnues].sort(),
    rattachement: statistiques,
    sortants: {
      declares: declares.length,
      rattaches: declares.filter(candidat => rattachements.has(candidat)).length,
    },
  };
}

/** Les colonnes d'une liste que le fichier fournit, donc que l'ingestion compare. */
const CHAMPS_LISTE = [
  'circonscriptionId', 'modeScrutin', 'numeroDepot', 'libelle', 'nuance', 'nuanceLibelle', 'famille',
] as const;

/**
 * Les colonnes d'une candidature que le fichier et le rattachement fournissent.
 * `elu` et `tourElection` n'en font pas partie : l'ingestion n'y touche pas.
 */
const CHAMPS_CANDIDATURE = [
  'nom', 'prenom', 'sexe', 'anneeNaissance', 'dateNaissance', 'professionCode', 'professionLabel',
  'sortantDeclare', 'personneId', 'matchConfiance',
] as const;

type ListeEnBase = ListeAEcrire;
type CandidatureEnBase = CandidatureAEcrire;

/**
 * Ce qu'il faut écrire pour aligner la base sur le fichier.
 *
 * Une liste déjà connue garde son identifiant, et ses candidatures sont
 * rapportées à lui : l'identifiant tiré par `preparerEcritures` ne sert qu'aux
 * listes nouvelles.
 */
export function planifierEcritures(
  listesEnBase: ListeEnBase[],
  candidaturesEnBase: CandidatureEnBase[],
  listes: ListeAEcrire[],
  candidats: CandidatureAEcrire[],
) {
  const listesD = differencier(
    listesEnBase,
    listes,
    { existant: (l) => l.sourceUid, voulu: (l) => l.sourceUid },
    CHAMPS_LISTE,
  );

  const enBaseParUid = new Map(listesEnBase.map((l) => [l.sourceUid, l.id]));
  const idDefinitif = new Map(listes.map((l) => [l.id, enBaseParUid.get(l.sourceUid) ?? l.id]));

  const cle = (c: { listeId: string; role: string; ordre: number }) => `${c.listeId}|${c.role}|${c.ordre}`;
  const candidaturesD = differencier(
    candidaturesEnBase,
    candidats.map((c) => ({ ...c, listeId: idDefinitif.get(c.listeId) ?? c.listeId })),
    { existant: cle, voulu: cle },
    CHAMPS_CANDIDATURE,
  );

  return { listes: listesD, candidatures: candidaturesD };
}

/**
 * Aligne le scrutin en base sur le fichier, en une transaction.
 *
 * Le délai est porté à deux minutes : le défaut de cinq secondes de Prisma ne
 * tient pas sur deux milliers de lignes, et un échec de délai ferait échouer
 * l'ingestion (la transaction annulée laisse l'état précédent intact).
 */
async function ecrire(
  prisma: PrismaClient,
  scrutin: string,
  listes: ListeAEcrire[],
  candidats: CandidatureAEcrire[]
): Promise<void> {
  await prisma.$transaction(
    async transaction => {
      const listesEnBase = await transaction.candidatureListe.findMany({
        where: { scrutin },
        select: { id: true, scrutin: true, sourceUid: true, ...selection(CHAMPS_LISTE) },
      });
      const candidaturesEnBase = await transaction.candidature.findMany({
        where: { liste: { scrutin } },
        select: { id: true, listeId: true, role: true, ordre: true, ...selection(CHAMPS_CANDIDATURE) },
      });
      const plan = planifierEcritures(listesEnBase, candidaturesEnBase, listes, candidats);

      // Les suppressions d'abord : une candidature retirée libère sa place
      // (liste, rôle, rang) avant qu'une autre ne la prenne. Supprimer une
      // liste emporte ses candidatures par cascade.
      const candidaturesRetirees = plan.candidatures.aSupprimer.map(c => c.id);
      if (candidaturesRetirees.length > 0) {
        await transaction.candidature.deleteMany({ where: { id: { in: candidaturesRetirees } } });
      }
      const listesRetirees = plan.listes.aSupprimer.map(l => l.id);
      if (listesRetirees.length > 0) {
        await transaction.candidatureListe.deleteMany({ where: { id: { in: listesRetirees } } });
      }

      for (const { existant, voulu } of plan.listes.aModifier) {
        await transaction.candidatureListe.update({ where: { id: existant.id }, data: extraire(voulu, CHAMPS_LISTE) });
      }
      if (plan.listes.aCreer.length > 0) {
        await transaction.candidatureListe.createMany({ data: plan.listes.aCreer });
      }

      for (const { existant, voulu } of plan.candidatures.aModifier) {
        await transaction.candidature.update({ where: { id: existant.id }, data: extraire(voulu, CHAMPS_CANDIDATURE) });
      }
      if (plan.candidatures.aCreer.length > 0) {
        await transaction.candidature.createMany({ data: plan.candidatures.aCreer });
      }

      logger.info(
        {
          scrutin,
          listes: { creees: plan.listes.aCreer.length, modifiees: plan.listes.aModifier.length, supprimees: listesRetirees.length },
          candidatures: {
            creees: plan.candidatures.aCreer.length,
            modifiees: plan.candidatures.aModifier.length,
            supprimees: candidaturesRetirees.length,
          },
        },
        'candidatures alignées sur le fichier'
      );
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
}

function selection<C extends string>(champs: readonly C[]): Record<C, true> {
  return Object.fromEntries(champs.map(c => [c, true])) as Record<C, true>;
}

function extraire<T extends object, C extends keyof T>(ligne: T, champs: readonly C[]): Pick<T, C> {
  return Object.fromEntries(champs.map(c => [c, ligne[c]])) as Pick<T, C>;
}
