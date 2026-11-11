// =============================================================================
// Worker — Bilan des gouvernements (SPEC-BILAN-MINISTRE.md)
// =============================================================================
//
// Calcule, depuis ce que la base contient déjà (dossiers, scrutins, débats,
// postes ministériels) et le dump DOSLEG du Sénat :
//
// - `projets_loi` et `projets_loi_signataires` : les projets de loi du
//   Gouvernement déposés depuis le 21/06/2017, leurs signataires rattachés au
//   poste (`initiateur.mandatRef` du dossier AN = `postes_ministeriels.uid`),
//   ceux d'un projet déposé au Sénat lus dans DOSLEG (l'Assemblée n'y publie que
//   le Premier ministre) ;
// - `engagements_responsabilite` : les recours au 49.3 (dossiers AN
//   « Engagement de la responsabilité du Gouvernement ») ;
// - `motions_censure` : les motions mises aux voix à l'Assemblée, rattachées au
//   gouvernement du jour et, pour l'alinéa 3, à leur engagement par voteRefs ;
// - `reponses_gouvernement` : chaque réponse en séance rattachée au poste que
//   l'orateur occupait ce jour-là (prénom et nom normalisés, puis date).
//
// Tout est recalculé en entier à chaque passage et écrit par différence : une
// ligne inchangée n'est pas réécrite, une ligne qui n'a plus lieu d'être est
// supprimée. Pas de passe « IS NULL » qui comblerait sans jamais corriger.
// =============================================================================

import { Prisma, PrismaClient } from '@prisma/client';
import { PROCEDURES_PROJET } from '../sources/assemblee-nationale/dossiers-client';
import { telechargerDepotsSenat, type DepotSenat } from '../sources/senat/dosleg-depots';
import { differencier, tranches } from '../utils/synchro-differentielle';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/** Début des données de bilan : 15e législature, gouvernement Philippe II. */
export const DEBUT_COUVERTURE = '2017-06-21';

/**
 * Projets déposés au Sénat lus dans DOSLEG au-dessous desquels le dump est
 * tenu pour tronqué (400 depuis le 21/06/2017, mesuré le 11/11/2026) : rien
 * n'est écrit plutôt que d'effacer les signataires venus du Sénat.
 */
const DEPOTS_SENAT_MIN = 350;

export { PROCEDURES_PROJET };

/** Procédures AN qui ne sont pas des projets : déclaration du Gouvernement, engagement de responsabilité. */
const PROCEDURE_DECLARATION = '11';
const PROCEDURE_ENGAGEMENT = '13';

export type Stade = 'promulgue' | 'adopte' | 'examine' | 'depose';
export type Nature = 'ordinaire' | 'ratification_ordonnance' | 'convention' | 'finances' | 'constitutionnelle' | 'organique';
export type Role = 'premier_ministre' | 'chef_de_file' | 'cosignataire';
export type SourceSignataire = 'assemblee' | 'senat';

// =============================================================================
// Personnes et postes
// =============================================================================

/** « Bruno Le » + « Maire », « Laurent Nuñez » : lettres seules, sans accent ni casse. */
export function clePersonne(prenom: string | null | undefined, nom: string | null | undefined): string {
  return `${prenom ?? ''}${nom ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export interface PosteRef {
  id: string;
  uid: string;
  gouvernementId: string;
  rangProtocolaire: number;
  prenom: string;
  nom: string;
  /** YYYY-MM-DD */
  dateDebut: string;
  dateFin: string | null;
}

const contient = (p: { dateDebut: string; dateFin: string | null }, jour: string) =>
  p.dateDebut <= jour && (p.dateFin === null || jour <= p.dateFin);

/**
 * Le poste qu'une personne occupait un jour donné. Quand elle en occupe
 * plusieurs (un portefeuille et un porte-parolat), le plus haut dans l'ordre
 * protocolaire, puis le plus ancien.
 */
export function posteALaDate(postes: readonly PosteRef[], jour: string): PosteRef | null {
  const candidats = postes.filter((p) => contient(p, jour));
  candidats.sort((a, b) => a.rangProtocolaire - b.rangProtocolaire || a.dateDebut.localeCompare(b.dateDebut) || a.uid.localeCompare(b.uid));
  return candidats[0] ?? null;
}

export function postesParPersonne(postes: readonly PosteRef[]): Map<string, PosteRef[]> {
  const r = new Map<string, PosteRef[]>();
  for (const p of postes) {
    const k = clePersonne(p.prenom, p.nom);
    r.set(k, [...(r.get(k) ?? []), p]);
  }
  return r;
}

export interface GouvernementRef {
  id: string;
  dateDebut: string;
  dateFin: string | null;
}

/** Le gouvernement en fonction un jour donné ; le jour d'une passation, le nouveau. */
export function gouvernementALaDate(gouvernements: readonly GouvernementRef[], jour: string): GouvernementRef | null {
  return [...gouvernements].filter((g) => contient(g, jour)).sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0] ?? null;
}

// =============================================================================
// Dossiers de l'Assemblée
// =============================================================================

type Json = Record<string, unknown>;
const estObjet = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]);
const chaine = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export interface Acte {
  code: string;
  /** YYYY-MM-DD, date de Paris telle que publiée */
  date: string | null;
  statut: string | null;
  textesAssocies: string[];
  voteRefs: string[];
}

/** Tous les actes d'un dossier, sous-actes compris, dans l'ordre de publication. */
export function actesDossier(sourceData: unknown): Acte[] {
  const actes: Acte[] = [];
  const visiter = (a: unknown) => {
    if (!estObjet(a)) return;
    const code = chaine(a.codeActe);
    if (code) {
      const ta = a.texteAssocie;
      const textesAssocies = typeof ta === 'string'
        ? [ta]
        : liste(ta).map((t) => (estObjet(t) ? chaine(t.refTexteAssocie) : chaine(t))).filter((t): t is string => !!t);
      const vr = estObjet(a.voteRefs) ? a.voteRefs.voteRef : undefined;
      actes.push({
        code,
        date: chaine(a.dateActe)?.slice(0, 10) ?? null,
        statut: estObjet(a.statutConclusion) ? chaine(a.statutConclusion.libelle) : null,
        textesAssocies,
        voteRefs: liste(vr).map(chaine).filter((v): v is string => !!v),
      });
    }
    const sous = estObjet(a.actesLegislatifs) ? a.actesLegislatifs.acteLegislatif : undefined;
    liste(sous).forEach(visiter);
  };
  const racine = estObjet(sourceData) && estObjet(sourceData.actesLegislatifs) ? sourceData.actesLegislatifs.acteLegislatif : undefined;
  liste(racine).forEach(visiter);
  return actes;
}

/** Les `mandatRef` des signataires (`initiateur.acteurs.acteur[]`), dans l'ordre. */
export function mandatsSignataires(sourceData: unknown): string[] {
  const init = estObjet(sourceData) ? sourceData.initiateur : undefined;
  const acteurs = estObjet(init) && estObjet(init.acteurs) ? init.acteurs.acteur : undefined;
  return liste(acteurs).map((a) => (estObjet(a) ? chaine(a.mandatRef) : null)).filter((m): m is string => !!m);
}

/** Le signet Sénat du dossier (`pjl24-661`), lu dans `titreDossier.senatChemin`. */
export function signetSenat(sourceData: unknown): string | null {
  const td = estObjet(sourceData) ? sourceData.titreDossier : undefined;
  const chemin = estObjet(td) ? chaine(td.senatChemin) : null;
  return chemin ? /\/dossier-legislatif\/([a-z0-9-]+)\.html/i.exec(chemin)?.[1]?.toLowerCase() ?? null : null;
}

const ADOPTE = /adopt|voté par les deux assemblées/i;
const DEFINITIF_CONFORME = /sans modification|termes identiques/i;

/**
 * Stade atteint par un dossier AN (SPEC §2) :
 * - `promulgue` : acte de promulgation, ou loi promulguée selon DOSLEG ;
 * - `adopte` : adoption définitive sans promulgation connue (saisine du Conseil
 *   constitutionnel, lecture définitive ou Congrès adoptés, texte de CMP adopté
 *   par les deux chambres, adoption conforme après une décision de l'autre
 *   chambre) ;
 * - `examine` : au moins une décision de séance ;
 * - `depose` : aucune décision de séance.
 */
export function stadeDossierAN(actes: readonly Acte[], promulgueSelonSenat: boolean): Stade {
  if (promulgueSelonSenat || actes.some((a) => /^PROM/.test(a.code))) return 'promulgue';

  const decisions = actes
    // `AN1-DEBATS-DEC`, `SNLDEF-DEBATS-DEC`, `CG22-DEBATS-DEC`, `CMP-DEBATS-AN-DEC`
    .filter((a) => /-DEBATS(-(AN|SN))?-DEC$/.test(a.code))
    .map((a, i) => ({ ...a, i }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.i - b.i);
  const adoptee = (a: Acte) => !!a.statut && ADOPTE.test(a.statut) && !/rejet/i.test(a.statut);

  const definitive =
    actes.some((a) => a.code === 'CC' || a.code.startsWith('CC-SAISIE')) ||
    decisions.some((a) => (/^(AN|SN)LDEF-DEBATS-DEC$/.test(a.code) || /^CG\d*-DEBATS-DEC$/.test(a.code)) && adoptee(a)) ||
    (decisions.some((a) => a.code === 'CMP-DEBATS-AN-DEC' && adoptee(a)) &&
      decisions.some((a) => a.code === 'CMP-DEBATS-SN-DEC' && adoptee(a))) ||
    decisions.some((a, k) => {
      if (!a.statut || !DEFINITIF_CONFORME.test(a.statut) || !adoptee(a)) return false;
      const chambre = a.code.slice(0, 2);
      return decisions.slice(0, k).some((b) => b.code.slice(0, 2) !== chambre);
    });
  if (definitive) return 'adopte';
  return decisions.length > 0 ? 'examine' : 'depose';
}

/** Chambre et date du premier dépôt : `AN1-DEPOT` ou `SN1-DEPOT`, le plus ancien. */
export function depotDossierAN(actes: readonly Acte[]): { chambre: 'assemblee' | 'senat'; date: string } | null {
  const depots = actes
    .filter((a) => (a.code === 'AN1-DEPOT' || a.code === 'SN1-DEPOT') && a.date)
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.code.localeCompare(b.code));
  const premier = depots[0];
  return premier ? { chambre: premier.code.startsWith('SN') ? 'senat' : 'assemblee', date: premier.date! } : null;
}

const RATIFICATION_ORDONNANCE = /ratifi[^.]*ordonnance|ordonnance[^.]*ratifi/i;
const FINANCES_TITRE = /r[èe]glement du budget|approbation des comptes|loi de r[èe]glement|loi de finances|financement de la s[ée]curit[ée] sociale/i;

/**
 * Nature d'un projet. La procédure AN ou le type DOSLEG d'abord, le titre long
 * ensuite : le titre court ne dit pas toujours qu'un texte ratifie une
 * ordonnance (« Code de la commande publique »), le titre long ou le chemin
 * AN (`ratification_ordonnance_2017-1180`) si.
 */
export function natureProjet(p: {
  procedureCode?: string | null;
  typloicod?: string | null;
  titres: readonly (string | null | undefined)[];
}): Nature {
  const code = p.procedureCode ?? '';
  const typ = p.typloicod ?? '';
  const titres = p.titres.filter((t): t is string => !!t);
  if (code === '6' || typ === 'cvn') return 'convention';
  if (['3', '4', '21', '33'].includes(code) || ['pjlf', 'pjfs', 'pjlr', 'pjlg'].includes(typ)) return 'finances';
  if (code === '7' || typ === 'pjlc') return 'constitutionnelle';
  if (code === '5' || typ === 'pjlo') return 'organique';
  // Lois de règlement étiquetées « Proposition de loi ordinaire » par l'AN (8 dossiers).
  if (titres.some((t) => FINANCES_TITRE.test(t))) return 'finances';
  if (titres.some((t) => RATIFICATION_ORDONNANCE.test(t) || /ratification_ordonnance/i.test(t))) return 'ratification_ordonnance';
  return 'ordinaire';
}

export interface SignataireVoulu {
  posteId: string;
  rang: number;
  role: Role;
  source: SourceSignataire;
}

/**
 * Rôles des signataires, dans leur ordre : le poste de rang protocolaire 1 est
 * le Premier ministre ; le premier autre signataire est le chef de file, les
 * suivants cosignataires. Un poste cité deux fois ne compte qu'une fois.
 */
export function rolesSignataires(signataires: ReadonlyArray<{ poste: PosteRef; source: SourceSignataire }>): SignataireVoulu[] {
  const vus = new Set<string>();
  const r: SignataireVoulu[] = [];
  let chefDeFile = false;
  for (const { poste, source } of signataires) {
    if (vus.has(poste.id)) continue;
    vus.add(poste.id);
    let role: Role;
    if (poste.rangProtocolaire === 1) role = 'premier_ministre';
    else if (!chefDeFile) {
      role = 'chef_de_file';
      chefDeFile = true;
    } else role = 'cosignataire';
    r.push({ posteId: poste.id, rang: r.length + 1, role, source });
  }
  return r;
}

// =============================================================================
// Motions de censure
// =============================================================================

/** 2 ou 3, lu dans le titre du scrutin (« … en application de l'article 49, alinéa 3, … »). */
export function alineaMotion(titre: string): 2 | 3 | null {
  const m = /49[,\s]*(?:alin[ée]a\s*)?([23])\b/i.exec(titre) ?? /article\s+49-([23])\b/i.exec(titre);
  return m ? (Number(m[1]) as 2 | 3) : null;
}

/** « Mme Mathilde Panot », lu dans « … par Mme Mathilde Panot et 57 députés ». */
export function premierSignataireMotion(titre: string): string | null {
  // Un nom ne contient ni virgule ni « et » : « par Mmes Cyrielle Chatelain et
  // Mathilde Panot, MM. … » donne la première nommée.
  const m = /\bpar\s+(?:M\.|Mme|MM\.|Mmes)\s+(.+?)(?:,|\s+et\s+|\.?$)/i.exec(titre);
  return m ? m[1]!.trim() : null;
}

// =============================================================================
// Calcul
// =============================================================================

export interface DossierCandidat {
  id: string;
  uid: string;
  procedureCode: string | null;
  titre: string;
  titreChemin: string | null;
  sourceData: unknown;
}

export interface ProjetVoulu {
  dossierId: string;
  gouvernementId: string;
  nature: Nature;
  chambreDepot: 'assemblee' | 'senat';
  dateDepot: string;
  stade: Stade;
  signataires: SignataireVoulu[];
}

export interface EngagementVoulu {
  dossierId: string;
  posteId: string;
  date: string;
  /** Référence du texte visé (`texteAssocie` de l'acte DGVT), résolue en dossier à l'écriture */
  texteRef: string | null;
  /** uid des scrutins des motions déposées en réponse (`VTANR5L17V5284`) ; vide en 16e législature */
  voteRefs: string[];
  /** Jours des séances de discussion des motions (`…-DEBATS-SEANCE`) */
  datesSeance: string[];
}

export interface Anomalies {
  /** Auteurs ministres du Sénat sans poste au nom et à la date du dépôt */
  auteursSenatNonRattaches: string[];
  /** Dossiers sans date de dépôt lisible */
  sansDepot: string[];
  /** Signataires de postes de gouvernements différents de celui du dépôt */
  horsGouvernement: string[];
}

/**
 * Les projets et engagements voulus. `dossiersSenat` associe un signet DOSLEG
 * au dossier `SENAT-<signet>` en base ; un dépôt au Sénat qu'aucun dossier AN
 * ne cite devient un projet sur ce dossier.
 */
export function calculerProjets(entree: {
  dossiersAN: readonly DossierCandidat[];
  depotsSenat: readonly DepotSenat[];
  dossiersSenat: ReadonlyMap<string, string>;
  postes: readonly PosteRef[];
  gouvernements: readonly GouvernementRef[];
}): { projets: ProjetVoulu[]; engagements: EngagementVoulu[]; anomalies: Anomalies } {
  const posteParUid = new Map(entree.postes.map((p) => [p.uid, p]));
  const parPersonne = postesParPersonne(entree.postes);
  const depotParSignet = new Map(entree.depotsSenat.map((d) => [d.signet, d]));
  const anomalies: Anomalies = { auteursSenatNonRattaches: [], sansDepot: [], horsGouvernement: [] };

  const ministresSenat = (depot: DepotSenat): Array<{ poste: PosteRef; source: SourceSignataire }> =>
    depot.ministres.flatMap((m) => {
      const poste = posteALaDate(parPersonne.get(clePersonne(m.prenom, m.nom)) ?? [], depot.dateDepot);
      if (!poste) {
        anomalies.auteursSenatNonRattaches.push(`${depot.signet} : ${m.prenom} ${m.nom} (${depot.dateDepot})`);
        return [];
      }
      return [{ poste, source: 'senat' as const }];
    });

  const gouvernementDuProjet = (signataires: readonly SignataireVoulu[], jour: string, cle: string): string | null => {
    const duJour = gouvernementALaDate(entree.gouvernements, jour);
    const gouvernementsSignataires = new Set(signataires.map((s) => entree.postes.find((p) => p.id === s.posteId)!.gouvernementId));
    if (duJour && gouvernementsSignataires.size > 0 && !gouvernementsSignataires.has(duJour.id)) anomalies.horsGouvernement.push(cle);
    // Le gouvernement des signataires fait foi ; à défaut, celui du jour.
    const premier = signataires[0] ? entree.postes.find((p) => p.id === signataires[0]!.posteId)!.gouvernementId : null;
    return premier ?? duJour?.id ?? null;
  };

  const projets: ProjetVoulu[] = [];
  const engagements: EngagementVoulu[] = [];
  const signetsPris = new Set<string>();

  for (const d of entree.dossiersAN) {
    const postesAN = mandatsSignataires(d.sourceData)
      .map((m) => posteParUid.get(m))
      .filter((p): p is PosteRef => !!p);
    if (d.procedureCode === PROCEDURE_DECLARATION) continue;
    if (postesAN.length === 0 && !PROCEDURES_PROJET.has(d.procedureCode ?? '')) continue;
    const actes = actesDossier(d.sourceData);

    if (d.procedureCode === PROCEDURE_ENGAGEMENT) {
      const dgvt = actes.find((a) => /-DGVT$/.test(a.code) && a.date);
      if (!dgvt) {
        anomalies.sansDepot.push(d.uid);
        continue;
      }
      const pm = postesAN.find((p) => p.rangProtocolaire === 1) ?? postesAN[0];
      if (!pm) continue;
      engagements.push({
        dossierId: d.id,
        posteId: pm.id,
        date: dgvt.date!,
        texteRef: dgvt.textesAssocies[0] ?? null,
        voteRefs: [...new Set(actes.flatMap((a) => a.voteRefs))],
        datesSeance: [...new Set(actes.filter((a) => /-DEBATS-SEANCE$/.test(a.code) && a.date).map((a) => a.date!))].sort(),
      });
      continue;
    }

    const depot = depotDossierAN(actes);
    if (!depot) {
      anomalies.sansDepot.push(d.uid);
      continue;
    }
    if (depot.date < DEBUT_COUVERTURE) continue;

    const signet = signetSenat(d.sourceData);
    const depotSenat = signet ? depotParSignet.get(signet) : undefined;
    if (signet) signetsPris.add(signet);

    // L'AN fait foi quand elle nomme un ministre ; sinon (projet déposé au
    // Sénat, PM seul), les ministres auteurs du texte de dépôt au Sénat.
    const signataires: Array<{ poste: PosteRef; source: SourceSignataire }> = postesAN.map((poste) => ({ poste, source: 'assemblee' }));
    if (!postesAN.some((p) => p.rangProtocolaire !== 1) && depotSenat) signataires.push(...ministresSenat(depotSenat));
    const voulus = rolesSignataires(signataires);
    const gouvernementId = gouvernementDuProjet(voulus, depot.date, d.uid);
    if (!gouvernementId) continue;

    projets.push({
      dossierId: d.id,
      gouvernementId,
      nature: natureProjet({ procedureCode: d.procedureCode, titres: [depotSenat?.titreLong, d.titre, d.titreChemin] }),
      chambreDepot: depot.chambre,
      dateDepot: depot.date,
      stade: stadeDossierAN(actes, depotSenat?.promulgue ?? false),
      signataires: voulus,
    });
  }

  // Projets déposés au Sénat qu'aucun dossier AN ne cite : le dossier du Sénat.
  for (const depot of entree.depotsSenat) {
    if (signetsPris.has(depot.signet)) continue;
    const dossierId = entree.dossiersSenat.get(depot.signet);
    if (!dossierId) continue;
    const voulus = rolesSignataires(ministresSenat(depot));
    const gouvernementId = gouvernementDuProjet(voulus, depot.dateDepot, `SENAT-${depot.signet}`);
    if (!gouvernementId) continue;
    projets.push({
      dossierId,
      gouvernementId,
      nature: natureProjet({ typloicod: depot.typloicod, titres: [depot.titreLong] }),
      chambreDepot: 'senat',
      dateDepot: depot.dateDepot,
      stade: depot.promulgue ? 'promulgue' : depot.adopteDefinitivement ? 'adopte' : depot.examine ? 'examine' : 'depose',
      signataires: voulus,
    });
  }

  return { projets, engagements, anomalies };
}

export interface MotionVoulue {
  scrutinId: string;
  gouvernementId: string;
  alinea: number;
  /** dossier de l'engagement, résolu en ligne d'engagement à l'écriture */
  engagementDossierId: string | null;
  premierSignataire: string | null;
}

/** Délai maximal entre un 49.3 et le vote des motions qui y répondent (48 h après leur dépôt, en pratique 2 à 5 jours). */
const DELAI_VOTE_MOTION_JOURS = 10;

const plusJours = (jourIso: string, n: number): string => {
  const d = new Date(`${jourIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Engagement de chaque motion de l'alinéa 3.
 *
 * 1. Par les `voteRefs` du dossier d'engagement (15e et 17e législatures).
 * 2. À défaut (la 16e ne publie aucun `voteRefs` sur ses votes de motion), par
 *    le jour du vote : celui de la séance de discussion des motions du dossier,
 *    ou, s'il n'en publie pas, le premier jour de vote de motion dans les
 *    10 jours qui suivent l'engagement. Seulement si un seul engagement vote ce
 *    jour-là : le 24/10/2022, trois motions répondent au PLF et au PLFSS 2023
 *    sans que rien ne dise laquelle répond à quoi ; elles restent sans
 *    engagement plutôt qu'attribuées au hasard.
 */
export function engagementsDesMotions(
  motions: ReadonlyArray<{ uid: string; date: string }>,
  engagements: readonly EngagementVoulu[],
): Map<string, string> {
  const resultat = new Map<string, string>();
  for (const e of engagements) for (const v of e.voteRefs) resultat.set(v, e.dossierId);

  const restantes = motions.filter((m) => !resultat.has(m.uid));
  const joursRestants = [...new Set(restantes.map((m) => m.date))].sort();
  const parJour = new Map<string, string[]>();
  for (const e of engagements) {
    if (e.voteRefs.length > 0) continue;
    const jours = e.datesSeance.length > 0
      ? e.datesSeance
      : joursRestants.filter((j) => j >= e.date && j <= plusJours(e.date, DELAI_VOTE_MOTION_JOURS)).slice(0, 1);
    for (const j of jours) parJour.set(j, [...(parJour.get(j) ?? []), e.dossierId]);
  }
  for (const m of restantes) {
    const candidats = parJour.get(m.date) ?? [];
    if (candidats.length === 1) resultat.set(m.uid, candidats[0]!);
  }
  return resultat;
}

export function calculerMotions(
  scrutins: ReadonlyArray<{ id: string; uid: string; date: string; titre: string }>,
  engagements: readonly EngagementVoulu[],
  gouvernements: readonly GouvernementRef[],
): { motions: MotionVoulue[]; sansGouvernement: string[]; sansAlinea: string[] } {
  const engagementParVote = engagementsDesMotions(
    scrutins.filter((s) => alineaMotion(s.titre) === 3),
    engagements,
  );
  const motions: MotionVoulue[] = [];
  const sansGouvernement: string[] = [];
  const sansAlinea: string[] = [];
  for (const s of scrutins) {
    const alinea = alineaMotion(s.titre);
    const g = gouvernementALaDate(gouvernements, s.date);
    if (!alinea) {
      sansAlinea.push(s.uid);
      continue;
    }
    if (!g) {
      sansGouvernement.push(s.uid);
      continue;
    }
    motions.push({
      scrutinId: s.id,
      gouvernementId: g.id,
      alinea,
      engagementDossierId: alinea === 3 ? engagementParVote.get(s.uid) ?? null : null,
      premierSignataire: premierSignataireMotion(s.titre),
    });
  }
  return { motions, sansGouvernement, sansAlinea };
}

const lettres = (s: string | null | undefined) => clePersonne('', s);

/**
 * Repli quand le nom exact ne donne rien : même prénom, et l'un des deux noms
 * est une partie de l'autre nom composé (« Agresti-Roubache » au Sénat,
 * « Roubache » à l'Assemblée). Seulement si une seule personne de ce prénom
 * occupe un poste ce jour-là avec un tel nom.
 */
function posteParNomCompose(
  postes: readonly PosteRef[],
  prenom: string | null,
  nom: string | null,
  jour: string,
): PosteRef | null {
  const p = lettres(prenom);
  const parties = (n: string | null | undefined) => new Set((n ?? '').split(/[-\s]+/).map(lettres).filter((x) => x.length >= 3));
  const partiesNom = parties(nom);
  const nomComplet = lettres(nom);
  const candidats = postes.filter((x) => {
    if (lettres(x.prenom) !== p || !contient(x, jour)) return false;
    const autre = lettres(x.nom);
    return partiesNom.has(autre) || parties(x.nom).has(nomComplet);
  });
  const personnes = new Set(candidats.map((c) => clePersonne(c.prenom, c.nom)));
  return personnes.size === 1 ? posteALaDate(candidats, jour) : null;
}

export function calculerReponses(
  interventions: ReadonlyArray<{ id: string; date: string; prenom: string | null; nom: string | null }>,
  postes: readonly PosteRef[],
): { reponses: Array<{ interventionId: string; posteId: string }>; nonRattachees: number } {
  const parPersonne = postesParPersonne(postes);
  const reponses: Array<{ interventionId: string; posteId: string }> = [];
  let nonRattachees = 0;
  for (const i of interventions) {
    const poste =
      posteALaDate(parPersonne.get(clePersonne(i.prenom, i.nom)) ?? [], i.date) ??
      posteParNomCompose(postes, i.prenom, i.nom, i.date);
    if (poste) reponses.push({ interventionId: i.id, posteId: poste.id });
    else nonRattachees++;
  }
  return { reponses, nonRattachees };
}

// =============================================================================
// Lecture et écriture
// =============================================================================

export interface RapportBilan {
  projets: Compteurs;
  signataires: Compteurs;
  engagements: Compteurs;
  motions: Compteurs;
  reponses: Compteurs;
  reponsesNonRattachees: number;
  anomalies: Anomalies & { motionsSansGouvernement: string[]; motionsSansAlinea: string[]; engagementsSansTexte: string[] };
}

interface Compteurs {
  crees: number;
  modifies: number;
  supprimes: number;
}

const jour = (s: string): Date => new Date(`${s}T00:00:00Z`);

async function chargerPostes(): Promise<{ postes: PosteRef[]; gouvernements: GouvernementRef[] }> {
  const postes = await prisma.$queryRaw<PosteRef[]>`
    SELECT p.id, p.uid, p.gouvernement_id AS "gouvernementId", p.rang_protocolaire AS "rangProtocolaire",
           m.prenom, m.nom, to_char(p.date_debut, 'YYYY-MM-DD') AS "dateDebut", to_char(p.date_fin, 'YYYY-MM-DD') AS "dateFin"
    FROM postes_ministeriels p JOIN membres_gouvernement m ON m.id = p.membre_id`;
  const gouvernements = await prisma.$queryRaw<GouvernementRef[]>`
    SELECT id, to_char(date_debut, 'YYYY-MM-DD') AS "dateDebut", to_char(date_fin, 'YYYY-MM-DD') AS "dateFin" FROM gouvernements`;
  return { postes, gouvernements };
}

/**
 * Dossiers AN qui peuvent être un projet ou un engagement : la procédure est
 * celle d'un projet, ou un signataire est un poste ministériel (la jointure
 * trie seule projets et propositions dans les procédures mixtes ; l'engagement
 * a le Premier ministre pour signataire).
 */
async function chargerDossiersAN(): Promise<DossierCandidat[]> {
  return prisma.$queryRaw<DossierCandidat[]>`
    SELECT d.id, d.uid, d.procedure_code AS "procedureCode", d.titre,
           d.source_data->'titreDossier'->>'titreChemin' AS "titreChemin", d.source_data AS "sourceData"
    FROM dossiers_legislatifs d
    WHERE d.uid LIKE 'DL%' AND d.legislature >= 15 AND d.source_data IS NOT NULL
      AND (d.procedure_code = ANY(${[...PROCEDURES_PROJET]}::text[]) OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE jsonb_typeof(d.source_data->'initiateur'->'acteurs'->'acteur')
               WHEN 'array' THEN d.source_data->'initiateur'->'acteurs'->'acteur'
               WHEN 'object' THEN jsonb_build_array(d.source_data->'initiateur'->'acteurs'->'acteur')
               ELSE '[]'::jsonb END) a
        JOIN postes_ministeriels p ON p.uid = a->>'mandatRef'))
    ORDER BY d.uid`;
}

/**
 * Référence d'un texte sans son suffixe de document : l'engagement cite
 * `DECLANR5L16B0950-N0`, le dossier du PLFRSS 2023 `DECLANR5L16B0950`.
 */
export const refTexte = (ref: string): string => ref.replace(/-N\d+$/, '');

/** Le dossier (hors engagements) qui cite chaque texte visé par un 49.3, à suffixe près. */
async function dossiersDesTextes(refs: readonly string[]): Promise<Map<string, string>> {
  if (refs.length === 0) return new Map();
  const lignes = await prisma.$queryRaw<Array<{ ref: string; dossierId: string }>>`
    SELECT DISTINCT regexp_replace(r.ref, '-N[0-9]+$', '') AS ref, d.id AS "dossierId"
    FROM dossiers_legislatifs d
    CROSS JOIN LATERAL jsonb_path_query(d.source_data, 'lax $.**.texteAssocie') t
    CROSS JOIN LATERAL (
      SELECT CASE jsonb_typeof(t) WHEN 'string' THEN t #>> '{}' WHEN 'object' THEN t->>'refTexteAssocie' END AS ref
      UNION ALL
      SELECT CASE jsonb_typeof(e) WHEN 'string' THEN e #>> '{}' ELSE e->>'refTexteAssocie' END
      FROM jsonb_array_elements(CASE jsonb_typeof(t) WHEN 'array' THEN t ELSE '[]'::jsonb END) e
    ) r
    WHERE d.uid LIKE 'DL%' AND d.legislature >= 15
      AND d.procedure_code IS DISTINCT FROM ${PROCEDURE_ENGAGEMENT}
      AND regexp_replace(r.ref, '-N[0-9]+$', '') = ANY(${[...new Set(refs.map(refTexte))]}::text[])`;
  // Un texte cité par deux dossiers n'est rattaché à aucun.
  const parRef = new Map<string, string[]>();
  for (const l of lignes) parRef.set(l.ref, [...(parRef.get(l.ref) ?? []), l.dossierId]);
  return new Map([...parRef].filter(([, ids]) => ids.length === 1).map(([ref, ids]) => [ref, ids[0]!]));
}

export async function syncBilanGouvernement(options: { archiveDosleg?: string } = {}): Promise<RapportBilan> {
  const depotsSenat = await telechargerDepotsSenat(DEBUT_COUVERTURE, { archive: options.archiveDosleg });
  if (depotsSenat.length < DEPOTS_SENAT_MIN) {
    throw new Error(`DOSLEG : ${depotsSenat.length} projets déposés au Sénat depuis ${DEBUT_COUVERTURE} (au moins ${DEPOTS_SENAT_MIN} attendus) : rien n'est écrit`);
  }

  const { postes, gouvernements } = await chargerPostes();
  const dossiersAN = await chargerDossiersAN();
  const dossiersSenat = new Map(
    (await prisma.dossierLegislatif.findMany({ where: { uid: { startsWith: 'SENAT-' } }, select: { id: true, uid: true } }))
      .map((d) => [d.uid.slice('SENAT-'.length).toLowerCase(), d.id]),
  );

  const { projets, engagements, anomalies } = calculerProjets({ dossiersAN, depotsSenat, dossiersSenat, postes, gouvernements });

  const scrutins = await prisma.$queryRaw<Array<{ id: string; uid: string; date: string; titre: string }>>`
    SELECT id, regexp_replace(source_url, '^.*/', '') AS uid, to_char(date, 'YYYY-MM-DD') AS date, titre
    FROM scrutins
    WHERE chambre = 'assemblee' AND titre ~* 'motion de censure' AND date >= ${jour(DEBUT_COUVERTURE)}`;
  const { motions, sansGouvernement, sansAlinea } = calculerMotions(scrutins, engagements, gouvernements);

  const interventions = await prisma.$queryRaw<Array<{ id: string; date: string; prenom: string | null; nom: string | null }>>`
    SELECT id, to_char(date, 'YYYY-MM-DD') AS date, orateur_prenom AS prenom, orateur_nom AS nom
    FROM interventions WHERE type = 'reponse_gouvernement'`;
  const { reponses, nonRattachees } = calculerReponses(interventions, postes);

  const textes = await dossiersDesTextes([...new Set(engagements.map((e) => e.texteRef).filter((r): r is string => !!r))]);
  const engagementsSansTexte = engagements.filter((e) => !e.texteRef || !textes.has(refTexte(e.texteRef))).map((e) => e.dossierId);

  const rapport = await prisma.$transaction(
    (tx) => ecrire(tx, { projets, engagements, motions, reponses, textes }),
    { timeout: 300_000, maxWait: 30_000 },
  );
  const resultat: RapportBilan = {
    ...rapport,
    reponsesNonRattachees: nonRattachees,
    anomalies: { ...anomalies, motionsSansGouvernement: sansGouvernement, motionsSansAlinea: sansAlinea, engagementsSansTexte },
  };
  if (anomalies.auteursSenatNonRattaches.length + sansGouvernement.length + sansAlinea.length > 0) {
    logger.warn(resultat.anomalies, 'Bilan des gouvernements : éléments non rattachés');
  }
  logger.info(
    { ...rapport, projets: projets.length, engagements: engagements.length, motions: motions.length, reponses: reponses.length, nonRattachees },
    'Bilan des gouvernements synchronisé',
  );
  return resultat;
}

async function ecrire(
  tx: Prisma.TransactionClient,
  v: {
    projets: ProjetVoulu[];
    engagements: EngagementVoulu[];
    motions: MotionVoulue[];
    reponses: Array<{ interventionId: string; posteId: string }>;
    textes: Map<string, string>;
  },
): Promise<Omit<RapportBilan, 'reponsesNonRattachees' | 'anomalies'>> {
  const compte = (d: { aCreer: unknown[]; aModifier: unknown[]; aSupprimer: unknown[] }): Compteurs => ({
    crees: d.aCreer.length, modifies: d.aModifier.length, supprimes: d.aSupprimer.length,
  });

  // --- Projets ---------------------------------------------------------------
  const CHAMPS_PROJET = ['gouvernementId', 'nature', 'chambreDepot', 'dateDepot', 'stade'] as const;
  const projetsVoulus = v.projets.map((p) => ({
    dossierId: p.dossierId, gouvernementId: p.gouvernementId, nature: p.nature,
    chambreDepot: p.chambreDepot, dateDepot: jour(p.dateDepot), stade: p.stade,
  }));
  const projetsExistants = await tx.projetLoi.findMany({
    select: { id: true, dossierId: true, gouvernementId: true, nature: true, chambreDepot: true, dateDepot: true, stade: true },
  });
  const dp = differencier(projetsExistants, projetsVoulus, { existant: (e) => e.dossierId, voulu: (p) => p.dossierId }, CHAMPS_PROJET);
  for (const lot of tranches(dp.aSupprimer.map((e) => e.id), 500)) await tx.projetLoi.deleteMany({ where: { id: { in: lot } } });
  for (const { existant, voulu } of dp.aModifier) {
    const { dossierId: _cle, ...data } = voulu;
    await tx.projetLoi.update({ where: { id: existant.id }, data });
  }
  if (dp.aCreer.length > 0) await tx.projetLoi.createMany({ data: dp.aCreer });

  // --- Signataires -----------------------------------------------------------
  const idProjet = new Map((await tx.projetLoi.findMany({ select: { id: true, dossierId: true } })).map((p) => [p.dossierId, p.id]));
  const CHAMPS_SIGNATAIRE = ['rang', 'role', 'source'] as const;
  const signatairesVoulus = v.projets.flatMap((p) =>
    p.signataires.map((s) => ({ projetId: idProjet.get(p.dossierId)!, posteId: s.posteId, rang: s.rang, role: s.role, source: s.source })),
  );
  const signatairesExistants = await tx.projetLoiSignataire.findMany({
    select: { id: true, projetId: true, posteId: true, rang: true, role: true, source: true },
  });
  const cleSignataire = (s: { projetId: string; posteId: string }) => `${s.projetId}|${s.posteId}`;
  const ds = differencier(signatairesExistants, signatairesVoulus, { existant: cleSignataire, voulu: cleSignataire }, CHAMPS_SIGNATAIRE);
  for (const lot of tranches(ds.aSupprimer.map((e) => e.id), 500)) await tx.projetLoiSignataire.deleteMany({ where: { id: { in: lot } } });
  for (const { existant, voulu } of ds.aModifier) {
    await tx.projetLoiSignataire.update({ where: { id: existant.id }, data: { rang: voulu.rang, role: voulu.role, source: voulu.source } });
  }
  for (const lot of tranches(ds.aCreer, 1000)) await tx.projetLoiSignataire.createMany({ data: lot });

  // --- Engagements -----------------------------------------------------------
  const CHAMPS_ENGAGEMENT = ['posteId', 'date', 'dossierTexteId'] as const;
  const engagementsVoulus = v.engagements.map((e) => ({
    dossierId: e.dossierId, posteId: e.posteId, date: jour(e.date),
    dossierTexteId: (e.texteRef && v.textes.get(refTexte(e.texteRef))) || null,
  }));
  const engagementsExistants = await tx.engagementResponsabilite.findMany({
    select: { id: true, dossierId: true, posteId: true, date: true, dossierTexteId: true },
  });
  const de = differencier(engagementsExistants, engagementsVoulus, { existant: (e) => e.dossierId, voulu: (e) => e.dossierId }, CHAMPS_ENGAGEMENT);
  if (de.aSupprimer.length > 0) await tx.engagementResponsabilite.deleteMany({ where: { id: { in: de.aSupprimer.map((e) => e.id) } } });
  for (const { existant, voulu } of de.aModifier) {
    const { dossierId: _cle, ...data } = voulu;
    await tx.engagementResponsabilite.update({ where: { id: existant.id }, data });
  }
  if (de.aCreer.length > 0) await tx.engagementResponsabilite.createMany({ data: de.aCreer });

  // --- Motions ---------------------------------------------------------------
  const idEngagement = new Map(
    (await tx.engagementResponsabilite.findMany({ select: { id: true, dossierId: true } })).map((e) => [e.dossierId, e.id]),
  );
  const CHAMPS_MOTION = ['gouvernementId', 'alinea', 'engagementId', 'premierSignataire'] as const;
  const motionsVoulues = v.motions.map((m) => ({
    scrutinId: m.scrutinId, gouvernementId: m.gouvernementId, alinea: m.alinea,
    engagementId: m.engagementDossierId ? idEngagement.get(m.engagementDossierId) ?? null : null,
    premierSignataire: m.premierSignataire,
  }));
  const motionsExistantes = await tx.motionCensure.findMany({
    select: { id: true, scrutinId: true, gouvernementId: true, alinea: true, engagementId: true, premierSignataire: true },
  });
  const dm = differencier(motionsExistantes, motionsVoulues, { existant: (e) => e.scrutinId, voulu: (m) => m.scrutinId }, CHAMPS_MOTION);
  if (dm.aSupprimer.length > 0) await tx.motionCensure.deleteMany({ where: { id: { in: dm.aSupprimer.map((e) => e.id) } } });
  for (const { existant, voulu } of dm.aModifier) {
    const { scrutinId: _cle, ...data } = voulu;
    await tx.motionCensure.update({ where: { id: existant.id }, data });
  }
  if (dm.aCreer.length > 0) await tx.motionCensure.createMany({ data: dm.aCreer });

  // --- Réponses --------------------------------------------------------------
  const reponsesExistantes = await tx.reponseGouvernement.findMany({ select: { id: true, interventionId: true, posteId: true } });
  const dr = differencier(reponsesExistantes, v.reponses, { existant: (e) => e.interventionId, voulu: (r) => r.interventionId }, ['posteId'] as const);
  for (const lot of tranches(dr.aSupprimer.map((e) => e.id), 1000)) await tx.reponseGouvernement.deleteMany({ where: { id: { in: lot } } });
  // Changement de poste : par lots de même poste plutôt qu'une requête par ligne.
  const parPoste = new Map<string, string[]>();
  for (const { existant, voulu } of dr.aModifier) parPoste.set(voulu.posteId, [...(parPoste.get(voulu.posteId) ?? []), existant.id]);
  for (const [posteId, ids] of parPoste) {
    for (const lot of tranches(ids, 1000)) await tx.reponseGouvernement.updateMany({ where: { id: { in: lot } }, data: { posteId } });
  }
  for (const lot of tranches(dr.aCreer, 2000)) await tx.reponseGouvernement.createMany({ data: lot });

  return {
    projets: compte(dp),
    signataires: compte(ds),
    engagements: compte(de),
    motions: compte(dm),
    reponses: compte(dr),
  };
}
