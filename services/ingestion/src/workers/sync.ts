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

      // Rechercher le premier amendement lié
      // NOTE: Pour le Sénat, le matching par numero seul est imprécis car plusieurs
      // amendements peuvent avoir le même numéro sur des textes différents.
      // Le matching précis se fait dans linkScrutinsToAmendements() pour l'AN.
      // Pour le Sénat, on garde ce fallback mais le linking peut être incorrect.
      let amendementId: string | null = null;
      if (scrutin.amendementsNumeros && scrutin.amendementsNumeros.length > 0) {
        for (const num of scrutin.amendementsNumeros) {
          const numUpper = num.toUpperCase();
          const found = amendementByNumero.get(numUpper);
          if (found) {
            amendementId = found;
            amendementsLinked++;
            break;
          }
        }
      }

      const scrutinData = {
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
        amendementId,
        tags,
        importance,
        sourceUrl: scrutin.sourceUrl,
        sourceData: scrutin.sourceData as object,
      };

      const existing = await prisma.scrutin.findUnique({
        where: { numero_chambre_session: { numero: scrutin.numero, chambre, session: sessionYear } },
      });

      let scrutinId: string;

      if (existing) {
        await prisma.scrutin.update({
          where: { numero_chambre_session: { numero: scrutin.numero, chambre, session: sessionYear } },
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
    logger.info('Linking scrutins to amendements...');
    try {
      const linkResult = await linkScrutinsToAmendements();
      logger.info({
        linked: linkResult.linked,
        notFound: linkResult.notFound,
      }, 'Scrutins-Amendements linking completed');

      // Enrichissement AN: scrape les pages HTML pour lier les amendements manquants
      // Cela corrige les cas où le numéro d'amendement seul n'est pas suffisant
      if (linkResult.notFound > 0) {
        logger.info('Enriching AN scrutins with HTML scraping...');
        const enrichResult = await enrichScrutinsANAmendements({
          concurrency: 5, // Parallélisme modéré pour éviter le rate limiting
        });
        logger.info({
          enriched: enrichResult.enriched,
          notFound: enrichResult.notFound,
          errors: enrichResult.errors,
        }, 'AN scrutins enrichment completed');
      }
    } catch (error: any) {
      logger.error({ error: error.message }, 'Scrutins-Amendements linking failed (non-blocking)');
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

    } catch (e: any) {
      logger.warn({ uid: dossier.uid, error: e.message }, 'Failed to upsert dossier');
    }
  }

  logger.info({ created, updated, scrutinsLinked, total: dossiers.length }, 'Dossiers législatifs sync completed');
  return { created, updated, scrutinsLinked };
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

  logger.info({ chambre: chambre || 'all', dryRun, reset }, 'Starting scrutins-amendements linking (with texte matching)...');

  // Si reset est demandé, réinitialiser les liens existants
  if (reset && !dryRun) {
    const chambreFilter = chambre || '%';
    const resetCount = await prisma.$executeRaw`
      UPDATE scrutins
      SET amendement_id = NULL
      WHERE amendement_id IS NOT NULL
        AND chambre LIKE ${chambreFilter}
    `;
    logger.info({ resetCount }, 'Reset existing amendement links');
  }

  let totalLinked = 0;
  let totalNotFound = 0;

  // === ASSEMBLÉE NATIONALE ===
  // Pour l'AN, on peut extraire le numéro de texte depuis:
  // 1. sourceData->'objet'->>'referenceLegislative' (ex: "PIONANR5L17B2364")
  // 2. Le titre lui-même (ex: "projet de loi n° 2364")
  // Et on le compare avec texte_ref de l'amendement qui contient ce numéro
  if (!chambre || chambre === 'assemblee') {
    if (dryRun) {
      // Mode dry-run avec matching optimisé (comparaison exacte du numéro de texte)
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
            AND s.amendement_id IS NULL
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
      // UPDATE pour l'AN avec matching sur texte_ref
      // Optimisation: extraire le numéro de texte depuis texte_ref pour comparaison exacte
      // Format texte_ref AN: PIONANR5L17B2364 ou PIONANR5L17BTC2364
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
            AND s.amendement_id IS NULL
            AND s.chambre = 'assemblee'
        ),
        amendements_with_texte AS (
          -- Pré-calculer le numéro de texte depuis texte_ref pour chaque amendement AN
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
            -- Préférer les amendements qui matchent exactement le texte_numero
            CASE WHEN swn.texte_numero IS NOT NULL AND awt.amendement_texte_numero = swn.texte_numero THEN 0 ELSE 1 END,
            awt.id
        )
        UPDATE scrutins s
        SET amendement_id = bm.amendement_id
        FROM best_match bm
        WHERE s.id = bm.scrutin_id
      `;
      totalLinked += resultAN;

      // Compter les non trouvés pour AN
      const notFoundAN = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM scrutins s
        WHERE s.titre ILIKE '%amendement%'
          AND s.amendement_id IS NULL
          AND s.chambre = 'assemblee'
          AND SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') IS NOT NULL
      `;
      totalNotFound += Number(notFoundAN[0]?.count || 0);
    }
    logger.info({ chambre: 'assemblee', linked: totalLinked, notFound: totalNotFound }, 'AN linking done');
  }

  // === SÉNAT ===
  // Pour le Sénat, le format texteRef est SENAT-TXT-XXXXXX (ID interne, pas le numéro visible)
  // On utilise une approche différente: matcher par le titre qui contient souvent l'info du dossier
  // ou par les amendementsNumeros stockés dans sourceData
  if (!chambre || chambre === 'senat') {
    const linkedBeforeSenat = totalLinked;

    if (dryRun) {
      // Pour le Sénat en dry-run, on compte juste les scrutins avec amendement dans le titre
      const countSenat = await prisma.$queryRaw<{ linked: bigint; not_found: bigint }[]>`
        WITH scrutins_senat AS (
          SELECT
            s.id,
            SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') as amendement_numero
          FROM scrutins s
          WHERE s.titre ILIKE '%amendement%'
            AND s.amendement_id IS NULL
            AND s.chambre = 'senat'
        ),
        matched AS (
          SELECT ss.id, a.id as amendement_id
          FROM scrutins_senat ss
          LEFT JOIN amendements a ON a.numero = ss.amendement_numero AND a.chambre = 'senat'
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
      // Pour le Sénat, on fait un matching plus simple car le format est différent
      // On garde l'ancien comportement mais on log un warning
      // TODO: Améliorer le matching Sénat avec les données DOSLEG amescr
      const resultSenat = await prisma.$executeRaw`
        UPDATE scrutins s
        SET amendement_id = a.id
        FROM amendements a
        WHERE s.titre ILIKE '%amendement%'
          AND s.amendement_id IS NULL
          AND a.chambre = 'senat'
          AND s.chambre = 'senat'
          AND a.numero = SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]')
      `;
      totalLinked += resultSenat;

      const notFoundSenat = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM scrutins s
        WHERE s.titre ILIKE '%amendement%'
          AND s.amendement_id IS NULL
          AND s.chambre = 'senat'
          AND SUBSTRING(s.titre FROM '[°º[:space:]]([A-Z]*-?[0-9]+)[[:space:],]') IS NOT NULL
      `;
      totalNotFound += Number(notFoundSenat[0]?.count || 0);

      if (resultSenat > 0) {
        logger.warn(
          { linked: resultSenat },
          'Sénat linking uses simple numero matching - some may be incorrect. Consider using syncScrutinsSenat with enriched amendement data.'
        );
      }
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
  options: { limit?: number; dryRun?: boolean; concurrency?: number } = {}
): Promise<{ enriched: number; notFound: number; errors: number }> {
  const dryRun = options.dryRun ?? false;
  const concurrency = options.concurrency ?? 3; // Limiter les requêtes parallèles pour éviter le rate limiting
  const limitCount = options.limit;

  logger.info({ dryRun, concurrency, limit: limitCount }, 'Starting AN scrutins enrichment (scraping HTML)...');

  // Charger les scrutins AN qui mentionnent "amendement" mais n'ont pas d'amendement lié
  const scrutinsToEnrich = await prisma.scrutin.findMany({
    where: {
      chambre: 'assemblee',
      titre: { contains: 'amendement', mode: 'insensitive' },
      amendementId: null,
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

  // Regex pour extraire le lien vers l'amendement
  // Format: href="...amendements/{texteNumero}/{commission}/{amendementNumero}"
  const amendementLinkRegex = /href="[^"]*\/amendements\/(\d+)\/([A-Z]+)\/(\d+)"/;

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

          // Extraire le lien vers l'amendement
          const match = html.match(amendementLinkRegex);
          if (!match) {
            logger.debug({ scrutinNumero: scrutin.numero }, 'No amendment link found in HTML');
            return { status: 'notFound' as const };
          }

          const [, texteNumero, , amendementNumero] = match;
          const key = `${texteNumero}-${amendementNumero}`.toUpperCase();

          // Chercher l'amendement correspondant
          const amendementId = amendementMap.get(key);
          if (!amendementId) {
            logger.debug({ scrutinNumero: scrutin.numero, key }, 'Amendment not found in database');
            return { status: 'notFound' as const };
          }

          // Mettre à jour le scrutin
          if (!dryRun) {
            await prisma.scrutin.update({
              where: { id: scrutin.id },
              data: { amendementId },
            });
          }

          logger.debug({ scrutinNumero: scrutin.numero, key, amendementId, dryRun }, 'Amendment linked');
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

  logger.info({ enriched, notFound, errors, dryRun }, 'AN scrutins enrichment completed');
  return { enriched, notFound, errors };
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
