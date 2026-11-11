// =============================================================================
// Fonctions datées des sénateurs (ticket #118)
// =============================================================================
//
// Source : le dump de la base des sénateurs (`sources/senat/sens-client.ts`).
// Trois familles de fonctions, chacune écrite comme une ligne `mandats` par
// période, comme l'Assemblée publie les siennes :
//
// - Bureau du Sénat (`senbur`) : président, vice-présidents, questeurs,
//   secrétaires. Avant ce worker, le président du Sénat n'apparaissait nulle
//   part : Gérard Larcher n'avait qu'une ligne « Membre » de la « Présidence du
//   Sénat », datée du jour où l'enrichissement l'avait vue.
// - Commissions permanentes et commission des affaires européennes (`memcom`
//   + `fonmemcom`). Elles venaient de l'annuaire du jour (`senateurs.json`),
//   sans date ni fonction : un début calé sur la mandature, une fin reconstituée
//   à l'observation, la qualité scrapée sur les pages « bureau » de chaque
//   commission. Comparé le 31/10/2026 sur les 388 appartenances en cours : mêmes
//   membres, mêmes fonctions. Le dump donne en plus les vraies dates et tout
//   l'historique.
// - Fonctions dans les groupes politiques (`memgrppol` + `fonmemgrppol`) :
//   président, vice-président, délégué. La simple appartenance est déjà sur
//   chaque mandat de sénateur (`mandats_parlementaires.groupe_id`).
//
// Ce worker est le seul à écrire ces lignes : il crée, modifie et supprime par
// différence sur la clé `source_uid`, sans toucher aux mandats d'organe de
// l'Assemblée d'un sénateur ancien député.
//
// Il écrit aussi les présidences du Sénat dans `presidences_chambre` (lignes
// `chambre = 'senat'`, les seules qu'il touche), y compris celles des présidents
// sans fiche (Monnerville, Poher, Monory) : la table vaut pour les deux
// chambres, l'Assemblée y est écrite par sync-gouvernements. Même `uid` que la
// ligne du bureau dans `mandats` (`SENBUR-<senburid>`).

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { differencier, tranches } from '../utils/synchro-differentielle';
import { telechargerTablesSens, type LigneDump } from '../sources/senat/sens-client';

const prisma = new PrismaClient();

export const TABLES_SENS = [
  'sen', 'bur', 'senbur',
  'com', 'libcom', 'foncom', 'memcom', 'fonmemcom',
  'libgrppol', 'fongrppol', 'memgrppol', 'fonmemgrppol',
] as const;

export type TablesSens = Map<string, LigneDump[]>;

/** Préfixes de `source_uid` : un par table source, pour que la clé reste unique. */
export const PREFIXE_BUREAU = 'SENBUR-';
export const PREFIXE_COMMISSION = 'SENCOM-';
export const PREFIXE_GROUPE = 'SENGRP-';

/** Code du président du Sénat dans la nomenclature du bureau (`bur.burcod`). */
export const BUREAU_PRESIDENT = 'PDTSEN';

/**
 * Présidences du Sénat attendues au minimum : 10 mandats de 1959 à octobre 2026
 * (Monnerville, Poher, Monory, Poncelet ×2, Larcher ×4, Bel). En dessous, ou
 * sans exactement une présidence en cours, le dump est tenu pour faux et les
 * présidences ne sont pas réécrites.
 */
const PRESIDENCES_SENAT_MIN = 10;

/** `organe_ref` du bureau du Sénat (aucun code d'organe dans le dump). */
export const ORGANE_BUREAU_SENAT = 'SENAT-BUREAU';

/** Types d'organe `com.typorgcod` retenus : commissions permanentes et affaires européennes. */
const TYPES_COMMISSION: Record<string, string> = { COM: 'COM-', COMEUR: 'COMEUR-' };

/**
 * Seuils sous lesquels le dump est tenu pour tronqué : on n'écrit rien plutôt
 * que de supprimer des fonctions qui existent. Mesure du 31/10/2026 : 26
 * membres du bureau en cours, 389 appartenances de commission en cours.
 */
const BUREAU_EN_COURS_MIN = 20;
const COMMISSIONS_EN_COURS_MIN = 300;

export interface SenateurConnu {
  id: string;
  sexe: string | null;
}

export interface CommissionConnue {
  id: string;
  nom: string;
}

export interface MandatVoulu {
  sourceUid: string;
  parlementaireId: string;
  typeOrgane: string;
  institution: string;
  qualite: string;
  dateDebut: Date;
  dateFin: Date | null;
  organeRef: string;
  commissionId: string | null;
}

/** `2026-10-01 00:00:00` → minuit UTC de ce jour. */
export function dateDump(valeur: string | null | undefined): Date | null {
  const m = valeur?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function texte(valeur: string | null | undefined): string {
  return (valeur ?? '').trim();
}

function majuscule(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Libellé au féminin pour une sénatrice, quand la nomenclature le donne. */
function libelleGenre(masculin: string | null, feminin: string | null, sexe: string | null): string {
  const m = texte(masculin);
  const f = texte(feminin);
  return sexe === 'F' && f ? f : m;
}

/** Libellé d'un organe en vigueur à une date (les libellés sont historisés). */
function libelleALaDate(
  libelles: LigneDump[] | undefined,
  date: Date,
  colDebut: string,
  colFin: string,
  colLibelle: string,
): string | null {
  if (!libelles?.length) return null;
  const t = date.getTime();
  const enVigueur = libelles.find((l) => {
    const debut = dateDump(l[colDebut]);
    const fin = dateDump(l[colFin]);
    return (!debut || debut.getTime() <= t) && (!fin || t <= fin.getTime());
  });
  // À défaut (date antérieure au premier libellé), le plus récent.
  const choisi = enVigueur ?? [...libelles].sort((a, b) => texte(b[colDebut]).localeCompare(texte(a[colDebut])))[0];
  return texte(choisi?.[colLibelle]) || null;
}

function grouperPar(lignes: LigneDump[] | undefined, colonne: string): Map<string, LigneDump[]> {
  const parCle = new Map<string, LigneDump[]>();
  for (const l of lignes ?? []) {
    const cle = l[colonne];
    if (!cle) continue;
    const liste = parCle.get(cle);
    if (liste) liste.push(l);
    else parCle.set(cle, [l]);
  }
  return parCle;
}

function indexPar(lignes: LigneDump[] | undefined, colonne: string): Map<string, LigneDump> {
  const parCle = new Map<string, LigneDump>();
  for (const l of lignes ?? []) if (l[colonne]) parCle.set(l[colonne]!, l);
  return parCle;
}

/**
 * Période d'une fonction ramenée à celle de l'appartenance qui la porte : une
 * fonction ne commence pas avant l'entrée dans l'organe ni ne dure après.
 */
type Champ = string | null | undefined;

function periode(debutFonction: Champ, finFonction: Champ, debutAppartenance: Champ, finAppartenance: Champ): { dateDebut: Date; dateFin: Date | null } | null {
  const dF = dateDump(debutFonction);
  const dA = dateDump(debutAppartenance);
  const dateDebut = dF && dA ? (dF > dA ? dF : dA) : dF ?? dA;
  if (!dateDebut) return null;
  const fF = dateDump(finFonction);
  const fA = dateDump(finAppartenance);
  const dateFin = fF && fA ? (fF < fA ? fF : fA) : fF ?? fA;
  if (dateFin && dateFin < dateDebut) return null;
  return { dateDebut, dateFin };
}

/**
 * Les fonctions à écrire, pour les seuls sénateurs déjà en base (clé : le
 * matricule en majuscules, `parlementaires.source_id`).
 */
export function fonctionsVoulues(
  tables: TablesSens,
  senateurs: Map<string, SenateurConnu>,
  commissions: Map<string, CommissionConnue>,
): MandatVoulu[] {
  const voulues: MandatVoulu[] = [];

  // --- Bureau du Sénat --------------------------------------------------------
  const bur = indexPar(tables.get('bur'), 'burcod');
  for (const l of tables.get('senbur') ?? []) {
    const code = texte(l.burcod);
    if (!code || code === 'AUCUNSEN') continue;
    const senateur = senateurs.get(texte(l.senmat).toUpperCase());
    const p = periode(l.senburdatdeb, l.senburdatfin, null, null);
    if (!senateur || !p || !l.senburid) continue;
    const nomenclature = bur.get(code);
    voulues.push({
      sourceUid: `${PREFIXE_BUREAU}${l.senburid}`,
      parlementaireId: senateur.id,
      typeOrgane: 'BUREAU',
      institution: 'Bureau du Sénat',
      qualite: libelleGenre(nomenclature?.burlib ?? code, nomenclature?.burlibfem ?? null, senateur.sexe) || code,
      ...p,
      organeRef: ORGANE_BUREAU_SENAT,
      commissionId: null,
    });
  }

  // --- Commissions ------------------------------------------------------------
  const typeOrgane = new Map<string, string>();
  for (const c of tables.get('com') ?? []) if (c.orgcod && c.typorgcod) typeOrgane.set(c.orgcod, c.typorgcod);
  const libellesCommission = grouperPar(tables.get('libcom'), 'orgcod');
  const foncom = indexPar(tables.get('foncom'), 'foncomcod');
  const appartenances = indexPar(tables.get('memcom'), 'memcomid');

  for (const f of tables.get('fonmemcom') ?? []) {
    const a = f.memcomid ? appartenances.get(f.memcomid) : undefined;
    // `NEANT` : pseudo-commission « Aucune (Président du Sénat) ».
    if (!a?.orgcod || a.orgcod === 'NEANT' || !f.fonmemcomid) continue;
    const prefixe = TYPES_COMMISSION[typeOrgane.get(a.orgcod) ?? ''];
    if (!prefixe) continue;
    const senateur = senateurs.get(texte(a.senmat).toUpperCase());
    const p = periode(f.fonmemcomdatdeb, f.fonmemcomdatfin, a.memcomdatdeb, a.memcomdatfin);
    if (!senateur || !p) continue;

    const organeRef = `${prefixe}${a.orgcod}`;
    const commission = commissions.get(organeRef);
    const nomenclature = foncom.get(texte(f.foncomcod));
    const qualite =
      libelleGenre(nomenclature?.foncomlib ?? null, nomenclature?.foncomlibfem ?? null, senateur.sexe) ||
      libelleGenre(nomenclature?.foncomlic ?? null, nomenclature?.foncomlicfem ?? null, senateur.sexe) ||
      'Membre';
    voulues.push({
      sourceUid: `${PREFIXE_COMMISSION}${f.fonmemcomid}`,
      parlementaireId: senateur.id,
      typeOrgane: 'COMMISSION',
      institution:
        commission?.nom ??
        majuscule(libelleALaDate(libellesCommission.get(a.orgcod), p.dateDebut, 'libcomdatdeb', 'libcomdatfin', 'libcomlilmin') ?? organeRef),
      qualite,
      ...p,
      organeRef,
      commissionId: commission?.id ?? null,
    });
  }

  // --- Fonctions de groupe ----------------------------------------------------
  const libellesGroupe = grouperPar(tables.get('libgrppol'), 'grppolcod');
  const fongrppol = indexPar(tables.get('fongrppol'), 'fongrppolcod');
  const membresGroupe = indexPar(tables.get('memgrppol'), 'memgrppolid');

  for (const f of tables.get('fonmemgrppol') ?? []) {
    const code = texte(f.fongrppolcod);
    if (!code || code === 'MEMBREPOL' || !f.fonmemgrppolid) continue;
    const a = f.memgrppolid ? membresGroupe.get(f.memgrppolid) : undefined;
    if (!a?.grppolcod) continue;
    const senateur = senateurs.get(texte(a.senmat).toUpperCase());
    const p = periode(f.fonmemgrppoldatdeb, f.fonmemgrppoldatfin, a.memgrppoldatdeb, a.memgrppoldatfin);
    if (!senateur || !p) continue;
    const nomenclature = fongrppol.get(code);
    voulues.push({
      sourceUid: `${PREFIXE_GROUPE}${f.fonmemgrppolid}`,
      parlementaireId: senateur.id,
      typeOrgane: 'GP',
      institution:
        libelleALaDate(libellesGroupe.get(a.grppolcod), p.dateDebut, 'libgrppoldatdeb', 'libgrppoldatfin', 'evelib') ??
        `Groupe ${a.grppolcod}`,
      qualite: libelleGenre(nomenclature?.fongrppollib ?? code, nomenclature?.fongrppollibfem ?? null, senateur.sexe) || code,
      ...p,
      organeRef: `GRP-${a.grppolcod}`,
      commissionId: null,
    });
  }

  return voulues;
}

export type LiaisonSenat = 'source_id' | 'identifiant';

export interface PresidenceSenatVoulue {
  uid: string;
  chambre: 'senat';
  sourceId: string;
  prenom: string;
  nom: string;
  dateDebut: Date;
  dateFin: Date | null;
  parlementaireId: string | null;
  liaison: LiaisonSenat | null;
}

/**
 * Les présidences du Sénat (`senbur`, code `PDTSEN`), une par mandat de
 * président, que le président ait une fiche ou non. Le nom vient de `sen` ;
 * la fiche, du matricule (`parlementaires.source_id`, à défaut un identifiant
 * Sénat conservé d'un ancien sénateur devenu député).
 */
export function presidencesSenatVoulues(
  tables: TablesSens,
  fiches: ReadonlyMap<string, { id: string; liaison: LiaisonSenat }>,
): PresidenceSenatVoulue[] {
  const senateurs = indexPar(tables.get('sen'), 'senmat');
  const voulues: PresidenceSenatVoulue[] = [];
  for (const l of tables.get('senbur') ?? []) {
    if (texte(l.burcod) !== BUREAU_PRESIDENT || !l.senburid) continue;
    const matricule = texte(l.senmat).toUpperCase();
    const p = periode(l.senburdatdeb, l.senburdatfin, null, null);
    const sen = senateurs.get(texte(l.senmat));
    if (!matricule || !p || !sen) continue;
    const fiche = fiches.get(matricule);
    voulues.push({
      uid: `${PREFIXE_BUREAU}${l.senburid}`,
      chambre: 'senat',
      sourceId: matricule,
      prenom: texte(sen.senprenomuse),
      nom: texte(sen.sennomuse),
      ...p,
      parlementaireId: fiche?.id ?? null,
      liaison: fiche?.liaison ?? null,
    });
  }
  return voulues.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime() || a.uid.localeCompare(b.uid));
}

/** Les présidences lues paraissent-elles complètes ? */
export function presidencesSenatPlausibles(voulues: readonly PresidenceSenatVoulue[]): boolean {
  return voulues.length >= PRESIDENCES_SENAT_MIN && voulues.filter((v) => !v.dateFin).length === 1;
}

/**
 * Écart toléré entre les appartenances de commission en cours du dump et celles
 * de l'annuaire du jour (`senateurs.json`, relu chaque nuit par
 * `senat:senateurs` et gardé dans `parlementaires.source_data`).
 *
 * L'annuaire reste le contrôle : si le dump cessait d'être mis à jour (comme le
 * CSV ODSEN des mandats, figé avant 2023), les pages commission ne doivent pas
 * se figer en silence. Au-delà du seuil, on garde les commissions en base telles
 * quelles et `check-quality` le signale (`senat_commissions_contre_annuaire`).
 * Le 31/10/2026 : 0 écart sur 388. Au renouvellement d'octobre 2026, le Sénat
 * saisissait chaque changement le jour même ; les deux sources peuvent se
 * décaler d'une nuit, d'où une tolérance plutôt que zéro.
 */
export const ECART_ANNUAIRE_MAX = 10;

export interface AppartenanceCourante {
  parlementaireId: string;
  organeRef: string;
}

/** Appartenances présentes d'un côté seulement (différence symétrique). */
export function ecartAvecAnnuaire(dump: AppartenanceCourante[], annuaire: AppartenanceCourante[]): number {
  const cle = (a: AppartenanceCourante) => `${a.parlementaireId}|${a.organeRef}`;
  const d = new Set(dump.map(cle));
  const a = new Set(annuaire.map(cle));
  let ecart = 0;
  for (const k of d) if (!a.has(k)) ecart++;
  for (const k of a) if (!d.has(k)) ecart++;
  return ecart;
}

/** Le dump paraît-il complet ? Sinon on n'écrit rien (cf. seuils plus haut). */
export function dumpPlausible(voulues: MandatVoulu[]): { ok: boolean; bureau: number; commissions: number } {
  const bureau = voulues.filter((v) => v.typeOrgane === 'BUREAU' && !v.dateFin).length;
  const commissions = voulues.filter((v) => v.typeOrgane === 'COMMISSION' && !v.dateFin).length;
  return { ok: bureau >= BUREAU_EN_COURS_MIN && commissions >= COMMISSIONS_EN_COURS_MIN, bureau, commissions };
}

const CHAMPS = [
  'parlementaireId', 'typeOrgane', 'institution', 'qualite', 'dateDebut', 'dateFin', 'organeRef', 'commissionId',
] as const;

const CHAMPS_PRESIDENCE = ['chambre', 'sourceId', 'prenom', 'nom', 'dateDebut', 'dateFin', 'parlementaireId', 'liaison'] as const;

export interface SenatFonctionsResult {
  crees: number;
  modifies: number;
  supprimes: number;
  inchanges: number;
  /** Lignes des anciennes sources (annuaire, enrichissement) remplacées. */
  remplaces: number;
  /** Appartenances en cours présentes d'un seul côté, dump ou annuaire. */
  ecartAnnuaire: number;
  /** Écart au-delà du seuil : commissions laissées telles quelles. */
  commissionsGelees: boolean;
  /** Présidences du Sénat dans `presidences_chambre` ; `null` si le dump les a fait écarter. */
  presidences: { crees: number; modifies: number; supprimes: number } | null;
}

/** Appartenances de commission en cours selon l'annuaire du jour. */
const ANNUAIRE_SQL = `
  SELECT p.id AS "parlementaireId", o->>'code' AS "organeRef"
  FROM parlementaires p, jsonb_array_elements(p.source_data->'organismes') o
  WHERE p.chambre = 'senat' AND p.actif
    AND o->>'type' = 'COMMISSION' AND o->>'code' ~ '^(COM|COMEUR)-'`;

/**
 * Lignes que ce worker remplace, écrites par les chemins retirés :
 * - commissions de l'annuaire (`sync.ts`), sans `source_uid` ;
 * - lignes de l'enrichissement (`senat-<code>`), sans matricule dans la clé,
 *   donc partagées entre sénateurs (22 lignes mal attribuées en août 2026).
 */
const ANCIENNES_LIGNES_SQL = `
  SELECT m.id FROM mandats m
  JOIN parlementaires p ON p.id = m.parlementaire_id
  WHERE (m.source_uid IS NULL AND m.type_organe = 'COMMISSION'
         AND (m.organe_ref LIKE 'COM-%' OR m.organe_ref LIKE 'COMEUR-%'))
     OR m.source_uid LIKE 'senat-%'`;

export async function syncSenatFonctions(options: { archive?: string } = {}): Promise<SenatFonctionsResult> {
  const dump = await telechargerTablesSens(TABLES_SENS, options);

  const parlementaires = await prisma.parlementaire.findMany({
    where: { chambre: 'senat', sourceId: { not: null } },
    select: { id: true, sourceId: true, sexe: true },
  });
  const senateurs = new Map<string, SenateurConnu>();
  const fichesPresidents = new Map<string, { id: string; liaison: LiaisonSenat }>();
  for (const p of parlementaires) {
    senateurs.set(p.sourceId!.toUpperCase(), { id: p.id, sexe: p.sexe });
    fichesPresidents.set(p.sourceId!.toUpperCase(), { id: p.id, liaison: 'source_id' });
  }
  // Ancien sénateur devenu député : son matricule est rangé dans les identifiants.
  const conserves = await prisma.parlementaireIdentifiant.findMany({
    where: { chambre: 'senat' },
    select: { sourceId: true, personne: { select: { id: true, sexe: true } } },
  });
  for (const c of conserves) {
    const cle = c.sourceId.toUpperCase();
    if (!senateurs.has(cle)) senateurs.set(cle, { id: c.personne.id, sexe: c.personne.sexe });
    if (!fichesPresidents.has(cle)) fichesPresidents.set(cle, { id: c.personne.id, liaison: 'identifiant' });
  }

  const commissionsSenat = await prisma.commission.findMany({
    where: { chambre: 'senat', organeRef: { not: null } },
    select: { id: true, nom: true, organeRef: true },
  });
  const commissions = new Map<string, CommissionConnue>();
  for (const c of commissionsSenat) commissions.set(c.organeRef!, { id: c.id, nom: c.nom });

  const toutes = fonctionsVoulues(dump, senateurs, commissions);
  const plausible = dumpPlausible(toutes);
  if (!plausible.ok) {
    throw new Error(
      `Dump export_sens incomplet (bureau en cours : ${plausible.bureau}, commissions en cours : ${plausible.commissions}) : rien n'est écrit`,
    );
  }

  const annuaire = await prisma.$queryRawUnsafe<AppartenanceCourante[]>(ANNUAIRE_SQL);
  const ecartAnnuaire = ecartAvecAnnuaire(
    toutes.filter((v) => v.typeOrgane === 'COMMISSION' && !v.dateFin),
    annuaire,
  );
  const commissionsGelees = ecartAnnuaire > ECART_ANNUAIRE_MAX;
  if (commissionsGelees) {
    logger.error(
      { ecartAnnuaire, seuil: ECART_ANNUAIRE_MAX },
      "Commissions du Sénat : le dump export_sens et l'annuaire divergent, commissions laissées telles quelles",
    );
  }

  // Commissions gelées : ni les lignes du dump ni celles des anciennes sources ne
  // bougent ; le bureau et les groupes, eux, s'écrivent normalement.
  const voulues = commissionsGelees ? toutes.filter((v) => v.typeOrgane !== 'COMMISSION') : toutes;
  const prefixes = commissionsGelees
    ? [PREFIXE_BUREAU, PREFIXE_GROUPE]
    : [PREFIXE_BUREAU, PREFIXE_COMMISSION, PREFIXE_GROUPE];

  const existants = await prisma.mandat.findMany({
    where: { OR: prefixes.map((p) => ({ sourceUid: { startsWith: p } })) },
    select: {
      id: true, sourceUid: true, parlementaireId: true, typeOrgane: true, institution: true, qualite: true,
      dateDebut: true, dateFin: true, organeRef: true, commissionId: true,
    },
  });
  const diff = differencier(existants, voulues, { existant: (e) => e.sourceUid!, voulu: (v) => v.sourceUid }, CHAMPS);

  const anciennes = commissionsGelees ? [] : await prisma.$queryRawUnsafe<{ id: string }[]>(ANCIENNES_LIGNES_SQL);

  const presidencesVoulues = presidencesSenatVoulues(dump, fichesPresidents);
  const presidencesOk = presidencesSenatPlausibles(presidencesVoulues);
  if (!presidencesOk) {
    logger.error(
      { presidences: presidencesVoulues.length, enCours: presidencesVoulues.filter((v) => !v.dateFin).length },
      'Présidences du Sénat : dump incomplet, presidences_chambre laissée telle quelle',
    );
  }
  const presidencesExistantes = presidencesOk
    ? await prisma.presidenceChambre.findMany({
        where: { chambre: 'senat' },
        select: {
          id: true, uid: true, chambre: true, sourceId: true, prenom: true, nom: true,
          dateDebut: true, dateFin: true, parlementaireId: true, liaison: true,
        },
      })
    : [];
  const diffPresidences = presidencesOk
    ? differencier(presidencesExistantes, presidencesVoulues, { existant: (e) => e.uid, voulu: (v) => v.uid }, CHAMPS_PRESIDENCE)
    : null;

  // Une seule transaction : une panne entre la création des nouvelles lignes et
  // la suppression des anciennes doublerait les membres des pages commission.
  const aSupprimer = [...diff.aSupprimer.map((e) => e.id), ...anciennes.map((a) => a.id)];
  await prisma.$transaction(
    async (tx) => {
      for (const lot of tranches(diff.aCreer, 500)) {
        await tx.mandat.createMany({ data: lot });
      }
      for (const { existant, voulu } of diff.aModifier) {
        const { sourceUid: _cle, ...champs } = voulu;
        await tx.mandat.update({ where: { id: existant.id }, data: champs });
      }
      for (const lot of tranches(aSupprimer, 500)) {
        await tx.mandat.deleteMany({ where: { id: { in: lot } } });
      }
      if (diffPresidences) {
        if (diffPresidences.aSupprimer.length > 0) {
          await tx.presidenceChambre.deleteMany({ where: { id: { in: diffPresidences.aSupprimer.map((p) => p.id) } } });
        }
        for (const { existant, voulu } of diffPresidences.aModifier) {
          const { uid: _cle, ...champs } = voulu;
          await tx.presidenceChambre.update({ where: { id: existant.id }, data: champs });
        }
        if (diffPresidences.aCreer.length > 0) await tx.presidenceChambre.createMany({ data: diffPresidences.aCreer });
      }
    },
    { timeout: 300_000, maxWait: 30_000 },
  );

  const resultat: SenatFonctionsResult = {
    crees: diff.aCreer.length,
    modifies: diff.aModifier.length,
    supprimes: diff.aSupprimer.length,
    inchanges: diff.inchanges,
    remplaces: anciennes.length,
    ecartAnnuaire,
    commissionsGelees,
    presidences: diffPresidences
      ? { crees: diffPresidences.aCreer.length, modifies: diffPresidences.aModifier.length, supprimes: diffPresidences.aSupprimer.length }
      : null,
  };
  logger.info({ ...resultat, bureauEnCours: plausible.bureau, commissionsEnCours: plausible.commissions }, 'Fonctions des sénateurs synchronisées');
  return resultat;
}
