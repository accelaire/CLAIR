// =============================================================================
// Module Sujets - Service (Business Logic)
// =============================================================================

import { PrismaClient } from '@prisma/client';
import type {
  SujetsListQuery,
  SujetScrutinsQuery,
  CreateSujetInput,
  UpdateSujetInput,
} from './sujets.schema';

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class SujetsService {
  constructor(private prisma: PrismaClient) {}

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Liste des sujets avec pagination et filtres
   */
  async list(query: SujetsListQuery) {
    const { page, limit, category, search, featured, actif } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(actif !== undefined && { actif }),
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
          { memberCount: 'desc' },
        ],
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          label: true,
          description: true,
          category: true,
          memberCount: true,
          dateDebut: true,
          dateFin: true,
          featured: true,
          featuredOrder: true,
          newsUrl: true,
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
      where: {
        slug,
        actif: true, // Ne pas retourner les sujets désactivés
      },
      select: {
        id: true,
        slug: true,
        label: true,
        description: true,
        category: true,
        memberCount: true,
        dateDebut: true,
        dateFin: true,
        featured: true,
        featuredOrder: true,
        usefulLinks: true,
        newsUrl: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return sujet;
  }

  /**
   * Scrutins d'un sujet avec pagination
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
      sujetId: sujet.id,
      ...(chambre && { scrutin: { chambre } }),
    };

    const [scrutinLinks, total] = await Promise.all([
      this.prisma.scrutinSujet.findMany({
        where,
        orderBy: { scrutin: { date: 'desc' } },
        skip,
        take: limit,
        select: {
          similarity: true,
          auto: true,
          scrutin: {
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
          },
        },
      }),
      this.prisma.scrutinSujet.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: scrutinLinks.map(link => ({
        ...link.scrutin,
        similarity: link.similarity,
        auto: link.auto,
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
   * Sujets featured pour la homepage
   */
  async getFeatured(limit: number = 6) {
    const sujets = await this.prisma.sujet.findMany({
      where: {
        featured: true,
        actif: true,
      },
      orderBy: { featuredOrder: 'asc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        label: true,
        description: true,
        category: true,
        memberCount: true,
        newsUrl: true,
        dateDebut: true,
        dateFin: true,
      },
    });

    return { data: sujets };
  }

  /**
   * Stats de votes par groupe pour un sujet
   */
  async getVoteStats(slug: string) {
    const sujet = await this.prisma.sujet.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!sujet) return null;

    // Requête agrégée pour les stats par groupe
    const stats = await this.prisma.$queryRaw<Array<{
      groupe_nom: string;
      groupe_slug: string;
      groupe_couleur: string;
      position: string;
      count: bigint;
    }>>`
      SELECT
        gp.nom as groupe_nom,
        gp.slug as groupe_slug,
        gp.couleur as groupe_couleur,
        v.position,
        COUNT(*) as count
      FROM scrutins_sujets ss
      JOIN scrutins s ON ss.scrutin_id = s.id
      JOIN votes v ON v.scrutin_id = s.id
      JOIN parlementaires p ON v.parlementaire_id = p.id
      LEFT JOIN groupes_politiques gp ON p.groupe_id = gp.id
      WHERE ss.sujet_id = ${sujet.id}
      GROUP BY gp.nom, gp.slug, gp.couleur, v.position
    `;

    // Transformer en structure par groupe
    const byGroupe: Record<string, {
      nom: string;
      slug: string;
      couleur: string;
      votes: { pour: number; contre: number; abstention: number; absent: number };
    }> = {};

    for (const row of stats) {
      const groupeKey = row.groupe_slug || 'non-inscrit';

      if (!byGroupe[groupeKey]) {
        byGroupe[groupeKey] = {
          nom: row.groupe_nom || 'Non inscrit',
          slug: row.groupe_slug || 'non-inscrit',
          couleur: row.groupe_couleur || '#808080',
          votes: { pour: 0, contre: 0, abstention: 0, absent: 0 },
        };
      }

      byGroupe[groupeKey].votes[row.position as keyof typeof byGroupe[string]['votes']] = Number(row.count);
    }

    return { data: Object.values(byGroupe) };
  }

  // ===========================================================================
  // ADMIN METHODS
  // ===========================================================================

  /**
   * Créer un nouveau sujet manuellement
   */
  async create(input: CreateSujetInput) {
    const sujet = await this.prisma.sujet.create({
      data: {
        slug: input.slug,
        label: input.label,
        description: input.description,
        category: input.category,
        featured: input.featured,
        featuredOrder: input.featuredOrder,
        usefulLinks: input.usefulLinks,
        newsUrl: input.newsUrl,
        memberCount: 0,
        actif: true,
      },
    });

    return sujet;
  }

  /**
   * Mettre à jour un sujet
   */
  async update(slug: string, input: UpdateSujetInput) {
    const sujet = await this.prisma.sujet.update({
      where: { slug },
      data: {
        ...(input.slug && { slug: input.slug }),
        ...(input.label && { label: input.label }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.category && { category: input.category }),
        ...(input.featured !== undefined && { featured: input.featured }),
        ...(input.featuredOrder !== undefined && { featuredOrder: input.featuredOrder }),
        ...(input.usefulLinks && { usefulLinks: input.usefulLinks }),
        ...(input.newsUrl !== undefined && { newsUrl: input.newsUrl }),
        ...(input.actif !== undefined && { actif: input.actif }),
      },
    });

    return sujet;
  }

  /**
   * Désactiver un sujet (soft delete)
   */
  async deactivate(slug: string) {
    const sujet = await this.prisma.sujet.update({
      where: { slug },
      data: { actif: false },
    });

    return sujet;
  }

  /**
   * Lier un scrutin à un sujet manuellement
   */
  async linkScrutin(slug: string, scrutinId: string, similarity?: number) {
    const sujet = await this.prisma.sujet.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!sujet) return null;

    await this.prisma.scrutinSujet.upsert({
      where: {
        scrutinId_sujetId: {
          scrutinId,
          sujetId: sujet.id,
        },
      },
      create: {
        scrutinId,
        sujetId: sujet.id,
        similarity: similarity || null,
        auto: false,
      },
      update: {
        similarity: similarity || null,
        auto: false,
      },
    });

    // Mettre à jour le compteur
    await this.updateMemberCount(sujet.id);

    return { success: true };
  }

  /**
   * Délier un scrutin d'un sujet
   */
  async unlinkScrutin(slug: string, scrutinId: string) {
    const sujet = await this.prisma.sujet.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!sujet) return null;

    await this.prisma.scrutinSujet.delete({
      where: {
        scrutinId_sujetId: {
          scrutinId,
          sujetId: sujet.id,
        },
      },
    });

    // Mettre à jour le compteur
    await this.updateMemberCount(sujet.id);

    return { success: true };
  }

  /**
   * Fusionner deux sujets
   */
  async merge(sourceSlug: string, targetSlug: string) {
    const [source, target] = await Promise.all([
      this.prisma.sujet.findUnique({ where: { slug: sourceSlug }, select: { id: true } }),
      this.prisma.sujet.findUnique({ where: { slug: targetSlug }, select: { id: true } }),
    ]);

    if (!source || !target) return null;

    // Transférer tous les liens scrutin
    await this.prisma.$executeRaw`
      UPDATE scrutins_sujets
      SET sujet_id = ${target.id}
      WHERE sujet_id = ${source.id}
        AND scrutin_id NOT IN (
          SELECT scrutin_id FROM scrutins_sujets WHERE sujet_id = ${target.id}
        )
    `;

    // Supprimer les doublons restants
    await this.prisma.scrutinSujet.deleteMany({
      where: { sujetId: source.id },
    });

    // Désactiver le sujet source
    await this.prisma.sujet.update({
      where: { id: source.id },
      data: { actif: false },
    });

    // Mettre à jour le compteur du target
    await this.updateMemberCount(target.id);

    return { success: true, mergedInto: targetSlug };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async updateMemberCount(sujetId: string) {
    const count = await this.prisma.scrutinSujet.count({
      where: { sujetId },
    });

    await this.prisma.sujet.update({
      where: { id: sujetId },
      data: { memberCount: count },
    });
  }
}

export default SujetsService;
