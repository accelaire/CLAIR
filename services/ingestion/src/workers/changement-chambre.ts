// =============================================================================
// Changement de chambre — un député élu sénateur garde sa fiche
//
// `parlementaires` est une table de PERSONNES : un député élu sénateur reste la
// même ligne, qui porte ses mandats des deux chambres (comme Valérie Boyer ou
// Stéphane Demilly en 2020). Mais chaque ingestion retrouve les gens par
// (chambre, identifiant source), et `source_id` n'en porte qu'un.
//
// À son entrée dans l'annuaire du Sénat, la fiche passe donc au Sénat avec son
// matricule, et son identifiant de l'Assemblée (PA…) est rangé dans
// `parlementaires_identifiants` : les données de l'Assemblée publiées après son
// départ la retrouvent encore.
//
// Le rapprochement ne se fait JAMAIS sur le seul nom : l'annuaire du Sénat ne
// publie pas de date de naissance. Il passe par la candidature, rattachée à la
// fiche au niveau A (nom, prénom et date de naissance) par l'ingestion des
// candidatures, et tenue dans la même circonscription que le nouveau sénateur.
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/** « BAZIN-MALGRAS », « Bazin-Malgras » → « bazin malgras ». */
export function normaliserIdentite(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface CandidatureRattachee {
  personneId: string;
  nom: string;
  prenom: string;
  departement: string;
}

/**
 * Personne de l'autre chambre qu'un nouveau sénateur désigne, ou `null`.
 *
 * Il faut une candidature du même nom et du même prénom, dans la
 * circonscription du sénateur, et une seule personne derrière : deux personnes
 * possibles, c'est une ambiguïté, et on ne tranche pas.
 */
export function personneDuNouveauSenateur(
  senateur: { nom: string; prenom: string; departement: string | null },
  candidatures: CandidatureRattachee[],
): string | null {
  if (!senateur.departement) return null;
  const nom = normaliserIdentite(senateur.nom);
  const prenom = normaliserIdentite(senateur.prenom);
  const personnes = new Set(
    candidatures
      .filter(
        (c) =>
          c.departement === senateur.departement &&
          normaliserIdentite(c.nom) === nom &&
          normaliserIdentite(c.prenom) === prenom,
      )
      .map((c) => c.personneId),
  );
  return personnes.size === 1 ? [...personnes][0]! : null;
}

/**
 * Rattache un nouveau sénateur à sa fiche de député, s'il en a une.
 *
 * Écrit l'identifiant de l'Assemblée dans `parlementaires_identifiants` et
 * clôt ses mandats de député à la veille de son entrée au Sénat. La fiche
 * elle-même (chambre, matricule, groupe) est ensuite réécrite par le chemin de
 * mise à jour ordinaire de la synchronisation du Sénat.
 *
 * Renvoie l'identifiant de la fiche, ou `null` si le sénateur n'a pas de fiche
 * dans l'autre chambre.
 */
export async function rattacherDeputeElu(
  prisma: PrismaClient,
  senateur: { uid: string; nom: string; prenom: string; departement: string | null },
  debutMandatSenat: Date,
): Promise<string | null> {
  if (!senateur.departement) return null;

  const candidatures = await prisma.candidature.findMany({
    where: {
      role: 'titulaire',
      matchConfiance: 'A',
      personne: { chambre: { not: 'senat' } },
      liste: { circonscription: { departement: senateur.departement } },
    },
    select: {
      personneId: true,
      nom: true,
      prenom: true,
      liste: { select: { circonscription: { select: { departement: true } } } },
    },
  });

  const personneId = personneDuNouveauSenateur(
    senateur,
    candidatures.map((c) => ({
      personneId: c.personneId!,
      nom: c.nom,
      prenom: c.prenom,
      departement: c.liste.circonscription.departement,
    })),
  );
  if (!personneId) return null;

  const personne = await prisma.parlementaire.findUniqueOrThrow({
    where: { id: personneId },
    select: { chambre: true, sourceId: true, slug: true },
  });

  const veille = new Date(debutMandatSenat.getTime() - 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    if (personne.sourceId) {
      await tx.parlementaireIdentifiant.upsert({
        where: { chambre_sourceId: { chambre: personne.chambre, sourceId: personne.sourceId } },
        create: { personneId, chambre: personne.chambre, sourceId: personne.sourceId },
        update: { personneId },
      });
    }
    // Un mandat encore ouvert, ou clos par l'Assemblée au jour où elle a
    // constaté le départ, déborderait sur le mandat de sénateur.
    await tx.mandatParlementaire.updateMany({
      where: {
        personneId,
        chambre: personne.chambre,
        OR: [{ dateFin: null }, { dateFin: { gt: veille } }],
      },
      data: { dateFin: veille },
    });
  });

  logger.info(
    { slug: personne.slug, de: personne.chambre, matricule: senateur.uid },
    'Nouveau sénateur rattaché à sa fiche de l’autre chambre',
  );
  return personneId;
}

/**
 * Complète une table (identifiant source → personne) d'une chambre avec les
 * identifiants que des personnes ont gardés en la quittant. L'identifiant de
 * la fiche garde la priorité s'il existe déjà.
 */
export async function ajouterIdentifiantsConserves(
  prisma: PrismaLike,
  chambre: string,
  table: Map<string, string>,
): Promise<void> {
  const conserves = await prisma.parlementaireIdentifiant.findMany({
    where: { chambre },
    select: { sourceId: true, personneId: true },
  });
  for (const c of conserves) {
    if (!table.has(c.sourceId)) table.set(c.sourceId, c.personneId);
  }
}
