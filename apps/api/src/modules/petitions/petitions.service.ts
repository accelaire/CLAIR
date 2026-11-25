// =============================================================================
// Module Pétitions : service
// =============================================================================
//
// Ce que l'API expose d'une pétition : son titre, un extrait dans les listes et
// son texte entier remis en paragraphes dans le détail (jamais la colonne
// `description`, aplatie par le jeu de données), son compteur et ses
// relevés, son statut tel que la plateforme l'affiche, et surtout son
// parcours : les étapes lues dans l'agenda des commissions, les dossiers de la
// procédure « Pétitions » et la réponse officielle. Le statut source ne dit
// PAS le sort d'une pétition (il vaut « ouverte » par défaut à la source).
// =============================================================================

import type { Prisma, PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { PetitionParams, PetitionsQuery } from './petitions.schema';
import { renvoisPersonnes } from '../../utils/renvois-personnes';

const CACHE_TTL = 3600;

/** Ordre d'une même journée : l'étape la plus avancée en dernier (comme l'ingestion). */
const RANG_ETAPE: Record<string, number> = {
  seuil_atteint: 0,
  rapporteur: 1,
  decision: 2,
  classement: 3,
  examen: 4,
  rapport: 5,
  decision_conference: 6,
};

const COMMISSION_SELECT = { select: { slug: true, nom: true } } as const;

/** Champs d'une pétition dans une liste. */
export const PETITION_RESUME_SELECT = {
  chambre: true,
  numero: true,
  titre: true,
  extrait: true,
  signatures: true,
  datePublication: true,
  dateLimite: true,
  statutSource: true,
  collecte: true,
  typeSource: true,
  etape: true,
  etapeDate: true,
  suivie: true,
  url: true,
  commission: COMMISSION_SELECT,
} satisfies Prisma.PetitionSelect;

function ordre(sort: PetitionsQuery['sort']): Prisma.PetitionOrderByWithRelationInput[] {
  // Toujours un ordre total : sans départage, deux pages pouvaient se partager
  // ou s'échanger des lignes ex æquo.
  const departage: Prisma.PetitionOrderByWithRelationInput[] = [{ chambre: 'asc' }, { numero: 'desc' }];
  switch (sort) {
    case 'date':
      return [{ datePublication: 'desc' }, ...departage];
    case 'etape':
      return [{ etapeDate: { sort: 'desc', nulls: 'last' } }, { signatures: { sort: 'desc', nulls: 'last' } }, ...departage];
    default:
      return [{ signatures: { sort: 'desc', nulls: 'last' } }, ...departage];
  }
}

/** Seuil des pétitions suivies (`SEUIL_SUIVIE` de l'ingestion). */
const SEUIL_SUIVIE = 10_000;

/**
 * Les pétitions dont le parcours a bougé en dernier, pour l'accueil et le
 * bandeau de la liste. L'étape datée la plus tardive d'abord : un examen
 * annoncé passe devant le dernier rapport publié. Les commissions classent par
 * lots (2 043 des 2 057 étapes, médiane de 78 signatures, novembre 2026) : un
 * classement ne compte que pour une pétition suivie, sinon on ne montrerait
 * que des lots.
 */
export async function dernieresEtapes(prisma: PrismaClient, nombre: number) {
  return prisma.petition.findMany({
    where: {
      etapeDate: { not: null },
      OR: [{ etape: { not: 'classement' } }, { signatures: { gte: SEUIL_SUIVIE } }],
    },
    select: PETITION_RESUME_SELECT,
    orderBy: [{ etapeDate: 'desc' }, { signatures: { sort: 'desc', nulls: 'last' } }, { chambre: 'asc' }, { numero: 'desc' }],
    take: nombre,
  });
}

/** Pétitions du bandeau « Dernières étapes » de la liste. */
const DERNIERES_ETAPES = 3;

export class PetitionsService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
  ) {}

  private async enCache<T>(cle: string, calcul: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(cle);
    if (cached) return JSON.parse(cached) as T;
    const valeur = await calcul();
    await this.redis.setex(cle, CACHE_TTL, JSON.stringify(valeur));
    return valeur;
  }

  async lister(query: PetitionsQuery) {
    return this.enCache(`petitions:list:${JSON.stringify(query)}`, async () => {
      const where: Prisma.PetitionWhereInput = {};
      if (query.chambre) where.chambre = query.chambre;
      if (query.commission) where.commission = { slug: query.commission };
      if (query.collecte) where.collecte = query.collecte;
      if (query.etape) where.etape = query.etape === 'aucune' ? null : query.etape;
      if (query.suivies !== undefined) where.suivie = query.suivies;
      if (query.search) {
        const numero = /^\d{1,6}$/.test(query.search) ? Number(query.search) : null;
        where.OR = [
          { titre: { contains: query.search, mode: 'insensitive' } },
          ...(numero !== null ? [{ numero }] : []),
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.petition.findMany({
          where,
          select: PETITION_RESUME_SELECT,
          orderBy: ordre(query.sort),
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.petition.count({ where }),
      ]);
      const totalPages = Math.ceil(total / query.limit);
      return {
        data,
        meta: { total, page: query.page, limit: query.limit, totalPages, hasNext: query.page < totalPages },
      };
    });
  }

  /** Les dernières pétitions à franchir une étape (cf. `dernieresEtapes`). */
  async dernieresEtapes() {
    return this.enCache('petitions:dernieres-etapes', () => dernieresEtapes(this.prisma, DERNIERES_ETAPES));
  }

  /** Compteurs des filtres de la liste, sur tout le corpus. */
  async filtres() {
    return this.enCache('petitions:filtres', async () => {
      const [chambres, etapes, suivies, commissions] = await Promise.all([
        this.prisma.petition.groupBy({ by: ['chambre'], _count: true, orderBy: { chambre: 'asc' } }),
        this.prisma.petition.groupBy({ by: ['etape'], _count: true, orderBy: { etape: 'asc' } }),
        this.prisma.petition.count({ where: { suivie: true } }),
        this.prisma.commission.findMany({
          where: { petitions: { some: {} } },
          select: { slug: true, nom: true, _count: { select: { petitions: true } } },
          orderBy: { nom: 'asc' },
        }),
      ]);
      return {
        chambres: chambres.map((c) => ({ chambre: c.chambre, total: c._count })),
        etapes: etapes.map((e) => ({ etape: e.etape ?? 'aucune', total: e._count })),
        suivies,
        commissions: commissions.map((c) => ({ slug: c.slug, nom: c.nom, total: c._count.petitions })),
      };
    });
  }

  async detail({ chambre, numero }: PetitionParams) {
    return this.enCache(`petitions:detail:${chambre}:${numero}`, async () => {
      const p = await this.prisma.petition.findUnique({
        where: { chambre_numero: { chambre, numero } },
        select: {
          ...PETITION_RESUME_SELECT,
          texte: true,
          texteIncomplet: true,
          legislature: true,
          commissionSource: true,
          decisionSource: true,
          decisionPage: true,
          decisionPageDate: true,
          updatedAt: true,
          etapes: {
            select: {
              type: true,
              date: true,
              source: true,
              rattachement: true,
              libelle: true,
              reunion: {
                select: {
                  uid: true,
                  dateDebut: true,
                  etat: true,
                  commission: COMMISSION_SELECT,
                },
              },
              dossier: { select: { uid: true, titre: true } },
            },
          },
          releves: { select: { date: true, signatures: true }, orderBy: { date: 'asc' } },
        },
      });
      if (!p) return null;

      const { decisionSource, decisionPage, decisionPageDate, etapes, ...reste } = p;
      const decision = decisionPage ?? decisionSource;
      return {
        ...reste,
        // La réponse lue sur la page officielle prime : le jeu de données ne
        // capte la décision que sous deux tournures.
        decision,
        decisionDate: decisionPage ? decisionPageDate : null,
        etapes: [...etapes].sort((a, b) =>
          (a.date?.getTime() ?? -Infinity) - (b.date?.getTime() ?? -Infinity)
          || (RANG_ETAPE[a.type] ?? 99) - (RANG_ETAPE[b.type] ?? 99)
          || a.source.localeCompare(b.source)),
        // Parlementaires et membres du Gouvernement cités dans les libellés et
        // la décision, à relier à leur fiche (cf. `utils/renvois-personnes`).
        renvois: await renvoisPersonnes(this.prisma, [decision ?? '', ...etapes.map((e) => e.libelle)]),
      };
    });
  }
}

/** Pétitions dont un dossier porte le rapport (encart de la page dossier). */
export async function petitionsDuDossier(prisma: PrismaClient, dossierId: string) {
  return prisma.petition.findMany({
    where: { etapes: { some: { dossierId } } },
    select: { chambre: true, numero: true, titre: true, signatures: true, etape: true, etapeDate: true },
    orderBy: [{ signatures: { sort: 'desc', nulls: 'last' } }, { chambre: 'asc' }, { numero: 'desc' }],
  });
}
