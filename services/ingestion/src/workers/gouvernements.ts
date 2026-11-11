// =============================================================================
// Worker — Gouvernements, postes ministériels et présidences (AMO30)
// =============================================================================
//
// Lit l'archive AMO30 (partagée avec les commissions, un seul téléchargement),
// la valide, puis aligne les quatre tables par différence : une ligne
// inchangée n'est pas réécrite (son `updated_at` reste un vrai signal), une
// ligne absente de l'archive est supprimée. Le périmètre est l'archive
// entière : rien n'est effacé hors de ce qu'elle couvre.
//
// Rattache chaque membre (et chaque président) à sa fiche parlementaire,
// recalculé à chaque passage (SPEC-GOUVERNEMENT.md, §4) :
//   1. `parlementaires.source_id` = son PA ;
//   2. `parlementaires_identifiants` (Assemblée) = son PA ;
//   3. pour qui l'AMO30 donne un mandat SENAT, même nom, prénom et date de
//      naissance, avec un seul candidat de chaque côté. Un sénateur a une fiche
//      indexée par son matricule Sénat, que rien ne relie à son PA.
//
// Les présidences de l'Assemblée suivent la même règle de différence et
// s'écrivent avec les gouvernements, dans `presidences_chambre` (lignes
// `chambre = 'assemblee'`, les seules que ce worker touche) ; elles se
// rattachent par PA seulement. Celles du Sénat, même table, sont écrites par
// senat-fonctions.
//
// Ne touche pas à la table `mandats`.
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
import { repertoireAMO30 } from '../sources/assemblee-nationale/amo30-archive';
import {
  anomaliesBloquantes,
  lireArchiveGouvernements,
  normaliserNom,
  type DonneesGouvernements,
  type GouvernementSource,
  type MembreSource,
  type PosteSource,
  type PresidenceAssembleeSource,
} from '../sources/assemblee-nationale/gouvernements-client';
import { domaineDuPortefeuille } from '../sources/assemblee-nationale/domaines-ministeriels';
import { differencier } from '../utils/synchro-differentielle';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export type Liaison = 'source_id' | 'identifiant' | 'etat_civil';

export interface FicheCandidate {
  id: string;
  sourceId: string | null;
  nom: string;
  prenom: string;
  dateNaissance: string | null; // YYYY-MM-DD
}

export interface Compteurs {
  crees: number;
  modifies: number;
  supprimes: number;
}

export interface RapportGouvernements {
  gouvernements: Compteurs;
  membres: Compteurs;
  postes: Compteurs;
  presidences: Compteurs;
  presidencesAssemblee: Compteurs;
  liaisons: Record<Liaison | 'sans_fiche', number>;
  ambiguites: string[];
}

// =============================================================================
// Calculs purs
// =============================================================================

function slugifier(s: string): string {
  return normaliserNom(s).replace(/ /g, '-');
}

const ROMAINS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

/** « LECORNU II » → lecornu-2, « VALLS 2 » → valls-2, « VALLS » → valls. */
export function slugGouvernement(libelleSource: string): string {
  const mots = normaliserNom(libelleSource).split(' ');
  return mots.map((m, i) => (i > 0 && ROMAINS[m] ? String(ROMAINS[m]) : m)).join('-');
}

/**
 * Le rang de chaque gouvernement parmi ceux du même Premier ministre (Valls I,
 * Valls II), dans l'ordre des dates. Le Premier ministre est le titulaire du
 * poste de rang 1 ouvert le premier jour du gouvernement, à défaut le premier.
 */
export function numerosGouvernements(
  gouvernements: readonly GouvernementSource[],
  postes: readonly PosteSource[],
): Map<string, number> {
  const premierMinistre = new Map<string, string>();
  for (const g of gouvernements) {
    const rangUn = postes
      .filter((p) => p.gouvernementUid === g.uid && p.rangProtocolaire === 1)
      .sort((a, b) => Number(b.dateDebut === g.dateDebut) - Number(a.dateDebut === g.dateDebut) || a.dateDebut.localeCompare(b.dateDebut));
    premierMinistre.set(g.uid, rangUn[0]?.acteurUid ?? `sans-pm:${g.uid}`);
  }
  const dejaVus = new Map<string, number>();
  const numeros = new Map<string, number>();
  for (const g of [...gouvernements].sort((a, b) => a.dateDebut.localeCompare(b.dateDebut) || a.uid.localeCompare(b.uid))) {
    const pm = premierMinistre.get(g.uid)!;
    const n = (dejaVus.get(pm) ?? 0) + 1;
    dejaVus.set(pm, n);
    numeros.set(g.uid, n);
  }
  return numeros;
}

/**
 * Le slug d'une nouvelle ligne : le slug de base s'il est libre, sinon suffixé.
 * Les lignes existantes gardent le leur (URL publique, jamais réécrite).
 */
export function slugLibre(base: string, suffixes: readonly string[], pris: Set<string>): string {
  for (const candidat of [base, ...suffixes.map((s) => `${base}-${s}`)]) {
    if (!pris.has(candidat)) {
      pris.add(candidat);
      return candidat;
    }
  }
  throw new Error(`Aucun slug libre pour ${base}`);
}

/** Étapes 1 et 2 du rattachement : la fiche qui porte ce PA, s'il n'y en a qu'une. */
export function lienParPA(
  acteurUid: string,
  fiches: readonly FicheCandidate[],
  identifiantsAN: ReadonlyMap<string, string>,
): { parlementaireId: string; liaison: Liaison } | { ambigu: number } | null {
  const parPA = fiches.filter((f) => f.sourceId === acteurUid);
  if (parPA.length === 1) return { parlementaireId: parPA[0]!.id, liaison: 'source_id' };
  if (parPA.length > 1) return { ambigu: parPA.length };
  const parIdentifiant = identifiantsAN.get(acteurUid);
  return parIdentifiant ? { parlementaireId: parIdentifiant, liaison: 'identifiant' } : null;
}

/**
 * Rattache les membres à leur fiche (§4). Un lien qui désignerait la même
 * fiche pour deux personnes est retiré des deux côtés et signalé.
 */
export function lierFiches(
  membres: readonly MembreSource[],
  fiches: readonly FicheCandidate[],
  identifiantsAN: ReadonlyMap<string, string>,
): { liens: Map<string, { parlementaireId: string; liaison: Liaison }>; ambiguites: string[] } {
  const ambiguites: string[] = [];
  const liens = new Map<string, { parlementaireId: string; liaison: Liaison }>();

  const cleEtatCivil = (nom: string, prenom: string, naissance: string | null) =>
    naissance ? `${normaliserNom(nom)}|${normaliserNom(prenom)}|${naissance}` : null;
  const fichesParEtatCivil = new Map<string, string[]>();
  for (const f of fiches) {
    const k = cleEtatCivil(f.nom, f.prenom, f.dateNaissance);
    if (k) fichesParEtatCivil.set(k, [...(fichesParEtatCivil.get(k) ?? []), f.id]);
  }
  const membresParEtatCivil = new Map<string, number>();
  for (const m of membres) {
    const k = m.senateur ? cleEtatCivil(m.nom, m.prenom, m.dateNaissance) : null;
    if (k) membresParEtatCivil.set(k, (membresParEtatCivil.get(k) ?? 0) + 1);
  }

  for (const m of membres) {
    const parPA = lienParPA(m.acteurUid, fiches, identifiantsAN);
    if (parPA && 'ambigu' in parPA) {
      ambiguites.push(`${m.acteurUid} : ${parPA.ambigu} fiches portent ce PA`);
      continue;
    }
    if (parPA) {
      liens.set(m.acteurUid, parPA);
      continue;
    }
    const k = m.senateur ? cleEtatCivil(m.nom, m.prenom, m.dateNaissance) : null;
    if (!k) continue;
    const candidates = fichesParEtatCivil.get(k) ?? [];
    if (candidates.length === 1 && membresParEtatCivil.get(k) === 1) {
      liens.set(m.acteurUid, { parlementaireId: candidates[0]!, liaison: 'etat_civil' });
    } else if (candidates.length > 0) {
      ambiguites.push(`${m.acteurUid} (${m.prenom} ${m.nom}) : ${candidates.length} fiches, ${membresParEtatCivil.get(k)} membres au même état civil`);
    }
  }

  const parFiche = new Map<string, string[]>();
  for (const [acteur, l] of liens) parFiche.set(l.parlementaireId, [...(parFiche.get(l.parlementaireId) ?? []), acteur]);
  for (const [fiche, acteurs] of parFiche) {
    if (acteurs.length < 2) continue;
    ambiguites.push(`fiche ${fiche} désignée pour ${acteurs.join(', ')} : aucun lien`);
    for (const a of acteurs) liens.delete(a);
  }
  return { liens, ambiguites };
}

// =============================================================================
// Écriture
// =============================================================================

const jour = (s: string): Date => new Date(`${s}T00:00:00Z`);
const jourOuNull = (s: string | null): Date | null => (s ? jour(s) : null);

const CHAMPS_GOUVERNEMENT = ['libelleSource', 'numero', 'dateDebut', 'dateFin'] as const;
const CHAMPS_MEMBRE = ['civilite', 'prenom', 'nom', 'dateNaissance', 'parlementaireId', 'liaison'] as const;
const CHAMPS_POSTE = [
  'gouvernementId', 'membreId', 'organeUid', 'qualite', 'qualiteAccordee', 'rangProtocolaire', 'intitule',
  'intituleCourt', 'intituleComplement', 'domaine', 'dateDebut', 'dateFin', 'datePublication',
] as const;
const CHAMPS_PRESIDENCE = ['civilite', 'prenom', 'nom', 'dateDebut', 'dateFin', 'acteurUid', 'parlementaireId', 'liaison'] as const;
const CHAMPS_PRESIDENCE_CHAMBRE = ['chambre', 'sourceId', 'prenom', 'nom', 'dateDebut', 'dateFin', 'parlementaireId', 'liaison'] as const;

const selection = <C extends string>(champs: readonly C[]) =>
  Object.fromEntries(champs.map((c) => [c, true])) as Record<C, true>;

/** Une transaction : quelques centaines d'écritures au pire, sur une base distante. */
const DELAI_TRANSACTION = 120_000;

async function chargerFiches(): Promise<{ fiches: FicheCandidate[]; identifiantsAN: Map<string, string> }> {
  // `date_naissance` est un timestamp sans fuseau, écrit en UTC : lu tel quel,
  // sans conversion qui ferait dépendre le jour du fuseau de la session.
  const fiches = await prisma.$queryRaw<FicheCandidate[]>`
    SELECT id, source_id AS "sourceId", nom, prenom,
           to_char(date_naissance, 'YYYY-MM-DD') AS "dateNaissance"
    FROM parlementaires`;
  const identifiants = await prisma.parlementaireIdentifiant.findMany({
    where: { chambre: 'assemblee' },
    select: { sourceId: true, personneId: true },
  });
  return { fiches, identifiantsAN: new Map(identifiants.map((i) => [i.sourceId, i.personneId])) };
}

type Lien = { parlementaireId: string; liaison: Liaison } | null;

/**
 * Aligne les présidences de l'Assemblée (`presidences_chambre`, chambre
 * `assemblee`) sur l'archive, par différence. Les lignes du Sénat ne sont ni
 * lues ni touchées.
 */
async function ecrirePresidencesAssemblee(
  tx: Prisma.TransactionClient,
  sources: readonly PresidenceAssembleeSource[],
  lien: (acteurUid: string) => Lien,
): Promise<Compteurs> {
  const voulues = sources.map((p) => {
    const l = lien(p.acteurUid);
    return {
      uid: p.uid,
      chambre: 'assemblee',
      sourceId: p.acteurUid,
      prenom: p.prenom,
      nom: p.nom,
      dateDebut: jour(p.dateDebut),
      dateFin: jourOuNull(p.dateFin),
      parlementaireId: l?.parlementaireId ?? null,
      liaison: l?.liaison ?? null,
    };
  });
  const existantes = await tx.presidenceChambre.findMany({
    where: { chambre: 'assemblee' },
    select: { id: true, uid: true, ...selection(CHAMPS_PRESIDENCE_CHAMBRE) },
  });
  const d = differencier(existantes, voulues, { existant: (e) => e.uid, voulu: (v) => v.uid }, CHAMPS_PRESIDENCE_CHAMBRE);
  if (d.aSupprimer.length > 0) await tx.presidenceChambre.deleteMany({ where: { id: { in: d.aSupprimer.map((p) => p.id) } } });
  for (const { existant, voulu } of d.aModifier) {
    const { uid: _cle, ...valeurs } = voulu;
    await tx.presidenceChambre.update({ where: { id: existant.id }, data: valeurs });
  }
  if (d.aCreer.length > 0) await tx.presidenceChambre.createMany({ data: d.aCreer });
  return { crees: d.aCreer.length, modifies: d.aModifier.length, supprimes: d.aSupprimer.length };
}

export async function syncGouvernements(): Promise<RapportGouvernements> {
  const json = await repertoireAMO30();
  const donnees = await lireArchiveGouvernements(json);
  const erreurs = anomaliesBloquantes(donnees);
  if (erreurs.length > 0) {
    // Une archive tronquée ou un format changé ne doit rien toucher.
    throw new Error(`Archive AMO30 refusée (${erreurs.length} défauts) : ${erreurs.slice(0, 10).join(' ; ')}`);
  }
  logger.info(
    { gouvernements: donnees.gouvernements.length, membres: donnees.membres.length, postes: donnees.postes.length },
    'AMO30 : gouvernements lus et validés',
  );

  const { fiches, identifiantsAN } = await chargerFiches();
  const lienPresidentAssemblee = (acteurUid: string): Lien => {
    const l = lienParPA(acteurUid, fiches, identifiantsAN);
    return l && !('ambigu' in l) ? l : null;
  };
  const { liens, ambiguites } = lierFiches(donnees.membres, fiches, identifiantsAN);
  // Un président est rattaché comme membre s'il l'a été ; sinon par son PA seul
  // (étapes 1 et 2), la présidence ne portant pas d'état civil.
  const lienPresident = (acteurUid: string | null) => {
    if (!acteurUid) return null;
    const lien = liens.get(acteurUid) ?? lienParPA(acteurUid, fiches, identifiantsAN);
    return lien && !('ambigu' in lien) ? lien : null;
  };

  const rapport = await prisma.$transaction(
    async (tx) => {
      const r = await ecrire(tx, donnees, liens, lienPresident);
      r.presidencesAssemblee = await ecrirePresidencesAssemblee(tx, donnees.presidencesAssemblee, lienPresidentAssemblee);
      return r;
    },
    { timeout: DELAI_TRANSACTION, maxWait: 10_000 },
  );
  rapport.ambiguites = ambiguites;
  for (const l of liens.values()) rapport.liaisons[l.liaison]++;
  rapport.liaisons.sans_fiche = donnees.membres.length - liens.size;

  if (ambiguites.length > 0) logger.warn({ ambiguites }, 'Gouvernements : rattachements aux fiches écartés');
  logger.info(rapport, 'Gouvernements synchronisés');
  return rapport;
}

async function ecrire(
  tx: Prisma.TransactionClient,
  d: DonneesGouvernements,
  liens: Map<string, { parlementaireId: string; liaison: Liaison }>,
  lienPresident: (acteurUid: string | null) => { parlementaireId: string; liaison: Liaison } | null,
): Promise<RapportGouvernements> {
  const zero = (): Compteurs => ({ crees: 0, modifies: 0, supprimes: 0 });
  const rapport: RapportGouvernements = {
    gouvernements: zero(), membres: zero(), postes: zero(), presidences: zero(), presidencesAssemblee: zero(),
    liaisons: { source_id: 0, identifiant: 0, etat_civil: 0, sans_fiche: 0 },
    ambiguites: [],
  };

  // --- Lignes voulues -------------------------------------------------------
  const numeros = numerosGouvernements(d.gouvernements, d.postes);
  const gouvernementsVoulus = d.gouvernements.map((g) => ({
    uid: g.uid,
    libelleSource: g.libelleSource,
    numero: numeros.get(g.uid)!,
    dateDebut: jour(g.dateDebut),
    dateFin: jourOuNull(g.dateFin),
  }));
  const membresVoulus = d.membres.map((m) => ({
    acteurUid: m.acteurUid,
    civilite: m.civilite,
    prenom: m.prenom,
    nom: m.nom,
    dateNaissance: jourOuNull(m.dateNaissance),
    parlementaireId: liens.get(m.acteurUid)?.parlementaireId ?? null,
    liaison: liens.get(m.acteurUid)?.liaison ?? null,
  }));

  // --- Postes absents, puis membres absents ou dont la fiche change ----------
  const postesExistants = await tx.posteMinisteriel.findMany({ select: { id: true, uid: true, ...selection(CHAMPS_POSTE) } });
  const postesVoulusUids = new Set(d.postes.map((p) => p.uid));
  const postesAbsents = postesExistants.filter((p) => !postesVoulusUids.has(p.uid));
  if (postesAbsents.length > 0) {
    await tx.posteMinisteriel.deleteMany({ where: { id: { in: postesAbsents.map((p) => p.id) } } });
    rapport.postes.supprimes = postesAbsents.length;
  }

  const membresExistants = await tx.membreGouvernement.findMany({ select: { id: true, acteurUid: true, slug: true, ...selection(CHAMPS_MEMBRE) } });
  const dm = differencier(membresExistants, membresVoulus, { existant: (e) => e.acteurUid, voulu: (v) => v.acteurUid }, CHAMPS_MEMBRE);
  // `parlementaire_id` est unique : on libère d'abord les fiches qui changent de
  // main, sans quoi une permutation échouerait au milieu de la transaction.
  const liberes = [
    ...dm.aSupprimer.filter((e) => e.parlementaireId),
    ...dm.aModifier.filter(({ existant, voulu }) => existant.parlementaireId && existant.parlementaireId !== voulu.parlementaireId).map(({ existant }) => existant),
  ];
  if (liberes.length > 0) {
    await tx.membreGouvernement.updateMany({ where: { id: { in: liberes.map((e) => e.id) } }, data: { parlementaireId: null, liaison: null } });
  }
  if (dm.aSupprimer.length > 0) {
    await tx.membreGouvernement.deleteMany({ where: { id: { in: dm.aSupprimer.map((e) => e.id) } } });
    rapport.membres.supprimes = dm.aSupprimer.length;
  }

  // --- Gouvernements --------------------------------------------------------
  const gouvernementsExistants = await tx.gouvernement.findMany({ select: { id: true, uid: true, slug: true, ...selection(CHAMPS_GOUVERNEMENT) } });
  const dg = differencier(gouvernementsExistants, gouvernementsVoulus, { existant: (e) => e.uid, voulu: (v) => v.uid }, CHAMPS_GOUVERNEMENT);
  const slugsGouvernements = new Set(gouvernementsExistants.map((g) => g.slug));
  for (const { existant, voulu } of dg.aModifier) {
    const { uid: _cle, ...valeurs } = voulu;
    await tx.gouvernement.update({ where: { id: existant.id }, data: valeurs });
  }
  if (dg.aCreer.length > 0) {
    await tx.gouvernement.createMany({
      data: dg.aCreer.map((g) => ({ ...g, slug: slugLibre(slugGouvernement(g.libelleSource), [g.uid.toLowerCase()], slugsGouvernements) })),
    });
  }
  rapport.gouvernements.crees = dg.aCreer.length;
  rapport.gouvernements.modifies = dg.aModifier.length;

  // --- Membres --------------------------------------------------------------
  const slugsMembres = new Set(membresExistants.map((m) => m.slug));
  for (const { existant, voulu } of dm.aModifier) {
    const { acteurUid: _cle, ...valeurs } = voulu;
    await tx.membreGouvernement.update({ where: { id: existant.id }, data: valeurs });
  }
  if (dm.aCreer.length > 0) {
    await tx.membreGouvernement.createMany({
      data: dm.aCreer.map((m) => ({
        ...m,
        slug: slugLibre(
          slugifier(`${m.prenom} ${m.nom}`),
          [...(m.dateNaissance ? [String(m.dateNaissance.getUTCFullYear())] : []), m.acteurUid.toLowerCase()],
          slugsMembres,
        ),
      })),
    });
  }
  rapport.membres.crees = dm.aCreer.length;
  rapport.membres.modifies = dm.aModifier.length;

  // --- Postes ---------------------------------------------------------------
  const idGouvernement = new Map((await tx.gouvernement.findMany({ select: { id: true, uid: true } })).map((g) => [g.uid, g.id]));
  const idMembre = new Map((await tx.membreGouvernement.findMany({ select: { id: true, acteurUid: true } })).map((m) => [m.acteurUid, m.id]));
  const postesVoulus = d.postes.map((p) => ({
    uid: p.uid,
    gouvernementId: idGouvernement.get(p.gouvernementUid)!,
    membreId: idMembre.get(p.acteurUid)!,
    organeUid: p.organeUid,
    qualite: p.qualite,
    qualiteAccordee: p.qualiteAccordee,
    rangProtocolaire: p.rangProtocolaire,
    intitule: p.intitule,
    intituleCourt: p.intituleCourt,
    intituleComplement: p.intituleComplement,
    domaine: domaineDuPortefeuille(p.intituleCourt, p.intitule),
    dateDebut: jour(p.dateDebut),
    dateFin: jourOuNull(p.dateFin),
    datePublication: jourOuNull(p.datePublication),
  }));
  const postesRestants = postesExistants.filter((p) => postesVoulusUids.has(p.uid));
  const dp = differencier(postesRestants, postesVoulus, { existant: (e) => e.uid, voulu: (v) => v.uid }, CHAMPS_POSTE);
  for (const { existant, voulu } of dp.aModifier) {
    const { uid: _cle, ...valeurs } = voulu;
    await tx.posteMinisteriel.update({ where: { id: existant.id }, data: valeurs });
  }
  if (dp.aCreer.length > 0) await tx.posteMinisteriel.createMany({ data: dp.aCreer });
  rapport.postes.crees = dp.aCreer.length;
  rapport.postes.modifies = dp.aModifier.length;

  // Les postes sont alignés : un gouvernement absent de l'archive n'en a plus.
  if (dg.aSupprimer.length > 0) {
    await tx.gouvernement.deleteMany({ where: { id: { in: dg.aSupprimer.map((g) => g.id) } } });
    rapport.gouvernements.supprimes = dg.aSupprimer.length;
  }

  // --- Présidences ----------------------------------------------------------
  const presidencesVoulues = d.presidences.map((p) => {
    const lien = lienPresident(p.acteurUid);
    return {
      uid: p.uid,
      civilite: p.civilite,
      prenom: p.prenom,
      nom: p.nom,
      dateDebut: jour(p.dateDebut),
      dateFin: jourOuNull(p.dateFin),
      acteurUid: p.acteurUid,
      parlementaireId: lien?.parlementaireId ?? null,
      liaison: lien?.liaison ?? null,
    };
  });
  const presidencesExistantes = await tx.presidence.findMany({ select: { id: true, uid: true, ...selection(CHAMPS_PRESIDENCE) } });
  const dpr = differencier(presidencesExistantes, presidencesVoulues, { existant: (e) => e.uid, voulu: (v) => v.uid }, CHAMPS_PRESIDENCE);
  if (dpr.aSupprimer.length > 0) await tx.presidence.deleteMany({ where: { id: { in: dpr.aSupprimer.map((p) => p.id) } } });
  for (const { existant, voulu } of dpr.aModifier) {
    const { uid: _cle, ...valeurs } = voulu;
    await tx.presidence.update({ where: { id: existant.id }, data: valeurs });
  }
  if (dpr.aCreer.length > 0) await tx.presidence.createMany({ data: dpr.aCreer });
  rapport.presidences = { crees: dpr.aCreer.length, modifies: dpr.aModifier.length, supprimes: dpr.aSupprimer.length };

  return rapport;
}
