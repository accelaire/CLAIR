// =============================================================================
// Ingestion des candidatures en base
// =============================================================================
//
// Le fichier du ministère est un instantané complet du scrutin, et il est
// republié corrigé (l'édition 2023 l'a été le jour même de sa parution).
// L'ingestion est donc un **remplacement intégral du périmètre du scrutin**,
// dans une transaction : on efface les unités de vote de ce scrutin et on
// réécrit celles du fichier.
//
// C'est volontairement plus brutal qu'une réconciliation ligne à ligne, et
// c'est le bon choix ici : une candidature retirée entre deux publications
// doit disparaître, pas survivre parce qu'aucune ligne ne la contredit. Rien
// ne pointe vers ces lignes — le web adresse les candidats par circonscription
// et par personne — donc la rotation des identifiants est sans conséquence.
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

/**
 * Remplace le scrutin en base, en une transaction.
 *
 * La suppression des unités de vote emporte les candidatures par cascade. Le
 * délai est porté à deux minutes : le défaut de cinq secondes de Prisma ne
 * tient pas sur deux milliers de lignes, et un échec de délai laisserait la
 * table vide le temps d'une reprise.
 */
async function ecrire(
  prisma: PrismaClient,
  scrutin: string,
  listes: ListeAEcrire[],
  candidats: CandidatureAEcrire[]
): Promise<void> {
  await prisma.$transaction(
    async transaction => {
      const supprimees = await transaction.candidatureListe.deleteMany({ where: { scrutin } });
      await transaction.candidatureListe.createMany({ data: listes });
      await transaction.candidature.createMany({ data: candidats });

      logger.info(
        { scrutin, supprimees: supprimees.count, listes: listes.length, candidats: candidats.length },
        'candidatures réécrites'
      );
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
}
