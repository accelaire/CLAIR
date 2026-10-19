import { z } from 'zod';
import { booleenDeRequete } from '../../utils/requete';

export const dossiersListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  etat: z.enum(['en_cours', 'adopte', 'rejete', 'promulgue']).optional(),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  procedureCode: z.string().optional(),
  procedureLibelle: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(['date', 'scrutins']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Filtres de la liste des scrutins d'un dossier.
 *
 * `type` était lu jusqu'ici depuis le `rest` de `paginationQuerySchema`, qui ne
 * le déclare pas : Zod supprimant les clés inconnues, le filtre serveur était
 * silencieusement inopérant et la page se rabattait sur un tri côté client — donc
 * borné aux pages déjà chargées. Les deux filtres sont désormais déclarés.
 */
export const scrutinsQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['solennel', 'ordinaire', 'motion']).optional(),
  nature: z
    .enum(['ensemble', 'article', 'amendement', 'credits', 'motion', 'declaration', 'autre'])
    .optional(),
});

export const amendementsQuerySchema = paginationQuerySchema.extend({
  voted: booleenDeRequete.optional(),
  groupe: z.string().optional(), // slug du groupe politique pour filtrer par auteur
  sort: z.string().optional(), // valeur exacte du sort (ex: "adopté", "rejeté", "retiré")
  // Sans les sous-amendements, qui se chargent sous leur parent (`parentId`).
  racines: booleenDeRequete.optional(),
  parentId: z.string().optional(), // les sous-amendements d'un amendement
  // Les amendements d'une même discussion commune ou d'un même groupe
  // d'identiques. L'identifiant n'est unique qu'au sein d'une chambre.
  discussionCommune: z.string().optional(),
  discussionIdentique: z.string().optional(),
  chambre: z.enum(['assemblee', 'senat']).optional(),
  // Un seul amendement, par son uid : la cible d'un lien vers le dossier.
  amendement: z.string().optional(),
});

export const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});
