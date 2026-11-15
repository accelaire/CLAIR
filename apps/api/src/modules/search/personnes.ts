// =============================================================================
// Recherche des personnes : parlementaires et membres du Gouvernement
// =============================================================================
//
// Une personne, un résultat. La recherche rangeait les élus par table
// (députés, sénateurs, membres du Gouvernement) : Sébastien Lecornu, ancien
// sénateur et Premier ministre, sortait deux fois, et un ancien élu n'était
// trouvé qu'en cochant « inclure les anciens » (#129). Ici, une fiche et le
// membre du Gouvernement qui lui est rattaché (`membres_gouvernement.
// parlementaire_id`) ne font qu'un ; les anciens sont toujours là, classés
// après les personnes en fonction.

import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { buildMembreGouvernementSearchCondition, buildParlementaireSearchCondition } from '../../utils/search';
import { fuzzySearchCandidates, type FuzzyCandidate } from '../../utils/fuzzy-search';
import { GouvernementsService } from '../gouvernements/gouvernements.service';

export const ROLES_PERSONNE = ['deputes', 'senateurs', 'gouvernement'] as const;
export type RolePersonne = (typeof ROLES_PERSONNE)[number];

const parlementaireSelect = {
  id: true,
  slug: true,
  chambre: true,
  nom: true,
  prenom: true,
  sexe: true,
  photoUrl: true,
  actif: true,
  groupe: { select: { nom: true, couleur: true } },
  circonscription: { select: { departement: true, nom: true } },
  // Le dernier mandat date un ancien et donne son groupe et sa circonscription
  // d'époque : ceux de `parlementaires` sont ceux du mandat le plus récent.
  mandatsParlementaires: {
    orderBy: [{ dateDebut: 'desc' as const }, { id: 'asc' as const }],
    take: 1,
    select: {
      chambre: true,
      legislature: true,
      mandature: true,
      dateFin: true,
      groupe: { select: { nom: true, couleur: true } },
      circonscription: { select: { departement: true, nom: true } },
    },
  },
} satisfies Prisma.ParlementaireSelect;

type ParlementaireLu = Prisma.ParlementaireGetPayload<{ select: typeof parlementaireSelect }>;
type MembreLu = Awaited<ReturnType<GouvernementsService['rechercherMembres']>>[number];

/** Une personne telle que la recherche la renvoie. */
export interface Personne {
  /** Clé stable du résultat : la fiche, sinon le membre du Gouvernement. */
  cle: string;
  prenom: string;
  nom: string;
  sexe: string | null;
  photoUrl: string | null;
  /** En exercice au Parlement ou au Gouvernement aujourd'hui. */
  enFonction: boolean;
  /** Sa fiche, s'il en a une : mandat en cours ou dernier mandat. */
  parlementaire: {
    slug: string;
    chambre: string;
    actif: boolean;
    groupe: { nom: string; couleur: string | null } | null;
    circonscription: { nom: string; departement: string } | null;
    dernierMandat: { chambre: string; legislature: number | null; mandature: number | null; dateFin: Date | null } | null;
  } | null;
  /** Son passage au Gouvernement, s'il en a un : le poste le plus récent. */
  gouvernement: { membreSlug: string; civilite: string | null; dernierPoste: MembreLu['dernierPoste'] } | null;
  /** Rôles pour les sous-filtres : la chambre de sa fiche, et le Gouvernement. */
  roles: RolePersonne[];
}

function personneDeFiche(p: ParlementaireLu): Personne {
  const dernier = p.mandatsParlementaires[0];
  return {
    cle: `parlementaire:${p.slug}`,
    prenom: p.prenom,
    nom: p.nom,
    sexe: p.sexe,
    photoUrl: p.photoUrl,
    enFonction: p.actif,
    parlementaire: {
      slug: p.slug,
      chambre: p.chambre,
      actif: p.actif,
      // Un ancien est présenté avec le groupe et la circonscription de son dernier mandat.
      groupe: p.actif ? p.groupe : (dernier?.groupe ?? p.groupe),
      circonscription: p.actif ? p.circonscription : (dernier?.circonscription ?? p.circonscription),
      dernierMandat: dernier
        ? { chambre: dernier.chambre, legislature: dernier.legislature, mandature: dernier.mandature, dateFin: dernier.dateFin }
        : null,
    },
    gouvernement: null,
    roles: [p.chambre === 'senat' ? 'senateurs' : 'deputes'],
  };
}

/** Ajoute à une personne (ou crée) son passage au Gouvernement. */
function avecGouvernement(personne: Personne | undefined, m: MembreLu): Personne {
  const enPoste = m.dernierPoste?.dateFin === null;
  const gouvernement = { membreSlug: m.slug, civilite: m.civilite, dernierPoste: m.dernierPoste };
  if (personne) {
    return {
      ...personne,
      enFonction: personne.enFonction || enPoste,
      photoUrl: personne.photoUrl ?? m.parlementaire?.photoUrl ?? null,
      gouvernement,
      roles: [...personne.roles, 'gouvernement'],
    };
  }
  return {
    cle: `membre:${m.slug}`,
    prenom: m.prenom,
    nom: m.nom,
    sexe: m.civilite === 'Mme' ? 'F' : m.civilite === 'M.' ? 'M' : null,
    photoUrl: m.parlementaire?.photoUrl ?? null,
    enFonction: enPoste,
    parlementaire: null,
    gouvernement,
    roles: ['gouvernement'],
  };
}

const normaliser = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s'’-]+/g, ' ').trim();

/**
 * Pertinence du nom pour la recherche : 3 = nom complet (dans un ordre ou
 * l'autre), 2 = nom de famille, 1 = début du nom ou du nom complet, 0 =
 * correspondance ailleurs (prénom seul, circonscription, département).
 */
export function pertinenceDuNom(p: { prenom: string; nom: string }, terme: string): number {
  const t = normaliser(terme);
  const nom = normaliser(p.nom);
  const complet = normaliser(`${p.prenom} ${p.nom}`);
  if (t === complet || t === normaliser(`${p.nom} ${p.prenom}`)) return 3;
  if (t === nom) return 2;
  if (nom.startsWith(t) || complet.startsWith(t)) return 1;
  return 0;
}

/** Date à laquelle la personne a quitté sa dernière fonction ; null si elle en exerce une. */
function finDeFonction(p: Personne): string | null {
  if (p.enFonction) return null;
  const fins = [
    p.parlementaire?.dernierMandat?.dateFin?.toISOString().slice(0, 10) ?? null,
    p.gouvernement?.dernierPoste?.dateFin ?? null,
  ].filter((d): d is string => d !== null);
  return fins.sort().at(-1) ?? '';
}

/**
 * L'ordre des résultats : la pertinence du nom, puis les personnes en
 * fonction avant les anciens, puis les fonctions quittées le plus récemment,
 * puis l'ordre alphabétique.
 */
export function classerPersonnes(personnes: Personne[], terme: string): Array<Personne & { pertinence: number }> {
  return personnes
    .map((p) => ({ ...p, pertinence: pertinenceDuNom(p, terme) }))
    .sort(
      (a, b) =>
        b.pertinence - a.pertinence ||
        Number(b.enFonction) - Number(a.enFonction) ||
        (finDeFonction(b) ?? '').localeCompare(finDeFonction(a) ?? '') ||
        a.nom.localeCompare(b.nom, 'fr') ||
        a.prenom.localeCompare(b.prenom, 'fr') ||
        a.cle.localeCompare(b.cle),
    );
}

/** Les personnes, fiches et membres réunis, depuis les conditions de recherche des deux tables. */
async function reunir(
  fastify: FastifyInstance,
  service: GouvernementsService,
  ouParlementaire: Prisma.ParlementaireWhereInput,
  ouMembre: Prisma.MembreGouvernementWhereInput,
): Promise<Personne[]> {
  const fiches = await fastify.prisma.parlementaire.findMany({ where: ouParlementaire, select: parlementaireSelect });
  // Les membres trouvés par leur nom, et ceux des fiches trouvées autrement
  // (circonscription, département) : une fiche garde son passage au Gouvernement.
  const membres = await service.rechercherMembres({
    OR: [ouMembre, ...(fiches.length > 0 ? [{ parlementaireId: { in: fiches.map((f) => f.id) } }] : [])],
  });
  const parSlug = new Map(fiches.map((f) => [f.slug, personneDeFiche(f)]));
  const sansFiche: Personne[] = [];
  for (const m of membres) {
    const slug = m.parlementaire?.slug;
    if (slug && parSlug.has(slug)) parSlug.set(slug, avecGouvernement(parSlug.get(slug), m));
    else sansFiche.push(avecGouvernement(undefined, m));
  }
  return [...parSlug.values(), ...sansFiche];
}

export interface ResultatPersonnes {
  /** Classées, toutes (la pagination se fait à l'appel). */
  personnes: Array<Personne & { pertinence: number }>;
  /** Vrai si rien ne correspondait exactement : ce sont des noms proches. */
  approximatif: boolean;
}

/**
 * Les personnes qui répondent à la recherche, exactes d'abord ; à défaut,
 * les noms les plus proches (Jaro-Winkler), signalés comme approximatifs.
 */
export async function rechercherPersonnes(fastify: FastifyInstance, terme: string): Promise<ResultatPersonnes> {
  const service = new GouvernementsService(fastify.prisma, fastify.redis);
  const exactes = await reunir(
    fastify,
    service,
    buildParlementaireSearchCondition(terme),
    buildMembreGouvernementSearchCondition(terme),
  );
  if (exactes.length > 0) return { personnes: classerPersonnes(exactes, terme), approximatif: false };

  const [fiches, membres] = await Promise.all([
    fastify.prisma.parlementaire.findMany({ select: { id: true, nom: true, prenom: true, slug: true } }),
    fastify.prisma.membreGouvernement.findMany({ select: { id: true, nom: true, prenom: true, slug: true } }),
  ]);
  const proches = (candidats: FuzzyCandidate[]) => fuzzySearchCandidates(terme, candidats, candidats.length).map((r) => r.id);
  const idsFiches = proches(fiches);
  const idsMembres = proches(membres);
  if (idsFiches.length === 0 && idsMembres.length === 0) return { personnes: [], approximatif: false };
  const approchees = await reunir(fastify, service, { id: { in: idsFiches } }, { id: { in: idsMembres } });
  // Ordre de similarité, pas de pertinence du nom (aucun nom ne correspond).
  const rangFiche = new Map(idsFiches.map((id, i) => [fiches.find((f) => f.id === id)!.slug, i]));
  const rangMembre = new Map(idsMembres.map((id, i) => [membres.find((m) => m.id === id)!.slug, i]));
  const rangDe = (p: Personne) =>
    Math.min(
      (p.parlementaire && rangFiche.get(p.parlementaire.slug)) ?? Infinity,
      (p.gouvernement && rangMembre.get(p.gouvernement.membreSlug)) ?? Infinity,
    );
  return {
    personnes: approchees.map((p) => ({ ...p, pertinence: 0 })).sort((a, b) => rangDe(a) - rangDe(b)),
    approximatif: true,
  };
}

/**
 * Le résultat qui répond à coup sûr à la recherche, mis en tête de la page :
 * la seule personne dont le nom (ou le nom complet) est exactement celui
 * cherché ; à défaut, ou si la recherche nomme un gouvernement, le seul
 * gouvernement de ce nom (« Borne » est d'abord Élisabeth Borne, « gouvernement
 * Borne » le gouvernement).
 */
export function meilleur(
  personnes: ResultatPersonnes,
  gouvernements: ReadonlyArray<{ nom: string; slug: string }>,
  terme: string,
  exact: boolean,
): { categorie: 'personnes' | 'gouvernements'; cle: string } | null {
  if (!exact) return null;
  const t = normaliser(terme);
  const nommeUnGouvernement = /^gouvernements? /.test(t);
  const nomGouvernement = t.replace(/^gouvernements? /, '');
  const gouvernementsExacts = gouvernements.filter((g) => normaliser(g.nom) === nomGouvernement || g.slug.replace(/-/g, ' ') === nomGouvernement);
  const gouvernement = gouvernementsExacts.length === 1 ? { categorie: 'gouvernements' as const, cle: gouvernementsExacts[0]!.slug } : null;
  if (nommeUnGouvernement) return gouvernement;
  const exactes = personnes.approximatif ? [] : personnes.personnes.filter((p) => p.pertinence >= 2);
  if (exactes.length === 1) return { categorie: 'personnes', cle: exactes[0]!.cle };
  return exactes.length === 0 ? gouvernement : null;
}

/** Compte par rôle, pour les sous-filtres. */
export function comptesParRole(personnes: readonly Personne[]): Record<RolePersonne, number> {
  const comptes = { deputes: 0, senateurs: 0, gouvernement: 0 };
  for (const p of personnes) for (const r of p.roles) comptes[r]++;
  return comptes;
}
