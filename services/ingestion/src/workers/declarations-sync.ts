// =============================================================================
// Sync des déclarations HATVP pour les parlementaires
// Match par nom/prénom normalisé + fallback par ID AN (id_origine → sourceId)
// =============================================================================

import { PrismaClient } from '@prisma/client';
import {
  fetchDeclarationsParlementaires,
  normalizeNameForMatching,
  type HATVPDeclarationRow,
} from '../sources/hatvp/declarations-client.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

interface SyncResult {
  total: number;
  matched: number;
  created: number;
  updated: number;
  unmatched: number;
  errors: number;
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export async function syncDeclarationsHATVP(): Promise<SyncResult> {
  const result: SyncResult = {
    total: 0, matched: 0, created: 0, updated: 0, unmatched: 0, errors: 0,
  };

  logger.info('Starting HATVP declarations sync...');

  // 1. Fetch declarations from HATVP
  const declarations = await fetchDeclarationsParlementaires();
  result.total = declarations.length;

  // 2. Load all parlementaires for matching
  const parlementaires = await prisma.parlementaire.findMany({
    select: { id: true, nom: true, prenom: true, chambre: true, sourceId: true },
  });

  // Build lookup maps
  // Map by normalized "prenom nom" → parlementaire id
  const nameMap = new Map<string, string>();
  // Map by sourceId (PA number for AN) → parlementaire id
  const sourceIdMap = new Map<string, string>();

  for (const p of parlementaires) {
    const key = normalizeNameForMatching(`${p.prenom} ${p.nom}`);
    nameMap.set(key, p.id);
    // Also index by "nom prenom" (HATVP uses both orders)
    const keyReverse = normalizeNameForMatching(`${p.nom} ${p.prenom}`);
    nameMap.set(keyReverse, p.id);

    if (p.sourceId) {
      sourceIdMap.set(p.sourceId, p.id);
    }
  }

  logger.info(
    { parlementaires: parlementaires.length, declarations: declarations.length },
    'Matching declarations to parlementaires...'
  );

  // 3. Group declarations by parlementaire for batch processing
  const declsByParl = new Map<string, HATVPDeclarationRow[]>();

  for (const decl of declarations) {
    let parlId: string | undefined;

    // Strategy 1: Match by AN sourceId (id_origine from photo URL)
    if (decl.idOrigine) {
      parlId = sourceIdMap.get(`PA${decl.idOrigine}`);
    }

    // Strategy 2: Match by normalized name
    if (!parlId) {
      const nameKey = normalizeNameForMatching(`${decl.prenom} ${decl.nom}`);
      parlId = nameMap.get(nameKey);
    }

    if (!parlId) {
      result.unmatched++;
      continue;
    }

    result.matched++;
    const list = declsByParl.get(parlId) || [];
    list.push(decl);
    declsByParl.set(parlId, list);
  }

  logger.info(
    { matched: result.matched, unmatched: result.unmatched, parlementaires: declsByParl.size },
    'Declarations matched'
  );

  // 4. Upsert declarations
  for (const [parlId, decls] of declsByParl) {
    for (const decl of decls) {
      try {
        const dateDepot = parseDate(decl.dateDepot);
        const datePublication = parseDate(decl.datePublication);

        // Skip if no dateDepot (needed for unique constraint)
        if (!dateDepot) {
          continue;
        }

        const data = {
          parlementaireId: parlId,
          typeDocument: decl.typeDocument,
          datePublication,
          dateDepot,
          urlDossier: decl.urlDossier,
          nomFichier: decl.nomFichier,
          xmlFichier: decl.xmlFichier,
          statut: decl.statut,
          departement: decl.departement,
        };

        await prisma.declarationHATVP.upsert({
          where: {
            parlementaireId_typeDocument_dateDepot: {
              parlementaireId: parlId,
              typeDocument: decl.typeDocument,
              dateDepot,
            },
          },
          create: data,
          update: {
            datePublication,
            urlDossier: decl.urlDossier,
            nomFichier: decl.nomFichier,
            xmlFichier: decl.xmlFichier,
            statut: decl.statut,
          },
        });

        result.created++;
      } catch (error: any) {
        result.errors++;
        logger.debug(
          { parlId, type: decl.typeDocument, error: error.message },
          'Declaration upsert failed'
        );
      }
    }
  }

  logger.info({
    total: result.total, matched: result.matched, created: result.created,
    unmatched: result.unmatched, errors: result.errors,
  }, 'HATVP declarations sync completed');

  return result;
}
