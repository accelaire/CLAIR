// =============================================================================
// Module Sujets V2 - Service (Business Logic)
// Les scrutins sont atteints via les dossiers (pas de table pivot ScrutinSujet)
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { parseActesLegislatifs } from '../../utils/parse-actes-legislatifs';
import { buildJournalOfficielUrl } from '../../utils/journal-officiel';
import type {
  SujetsListQuery,
  SujetScrutinsQuery,
  SujetDossiersQuery,
} from './sujets.schema';

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class SujetsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Liste des sujets avec pagination et filtres
   */
  async list(query: SujetsListQuery) {
    const { page, limit, category, search, featured } = query;
    const skip = (page - 1) * limit;

    const where = {
      actif: true,
      ...(category && { category }),
      ...(featured !== undefined && { featured }),
      ...(search && {
        OR: [
          { label: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [sujets, total] = await Promise.all([
      this.prisma.sujet.findMany({
        where,
        orderBy: [
          { featured: 'desc' },
          { featuredOrder: 'asc' },
          { scrutinCount: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          label: true,
          description: true,
          category: true,
          dossierCount: true,
          scrutinCount: true,
          matchMethod: true,
          status: true,
          dateDebut: true,
          dateFin: true,
          dateDernierVote: true,
          featured: true,
          featuredOrder: true,
          createdAt: true,
        },
      }),
      this.prisma.sujet.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: sujets,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Détail d'un sujet par slug
   */
  async getBySlug(slug: string) {
    const sujet = await this.prisma.sujet.findFirst({
      where: { slug, actif: true },
      select: {
        id: true,
        slug: true,
        label: true,
        description: true,
        category: true,
        dossierCount: true,
        scrutinCount: true,
        matchMethod: true,
        status: true,
        dateDebut: true,
        dateFin: true,
        dateDernierVote: true,
        resume: true,
        enjeux: true,
        featured: true,
        featuredOrder: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
        liens: {
          select: {
            id: true,
            famille: true,
            titre: true,
            url: true,
            source: true,
            sourceLabel: true,
            datePublication: true,
            ordre: true,
          },
          orderBy: [{ famille: 'asc' }, { ordre: 'asc' }, { titre: 'asc' }],
        },
      },
    });

    if (!sujet) return null;

    // Regroupe les liens sortants par famille (construction / contexte).
    // La famille "presse" n'est pas servie ici (live + cache, cf. plan).
    const { liens, ...rest } = sujet;
    return {
      ...rest,
      liens: {
        construction: liens.filter(l => l.famille === 'construction'),
        contexte: liens.filter(l => l.famille === 'contexte'),
      },
    };
  }

  /**
   * Sujets featured pour la homepage
   */
  async getFeatured(limit: number = 6) {
    const sujets = await this.prisma.sujet.findMany({
      where: { featured: true, actif: true },
      orderBy: { featuredOrder: 'asc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        label: true,
        description: true,
        category: true,
        dossierCount: true,
        scrutinCount: true,
        status: true,
        dateDebut: true,
        dateFin: true,
      },
    });

    return { data: sujets };
  }

  /**
   * Dossiers d'un sujet avec pagination
   */
  async getDossiers(slug: string, query: SujetDossiersQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const sujet = await this.prisma.sujet.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!sujet) return null;

    const where = { sujetId: sujet.id };

    const [dossiers, total] = await Promise.all([
      this.prisma.dossierLegislatif.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          uid: true,
          titre: true,
          titreCourt: true,
          procedureCode: true,
          procedureLibelle: true,
          urlAN: true,
          urlSenat: true,
          etat: true,
          dateDepot: true,
          dateAdoption: true,
          loiNumero: true,
          loiTitre: true,
          loiDateJO: true,
          urlLegifrance: true,
          sourceData: true,
          _count: { select: { scrutins: true } },
        },
      }),
      this.prisma.dossierLegislatif.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: dossiers.map(d => ({
        ...d,
        chambre: d.uid.startsWith('SENAT') ? 'senat' : 'assemblee',
        scrutinCount: d._count.scrutins,
        legislativeSteps: parseActesLegislatifs(d.sourceData, { etat: d.etat, loiDateJO: d.loiDateJO }),
        urlJournalOfficiel: buildJournalOfficielUrl(d.sourceData),
        _count: undefined,
        sourceData: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Scrutins d'un sujet avec pagination (via les dossiers)
   */
  async getScrutins(slug: string, query: SujetScrutinsQuery) {
    const { page, limit, chambre } = query;
    const skip = (page - 1) * limit;

    const sujet = await this.prisma.sujet.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!sujet) return null;

    const where = {
      dossier: { sujetId: sujet.id },
      ...(chambre && { chambre }),
    };

    const [scrutins, total] = await Promise.all([
      this.prisma.scrutin.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          numero: true,
          chambre: true,
          session: true,
          date: true,
          titre: true,
          typeVote: true,
          sort: true,
          nombrePour: true,
          nombreContre: true,
          nombreAbstention: true,
          tags: true,
          importance: true,
        },
      }),
      this.prisma.scrutin.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: scrutins,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Stats de votes par groupe pour un sujet
   * Agrège les votes de tous les scrutins des dossiers du sujet
   */
  async getVoteStats(slug: string) {
    const sujet = await this.prisma.sujet.findUnique({
      where: { slug },
      select: { id: true, groupeAmendementDescriptions: true },
    });

    if (!sujet) return null;

    const stats = await this.prisma.$queryRaw<Array<{
      groupe_nom: string;
      groupe_slug: string;
      groupe_couleur: string;
      groupe_chambre: string;
      position: string;
      count: bigint;
    }>>`
      SELECT
        gp.nom as groupe_nom,
        gp.slug as groupe_slug,
        gp.couleur as groupe_couleur,
        gp.chambre as groupe_chambre,
        v.position,
        COUNT(*) as count
      FROM dossiers_legislatifs dl
      JOIN scrutins s ON s.dossier_id = dl.id
      JOIN votes v ON v.scrutin_id = s.id
      JOIN parlementaires p ON v.parlementaire_id = p.id
      LEFT JOIN groupes_politiques gp ON p.groupe_id = gp.id
      WHERE dl.sujet_id = ${sujet.id}
      GROUP BY gp.nom, gp.slug, gp.couleur, gp.chambre, v.position
    `;

    // Amendements par groupe (parallel query)
    const amendementStats = await this.prisma.$queryRaw<Array<{
      groupe_slug: string;
      groupe_chambre: string;
      amendement_count: bigint;
    }>>`
      SELECT
        gp.slug as groupe_slug,
        gp.chambre as groupe_chambre,
        COUNT(*) as amendement_count
      FROM amendements a
      JOIN dossiers_legislatifs dl ON a.dossier_id = dl.id
      JOIN parlementaires p ON a.parlementaire_id = p.id
      JOIN groupes_politiques gp ON p.groupe_id = gp.id
      WHERE dl.sujet_id = ${sujet.id}
      GROUP BY gp.slug, gp.chambre
    `;

    // Index amendement counts by groupe key
    const amendementsByGroupe = new Map<string, number>();
    for (const row of amendementStats) {
      const key = `${row.groupe_slug}-${row.groupe_chambre}`;
      amendementsByGroupe.set(key, Number(row.amendement_count));
    }

    // Transformer en structure par groupe
    const byGroupe: Record<string, {
      nom: string;
      slug: string;
      couleur: string;
      chambre: string;
      votes: { pour: number; contre: number; abstention: number; absent: number };
      amendements: number;
    }> = {};

    for (const row of stats) {
      const groupeKey = row.groupe_slug
        ? `${row.groupe_slug}-${row.groupe_chambre}`
        : 'non-inscrit';

      if (!byGroupe[groupeKey]) {
        byGroupe[groupeKey] = {
          nom: row.groupe_nom || 'Non inscrit',
          slug: row.groupe_slug || 'non-inscrit',
          couleur: row.groupe_couleur || '#808080',
          chambre: row.groupe_chambre || 'assemblee',
          votes: { pour: 0, contre: 0, abstention: 0, absent: 0 },
          amendements: amendementsByGroupe.get(groupeKey) ?? 0,
        };
      }

      byGroupe[groupeKey].votes[row.position as keyof typeof byGroupe[string]['votes']] = Number(row.count);
    }

    return {
      data: Object.values(byGroupe),
      groupeAmendementDescriptions: (sujet.groupeAmendementDescriptions as Record<string, string> | null) ?? {},
    };
  }
}

export default SujetsService;
