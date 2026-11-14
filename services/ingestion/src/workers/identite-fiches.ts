// =============================================================================
// Identité des fiches — séparer deux homonymes, lier l'identifiant d'une chambre
//
// `parlementaires` est une table de PERSONNES : une fiche porte les mandats des
// deux chambres d'un élu passé de l'une à l'autre. Avant que le rapprochement de
// l'ingestion AN soit borné à la chambre (sync.ts), un député homonyme d'un
// sénateur était résolu sur la ligne du sénateur et l'écrasait : la fiche passait
// à l'Assemblée sous le PA du député, en gardant les mandats et les votes du
// Sénat. Jean-Louis Masson, député du Var né en 1954, portait ainsi 1 778 votes
// du sénateur de Moselle né en 1947, et ce dernier n'avait plus de fiche.
//
// `separerHomonyme` rend au sénateur sa fiche (sous son matricule) avec ses
// mandats et ses votes du Sénat. `lierIdentifiant` range l'identifiant de l'autre
// chambre d'un élu réellement passé de l'une à l'autre : le contrôle
// `fiches_deux_chambres_sans_identifiant` exige ce lien, et l'ingestion AN des
// législatures passées retrouve ainsi la fiche au lieu d'en recréer une.
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

type Chambre = 'assemblee' | 'senat';
const autre = (c: Chambre): Chambre => (c === 'assemblee' ? 'senat' : 'assemblee');

export interface SeparationResult {
  fiche: string;
  ficheSeparee: string;
  creee: boolean;
  mandats: number;
  votes: number;
  groupeRetabli: boolean;
  appliquee: boolean;
}

/** Slug de la fiche rendue : celui de la personne, suffixé du matricule s'il est pris. */
export function slugSepare(slug: string, sourceId: string, pris: boolean): string {
  return pris ? `${slug}-${sourceId.toLowerCase()}` : slug;
}

/**
 * Rend à l'homonyme de l'AUTRE chambre sa fiche : crée (ou retrouve) la fiche
 * `chambre autre / sourceId`, puis y déplace les mandats parlementaires et les
 * votes de cette chambre. Le reste (fonctions, interventions, amendements) est
 * vérifié : s'il en existe dans l'autre chambre, la séparation s'arrête, rien
 * n'est déplacé à l'aveugle.
 *
 * Sans `appliquer`, ne fait que compter.
 */
export async function separerHomonyme(opts: {
  slug: string;
  sourceId: string;
  appliquer: boolean;
}): Promise<SeparationResult> {
  const fiche = await prisma.parlementaire.findUnique({
    where: { slug: opts.slug },
    select: { id: true, slug: true, chambre: true, nom: true, prenom: true, sexe: true, groupeId: true, circonscriptionId: true },
  });
  if (!fiche) throw new Error(`Fiche introuvable : ${opts.slug}`);
  const chambre = fiche.chambre as Chambre;
  const cible = autre(chambre);

  // Données de l'autre chambre portées par la fiche.
  const [mandats, votesRows, autresRows] = await Promise.all([
    prisma.mandatParlementaire.findMany({
      where: { personneId: fiche.id, chambre: cible },
      orderBy: { dateDebut: 'desc' },
      select: { id: true, groupeId: true, circonscriptionId: true, dateDebut: true, dateFin: true },
    }),
    prisma.$queryRaw<{ votes: number }[]>`
      SELECT COUNT(*)::int AS votes FROM votes v JOIN scrutins s ON s.id = v.scrutin_id
      WHERE v.parlementaire_id = ${fiche.id} AND s.chambre = ${cible}`,
    prisma.$queryRaw<{ autres: number }[]>`
      SELECT ((SELECT COUNT(*) FROM interventions WHERE parlementaire_id = ${fiche.id} AND chambre = ${cible})
            + (SELECT COUNT(*) FROM amendements WHERE parlementaire_id = ${fiche.id} AND chambre = ${cible}))::int AS autres`,
  ]);
  const votes = votesRows[0]?.votes ?? 0;
  const autres = autresRows[0]?.autres ?? 0;
  if (mandats.length === 0) throw new Error(`${opts.slug} ne porte aucun mandat ${cible} : rien à séparer`);
  if (autres > 0) {
    throw new Error(
      `${opts.slug} porte ${autres} interventions ou amendements ${cible} : à examiner avant toute séparation`,
    );
  }

  const existante = await prisma.parlementaire.findFirst({
    where: { chambre: cible, sourceId: opts.sourceId },
    select: { id: true, slug: true },
  });
  const pris = !existante && (await prisma.parlementaire.findUnique({ where: { slug: fiche.slug }, select: { id: true } })) !== null;
  const slugCible = existante?.slug ?? slugSepare(fiche.slug, opts.sourceId, pris);

  // La fiche gardée affichait peut-être le groupe ou la circonscription de
  // l'homonyme : on les reprend de son dernier mandat dans sa propre chambre.
  const dernierPropre = await prisma.mandatParlementaire.findFirst({
    where: { personneId: fiche.id, chambre },
    orderBy: { dateDebut: 'desc' },
    select: { groupeId: true, circonscriptionId: true },
  });
  const groupesCible = new Set(mandats.map((m) => m.groupeId).filter(Boolean));
  const circosCible = new Set(mandats.map((m) => m.circonscriptionId).filter(Boolean));
  const groupeRetabli =
    (fiche.groupeId !== null && groupesCible.has(fiche.groupeId)) ||
    (fiche.circonscriptionId !== null && circosCible.has(fiche.circonscriptionId));

  const result: SeparationResult = {
    fiche: fiche.slug,
    ficheSeparee: slugCible,
    creee: !existante,
    mandats: mandats.length,
    votes,
    groupeRetabli,
    appliquee: false,
  };
  if (!opts.appliquer) return result;

  await prisma.$transaction(
    async (tx) => {
      const separee =
        existante ??
        (await tx.parlementaire.create({
          data: {
            slug: slugCible,
            chambre: cible,
            nom: fiche.nom,
            prenom: fiche.prenom,
            sexe: fiche.sexe,
            actif: false,
            sourceId: opts.sourceId,
            groupeId: mandats[0]!.groupeId,
            circonscriptionId: mandats[0]!.circonscriptionId,
          },
          select: { id: true, slug: true },
        }));
      await tx.mandatParlementaire.updateMany({
        where: { personneId: fiche.id, chambre: cible },
        data: { personneId: separee.id },
      });
      await tx.$executeRaw`
        UPDATE votes v SET parlementaire_id = ${separee.id}
        FROM scrutins s
        WHERE s.id = v.scrutin_id AND v.parlementaire_id = ${fiche.id} AND s.chambre = ${cible}`;
      if (groupeRetabli && dernierPropre) {
        await tx.parlementaire.update({
          where: { id: fiche.id },
          data: { groupeId: dernierPropre.groupeId, circonscriptionId: dernierPropre.circonscriptionId },
        });
      }
    },
    { timeout: 120_000 },
  );
  result.appliquee = true;
  logger.info(result, 'Homonymes séparés');
  return result;
}

export interface LiaisonResult {
  fiche: string;
  chambre: Chambre;
  sourceId: string;
  deja: boolean;
  appliquee: boolean;
}

/**
 * Range l'identifiant `sourceId` de la chambre `chambre` sur la fiche, pour un
 * élu réellement passé d'une chambre à l'autre. Refuse un identifiant déjà porté
 * par une autre fiche (source_id ou identifiants) : ce serait un homonyme.
 */
export async function lierIdentifiant(opts: {
  slug: string;
  chambre: Chambre;
  sourceId: string;
  appliquer: boolean;
}): Promise<LiaisonResult> {
  const fiche = await prisma.parlementaire.findUnique({
    where: { slug: opts.slug },
    select: { id: true, slug: true, chambre: true },
  });
  if (!fiche) throw new Error(`Fiche introuvable : ${opts.slug}`);
  if (fiche.chambre === opts.chambre) {
    throw new Error(`${opts.slug} est déjà une fiche ${opts.chambre} : son identifiant est source_id`);
  }
  const ailleurs = await prisma.parlementaire.findFirst({
    where: {
      id: { not: fiche.id },
      OR: [
        { chambre: opts.chambre, sourceId: opts.sourceId },
        { identifiants: { some: { chambre: opts.chambre, sourceId: opts.sourceId } } },
      ],
    },
    select: { slug: true },
  });
  if (ailleurs) throw new Error(`${opts.sourceId} est déjà porté par ${ailleurs.slug}`);

  const deja = await prisma.parlementaireIdentifiant.findFirst({
    where: { personneId: fiche.id, chambre: opts.chambre, sourceId: opts.sourceId },
    select: { id: true },
  });
  const result: LiaisonResult = { fiche: fiche.slug, chambre: opts.chambre, sourceId: opts.sourceId, deja: !!deja, appliquee: false };
  if (deja || !opts.appliquer) return result;
  await prisma.parlementaireIdentifiant.create({
    data: { personneId: fiche.id, chambre: opts.chambre, sourceId: opts.sourceId },
  });
  result.appliquee = true;
  return result;
}

export async function deconnecter(): Promise<void> {
  await prisma.$disconnect();
}

