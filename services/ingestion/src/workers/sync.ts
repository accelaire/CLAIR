// =============================================================================
// Ingestion Workers - Synchronisation des données
// Sources: API Assemblée Nationale + Sénat
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import pLimit from 'p-limit';
import { AssembleeNationaleDeputesClient, TransformedParlementaire } from '../sources/assemblee-nationale/deputes-client';
import { AssembleeNationaleScrutinsClient } from '../sources/assemblee-nationale/scrutins-client';
import { DossiersLegislatifsClient } from '../sources/assemblee-nationale/dossiers-client';
import { SenatSenateursClient, TransformedSenateur } from '../sources/senat/senateurs-client';
import { SenatScrutinsClient } from '../sources/senat/scrutins-client';
import { DILAInterventionsClient } from '../sources/dila/interventions-client';
import { SenatInterventionsClient } from '../sources/senat/interventions-client';
import { SenatDossiersClient } from '../sources/senat/dossiers-client';
import { logger } from '../utils/logger';
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

  let created = 0;
  let updated = 0;

  // Process en parallèle avec limite
  const results = await Promise.all(
    parlementaires.map((p) =>
      limit(async () => {
        try {
          return await syncSingleParlementaireAN(p, groupeMap, circoMap);
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

  logger.info({ created, updated, total: parlementaires.length }, 'Parlementaires AN sync completed');
  return { created, updated };
}

async function syncSingleParlementaireAN(
  p: TransformedParlementaire,
  groupeMap: Map<string, string>,
  circoMap: Map<string, string>
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

  let created = 0;
  let updated = 0;

  // Process en parallèle avec limite
  const results = await Promise.all(
    senateurs.map((s) =>
      limit(async () => {
        try {
          return await syncSingleSenateur(s, groupeMap, circoMap);
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
  circoMap: Map<string, string>
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
    return 'updated';
  } else {
    await prisma.parlementaire.create({ data });
    return 'created';
  }
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

  // Charger les amendements pour le mapping numéro -> amendementId (Sénat)
  // IMPORTANT: Le numéro seul n'est pas unique ! On utilise texteRef+numero comme clé préférée.
  // On utilise select minimal pour réduire la mémoire (~50k amendements Sénat)
  const amendements = await prisma.amendement.findMany({
    where: { uid: { startsWith: 'SENAT-' } },
    select: { id: true, numero: true, texteRef: true },
  });

  // Map par numéro seul (fallback, peut avoir des collisions)
  const amendementByNumero = new Map<string, string>();
  // Map par texteRef+numero (précis, pas de collision)
  const amendementByTexteNumero = new Map<string, string>();

  for (const a of amendements) {
    if (a.numero) {
      const numUpper = a.numero.toUpperCase();

      // Fallback: juste le numéro (peut être écrasé si plusieurs amendements ont le même numéro)
      amendementByNumero.set(numUpper, a.id);

      // Précis: texteRef + numéro
      if (a.texteRef) {
        amendementByTexteNumero.set(`${a.texteRef}-${numUpper}`, a.id);
      }
    }
  }

  let scrutinsCreated = 0;
  let scrutinsUpdated = 0;
  let votesCreated = 0;
  let dossiersLinked = 0;
  let amendementsLinked = 0;

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

      // Rechercher TOUS les amendements liés (relation M:N)
      // NOTE: Pour le Sénat, le matching par numero seul est imprécis car plusieurs
      // amendements peuvent avoir le même numéro sur des textes différents.
      // Le matching précis se fait dans enrichScrutinsSenatAmendements().
      const amendementIds: string[] = [];
      if (scrutin.amendementsNumeros && scrutin.amendementsNumeros.length > 0) {
        for (const num of scrutin.amendementsNumeros) {
          const numUpper = num.toUpperCase();
          const found = amendementByNumero.get(numUpper);
          if (found && !amendementIds.includes(found)) {
            amendementIds.push(found);
          }
        }
        if (amendementIds.length > 0) amendementsLinked++;
      }

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
            // Ne remplacer les liens amendements que si DOSLEG fournit des numéros,
            // sinon préserver les liens créés par enrichScrutinsSenatAmendements()
            ...(amendementsRelation.length > 0 ? { amendements: { set: amendementsRelation } } : {}),
          },
        });
        scrutinId = existing.id;
        scrutinsUpdated++;
      } else {
        const created = await prisma.scrutin.create({
          data: {
            ...scrutinBaseData,
            amendements: amendementsRelation.length > 0 ? { connect: amendementsRelation } : undefined,
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
    amendementsLinked,
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

  // Créer un map avec plusieurs clés pour matcher les orateurs
  const parlementaireMap = new Map<string, string>();
  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  for (const p of parlementaires) {
    // Par sourceId (PA123456)
    if (p.sourceId) parlementaireMap.set(p.sourceId, p.id);

    // Par nom complet normalisé (plusieurs variantes)
    parlementaireMap.set(normalize(`${p.prenom} ${p.nom}`), p.id);
    parlementaireMap.set(normalize(`${p.nom} ${p.prenom}`), p.id);
    parlementaireMap.set(normalize(p.nom), p.id);

    // Ajouter chaque partie du nom composé séparément
    const nomParts = p.nom.split(/[\s-]+/);
    if (nomParts.length > 1) {
      for (const part of nomParts) {
        if (part.length > 3) {
          parlementaireMap.set(normalize(part), p.id);
        }
      }
    }
  }

  let created = 0;
  let skippedNonParlementaire = 0;
  let skippedNoMatch = 0;

  const chambre = 'assemblee';

  // Liste des titres à exclure (non-parlementaires)
  const titresExclus = ['président', 'présidente', 'ministre', 'secrétaire', 'garde des sceaux', 'premier ministre'];

  for (const intervention of interventionsData) {
    try {
      // Vérifier si c'est clairement un non-parlementaire (titre)
      const orateurLower = (intervention.orateurNom || '').toLowerCase();
      const isNonParlementaire = titresExclus.some(titre => orateurLower.includes(titre));

      if (isNonParlementaire) {
        skippedNonParlementaire++;
        continue;
      }

      // Chercher le parlementaire
      let parlementaireId: string | null = null;

      // D'abord par orateurRef (PA ID)
      if (intervention.orateurRef) {
        parlementaireId = parlementaireMap.get(intervention.orateurRef) || null;
      }

      // Sinon par nom
      if (!parlementaireId && intervention.orateurNom) {
        const searchName = normalize(
          intervention.orateurPrenom
            ? `${intervention.orateurPrenom} ${intervention.orateurNom}`
            : intervention.orateurNom
        );
        parlementaireId = parlementaireMap.get(searchName) || null;

        // Essayer avec le nom seul
        if (!parlementaireId) {
          parlementaireId = parlementaireMap.get(normalize(intervention.orateurNom)) || null;
        }

        // Essayer en cherchant si le nom contient un des noms du map (recherche partielle)
        if (!parlementaireId) {
          for (const [key, id] of parlementaireMap.entries()) {
            if (key.length > 4 && (searchName.includes(key) || key.includes(searchName.split(' ').pop() || ''))) {
              parlementaireId = id;
              break;
            }
          }
        }
      }

      if (!parlementaireId) {
        skippedNoMatch++;
        // Log quelques exemples pour diagnostic
        if (skippedNoMatch <= 10) {
          logger.debug({
            orateurNom: intervention.orateurNom,
            orateurPrenom: intervention.orateurPrenom,
            orateurRef: intervention.orateurRef,
          }, 'No parlementaire match found');
        }
        continue;
      }

      // Vérifier si l'intervention existe déjà (basé sur parlementaireId + seanceId + début du contenu)
      const contentHash = intervention.contenu.substring(0, 100);
      const existing = await prisma.intervention.findFirst({
        where: {
          parlementaireId,
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

      created++;

    } catch (error: any) {
      logger.warn({ seance: intervention.seanceId, error: error.message }, 'Error syncing intervention');
    }
  }

  logger.info({
    created,
    total: interventionsData.length,
    skippedNonParlementaire,
    skippedNoMatch,
    matchRate: `${((created / (interventionsData.length || 1)) * 100).toFixed(1)}%`,
  }, 'Interventions AN sync completed');

  return { interventions: created };
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

  // Créer un map avec plusieurs clés pour matcher les orateurs
  const parlementaireMap = new Map<string, string>();
  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ').replace(/'/g, ' ').trim();

  for (const p of parlementaires) {
    // Par sourceId (matricule)
    if (p.sourceId) parlementaireMap.set(p.sourceId, p.id);

    // Par nom complet normalisé (plusieurs variantes)
    parlementaireMap.set(normalize(`${p.prenom} ${p.nom}`), p.id);
    parlementaireMap.set(normalize(`${p.nom} ${p.prenom}`), p.id);
    parlementaireMap.set(normalize(p.nom), p.id);

    // Ajouter chaque partie du nom composé séparément
    const nomParts = p.nom.split(/[\s-]+/);
    if (nomParts.length > 1) {
      for (const part of nomParts) {
        if (part.length > 3) {
          parlementaireMap.set(normalize(part), p.id);
        }
      }
    }
  }

  let created = 0;
  let skippedNonParlementaire = 0;
  let skippedNoMatch = 0;

  const chambre = 'senat';

  // Liste des titres à exclure (non-sénateurs)
  const titresExclus = ['président', 'présidente', 'ministre', 'secrétaire', 'garde des sceaux', 'premier ministre'];

  for (const intervention of interventionsData) {
    try {
      // Vérifier si c'est clairement un non-sénateur (titre)
      const orateurLower = (intervention.orateurNom || '').toLowerCase();
      const isNonParlementaire = titresExclus.some(titre => orateurLower.includes(titre));

      if (isNonParlementaire) {
        skippedNonParlementaire++;
        continue;
      }

      // Chercher le sénateur
      let parlementaireId: string | null = null;

      // D'abord par orateurRef (matricule)
      if (intervention.orateurRef) {
        parlementaireId = parlementaireMap.get(intervention.orateurRef) || null;
      }

      // Sinon par nom
      if (!parlementaireId && intervention.orateurNom) {
        const searchName = normalize(
          intervention.orateurPrenom
            ? `${intervention.orateurPrenom} ${intervention.orateurNom}`
            : intervention.orateurNom
        );
        parlementaireId = parlementaireMap.get(searchName) || null;

        // Essayer avec le nom seul
        if (!parlementaireId) {
          parlementaireId = parlementaireMap.get(normalize(intervention.orateurNom)) || null;
        }

        // Essayer en cherchant si le nom contient un des noms du map
        if (!parlementaireId) {
          for (const [key, id] of parlementaireMap.entries()) {
            if (key.length > 4 && (searchName.includes(key) || key.includes(searchName.split(' ').pop() || ''))) {
              parlementaireId = id;
              break;
            }
          }
        }
      }

      if (!parlementaireId) {
        skippedNoMatch++;
        if (skippedNoMatch <= 10) {
          logger.debug({
            orateurNom: intervention.orateurNom,
            orateurPrenom: intervention.orateurPrenom,
            orateurRef: intervention.orateurRef,
          }, 'No sénateur match found');
        }
        continue;
      }

      // Vérifier si l'intervention existe déjà
      const contentHash = intervention.contenu.substring(0, 100);
      const existing = await prisma.intervention.findFirst({
        where: {
          parlementaireId,
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

      created++;

    } catch (error: any) {
      logger.warn({ seance: intervention.seanceId, error: error.message }, 'Error syncing intervention Sénat');
    }
  }

  logger.info({
    created,
    total: interventionsData.length,
    skippedNonParlementaire,
    skippedNoMatch,
    matchRate: `${((created / (interventionsData.length || 1)) * 100).toFixed(1)}%`,
  }, 'Interventions Sénat sync completed');

  return { interventions: created };
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
  scrutinsLimit?: number;
  amendementsLimit?: number;
  interventionsLimit?: number;
  dossiersLimit?: number;
  lobbyingLimit?: number;
  skipStatsCalculation?: boolean; // Ne pas recalculer les stats après le sync
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

  // Déterminer quelles sources vérifier (ordre important pour les relations)
  let sourcesToCheck: string[];

  if (options.all) {
    // Tout synchroniser dans le bon ordre (relations d'abord)
    sourcesToCheck = [
      // 1. Parlementaires (nécessaires pour les autres sources)
      'assemblee_nationale:deputes',
      'senat:senateurs',
      // 2. Scrutins et votes
      'assemblee_nationale:scrutins',
      'senat:scrutins',
      // 3. Amendements
      'assemblee_nationale:amendements',
      'senat:amendements',
      // 4. Dossiers législatifs (lie scrutins et amendements aux textes de loi)
      'assemblee_nationale:dossiers',
      'senat:dossiers',
      // 5. Interventions
      'dila:interventions',
      'senat:interventions',
      // 6. Lobbying
      'hatvp:lobbyistes',
    ];
  } else {
    sourcesToCheck = options.sources || [
      'assemblee_nationale:deputes',
      'senat:senateurs',
      ...(options.includeScrutins ? ['assemblee_nationale:scrutins', 'senat:scrutins'] : []),
      ...(options.includeAmendements ? ['assemblee_nationale:amendements', 'senat:amendements'] : []),
      ...(options.includeDossiers ? ['assemblee_nationale:dossiers', 'senat:dossiers'] : []),
      ...(options.includeInterventions ? ['dila:interventions', 'senat:interventions'] : []),
      ...(options.includeLobbying ? ['hatvp:lobbyistes'] : []),
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
            const senatAmendementsResult = await syncAmendementsSenat({ maxAmendements: options.amendementsLimit });
            syncResult = { created: senatAmendementsResult.created, updated: senatAmendementsResult.updated };
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
    logger.info('Linking Sénat scrutins to dossiers...');
    try {
      const linkResult = await linkSenatScrutinsToDossiers();
      logger.info({
        linked: linkResult.linked,
      }, 'Sénat scrutins-dossiers linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Sénat scrutins-dossiers linking failed (non-blocking)');
    }

    // AN scrutins-dossiers title matching
    logger.info('Linking AN scrutins to dossiers by title matching...');
    try {
      const anLinkResult = await linkANScrutinsByTitle();
      logger.info({
        linked: anLinkResult.linked,
      }, 'AN scrutins-dossiers title linking completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'AN scrutins-dossiers title linking failed (non-blocking)');
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
// SYNC DOSSIERS LÉGISLATIFS (Assemblée Nationale)
// =============================================================================

export async function syncDossiers(
  options: { limit?: number; linkScrutins?: boolean } = {}
): Promise<{ created: number; updated: number; scrutinsLinked: number }> {
  const linkScrutins = options.linkScrutins ?? true;
  logger.info({ limit: options.limit, linkScrutins }, 'Starting dossiers législatifs sync...');

  const client = new DossiersLegislatifsClient(17);
  const dossiers = await client.getDossiers(options.limit);

  let created = 0;
  let updated = 0;
  let scrutinsLinked = 0;
  let amendementsLinked = 0;

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

  logger.info({ created, updated, scrutinsLinked, amendementsLinked, total: dossiers.length }, 'Dossiers législatifs sync completed');
  return { created, updated, scrutinsLinked, amendementsLinked };
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
            SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero,
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
            a.numero,
            SUBSTRING(a.texte_ref FROM 'B(?:TC)?([0-9]+)') as amendement_texte_numero
          FROM amendements a
          WHERE a.chambre = 'assemblee'
        ),
        matched AS (
          SELECT swn.id, awt.id as amendement_id
          FROM scrutins_with_info swn
          LEFT JOIN amendements_with_texte awt ON
            awt.numero = swn.amendement_numero
            AND (
              swn.texte_numero IS NULL
              OR awt.amendement_texte_numero = swn.texte_numero
            )
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
      const resultAN = await prisma.$executeRaw`
        WITH scrutins_with_info AS (
          SELECT
            s.id,
            SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero,
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
            a.numero,
            SUBSTRING(a.texte_ref FROM 'B(?:TC)?([0-9]+)') as amendement_texte_numero
          FROM amendements a
          WHERE a.chambre = 'assemblee'
        ),
        best_match AS (
          SELECT DISTINCT ON (swn.id) swn.id as scrutin_id, awt.id as amendement_id
          FROM scrutins_with_info swn
          INNER JOIN amendements_with_texte awt ON
            awt.numero = swn.amendement_numero
            AND (
              swn.texte_numero IS NULL
              OR awt.amendement_texte_numero = swn.texte_numero
            )
          WHERE swn.amendement_numero IS NOT NULL
          ORDER BY swn.id,
            CASE WHEN swn.texte_numero IS NOT NULL AND awt.amendement_texte_numero = swn.texte_numero THEN 0 ELSE 1 END,
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

    if (dryRun) {
      const countSenat = await prisma.$queryRaw<{ linked: bigint; not_found: bigint }[]>`
        WITH scrutins_senat AS (
          SELECT
            s.id,
            s.dossier_id,
            SUBSTRING(s.titre FROM '[°º\u0092[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero
          FROM scrutins s
          WHERE s.titre ILIKE '%amendement%'
            AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
            AND s.chambre = 'senat'
            AND s.dossier_id IS NOT NULL
        ),
        matched AS (
          SELECT ss.id, a.id as amendement_id
          FROM scrutins_senat ss
          LEFT JOIN amendements a ON
            a.numero = ss.amendement_numero
            AND a.chambre = 'senat'
            AND a.dossier_id = ss.dossier_id
          WHERE ss.amendement_numero IS NOT NULL
        )
        SELECT
          COUNT(CASE WHEN amendement_id IS NOT NULL THEN 1 END)::bigint as linked,
          COUNT(CASE WHEN amendement_id IS NULL THEN 1 END)::bigint as not_found
        FROM matched
      `;
      totalLinked += Number(countSenat[0]?.linked || 0);
      totalNotFound += Number(countSenat[0]?.not_found || 0);
    } else {
      // INSERT into join table for Sénat
      // Sénat amendment numbering is per-text, so we can ONLY safely link when the
      // scrutin has a dossier_id (gives us context to identify the right text).
      // Without dossier_id, matching just by numero produces massive false positives
      // (e.g. "amendement n° 3" appears in 20+ different scrutins on different texts).
      const resultSenat = await prisma.$executeRaw`
        WITH scrutins_senat AS (
          SELECT
            s.id,
            s.dossier_id,
            SUBSTRING(s.titre FROM '[°º\u0092[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero
          FROM scrutins s
          WHERE s.titre ILIKE '%amendement%'
            AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
            AND s.chambre = 'senat'
            AND s.dossier_id IS NOT NULL
        ),
        best_match AS (
          SELECT DISTINCT ON (ss.id) ss.id as scrutin_id, a.id as amendement_id
          FROM scrutins_senat ss
          INNER JOIN amendements a ON
            a.numero = ss.amendement_numero
            AND a.chambre = 'senat'
            AND a.dossier_id = ss.dossier_id
          WHERE ss.amendement_numero IS NOT NULL
          ORDER BY ss.id, a.id
        )
        INSERT INTO "_AmendementToScrutin" ("A", "B")
        SELECT amendement_id, scrutin_id FROM best_match
        ON CONFLICT DO NOTHING
      `;
      totalLinked += resultSenat;

      const notFoundSenat = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM scrutins s
        WHERE s.titre ILIKE '%amendement%'
          AND NOT EXISTS (SELECT 1 FROM "_AmendementToScrutin" WHERE "B" = s.id)
          AND s.chambre = 'senat'
          AND SUBSTRING(s.titre FROM '[°º\u0092[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') IS NOT NULL
      `;
      totalNotFound += Number(notFoundSenat[0]?.count || 0);
    }
    logger.info({ chambre: 'senat', linked: totalLinked - linkedBeforeSenat }, 'Sénat linking done');
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
    },
    take: limitCount,
    orderBy: { numero: 'desc' }, // Plus récents d'abord
  });

  logger.info({ count: scrutinsToEnrich.length }, 'Scrutins to enrich');

  if (scrutinsToEnrich.length === 0) {
    return { enriched: 0, notFound: 0, errors: 0 };
  }

  // Charger tous les amendements AN pour le matching rapide
  // Clé: "{texteNumero}-{amendementNumero}" -> amendementId
  const amendementsAN = await prisma.amendement.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, numero: true, texteRef: true },
  });

  const amendementMap = new Map<string, string>();
  for (const a of amendementsAN) {
    if (a.texteRef && a.numero) {
      // Extraire le numéro de texte depuis texte_ref (format: PIONANR5L17B2364 ou PRJLANR5L17BTC2364)
      const texteMatch = a.texteRef.match(/B(?:TC)?(\d+)/);
      if (texteMatch) {
        const texteNumero = texteMatch[1];
        const key = `${texteNumero}-${a.numero}`.toUpperCase();
        amendementMap.set(key, a.id);
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

          // Collecter tous les amendements trouvés
          const foundAmendementIds: string[] = [];
          for (const match of allMatches) {
            const [, texteNumero, , amendementNumero] = match;
            const key = `${texteNumero}-${amendementNumero}`.toUpperCase();
            const amendementId = amendementMap.get(key);
            if (amendementId && !foundAmendementIds.includes(amendementId)) {
              foundAmendementIds.push(amendementId);
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
  options: { limit?: number; dryRun?: boolean; concurrency?: number; reset?: boolean } = {}
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
  // Télécharger et parser le mapping txt_ameli pour convertir texteNumero externe -> texte_ref interne
  // =========================================================================
  logger.info('Downloading AMELI dump to build texte number mapping...');
  const texteNumToInternalId = new Map<string, number[]>(); // "298" -> [106889, ...]

  try {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const { pipeline } = await import('stream/promises');
    const { createWriteStream, createReadStream } = await import('fs');
    const readline = await import('readline');

    const tempDir = path.join(os.tmpdir(), 'clair-ameli-mapping');
    const zipPath = path.join(tempDir, 'ameli.zip');
    const extractDir = path.join(tempDir, 'extracted');

    await fs.promises.rm(tempDir, { recursive: true, force: true });
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Download AMELI
    const ameliUrl = 'https://data.senat.fr/data/ameli/ameli.zip';
    const response = await axios({
      method: 'GET',
      url: ameliUrl,
      responseType: 'stream',
      timeout: 300000,
      headers: { 'User-Agent': 'CLAIR-Bot/1.0' },
    });
    const writer = createWriteStream(zipPath);
    await pipeline(response.data, writer);

    // Extract
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await fs.promises.mkdir(extractDir, { recursive: true });
    await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`, { maxBuffer: 1024 * 1024 * 100 });

    // Find SQL file
    const files = await fs.promises.readdir(extractDir, { recursive: true });
    const sqlFile = files.find(f => f.toString().endsWith('.sql'));
    if (!sqlFile) throw new Error('No SQL file found');
    const sqlPath = path.join(extractDir, sqlFile.toString());

    // Parse txt_ameli table only
    const rl = readline.createInterface({
      input: createReadStream(sqlPath, { encoding: 'latin1' }),
      crlfDelay: Infinity,
    });

    let currentTable: string | null = null;
    let txtCount = 0;

    for await (const line of rl) {
      if (line.startsWith('COPY ')) {
        const match = line.match(/COPY (\w+)/);
        currentTable = match ? match[1] : null;
        continue;
      }
      if (line === '\\.' || line === '\\.') {
        currentTable = null;
        continue;
      }

      // Parse txt_ameli: id(0), natid(1), lecid(2), sesinsid(3), sesdepid(4), fbuid(5), num(6), ...
      if (currentTable === 'txt_ameli') {
        const fields = line.split('\t');
        if (fields.length < 7) continue;
        const id = parseInt(fields[0] ?? '0', 10);
        const num = (fields[6] ?? '').trim();
        if (id && num) {
          const existing = texteNumToInternalId.get(num) || [];
          existing.push(id);
          texteNumToInternalId.set(num, existing);
          txtCount++;
        }
      }
    }

    logger.info({ txtCount, uniqueNums: texteNumToInternalId.size }, 'Texte number mapping loaded');

    // Cleanup
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to load texte mapping - will fallback to date-based matching');
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
          const scrutinDate = scrutin.date;
          const minDate = new Date(scrutinDate);
          minDate.setDate(minDate.getDate() - 60);

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

            let candidates;
            if (targetTexteRefs.length > 0) {
              candidates = await prisma.amendement.findMany({
                where: {
                  chambre: 'senat',
                  numero: baseNumero,
                  texteRef: { in: targetTexteRefs },
                },
                select: { id: true },
                orderBy: { dateDepot: 'desc' },
                take: 1,
              });
            } else {
              candidates = await prisma.amendement.findMany({
                where: {
                  chambre: 'senat',
                  numero: baseNumero,
                  dateDepot: { gte: minDate, lte: scrutinDate },
                },
                select: { id: true },
                orderBy: { dateDepot: 'desc' },
                take: 1,
              });
            }

            if (candidates[0] && !foundAmendementIds.includes(candidates[0].id)) {
              foundAmendementIds.push(candidates[0].id);
            }
          }

          if (foundAmendementIds.length === 0) {
            logger.debug({
              scrutinNumero: scrutin.numero,
              matchCount: allMatches.length,
              scrutinDate: scrutinDate.toISOString(),
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

export async function syncLobbyistes(
  options: { limit?: number; includeActions?: boolean } = {}
): Promise<{ lobbyistes: { created: number; updated: number }; actions: number }> {
  const { HATVPClient } = await import('../sources/hatvp/client.js');

  const includeActions = options.includeActions ?? true;
  logger.info({ limit: options.limit, includeActions }, 'Starting lobbyistes sync (HATVP)...');

  const hatvpClient = new HATVPClient();
  const { lobbyistes: csvLobbyistes, activites: csvActivites, exercices, actionDetails } =
    await hatvpClient.getDataFromCSV(options.limit);

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
      const type = categorieMap[csvLobbyiste.categorie] || 'entreprise';

      const existing = await prisma.lobbyiste.findFirst({
        where: {
          OR: [
            { sourceId: csvLobbyiste.id },
            ...(siren ? [{ siren }] : []),
          ],
        },
      });

      const secteur = csvLobbyiste.secteurs.length > 0
        ? csvLobbyiste.secteurs.slice(0, 3).join(', ').substring(0, 500)
        : null;

      const nbLobbyistes = csvLobbyiste.nbCollaborateurs > 0
        ? csvLobbyiste.nbCollaborateurs
        : salariesByLobbyiste.get(csvLobbyiste.id) || null;

      const data = {
        sourceId: csvLobbyiste.id,
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

    const activitesByLobbyiste = new Map<string, typeof csvActivites>();
    for (const act of csvActivites) {
      const list = activitesByLobbyiste.get(act.lobbyisteId) || [];
      list.push(act);
      activitesByLobbyiste.set(act.lobbyisteId, list);
    }

    for (const [csvLobbyisteId, acts] of activitesByLobbyiste) {
      const lobbyisteId = lobbyisteIdMap.get(csvLobbyisteId);
      if (!lobbyisteId) continue;

      for (const act of acts) {
        if (!act.objet) continue;

        try {
          let dateDebut = new Date();
          if (act.datePublication) {
            const parsed = new Date(act.datePublication);
            if (!isNaN(parsed.getTime())) {
              dateDebut = parsed;
            }
          }

          const details = actionDetailsByActivite.get(act.activiteId);

          let cible: string | null = null;
          let cibleNom: string | null = null;
          if (details && details.cibles && details.cibles.length > 0) {
            const firstCible = details.cibles[0];
            if (firstCible) {
              cible = determineCibleType(firstCible.type);
              cibleNom = firstCible.nom || firstCible.type?.substring(0, 200) || null;
            }
          }

          let description = act.objet;
          if (act.domaines.length > 0) {
            description = `[${act.domaines.slice(0, 2).join(', ')}] ${description}`;
          }

          let texteVise: string | null = null;
          let texteViseNom: string | null = null;
          if (details && details.decisions && details.decisions.length > 0) {
            texteViseNom = details.decisions.slice(0, 2).join(', ').substring(0, 200);
            const firstDecision = details.decisions[0];
            if (firstDecision) {
              texteVise = firstDecision.substring(0, 500);
            }
          }

          const existingAction = await prisma.actionLobby.findFirst({
            where: {
              lobbyisteId,
              description: { contains: act.objet.substring(0, 50) },
            },
          });

          if (existingAction) {
            await prisma.actionLobby.update({
              where: { id: existingAction.id },
              data: {
                description: description.substring(0, 2000),
                cible,
                cibleNom,
                texteVise,
                texteViseNom,
              },
            });
            actionsUpdated++;
          } else {
            await prisma.actionLobby.create({
              data: {
                lobbyisteId,
                description: description.substring(0, 2000),
                dateDebut,
                cible,
                cibleNom,
                texteVise,
                texteViseNom,
              },
            });
            actionsCreated++;
          }
        } catch (error: any) {
          logger.warn({ activite: act.activiteId, error: error.message }, 'Error syncing action');
        }

        // Pause tous les 500 actions pour laisser le GC respirer
        if ((actionsCreated + actionsUpdated) % 500 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
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

// Export des helpers pour réutilisation
export { extractTags, extractKeywords };
