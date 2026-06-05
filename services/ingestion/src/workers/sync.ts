// =============================================================================
// Ingestion Workers - Synchronisation des données
// Sources: API Assemblée Nationale + Sénat
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import { AssembleeNationaleDeputesClient, TransformedParlementaire } from '../sources/assemblee-nationale/deputes-client';
import { AssembleeNationaleOrganesClient } from '../sources/assemblee-nationale/organes-client.js';
import { AssembleeNationaleScrutinsClient } from '../sources/assemblee-nationale/scrutins-client';
import { DossiersLegislatifsClient } from '../sources/assemblee-nationale/dossiers-client';
import { SenatSenateursClient, TransformedSenateur } from '../sources/senat/senateurs-client';
import { SenatScrutinsClient } from '../sources/senat/scrutins-client';
import { DILAInterventionsClient } from '../sources/dila/interventions-client';
import { SenatInterventionsClient } from '../sources/senat/interventions-client';
import { SenatDossiersClient } from '../sources/senat/dossiers-client';
import { logger } from '../utils/logger';
import { extractCommissionSaisines } from '../utils/dossier-commissions';
import {
  checkSourceFreshness,
  updateSourceState,
  updateSourceCheckTime,
  SOURCES,
} from '../utils/source-freshness';

const prisma = new PrismaClient();
const anClient = new AssembleeNationaleDeputesClient(17);
const senatClient = new SenatSenateursClient();

// Limiter les requêtes parallèles
// Réduit de 5 à 2 pour éviter les OOM sur les syncs avec gros payloads
const limit = pLimit(2);

// Redirections COMSENAT PO* → SENAT-* commissionId
// Rempli par syncCommissions()/syncSenatCommissions(), consommé par syncDossiers()
const comsenatRedirects = new Map<string, string>();

// =============================================================================
// SYNC COMMISSIONS (depuis les organes AMO10)
// =============================================================================

const COMMISSION_CODE_TYPES = [
  'COMPER', 'COMSENAT',
  'CNPE',
  'CNPS', 'COMSPSENAT',
  'CMP',
  'OFFPAR',
  'DELEG', 'DELEGBUREAU', 'DELEGSENAT',
  'MISINFO', 'MISINFOCOM', 'MISINFOPRE',
  'GE', 'GEVI',
  'GA',
  'API',
  'ASSEMBLEE', 'SENAT',
  'COMNL', 'BUREAU', 'CONFPT',
] as const;

function slugifyCommission(nom: string, chambre: string): string {
  const base = nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 70);
  return `${chambre}-${base}`;
}

export async function syncCommissions(): Promise<{ created: number; updated: number; mandatsLinked: number }> {
  logger.info('Starting commissions sync (from AMO30 organes historiques)...');

  // AMO30: tous les organes historiques (actifs + clos) — couvre AN + 52 Sénat
  const organesClient = new AssembleeNationaleOrganesClient(17);
  const amo30Organes = await organesClient.getOrganes();

  // AMO10 (via anClient): nécessaire uniquement pour la map PM→PO des mandats actifs
  const { mandateRefs: pmToPo } = await anClient.getOrganesAndMandateRefs();

  let created = 0;
  let updated = 0;

  logger.info({ total: amo30Organes.length }, 'AMO30 organes found (all types)');

  // Load existing commissions for slug collision avoidance AND COMSENAT dedup
  const existingCommissions = await prisma.commission.findMany({
    select: { slug: true, uid: true, id: true, nom: true, chambre: true, type: true },
  });
  const usedSlugs = new Set(existingCommissions.map((c) => c.slug));

  // Build SENAT-* permanente lookup for COMSENAT dedup (by normalized name)
  const nameNormalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const senatPermByName = new Map<string, string>();
  for (const c of existingCommissions) {
    if (c.uid.startsWith('SENAT-') && c.chambre === 'senat' && c.type === 'permanente') {
      senatPermByName.set(nameNormalize(c.nom), c.id);
    }
  }

  // Track counts by type for logging
  const countsByType: Record<string, { created: number; updated: number; redirected: number }> = {};

  for (const organe of amo30Organes) {
    const type = organe.type;
    if (!countsByType[type]) countsByType[type] = { created: 0, updated: 0, redirected: 0 };

    // COMSENAT: si une commission SENAT-* équivalente existe, ne pas créer de doublon PO*
    if (organe.codeType === 'COMSENAT') {
      const existingPo = await prisma.commission.findUnique({ where: { uid: organe.uid } });
      const matchingSenatId = senatPermByName.get(nameNormalize(organe.libelle));
      if (matchingSenatId && !existingPo) {
        comsenatRedirects.set(organe.uid, matchingSenatId);
        countsByType[type].redirected++;
        continue;
      }
    }

    // Generate unique slug with collision handling
    let slug = slugifyCommission(organe.libelle, organe.chambre);
    const existing = await prisma.commission.findUnique({ where: { uid: organe.uid } });

    // Only generate new slug if creating (to avoid slug drift on updates)
    if (!existing) {
      if (usedSlugs.has(slug)) {
        let counter = 1;
        while (usedSlugs.has(`${slug}-${counter}`)) counter++;
        slug = `${slug}-${counter}`;
      }
      usedSlugs.add(slug);
    } else {
      slug = existing.slug; // preserve existing slug on update
      usedSlugs.add(slug);
    }

    const data = {
      uid: organe.uid,
      organeRef: organe.uid,
      slug,
      chambre: organe.chambre,
      type,
      nom: organe.libelle,
      nomCourt: organe.libelleAbrev || organe.libelleAbrege || null,
      dateDebut: organe.dateDebut,
      dateFin: organe.dateFin,
      actif: organe.actif,
    };

    if (existing) {
      await prisma.commission.update({ where: { id: existing.id }, data });
      updated++;
      countsByType[type].updated++;
    } else {
      await prisma.commission.create({ data });
      created++;
      countsByType[type].created++;
    }
  }

  logger.info({ created, updated, byType: countsByType }, 'AMO30 commissions upserted');

  // Compléter le Sénat via l'API Sénat (AMO30 ne couvre qu'une fraction des commissions Sénat)
  await syncSenatCommissions();

  // Link existing Mandats to Commissions
  // Step 1: Build PM→PO mapping from AMO10 to get organeRef for existing mandats
  let mandatsLinked = 0;
  const commissions = await prisma.commission.findMany({
    select: { id: true, uid: true, nom: true, nomCourt: true },
  });
  const commissionByUid = new Map<string, string>(commissions.map((c) => [c.uid, c.id]));

  // Also build name-based lookup as fallback
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const commissionByName = new Map<string, string>();
  for (const c of commissions) {
    commissionByName.set(normalize(c.nom), c.id);
    if (c.nomCourt) commissionByName.set(normalize(c.nomCourt), c.id);
  }

  // Step 2: Find mandats that need linking (no commissionId yet) or organeRef backfill
  // (pmToPo already built from the single AMO10 download above)
  const mandatsToProcess = await prisma.mandat.findMany({
    where: {
      OR: [
        // Either no commissionId linked yet
        { commissionId: null, typeOrgane: { in: Array.from(COMMISSION_CODE_TYPES) } },
        // Or missing organeRef (backfill needed)
        { organeRef: null, typeOrgane: { in: Array.from(COMMISSION_CODE_TYPES) } },
      ],
    },
    select: { id: true, sourceUid: true, institution: true, organeRef: true },
  });

  for (const mandat of mandatsToProcess) {
    let commissionId: string | null = null;
    let organeRef: string | null = null;

    // Use already stored organeRef directly if available (most reliable path)
    if (mandat.organeRef) {
      organeRef = mandat.organeRef;
      commissionId = commissionByUid.get(organeRef) || null;
    }

    // Fallback: PM→PO mapping from AMO10 (covers mandats created without organeRef)
    if (!commissionId && mandat.sourceUid && pmToPo.has(mandat.sourceUid)) {
      organeRef = pmToPo.get(mandat.sourceUid)!;
      commissionId = commissionByUid.get(organeRef) || null;
    }

    // Fallback: name-based matching (for CNPE/CNPS which have specific institution names)
    if (!commissionId && mandat.institution) {
      const normalized = normalize(mandat.institution);
      commissionId = commissionByName.get(normalized) || null;
      if (!commissionId) {
        for (const [name, id] of commissionByName) {
          if (normalized.includes(name) || name.includes(normalized)) {
            commissionId = id;
            break;
          }
        }
      }
    }

    const updateData: { commissionId?: string; organeRef?: string } = {};
    if (commissionId) updateData.commissionId = commissionId;
    if (organeRef) updateData.organeRef = organeRef;

    if (Object.keys(updateData).length > 0) {
      await prisma.mandat.update({ where: { id: mandat.id }, data: updateData });
      if (commissionId) mandatsLinked++;
    }
  }

  // Re-backfill all AN députés' mandats with fresh commission map.
  // Critical for cases where syncDeputes() updated sourceData but crashed before backfill ran.
  const backfilled = await backfillCommissionMandats(commissionByUid);
  logger.info({ created, updated, mandatsLinked, backfilled }, 'Commissions sync completed');
  return { created, updated, mandatsLinked };
}

// =============================================================================
// SYNC RÉUNIONS (depuis Agenda.json.zip)
// =============================================================================

export async function syncReunions(options: { limit?: number } = {}): Promise<{
  created: number;
  updated: number;
  participantsLinked: number;
}> {
  const { AssembleeNationaleReunionsClient } = await import('../sources/assemblee-nationale/reunions-client.js');

  logger.info({ limit: options.limit }, 'Starting reunions sync...');

  const reunionsClient = new AssembleeNationaleReunionsClient(17);
  const reunions = await reunionsClient.getReunions(options.limit);

  // Load commissions for organeReuniRef → commissionId mapping
  const commissions = await prisma.commission.findMany({ select: { id: true, uid: true } });
  const commissionByUid = new Map(commissions.map((c) => [c.uid, c.id]));

  // Load parlementaires for acteurRef → parlementaireId mapping
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, sourceId: true },
  });
  const parlementaireByRef = new Map<string, string>();
  for (const p of parlementaires) {
    if (p.sourceId) parlementaireByRef.set(p.sourceId, p.id);
  }

  let created = 0;
  let updated = 0;
  let participantsLinked = 0;

  const batchSize = 100;
  for (let i = 0; i < reunions.length; i += batchSize) {
    const batch = reunions.slice(i, i + batchSize);

    for (const r of batch) {
      try {
        const commissionId = r.organeReuniRef ? (commissionByUid.get(r.organeReuniRef) || null) : null;

        const reunionData = {
          uid: r.uid,
          type: r.type,
          dateDebut: r.dateDebut,
          dateFin: r.dateFin,
          lieu: r.lieu,
          etat: r.etat,
          odjResume: r.odjResume,
          odjComplet: r.odjComplet,
          captationVideo: r.captationVideo,
          ouvertePresse: r.ouvertePresse,
          compteRenduRef: r.compteRenduRef,
          organeRef: r.organeReuniRef || null,
          commissionId,
        };

        const existing = await prisma.reunion.findUnique({ where: { uid: r.uid } });

        let reunionId: string;
        if (existing) {
          await prisma.reunion.update({ where: { id: existing.id }, data: reunionData });
          reunionId = existing.id;
          updated++;
        } else {
          const createdReunion = await prisma.reunion.create({ data: reunionData });
          reunionId = createdReunion.id;
          created++;
        }

        // Dedup: when a RUSN (Sénat séance from AN archive) arrives, replace matching SENAT_AGENDA_* entry
        if (r.uid.startsWith('RUSN')) {
          const reunionDate = new Date(reunionData.dateDebut);
          const marginMs = 60 * 60 * 1000; // ±1h window

          const deleted = await prisma.reunion.deleteMany({
            where: {
              uid: { startsWith: 'SENAT_AGENDA_' },
              type: 'seance',
              dateDebut: {
                gte: new Date(reunionDate.getTime() - marginMs),
                lt: new Date(reunionDate.getTime() + marginMs),
              },
            },
          });
          if (deleted.count > 0) {
            logger.info({ rusnUid: r.uid, deletedAgenda: deleted.count }, 'Replaced SENAT_AGENDA entries with RUSN');
          }
        }

        // Sync participants — skip for past meetings that already exist (participants are final)
        const isPastAndExisting = existing && reunionData.dateDebut < new Date();
        if (r.participants.length > 0 && !isPastAndExisting) {
          const seen = new Set<string>();
          const participantRecords: Array<{ reunionId: string; parlementaireId: string; presence: string | null }> = [];
          for (const p of r.participants) {
            const parlementaireId = parlementaireByRef.get(p.acteurRef);
            if (!parlementaireId || seen.has(parlementaireId)) continue;
            seen.add(parlementaireId);
            participantRecords.push({ reunionId, parlementaireId, presence: p.presence });
          }

          if (participantRecords.length > 0) {
            await prisma.$transaction(async (tx) => {
              await tx.reunionParticipant.deleteMany({ where: { reunionId } });
              await tx.reunionParticipant.createMany({ data: participantRecords });
            });
            participantsLinked += participantRecords.length;
          }
        }
      } catch (error: any) {
        logger.warn({ uid: r.uid, error: error.message }, 'Error syncing reunion');
      }
    }

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= reunions.length) {
      logger.info(
        { processed: Math.min(i + batchSize, reunions.length), total: reunions.length, created, updated },
        'Reunions sync progress',
      );
    }
  }

  logger.info({ created, updated, participantsLinked, total: reunions.length }, 'Reunions sync completed');
  return { created, updated, participantsLinked };
}

// =============================================================================
// SYNC GROUPES POLITIQUES (via API Assemblée Nationale)
// =============================================================================

export async function syncGroupes(): Promise<{ created: number; updated: number }> {
  logger.info('Starting groupes sync (from Assemblée Nationale API)...');

  const { groupes } = await anClient.getDeputes();
  let created = 0;
  let updated = 0;

  for (const g of groupes) {
    const data: Prisma.GroupePolitiqueCreateInput = {
      slug: g.slug,
      chambre: g.chambre,
      nom: g.nom,
      nomComplet: g.nomComplet,
      couleur: g.couleur,
      position: g.position || 'centre',
      ordre: 0,
      actif: true,
      sourceId: g.uid,
    };

    const existing = await prisma.groupePolitique.findUnique({
      where: { slug_chambre: { slug: g.slug, chambre: g.chambre } },
    });

    if (existing) {
      await prisma.groupePolitique.update({
        where: { slug_chambre: { slug: g.slug, chambre: g.chambre } },
        data,
      });
      updated++;
    } else {
      await prisma.groupePolitique.create({ data });
      created++;
    }
  }

  logger.info({ created, updated }, 'Groupes sync completed');
  return { created, updated };
}



// =============================================================================
// HELPERS - Mandats commission sync
// =============================================================================

/**
 * Extract commission-type mandats from AN acteur sourceData and upsert them.
 * Also sets commissionId if the organeRef is already in organeRefToCommissionId.
 */
async function syncMandatsFromSourceData(
  parlementaireId: string,
  sourceData: unknown,
  organeRefToCommissionId: Map<string, string>
): Promise<number> {
  if (!sourceData || typeof sourceData !== 'object') return 0;

  const data = sourceData as Record<string, unknown>;
  const mandatsRaw = (data as any).mandats?.mandat;
  if (!mandatsRaw) return 0;

  const mandats = Array.isArray(mandatsRaw) ? mandatsRaw : [mandatsRaw];
  const activeSourceUids: string[] = [];
  let count = 0;

  for (const m of mandats) {
    if (!m?.uid || !m?.typeOrgane) continue;
    if (!COMMISSION_CODE_TYPES.includes(m.typeOrgane as (typeof COMMISSION_CODE_TYPES)[number])) continue;

    const organeRefRaw = m.organes?.organeRef;
    const organeRef: string | undefined = Array.isArray(organeRefRaw)
      ? (organeRefRaw[0] || undefined)
      : (organeRefRaw || undefined);
    const commissionId: string | undefined = organeRef
      ? (organeRefToCommissionId.get(organeRef) || undefined)
      : undefined;
    const newDateDebut = m.dateDebut ? new Date(m.dateDebut) : new Date();

    await prisma.mandat.upsert({
      where: { sourceUid: m.uid },
      update: {
        typeOrgane: m.typeOrgane,
        qualite: m.infosQualite?.libQualite || null,
        dateDebut: newDateDebut,
        dateFin: m.dateFin ? new Date(m.dateFin) : null,
        organeRef: organeRef || null,
        commissionId: commissionId || null,
      },
      create: {
        id: randomUUID(),
        parlementaireId,
        typeOrgane: m.typeOrgane,
        qualite: m.infosQualite?.libQualite || null,
        dateDebut: newDateDebut,
        dateFin: m.dateFin ? new Date(m.dateFin) : null,
        sourceUid: m.uid,
        organeRef: organeRef || null,
        commissionId: commissionId || null,
      },
    });
    activeSourceUids.push(m.uid);
    count++;
  }

  // Mark stale mandats as ended (date_fin = now) instead of deleting — preserves history.
  // Only marks active ones (dateFin: null) that are no longer in AMO10.
  if (activeSourceUids.length > 0) {
    await prisma.mandat.updateMany({
      where: {
        parlementaireId,
        typeOrgane: { in: Array.from(COMMISSION_CODE_TYPES) },
        sourceUid: { notIn: activeSourceUids, startsWith: 'PM' },
        dateFin: null,
      },
      data: { dateFin: new Date() },
    });
  }

  return count;
}

/**
 * Sync commission mandats for all AN députés from their stored sourceData (AMO10).
 * Runs on every sync to keep PM IDs fresh (deputies get reassigned to different commissions).
 */
async function backfillCommissionMandats(
  organeRefToCommissionId: Map<string, string>
): Promise<number> {
  const deputes = await prisma.parlementaire.findMany({
    where: {
      chambre: 'assemblee',
      sourceData: { not: Prisma.JsonNull },
    },
    select: { id: true, sourceData: true },
  });

  let total = 0;
  for (const p of deputes) {
    const count = await syncMandatsFromSourceData(p.id, p.sourceData, organeRefToCommissionId);
    total += count;
  }

  return total;
}

// =============================================================================
// SYNC PARLEMENTAIRES AN (via API Assemblée Nationale)
// =============================================================================

export async function syncDeputes(fullSync: boolean = false): Promise<{ created: number; updated: number }> {
  logger.info({ fullSync }, 'Starting parlementaires AN sync (from Assemblée Nationale API)...');

  const { deputes: parlementaires, groupes } = await anClient.getDeputes();

  // D'abord synchroniser les groupes
  for (const g of groupes) {
    const existing = await prisma.groupePolitique.findFirst({
      where: { OR: [{ sourceId: g.uid }, { AND: [{ slug: g.slug }, { chambre: g.chambre }] }] },
    });

    if (!existing) {
      await prisma.groupePolitique.create({
        data: {
          slug: g.slug,
          chambre: g.chambre,
          nom: g.nom,
          nomComplet: g.nomComplet,
          couleur: g.couleur,
          position: g.position || 'centre',
          ordre: 0,
          actif: true,
          sourceId: g.uid,
        },
      });
    }
  }

  // Récupérer les maps pour les relations (groupes AN uniquement)
  const groupesDb = await prisma.groupePolitique.findMany({
    where: { chambre: 'assemblee' },
  });
  const groupeMap = new Map<string, string>();
  for (const g of groupesDb) {
    if (g.sourceId) groupeMap.set(g.sourceId, g.id);
    groupeMap.set(g.slug, g.id);
    groupeMap.set(g.nom, g.id);
  }

  const circosDb = await prisma.circonscription.findMany({
    where: { type: 'legislative' },
  });
  const circoMap = new Map(circosDb.map((c) => [`${c.departement}-${c.numero}`, c.id]));

  // Construire le mapping organeRef→commissionId (depuis commissions déjà en DB)
  const commissionsDb = await prisma.commission.findMany({ select: { id: true, uid: true } });
  const organeRefToCommissionId = new Map<string, string>(commissionsDb.map((c) => [c.uid, c.id]));

  let created = 0;
  let updated = 0;

  // Process en parallèle avec limite
  const results = await Promise.all(
    parlementaires.map((p) =>
      limit(async () => {
        try {
          return await syncSingleParlementaireAN(p, groupeMap, circoMap, organeRefToCommissionId);
        } catch (error: any) {
          logger.error({ slug: p.slug, error: error.message }, 'Error syncing parlementaire');
          return null;
        }
      })
    )
  );

  for (const result of results) {
    if (result === 'created') created++;
    if (result === 'updated') updated++;
  }

  // Backfill commission mandats for existing deputes
  logger.info('Backfilling commission mandats for existing deputes...');
  const backfilled = await backfillCommissionMandats(organeRefToCommissionId);
  logger.info({ backfilled }, 'Commission mandats backfill completed');

  logger.info({ created, updated, total: parlementaires.length }, 'Parlementaires AN sync completed');
  return { created, updated };
}

// =============================================================================
// SYNC SÉNATEURS
// =============================================================================

async function syncSingleParlementaireAN(
  p: TransformedParlementaire,
  groupeMap: Map<string, string>,
  circoMap: Map<string, string>,
  organeRefToCommissionId: Map<string, string>
): Promise<'created' | 'updated' | null> {
  // Trouver le groupe par sourceId (uid AN) ou sigle
  let groupeId: string | undefined;
  if (p.groupeRef) {
    groupeId = groupeMap.get(p.groupeRef);
  }
  if (!groupeId && p.groupeSigle) {
    groupeId = groupeMap.get(p.groupeSigle);
  }

  // Trouver ou créer la circonscription
  let circonscriptionId: string | undefined;
  if (p.departement && p.numCirco) {
    const circoKey = `${p.departement}-${p.numCirco}`;
    circonscriptionId = circoMap.get(circoKey);

    if (!circonscriptionId) {
      const newCirco = await prisma.circonscription.create({
        data: {
          departement: p.departement,
          numero: p.numCirco,
          nom: `${p.departement} - Circonscription ${p.numCirco}`,
          type: 'legislative',
        },
      });
      circonscriptionId = newCirco.id;
      circoMap.set(circoKey, newCirco.id);
    }
  }

  const data: Prisma.ParlementaireCreateInput = {
    slug: p.slug,
    chambre: p.chambre,
    nom: p.nom,
    prenom: p.prenom,
    sexe: p.sexe,
    dateNaissance: p.dateNaissance,
    lieuNaissance: p.lieuNaissance,
    profession: p.profession,
    photoUrl: p.photoUrl,
    twitter: p.twitter,
    facebook: p.facebook,
    email: p.email,
    actif: true,
    groupe: groupeId ? { connect: { id: groupeId } } : undefined,
    circonscription: circonscriptionId ? { connect: { id: circonscriptionId } } : undefined,
    sourceId: p.uid,
    sourceData: p.sourceData as object,
  };

  const existing = await prisma.parlementaire.findFirst({
    where: {
      OR: [
        { sourceId: p.uid },
        { slug: p.slug },
        {
          AND: [
            { chambre: p.chambre },
            { prenom: p.prenom },
            { nom: { contains: p.nom } },
          ],
        },
      ],
    },
  });

  if (existing) {
    await prisma.parlementaire.update({
      where: { id: existing.id },
      data: {
        ...data,
        slug: p.slug,
        groupe: groupeId ? { connect: { id: groupeId } } : { disconnect: true },
        circonscription: circonscriptionId ? { connect: { id: circonscriptionId } } : undefined,
      },
    });
    return 'updated';
  } else {
    await prisma.parlementaire.create({ data });
    return 'created';
  }
}

// =============================================================================
// SYNC SÉNATS - CommissionsSenate depuis API Sénat
// =============================================================================

const SENAT_CODE_TO_TYPE: Record<string, string> = {
  COMAFCL: 'permanente',
  COMAFETR: 'permanente',
  COMCAEE: 'permanente',
  COMLOIS: 'permanente',
  COMSOCIALE: 'permanente',
  COMFINC: 'permanente',
  COMEUROPE: 'permanente', // Commission des affaires européennes
};

/**
 * Sync Senate commissions from the Senate API data embedded in senateurs.
 * Also backfills organeRef on existing Senate commissions.
 */
export async function syncSenatCommissions(): Promise<{ created: number; updated: number }> {
  // Cleanup: merge PO* (AMO30 COMSENAT) duplicates into SENAT-* canonical entries
  // Match by normalized name since PO* and SENAT-* have different organeRef values
  const allSenatCommissions = await prisma.commission.findMany({
    where: { chambre: 'senat', type: 'permanente' },
    select: { id: true, uid: true, slug: true, nom: true, organeRef: true },
  });
  const nameNorm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const senatEntries = allSenatCommissions.filter(c => c.uid.startsWith('SENAT-'));
  const poEntries = allSenatCommissions.filter(c => c.uid.startsWith('PO'));

  for (const po of poEntries) {
    const poNorm = nameNorm(po.nom);
    const match = senatEntries.find(s => nameNorm(s.nom) === poNorm);
    if (!match) continue;

    // Transfer dossier_commissions, mandats, reunions from PO* → SENAT-*
    const [dcCount, mandatCount, reunionCount] = await Promise.all([
      prisma.dossierCommission.updateMany({ where: { commissionId: po.id }, data: { commissionId: match.id } }),
      prisma.mandat.updateMany({ where: { commissionId: po.id }, data: { commissionId: match.id } }),
      prisma.reunion.updateMany({ where: { commissionId: po.id }, data: { commissionId: match.id } }),
    ]);

    // Copy SEO-friendly slug from PO* if the SENAT-* still has its generated one
    await prisma.$transaction(async (tx) => {
      if (match.slug.startsWith('senat-com-') && po.slug.startsWith('senat-commission-')) {
        await tx.commission.update({ where: { id: po.id }, data: { slug: `tmp-del-${po.uid}` } });
        await tx.commission.update({ where: { id: match.id }, data: { slug: po.slug } });
      }
      await tx.commission.delete({ where: { id: po.id } });
    });
    comsenatRedirects.set(po.uid, match.id);

    logger.info(
      { deletedUid: po.uid, keptUid: match.uid, dossiers: dcCount.count, mandats: mandatCount.count, reunions: reunionCount.count },
      'Merged PO* COMSENAT duplicate into SENAT-* commission',
    );
  }

  // Load all senateurs to extract commission data from sourceData
  const senateurs = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, sourceData: true },
  });

  // Extract unique commissions from senateurs' organismes
  const commissionData = new Map<string, { code: string; libelle: string }>();
  for (const p of senateurs) {
    const data = p.sourceData as Record<string, unknown> | null;
    if (!data) continue;
    const organismes = (data as any).organismes || [];
    for (const org of organismes) {
      if (org.type !== 'COMMISSION') continue;
      if (!commissionData.has(org.code)) {
        commissionData.set(org.code, { code: org.code, libelle: org.libelle });
      }
    }
  }

  // Load existing Senate commissions (for matching by organeRef or name)
  const existing = await prisma.commission.findMany({
    where: { chambre: 'senat' },
    select: { id: true, uid: true, organeRef: true, nom: true, nomCourt: true },
  });
  const byOrganeRef = new Map<string, string>();
  for (const c of existing) {
    if (c.organeRef) byOrganeRef.set(c.organeRef, c.id);
  }

  let created = 0;
  let updated = 0;
  const defaultDateDebut = new Date('2017-10-01'); // Start of current Senate term

  for (const [, { code, libelle }] of commissionData) {
    const slug = `senat-${code.toLowerCase()}`;
    const data = {
      uid: `SENAT-${code}`,
      slug,
      chambre: 'senat' as const,
      type: 'permanente',
      nom: libelle,
      organeRef: code,
      dateDebut: defaultDateDebut,
      actif: true,
    };

    const existingByOrganeRef = byOrganeRef.get(code);
    if (existingByOrganeRef) {
      await prisma.commission.update({
        where: { id: existingByOrganeRef },
        data: { organeRef: code },
      });
      updated++;
    } else {
      await prisma.commission.create({ data });
      created++;
    }
  }

  // Backfill organeRef on existing Senate commissions that don't have one yet
  const existingWithoutOrganeRef = existing.filter((c) => !c.organeRef);
  for (const c of existingWithoutOrganeRef) {
    const cNorm = nameNorm(c.nom);
    for (const [code, { libelle }] of commissionData) {
      if (nameNorm(libelle).includes(cNorm) || cNorm.includes(nameNorm(libelle))) {
        await prisma.commission.update({ where: { id: c.id }, data: { organeRef: code } });
        updated++;
        break;
      }
    }
  }

  logger.info({ created, updated, commissions: commissionData.size }, 'Senat commissions sync completed');
  return { created, updated };
}

// =============================================================================
// SYNC SÉNATEURS (via API Sénat)
// =============================================================================

export async function syncSenateurs(fullSync: boolean = false): Promise<{ created: number; updated: number }> {
  logger.info({ fullSync }, 'Starting sénateurs sync (from Sénat API)...');

  const { senateurs, groupes } = await senatClient.getSenateurs();

  // D'abord synchroniser les groupes du Sénat
  for (const g of groupes) {
    const existing = await prisma.groupePolitique.findFirst({
      where: { OR: [{ sourceId: g.uid }, { AND: [{ slug: g.slug }, { chambre: g.chambre }] }] },
    });

    if (!existing) {
      await prisma.groupePolitique.create({
        data: {
          slug: g.slug,
          chambre: g.chambre,
          nom: g.nom,
          nomComplet: g.nomComplet,
          couleur: g.couleur,
          position: g.position || 'centre',
          ordre: 0,
          actif: true,
          sourceId: g.uid,
        },
      });
    }
  }

  // Récupérer les maps pour les relations (groupes Sénat uniquement)
  const groupesDb = await prisma.groupePolitique.findMany({
    where: { chambre: 'senat' },
  });
  const groupeMap = new Map<string, string>();
  for (const g of groupesDb) {
    if (g.sourceId) groupeMap.set(g.sourceId, g.id);
    groupeMap.set(g.slug, g.id);
    groupeMap.set(g.nom, g.id);
  }

  // Récupérer les circonscriptions sénatoriales
  const circosDb = await prisma.circonscription.findMany({
    where: { type: 'senatoriale' },
  });
  const circoMap = new Map(circosDb.map((c) => [c.departement, c.id]));

  // Sync Senate commissions first, then build organeRef→commissionId map
  await syncSenatCommissions();
  const commissionsDb = await prisma.commission.findMany({
    where: { chambre: 'senat', organeRef: { not: null } },
    select: { id: true, organeRef: true },
  });
  const commissionByOrganeRef = new Map<string, string>(
    commissionsDb.map((c) => [c.organeRef!, c.id]),
  );

  let created = 0;
  let updated = 0;

  // Process en parallèle avec limite
  const results = await Promise.all(
    senateurs.map((s) =>
      limit(async () => {
        try {
          return await syncSingleSenateur(s, groupeMap, circoMap, commissionByOrganeRef);
        } catch (error: any) {
          logger.error({ slug: s.slug, error: error.message }, 'Error syncing sénateur');
          return null;
        }
      })
    )
  );

  for (const result of results) {
    if (result === 'created') created++;
    if (result === 'updated') updated++;
  }

  logger.info({ created, updated, total: senateurs.length }, 'Sénateurs sync completed');
  return { created, updated };
}

async function syncSingleSenateur(
  s: TransformedSenateur,
  groupeMap: Map<string, string>,
  circoMap: Map<string, string>,
  commissionByOrganeRef: Map<string, string>
): Promise<'created' | 'updated' | null> {
  // Trouver le groupe par sigle
  let groupeId: string | undefined;
  if (s.groupeRef) {
    groupeId = groupeMap.get(s.groupeRef) || groupeMap.get(`SENAT-${s.groupeRef}`);
  }
  if (!groupeId && s.groupeSigle) {
    groupeId = groupeMap.get(s.groupeSigle);
  }

  // Trouver ou créer la circonscription sénatoriale
  let circonscriptionId: string | undefined;
  if (s.departement) {
    circonscriptionId = circoMap.get(s.departement);

    if (!circonscriptionId) {
      // Créer la circonscription sénatoriale pour ce département
      const libelle = s.sourceData.circonscription?.libelle || s.departement;
      const newCirco = await prisma.circonscription.create({
        data: {
          departement: s.departement,
          numero: 0, // Pas de numéro pour les sénatoriales
          nom: libelle,
          type: 'senatoriale',
        },
      });
      circonscriptionId = newCirco.id;
      circoMap.set(s.departement, newCirco.id);
    }
  }

  const data: Prisma.ParlementaireCreateInput = {
    slug: s.slug,
    chambre: s.chambre,
    nom: s.nom,
    prenom: s.prenom,
    sexe: s.sexe,
    dateNaissance: s.dateNaissance,
    lieuNaissance: s.lieuNaissance,
    profession: s.profession,
    photoUrl: s.photoUrl,
    twitter: s.twitter,
    facebook: s.facebook,
    email: s.email,
    serie: s.serie,
    commissionPermanente: s.commissionPermanente,
    actif: true,
    groupe: groupeId ? { connect: { id: groupeId } } : undefined,
    circonscription: circonscriptionId ? { connect: { id: circonscriptionId } } : undefined,
    sourceId: s.uid,
    sourceData: s.sourceData as object,
  };

  const existing = await prisma.parlementaire.findFirst({
    where: {
      OR: [
        { sourceId: s.uid },
        { slug: s.slug },
        {
          AND: [
            { chambre: s.chambre },
            { prenom: s.prenom },
            { nom: { contains: s.nom } },
          ],
        },
      ],
    },
  });

  let parlementaireId: string;

  if (existing) {
    await prisma.parlementaire.update({
      where: { id: existing.id },
      data: {
        ...data,
        slug: s.slug,
        groupe: groupeId ? { connect: { id: groupeId } } : { disconnect: true },
        circonscription: circonscriptionId ? { connect: { id: circonscriptionId } } : undefined,
      },
    });
    parlementaireId = existing.id;
  } else {
    const created = await prisma.parlementaire.create({ data });
    parlementaireId = created.id;
  }

  // Create/update commission mandats from sourceData.organismes
  const organismes = s.sourceData.organismes || [];
  for (const org of organismes) {
    if (org.type !== 'COMMISSION') continue;
    const code = org.organeRef || org.code;
    if (!code) continue;
    const commissionId = commissionByOrganeRef.get(code);
    if (!commissionId) continue;

    const mandatData: Prisma.MandatUncheckedCreateInput = {
      typeOrgane: 'COMMISSION',
      qualite: org.qualite || 'Membre',
      dateDebut: org.dateDebut ? new Date(org.dateDebut) : new Date(),
      dateFin: org.dateFin ? new Date(org.dateFin) : null,
      organeRef: code,
      parlementaireId: parlementaireId,
      commissionId: commissionId,
    };

    await prisma.mandat.upsert({
      where: {
        parlementaireId_organeRef: { parlementaireId, organeRef: code },
      },
      create: mandatData,
      update: {
        qualite: org.qualite || 'Membre',
        dateFin: org.dateFin ? new Date(org.dateFin) : null,
      },
    });
  }

  return existing ? 'updated' : 'created';
}

// =============================================================================
// SYNC SCRUTINS (via API Assemblée Nationale)
// =============================================================================

export async function syncScrutins(
  options: { limit?: number; fromNumero?: number } = {}
): Promise<{ scrutins: number; votes: number }> {
  logger.info({ limit: options.limit }, 'Starting scrutins AN sync (from Assemblée Nationale API)...');

  const scrutinsClient = new AssembleeNationaleScrutinsClient(17);
  const scrutinsData = await scrutinsClient.getScrutins({ limit: options.limit });

  // Charger les parlementaires AN pour le mapping acteurRef -> parlementaireId
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, sourceId: true },
  });
  const parlementaireMap = new Map<string, string>();
  for (const p of parlementaires) {
    if (p.sourceId) parlementaireMap.set(p.sourceId, p.id);
  }

  let scrutinsCreated = 0;
  let scrutinsUpdated = 0;
  let votesCreated = 0;

  const chambre = 'assemblee';
  // Pour l'AN, la session est la législature (17e par défaut)
  const session = process.env.ASSEMBLEE_NATIONALE_LEGISLATURE || '17';

  for (const data of scrutinsData) {
    try {
      const { scrutin, votes } = data;

      // Tags automatiques basés sur le titre
      const tags = extractTags(scrutin.titre);

      // Importance basée sur le type de vote et le nombre de votants
      let importance = 1;
      if (scrutin.typeVote === 'solennel') importance = 4;
      else if (scrutin.typeVote === 'motion') importance = 5;
      else if (scrutin.nombreVotants > 400) importance = 3;
      else if (scrutin.nombreVotants > 200) importance = 2;

      const scrutinData = {
        numero: scrutin.numero,
        chambre,
        session,
        date: scrutin.date,
        titre: scrutin.titre,
        typeVote: scrutin.typeVote,
        sort: scrutin.sort,
        nombreVotants: scrutin.nombreVotants,
        nombrePour: scrutin.nombrePour,
        nombreContre: scrutin.nombreContre,
        nombreAbstention: scrutin.nombreAbstention,
        // Enrichissement contexte
        objetLibelle: scrutin.objetLibelle,
        demandeurTexte: scrutin.demandeurTexte,
        seanceRef: scrutin.seanceRef,
        tags,
        importance,
        sourceUrl: scrutin.sourceUrl,
        sourceData: scrutin.sourceData as object,
      };

      const existing = await prisma.scrutin.findUnique({
        where: { numero_chambre_session: { numero: scrutin.numero, chambre, session } },
      });

      let scrutinId: string;

      if (existing) {
        await prisma.scrutin.update({
          where: { numero_chambre_session: { numero: scrutin.numero, chambre, session } },
          data: scrutinData,
        });
        scrutinId = existing.id;
        scrutinsUpdated++;
      } else {
        const created = await prisma.scrutin.create({ data: scrutinData });
        scrutinId = created.id;
        scrutinsCreated++;
      }

      // Synchroniser les votes individuels
      // D'abord supprimer les votes existants pour ce scrutin
      await prisma.vote.deleteMany({ where: { scrutinId } });

      // Créer les nouveaux votes
      const voteRecords = [];
      for (const vote of votes) {
        const parlementaireId = parlementaireMap.get(vote.acteurRef);
        if (!parlementaireId) continue; // Parlementaire non trouvé

        voteRecords.push({
          parlementaireId,
          scrutinId,
          position: vote.position,
          parDelegation: vote.parDelegation,
        });
      }

      if (voteRecords.length > 0) {
        await prisma.vote.createMany({ data: voteRecords });
        votesCreated += voteRecords.length;
      }

    } catch (error: any) {
      logger.warn({ numero: data.scrutin.numero, error: error.message }, 'Error syncing scrutin');
    }

    // Pause tous les 100 scrutins pour laisser le GC respirer
    if ((scrutinsCreated + scrutinsUpdated) % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.info({
    scrutins: { created: scrutinsCreated, updated: scrutinsUpdated },
    votes: votesCreated,
    total: scrutinsData.length,
  }, 'Scrutins AN sync completed');

  return { scrutins: scrutinsCreated + scrutinsUpdated, votes: votesCreated };
}

// =============================================================================
// SYNC SCRUTINS SÉNAT
// =============================================================================

export async function syncScrutinsSenat(
  options: {
    limit?: number;
    session?: string;
    sessions?: string[];
    enrichDossiers?: boolean;
  } = {}
): Promise<{ scrutins: number; votes: number; dossiersLinked: number }> {
  // Le client DOSLEG utilise maintenant les envvars SENAT_SESSION_START/END par défaut
  // On peut override avec session/sessions si spécifié
  logger.info({ limit: options.limit, enrichDossiers: options.enrichDossiers ?? true }, 'Starting scrutins Sénat sync (DOSLEG)...');

  const scrutinsClient = new SenatScrutinsClient();

  // Récupérer les scrutins depuis DOSLEG (bulk fetch)
  const scrutinsData = await scrutinsClient.getScrutins({
    limit: options.limit,
    session: options.session,
    sessions: options.sessions,
    enrichDossiers: options.enrichDossiers ?? true,
    parallelEnrichment: 3, // Limiter pour éviter surcharge
  });

  logger.info({ count: scrutinsData.length }, 'Scrutins fetched from DOSLEG');

  // Charger les sénateurs pour le mapping matricule -> parlementaireId
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, sourceId: true },
  });
  const parlementaireMap = new Map<string, string>();
  for (const p of parlementaires) {
    if (p.sourceId) parlementaireMap.set(p.sourceId, p.id);
  }

  // Charger les dossiers législatifs pour le mapping dossierRef -> dossierId
  const dossiers = await prisma.dossierLegislatif.findMany({
    select: { id: true, uid: true, titre: true },
  });
  const dossierMap = new Map<string, string>();
  for (const d of dossiers) {
    // Map par UID (ex: "pjlf2025")
    if (d.uid) {
      dossierMap.set(d.uid.toLowerCase(), d.id);
      // Aussi mapper sans préfixe si c'est un format court
      const shortRef = d.uid.replace(/^(pjl|ppl|cvn)/, '');
      if (shortRef !== d.uid) {
        dossierMap.set(shortRef.toLowerCase(), d.id);
      }
    }
  }

  let scrutinsCreated = 0;
  let scrutinsUpdated = 0;
  let votesCreated = 0;
  let dossiersLinked = 0;

  const chambre = 'senat';

  for (const data of scrutinsData) {
    try {
      const { scrutin, votes } = data;

      // Utiliser la session directement du client (format "2024-2025")
      // Extraire l'année de début pour la clé unique
      const sessionYear = scrutin.session.split('-')[0] || scrutin.session;

      // Tags automatiques basés sur le titre
      const tags = extractTags(scrutin.titre);

      // Importance basée sur le nombre de votants
      let importance = 1;
      if (scrutin.nombreVotants > 300) importance = 3;
      else if (scrutin.nombreVotants > 200) importance = 2;

      // Rechercher le dossier législatif par ref
      let dossierId: string | null = null;
      if (scrutin.dossierRef) {
        dossierId = dossierMap.get(scrutin.dossierRef.toLowerCase()) || null;
        if (dossierId) dossiersLinked++;
      }

      // Amendment linking is NOT done here — DOSLEG only provides amendment numbers
      // without texteRef, making numero-only matching imprecise (same numero exists
      // on different textes). Precise linking is handled later by:
      // - enrichScrutinsSenatAmendements() (HTML scraping + AMELI texteRef)
      // - linkScrutinsToAmendements() (CTE with dossier constraint)

      const scrutinBaseData = {
        numero: scrutin.numero,
        chambre,
        session: sessionYear, // Clé unique utilise l'année simple
        date: scrutin.date,
        titre: scrutin.titre,
        typeVote: scrutin.typeVote,
        sort: scrutin.sort,
        nombreVotants: scrutin.nombreVotants,
        nombrePour: scrutin.nombrePour,
        nombreContre: scrutin.nombreContre,
        nombreAbstention: scrutin.nombreAbstention,
        // Enrichissement contexte
        objetLibelle: scrutin.objetLibelle,
        demandeurTexte: scrutin.demandeurTexte,
        seanceRef: scrutin.seanceRef,
        // Liens
        dossierId,
        tags,
        importance,
        sourceUrl: scrutin.sourceUrl,
        sourceData: scrutin.sourceData as object,
      };

      const amendementsRelation = amendementIds.length > 0
        ? amendementIds.map(id => ({ id }))
        : [];

      const existing = await prisma.scrutin.findUnique({
        where: { numero_chambre_session: { numero: scrutin.numero, chambre, session: sessionYear } },
      });

      let scrutinId: string;

      if (existing) {
        await prisma.scrutin.update({
          where: { numero_chambre_session: { numero: scrutin.numero, chambre, session: sessionYear } },
          data: {
            ...scrutinBaseData,
            // NEVER override amendment links here — DOSLEG numero matching is imprecise
            // (amendementByNumero is non-unique: same numero exists on different textes).
            // Precise amendment linking is handled by enrichScrutinsSenatAmendements() (HTML scraping)
            // and linkScrutinsToAmendements() (CTE with dossier constraint).
          },
        });
        scrutinId = existing.id;
        scrutinsUpdated++;
      } else {
        const created = await prisma.scrutin.create({
          data: {
            ...scrutinBaseData,
            // Amendment linking is deferred to enrichScrutinsSenatAmendements() (HTML scraping)
          },
        });
        scrutinId = created.id;
        scrutinsCreated++;
      }

      // Synchroniser les votes individuels
      await prisma.vote.deleteMany({ where: { scrutinId } });

      const voteRecords = [];
      for (const vote of votes) {
        const parlementaireId = parlementaireMap.get(vote.matricule);
        if (!parlementaireId) continue;

        voteRecords.push({
          parlementaireId,
          scrutinId,
          position: vote.position,
          parDelegation: vote.parDelegation,
        });
      }

      if (voteRecords.length > 0) {
        await prisma.vote.createMany({ data: voteRecords });
        votesCreated += voteRecords.length;
      }

    } catch (error: any) {
      logger.warn({ numero: data.scrutin.numero, error: error.message }, 'Error syncing scrutin Sénat');
    }

    // Pause tous les 100 scrutins pour laisser le GC respirer
    if ((scrutinsCreated + scrutinsUpdated) % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.info({
    scrutins: { created: scrutinsCreated, updated: scrutinsUpdated },
    votes: votesCreated,
    dossiersLinked,
    total: scrutinsData.length,
  }, 'Scrutins Sénat sync completed');

  return { scrutins: scrutinsCreated + scrutinsUpdated, votes: votesCreated, dossiersLinked };
}

// =============================================================================
// SYNC INTERVENTIONS (via DILA Comptes Rendus)
// =============================================================================

export async function syncInterventions(
  options: { maxSeances?: number; year?: number } = {}
): Promise<{ interventions: number }> {
  logger.info({ maxSeances: options.maxSeances }, 'Starting interventions AN sync (from DILA)...');

  const dilaClient = new DILAInterventionsClient();
  const interventionsData = await dilaClient.getInterventions(options);

  // Charger les parlementaires AN pour le mapping nom -> parlementaireId
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, sourceId: true, nom: true, prenom: true },
  });

  // Créer un map avec des clés fiables uniquement
  const parlementaireByRef = new Map<string, string>(); // PA ID -> parlementaire.id
  const parlementaireByFullName = new Map<string, string>(); // "prenom nom" normalisé -> parlementaire.id
  // nom seul -> { id, prenom } OU null si ambigu (2+ parlementaires avec le même nom)
  const parlementaireByNom = new Map<string, { id: string; prenom: string } | null>();

  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  for (const p of parlementaires) {
    // Par sourceId (PA123456) — toujours fiable
    if (p.sourceId) parlementaireByRef.set(p.sourceId, p.id);

    // Par nom complet normalisé (prenom + nom, nom + prenom)
    parlementaireByFullName.set(normalize(`${p.prenom} ${p.nom}`), p.id);
    parlementaireByFullName.set(normalize(`${p.nom} ${p.prenom}`), p.id);

    // Par nom seul — marquer comme ambigu si plusieurs parlementaires partagent le même nom
    const nomNorm = normalize(p.nom);
    if (parlementaireByNom.has(nomNorm)) {
      // Collision : marquer comme ambigu (null)
      parlementaireByNom.set(nomNorm, null);
    } else {
      parlementaireByNom.set(nomNorm, { id: p.id, prenom: p.prenom });
    }
  }

  let created = 0;
  let createdNonParlementaire = 0;
  let skippedPresident = 0;

  const chambre = 'assemblee';

  for (const intervention of interventionsData) {
    try {
      const orateurNom = intervention.orateurNom || '';
      const orateurLower = orateurNom.toLowerCase();

      // Ignorer les interventions du président/présidente de séance (pas informatif)
      if (orateurLower.includes('président') || orateurLower.includes('présidente') ||
          orateurLower === 'le président' || orateurLower === 'la présidente') {
        skippedPresident++;
        continue;
      }

      // Chercher le parlementaire — matching sécurisé, ordre de fiabilité décroissant
      let parlementaireId: string | null = null;

      // 1. Par orateurRef (PA ID) — le plus fiable
      if (intervention.orateurRef) {
        parlementaireId = parlementaireByRef.get(intervention.orateurRef) || null;
      }

      // 2. Par nom complet (prénom + nom)
      if (!parlementaireId && intervention.orateurPrenom && intervention.orateurNom) {
        const fullName = normalize(`${intervention.orateurPrenom} ${intervention.orateurNom}`);
        parlementaireId = parlementaireByFullName.get(fullName) || null;
      }

      // 3. Par nom seul — SEULEMENT si :
      //    - non ambigu (un seul parlementaire avec ce nom)
      //    - pas un non-parlementaire connu (qualité détectée)
      //    - prénom cohérent : si l'orateur a un prénom, il DOIT matcher celui du parlementaire
      //      (ex: "Philippe Tabarot" ≠ "Michèle Tabarot" → pas de fausse attribution)
      if (!parlementaireId && intervention.orateurNom && !intervention.orateurQualite) {
        const nomNorm = normalize(intervention.orateurNom);
        const candidate = parlementaireByNom.get(nomNorm);
        if (candidate) {
          if (intervention.orateurPrenom) {
            // Prénom disponible → vérifier la correspondance
            if (normalize(intervention.orateurPrenom) === normalize(candidate.prenom)) {
              parlementaireId = candidate.id;
            }
            // Prénom différent → ne pas matcher (homonyme ou non-parlementaire)
          } else {
            // Pas de prénom → matcher par nom seul (best effort)
            parlementaireId = candidate.id;
          }
        }
      }

      // Vérifier si l'intervention existe déjà (basé sur seanceId + contenu seul)
      // Pas de filtre par orateur : évite les doublons quand plusieurs CRI couvrent la même séance
      const contentHash = intervention.contenu.substring(0, 200);
      const existing = await prisma.intervention.findFirst({
        where: {
          seanceId: intervention.seanceId,
          contenu: { startsWith: contentHash },
        },
      });
      if (existing) continue;

      // Extraire les mots-clés
      const motsCles = extractKeywords(intervention.contenu);

      await prisma.intervention.create({
        data: {
          parlementaireId,
          orateurNom: intervention.orateurNom,
          orateurPrenom: intervention.orateurPrenom || null,
          orateurQualite: intervention.orateurQualite || null,
          chambre,
          seanceId: intervention.seanceId,
          date: intervention.date,
          ordre: intervention.ordre,
          type: intervention.type,
          contenu: intervention.contenu,
          motsCles,
          sourceUrl: intervention.sourceUrl,
        },
      });

      if (parlementaireId) {
        created++;
      } else {
        createdNonParlementaire++;
      }

    } catch (error: any) {
      logger.warn({ seance: intervention.seanceId, error: error.message }, 'Error syncing intervention');
    }
  }

  logger.info({
    created,
    createdNonParlementaire,
    total: interventionsData.length,
    skippedPresident,
    matchRate: `${(((created + createdNonParlementaire) / (interventionsData.length || 1)) * 100).toFixed(1)}%`,
  }, 'Interventions AN sync completed');

  return { interventions: created + createdNonParlementaire };
}

// =============================================================================
// SYNC INTERVENTIONS SÉNAT (via data.senat.fr)
// =============================================================================

export async function syncInterventionsSenat(
  options: { maxSeances?: number; minYear?: number } = {}
): Promise<{ interventions: number }> {
  logger.info({ maxSeances: options.maxSeances }, 'Starting interventions Sénat sync (from data.senat.fr)...');

  const senatInterClient = new SenatInterventionsClient();
  const interventionsData = await senatInterClient.getInterventions(options);

  // Charger les sénateurs pour le mapping nom -> parlementaireId
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, sourceId: true, nom: true, prenom: true },
  });

  // Créer un map avec des clés fiables uniquement
  const parlementaireByRef = new Map<string, string>(); // matricule -> parlementaire.id
  const parlementaireByFullName = new Map<string, string>(); // "prenom nom" normalisé -> parlementaire.id
  // nom seul -> { id, prenom } OU null si ambigu
  const parlementaireByNom = new Map<string, { id: string; prenom: string } | null>();

  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  for (const p of parlementaires) {
    // Par sourceId (matricule)
    if (p.sourceId) parlementaireByRef.set(p.sourceId, p.id);

    // Par nom complet normalisé (prenom + nom, nom + prenom)
    parlementaireByFullName.set(normalize(`${p.prenom} ${p.nom}`), p.id);
    parlementaireByFullName.set(normalize(`${p.nom} ${p.prenom}`), p.id);

    // Par nom seul — marquer comme ambigu si collision
    const nomNorm = normalize(p.nom);
    if (parlementaireByNom.has(nomNorm)) {
      parlementaireByNom.set(nomNorm, null);
    } else {
      parlementaireByNom.set(nomNorm, { id: p.id, prenom: p.prenom });
    }
  }

  let created = 0;
  let createdNonParlementaire = 0;
  let skippedPresident = 0;

  const chambre = 'senat';

  for (const intervention of interventionsData) {
    try {
      const orateurNom = intervention.orateurNom || '';
      const orateurLower = orateurNom.toLowerCase();

      // Ignorer les interventions du président/présidente de séance
      if (orateurLower.includes('président') || orateurLower.includes('présidente') ||
          orateurLower === 'le président' || orateurLower === 'la présidente') {
        skippedPresident++;
        continue;
      }

      // Chercher le parlementaire — matching sécurisé
      let parlementaireId: string | null = null;

      // 1. Par orateurRef (matricule sénateur)
      if (intervention.orateurRef) {
        parlementaireId = parlementaireByRef.get(intervention.orateurRef) || null;
      }

      // 2. Par nom complet (prénom + nom)
      if (!parlementaireId && intervention.orateurPrenom && intervention.orateurNom) {
        const fullName = normalize(`${intervention.orateurPrenom} ${intervention.orateurNom}`);
        parlementaireId = parlementaireByFullName.get(fullName) || null;
      }

      // 3. Par nom seul — même garde-fou que pour l'AN : vérifier le prénom si disponible
      if (!parlementaireId && intervention.orateurNom && !intervention.orateurQualite) {
        const nomNorm = normalize(intervention.orateurNom);
        const candidate = parlementaireByNom.get(nomNorm);
        if (candidate) {
          if (intervention.orateurPrenom) {
            if (normalize(intervention.orateurPrenom) === normalize(candidate.prenom)) {
              parlementaireId = candidate.id;
            }
          } else {
            parlementaireId = candidate.id;
          }
        }
      }

      // Vérifier si l'intervention existe déjà (basé sur seanceId + contenu seul)
      const contentHash = intervention.contenu.substring(0, 200);
      const existing = await prisma.intervention.findFirst({
        where: {
          seanceId: intervention.seanceId,
          contenu: { startsWith: contentHash },
        },
      });
      if (existing) continue;

      // Extraire les mots-clés
      const motsCles = extractKeywords(intervention.contenu);

      await prisma.intervention.create({
        data: {
          parlementaireId,
          orateurNom: intervention.orateurNom,
          orateurPrenom: intervention.orateurPrenom || null,
          orateurQualite: intervention.orateurQualite || null,
          chambre,
          seanceId: intervention.seanceId,
          date: intervention.date,
          ordre: intervention.ordre,
          type: intervention.type,
          contenu: intervention.contenu,
          motsCles,
          sourceUrl: intervention.sourceUrl,
        },
      });

      if (parlementaireId) {
        created++;
      } else {
        createdNonParlementaire++;
      }

    } catch (error: any) {
      logger.warn({ seance: intervention.seanceId, error: error.message }, 'Error syncing intervention Sénat');
    }
  }

  logger.info({
    created,
    createdNonParlementaire,
    total: interventionsData.length,
    skippedPresident,
    matchRate: `${(((created + createdNonParlementaire) / (interventionsData.length || 1)) * 100).toFixed(1)}%`,
  }, 'Interventions Sénat sync completed');

  return { interventions: created + createdNonParlementaire };
}

// =============================================================================
// HELPERS
// =============================================================================

function extractTags(titre: string | null | undefined): string[] {
  if (!titre) return [];
  const tags: string[] = [];
  const titreLower = titre.toLowerCase();

  const keywords: Record<string, string[]> = {
    budget: ['budget', 'finances', 'fiscal', 'impôt'],
    securite: ['sécurité', 'police', 'terrorisme', 'défense'],
    sante: ['santé', 'hôpital', 'médecin', 'vaccination', 'sécu'],
    environnement: ['climat', 'environnement', 'écolog', 'énergie'],
    immigration: ['immigration', 'étranger', 'asile', 'migr'],
    travail: ['travail', 'emploi', 'chômage', 'retraite'],
    education: ['éducation', 'école', 'université', 'enseignement'],
    justice: ['justice', 'pénal', 'tribunal', 'magistrat'],
    europe: ['europe', 'européen', 'union européenne', 'ue'],
    agriculture: ['agricult', 'paysan', 'rural'],
  };

  for (const [tag, patterns] of Object.entries(keywords)) {
    if (patterns.some((p) => titreLower.includes(p))) {
      tags.push(tag);
    }
  }

  return tags;
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const textLower = text.toLowerCase();

  const patterns: Record<string, string[]> = {
    budget: ['budget', 'finances', 'fiscal', 'impôt', 'dette'],
    securite: ['sécurité', 'police', 'terrorisme', 'défense', 'armée'],
    sante: ['santé', 'hôpital', 'médecin', 'vaccination', 'sécu', 'médicament'],
    environnement: ['climat', 'environnement', 'écolog', 'énergie', 'carbone'],
    immigration: ['immigration', 'étranger', 'asile', 'migr', 'frontière'],
    travail: ['travail', 'emploi', 'chômage', 'retraite', 'salaire'],
    education: ['éducation', 'école', 'université', 'enseignement', 'étudiant'],
    justice: ['justice', 'pénal', 'tribunal', 'magistrat', 'prison'],
    europe: ['europe', 'européen', 'bruxelles', 'commission européenne'],
    agriculture: ['agricult', 'paysan', 'rural', 'ferme'],
  };

  for (const [keyword, patterns_list] of Object.entries(patterns)) {
    if (patterns_list.some((p) => textLower.includes(p))) {
      keywords.push(keyword);
    }
  }

  return keywords.slice(0, 5);
}

// =============================================================================
// FULL SYNC
// =============================================================================

// =============================================================================
// SYNC VIDÉOS AN (videos.assemblee-nationale.fr)
// =============================================================================

export async function syncAnVideos(): Promise<{ linked: number }> {
  const { AnVideosClient } = await import('../sources/assemblee-nationale/an-videos-client.js');

  logger.info('Starting AN videos sync...');

  const client = new AnVideosClient();
  const videos = await client.getAllVideos();

  if (videos.length === 0) {
    logger.warn('No AN videos fetched — aborting');
    return { linked: 0 };
  }

  let linked = 0;

  // --- Séances AN ---
  // Build: "YYYY-MM-DD|order" → url
  const seanceVideoMap = new Map<string, string>();
  for (const v of videos) {
    if (v.videoType !== 'seance' || v.seanceOrder === null) continue;
    const key = `${v.isoDate}|${v.seanceOrder}`;
    if (!seanceVideoMap.has(key)) seanceVideoMap.set(key, v.url);
  }

  // Load AN séances with CRSA ref (only these have videos)
  const anSeances = await prisma.reunion.findMany({
    where: {
      type: 'seance',
      compteRenduRef: { startsWith: 'CRSA' },
    },
    select: { id: true, dateDebut: true, compteRenduRef: true },
    orderBy: { dateDebut: 'asc' },
  });

  // Group by date, sort by CRSA number suffix → determines 1ère/2ème/3ème order
  const seancesByDate = new Map<string, typeof anSeances>();
  for (const r of anSeances) {
    const isoDate = r.dateDebut.toISOString().slice(0, 10);
    if (!seancesByDate.has(isoDate)) seancesByDate.set(isoDate, []);
    seancesByDate.get(isoDate)!.push(r);
  }

  for (const [isoDate, daySeances] of seancesByDate) {
    // Sort by CRSA ref number (NXX suffix) → ascending = chronological order
    daySeances.sort((a, b) => {
      const na = parseInt(a.compteRenduRef?.match(/N(\d+)$/)?.[1] ?? '0', 10);
      const nb = parseInt(b.compteRenduRef?.match(/N(\d+)$/)?.[1] ?? '0', 10);
      return na - nb;
    });

    for (let i = 0; i < daySeances.length; i++) {
      const order = i + 1; // 1-indexed
      const url = seanceVideoMap.get(`${isoDate}|${order}`);
      if (url) {
        await prisma.reunion.update({ where: { id: daySeances[i]!.id }, data: { urlVideo: url } });
        linked++;
      }
    }
  }

  logger.info({ linked: linked }, 'AN séances videos linked');

  // --- Commissions AN ---
  // Build: "YYYY-MM-DD|organeRef" → url (first video per commission+day)
  const commissionVideoMap = new Map<string, string>();
  for (const v of videos) {
    if (v.videoType !== 'commission' || !v.organeRef) continue;
    const key = `${v.isoDate}|${v.organeRef}`;
    if (!commissionVideoMap.has(key)) commissionVideoMap.set(key, v.url);
  }

  // Load AN commission meetings
  const anCommissions = await prisma.reunion.findMany({
    where: {
      type: 'commission',
      commission: { chambre: 'assemblee' },
    },
    select: { id: true, dateDebut: true, commission: { select: { organeRef: true } } },
  });

  for (const r of anCommissions) {
    const organeRef = r.commission?.organeRef;
    if (!organeRef) continue;
    const isoDate = r.dateDebut.toISOString().slice(0, 10);
    const url = commissionVideoMap.get(`${isoDate}|${organeRef}`);
    if (url) {
      await prisma.reunion.update({ where: { id: r.id }, data: { urlVideo: url } });
      linked++;
    }
  }

  logger.info({ total: linked }, 'AN videos sync completed');
  return { linked };
}

// =============================================================================
// SYNC VIDÉOS SÉNAT (scraping videos.senat.fr)
// =============================================================================

export async function syncSenatVideos(): Promise<{ linked: number }> {
  const { SenatVideosClient } = await import('../sources/senat/videos-client.js');

  logger.info('Starting Sénat videos sync...');

  const client = new SenatVideosClient();
  const videos = await client.getAllVideos();

  if (videos.length === 0) {
    logger.warn('No Sénat videos fetched — aborting');
    return { linked: 0 };
  }

  // Build lookup: "YYYY-MM-DD|moment" → url
  const videoMap = new Map<string, string>();
  for (const v of videos) {
    const key = `${v.isoDate}|${v.moment}`;
    if (!videoMap.has(key)) videoMap.set(key, v.url);
  }

  // Load Sénat séances from DB
  const reunions = await prisma.reunion.findMany({
    where: { type: 'seance', commission: { chambre: 'senat' } },
    select: { id: true, dateDebut: true },
  });

  logger.info({ reunions: reunions.length, videos: videos.length }, 'Matching videos to séances...');

  let linked = 0;

  for (const r of reunions) {
    const date = r.dateDebut;
    const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const parisHour = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getHours();

    // Heuristic: matin < 13h, apres-midi 13h–20h, soir ≥ 20h
    const moment = parisHour < 13 ? 'matin' : parisHour < 20 ? 'apres-midi' : 'soir';

    const url = videoMap.get(`${isoDate}|${moment}`) || videoMap.get(`${isoDate}|apres-midi`) || null;

    if (url) {
      await prisma.reunion.update({ where: { id: r.id }, data: { urlVideo: url } });
      linked++;
    }
  }

  logger.info({ linked }, 'Sénat videos sync completed');
  return { linked };
}

// =============================================================================
// SYNC RÉUNIONS SÉNAT (scraping comptes rendus HTML)
// =============================================================================

export async function syncSenatReunions(options: { maxWeeks?: number } = {}): Promise<{
  created: number;
  updated: number;
  participantsLinked: number;
  weeksFetched: number;
  pagesParsed: number;
  pagesErrored: number;
}> {
  const { SenatReunionsClient } = await import('../sources/senat/reunions-client.js');

  logger.info({ maxWeeks: options.maxWeeks }, 'Starting Sénat reunions sync (HTML scraping)...');

  const client = new SenatReunionsClient();
  const { reunions, weeksFetched, pagesParsed, pagesErrored } = await client.getAllReunions({
    maxWeeks: options.maxWeeks,
  });

  logger.info({ count: reunions.length, weeksFetched }, 'Sénat reunions fetched — starting DB upsert...');

  // Load commissions by slug for organeReuniRef → commissionId mapping
  const commissions = await prisma.commission.findMany({
    where: { chambre: 'senat' },
    select: { id: true, slug: true },
  });
  const commissionBySlug = new Map(commissions.map((c) => [c.slug, c.id]));

  // Load sénat parlementaires for fuzzy name matching
  // Indexing by normalized "NOM Prénom" to allow fast lookups
  const senateurs = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, nom: true, prenom: true },
  });

  /**
   * Normalize a name for fuzzy matching:
   * - Lowercase, remove diacritics, remove hyphens, collapse spaces
   */
  function normalizeName(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Build lookup: normalized "nom prenom" → id
  const senByNomPrenom = new Map<string, string>();
  // Also: normalized "nom" → id (for last-name-only matches)
  const senByNom = new Map<string, string[]>();
  for (const s of senateurs) {
    const key = normalizeName(`${s.nom} ${s.prenom}`);
    senByNomPrenom.set(key, s.id);
    const nomKey = normalizeName(s.nom);
    if (!senByNom.has(nomKey)) senByNom.set(nomKey, []);
    senByNom.get(nomKey)!.push(s.id);
  }

  /**
   * Match a raw name extracted from HTML to a sénat parlementaire ID.
   * Returns null if no match with sufficient confidence.
   */
  function matchSenateur(rawName: string): string | null {
    // Remove civility prefixes and abbreviations
    const cleaned = rawName
      .replace(/^M(?:me|M)?\.?\s*/i, '')
      .replace(/^M\.\s*/i, '')
      .trim();

    const normalized = normalizeName(cleaned);

    // 1. Exact nom + prénom match
    const exactMatch = senByNomPrenom.get(normalized);
    if (exactMatch) return exactMatch;

    // 2. Try "NOM Prénom" or "Prénom NOM" permutations
    const parts = normalized.split(' ').filter((p) => p.length > 1);

    // Try each part as the surname
    for (const part of parts) {
      const ids = senByNom.get(part);
      if (ids && ids.length === 1) return ids[0]!;
    }

    // 3. Partial match: check if normalized name contains a known full key
    for (const [key, id] of senByNomPrenom) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return id;
      }
    }

    return null;
  }

  let created = 0;
  let updated = 0;
  let participantsLinked = 0;

  for (const r of reunions) {
    try {
      const commissionId = commissionBySlug.get(r.organeReuniRef || '') || null;

      const reunionData = {
        uid: r.uid,
        type: r.type,
        dateDebut: r.dateDebut,
        dateFin: r.dateFin,
        lieu: r.lieu,
        etat: r.etat,
        odjResume: r.odjResume,
        odjComplet: r.odjComplet,
        captationVideo: r.captationVideo,
        ouvertePresse: r.ouvertePresse,
        compteRenduRef: r.compteRenduRef,
        organeRef: r.organeReuniRef || null,
        commissionId,
      };

      const existing = await prisma.reunion.findUnique({ where: { uid: r.uid } });

      let reunionId: string;
      if (existing) {
        await prisma.reunion.update({ where: { id: existing.id }, data: reunionData });
        reunionId = existing.id;
        updated++;
      } else {
        const created_ = await prisma.reunion.create({ data: reunionData });
        reunionId = created_.id;
        created++;
      }

      // Match participants — only for new reunions (compte-rendu passé = données finales)
      if (!existing && (r as any).participantNames?.length > 0) {
        const participantNames = (r as any).participantNames as string[];
        const seen = new Set<string>();
        const records: Array<{ reunionId: string; parlementaireId: string; presence: string }> = [];

        for (const name of participantNames) {
          const parlementaireId = matchSenateur(name);
          if (!parlementaireId || seen.has(parlementaireId)) continue;
          seen.add(parlementaireId);
          records.push({ reunionId, parlementaireId, presence: 'present' });
        }

        if (records.length > 0) {
          await prisma.reunionParticipant.createMany({ data: records, skipDuplicates: true });
          participantsLinked += records.length;
        }
      }
    } catch (err: any) {
      logger.warn({ uid: r.uid, error: err.message }, 'Error syncing Sénat reunion');
    }
  }

  logger.info(
    { created, updated, participantsLinked, weeksFetched, pagesParsed, pagesErrored },
    'Sénat reunions sync completed'
  );

  return { created, updated, participantsLinked, weeksFetched, pagesParsed, pagesErrored };
}

// =============================================================================
// SYNC AGENDA SÉNAT (séances publiques à venir via API senat.fr)
// =============================================================================

export async function syncSenatAgenda(): Promise<{ created: number; updated: number }> {
  const { SenatAgendaClient } = await import('../sources/senat/agenda-client.js');

  logger.info('Starting Sénat agenda sync (upcoming public sessions)...');

  const client = new SenatAgendaClient();
  const seances = await client.getUpcomingSeances(4);

  logger.info({ count: seances.length }, 'Sénat agenda fetched — starting DB upsert...');

  const commission = await prisma.commission.findFirst({
    where: { slug: 'senat-senat-5eme-republique' },
    select: { id: true },
  });
  const commissionId = commission?.id || null;

  if (!commissionId) {
    logger.warn('Commission "senat-senat-5eme-republique" not found — séances will have no commission link');
  }

  let created = 0;
  let updated = 0;

  for (const s of seances) {
    try {
      const reunionData = {
        uid: s.uid,
        type: 'seance' as const,
        dateDebut: s.dateDebut,
        dateFin: null,
        lieu: 'Sénat',
        etat: s.etat,
        odjResume: s.odjResume,
        odjComplet: s.odjItems.join('\n') || null,
        captationVideo: true,
        ouvertePresse: false,
        compteRenduRef: null,
        organeRef: 'PO78718',
        commissionId,
      };

      const existing = await prisma.reunion.findUnique({ where: { uid: s.uid } });

      if (existing) {
        await prisma.reunion.update({ where: { id: existing.id }, data: reunionData });
        updated++;
      } else {
        await prisma.reunion.create({ data: reunionData });
        created++;
      }
    } catch (err: any) {
      logger.warn({ uid: s.uid, error: err.message }, 'Error syncing Sénat agenda séance');
    }
  }

  logger.info({ created, updated, total: seances.length }, 'Sénat agenda sync completed');
  return { created, updated };
}

// =============================================================================
// SYNC SÉANCES ODJ (enrichissement des réunions depuis le CSV AN)
// =============================================================================

export async function syncSeancesODJ(): Promise<{
  updated: number;
  totalCsvRows: number;
  matched: number;
}> {
  const { SeancesODJClient } = await import('../sources/assemblee-nationale/seances-odj-client.js');

  logger.info('Starting séances ODJ sync (CSV enrichment)...');

  const client = new SeancesODJClient(17);
  const seances = await client.getSeancesODJ();

  let updated = 0;
  let matched = 0;

  for (const seance of seances) {
    try {
      // Skip rows with no ODJ content — nothing to enrich
      if (!seance.odjResume && !seance.odjComplet) continue;

      // Find all séances publiques on the same calendar day
      const startOfDay = new Date(`${seance.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${seance.date}T23:59:59.999Z`);

      const candidates = await prisma.reunion.findMany({
        where: {
          type: 'seance',
          dateDebut: { gte: startOfDay, lte: endOfDay },
        },
        select: { id: true, dateDebut: true, odjResume: true, odjComplet: true },
      });

      // seance.dateDebut is already correct UTC (timezone conversion handled by the client)
      const matchingReunions = candidates.filter(
        (r) => r.dateDebut.getUTCHours() === seance.dateDebut.getUTCHours()
      );

      for (const reunion of matchingReunions) {
        matched++;

        // Only enrich if currently empty — existing rich data from the AN ZIP takes priority
        if (reunion.odjResume || reunion.odjComplet) continue;

        await prisma.reunion.update({
          where: { id: reunion.id },
          data: {
            odjResume: seance.odjResume || null,
            odjComplet: seance.odjComplet || null,
          },
        });
        updated++;
      }
    } catch (err: any) {
      logger.warn({ date: seance.date, heure: seance.heure, error: err.message }, 'Error processing séance ODJ row');
    }
  }

  logger.info({ updated, totalCsvRows: seances.length, matched }, 'Séances ODJ sync completed');

  return { updated, totalCsvRows: seances.length, matched };
}

export async function fullSync(): Promise<void> {
  logger.info('Starting full sync (Assemblée Nationale + Sénat)...');
  const startTime = Date.now();

  try {
    // Sync Assemblée Nationale
    const anSyncLog = await prisma.syncLog.create({
      data: {
        source: 'assemblee_nationale',
        dataType: 'deputes',
        type: 'full',
        statut: 'started',
        startedAt: new Date(),
      },
    });

    const deputes = await syncDeputes(true);

    // Mettre à jour l'état de la source
    const anFreshness = await checkSourceFreshness('assemblee_nationale:deputes');
    await updateSourceState(
      'assemblee_nationale:deputes',
      anFreshness.currentEtag,
      anFreshness.currentLastModified,
      { itemsCreated: deputes.created, itemsUpdated: deputes.updated }
    );

    await prisma.syncLog.update({
      where: { id: anSyncLog.id },
      data: {
        statut: 'completed',
        completedAt: new Date(),
        itemsCreated: deputes.created,
        itemsUpdated: deputes.updated,
        metadata: { deputes },
      },
    });

    // Sync Sénat
    const senatSyncLog = await prisma.syncLog.create({
      data: {
        source: 'senat',
        dataType: 'senateurs',
        type: 'full',
        statut: 'started',
        startedAt: new Date(),
      },
    });

    const senateurs = await syncSenateurs(true);

    // Mettre à jour l'état de la source Sénat
    const senatFreshness = await checkSourceFreshness('senat:senateurs');
    await updateSourceState(
      'senat:senateurs',
      senatFreshness.currentEtag,
      senatFreshness.currentLastModified,
      { itemsCreated: senateurs.created, itemsUpdated: senateurs.updated }
    );

    await prisma.syncLog.update({
      where: { id: senatSyncLog.id },
      data: {
        statut: 'completed',
        completedAt: new Date(),
        itemsCreated: senateurs.created,
        itemsUpdated: senateurs.updated,
        metadata: { senateurs },
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info({
      duration: `${duration}s`,
      deputes: deputes.created + deputes.updated,
      senateurs: senateurs.created + senateurs.updated,
    }, 'Full sync completed successfully');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Full sync failed');
    throw error;
  }
}

export async function incrementalSync(): Promise<void> {
  logger.info('Starting incremental sync (AN + Sénat)...');
  await syncDeputes(false);
  await syncSenateurs(false);
  logger.info('Incremental sync completed');
}

// =============================================================================
// SMART SYNC - Sync intelligent basé sur la fraîcheur des sources
// =============================================================================

export interface SmartSyncOptions {
  force?: boolean; // Forcer le sync même si pas de changement
  sources?: string[]; // Sources spécifiques à synchroniser
  all?: boolean; // Tout synchroniser dans le bon ordre
  includeScrutins?: boolean;
  includeAmendements?: boolean;
  includeInterventions?: boolean;
  includeDossiers?: boolean;
  includeLobbying?: boolean;
  includeCommissions?: boolean;
  includeReunions?: boolean;
  includeSenatReunions?: boolean;
  includeSenatAgenda?: boolean;
  includeSenatVideos?: boolean;
  includeAnVideos?: boolean;
  includeSeancesODJ?: boolean;
  scrutinsLimit?: number;
  reunionsLimit?: number;
  amendementsLimit?: number;
  interventionsLimit?: number;
  dossiersLimit?: number;
  lobbyingLimit?: number;
  skipStatsCalculation?: boolean; // Ne pas recalculer les stats après le sync
  skipIAEnrichment?: boolean; // Ne pas lancer l'enrichissement IA après le sync
}

export interface SmartSyncResult {
  sourcesChecked: string[];
  sourcesChanged: string[];
  sourcesSkipped: string[];
  results: Record<string, { created: number; updated: number; skipped?: boolean }>;
  duration: string;
}

/**
 * Smart sync - Vérifie la fraîcheur des sources avant de synchroniser
 * Ne télécharge que les sources qui ont changé depuis le dernier sync
 */
export async function smartSync(options: SmartSyncOptions = {}): Promise<SmartSyncResult> {
  const startTime = Date.now();
  const results: SmartSyncResult = {
    sourcesChecked: [],
    sourcesChanged: [],
    sourcesSkipped: [],
    results: {},
    duration: '0s',
  };

  logger.info({ options }, 'Starting smart sync...');

  // Cache AMELI texte mapping across sync steps to avoid double download
  let cachedTexteMapping: Map<number, { num: string; session: string }> | undefined;

  // Déterminer quelles sources vérifier (ordre important pour les relations)
  let sourcesToCheck: string[];

  if (options.all) {
    // Tout synchroniser dans le bon ordre (relations d'abord)
    sourcesToCheck = [
      // 1. Commissions en premier : syncDeputes() appelle backfillCommissionMandats()
      //    qui requiert que les commissions soient déjà en DB pour lier les mandats
      'assemblee_nationale:commissions',
      // 2. Parlementaires (nécessaires pour les autres sources)
      'assemblee_nationale:deputes',
      'senat:senateurs',
      // 3. Scrutins et votes
      'assemblee_nationale:scrutins',
      'senat:scrutins',
      // 4. Amendements
      'assemblee_nationale:amendements',
      'senat:amendements',
      // 5. Dossiers législatifs (lie scrutins et amendements aux textes de loi)
      'assemblee_nationale:dossiers',
      'senat:dossiers',
      // 6. Interventions
      'dila:interventions',
      'senat:interventions',
      // 7. Lobbying
      'hatvp:lobbyistes',
      // 8. Réunions / Agenda (nécessite commissions + parlementaires)
      'assemblee_nationale:reunions',
      // 9. Séances publiques ODJ (enrichissement CSV — doit venir après reunions)
      'assemblee_nationale:seances_odj',
      // 10. Réunions Sénat (scraping HTML comptes rendus — nécessite commissions Sénat)
      'senat:reunions',
      // 11. Agenda Sénat (séances publiques à venir via API senat.fr)
      'senat:agenda',
      // 12. Vidéos Sénat (scraping videos.senat.fr — lie les replays aux séances)
      'senat:videos',
      // 12. Vidéos AN (videos.assemblee-nationale.fr — séances + commissions)
      'assemblee_nationale:videos',
    ];
  } else {
    sourcesToCheck = options.sources || [
      'assemblee_nationale:deputes',
      'senat:senateurs',
      ...(options.includeCommissions ? ['assemblee_nationale:commissions'] : []),
      ...(options.includeScrutins ? ['assemblee_nationale:scrutins', 'senat:scrutins'] : []),
      ...(options.includeAmendements ? ['assemblee_nationale:amendements', 'senat:amendements'] : []),
      ...(options.includeDossiers ? ['assemblee_nationale:dossiers', 'senat:dossiers'] : []),
      ...(options.includeInterventions ? ['dila:interventions', 'senat:interventions'] : []),
      ...(options.includeLobbying ? ['hatvp:lobbyistes'] : []),
      ...(options.includeReunions ? ['assemblee_nationale:reunions'] : []),
      ...(options.includeSeancesODJ ? ['assemblee_nationale:seances_odj'] : []),
      ...(options.includeSenatReunions ? ['senat:reunions'] : []),
      ...(options.includeSenatAgenda ? ['senat:agenda'] : []),
      ...(options.includeSenatVideos ? ['senat:videos'] : []),
      ...(options.includeAnVideos ? ['assemblee_nationale:videos'] : []),
    ];
  }

  for (const sourceKey of sourcesToCheck) {
    results.sourcesChecked.push(sourceKey);

    try {
      // Vérifier si la source a changé
      const freshness = await checkSourceFreshness(sourceKey);

      if (!freshness.hasChanged && !options.force) {
        logger.info({ sourceKey, lastSyncAt: freshness.lastSyncAt }, 'Source unchanged, skipping');
        results.sourcesSkipped.push(sourceKey);
        results.results[sourceKey] = { created: 0, updated: 0, skipped: true };

        // Mettre à jour la date de dernière vérification
        await updateSourceCheckTime(sourceKey);

        // Logger le skip
        const skipParts = sourceKey.split(':');
        const skipSource = skipParts[0] || 'unknown';
        const skipDataType = skipParts[1] || 'all';
        await prisma.syncLog.create({
          data: {
            source: skipSource,
            dataType: skipDataType,
            type: 'incremental',
            statut: 'skipped',
            startedAt: new Date(),
            completedAt: new Date(),
            metadata: {
              reason: 'source_unchanged',
              lastModified: freshness.currentLastModified,
              etag: freshness.currentEtag,
            },
          },
        });

        continue;
      }

      results.sourcesChanged.push(sourceKey);

      // Créer le log de sync
      const logParts = sourceKey.split(':');
      const logSource = logParts[0] || 'unknown';
      const logDataType = logParts[1] || 'all';
      const syncLog = await prisma.syncLog.create({
        data: {
          source: logSource,
          dataType: logDataType,
          type: 'incremental',
          statut: 'started',
          startedAt: new Date(),
        },
      });

      try {
        // Exécuter le sync approprié
        let syncResult = { created: 0, updated: 0 };

        switch (sourceKey) {
          case 'assemblee_nationale:deputes':
            syncResult = await syncDeputes(false);
            break;

          case 'senat:senateurs':
            syncResult = await syncSenateurs(false);
            break;

          case 'assemblee_nationale:commissions': {
            const commissionsResult = await syncCommissions();
            syncResult = { created: commissionsResult.created, updated: commissionsResult.updated };
            break;
          }

          case 'assemblee_nationale:scrutins': {
            // Si --all et pas de limite explicite, on sync TOUT (undefined = pas de limite)
            const scrutinsResult = await syncScrutins({ limit: options.scrutinsLimit });
            syncResult = { created: scrutinsResult.scrutins, updated: 0 };
            break;
          }

          case 'senat:scrutins': {
            const senatScrutinsResult = await syncScrutinsSenat({ limit: options.scrutinsLimit });
            syncResult = { created: senatScrutinsResult.scrutins, updated: 0 };
            break;
          }

          case 'assemblee_nationale:amendements': {
            const amendementsResult = await syncAmendements({ limit: options.amendementsLimit });
            syncResult = { created: amendementsResult.created, updated: amendementsResult.updated };
            break;
          }

          case 'senat:amendements': {
            const senatAmendementsResult = await syncAmendementsSenatCsv();
            syncResult = { created: senatAmendementsResult.created, updated: senatAmendementsResult.updated };
            // Cache texte mapping to avoid re-downloading AMELI in enrichScrutinsSenatAmendements
            if (senatAmendementsResult.texteMapping) {
              cachedTexteMapping = senatAmendementsResult.texteMapping;
            }
            break;
          }

          case 'dila:interventions': {
            const dilaInterventionsResult = await syncInterventions({ maxSeances: options.interventionsLimit });
            syncResult = { created: dilaInterventionsResult.interventions, updated: 0 };
            break;
          }

          case 'senat:interventions': {
            const senatInterventionsResult = await syncInterventionsSenat({ maxSeances: options.interventionsLimit });
            syncResult = { created: senatInterventionsResult.interventions, updated: 0 };
            break;
          }

          case 'assemblee_nationale:dossiers': {
            const dossiersResult = await syncDossiers({ limit: options.dossiersLimit });
            syncResult = { created: dossiersResult.created, updated: dossiersResult.updated };
            break;
          }

          case 'senat:dossiers': {
            const senatDossiersResult = await syncDossiersSenat({ limit: options.dossiersLimit });
            syncResult = { created: senatDossiersResult.created, updated: senatDossiersResult.updated };
            break;
          }

          case 'hatvp:lobbyistes': {
            const lobbyingResult = await syncLobbyistes({
              limit: options.lobbyingLimit,
              includeActions: true,
            });
            syncResult = lobbyingResult.lobbyistes;
            break;
          }

          case 'assemblee_nationale:reunions': {
            const reunionsResult = await syncReunions({ limit: options.reunionsLimit });
            syncResult = { created: reunionsResult.created, updated: reunionsResult.updated };
            break;
          }

          case 'assemblee_nationale:seances_odj': {
            const odjResult = await syncSeancesODJ();
            syncResult = { created: 0, updated: odjResult.updated };
            break;
          }

          case 'senat:reunions': {
            const senatReunionsResult = await syncSenatReunions({ maxWeeks: options.reunionsLimit });
            syncResult = { created: senatReunionsResult.created, updated: senatReunionsResult.updated };
            break;
          }

          case 'senat:agenda': {
            const senatAgendaResult = await syncSenatAgenda();
            syncResult = { created: senatAgendaResult.created, updated: senatAgendaResult.updated };
            break;
          }

          case 'senat:videos': {
            const senatVideosResult = await syncSenatVideos();
            syncResult = { created: 0, updated: senatVideosResult.linked };
            break;
          }

          case 'assemblee_nationale:videos': {
            const anVideosResult = await syncAnVideos();
            syncResult = { created: 0, updated: anVideosResult.linked };
            break;
          }

          default:
            logger.warn({ sourceKey }, 'Unknown source key');
        }

        results.results[sourceKey] = syncResult;

        // Mettre à jour l'état de la source
        await updateSourceState(
          sourceKey,
          freshness.currentEtag,
          freshness.currentLastModified,
          syncResult
        );

        // Mettre à jour le log
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            statut: 'completed',
            completedAt: new Date(),
            itemsCreated: syncResult.created,
            itemsUpdated: syncResult.updated,
          },
        });

        logger.info({ sourceKey, ...syncResult }, 'Source sync completed');

      } catch (error: any) {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            statut: 'failed',
            completedAt: new Date(),
            error: error.message,
          },
        });
        throw error;
      }

    } catch (error: any) {
      logger.error({ sourceKey, error: error.message }, 'Error syncing source');
      results.results[sourceKey] = { created: 0, updated: 0 };
    }
  }

  // Lier les entités entre elles si des sources pertinentes ont changé
  const hasScrutinsChanged = results.sourcesChanged.some(s => s.includes('scrutins'));
  const hasInterventionsChanged = results.sourcesChanged.some(s => s.includes('interventions'));
  const hasAmendementsChanged = results.sourcesChanged.some(s => s.includes('amendements'));
  const hasDossiersChanged = results.sourcesChanged.some(s => s.includes('dossiers'));

  if (hasInterventionsChanged || hasScrutinsChanged) {
    logger.info('Linking interventions to scrutins...');
    try {
      const linkResult = await linkInterventionsToScrutins();
      logger.info({
        linked: linkResult.linked,
        bySeanceRef: linkResult.bySeanceRef,
        byDate: linkResult.byDate,
      }, 'Interventions linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Interventions linking failed (non-blocking)');
    }
  }

  if (hasAmendementsChanged || hasScrutinsChanged) {
    logger.info('Enriching scrutins with amendements (HTML scraping for new scrutins only)...');
    try {
      // Enrichissement AN: scrape les pages HTML pour les NOUVEAUX scrutins uniquement
      // Pas de reset - on enrichit seulement ceux sans lien (amendements: none)
      // Pour corriger des liens existants, utiliser CLI: sync --enrich-amendements-an --reset
      logger.info('Enriching AN scrutins with HTML scraping...');
      const enrichANResult = await enrichScrutinsANAmendements({
        concurrency: 5,
      });
      logger.info({
        enriched: enrichANResult.enriched,
        notFound: enrichANResult.notFound,
        errors: enrichANResult.errors,
      }, 'AN scrutins enrichment completed');

      // Enrichissement Sénat: scrape les pages HTML pour les NOUVEAUX scrutins uniquement
      // Pas de reset - on enrichit seulement ceux sans lien (amendements: none)
      // Pour corriger des liens existants, utiliser CLI: sync --enrich-amendements-senat --reset
      logger.info('Enriching Sénat scrutins with HTML scraping...');
      const enrichSenatResult = await enrichScrutinsSenatAmendements({
        concurrency: 5,
        texteMapping: cachedTexteMapping,
      });
      logger.info({
        enriched: enrichSenatResult.enriched,
        notFound: enrichSenatResult.notFound,
        errors: enrichSenatResult.errors,
      }, 'Sénat scrutins enrichment completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Scrutins-Amendements enrichment failed (non-blocking)');
    }
  }

  if (hasDossiersChanged || hasScrutinsChanged) {
    // Scrutin→dossier linking MUST run BEFORE scrutin→amendement linking
    // because the CTE requires dossier_id to avoid cross-dossier false positives.
    logger.info('Linking Sénat scrutins to dossiers...');
    try {
      const linkResult = await linkSenatScrutinsToDossiers();
      logger.info({
        linked: linkResult.linked,
      }, 'Sénat scrutins-dossiers linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sénat scrutins-dossiers linking failed (non-blocking)');
    }

    // TF-IDF matching for ALL orphan scrutins (AN + Sénat) — high recall
    logger.info('Linking orphan scrutins to dossiers by TF-IDF...');
    try {
      const tfidfResult = await linkOrphanScrutinsByTFIDF();
      logger.info({
        linked: tfidfResult.linked,
        skipped: tfidfResult.skipped,
      }, 'TF-IDF scrutin-dossier linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'TF-IDF scrutin-dossier linking failed (non-blocking)');
    }

    // AN scrutins-dossiers title matching — safety net for remaining orphans
    logger.info('Linking AN scrutins to dossiers by title matching...');
    try {
      const anLinkResult = await linkANScrutinsByTitle();
      logger.info({
        linked: anLinkResult.linked,
      }, 'AN scrutins-dossiers title linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'AN scrutins-dossiers title linking failed (non-blocking)');
    }

    // Texte_numero linking — structural match via shared texte reference
    logger.info('Linking orphan scrutins by shared texte_numero...');
    try {
      const texteNumResult = await linkOrphanScrutinsByTexteNumero();
      logger.info({
        linked: texteNumResult.linked,
      }, 'Texte_numero orphan linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Texte_numero orphan linking failed (non-blocking)');
    }

    // Loi_titre matching — last resort matching against promulgated law title
    logger.info('Linking orphan scrutins by loi_titre...');
    try {
      const loiTitreResult = await linkOrphansByLoiTitre();
      logger.info({
        linked: loiTitreResult.linked,
      }, 'Loi_titre orphan linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Loi_titre orphan linking failed (non-blocking)');
    }
  }

  if (hasAmendementsChanged || hasScrutinsChanged || hasDossiersChanged) {
    // Link scrutins ↔ amendements via numero matching + dossier constraint
    // Must run AFTER dossier linking (needs dossier_id) and AFTER enrich (HTML scraping)
    logger.info('Linking scrutins to amendements (M:N join table)...');
    try {
      const linkAmResult = await linkScrutinsToAmendements();
      logger.info({
        linked: linkAmResult.linked,
        notFound: linkAmResult.notFound,
      }, 'Scrutins-amendements linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Scrutins-amendements linking failed (non-blocking)');
    }

    // Propagate dossier_id from scrutins to amendements (only fills NULL, never resets)
    logger.info('Propagating dossier_id from scrutins to amendements...');
    try {
      const amdtLinkResult = await linkAmendementsToDossiers();
      logger.info({
        linked: amdtLinkResult.linked,
      }, 'Amendements-dossiers linking via scrutins completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Amendements-dossiers linking via scrutins failed (non-blocking)');
    }

    // Link amendements to dossiers via texte_ref (catches non-voted amendements)
    try {
      const texteRefResult = await linkAmendementsToDossiersByTexteRef();
      logger.info({
        linked: texteRefResult.linked,
      }, 'Amendements-dossiers linking via texteRef completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Amendements-dossiers linking via texteRef failed (non-blocking)');
    }

    // Propagate dossier_id between sibling amendments on same texte_ref (safe: unanimous only)
    try {
      const siblingResult = await propagateDossierIdBySiblingTexteRef();
      logger.info({
        linked: siblingResult.linked,
      }, 'Sibling texte_ref dossier propagation completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sibling texte_ref dossier propagation failed (non-blocking)');
    }

  }

  // Recalculer les stats si des sources ont changé (sauf si skip demandé)
  if (results.sourcesChanged.length > 0 && !options.skipStatsCalculation) {
    logger.info('Recalculating parlementaire stats after sync...');
    try {
      const {
        calculateAllStats,
        calculateAllGroupeStats,
        calculateAllGroupeAlliances,
        calculateAllGroupeThematiques,
      } = await import('./stats-calculator.js');

      // Stats des parlementaires
      const statsResult = await calculateAllStats();
      logger.info({
        total: statsResult.total,
        updated: statsResult.updated,
        errors: statsResult.errors,
        duration: statsResult.duration,
      }, 'Parlementaire stats calculation completed');

      // Stats des groupes (doit être après les stats parlementaires)
      const groupeStatsResult = await calculateAllGroupeStats();
      logger.info({
        total: groupeStatsResult.total,
        updated: groupeStatsResult.updated,
        errors: groupeStatsResult.errors,
        duration: groupeStatsResult.duration,
      }, 'Groupe stats calculation completed');

      // Alliances entre groupes (paires de groupes)
      const alliancesResult = await calculateAllGroupeAlliances();
      logger.info({
        total: alliancesResult.total,
        duration: alliancesResult.duration,
      }, 'Groupe alliances calculation completed');

      // Stats thématiques pour radar chart
      const thematiquesResult = await calculateAllGroupeThematiques();
      logger.info({
        total: thematiquesResult.total,
        duration: thematiquesResult.duration,
      }, 'Groupe thematiques calculation completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Stats calculation failed (non-blocking)');
      // Ne pas faire échouer le sync complet si le calcul des stats échoue
    }
  }

  // Génération incrémentale des sujets (rattache les nouveaux dossiers, crée les sujets manquants)
  if (results.sourcesChanged.length > 0) {
    try {
      const { generateSujets } = await import('./sujet-generator.js');
      const sujetResult = await generateSujets();
      logger.info({
        created: sujetResult.created,
        updated: sujetResult.updated,
        totalDossiers: sujetResult.totalDossiers,
      }, 'Incremental sujet generation completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujet generation failed (non-blocking)');
    }
  }

  // Génération des liens sortants des sujets — famille "construction" (documents officiels AN)
  if (results.sourcesChanged.length > 0) {
    try {
      const { generateSujetLinks } = await import('./sujet-links-generator.js');
      const linksResult = await generateSujetLinks();
      logger.info({
        created: linksResult.created,
        deleted: linksResult.deleted,
        dropped: linksResult.dropped,
      }, 'Sujet links generation completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujet links generation failed (non-blocking)');
    }
  }

  // Recalculer les stats dénormalisées des sujets (date_dernier_vote, scrutin_count, dossier_count)
  // Nécessaire car les nouveaux scrutins sont liés aux dossiers mais pas propagés aux sujets
  if (results.sourcesChanged.length > 0) {
    logger.info('Refreshing sujets denormalized stats...');
    try {
      const refreshStart = Date.now();
      const [sujetsResult] = await Promise.all([
        prisma.$executeRaw`
          UPDATE sujets s SET
            dossier_count = sub.dossier_count,
            scrutin_count = sub.scrutin_count,
            date_dernier_vote = sub.max_date
          FROM (
            SELECT dl.sujet_id,
                   COUNT(DISTINCT dl.id) AS dossier_count,
                   COUNT(sc.id) AS scrutin_count,
                   MAX(sc.date) AS max_date
            FROM dossiers_legislatifs dl
            LEFT JOIN scrutins sc ON sc.dossier_id = dl.id
            WHERE dl.sujet_id IS NOT NULL
            GROUP BY dl.sujet_id
          ) sub
          WHERE s.id = sub.sujet_id
            AND (s.date_dernier_vote IS DISTINCT FROM sub.max_date
                 OR s.scrutin_count IS DISTINCT FROM sub.scrutin_count
                 OR s.dossier_count IS DISTINCT FROM sub.dossier_count)
        `,
      ]);
      logger.info({
        updated: sujetsResult,
        duration: `${((Date.now() - refreshStart) / 1000).toFixed(1)}s`,
      }, 'Sujets stats refresh completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujets stats refresh failed (non-blocking)');
    }
  }

  // VACUUM ANALYZE les tables principales après le sync pour éviter le bloat
  // (les UPSERTs massifs créent des dead tuples → les Index Only Scans dégénèrent en heap fetches)
  if (results.sourcesChanged.length > 0) {
    logger.info('Running VACUUM ANALYZE on main tables...');
    try {
      const vacuumStart = Date.now();
      const tables = [
        'scrutins', 'amendements', 'dossiers_legislatifs',
        'parlementaires', 'votes', 'interventions',
      ];
      for (const table of tables) {
        await prisma.$executeRawUnsafe(`VACUUM ANALYZE ${table}`);
      }
      logger.info({ duration: `${((Date.now() - vacuumStart) / 1000).toFixed(1)}s` }, 'VACUUM ANALYZE completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'VACUUM ANALYZE failed (non-blocking)');
    }
  }

  // Sync déclarations HATVP (avant l'enrichissement IA pour que les données soient disponibles)
  if (results.sourcesChanged.length > 0) {
    try {
      const { syncDeclarationsHATVP } = await import('./declarations-sync.js');
      const declResult = await syncDeclarationsHATVP();
      logger.info({
        matched: declResult.matched, created: declResult.created,
        unmatched: declResult.unmatched, errors: declResult.errors,
      }, 'HATVP declarations sync completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'HATVP declarations sync failed (non-blocking)');
    }
  }

  // Recalcul des statuses des sujets après chaque sync de dossiers
  // (évite les statuses stales quand un dossier passe de adopte → promulgue/rejete)
  if (results.sourcesChanged.length > 0) {
    try {
      const { PrismaClient: PC } = await import('@prisma/client');
      const prismaLocal = new PC();
      await prismaLocal.$executeRaw`
        UPDATE sujets s SET status = (
          SELECT CASE
            WHEN bool_or(dl.etat = 'promulgue') THEN 'promulgue'
            WHEN bool_or(dl.etat = 'rejete')    THEN 'rejete'
            WHEN bool_or(dl.etat = 'adopte')    THEN 'adopte'
            WHEN bool_or(dl.etat = 'en_cours')  THEN 'en_cours'
            WHEN bool_or(dl.etat = 'caduc')     THEN 'caduc'
            ELSE 'retire'
          END
          FROM dossiers_legislatifs dl WHERE dl.sujet_id = s.id
        )
        WHERE EXISTS (SELECT 1 FROM dossiers_legislatifs dl WHERE dl.sujet_id = s.id)
      `;
      await prismaLocal.$disconnect();
      logger.info('Sujet statuses refreshed from dossier etats');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sujet status refresh failed (non-blocking)');
    }
  }

  // IA Enrichment (cascade : scrutins → dossiers → sujets → parlementaires)
  if (results.sourcesChanged.length > 0 && !options.skipIAEnrichment) {
    try {
      const { enrichScrutinsIA, enrichDossiersIA, enrichSujetsIA, enrichSujetGroupeAmendements } = await import('./ia-enrichment.js');

      const iaScrutins = await enrichScrutinsIA({ concurrency: 3 });
      logger.info({
        enriched: iaScrutins.enriched, skipped: iaScrutins.skipped, errors: iaScrutins.errors,
        tokensIn: iaScrutins.totalTokensIn, tokensOut: iaScrutins.totalTokensOut,
      }, 'Scrutins IA enrichment completed');

      const iaDossiers = await enrichDossiersIA({ concurrency: 2 });
      logger.info({
        enriched: iaDossiers.enriched, skipped: iaDossiers.skipped, errors: iaDossiers.errors,
        tokensIn: iaDossiers.totalTokensIn, tokensOut: iaDossiers.totalTokensOut,
      }, 'Dossiers IA enrichment completed');

      const iaSujets = await enrichSujetsIA({ concurrency: 2 });
      logger.info({
        enriched: iaSujets.enriched, skipped: iaSujets.skipped, errors: iaSujets.errors,
        tokensIn: iaSujets.totalTokensIn, tokensOut: iaSujets.totalTokensOut,
      }, 'Sujets IA enrichment completed');

      const iaGroupeAmendements = await enrichSujetGroupeAmendements({ concurrency: 2 });
      logger.info({
        enriched: iaGroupeAmendements.enriched, skipped: iaGroupeAmendements.skipped, errors: iaGroupeAmendements.errors,
        tokensIn: iaGroupeAmendements.totalTokensIn, tokensOut: iaGroupeAmendements.totalTokensOut,
      }, 'Groupe amendement descriptions enrichment completed');

      // Fiches parlementaires enrichies (Wikipedia + Tavily + Mistral)
      const { enrichParlementairesIA } = await import('./parlementaire-enrichment.js');
      const iaParl = await enrichParlementairesIA({ concurrency: 2 });
      logger.info({
        enriched: iaParl.enriched, skipped: iaParl.skipped, errors: iaParl.errors,
        tokensIn: iaParl.totalTokensIn, tokensOut: iaParl.totalTokensOut,
      }, 'Parlementaires IA enrichment completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'IA enrichment failed (non-blocking)');
    }
  }

  results.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  logger.info({
    duration: results.duration,
    checked: results.sourcesChecked.length,
    changed: results.sourcesChanged.length,
    skipped: results.sourcesSkipped.length,
  }, 'Smart sync completed');

  return results;
}

/**
 * Affiche le statut de fraîcheur de toutes les sources
 */
export async function checkSourcesStatus(): Promise<void> {
  logger.info('Checking sources status...');

  for (const sourceKey of Object.keys(SOURCES)) {
    try {
      const freshness = await checkSourceFreshness(sourceKey);
      logger.info({
        source: sourceKey,
        hasChanged: freshness.hasChanged,
        currentLastModified: freshness.currentLastModified,
        previousLastModified: freshness.previousLastModified,
        lastSyncAt: freshness.lastSyncAt,
      }, freshness.hasChanged ? 'Source HAS CHANGED' : 'Source unchanged');
    } catch (error: any) {
      logger.error({ source: sourceKey, error: error.message }, 'Error checking source');
    }
  }
}

// =============================================================================
// SYNC AMENDEMENTS (Assemblée Nationale Open Data)
// =============================================================================

export async function syncAmendements(
  options: { limit?: number; legislature?: number } = {}
): Promise<{ created: number; updated: number; linked: number }> {
  const { AssembleeNationaleClient } = await import('../sources/assemblee-nationale/client.js');

  const legislature = options.legislature || 17;
  logger.info({ legislature, limit: options.limit }, 'Starting amendements AN sync...');

  const amendementClient = new AssembleeNationaleClient(legislature);
  const rawAmendements = await amendementClient.getAmendements(options.limit);

  let created = 0;
  let updated = 0;
  let linked = 0;

  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, nom: true, prenom: true }
  });

  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  const parlementaireNameMap = new Map<string, string>();
  for (const p of parlementaires) {
    parlementaireNameMap.set(normalize(p.nom), p.id);
    const parts = p.nom.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      if (lastName && lastName.length > 3) {
        parlementaireNameMap.set(normalize(lastName), p.id);
      }
    }
  }

  const chambre = 'assemblee';
  const batchSize = 100;
  const batches = Math.ceil(rawAmendements.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const batch = rawAmendements.slice(i * batchSize, (i + 1) * batchSize);

    for (const raw of batch) {
      try {
        const transformed = amendementClient.transformAmendement(raw);

        let parlementaireId: string | null = null;
        if (transformed.auteurLibelle) {
          const libelleRaw = transformed.auteurLibelle
            .replace(/^(M\.|Mme|Mme\.)\s*/i, '')
            .split(',')[0];
          const libelle = normalize(libelleRaw || '');

          for (const [name, id] of parlementaireNameMap) {
            if (libelle.includes(name) || name.includes(libelle)) {
              parlementaireId = id;
              break;
            }
          }
        }

        const existing = await prisma.amendement.findUnique({
          where: { uid: transformed.uid },
        });

        const data = {
          uid: transformed.uid,
          numero: transformed.numero,
          legislature: transformed.legislature,
          chambre,
          parlementaireId,
          auteurRef: transformed.auteurRef,
          groupeRef: transformed.groupeRef,
          auteurLibelle: transformed.auteurLibelle,
          texteRef: transformed.texteLegislatifRef,
          articleVise: transformed.article,
          dispositif: transformed.dispositif,
          exposeSommaire: transformed.exposeSommaire,
          sort: transformed.sort,
          dateDepot: transformed.dateDepot,
          dateSort: transformed.dateSort,
        };

        if (existing) {
          await prisma.amendement.update({
            where: { uid: transformed.uid },
            data,
          });
          updated++;
        } else {
          await prisma.amendement.create({ data });
          created++;
        }

        if (parlementaireId) linked++;
      } catch (error: any) {
        logger.warn({ uid: raw.uid, error: error.message }, 'Error syncing amendement');
      }
    }

    logger.debug({ batch: i + 1, total: batches, created, updated, linked }, 'Batch processed');
  }

  logger.info({ created, updated, linked, total: rawAmendements.length }, 'Amendements AN sync completed');
  return { created, updated, linked };
}

// =============================================================================
// SYNC AMENDEMENTS SÉNAT (data.senat.fr AMELI)
// =============================================================================

export async function syncAmendementsSenat(
  options: { maxAmendements?: number; minYear?: number } = {}
): Promise<{ created: number; updated: number; linked: number }> {
  const { SenatAmendementsClient } = await import('../sources/senat/amendements-client.js');

  logger.info({ maxAmendements: options.maxAmendements, minYear: options.minYear }, 'Starting amendements Sénat sync...');

  const amendementClient = new SenatAmendementsClient();
  const rawAmendements = await amendementClient.getAmendements(options);

  let created = 0;
  let updated = 0;
  let linked = 0;

  // Charger les sénateurs pour le mapping matricule/nom -> parlementaireId
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, sourceId: true, nom: true, prenom: true }
  });

  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  // Map par matricule et par nom
  const parlementaireByMatricule = new Map<string, string>();
  const parlementaireByName = new Map<string, string>();
  for (const p of parlementaires) {
    if (p.sourceId) parlementaireByMatricule.set(p.sourceId, p.id);
    parlementaireByName.set(normalize(p.nom), p.id);
    const parts = p.nom.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      if (lastName && lastName.length > 3) {
        parlementaireByName.set(normalize(lastName), p.id);
      }
    }
  }

  const chambre = 'senat';
  const batchSize = 100;
  const batches = Math.ceil(rawAmendements.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const batch = rawAmendements.slice(i * batchSize, (i + 1) * batchSize);

    for (const amd of batch) {
      try {
        // Chercher le parlementaire
        let parlementaireId: string | null = null;

        // D'abord par matricule
        if (amd.auteurMatricule) {
          parlementaireId = parlementaireByMatricule.get(amd.auteurMatricule) || null;
        }

        // Sinon par nom
        if (!parlementaireId && amd.auteurNom) {
          const nomNorm = normalize(amd.auteurNom);
          parlementaireId = parlementaireByName.get(nomNorm) || null;

          // Recherche partielle
          if (!parlementaireId) {
            for (const [name, id] of parlementaireByName) {
              if (nomNorm.includes(name) || name.includes(nomNorm)) {
                parlementaireId = id;
                break;
              }
            }
          }
        }

        const existing = await prisma.amendement.findUnique({
          where: { uid: amd.uid },
        });

        const data = {
          uid: amd.uid,
          numero: amd.numero,
          legislature: 0, // Non applicable pour le Sénat
          chambre,
          parlementaireId,
          auteurRef: amd.auteurMatricule,
          groupeRef: null,
          auteurLibelle: amd.auteurLibelle,
          texteRef: amd.texteRef,
          articleVise: null,
          dispositif: amd.dispositif,
          exposeSommaire: amd.exposeSommaire,
          sort: amd.sort,
          dateDepot: amd.dateDepot,
          dateSort: null,
        };

        if (existing) {
          await prisma.amendement.update({
            where: { uid: amd.uid },
            data,
          });
          updated++;
        } else {
          await prisma.amendement.create({ data });
          created++;
        }

        if (parlementaireId) linked++;
      } catch (error: any) {
        logger.warn({ uid: amd.uid, error: error.message }, 'Error syncing amendement Sénat');
      }
    }

    if ((i + 1) % 10 === 0) {
      logger.debug({ batch: i + 1, total: batches, created, updated, linked }, 'Batch processed');
    }
  }

  logger.info({ created, updated, linked, total: rawAmendements.length }, 'Amendements Sénat sync completed');
  return { created, updated, linked };
}

// =============================================================================
// SYNC AMENDEMENTS SÉNAT (CSV - source complète commission + séance)
// =============================================================================

export async function syncAmendementsSenatCsv(
  options: { minYear?: number; texteIds?: number[]; } = {}
): Promise<{ created: number; updated: number; linked: number; texteMapping?: Map<number, { num: string; session: string }> }> {
  const { SenatAmendementsClient } = await import('../sources/senat/amendements-client.js');

  logger.info({ options }, 'Starting amendements Sénat CSV sync...');

  const client = new SenatAmendementsClient();

  // 1. Get texte mapping from AMELI (texteId → { num, session })
  logger.info('Fetching AMELI texte mapping...');
  const texteMapping = await client.getTexteMapping();
  logger.info({ textes: texteMapping.size }, 'Texte mapping loaded');

  // 2. Determine which textes to fetch
  let texteIds: number[];

  if (options.texteIds && options.texteIds.length > 0) {
    texteIds = options.texteIds;
  } else {
    // Only fetch recent sessions (current + previous) — historical textes rarely change
    // For a full re-sync of all textes, use --texte-ids or a dedicated backfill command
    const minYear = options.minYear ?? new Date().getFullYear() - 1;
    const recentIds = new Set<number>();
    for (const [texteId, { session }] of texteMapping) {
      const sessionYear = parseInt(session.split('-')[0] ?? '0', 10);
      if (sessionYear >= minYear) {
        recentIds.add(texteId);
      }
    }

    texteIds = Array.from(recentIds);
    logger.info({ texteIds: texteIds.length, minYear }, 'Scoped to recent sessions only');
  }

  // Resolve texteIds to { texteId, texteNum, session } via mapping
  // Deduplicate by (session, texteNum) — multiple texteIds can map to the same CSV
  // (different lectures/stages of the same bill). Pick the largest texteId as canonical.
  const textes: Array<{ texteId: number; texteNum: string; session: string }> = [];
  const unmapped: number[] = [];
  const csvDedup = new Map<string, { texteId: number; texteNum: string; session: string }>();

  for (const texteId of texteIds) {
    const mapping = texteMapping.get(texteId);
    if (mapping) {
      const csvKey = `${mapping.session}/${mapping.num}`;
      const existing = csvDedup.get(csvKey);
      // Keep the largest texteId (most recent lecture) as canonical
      if (!existing || texteId > existing.texteId) {
        csvDedup.set(csvKey, { texteId, texteNum: mapping.num, session: mapping.session });
      }
    } else {
      unmapped.push(texteId);
    }
  }

  textes.push(...csvDedup.values());

  if (unmapped.length > 0) {
    logger.warn({ count: unmapped.length, sample: unmapped.slice(0, 5) }, 'Texte IDs not found in AMELI mapping');
  }

  logger.info({ textes: textes.length, deduped: texteIds.length - unmapped.length - textes.length }, 'Fetching CSV amendements (deduplicated by session/texteNum)...');

  // 3. Load sénateurs for author matching (once, kept in memory — ~350 entries)
  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'senat' },
    select: { id: true, sourceId: true, nom: true, prenom: true }
  });

  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  const parlementaireByMatricule = new Map<string, string>();
  const parlementaireByName = new Map<string, string>();
  for (const p of parlementaires) {
    if (p.sourceId) parlementaireByMatricule.set(p.sourceId, p.id);
    parlementaireByName.set(normalize(p.nom), p.id);
    const parts = p.nom.trim().split(/\s+/);
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      if (lastName && lastName.length > 3) {
        parlementaireByName.set(normalize(lastName), p.id);
      }
    }
  }

  let created = 0;
  let updated = 0;
  let linked = 0;
  let totalAmendements = 0;
  const chambre = 'senat';

  // 4. Process each texte: fetch CSV → batch upsert → release memory
  // Uses batch queries per texte instead of individual findFirst+update/create per amendment
  // Reduces from 2*N queries per texte to 3 queries (1 findMany + 1 createMany + 1 batch update)
  type CsvAmendement = Awaited<ReturnType<typeof client.fetchCsvForTexte>>[number];

  // Helper: resolve parlementaire for an amendment
  const resolveParlementaire = (amd: CsvAmendement): string | null => {
    let parlementaireId: string | null = null;
    if (amd.auteurMatricule) {
      parlementaireId = parlementaireByMatricule.get(amd.auteurMatricule) || null;
    }
    if (!parlementaireId && amd.auteurNom) {
      const nomNorm = normalize(amd.auteurNom);
      parlementaireId = parlementaireByName.get(nomNorm) || null;
      if (!parlementaireId) {
        for (const [name, id] of parlementaireByName) {
          if (nomNorm.includes(name) || name.includes(nomNorm)) {
            parlementaireId = id;
            break;
          }
        }
      }
    }
    return parlementaireId;
  };

  let amendments: CsvAmendement[] = [];

  for (let ti = 0; ti < textes.length; ti++) {
    const texte = textes[ti]!;

    try {
      amendments = await client.fetchCsvForTexte(texte.texteId, texte.texteNum, texte.session);

      if (amendments.length === 0) continue;

      const texteRef = `SENAT-TXT-${texte.texteId}`;

      // 1. Fetch ALL existing amendments for this texte in ONE query
      const existingAmds = await prisma.amendement.findMany({
        where: { chambre, texteRef },
        select: { id: true, numero: true },
      });
      const existingByNumero = new Map(existingAmds.map(a => [a.numero, a.id]));

      // 2. Partition into creates and updates
      const toCreate: Array<{
        uid: string; numero: string; legislature: number; chambre: string;
        parlementaireId: string | null; auteurRef: string | null; groupeRef: string | null;
        auteurLibelle: string | null; texteRef: string; articleVise: string | null;
        dispositif: string | null; exposeSommaire: string | null; sort: string | null;
        dateDepot: Date | null; dateSort: Date | null; sourceUrl: string | null;
      }> = [];
      const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

      for (const amd of amendments) {
        const parlementaireId = resolveParlementaire(amd);
        if (parlementaireId) linked++;

        const data = {
          numero: amd.numero,
          legislature: 0,
          chambre,
          parlementaireId,
          auteurRef: amd.auteurMatricule,
          groupeRef: null as string | null,
          auteurLibelle: amd.auteurLibelle,
          texteRef,
          articleVise: amd.articleVise || null,
          dispositif: amd.dispositif,
          exposeSommaire: amd.exposeSommaire,
          sort: amd.sort,
          dateDepot: amd.dateDepot,
          dateSort: null as Date | null,
          sourceUrl: amd.sourceUrl,
        };

        const existingId = existingByNumero.get(amd.numero);
        if (existingId) {
          toUpdate.push({ id: existingId, data });
        } else {
          toCreate.push({ uid: amd.uid, ...data });
        }
      }

      // 3. Batch create new amendments (single query)
      if (toCreate.length > 0) {
        await prisma.amendement.createMany({
          data: toCreate,
          skipDuplicates: true, // safety: skip if uid already exists
        });
        created += toCreate.length;
      }

      // 4. Batch update existing amendments in transaction chunks
      if (toUpdate.length > 0) {
        const CHUNK_SIZE = 200;
        for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
          const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
          await prisma.$transaction(
            chunk.map(u => prisma.amendement.update({
              where: { id: u.id },
              data: u.data,
            }))
          );
        }
        updated += toUpdate.length;
      }

      totalAmendements += amendments.length;
    } catch (error: any) {
      logger.warn({ texteId: texte.texteId, error: error.message }, 'Error processing texte CSV');
    }

    // Release references for GC
    amendments = [];

    if ((ti + 1) % 20 === 0 || ti === textes.length - 1) {
      logger.info({ texte: ti + 1, total: textes.length, created, updated, linked, totalAmendements }, 'CSV sync progress');
    }
  }

  logger.info({ created, updated, linked, totalAmendements }, 'Amendements Sénat CSV sync completed');
  return { created, updated, linked, texteMapping };
}

// =============================================================================
// SYNC DOSSIERS LÉGISLATIFS (Assemblée Nationale)
// =============================================================================

export async function syncDossiers(
  options: { limit?: number; linkScrutins?: boolean } = {}
): Promise<{ created: number; updated: number; scrutinsLinked: number; amendementsLinked: number; commissionsLinked: number }> {
  const linkScrutins = options.linkScrutins ?? true;
  logger.info({ limit: options.limit, linkScrutins }, 'Starting dossiers législatifs sync...');

  const client = new DossiersLegislatifsClient(17);
  const dossiers = await client.getDossiers(options.limit);

  let created = 0;
  let updated = 0;
  let scrutinsLinked = 0;
  let amendementsLinked = 0;
  let commissionsLinked = 0;

  // Batch load all commissions for organeRef lookup (avoids N queries in the loop)
  const commissions = await prisma.commission.findMany({
    select: { id: true, organeRef: true },
  });
  const commissionByOrganeRef = new Map(
    commissions.filter(c => c.organeRef).map(c => [c.organeRef!, c.id]),
  );
  // COMSENAT redirects: PO* UIDs from dossier saisines → SENAT-* commission IDs
  for (const [poUid, senatId] of comsenatRedirects) {
    commissionByOrganeRef.set(poUid, senatId);
  }

  for (const dossier of dossiers) {
    try {
      const data = {
        uid: dossier.uid,
        legislature: dossier.legislature,
        titre: dossier.titre,
        titreCourt: dossier.titreCourt,
        procedureCode: dossier.procedureCode,
        procedureLibelle: dossier.procedureLibelle,
        urlAN: dossier.urlAN,
        urlSenat: dossier.urlSenat,
        etat: dossier.etat,
        dateDepot: dossier.dateDepot,
        dateAdoption: dossier.dateAdoption,
        loiNumero: dossier.loiNumero,
        loiTitre: dossier.loiTitre,
        loiDateJO: dossier.loiDateJO,
        urlLegifrance: dossier.urlLegifrance,
        sourceData: dossier.sourceData as object,
      };

      const existing = await prisma.dossierLegislatif.findUnique({
        where: { uid: dossier.uid },
      });

      let dossierId: string;

      if (existing) {
        await prisma.dossierLegislatif.update({
          where: { uid: dossier.uid },
          data,
        });
        dossierId = existing.id;
        updated++;
      } else {
        const created_record = await prisma.dossierLegislatif.create({ data });
        dossierId = created_record.id;
        created++;
      }

      // Lier les scrutins au dossier via voteRefs
      if (linkScrutins && dossier.voteRefs.length > 0) {
        for (const voteRef of dossier.voteRefs) {
          // voteRef format: VTANR5L17V451 -> extract numero 451
          const match = voteRef.match(/VTANR5L\d+V(\d+)/);
          if (match && match[1]) {
            const numero = parseInt(match[1], 10);
            const result = await prisma.scrutin.updateMany({
              where: {
                numero,
                chambre: 'assemblee',
                dossierId: null, // Only update if not already linked
              },
              data: { dossierId },
            });
            if (result.count > 0) {
              scrutinsLinked += result.count;
              logger.debug({ voteRef, numero, dossierId }, 'Linked scrutin to dossier');
            }
          }
        }
      }

      // Lier les amendements au dossier via texteRefs
      if (dossier.texteRefs.length > 0) {
        const result = await prisma.amendement.updateMany({
          where: {
            texteRef: { in: dossier.texteRefs },
            dossierId: null,
          },
          data: { dossierId },
        });
        if (result.count > 0) {
          amendementsLinked += result.count;
        }
      }

      // Lier les commissions au dossier via sourceData
      if (dossier.sourceData) {
        const saisines = extractCommissionSaisines(dossier.sourceData);
        for (const saisine of saisines) {
          const commissionId = commissionByOrganeRef.get(saisine.organeRef);
          if (!commissionId) {
            logger.debug({ organeRef: saisine.organeRef, dossierUid: dossier.uid }, 'Commission not found for organeRef — skipping');
            continue;
          }
          const result = await prisma.dossierCommission.upsert({
            where: {
              dossierId_commissionId_role: {
                dossierId,
                commissionId,
                role: saisine.role,
              },
            },
            create: { dossierId, commissionId, role: saisine.role },
            update: {},
          });
          if (result) commissionsLinked++;
        }
      }

    } catch (e: any) {
      logger.warn({ uid: dossier.uid, error: e.message }, 'Failed to upsert dossier');
    }
  }

  // Propagate urlLegifrance to Sénat dossiers sharing the same loi_numero
  // (Sénat source doesn't provide this field, but it's the same law)
  const propagated = await prisma.$executeRaw`
    UPDATE dossiers_legislatifs senat
    SET url_legifrance = an.url_legifrance
    FROM dossiers_legislatifs an
    WHERE senat.loi_numero = an.loi_numero
      AND senat.url_legifrance IS NULL
      AND an.url_legifrance IS NOT NULL
      AND senat.id != an.id
  `;
  if (propagated > 0) {
    logger.info({ propagated }, 'Propagated urlLegifrance to Sénat dossiers');
  }

  logger.info({ created, updated, scrutinsLinked, amendementsLinked, commissionsLinked, total: dossiers.length }, 'Dossiers législatifs sync completed');
  return { created, updated, scrutinsLinked, amendementsLinked, commissionsLinked };
}

// =============================================================================
// SYNC DOSSIERS SÉNAT (via DOSLEG)
// =============================================================================

const SENAT_DOSSIERS_SESSION_START = parseInt(process.env.SENAT_SESSION_START || '2020', 10);
const SENAT_DOSSIERS_SESSION_END = parseInt(process.env.SENAT_SESSION_END || String(new Date().getFullYear()), 10);

export async function syncDossiersSenat(
  options: { limit?: number; linkScrutins?: boolean } = {}
): Promise<{ created: number; updated: number; scrutinsLinked: number }> {
  const linkScrutins = options.linkScrutins ?? true;
  logger.info({ limit: options.limit, linkScrutins }, 'Starting dossiers Sénat sync (DOSLEG)...');

  const client = new SenatDossiersClient();
  const dossiers = await client.getDossiers({
    sessionStart: SENAT_DOSSIERS_SESSION_START,
    sessionEnd: SENAT_DOSSIERS_SESSION_END,
    limit: options.limit,
  });

  let created = 0;
  let updated = 0;
  let scrutinsLinked = 0;

  // Build a map of ref -> dossierId for linking scrutins
  const refToDossierId = new Map<string, string>();

  for (const dossier of dossiers) {
    try {
      const data = {
        uid: dossier.uid,
        legislature: 0, // Sénat n'a pas de législature
        titre: dossier.titre,
        titreCourt: dossier.titreCourt,
        procedureCode: dossier.procedureCode,
        procedureLibelle: dossier.procedureLibelle,
        urlSenat: dossier.urlSenat,
        urlAN: dossier.urlAN,
        etat: dossier.etat,
        loiNumero: dossier.loiNumero,
        loiDateJO: dossier.loiDateJO,
      };

      const existing = await prisma.dossierLegislatif.findUnique({
        where: { uid: dossier.uid },
      });

      let dossierId: string;

      if (existing) {
        await prisma.dossierLegislatif.update({
          where: { uid: dossier.uid },
          data,
        });
        dossierId = existing.id;
        updated++;
      } else {
        const created_record = await prisma.dossierLegislatif.create({ data });
        dossierId = created_record.id;
        created++;
      }

      // Store ref -> dossierId mapping
      refToDossierId.set(dossier.ref, dossierId);

    } catch (e: any) {
      logger.warn({ uid: dossier.uid, error: e.message }, 'Failed to upsert dossier Sénat');
    }
  }

  // Link scrutins to dossiers via sourceData.dossierRef
  // Use a single SQL query to avoid loading all dossiers into memory
  if (linkScrutins) {
    logger.info('Linking Sénat scrutins to dossiers (SQL join)...');

    // Single UPDATE query with JOIN - no memory overhead!
    // Note: use snake_case table names (Prisma @@map)
    const result = await prisma.$executeRaw`
      UPDATE scrutins s
      SET dossier_id = d.id
      FROM dossiers_legislatifs d
      WHERE s.chambre = 'senat'
        AND s.dossier_id IS NULL
        AND s.source_data->>'dossierRef' IS NOT NULL
        AND d.uid = 'SENAT-' || LOWER(s.source_data->>'dossierRef')
    `;

    scrutinsLinked = result;
    logger.info({ scrutinsLinked }, 'Sénat scrutins linked to dossiers');
  }

  logger.info({ created, updated, scrutinsLinked, total: dossiers.length }, 'Dossiers Sénat sync completed');
  return { created, updated, scrutinsLinked };
}

// =============================================================================
// LINK SENAT SCRUTINS TO DOSSIERS
// =============================================================================

/**
 * Lie les scrutins Sénat aux dossiers législatifs existants via sourceData.dossierRef
 * Cette fonction peut être appelée indépendamment du sync des dossiers.
 * Utilise une requête SQL UPDATE avec JOIN pour éviter de charger tous les dossiers en mémoire.
 */
export async function linkSenatScrutinsToDossiers(): Promise<{ linked: number }> {
  logger.info('Linking Sénat scrutins to dossiers (SQL join)...');

  // Single UPDATE query with JOIN - no memory overhead!
  // Note: use snake_case table names (Prisma @@map)
  const result = await prisma.$executeRaw`
    UPDATE scrutins s
    SET dossier_id = d.id
    FROM dossiers_legislatifs d
    WHERE s.chambre = 'senat'
      AND s.dossier_id IS NULL
      AND s.source_data->>'dossierRef' IS NOT NULL
      AND d.uid = 'SENAT-' || LOWER(s.source_data->>'dossierRef')
  `;

  logger.info({ linked: result }, 'Sénat scrutins linked to dossiers');
  return { linked: result };
}

// =============================================================================
// LINK AN SCRUTINS TO DOSSIERS BY TITLE MATCHING
// =============================================================================

/**
 * Lie les scrutins AN orphelins aux dossiers législatifs par matching de titre.
 * Utilise le champ `titre` du dossier (pas titre_court qui est un slug pour les dossiers AN).
 * Ne matche que AN scrutins -> AN dossiers pour éviter le cross-chamber linking.
 * Pass 1: Matchs uniques (1 seul dossier matche)
 * Pass 2: Matchs ambigus (plusieurs dossiers) - disambiguë par proximité de date
 */
export async function linkANScrutinsByTitle(): Promise<{ linked: number }> {
  logger.info('Linking AN scrutins to dossiers by title matching...');

  // First: clean up any wrong cross-chamber links (AN scrutins on SENAT dossiers)
  const cleaned = await prisma.$executeRaw`
    UPDATE scrutins SET dossier_id = NULL
    FROM dossiers_legislatifs d
    WHERE scrutins.dossier_id = d.id
      AND scrutins.chambre = 'assemblee'
      AND d.uid LIKE 'SENAT%'
  `;
  if (cleaned > 0) {
    logger.info({ cleaned }, 'Cleaned cross-chamber AN→SENAT links');
  }

  // Pass 1: Match unique via titre du dossier (substring match dans scrutin.titre)
  // Only AN scrutins against AN dossiers (uid NOT LIKE 'SENAT%')
  const uniqueMatches = await prisma.$executeRaw`
    WITH unique_matches AS (
      SELECT s.id as scrutin_id, MIN(d.id) as dossier_id
      FROM scrutins s
      CROSS JOIN dossiers_legislatifs d
      WHERE s.chambre = 'assemblee'
        AND s.dossier_id IS NULL
        AND d.uid NOT LIKE 'SENAT%'
        AND d.titre IS NOT NULL
        AND LENGTH(d.titre) > 15
        AND LOWER(s.titre) LIKE '%' || LOWER(d.titre) || '%'
      GROUP BY s.id
      HAVING COUNT(DISTINCT d.id) = 1
    )
    UPDATE scrutins SET dossier_id = um.dossier_id
    FROM unique_matches um WHERE scrutins.id = um.scrutin_id
  `;

  logger.info({ uniqueMatches }, 'Pass 1 (unique title matches) completed');

  // Pass 2: Ambigus - disambiguër par proximité de date
  // Same chamber filter: AN scrutins only match AN dossiers
  const dateMatches = await prisma.$executeRaw`
    WITH ranked AS (
      SELECT s.id as scrutin_id, d.id as dossier_id,
        ROW_NUMBER() OVER (
          PARTITION BY s.id
          ORDER BY ABS(EXTRACT(EPOCH FROM (s.date - COALESCE(d.date_depot, d.created_at))))
        ) as rn
      FROM scrutins s
      CROSS JOIN dossiers_legislatifs d
      WHERE s.chambre = 'assemblee'
        AND s.dossier_id IS NULL
        AND d.uid NOT LIKE 'SENAT%'
        AND d.titre IS NOT NULL
        AND LENGTH(d.titre) > 15
        AND LOWER(s.titre) LIKE '%' || LOWER(d.titre) || '%'
    )
    UPDATE scrutins SET dossier_id = r.dossier_id
    FROM ranked r WHERE scrutins.id = r.scrutin_id AND r.rn = 1
  `;

  logger.info({ dateMatches }, 'Pass 2 (date-disambiguated matches) completed');

  const linked = uniqueMatches + dateMatches;
  logger.info({ linked }, 'AN scrutins-dossiers title linking completed');
  return { linked };
}

// =============================================================================
// LINK ORPHAN SCRUTINS TO DOSSIERS VIA TF-IDF
// =============================================================================

/** Minimum cosine similarity to accept a TF-IDF match.
 *  Benchmark: scores < 0.25 are clearly false positives,
 *  0.25-0.30 are borderline, 0.30+ are reliable matches. */
const MIN_TFIDF_SIMILARITY = 0.30;

/** TF-IDF score above which we skip Jaccard validation (rare tokens = high confidence). */
const HIGH_CONFIDENCE_TFIDF = 0.60;

/** Minimum Jaccard similarity (token-set overlap) for mid-confidence matches.
 *  Catches false positives where TF-IDF scores 0.30-0.60 on shared generic tokens. */
const MIN_JACCARD_SIMILARITY = 0.30;

/**
 * Lie les scrutins orphelins (dossier_id IS NULL) aux dossiers législatifs
 * via TF-IDF + cosine similarity sur les titres preprocessés.
 *
 * Matching par chambre séparé pour éviter le cross-chamber linking.
 * Les dossiers existent souvent en doublon AN/Sénat (même loi, deux UIDs).
 */
export async function linkOrphanScrutinsByTFIDF(): Promise<{ linked: number; skipped: number }> {
  const { preprocessTitle, tokenize, extractSubject, jaccardSimilarity } = await import('../utils/preprocess-scrutin.js');
  const { TfidfVectorizer, bestMatch } = await import('../utils/tfidf.js');

  let totalLinked = 0;
  let totalSkipped = 0;

  for (const chambre of ['assemblee', 'senat'] as const) {
    // 1. Load dossiers for this chamber
    const dossierFilter = chambre === 'senat'
      ? Prisma.sql`d.uid LIKE 'SENAT%'`
      : Prisma.sql`d.uid NOT LIKE 'SENAT%'`;

    const dossiers = await prisma.$queryRaw<{ id: string; titre: string }[]>`
      SELECT id,
        CASE
          WHEN titre ~ '^[a-zàâäéèêëïîôùûüÿçœæ]' AND procedure_libelle IS NOT NULL
          THEN procedure_libelle || ' ' || titre
          ELSE titre
        END AS titre
      FROM dossiers_legislatifs d
      WHERE ${dossierFilter}
        AND titre IS NOT NULL AND LENGTH(titre) > 5
    `;

    if (dossiers.length === 0) {
      logger.info({ chambre }, 'No dossiers found for TF-IDF matching, skipping');
      continue;
    }

    // 2. Load orphan scrutins for this chamber
    const orphans = await prisma.$queryRaw<{ id: string; titre: string }[]>`
      SELECT id, titre FROM scrutins
      WHERE chambre = ${chambre}
        AND dossier_id IS NULL
        AND titre IS NOT NULL AND LENGTH(titre) > 5
    `;

    if (orphans.length === 0) {
      logger.info({ chambre }, 'No orphan scrutins found for TF-IDF matching, skipping');
      continue;
    }

    logger.info({ chambre, dossiers: dossiers.length, orphans: orphans.length }, 'Starting TF-IDF matching');

    // 3. Preprocess titles
    const dossierTexts = dossiers.map(d => preprocessTitle(d.titre));
    const scrutinTexts = orphans.map(s => preprocessTitle(s.titre));

    // 4. TF-IDF: fit on dossiers (corpus), transform both
    const vectorizer = new TfidfVectorizer();
    const dossierVectors = vectorizer.fitTransform(dossierTexts);
    const scrutinVectors = vectorizer.transform(scrutinTexts);

    logger.info({ chambre, vocabularySize: vectorizer.vocabularySize }, 'TF-IDF vectors computed');

    // 5. For each orphan scrutin, find best matching dossier
    const updates: { scrutinId: string; dossierId: string; score: number }[] = [];

    // Pre-compute token sets for Jaccard validation
    const dossierTokenSets = dossiers.map(d => tokenize(extractSubject(d.titre)));
    const scrutinTokenSets = orphans.map(s => tokenize(extractSubject(s.titre)));

    let jaccardRejected = 0;

    for (let i = 0; i < orphans.length; i++) {
      const match = bestMatch(scrutinVectors[i], dossierVectors);
      if (match.index >= 0 && match.score >= MIN_TFIDF_SIMILARITY) {
        // Jaccard post-validation: skip for high-confidence TF-IDF matches
        if (match.score < HIGH_CONFIDENCE_TFIDF) {
          const jaccard = jaccardSimilarity(scrutinTokenSets[i], dossierTokenSets[match.index]);
          if (jaccard < MIN_JACCARD_SIMILARITY) {
            jaccardRejected++;
            continue;
          }
        }

        updates.push({
          scrutinId: orphans[i].id,
          dossierId: dossiers[match.index].id,
          score: match.score,
        });
      }
    }

    if (jaccardRejected > 0) {
      logger.info({ chambre, jaccardRejected }, 'TF-IDF matches rejected by Jaccard validation');
    }

    // Log score distribution for monitoring
    if (updates.length > 0) {
      const scores = updates.map(u => u.score).sort((a, b) => a - b);
      const p10 = scores[Math.floor(scores.length * 0.1)] || 0;
      const p50 = scores[Math.floor(scores.length * 0.5)] || 0;
      const p90 = scores[Math.floor(scores.length * 0.9)] || 0;
      const min = scores[0];
      const max = scores[scores.length - 1];
      logger.info({
        chambre, count: updates.length,
        min: min.toFixed(3), p10: p10.toFixed(3),
        p50: p50.toFixed(3), p90: p90.toFixed(3), max: max.toFixed(3),
      }, 'TF-IDF score distribution');
    }

    // 6. Batch UPDATE via single SQL with VALUES — avoids N round-trips
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    let chambreLinked = 0;
    if (updates.length > 0) {
      for (let batch = 0; batch < updates.length; batch += 500) {
        const chunk = updates.slice(batch, batch + 500);
        // Safety: validate UUIDs before raw SQL interpolation
        for (const u of chunk) {
          if (!UUID_RE.test(u.scrutinId) || !UUID_RE.test(u.dossierId)) {
            throw new Error(`Invalid UUID in TF-IDF update: ${u.scrutinId} / ${u.dossierId}`);
          }
        }
        // Build VALUES clause: ('scrutin_id', 'dossier_id'), ...
        const valuesList = chunk
          .map(u => `('${u.scrutinId}','${u.dossierId}')`)
          .join(',');
        const result = await prisma.$executeRawUnsafe(`
          UPDATE scrutins s
          SET dossier_id = v.dossier_id
          FROM (VALUES ${valuesList}) AS v(scrutin_id, dossier_id)
          WHERE s.id = v.scrutin_id AND s.dossier_id IS NULL
        `);
        chambreLinked += result;
      }
    }

    const chambreSkipped = orphans.length - chambreLinked;
    totalLinked += chambreLinked;
    totalSkipped += chambreSkipped;

    logger.info({
      chambre,
      linked: chambreLinked,
      skipped: chambreSkipped,
      total: orphans.length,
    }, 'TF-IDF matching completed for chamber');
  }

  logger.info({ linked: totalLinked, skipped: totalSkipped }, 'TF-IDF scrutin-dossier linking completed');
  return { linked: totalLinked, skipped: totalSkipped };
}

// =============================================================================
// LINK AMENDEMENTS TO DOSSIERS (via scrutin → dossier)
// =============================================================================

/**
 * Propage dossier_id des scrutins vers les amendements.
 * Si un amendement est lié (M:N) à un scrutin qui a un dossier_id,
 * on set l'amendement.dossier_id à la même valeur.
 * Sûr seulement si le M:N amendement-scrutin est correct.
 */
export async function linkAmendementsToDossiers(): Promise<{ linked: number }> {
  logger.info('Propagating dossier_id from scrutins to amendements...');

  const linked = await prisma.$executeRaw`
    UPDATE amendements a
    SET dossier_id = s.dossier_id
    FROM "_AmendementToScrutin" ats
    JOIN scrutins s ON ats."B" = s.id
    WHERE ats."A" = a.id
      AND a.dossier_id IS NULL
      AND s.dossier_id IS NOT NULL
  `;

  logger.info({ linked }, 'Amendements-dossiers linking completed');
  return { linked };
}

/**
 * Lie les amendements aux dossiers via texte_ref.
 * Extrait les texteRefs de chaque dossier (sourceData JSON) et matche
 * avec amendements.texte_ref. Ne touche pas les liens existants.
 */
export async function linkAmendementsToDossiersByTexteRef(): Promise<{ linked: number }> {
  logger.info('Linking amendements to dossiers by texte_ref...');

  const dossiers = await prisma.dossierLegislatif.findMany({
    select: { id: true, sourceData: true },
  });

  let totalLinked = 0;

  for (const dossier of dossiers) {
    const texteRefs = extractTexteRefsFromSourceData(dossier.sourceData);
    if (texteRefs.length === 0) continue;

    const result = await prisma.amendement.updateMany({
      where: {
        texteRef: { in: texteRefs },
        dossierId: null,
      },
      data: { dossierId: dossier.id },
    });

    if (result.count > 0) {
      totalLinked += result.count;
      logger.debug({ dossierId: dossier.id, refs: texteRefs.length, linked: result.count }, 'Linked amendements by texteRef');
    }
  }

  logger.info({ linked: totalLinked }, 'Amendements-dossiers texteRef linking completed');
  return { linked: totalLinked };
}

/**
 * Propage dossier_id entre amendements sur le même texte_ref.
 * SAFETY: ne propage que si TOUS les amendements avec dossier_id sur ce texte_ref
 * sont unanimes (même dossier). Si conflit → skip.
 */
export async function propagateDossierIdBySiblingTexteRef(): Promise<{ linked: number }> {
  logger.info('Propagating dossier_id between sibling amendments on same texte_ref (safe mode)...');

  const linked = await prisma.$executeRaw`
    UPDATE amendements a
    SET dossier_id = sibling.dossier_id
    FROM (
      SELECT texte_ref, MIN(dossier_id) as dossier_id
      FROM amendements
      WHERE dossier_id IS NOT NULL AND texte_ref IS NOT NULL
      GROUP BY texte_ref
      HAVING COUNT(DISTINCT dossier_id) = 1
    ) sibling
    WHERE a.texte_ref = sibling.texte_ref
      AND a.dossier_id IS NULL
  `;

  logger.info({ linked }, 'Sibling texte_ref dossier propagation completed (safe mode)');
  return { linked };
}

/** Extrait récursivement tous les texteRefs du sourceData brut d'un dossier AN */
function extractTexteRefsFromSourceData(sourceData: unknown): string[] {
  if (!sourceData || typeof sourceData !== 'object') return [];
  const refs: string[] = [];

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }

    if (node.texteAssocie) {
      if (typeof node.texteAssocie === 'string') {
        refs.push(node.texteAssocie);
      } else if (Array.isArray(node.texteAssocie)) {
        for (const t of node.texteAssocie) {
          if (typeof t === 'string') refs.push(t);
          else if (t?.refTexteAssocie) refs.push(t.refTexteAssocie);
        }
      } else if (node.texteAssocie.refTexteAssocie) {
        refs.push(node.texteAssocie.refTexteAssocie);
      }
    }
    if (typeof node.texteAdopte === 'string') {
      refs.push(node.texteAdopte);
    }

    // Recurse into nested actes
    if (node.actesLegislatifs?.acteLegislatif) {
      const nested = node.actesLegislatifs.acteLegislatif;
      (Array.isArray(nested) ? nested : [nested]).forEach(walk);
    }
  }

  const sd = sourceData as any;
  if (sd.actesLegislatifs?.acteLegislatif) {
    const actes = sd.actesLegislatifs.acteLegislatif;
    (Array.isArray(actes) ? actes : [actes]).forEach(walk);
  }

  return [...new Set(refs)];
}

// =============================================================================
// LINK INTERVENTIONS TO SCRUTINS
// =============================================================================

/**
 * Lie les interventions aux scrutins via seanceRef ou date.
 * Utilise des requêtes SQL UPDATE avec JOIN pour éviter les OOM.
 */
export async function linkInterventionsToScrutins(
  options: { chambre?: 'assemblee' | 'senat'; dryRun?: boolean } = {}
): Promise<{ linked: number; bySeanceRef: number; byDate: number }> {
  const chambre = options.chambre;
  const dryRun = options.dryRun ?? false;
  // Pour le filtre SQL: si chambre est null, on matche tout
  const chambreFilter = chambre || '%';

  logger.info({ chambre: chambre || 'all', dryRun }, 'Starting interventions-scrutins linking (SQL optimized)...');

  let bySeanceRef = 0;
  let byDate = 0;

  if (dryRun) {
    // Mode dry-run: compter sans modifier
    const countBySeanceRef = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM interventions i
      JOIN scrutins s ON i.seance_id = s.seance_ref AND i.chambre = s.chambre
      WHERE i.scrutin_id IS NULL
        AND s.seance_ref IS NOT NULL
        AND i.chambre LIKE ${chambreFilter}
    `;
    bySeanceRef = Number(countBySeanceRef[0]?.count || 0);

    const countByDate = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM interventions i
      JOIN scrutins s ON DATE(i.date) = DATE(s.date) AND i.chambre = s.chambre
      WHERE i.scrutin_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM interventions i2 WHERE i2.scrutin_id = s.id
        )
        AND i.chambre LIKE ${chambreFilter}
    `;
    byDate = Number(countByDate[0]?.count || 0);

    logger.info({ bySeanceRef, byDate, dryRun }, 'Interventions-scrutins linking completed (dry-run)');
    return { linked: bySeanceRef + byDate, bySeanceRef, byDate };
  }

  // Stratégie 1: Matcher par seanceRef (le plus précis) - Single SQL UPDATE
  const resultSeanceRef = await prisma.$executeRaw`
    UPDATE interventions i
    SET scrutin_id = s.id
    FROM scrutins s
    WHERE i.seance_id = s.seance_ref
      AND i.chambre = s.chambre
      AND i.scrutin_id IS NULL
      AND s.seance_ref IS NOT NULL
      AND i.chambre LIKE ${chambreFilter}
  `;
  bySeanceRef = resultSeanceRef;
  logger.info({ bySeanceRef }, 'Linked interventions by seanceRef');

  // Stratégie 2: Matcher par date + chambre - Single SQL UPDATE
  // Seulement pour les scrutins qui n'ont toujours pas d'interventions liées
  const resultByDate = await prisma.$executeRaw`
    UPDATE interventions i
    SET scrutin_id = s.id
    FROM scrutins s
    WHERE DATE(i.date) = DATE(s.date)
      AND i.chambre = s.chambre
      AND i.scrutin_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM interventions i2 WHERE i2.scrutin_id = s.id
      )
      AND i.chambre LIKE ${chambreFilter}
  `;
  byDate = resultByDate;
  logger.info({ byDate }, 'Linked interventions by date');

  const linked = bySeanceRef + byDate;
  logger.info({ linked, bySeanceRef, byDate }, 'Interventions-scrutins linking completed');
  return { linked, bySeanceRef, byDate };
}

// =============================================================================
// LINK SCRUTINS TO AMENDEMENTS
// =============================================================================

/**
 * Lie les scrutins aux amendements en utilisant le numéro ET le texte législatif.
 *
 * IMPORTANT: Le numéro d'amendement seul n'est PAS unique !
 * Il existe des dizaines d'amendements "n°2" sur différents textes.
 * On doit donc matcher sur le couple (numéro amendement, numéro texte).
 *
 * Pour l'AN: on extrait le numéro de texte depuis sourceData.objet ou le titre
 * et on le compare avec texte_ref de l'amendement (ex: PIONANR5L17B2364 contient "2364")
 *
 * Pour le Sénat: traité séparément car le format texteRef est différent (SENAT-TXT-XXXXXX)
 */
export async function linkScrutinsToAmendements(
  options: { chambre?: 'assemblee' | 'senat'; dryRun?: boolean; reset?: boolean } = {}
): Promise<{ linked: number; notFound: number }> {
  const chambre = options.chambre;
  const dryRun = options.dryRun ?? false;
  const reset = options.reset ?? false;

  logger.info({ chambre: chambre || 'all', dryRun, reset }, 'Starting scrutins-amendements linking (M:N join table)...');

  // Si reset est demandé, réinitialiser les liens existants via la table de jonction
  if (reset && !dryRun) {
    const resetCount = chambre
      ? await prisma.$executeRaw`
          DELETE FROM "_AmendementToScrutin" ats
          USING scrutins s
          WHERE ats."B" = s.id AND s.chambre = ${chambre}
        `
      : await prisma.$executeRaw`DELETE FROM "_AmendementToScrutin"`;
    logger.info({ resetCount }, 'Reset existing amendement links');
  }

  let totalLinked = 0;
  let totalNotFound = 0;

  // Helper: condition "scrutin not yet linked" = no row in join table
  // Used in CTEs below as: NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)

  // === ASSEMBLÉE NATIONALE ===
  if (!chambre || chambre === 'assemblee') {
    if (dryRun) {
      const countResult = await prisma.$queryRaw<{ linked: bigint; not_found: bigint }[]>`
        WITH scrutins_with_info AS (
          SELECT
            s.id,
            s.dossier_id,
            SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero,
            (s.titre ILIKE '%rectifi%' OR s.titre ILIKE '%(rect.)%') as is_rectifie,
            LOWER(SUBSTRING(s.titre FROM '(?:après l''article|à l''article|article)\s+(premier|\d+)')) as article_numero,
            s.titre ILIKE '%après l''article%' as is_apres,
            COALESCE(
              SUBSTRING(s.source_data->'objet'->>'referenceLegislative' FROM 'B(?:TC)?([0-9]{3,5})'),
              SUBSTRING(s.titre FROM '(?:projet|proposition|texte)[^0-9]*n[°º]?\s*([0-9]{3,5})')
            ) as texte_numero
          FROM scrutins s
          WHERE s.titre ILIKE '%amendement%'
            AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
            AND s.chambre = 'assemblee'
        ),
        amendements_with_texte AS (
          SELECT
            a.id,
            a.dossier_id,
            a.numero,
            SPLIT_PART(a.numero, ' ', 1) as numero_clean,
            a.numero LIKE '% (Rect%' as is_rect,
            LOWER(SUBSTRING(a.article_vise FROM 'ART\.\s+(PREMIER|\d+)')) as article_num,
            a.article_vise ILIKE 'APRÈS%' as amdt_is_apres,
            SUBSTRING(a.texte_ref FROM 'B(?:TC)?([0-9]+)') as amendement_texte_numero
          FROM amendements a
          WHERE a.chambre = 'assemblee'
        ),
        matched AS (
          SELECT swn.id, awt.id as amendement_id
          FROM scrutins_with_info swn
          LEFT JOIN amendements_with_texte awt ON
            awt.numero_clean = swn.amendement_numero
            -- REQUIRE at least texte_numero OR dossier_id to avoid cross-dossier false positives
            AND (
              (swn.texte_numero IS NOT NULL AND awt.amendement_texte_numero = swn.texte_numero)
              OR (swn.dossier_id IS NOT NULL AND awt.dossier_id = swn.dossier_id)
            )
            AND (swn.article_numero IS NULL OR awt.article_num = swn.article_numero)
            AND (swn.article_numero IS NULL OR awt.amdt_is_apres = swn.is_apres)
          WHERE swn.amendement_numero IS NOT NULL
        )
        SELECT
          COUNT(CASE WHEN amendement_id IS NOT NULL THEN 1 END)::bigint as linked,
          COUNT(CASE WHEN amendement_id IS NULL THEN 1 END)::bigint as not_found
        FROM matched
      `;
      totalLinked += Number(countResult[0]?.linked || 0);
      totalNotFound += Number(countResult[0]?.not_found || 0);
    } else {
      // INSERT into join table for AN
      // numero_clean strips suffixes like " (Rect)" from amendement numbers.
      // is_rectifie detects "rectifié" or "(rect.)" in scrutin title.
      // article_numero extracts the article number from the scrutin title to disambiguate
      //   same-numbered amendements on different articles of the same dossier.
      // ORDER BY prefers matching rectified↔rectified and plain↔plain.
      // dossier_id constraint avoids cross-dossier false positives when texte_numero is NULL.
      const resultAN = await prisma.$executeRaw`
        WITH scrutins_with_info AS (
          SELECT
            s.id,
            s.dossier_id,
            SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero,
            (s.titre ILIKE '%rectifi%' OR s.titre ILIKE '%(rect.)%') as is_rectifie,
            LOWER(SUBSTRING(s.titre FROM '(?:après l''article|à l''article|article)\s+(premier|\d+)')) as article_numero,
            s.titre ILIKE '%après l''article%' as is_apres,
            COALESCE(
              SUBSTRING(s.source_data->'objet'->>'referenceLegislative' FROM 'B(?:TC)?([0-9]{3,5})'),
              SUBSTRING(s.titre FROM '(?:projet|proposition|texte)[^0-9]*n[°º]?\s*([0-9]{3,5})')
            ) as texte_numero
          FROM scrutins s
          WHERE s.titre ILIKE '%amendement%'
            AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
            AND s.chambre = 'assemblee'
        ),
        amendements_with_texte AS (
          SELECT
            a.id,
            a.dossier_id,
            a.numero,
            SPLIT_PART(a.numero, ' ', 1) as numero_clean,
            a.numero LIKE '% (Rect%' as is_rect,
            LOWER(SUBSTRING(a.article_vise FROM 'ART\.\s+(PREMIER|\d+)')) as article_num,
            a.article_vise ILIKE 'APRÈS%' as amdt_is_apres,
            SUBSTRING(a.texte_ref FROM 'B(?:TC)?([0-9]+)') as amendement_texte_numero
          FROM amendements a
          WHERE a.chambre = 'assemblee'
        ),
        best_match AS (
          SELECT DISTINCT ON (swn.id) swn.id as scrutin_id, awt.id as amendement_id
          FROM scrutins_with_info swn
          INNER JOIN amendements_with_texte awt ON
            awt.numero_clean = swn.amendement_numero
            -- REQUIRE at least texte_numero OR dossier_id to avoid cross-dossier false positives
            AND (
              (swn.texte_numero IS NOT NULL AND awt.amendement_texte_numero = swn.texte_numero)
              OR (swn.dossier_id IS NOT NULL AND awt.dossier_id = swn.dossier_id)
            )
            AND (swn.article_numero IS NULL OR awt.article_num = swn.article_numero)
            AND (swn.article_numero IS NULL OR awt.amdt_is_apres = swn.is_apres)
          WHERE swn.amendement_numero IS NOT NULL
          ORDER BY swn.id,
            CASE WHEN swn.article_numero IS NOT NULL AND awt.article_num = swn.article_numero THEN 0 ELSE 1 END,
            CASE WHEN swn.texte_numero IS NOT NULL AND awt.amendement_texte_numero = swn.texte_numero THEN 0 ELSE 1 END,
            CASE WHEN swn.is_rectifie = awt.is_rect THEN 0 ELSE 1 END,
            awt.id
        )
        INSERT INTO "_AmendementToScrutin" ("A", "B")
        SELECT amendement_id, scrutin_id FROM best_match
        ON CONFLICT DO NOTHING
      `;
      totalLinked += resultAN;

      // Compter les non trouvés pour AN
      const notFoundAN = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM scrutins s
        WHERE s.titre ILIKE '%amendement%'
          AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
          AND s.chambre = 'assemblee'
          AND SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') IS NOT NULL
      `;
      totalNotFound += Number(notFoundAN[0]?.count || 0);
    }
    logger.info({ chambre: 'assemblee', linked: totalLinked, notFound: totalNotFound }, 'AN linking done');
  }

  // === SÉNAT ===
  if (!chambre || chambre === 'senat') {
    const linkedBeforeSenat = totalLinked;

    // Propagate dossier_id to Sénat amendments via texte_ref:
    // Many Sénat amendments lack dossier_id but share texte_ref with ones that have it.
    // Only propagate when one texte_ref maps to exactly one dossier (safety check).
    if (!dryRun) {
      const propagated = await prisma.$executeRaw`
        UPDATE amendements a
        SET dossier_id = sub.dossier_id
        FROM (
          SELECT DISTINCT a2.texte_ref, a2.dossier_id
          FROM amendements a2
          WHERE a2.chambre = 'senat'
            AND a2.dossier_id IS NOT NULL
            AND a2.texte_ref IS NOT NULL
        ) sub
        WHERE a.texte_ref = sub.texte_ref
          AND a.chambre = 'senat'
          AND a.dossier_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM amendements a3
            WHERE a3.texte_ref = sub.texte_ref
              AND a3.dossier_id IS NOT NULL
              AND a3.dossier_id != sub.dossier_id
          )
      `;
      if (propagated > 0) {
        logger.info({ propagated }, 'Propagated dossierId to Sénat amendments via texte_ref');
      }
    }

    if (dryRun) {
      // Sénat dry-run: extract ALL amendment numbers from title using regexp_matches
      // Titles like "amendements identiques n°4, n°9 et n°12" yield 3 rows per scrutin
      const countSenat = await prisma.$queryRaw<{ linked: bigint; not_found: bigint }[]>`
        WITH scrutins_senat AS (
          SELECT
            s.id,
            s.dossier_id,
            m[1] as amendement_numero,
            (s.titre ILIKE '%rectifi%' OR s.titre ILIKE '%(rect.)%') as is_rectifie
          FROM scrutins s,
            LATERAL regexp_matches(s.titre, 'n[°º]\\s*([A-Z]*-?\\d+)', 'g') AS m
          WHERE s.titre ILIKE '%amendement%'
            AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
            AND s.chambre = 'senat'
            AND s.dossier_id IS NOT NULL
        ),
        ranked AS (
          SELECT ss.id, ss.amendement_numero, a.id as amendement_id,
            ROW_NUMBER() OVER (
              PARTITION BY ss.id, ss.amendement_numero
              ORDER BY CASE WHEN ss.is_rectifie = (a.numero LIKE '% (Rect%') THEN 0 ELSE 1 END, a.id
            ) as rn
          FROM scrutins_senat ss
          LEFT JOIN amendements a ON
            SPLIT_PART(a.numero, ' ', 1) = ss.amendement_numero
            AND a.chambre = 'senat'
            AND a.dossier_id = ss.dossier_id
          WHERE ss.amendement_numero IS NOT NULL
        )
        SELECT
          COUNT(CASE WHEN amendement_id IS NOT NULL THEN 1 END)::bigint as linked,
          COUNT(CASE WHEN amendement_id IS NULL THEN 1 END)::bigint as not_found
        FROM ranked WHERE rn = 1
      `;
      totalLinked += Number(countSenat[0]?.linked || 0);
      totalNotFound += Number(countSenat[0]?.not_found || 0);
    } else {
      // INSERT into join table for Sénat
      // Sénat amendment numbering is per-text, so we can ONLY safely link when the
      // scrutin has a dossier_id (gives us context to identify the right text).
      // Without dossier_id, matching just by numero produces massive false positives
      // (e.g. "amendement n° 3" appears in 20+ different scrutins on different texts).
      //
      // Uses regexp_matches with 'g' flag to extract ALL amendment numbers from titles
      // like "amendements identiques n°4, n°9 et n°12" → creates M:N links.
      // ROW_NUMBER instead of DISTINCT ON: keeps best match per (scrutin, numero) pair.
      const resultSenat = await prisma.$executeRaw`
        WITH scrutins_senat AS (
          SELECT
            s.id,
            s.dossier_id,
            m[1] as amendement_numero,
            (s.titre ILIKE '%rectifi%' OR s.titre ILIKE '%(rect.)%') as is_rectifie
          FROM scrutins s,
            LATERAL regexp_matches(s.titre, 'n[°º]\\s*([A-Z]*-?\\d+)', 'g') AS m
          WHERE s.titre ILIKE '%amendement%'
            AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
            AND s.chambre = 'senat'
            AND s.dossier_id IS NOT NULL
        ),
        best_match AS (
          SELECT scrutin_id, amendement_id FROM (
            SELECT ss.id as scrutin_id, a.id as amendement_id,
              ROW_NUMBER() OVER (
                PARTITION BY ss.id, ss.amendement_numero
                ORDER BY CASE WHEN ss.is_rectifie = (a.numero LIKE '% (Rect%') THEN 0 ELSE 1 END, a.id
              ) as rn
            FROM scrutins_senat ss
            INNER JOIN amendements a ON
              SPLIT_PART(a.numero, ' ', 1) = ss.amendement_numero
              AND a.chambre = 'senat'
              AND a.dossier_id = ss.dossier_id
            WHERE ss.amendement_numero IS NOT NULL
          ) ranked WHERE rn = 1
        )
        INSERT INTO "_AmendementToScrutin" ("A", "B")
        SELECT amendement_id, scrutin_id FROM best_match
        ON CONFLICT DO NOTHING
      `;
      totalLinked += resultSenat;

      const notFoundSenat = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT s.id) as count
        FROM scrutins s
        WHERE s.titre ILIKE '%amendement%'
          AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
          AND s.chambre = 'senat'
          AND s.dossier_id IS NOT NULL
      `;
      totalNotFound += Number(notFoundSenat[0]?.count || 0);
    }
    logger.info({ chambre: 'senat', linked: totalLinked - linkedBeforeSenat }, 'Sénat linking done');
  }

  // === PROPAGATION: dossierId from amendement → scrutin (Sénat only) ===
  // When a scrutin votes on an amendement that belongs to a dossier,
  // the scrutin should also be linked to that dossier.
  // NOTE: AN scrutins get dossier_id exclusively from linkANScrutinsByTitle (title matching).
  // Reverse-propagating from amendments for AN would cause contamination if the CTE
  // ever matched a wrong amendment (the wrong dossier_id would stick across runs).
  // SAFETY: For Sénat scrutins with sourceData.dossierRef, only propagate if
  // the amendment's dossier matches the expected ref (prevents cross-dossier contamination).
  if (!dryRun) {
    // Sénat scrutins: validate dossierRef matches before propagating
    const propagatedSenat = await prisma.$executeRaw`
      UPDATE scrutins s
      SET dossier_id = a.dossier_id
      FROM "_AmendementToScrutin" ats
      JOIN amendements a ON a.id = ats."A"
      JOIN dossiers_legislatifs d ON d.id = a.dossier_id
      WHERE s.id = ats."B"
        AND s.chambre = 'senat'
        AND s.dossier_id IS NULL
        AND a.dossier_id IS NOT NULL
        AND (
          s.source_data->>'dossierRef' IS NULL
          OR d.uid = 'SENAT-' || LOWER(s.source_data->>'dossierRef')
        )
    `;
    if (propagatedSenat > 0) {
      logger.info({ propagatedSenat }, 'Propagated dossierId from amendements to Sénat scrutins');
    }
  }

  logger.info({ linked: totalLinked, notFound: totalNotFound, dryRun }, 'Scrutins-amendements linking completed');
  return { linked: totalLinked, notFound: totalNotFound };
}

// =============================================================================
// ENRICH SCRUTINS AN - Scrape HTML to get amendment links
// =============================================================================

/**
 * Enrichit les scrutins AN en scrappant la page HTML pour extraire le lien vers l'amendement.
 * Les données Open Data AN ne contiennent pas la référence à l'amendement, donc on doit
 * aller chercher cette info sur la page web du scrutin.
 *
 * Le lien a le format: /dyn/17/amendements/{texteNumero}/{commission}/{amendementNumero}
 * Exemple: /dyn/17/amendements/2364/AN/2
 *
 * On utilise ce lien pour construire la clé de matching : texteNumero + amendementNumero
 */
export async function enrichScrutinsANAmendements(
  options: { limit?: number; dryRun?: boolean; concurrency?: number; reset?: boolean } = {}
): Promise<{ enriched: number; notFound: number; errors: number; resetCount?: number }> {
  const dryRun = options.dryRun ?? false;
  const concurrency = options.concurrency ?? 3; // Limiter les requêtes parallèles pour éviter le rate limiting
  const limitCount = options.limit;
  const reset = options.reset ?? false;

  logger.info({ dryRun, concurrency, limit: limitCount, reset }, 'Starting AN scrutins enrichment (scraping HTML)...');

  // Si reset demandé, réinitialiser les liens existants via la table de jonction
  let resetCount = 0;
  if (reset) {
    const countToReset = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT ats."B") as count
      FROM "_AmendementToScrutin" ats
      JOIN scrutins s ON ats."B" = s.id
      WHERE s.chambre = 'assemblee'
        AND s.titre ILIKE '%amendement%'
    `;
    const countVal = Number(countToReset[0]?.count || 0);

    if (countVal === 0) {
      logger.info('No AN amendement links to reset - skipping');
    } else if (!dryRun) {
      const result = await prisma.$executeRaw`
        DELETE FROM "_AmendementToScrutin" ats
        USING scrutins s
        WHERE ats."B" = s.id
          AND s.chambre = 'assemblee'
          AND s.titre ILIKE '%amendement%'
      `;
      resetCount = Number(result);
      logger.info({ resetCount }, 'Reset existing AN amendement links');
    } else {
      resetCount = countVal;
      logger.info({ wouldReset: resetCount }, 'Would reset AN amendement links (dry-run)');
    }
  }

  // Charger les scrutins AN qui mentionnent "amendement" mais n'ont pas d'amendement lié
  const scrutinsToEnrich = await prisma.scrutin.findMany({
    where: {
      chambre: 'assemblee',
      titre: { contains: 'amendement', mode: 'insensitive' },
      amendements: { none: {} },
    },
    select: {
      id: true,
      numero: true,
      titre: true,
      sourceUrl: true,
      session: true,
      dossierId: true,
    },
    take: limitCount,
    orderBy: { numero: 'desc' }, // Plus récents d'abord
  });

  logger.info({ count: scrutinsToEnrich.length }, 'Scrutins to enrich');

  if (scrutinsToEnrich.length === 0) {
    return { enriched: 0, notFound: 0, errors: 0 };
  }

  // Charger tous les amendements AN pour le matching rapide
  // Clé: "{texteNumero}-{amendementNumero}" -> { id, dossierId }
  const amendementsAN = await prisma.amendement.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, numero: true, texteRef: true, dossierId: true },
  });

  const amendementMap = new Map<string, { id: string; dossierId: string | null }>();
  for (const a of amendementsAN) {
    if (a.texteRef && a.numero) {
      // Extraire le numéro de texte depuis texte_ref (format: PIONANR5L17B2364 ou PRJLANR5L17BTC2364)
      const texteMatch = a.texteRef.match(/B(?:TC)?(\d+)/);
      if (texteMatch) {
        const texteNumero = texteMatch[1];
        const key = `${texteNumero}-${a.numero}`.toUpperCase();
        amendementMap.set(key, { id: a.id, dossierId: a.dossierId });
        // Also map base number without "(Rect)" suffix for rectified amendments
        // HTML links use bare number "4" but DB stores "4 (Rect)"
        const baseNumero = a.numero.replace(/\s*\(Rect[^)]*\)/i, '').trim();
        if (baseNumero !== a.numero) {
          const baseKey = `${texteNumero}-${baseNumero}`.toUpperCase();
          if (!amendementMap.has(baseKey)) {
            amendementMap.set(baseKey, { id: a.id, dossierId: a.dossierId });
          }
        }
      }
    }
  }

  logger.info({ amendementMapSize: amendementMap.size }, 'Amendment map built');

  let enriched = 0;
  let notFound = 0;
  let errors = 0;

  // Import axios pour les requêtes HTTP
  const axios = (await import('axios')).default;

  // Regex pour extraire TOUS les liens vers amendements
  // Format: href="...amendements/{texteNumero}/{commission}/{amendementNumero}"
  const amendementLinkRegex = /href="[^"]*\/amendements\/(\d+)\/([A-Z]+)\/(\d+)"/gi;

  // Traiter les scrutins avec un rate limit
  const enrichLimit = pLimit(concurrency);

  const results = await Promise.all(
    scrutinsToEnrich.map((scrutin) =>
      enrichLimit(async () => {
        try {
          // Construire l'URL de la page du scrutin
          // Note: l'URL correcte utilise le numéro simple, pas l'UID complet
          const legislature = scrutin.session || '17';
          const url = `https://www.assemblee-nationale.fr/dyn/${legislature}/scrutins/${scrutin.numero}`;

          // Fetch la page HTML
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)',
            },
          });

          const html = response.data as string;

          // Extraire TOUS les liens vers amendements
          const allMatches = [...html.matchAll(amendementLinkRegex)];
          if (allMatches.length === 0) {
            logger.debug({ scrutinNumero: scrutin.numero }, 'No amendment link found in HTML');
            return { status: 'notFound' as const };
          }

          // Collecter tous les amendements trouvés (avec validation dossier)
          const foundAmendementIds: string[] = [];
          let dossierFiltered = 0;
          for (const match of allMatches) {
            const [, texteNumero, , amendementNumero] = match;
            const key = `${texteNumero}-${amendementNumero}`.toUpperCase();
            const amendement = amendementMap.get(key);
            if (amendement) {
              // Skip if both scrutin and amendement have dossier_id but they differ
              // This prevents cross-dossier false links when BTC texte references are shared
              if (scrutin.dossierId && amendement.dossierId && scrutin.dossierId !== amendement.dossierId) {
                dossierFiltered++;
                continue;
              }
              if (!foundAmendementIds.includes(amendement.id)) {
                foundAmendementIds.push(amendement.id);
              }
            }
          }

          if (foundAmendementIds.length === 0) {
            logger.debug({ scrutinNumero: scrutin.numero, matchCount: allMatches.length }, 'Amendments not found in database');
            return { status: 'notFound' as const };
          }

          // Connecter tous les amendements trouvés (M:N)
          if (!dryRun) {
            await prisma.scrutin.update({
              where: { id: scrutin.id },
              data: {
                amendements: {
                  connect: foundAmendementIds.map(id => ({ id })),
                },
              },
            });
          }

          if (dossierFiltered > 0) {
            logger.debug({ scrutinNumero: scrutin.numero, dossierFiltered }, 'Skipped cross-dossier amendment matches');
          }
          logger.debug({ scrutinNumero: scrutin.numero, amendementCount: foundAmendementIds.length, dryRun }, 'Amendments linked');
          return { status: 'enriched' as const };
        } catch (error: any) {
          logger.warn({ scrutinNumero: scrutin.numero, error: error.message }, 'Error enriching scrutin');
          return { status: 'error' as const };
        }
      })
    )
  );

  // Compter les résultats
  for (const result of results) {
    if (result.status === 'enriched') enriched++;
    else if (result.status === 'notFound') notFound++;
    else errors++;
  }

  logger.info({ enriched, notFound, errors, resetCount, dryRun }, 'AN scrutins enrichment completed');
  return { enriched, notFound, errors, resetCount };
}

// =============================================================================
// ENRICH SCRUTINS SENAT - Scrape HTML to get amendment links
// =============================================================================

/**
 * Enrichit les scrutins Sénat en scrappant la page HTML pour extraire le lien vers l'amendement.
 * Les données DOSLEG ne contiennent que le numéro d'amendement, pas la référence au texte,
 * ce qui cause des erreurs de matching quand plusieurs amendements ont le même numéro.
 *
 * Le lien a le format: /amendements/{session}/{texteNumero}/Amdt_{amendementNumero}.html
 * Exemple: /amendements/2025-2026/265/Amdt_72.html
 *
 * Comme on ne peut pas mapper directement le texteNumero visible (265) vers le texte_ref interne
 * (SENAT-TXT-106870), on utilise une combinaison de:
 * - Session extraite de l'URL (ex: 2025-2026 -> filtre par année)
 * - Numéro d'amendement
 * - Date du scrutin (pour matcher avec date_depot proche)
 */
export async function enrichScrutinsSenatAmendements(
  options: { limit?: number; dryRun?: boolean; concurrency?: number; reset?: boolean; texteMapping?: Map<number, { num: string; session: string }> } = {}
): Promise<{ enriched: number; notFound: number; errors: number; resetCount?: number }> {
  const dryRun = options.dryRun ?? false;
  const concurrency = options.concurrency ?? 3;
  const limitCount = options.limit;
  const reset = options.reset ?? false;

  logger.info({ dryRun, concurrency, limit: limitCount, reset }, 'Starting Sénat scrutins enrichment (scraping HTML)...');

  // Si reset demandé, réinitialiser les liens existants via la table de jonction
  let resetCount = 0;
  if (reset) {
    const countToReset = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT ats."B") as count
      FROM "_AmendementToScrutin" ats
      JOIN scrutins s ON ats."B" = s.id
      WHERE s.chambre = 'senat'
        AND (s.titre ILIKE '%amendement%' OR s.titre ILIKE '%motion%')
    `;
    const countVal = Number(countToReset[0]?.count || 0);

    if (countVal === 0) {
      logger.info('No Sénat amendement links to reset - skipping');
    } else if (!dryRun) {
      const result = await prisma.$executeRaw`
        DELETE FROM "_AmendementToScrutin" ats
        USING scrutins s
        WHERE ats."B" = s.id
          AND s.chambre = 'senat'
          AND (s.titre ILIKE '%amendement%' OR s.titre ILIKE '%motion%')
      `;
      resetCount = Number(result);
      logger.info({ resetCount }, 'Reset existing Sénat amendement links');
    } else {
      resetCount = countVal;
      logger.info({ wouldReset: resetCount }, 'Would reset Sénat amendement links (dry-run)');
    }
  }

  // Charger les scrutins Sénat qui mentionnent "amendement" OU "motion" mais n'ont pas d'amendement lié
  const scrutinsToEnrich = await prisma.scrutin.findMany({
    where: {
      chambre: 'senat',
      OR: [
        { titre: { contains: 'amendement', mode: 'insensitive' } },
        { titre: { contains: 'motion', mode: 'insensitive' } },
      ],
      amendements: { none: {} },
    },
    select: {
      id: true,
      numero: true,
      titre: true,
      sourceUrl: true,
      session: true,
      date: true,
      dossierId: true,
    },
    take: limitCount,
    orderBy: { numero: 'desc' },
  });

  logger.info({ count: scrutinsToEnrich.length }, 'Sénat scrutins to enrich');

  if (scrutinsToEnrich.length === 0) {
    return { enriched: 0, notFound: 0, errors: 0 };
  }

  let enriched = 0;
  let notFound = 0;
  let errors = 0;

  const axios = (await import('axios')).default;

  // =========================================================================
  // Build texteNumero externe → texte_ref interne mapping
  // Reuse pre-built mapping if passed (from syncAmendementsSenatCsv), else download AMELI
  // =========================================================================
  const texteNumToInternalId = new Map<string, number[]>(); // "298" -> [106889, ...]

  if (options.texteMapping && options.texteMapping.size > 0) {
    // Reuse pre-built mapping — invert from texteId→{num,session} to num→texteId[]
    for (const [texteId, { num }] of options.texteMapping) {
      const existing = texteNumToInternalId.get(num) || [];
      existing.push(texteId);
      texteNumToInternalId.set(num, existing);
    }
    logger.info({ uniqueNums: texteNumToInternalId.size }, 'Texte number mapping reused from CSV sync (no AMELI re-download)');
  } else {
    logger.info('Downloading AMELI dump to build texte number mapping...');
    try {
      const { SenatAmendementsClient } = await import('../sources/senat/amendements-client.js');
      const client = new SenatAmendementsClient();
      const mapping = await client.getTexteMapping();
      for (const [texteId, { num }] of mapping) {
        const existing = texteNumToInternalId.get(num) || [];
        existing.push(texteId);
        texteNumToInternalId.set(num, existing);
      }
      logger.info({ uniqueNums: texteNumToInternalId.size }, 'Texte number mapping loaded from AMELI');
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Failed to load texte mapping - will fallback to dossier-based matching only');
    }
  }

  // =========================================================================
  // Regex pour extraire TOUS les liens vers amendements Sénat
  // Format: href="https://www.senat.fr/amendements/{session}/{texteNumero}/Amdt_{numero}.html"
  // =========================================================================
  const amendementLinkRegex = /href="[^"]*\/amendements\/(\d{4}-\d{4})\/(\d+)\/Amdt_([A-Z0-9-]+)\.html"/gi;

  const enrichLimit = pLimit(concurrency);

  const results = await Promise.all(
    scrutinsToEnrich.map((scrutin) =>
      enrichLimit(async () => {
        try {
          const url = scrutin.sourceUrl;
          if (!url) {
            logger.debug({ scrutinNumero: scrutin.numero }, 'No sourceUrl for scrutin');
            return { status: 'notFound' as const };
          }

          // Fetch la page HTML
          const htmlResponse = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'CLAIR-Bot/1.0 (https://github.com/clair)' },
          });

          const html = htmlResponse.data as string;

          // Extraire TOUS les liens vers amendements
          const allMatches = [...html.matchAll(amendementLinkRegex)];
          if (allMatches.length === 0) {
            logger.debug({ scrutinNumero: scrutin.numero, url }, 'No amendment links found in HTML');
            return { status: 'notFound' as const };
          }

          // Traiter TOUS les liens amendements trouvés (relation M:N)
          const foundAmendementIds: string[] = [];

          for (const match of allMatches) {
            const [, , texteNumExterne, amendementNumeroRaw] = match;
            if (!amendementNumeroRaw) continue;

            const baseNumero = amendementNumeroRaw.replace(/\s*rect.*$/i, '').trim();

            // Utiliser le mapping txt_ameli pour trouver le bon texte_ref
            let targetTexteRefs: string[] = [];
            if (texteNumExterne && texteNumToInternalId.has(texteNumExterne)) {
              const internalIds = texteNumToInternalId.get(texteNumExterne) || [];
              targetTexteRefs = internalIds.map(id => `SENAT-TXT-${id}`);
            }

            // Build where clause: require texteRef match OR dossier match
            // NEVER fall back to date-based matching — better no link than a wrong link
            const where: any = {
              chambre: 'senat' as const,
              numero: baseNumero,
            };

            if (targetTexteRefs.length > 0) {
              // Primary: match by texteRef from AMELI mapping
              where.texteRef = { in: targetTexteRefs };
              if (scrutin.dossierId) {
                // Allow matching amendments with correct dossier OR NULL dossier
                // (CSV-synced amendments may not have dossierId yet)
                where.OR = [
                  { dossierId: scrutin.dossierId },
                  { dossierId: null },
                ];
              }
            } else if (scrutin.dossierId) {
              // No texteRef available but we have dossier — match within same dossier
              where.dossierId = scrutin.dossierId;
            } else {
              // No texteRef AND no dossier — skip entirely to avoid false positives
              logger.debug({
                scrutinNumero: scrutin.numero,
                amendementNumero: baseNumero,
              }, 'Skipping: no texteRef and no dossierId — cannot safely match');
              continue;
            }

            const candidates = await prisma.amendement.findMany({
              where,
              select: { id: true },
              orderBy: { dateDepot: 'desc' },
              take: 1,
            });

            if (candidates[0] && !foundAmendementIds.includes(candidates[0].id)) {
              foundAmendementIds.push(candidates[0].id);
            }
          }

          if (foundAmendementIds.length === 0) {
            logger.debug({
              scrutinNumero: scrutin.numero,
              matchCount: allMatches.length,
              scrutinDate: scrutin.date.toISOString(),
            }, 'No matching amendments found');
            return { status: 'notFound' as const };
          }

          if (!dryRun) {
            await prisma.scrutin.update({
              where: { id: scrutin.id },
              data: {
                amendements: {
                  connect: foundAmendementIds.map(id => ({ id })),
                },
              },
            });
          }

          logger.debug({
            scrutinNumero: scrutin.numero,
            amendementCount: foundAmendementIds.length,
            dryRun,
          }, 'Amendments linked');
          return { status: 'enriched' as const };

        } catch (error: any) {
          logger.warn({ scrutinNumero: scrutin.numero, error: error.message }, 'Error enriching Sénat scrutin');
          return { status: 'error' as const };
        }
      })
    )
  );

  for (const result of results) {
    if (result.status === 'enriched') enriched++;
    else if (result.status === 'notFound') notFound++;
    else errors++;
  }

  logger.info({ enriched, notFound, errors, resetCount, dryRun }, 'Sénat scrutins enrichment completed');
  return { enriched, notFound, errors, resetCount };
}

// =============================================================================
// SYNC LOBBYISTES (HATVP)
// =============================================================================

// Map short action-domain labels to their canonical lobbyiste-secteur equivalents
// The HATVP data uses two vocabularies: lobbyiste "secteurs d'activité" (broader)
// and action "domaines d'intervention" (sometimes shorter/truncated variants).
const SECTEUR_NORMALIZATION: Record<string, string> = {
  'Agriculture': 'Agriculture, agroalimentaire',
  'Banques, assurances, secteur financier': 'Banques, assurances, secteur financier et extra financier',
  'Construction': 'Construction, logement, aménagement du territoire',
  'Education': 'Education, enseignement, formation',
  'Enseignement supérieur': 'Enseignement supérieur, recherche, innovation',
  'Sports': 'Sports, loisirs, tourisme',
};

function normalizeSecteurLabel(label: string): string {
  const trimmed = label.trim();
  return SECTEUR_NORMALIZATION[trimmed] || trimmed;
}

function slugifySecteur(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function syncLobbyistes(
  options: { limit?: number; includeActions?: boolean } = {}
): Promise<{ lobbyistes: { created: number; updated: number }; actions: number }> {
  const { HATVPClient } = await import('../sources/hatvp/client.js');

  const includeActions = options.includeActions ?? true;
  logger.info({ limit: options.limit, includeActions }, 'Starting lobbyistes sync (HATVP)...');

  const hatvpClient = new HATVPClient();
  const { lobbyistes: csvLobbyistes, activites: csvActivites, exercices, actionDetails } =
    await hatvpClient.getDataFromCSV(options.limit);

  // Pre-upsert all unique secteurs from lobbyistes + actions (normalized)
  const allSecteurLabels = new Set<string>();
  for (const l of csvLobbyistes) {
    for (const s of l.secteurs) {
      if (s.trim()) allSecteurLabels.add(normalizeSecteurLabel(s));
    }
  }
  for (const a of csvActivites) {
    for (const d of a.domaines) {
      if (d.trim()) allSecteurLabels.add(normalizeSecteurLabel(d));
    }
  }

  logger.info({ count: allSecteurLabels.size }, 'Upserting secteurs...');
  for (const label of allSecteurLabels) {
    const slug = slugifySecteur(label);
    if (!slug) continue;
    await prisma.secteur.upsert({
      where: { id: slug },
      create: { id: slug, label },
      update: { label },
    });
  }
  logger.info({ count: allSecteurLabels.size }, 'Secteurs upserted');

  let lobbyistesCreated = 0;
  let lobbyistesUpdated = 0;
  let actionsCreated = 0;
  let actionsUpdated = 0;

  const categorieMap: Record<string, string> = {
    'Société commerciale': 'entreprise',
    'Société commerciale et civile (autre que cabinet d\'avocats et société de conseil)': 'entreprise',
    'Association': 'association',
    'Association loi 1901 ou équivalent': 'association',
    'Cabinet d\'avocats': 'cabinet',
    'Société de conseil en relations publiques ou en affaires publiques': 'cabinet',
    'Syndicat professionnel': 'syndicat',
    'Organisation professionnelle': 'organisation_pro',
    'Fondation': 'association',
    'Fondation d\'entreprise': 'association',
    'Chambre consulaire': 'organisation_pro',
    'Établissement public industriel et commercial': 'organisation_pro',
    'Groupement d\'intérêt économique': 'organisation_pro',
    'Autre': 'entreprise',
  };

  const lobbyisteIdMap = new Map<string, string>();
  const budgetByLobbyiste = new Map<string, number>();
  const salariesByLobbyiste = new Map<string, number>();

  for (const ex of exercices) {
    if (ex.montantDepense && ex.montantDepense > 0) {
      const current = budgetByLobbyiste.get(ex.lobbyisteId) || 0;
      budgetByLobbyiste.set(ex.lobbyisteId, Math.max(current, ex.montantDepense));
    }
    if (ex.nombreSalaries && ex.nombreSalaries > 0) {
      const current = salariesByLobbyiste.get(ex.lobbyisteId) || 0;
      salariesByLobbyiste.set(ex.lobbyisteId, Math.max(current, ex.nombreSalaries));
    }
  }

  for (const csvLobbyiste of csvLobbyistes) {
    try {
      const siren = csvLobbyiste.typeIdentifiant === 'SIREN' ? csvLobbyiste.identifiantNational : null;
      const identifiantNational = csvLobbyiste.identifiantNational?.trim() || null;
      const type = categorieMap[csvLobbyiste.categorie] || 'entreprise';

      // Match par identifiantNational (SIREN/RNA) — clé stable HATVP.
      // Fallback sur le SIREN pour les edge cases (identifiant vide).
      const existing = identifiantNational
        ? await prisma.lobbyiste.findUnique({ where: { identifiantNational } })
        : siren
          ? await prisma.lobbyiste.findFirst({ where: { siren } })
          : null;

      const secteur = csvLobbyiste.secteurs.length > 0
        ? csvLobbyiste.secteurs.slice(0, 3).join(', ').substring(0, 500)
        : null;

      const nbLobbyistes = csvLobbyiste.nbCollaborateurs > 0
        ? csvLobbyiste.nbCollaborateurs
        : salariesByLobbyiste.get(csvLobbyiste.id) || null;

      const data = {
        identifiantNational,
        siren,
        nom: csvLobbyiste.denomination,
        type,
        secteur,
        adresse: csvLobbyiste.adresse,
        codePostal: csvLobbyiste.codePostal,
        ville: csvLobbyiste.ville,
        budgetAnnuel: budgetByLobbyiste.get(csvLobbyiste.id) || null,
        nbLobbyistes,
        siteWeb: csvLobbyiste.siteWeb,
      };

      let lobbyisteId: string;

      if (existing) {
        await prisma.lobbyiste.update({ where: { id: existing.id }, data });
        lobbyisteId = existing.id;
        lobbyistesUpdated++;
      } else {
        const created = await prisma.lobbyiste.create({ data });
        lobbyisteId = created.id;
        lobbyistesCreated++;
      }

      lobbyisteIdMap.set(csvLobbyiste.id, lobbyisteId);

      // Sync secteur pivots (all secteurs, no limit)
      if (csvLobbyiste.secteurs.length > 0) {
        const secteurSlugs = csvLobbyiste.secteurs
          .map((s: string) => slugifySecteur(normalizeSecteurLabel(s)))
          .filter((s: string) => s);
        if (secteurSlugs.length > 0) {
          await prisma.lobbyisteSecteur.deleteMany({ where: { lobbyisteId } });
          await prisma.lobbyisteSecteur.createMany({
            data: secteurSlugs.map((slug: string) => ({
              lobbyisteId,
              secteurId: slug,
            })),
            skipDuplicates: true,
          });
        }
      }
    } catch (error: any) {
      logger.warn({ lobbyiste: csvLobbyiste.denomination, error: error.message }, 'Error syncing lobbyiste');
    }
  }

  logger.info({ created: lobbyistesCreated, updated: lobbyistesUpdated }, 'Lobbyistes synced');

  const actionDetailsByActivite = new Map<string, typeof actionDetails[0]>();
  for (const detail of actionDetails) {
    actionDetailsByActivite.set(detail.activiteId, detail);
  }

  const determineCibleType = (responsable: string): string | null => {
    const r = responsable.toLowerCase();
    if (r.includes('député') || r.includes('sénateur') || r.includes('parlementaire') || r.includes('assemblée') || r.includes('sénat')) {
      return 'parlementaire';
    }
    if (r.includes('ministre') || r.includes('cabinet ministériel') || r.includes('secrétaire d\'état')) {
      return 'ministre';
    }
    if (r.includes('président de la république') || r.includes('élysée')) {
      return 'presidence';
    }
    if (r.includes('autorité administrative') || r.includes('aai') || r.includes('api')) {
      return 'autorite';
    }
    if (r.includes('collectivité') || r.includes('territorial') || r.includes('maire') || r.includes('région')) {
      return 'collectivite';
    }
    return 'administration';
  };

  if (includeActions && csvActivites.length > 0) {
    logger.info({ total: csvActivites.length }, 'Syncing activites...');

    // Pre-compute all unique descriptions and cibleNom values for batch upsert
    const uniqueDescriptions = new Set<string>();
    const uniqueCibleNoms = new Set<string>();

    for (const act of csvActivites) {
      if (!act.objet) continue;

      let description = act.objet;
      if (act.domaines.length > 0) {
        description = `[${act.domaines.slice(0, 2).join(', ')}] ${description}`;
      }
      uniqueDescriptions.add(description.substring(0, 2000));

      const details = actionDetailsByActivite.get(act.activiteId);
      if (details && details.cibles && details.cibles.length > 0) {
        const firstCible = details.cibles[0];
        if (firstCible) {
          const nom = firstCible.nom || firstCible.type?.substring(0, 200) || null;
          if (nom) uniqueCibleNoms.add(nom);
        }
      }
    }

    // Batch upsert cible types
    logger.info({ count: uniqueCibleNoms.size }, 'Upserting cible types...');
    if (uniqueCibleNoms.size > 0) {
      await prisma.cibleType.createMany({
        data: [...uniqueCibleNoms].map((label) => ({ label })),
        skipDuplicates: true,
      });
    }
    const allCibleTypes = await prisma.cibleType.findMany();
    const cibleTypeMap = new Map(allCibleTypes.map((ct) => [ct.label, ct.id]));
    logger.info({ count: allCibleTypes.length }, 'Cible types ready');

    // Batch upsert descriptions
    logger.info({ count: uniqueDescriptions.size }, 'Upserting action descriptions...');
    if (uniqueDescriptions.size > 0) {
      // Batch in chunks of 1000 to avoid query size limits
      const descArray = [...uniqueDescriptions];
      for (let i = 0; i < descArray.length; i += 1000) {
        const chunk = descArray.slice(i, i + 1000);
        await prisma.actionDescription.createMany({
          data: chunk.map((texte) => ({ texte })),
          skipDuplicates: true,
        });
      }
    }
    const allDescriptions = await prisma.actionDescription.findMany();
    const descriptionMap = new Map(allDescriptions.map((d) => [d.texte, d.id]));
    logger.info({ count: allDescriptions.length }, 'Action descriptions ready');

    // -----------------------------------------------------------------------
    // BATCH UPSERT: pre-load existing → in-memory diff → batch SQL
    // Replaces ~380K sequential queries with ~50 batched operations
    // -----------------------------------------------------------------------

    // 1. Pre-load existing actions for O(1) in-memory lookup (~45MB for 95K)
    logger.info('Pre-loading existing actions for batch upsert...');
    const existingActions = await prisma.actionLobby.findMany({
      select: { id: true, lobbyisteId: true, descriptionId: true, cible: true, cibleTypeId: true, texteVise: true, texteViseNom: true },
    });
    const existingActionMap = new Map<string, { id: string; cible: string | null; cibleTypeId: string | null; texteVise: string | null; texteViseNom: string | null }>();
    for (const ea of existingActions) {
      if (ea.descriptionId) {
        existingActionMap.set(`${ea.lobbyisteId}::${ea.descriptionId}`, ea);
      }
    }
    existingActions.length = 0; // Free raw array
    logger.info({ count: existingActionMap.size }, 'Existing actions loaded');

    // 2. Single pass: collect batch operations (zero DB queries)
    const toCreate: Array<{ id: string; lobbyisteId: string; descriptionId: string; dateDebut: Date; cible: string | null; cibleTypeId: string | null; texteVise: string | null; texteViseNom: string | null }> = [];
    const toUpdate: Array<{ id: string; descriptionId: string; cible: string | null; cibleTypeId: string | null; texteVise: string | null; texteViseNom: string | null }> = [];
    const pivotActionIds: string[] = [];
    const pivotPairs: Array<{ actionId: string; secteurId: string }> = [];
    const validActionKeys = new Set<string>();

    for (const act of csvActivites) {
      if (!act.objet) continue;
      const lobbyisteId = lobbyisteIdMap.get(act.lobbyisteId);
      if (!lobbyisteId) continue;

      let dateDebut = new Date();
      if (act.datePublication) {
        const parsed = new Date(act.datePublication);
        if (!isNaN(parsed.getTime())) dateDebut = parsed;
      }

      const details = actionDetailsByActivite.get(act.activiteId);

      let cible: string | null = null;
      let cibleNom: string | null = null;
      if (details?.cibles?.[0]) {
        cible = determineCibleType(details.cibles[0].type);
        cibleNom = details.cibles[0].nom || details.cibles[0].type?.substring(0, 200) || null;
      }

      let description = act.objet;
      if (act.domaines.length > 0) {
        description = `[${act.domaines.slice(0, 2).join(', ')}] ${description}`;
      }
      description = description.substring(0, 2000);

      const descriptionId = descriptionMap.get(description);
      if (!descriptionId) continue;

      validActionKeys.add(`${lobbyisteId}::${descriptionId}`);

      const cibleTypeId = cibleNom ? cibleTypeMap.get(cibleNom) ?? null : null;

      let texteVise: string | null = null;
      let texteViseNom: string | null = null;
      if (details?.decisions?.[0]) {
        texteViseNom = details.decisions.slice(0, 2).join(', ').substring(0, 200);
        texteVise = details.decisions[0].substring(0, 500);
      }

      const key = `${lobbyisteId}::${descriptionId}`;
      const existing = existingActionMap.get(key);

      let actionId: string;
      if (existing) {
        actionId = existing.id;
        // Only batch-update if data actually changed
        if (existing.cible !== cible || existing.cibleTypeId !== cibleTypeId ||
            existing.texteVise !== texteVise || existing.texteViseNom !== texteViseNom) {
          toUpdate.push({ id: existing.id, descriptionId, cible, cibleTypeId, texteVise, texteViseNom });
        }
        actionsUpdated++;
      } else {
        actionId = randomUUID();
        toCreate.push({ id: actionId, lobbyisteId, descriptionId, dateDebut, cible, cibleTypeId, texteVise, texteViseNom });
        // Track to avoid duplicate creates for same key
        existingActionMap.set(key, { id: actionId, cible, cibleTypeId, texteVise, texteViseNom });
        actionsCreated++;
      }

      // Collect pivot pairs
      if (act.domaines.length > 0) {
        const domaineSlugs = act.domaines
          .map((d: string) => slugifySecteur(normalizeSecteurLabel(d)))
          .filter((s: string) => s);
        if (domaineSlugs.length > 0) {
          pivotActionIds.push(actionId);
          for (const slug of domaineSlugs) {
            pivotPairs.push({ actionId, secteurId: slug });
          }
        }
      }
    }

    logger.info({ toCreate: toCreate.length, toUpdate: toUpdate.length, pivotPairs: pivotPairs.length }, 'Batch operations prepared');

    // 3. Batch creates (createMany, chunks of 1000)
    if (toCreate.length > 0) {
      logger.info({ count: toCreate.length }, 'Batch creating new actions...');
      for (let i = 0; i < toCreate.length; i += 1000) {
        await prisma.actionLobby.createMany({ data: toCreate.slice(i, i + 1000) });
      }
    }

    // 4. Batch updates via raw SQL UNNEST (single query per chunk of 500)
    if (toUpdate.length > 0) {
      logger.info({ count: toUpdate.length }, 'Batch updating changed actions...');
      for (let i = 0; i < toUpdate.length; i += 500) {
        const chunk = toUpdate.slice(i, i + 500);
        await prisma.$executeRawUnsafe(
          `UPDATE actions_lobby SET
            description_id = t.description_id,
            cible = t.cible,
            cible_type_id = t.cible_type_id,
            texte_vise = t.texte_vise,
            texte_vise_nom = t.texte_vise_nom
          FROM UNNEST($1::text[], $2::integer[], $3::text[], $4::integer[], $5::text[], $6::text[])
            AS t(id, description_id, cible, cible_type_id, texte_vise, texte_vise_nom)
          WHERE actions_lobby.id = t.id`,
          chunk.map(u => u.id),
          chunk.map(u => u.descriptionId),
          chunk.map(u => u.cible),
          chunk.map(u => u.cibleTypeId),
          chunk.map(u => u.texteVise),
          chunk.map(u => u.texteViseNom),
        );
      }
    }

    // 5. Batch pivots: single deleteMany + batched createMany
    if (pivotActionIds.length > 0) {
      logger.info({ actions: pivotActionIds.length, pairs: pivotPairs.length }, 'Batch syncing action-secteur pivots...');
      // Delete existing pivots for all affected actions
      for (let i = 0; i < pivotActionIds.length; i += 5000) {
        await prisma.actionSecteur.deleteMany({
          where: { actionId: { in: pivotActionIds.slice(i, i + 5000) } },
        });
      }
      // Create all new pivots
      for (let i = 0; i < pivotPairs.length; i += 5000) {
        await prisma.actionSecteur.createMany({
          data: pivotPairs.slice(i, i + 5000),
          skipDuplicates: true,
        });
      }
    }

    // Free batch arrays
    toCreate.length = 0;
    toUpdate.length = 0;
    pivotActionIds.length = 0;
    pivotPairs.length = 0;
    existingActionMap.clear();

    // ── Stale action cleanup ──
    // Delete actions for processed lobbyistes that are no longer present
    // in the current CSV source. This prevents chimera-lobbyist records
    // caused by HATVP representants_id recycling between exports.
    const validDescByLobbyist = new Map<string, number[]>();
    for (const key of validActionKeys) {
      const sepIndex = key.indexOf('::');
      const dbId = key.slice(0, sepIndex);
      const descId = Number(key.slice(sepIndex + 2));
      const list = validDescByLobbyist.get(dbId) || [];
      list.push(descId);
      validDescByLobbyist.set(dbId, list);
    }

    let staleDeleted = 0;
    for (const dbLobbyisteId of lobbyisteIdMap.values()) {
      const validDescIds = validDescByLobbyist.get(dbLobbyisteId);
      if (validDescIds && validDescIds.length > 0) {
        const result = await prisma.actionLobby.deleteMany({
          where: {
            lobbyisteId: dbLobbyisteId,
            descriptionId: { notIn: validDescIds },
          },
        });
        staleDeleted += result.count;
      } else {
        const result = await prisma.actionLobby.deleteMany({
          where: { lobbyisteId: dbLobbyisteId },
        });
        staleDeleted += result.count;
      }
    }

    if (staleDeleted > 0) {
      logger.info({ staleDeleted }, 'Stale actions cleaned up');
    }
  }

  logger.info({
    lobbyistes: { created: lobbyistesCreated, updated: lobbyistesUpdated },
    actions: { created: actionsCreated, updated: actionsUpdated },
    total: csvLobbyistes.length,
  }, 'Lobbyistes sync completed');

  return {
    lobbyistes: { created: lobbyistesCreated, updated: lobbyistesUpdated },
    actions: actionsCreated + actionsUpdated,
  };
}

// =============================================================================
// LINK ORPHAN SCRUTINS BY TEXTE_NUMERO
// =============================================================================

/**
 * Lie les scrutins orphelins aux dossiers via le numéro de texte partagé.
 *
 * Si un scrutin orphelin a le même texte_numero qu'un ou plusieurs scrutins
 * déjà liés à un dossier UNIQUE, on peut le lier au même dossier en confiance.
 *
 * Cas typique: "aide à mourir" scrutins partageant texte_numero avec des scrutins
 * "Fin de vie" déjà liés — même texte législatif, titres différents.
 */
export async function linkOrphanScrutinsByTexteNumero(): Promise<{ linked: number }> {
  logger.info('Linking orphan scrutins to dossiers by shared texte_numero...');

  let totalLinked = 0;

  for (const chambre of ['assemblee', 'senat'] as const) {
    const result = await prisma.$executeRaw`
      WITH texte_dossier_map AS (
        SELECT texte_numero, MIN(dossier_id) as dossier_id
        FROM scrutins
        WHERE chambre = ${chambre}
          AND dossier_id IS NOT NULL
          AND texte_numero IS NOT NULL
        GROUP BY texte_numero
        HAVING COUNT(DISTINCT dossier_id) = 1
      )
      UPDATE scrutins s
      SET dossier_id = tdm.dossier_id
      FROM texte_dossier_map tdm
      WHERE s.chambre = ${chambre}
        AND s.dossier_id IS NULL
        AND s.texte_numero IS NOT NULL
        AND s.texte_numero = tdm.texte_numero
    `;

    if (result > 0) {
      logger.info({ chambre, linked: result }, 'Orphan scrutins linked by texte_numero');
    }
    totalLinked += result;
  }

  logger.info({ linked: totalLinked }, 'Texte_numero orphan linking completed');
  return { linked: totalLinked };
}

// =============================================================================
// LINK ORPHANS BY LOI_TITRE + PEER MATCHING
// =============================================================================

/**
 * Lie les scrutins orphelins aux dossiers en deux passes:
 *
 * Pass 1 — loi_titre: si le dossier a un titre de loi promulguée (loi_titre)
 * et que ce titre est une sous-chaîne du titre du scrutin, on lie.
 *
 * Pass 2 — peer matching: extrait la phrase "proposition/projet de loi ..."
 * depuis le titre du scrutin orphelin, et cherche des scrutins déjà liés
 * avec la même phrase. Si tous pointent vers un seul dossier, on lie.
 * Résout les cas où le titre du dossier diffère du titre de la loi
 * (ex: dossier "Fin de vie" ↔ scrutins "aide à mourir").
 *
 * Dernière étape du pipeline de matching — filet de sécurité final.
 */
export async function linkOrphansByLoiTitre(): Promise<{ linked: number }> {
  logger.info('Linking orphan scrutins to dossiers by loi_titre + peer matching...');

  let totalLinked = 0;

  for (const chambre of ['assemblee', 'senat'] as const) {
    const dossierFilter = chambre === 'senat'
      ? Prisma.sql`d.uid LIKE 'SENAT%'`
      : Prisma.sql`d.uid NOT LIKE 'SENAT%'`;

    // Pass 1: loi_titre substring match
    const loiTitreResult = await prisma.$executeRaw`
      UPDATE scrutins s
      SET dossier_id = d.id
      FROM dossiers_legislatifs d
      WHERE s.chambre = ${chambre}
        AND s.dossier_id IS NULL
        AND d.loi_titre IS NOT NULL AND LENGTH(d.loi_titre) > 15
        AND ${dossierFilter}
        AND LOWER(s.titre) LIKE '%' || LOWER(d.loi_titre) || '%'
        -- Only use unambiguous matches (exactly 1 dossier matches)
        AND (
          SELECT COUNT(DISTINCT d2.id)
          FROM dossiers_legislatifs d2
          WHERE d2.loi_titre IS NOT NULL AND LENGTH(d2.loi_titre) > 15
            AND ${dossierFilter}
            AND LOWER(s.titre) LIKE '%' || LOWER(d2.loi_titre) || '%'
        ) = 1
    `;

    if (loiTitreResult > 0) {
      logger.info({ chambre, linked: loiTitreResult }, 'Orphan scrutins linked by loi_titre');
    }
    totalLinked += loiTitreResult;

    // Pass 2: peer matching — extract "proposition/projet de loi ..." phrase
    // from orphan titles and match against already-linked scrutins with same phrase.
    // Covers cases like "aide à mourir (deuxième lecture)" where dossier title is "Fin de vie"
    // but existing scrutins on the same law are already linked.
    const peerResult = await prisma.$executeRaw`
      WITH orphan_phrases AS (
        SELECT s.id,
          LOWER(SUBSTRING(s.titre FROM '((?:proposition|projet) de (?:loi|résolution)[^(.]+)')) as loi_phrase
        FROM scrutins s
        WHERE s.chambre = ${chambre}
          AND s.dossier_id IS NULL
          AND s.titre ~* '(proposition|projet) de (loi|résolution)'
      ),
      peer_dossier_map AS (
        SELECT
          LOWER(SUBSTRING(s2.titre FROM '((?:proposition|projet) de (?:loi|résolution)[^(.]+)')) as loi_phrase,
          MIN(s2.dossier_id) as dossier_id
        FROM scrutins s2
        WHERE s2.chambre = ${chambre}
          AND s2.dossier_id IS NOT NULL
          AND s2.titre ~* '(proposition|projet) de (loi|résolution)'
        GROUP BY 1
        HAVING COUNT(DISTINCT s2.dossier_id) = 1
      )
      UPDATE scrutins s
      SET dossier_id = pdm.dossier_id
      FROM orphan_phrases op
      JOIN peer_dossier_map pdm ON op.loi_phrase = pdm.loi_phrase
      WHERE s.id = op.id
        AND op.loi_phrase IS NOT NULL
        AND LENGTH(op.loi_phrase) > 20
    `;

    if (peerResult > 0) {
      logger.info({ chambre, linked: peerResult }, 'Orphan scrutins linked by peer loi phrase');
    }
    totalLinked += peerResult;
  }

  logger.info({ linked: totalLinked }, 'Loi_titre + peer matching orphan linking completed');
  return { linked: totalLinked };
}

// Export des helpers pour réutilisation
export { extractTags, extractKeywords };
