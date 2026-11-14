// =============================================================================
// Gouvernements, postes ministériels et présidences, lus dans l'archive AMO30
//
// - Gouvernement = organe GOUVERNEMENT ; portefeuille = organe MINISTERE dont
//   le parent est un gouvernement ; présidence = organe PRESREP.
// - Poste = mandat MINISTERE de type `MandatSimple_Type`. Les
//   `MandatMission_Type` (« en mission ») sont des missions confiées à des
//   parlementaires, pas des membres du gouvernement : écartés.
// - Les mandats GOUVERNEMENT (« membre ») ne sont PAS lus : la source en laisse
//   d'ouverts pour des personnes sorties du gouvernement (Bayrou). Les mandats
//   PRESREP ne servent qu'à trouver l'acteur, et seulement s'ils sont rattachés
//   à l'organe qui le nomme : la source en rattache un à l'organe d'un
//   prédécesseur (Hollande sur la présidence Sarkozy).
// - Les dates sont celles de la source, telles quelles (`YYYY-MM-DD`). Celles
//   d'un poste viennent du mandat, jamais du portefeuille (PO653320 n'en a pas).
// - Présidence de l'Assemblée = mandat BUREAU de qualité « Président » (le
//   président d'âge, qui n'ouvre que la séance d'installation, en est exclu).
//
// Voir SPEC-GOUVERNEMENT.md, §1 et §2.
// =============================================================================

import * as fs from 'fs';
import { fichiersAMO30 } from './amo30-archive';
import { isRecord } from '../../utils/json';

export interface GouvernementSource {
  uid: string;
  libelleSource: string;
  dateDebut: string;
  dateFin: string | null;
}

export interface MembreSource {
  acteurUid: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  dateNaissance: string | null;
  /** L'AMO30 lui donne un mandat SENAT : condition du rapprochement par état civil. */
  senateur: boolean;
}

export interface PosteSource {
  uid: string;
  gouvernementUid: string;
  acteurUid: string;
  organeUid: string;
  qualite: string;
  qualiteAccordee: string | null;
  rangProtocolaire: number;
  intitule: string;
  intituleCourt: string | null;
  intituleComplement: string | null;
  dateDebut: string;
  dateFin: string | null;
  datePublication: string | null;
}

export interface PresidenceSource {
  uid: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  dateDebut: string;
  dateFin: string | null;
  acteurUid: string | null;
}

/** Une présidence de l'Assemblée : un mandat au bureau. */
export interface PresidenceAssembleeSource {
  uid: string;
  acteurUid: string;
  prenom: string;
  nom: string;
  dateDebut: string;
  dateFin: string | null;
}

export interface DonneesGouvernements {
  gouvernements: GouvernementSource[];
  membres: MembreSource[];
  postes: PosteSource[];
  presidences: PresidenceSource[];
  presidencesAssemblee: PresidenceAssembleeSource[];
}

/** Planchers de l'archive du 21/10/2026 : en dessous, l'archive est tronquée. */
export const MINIMUMS = { gouvernements: 17, postes: 766, presidences: 3, presidencesAssemblee: 7 };

/** Le président de l'Assemblée ; « Président d'âge » est une autre qualité. */
function estPresidenceAssemblee(m: unknown): boolean {
  return champ(m, 'typeOrgane') === 'BUREAU' && champ(m, 'infosQualite', 'codeQualite') === 'Président';
}

// =============================================================================
// Lecture des valeurs de la source
// =============================================================================

/** Une valeur textuelle, ou null pour l'absence comme pour `{"@xsi:nil": "true"}`. */
function texte(v: unknown): string | null {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function date(v: unknown): string | null {
  const t = texte(v);
  return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/** Une valeur ou une liste de valeurs (la conversion XML → JSON de l'AN ne fait une liste qu'à partir de deux). */
function liste(v: unknown): unknown[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** La valeur au bout d'un chemin de clés, ou `undefined` dès qu'un maillon manque. */
function champ(v: unknown, ...chemin: string[]): unknown {
  let courant = v;
  for (const cle of chemin) {
    if (!isRecord(courant)) return undefined;
    courant = courant[cle];
  }
  return courant;
}

/** Casse, accents, tirets et espaces neutralisés : « Jean-Yves Le Drian » = « jean yves le drian ». */
export function normaliserNom(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// =============================================================================
// Construction
// =============================================================================

interface OrganeLu {
  uid: string;
  codeType: string;
  libelle: string;
  libelleAbrege: string | null;
  libelleEdition: string | null;
  parent: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

const TYPES_ORGANES = new Set(['GOUVERNEMENT', 'MINISTERE', 'PRESREP']);

function lireOrgane(brut: unknown): OrganeLu | null {
  const o = champ(brut, 'organe');
  const uid = texte(champ(o, 'uid'));
  const codeType = texte(champ(o, 'codeType'));
  if (!uid || !codeType || !TYPES_ORGANES.has(codeType)) return null;
  return {
    uid,
    codeType,
    libelle: texte(champ(o, 'libelle')) ?? '',
    libelleAbrege: texte(champ(o, 'libelleAbrege')),
    libelleEdition: texte(champ(o, 'libelleEdition')),
    parent: texte(champ(o, 'organeParent')),
    dateDebut: date(champ(o, 'viMoDe', 'dateDebut')),
    dateFin: date(champ(o, 'viMoDe', 'dateFin')),
  };
}

/** « Présidence de la République : M. Emmanuel Macron » → M. / Emmanuel / Macron. */
export function personneDuLibellePresidence(libelle: string): { civilite: string | null; prenom: string; nom: string } | null {
  const m = /:\s*(M\.|Mme)?\s*(\S+)\s+(.+)$/.exec(libelle);
  if (!m) return null;
  return { civilite: m[1] ?? null, prenom: m[2]!, nom: m[3]!.trim() };
}

/**
 * Construit gouvernements, membres, postes et présidences à partir des JSON
 * bruts de l'archive (`{ organe }` et `{ acteur }`). Pur : ni fichier ni base.
 */
export function construireDonnees(organesBruts: unknown[], acteursBruts: unknown[]): DonneesGouvernements {
  const organes = new Map<string, OrganeLu>();
  for (const brut of organesBruts) {
    const o = lireOrgane(brut);
    if (o) organes.set(o.uid, o);
  }

  const gouvernements: GouvernementSource[] = [];
  const presidencesOrganes: OrganeLu[] = [];
  for (const o of organes.values()) {
    if (o.codeType === 'GOUVERNEMENT') {
      // Sans date de début, le contrôle de validation le signale.
      gouvernements.push({ uid: o.uid, libelleSource: o.libelleAbrege ?? o.libelle, dateDebut: o.dateDebut ?? '', dateFin: o.dateFin });
    } else if (o.codeType === 'PRESREP') {
      presidencesOrganes.push(o);
    }
  }

  const membres: MembreSource[] = [];
  const postes: PosteSource[] = [];
  const presidencesAssemblee: PresidenceAssembleeSource[] = [];
  const presidentsParOrgane = new Map<string, MembreSource>();

  for (const brut of acteursBruts) {
    const a = champ(brut, 'acteur');
    if (!isRecord(a)) continue;
    const acteurUid = texte(champ(a, 'uid', '#text') ?? a.uid);
    if (!acteurUid) continue;
    const ident = champ(a, 'etatCivil', 'ident');
    const mandats = liste(champ(a, 'mandats', 'mandat'));

    const personne: MembreSource = {
      acteurUid,
      civilite: texte(champ(ident, 'civ')),
      prenom: texte(champ(ident, 'prenom')) ?? '',
      nom: texte(champ(ident, 'nom')) ?? '',
      dateNaissance: date(champ(a, 'etatCivil', 'infoNaissance', 'dateNais')),
      senateur: mandats.some((m) => champ(m, 'typeOrgane') === 'SENAT'),
    };

    let postesDeLActeur = 0;
    for (const m of mandats) {
      const typeOrgane = champ(m, 'typeOrgane');
      if (estPresidenceAssemblee(m)) {
        presidencesAssemblee.push({
          uid: texte(champ(m, 'uid')) ?? '',
          acteurUid,
          prenom: personne.prenom,
          nom: personne.nom,
          dateDebut: date(champ(m, 'dateDebut')) ?? '',
          dateFin: date(champ(m, 'dateFin')),
        });
        continue;
      }
      if (typeOrgane === 'PRESREP') {
        const ref = texte(champ(m, 'organes', 'organeRef'));
        const organe = ref ? organes.get(ref) : undefined;
        const nomme = organe && normaliserNom(organe.libelle).endsWith(normaliserNom(`${personne.prenom} ${personne.nom}`));
        if (organe && nomme) presidentsParOrgane.set(organe.uid, personne);
        continue;
      }
      if (typeOrgane !== 'MINISTERE' || champ(m, '@xsi:type') !== 'MandatSimple_Type') continue;

      // Un poste ne vise qu'un portefeuille ; une liste (vue seulement sur des
      // missions) laisse la référence vide et la validation le signale.
      const organeUid = texte(champ(m, 'organes', 'organeRef')) ?? '';
      const portefeuille = organes.get(organeUid);
      const qualite = champ(m, 'infosQualite');
      postes.push({
        uid: texte(champ(m, 'uid')) ?? '',
        gouvernementUid: portefeuille?.parent ?? '',
        acteurUid,
        organeUid,
        qualite: texte(champ(qualite, 'libQualite')) ?? '',
        qualiteAccordee: texte(champ(qualite, 'libQualiteSex')),
        rangProtocolaire: Number(texte(champ(m, 'preseance')) ?? NaN),
        intitule: portefeuille?.libelle ?? '',
        intituleCourt: portefeuille?.libelleAbrege ?? null,
        intituleComplement: portefeuille?.libelleEdition ?? null,
        dateDebut: date(champ(m, 'dateDebut')) ?? '',
        dateFin: date(champ(m, 'dateFin')),
        datePublication: date(champ(m, 'datePublication')),
      });
      postesDeLActeur++;
    }
    if (postesDeLActeur > 0) membres.push(personne);
  }

  const presidences: PresidenceSource[] = [];
  for (const o of presidencesOrganes) {
    const acteur = presidentsParOrgane.get(o.uid);
    const duLibelle = personneDuLibellePresidence(o.libelle);
    presidences.push({
      uid: o.uid,
      civilite: acteur?.civilite ?? duLibelle?.civilite ?? null,
      prenom: acteur?.prenom ?? duLibelle?.prenom ?? '',
      nom: acteur?.nom ?? duLibelle?.nom ?? '',
      dateDebut: o.dateDebut ?? '',
      dateFin: o.dateFin,
      acteurUid: acteur?.acteurUid ?? null,
    });
  }

  const parUid = <T extends { uid: string }>(a: T, b: T) => a.uid.localeCompare(b.uid);
  gouvernements.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut) || a.uid.localeCompare(b.uid));
  membres.sort((a, b) => a.acteurUid.localeCompare(b.acteurUid));
  postes.sort(parUid);
  presidences.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut) || a.uid.localeCompare(b.uid));
  presidencesAssemblee.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut) || a.uid.localeCompare(b.uid));
  return { gouvernements, membres, postes, presidences, presidencesAssemblee };
}

/**
 * Les défauts qui interdisent d'écrire : une archive tronquée ou un changement
 * de format ne doit jamais vider ni corrompre les tables. Liste vide = valide.
 */
export function anomaliesBloquantes(d: DonneesGouvernements): string[] {
  const erreurs: string[] = [];
  if (d.gouvernements.length < MINIMUMS.gouvernements) {
    erreurs.push(`${d.gouvernements.length} gouvernements (au moins ${MINIMUMS.gouvernements} attendus)`);
  }
  if (d.postes.length < MINIMUMS.postes) erreurs.push(`${d.postes.length} postes (au moins ${MINIMUMS.postes} attendus)`);
  if (d.presidences.length < MINIMUMS.presidences) {
    erreurs.push(`${d.presidences.length} présidences (au moins ${MINIMUMS.presidences} attendues)`);
  }

  const gouvernements = new Set(d.gouvernements.map((g) => g.uid));
  for (const g of d.gouvernements) {
    if (!g.dateDebut) erreurs.push(`gouvernement ${g.uid} sans date de début`);
  }
  for (const p of d.presidences) {
    if (!p.dateDebut || !p.nom) erreurs.push(`présidence ${p.uid} sans date de début ou sans nom`);
  }
  if (d.presidencesAssemblee.length < MINIMUMS.presidencesAssemblee) {
    erreurs.push(
      `${d.presidencesAssemblee.length} présidences de l'Assemblée (au moins ${MINIMUMS.presidencesAssemblee} attendues)`,
    );
  }
  for (const p of d.presidencesAssemblee) {
    if (!p.uid || !p.dateDebut || !p.nom) erreurs.push(`présidence de l'Assemblée ${p.uid || '(sans uid)'} de ${p.acteurUid} incomplète`);
  }

  const rangUn = new Map<string, number>();
  for (const p of d.postes) {
    const ou = `poste ${p.uid || '(sans uid)'} de ${p.acteurUid}`;
    if (!p.uid) erreurs.push(`${ou} : uid absent`);
    if (!gouvernements.has(p.gouvernementUid)) erreurs.push(`${ou} : portefeuille ${p.organeUid || '?'} hors d'un gouvernement de l'archive`);
    if (!p.dateDebut) erreurs.push(`${ou} : date de début absente`);
    if (!Number.isInteger(p.rangProtocolaire)) erreurs.push(`${ou} : rang protocolaire absent`);
    if (!p.qualite || !p.intitule) erreurs.push(`${ou} : qualité ou intitulé absent`);
    if (p.rangProtocolaire === 1) rangUn.set(p.gouvernementUid, (rangUn.get(p.gouvernementUid) ?? 0) + 1);
  }
  for (const g of d.gouvernements) {
    if (!rangUn.has(g.uid)) erreurs.push(`gouvernement ${g.uid} sans Premier ministre (poste de rang 1)`);
  }
  for (const m of d.membres) {
    if (!m.prenom || !m.nom) erreurs.push(`membre ${m.acteurUid} sans nom ou prénom`);
  }
  return erreurs;
}

/**
 * L'acteur réduit à ce que lit `construireDonnees` (état civil, mandats
 * MINISTERE, PRESREP, SENAT et présidence de l'Assemblée), ou null s'il n'a ni
 * poste ni présidence. Les acteurs ne sont ainsi jamais tous en mémoire à la
 * fois.
 */
export function reduireActeur(brut: unknown): unknown | null {
  const a = champ(brut, 'acteur');
  if (!isRecord(a)) return null;
  const types = ['MINISTERE', 'PRESREP', 'SENAT'];
  const mandats = liste(champ(a, 'mandats', 'mandat')).filter(
    (m) => types.includes(String(champ(m, 'typeOrgane'))) || estPresidenceAssemblee(m),
  );
  if (!mandats.some((m) => champ(m, 'typeOrgane') !== 'SENAT')) return null;
  return { acteur: { uid: a.uid, etatCivil: a.etatCivil, mandats: { mandat: mandats } } };
}

/** Lit l'archive extraite (`json/`) et construit les données, sans les valider. */
export async function lireArchiveGouvernements(json: string): Promise<DonneesGouvernements> {
  const lire = async (fichier: string) => JSON.parse(await fs.promises.readFile(fichier, 'utf-8')) as unknown;
  const organes: unknown[] = [];
  for (const f of await fichiersAMO30(json, 'organe')) {
    const brut = await lire(f);
    if (TYPES_ORGANES.has(String(champ(brut, 'organe', 'codeType')))) organes.push(brut);
  }
  const acteurs: unknown[] = [];
  for (const f of await fichiersAMO30(json, 'acteur')) {
    const reduit = reduireActeur(await lire(f));
    if (reduit) acteurs.push(reduit);
  }
  return construireDonnees(organes, acteurs);
}
