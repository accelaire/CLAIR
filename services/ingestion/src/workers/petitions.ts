// =============================================================================
// Pétitions citoyennes (#84) : ingestion, relevés de signatures, parcours
// =============================================================================
//
// Trois étapes, chacune une commande et une étape du smart-sync :
//
//  1. `syncPetitions(chambre)` : le fichier data.gouv.fr de la chambre, lu en
//     flux et écrit par différence (empreinte de la ligne normalisée), plus un
//     relevé de signatures quand le compteur a changé. Une pétition absente du
//     fichier est retirée (son auteur l'a retirée), sauf si trop disparaissent
//     d'un coup : c'est alors la source qui est en cause, rien n'est supprimé.
//
//  2. `calculerParcoursPetitions()` : les étapes de chaque pétition, depuis
//     l'agenda des commissions de l'AN, les dossiers de la procédure
//     « Pétitions » et la plateforme ; puis la collecte, la dernière étape et
//     le caractère « suivi » (indexable). Rejoué chaque nuit : l'agenda bouge
//     tous les jours, et une étape qui disparaît de sa source disparaît d'ici.
//
//  3. `rattraperRelevesPetitions(chambre)` : les relevés des archives
//     hebdomadaires de data.gouv.fr. Commande lancée à la main, hors du cron.
//
// Voir `sources/petitions/` pour ce que la source dit et ne dit pas.
// =============================================================================

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../utils/logger';
import { errorMessage } from '../utils/errors';
import { downloadWithRetry } from '../utils/download';
import { empreinte } from '../utils/empreinte';
import { differencier, tranches } from '../utils/synchro-differentielle';
import { LEGISLATURE_AN_COURANTE } from './mandats';
import {
  collecte as calculerCollecte,
  formeComparable,
  HOTE_PLATEFORME,
  jourUTC,
  LigneInvalide,
  normaliserLigne,
  SEUIL_SUIVIE,
  type ChambrePetition,
  type PetitionNormalisee,
} from '../sources/petitions/normalisation';
import { listerArchives, lireFichierPetitions, urlPetitions } from '../sources/petitions/client';
import {
  dateDuDossier,
  derniereEtape,
  estSuivie,
  jourParis,
  lireOdj,
  lireReponseOfficielle,
  numeroDuDossier,
  type TypeEtape,
} from '../sources/petitions/parcours';

// Créé au premier usage : `sync.ts` importe ce module, et les tests qui
// importent `sync.ts` n'ont pas à démarrer un moteur Prisma de plus.
let client: PrismaClient | undefined;
const db = (): PrismaClient => (client ??= new PrismaClient());

/**
 * Part des pétitions qui peuvent disparaître d'un fichier à l'autre. Les
 * retraits par leur auteur sont rares : 5 à l'AN en 16 mois d'archives. Au-delà,
 * c'est le relevé de data.gouv.fr qui a raté des pages, comme de novembre 2025
 * à avril 2026 où le fichier AN est resté figé à 2 674 lignes.
 */
const DISPARITIONS_MAX = 0.01;

/** Part des lignes illisibles tolérée avant d'arrêter (une source qui change de forme). */
const INVALIDES_MAX = 0.01;

/** Pétitions écrites par lot. */
const TAILLE_LOT = 200;

/** Une page officielle n'est relue qu'au bout de ce délai. */
const RELECTURE_PAGE_JOURS = 6;

/** Une requête par seconde sur les plateformes officielles. */
const PAUSE_ENTRE_PAGES_MS = 1000;

const USER_AGENT = 'CLAIR-Bot/1.0 (https://github.com/clair)';

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// =============================================================================
// 1. Ingestion d'un fichier
// =============================================================================

export interface RapportPetitions {
  chambre: ChambrePetition;
  lignes: number;
  /** Lignes illisibles (20 premières raisons) */
  invalides: string[];
  nbInvalides: number;
  crees: number;
  modifies: number;
  inchanges: number;
  retirees: number;
  releves: number;
  /** Libellés de commission sans commission permanente correspondante */
  commissionsInconnues: string[];
}

type DonneesPetition = Omit<PetitionNormalisee, 'chambre' | 'numero'> & {
  commissionId: string | null;
};

/**
 * Commissions permanentes de l'AN, par libellé comparable. Un libellé qui
 * correspondrait à deux commissions n'est pas rattaché.
 */
async function commissionsParLibelle(): Promise<Map<string, string | null>> {
  const commissions = await db().commission.findMany({
    where: { chambre: 'assemblee', type: 'permanente', actif: true },
    select: { id: true, nom: true },
  });
  const parLibelle = new Map<string, string | null>();
  for (const c of commissions) {
    const cle = formeComparable(c.nom);
    parLibelle.set(cle, parLibelle.has(cle) ? null : c.id);
  }
  return parLibelle;
}

/** Dernier compteur relevé de chaque pétition d'une chambre. */
async function derniersReleves(chambre: ChambrePetition): Promise<Map<string, number>> {
  const lignes = await db().$queryRaw<Array<{ petition_id: string; signatures: number }>>`
    SELECT DISTINCT ON (r.petition_id) r.petition_id, r.signatures
    FROM petitions_releves r
    JOIN petitions p ON p.id = r.petition_id
    WHERE p.chambre = ${chambre}
    ORDER BY r.petition_id, r.date DESC
  `;
  return new Map(lignes.map((l) => [l.petition_id, l.signatures]));
}

/** Écrit des relevés ; un relevé du même jour est remplacé s'il diffère. */
async function ecrireReleves(releves: Array<{ petitionId: string; date: Date; signatures: number }>): Promise<number> {
  let n = 0;
  for (const lot of tranches(releves, 1000)) {
    n += await db().$executeRaw`
      INSERT INTO petitions_releves (petition_id, date, signatures)
      SELECT * FROM unnest(
        ${lot.map((r) => r.petitionId)}::text[],
        ${lot.map((r) => r.date.toISOString().slice(0, 10))}::date[],
        ${lot.map((r) => r.signatures)}::int[]
      )
      ON CONFLICT (petition_id, date) DO UPDATE SET signatures = EXCLUDED.signatures
      WHERE petitions_releves.signatures IS DISTINCT FROM EXCLUDED.signatures
    `;
  }
  return n;
}

/** Date de mise en ligne du fichier courant (Last-Modified), null si illisible. */
async function dateDuFichierCourant(chambre: ChambrePetition): Promise<Date | null> {
  try {
    const r = await axios.head(urlPetitions(chambre), { timeout: 30_000, headers: { 'User-Agent': USER_AGENT } });
    const d = new Date(String(r.headers['last-modified'] ?? ''));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (e) {
    logger.warn({ chambre, error: errorMessage(e) }, 'Pétitions : date du fichier illisible, relevés datés du jour');
    return null;
  }
}

/**
 * Synchronise une chambre depuis son fichier courant (ou `options.fichier`).
 * `dateFichier` date les relevés : celle du fichier source (Last-Modified),
 * pas celle du passage.
 */
export async function syncPetitions(
  chambre: ChambrePetition,
  options: { fichier?: string; dateFichier?: Date | null; aujourdhui?: Date } = {},
): Promise<RapportPetitions> {
  const aujourdhui = options.aujourdhui ?? new Date();

  let chemin = options.fichier;
  let dateFichier = options.dateFichier ?? null;
  const temporaire = chemin ? null : path.join(os.tmpdir(), `petitions-${chambre}-${randomUUID()}.csv`);
  if (temporaire) {
    if (!dateFichier) dateFichier = await dateDuFichierCourant(chambre);
    await downloadWithRetry(urlPetitions(chambre), temporaire, { timeoutMs: 5 * 60_000, userAgent: USER_AGENT });
    chemin = temporaire;
  }
  const dateReleve = jourUTC(dateFichier ?? aujourdhui);

  try {
    const existants = await db().petition.findMany({
      where: { chambre },
      select: { id: true, numero: true, empreinteSource: true },
    });
    const parNumero = new Map(existants.map((e) => [e.numero, e]));
    const releves = await derniersReleves(chambre);
    const commissions = chambre === 'assemblee' ? await commissionsParLibelle() : new Map<string, string | null>();

    const rapport: RapportPetitions = {
      chambre, lignes: 0, invalides: [], nbInvalides: 0, crees: 0, modifies: 0,
      inchanges: 0, retirees: 0, releves: 0, commissionsInconnues: [],
    };
    const inconnues = new Set<string>();
    const vus = new Set<number>();
    const aCreer: Prisma.PetitionCreateManyInput[] = [];
    const aModifier: Array<{ id: string; data: DonneesPetition & { empreinteSource: string } }> = [];
    // Compteurs à relever, par numéro : l'id d'une pétition créée n'est connu qu'après écriture.
    const compteurs = new Map<number, number>();

    const vider = async (fin = false) => {
      if (aCreer.length >= TAILLE_LOT || (fin && aCreer.length > 0)) {
        await db().petition.createMany({ data: aCreer.splice(0), skipDuplicates: true });
      }
      if (aModifier.length >= TAILLE_LOT || (fin && aModifier.length > 0)) {
        for (const { id, data } of aModifier.splice(0)) {
          await db().petition.update({ where: { id }, data });
        }
      }
    };

    rapport.lignes = await lireFichierPetitions(chemin!, chambre, async (ligne) => {
      let p: PetitionNormalisee;
      try {
        p = normaliserLigne(chambre, ligne, LEGISLATURE_AN_COURANTE);
      } catch (e) {
        if (!(e instanceof LigneInvalide)) throw e;
        rapport.nbInvalides++;
        if (rapport.invalides.length < 20) rapport.invalides.push(e.message);
        return;
      }
      if (vus.has(p.numero)) {
        rapport.nbInvalides++;
        if (rapport.invalides.length < 20) rapport.invalides.push(`n° ${p.numero} : en double dans le fichier`);
        return;
      }
      vus.add(p.numero);

      let commissionId: string | null = null;
      if (p.commissionSource) {
        commissionId = commissions.get(formeComparable(p.commissionSource)) ?? null;
        if (!commissionId) inconnues.add(p.commissionSource);
      }

      const { chambre: _c, numero, ...champs } = p;
      const donnees: DonneesPetition = { ...champs, commissionId };
      const empreinteSource = empreinte(donnees);
      if (p.signatures !== null) compteurs.set(numero, p.signatures);

      const existant = parNumero.get(numero);
      if (!existant) {
        aCreer.push({
          ...donnees,
          chambre,
          numero,
          empreinteSource,
          collecte: calculerCollecte(p.statutSource, p.dateLimite, aujourdhui),
        });
        rapport.crees++;
      } else if (existant.empreinteSource !== empreinteSource) {
        aModifier.push({ id: existant.id, data: { ...donnees, empreinteSource } });
        rapport.modifies++;
      } else {
        rapport.inchanges++;
      }
      await vider();
    });
    await vider(true);

    rapport.commissionsInconnues = [...inconnues];
    if (rapport.nbInvalides > Math.max(1, rapport.lignes * INVALIDES_MAX)) {
      throw new Error(`Pétitions ${chambre} : ${rapport.nbInvalides} lignes illisibles sur ${rapport.lignes} (${rapport.invalides.slice(0, 3).join(' ; ')})`);
    }

    // Retraits : la garde passe AVANT toute suppression.
    const retirees = existants.filter((e) => !vus.has(e.numero));
    if (retirees.length > Math.max(1, existants.length * DISPARITIONS_MAX)) {
      throw new Error(
        `Pétitions ${chambre} : ${retirees.length} pétitions absentes du fichier sur ${existants.length}, ` +
        'aucune supprimée (relevé de la source incomplet ?)',
      );
    }
    if (retirees.length > 0) {
      await db().petition.deleteMany({ where: { id: { in: retirees.map((r) => r.id) } } });
      logger.warn({ chambre, numeros: retirees.map((r) => r.numero) }, 'Pétitions retirées de la plateforme : supprimées');
    }
    rapport.retirees = retirees.length;

    // Relevés : un par pétition dont le compteur diffère du dernier relevé.
    const ids = await db().petition.findMany({ where: { chambre }, select: { id: true, numero: true } });
    const aRelever = ids
      .filter((p) => compteurs.has(p.numero) && releves.get(p.id) !== compteurs.get(p.numero))
      .map((p) => ({ petitionId: p.id, date: dateReleve, signatures: compteurs.get(p.numero)! }));
    rapport.releves = await ecrireReleves(aRelever);

    const niveau = rapport.nbInvalides > 0 || inconnues.size > 0 ? 'warn' : 'info';
    logger[niveau]({ ...rapport, invalides: rapport.invalides.slice(0, 5) }, `Pétitions ${chambre} à jour`);
    return rapport;
  } finally {
    if (temporaire) await fs.promises.rm(temporaire, { force: true });
  }
}

// =============================================================================
// 2. Parcours
// =============================================================================

interface EtapeVoulue {
  petitionId: string;
  type: TypeEtape;
  date: Date | null;
  source: 'agenda_an' | 'dossier_an' | 'plateforme';
  rattachement: 'numero' | 'titre_exact' | 'plateforme';
  cle: string;
  libelle: string;
  reunionId: string | null;
  dossierId: string | null;
}

export interface RapportParcours {
  etapes: { crees: number; modifies: number; supprimes: number; total: number };
  petitions: { modifiees: number; suivies: number };
  pages: { lues: number; echecs: number };
  /** Points d'agenda dont le numéro ne mène à aucune pétition de la même commission */
  rejetsAgenda: string[];
  /** Titres d'agenda sans pétition unique de ce titre dans la commission */
  titresNonRattaches: string[];
  /** Dossiers « Pétitions » dont le numéro ne mène à aucune pétition de la législature */
  rejetsDossiers: string[];
  /** Étapes rattachées par titre exact, pour contrôle */
  parTitre: string[];
}

interface PetitionParcours {
  id: string;
  chambre: string;
  numero: number;
  titre: string;
  commissionId: string | null;
  legislature: number | null;
  datePublication: Date;
  statutSource: string;
  dateLimite: Date | null;
  signatures: number | null;
  decisionSource: string | null;
  decisionPage: string | null;
  decisionPageDate: Date | null;
  pageLueLe: Date | null;
  collecte: string;
  etape: string | null;
  etapeDate: Date | null;
  suivie: boolean;
}

const cleEtape = (e: { petitionId: string; type: string; source: string; cle: string }) =>
  `${e.petitionId}|${e.type}|${e.source}|${e.cle}`;

/** Étapes lues dans l'agenda des commissions de l'AN. */
async function etapesAgenda(
  petitions: PetitionParcours[],
  rapport: RapportParcours,
): Promise<EtapeVoulue[]> {
  const an = petitions.filter((p) => p.chambre === 'assemblee');
  const parNumero = new Map(an.map((p) => [p.numero, p]));
  const parTitre = new Map<string, PetitionParcours[]>();
  for (const p of an) {
    if (!p.commissionId) continue;
    const cle = `${p.commissionId}|${formeComparable(p.titre)}`;
    parTitre.set(cle, [...(parTitre.get(cle) ?? []), p]);
  }

  const reunions = await db().$queryRaw<Array<{
    id: string; uid: string; date_debut: Date; commission_id: string; odj: string;
  }>>`
    SELECT r.id, r.uid, r.date_debut, r.commission_id, coalesce(r.odj_complet, r.odj_resume) AS odj
    FROM reunions r
    JOIN commissions c ON c.id = r.commission_id
    WHERE c.chambre = 'assemblee'
      AND r.etat NOT IN ('annule', 'supprime')
      AND coalesce(r.odj_complet, r.odj_resume, '') ~* 'p[ée]ti(ti)+on'
    ORDER BY r.date_debut, r.uid
  `;

  const etapes: EtapeVoulue[] = [];
  for (const r of reunions) {
    const date = jourParis(r.date_debut);
    for (const point of lireOdj(r.odj)) {
      const base = {
        type: point.type, date, source: 'agenda_an' as const, cle: r.uid,
        libelle: point.libelle, reunionId: r.id, dossierId: null,
      };
      for (const numero of point.numeros) {
        const p = parNumero.get(numero);
        // Garde de commission : un « n° » qui appartiendrait à un autre texte
        // ne tombe pas, par hasard, sur une pétition renvoyée à CETTE commission.
        // Et une commission ne traite pas une pétition qui n'existe pas encore.
        const motif = !p ? 'pétition inconnue'
          : p.commissionId !== r.commission_id ? 'autre commission'
          : p.datePublication.getTime() > date.getTime() ? 'publiée après la réunion'
          : null;
        if (!p || motif) {
          rapport.rejetsAgenda.push(`${r.uid} n° ${numero} (${motif})`);
          continue;
        }
        etapes.push({ ...base, petitionId: p.id, rattachement: 'numero' });
      }
      for (const titre of point.titres) {
        // Seules les pétitions publiées au plus tard le jour de la réunion :
        // le 17/11/2026, quatre copies de « Supprimer CNews de l'audiovisuel
        // français » (n° 7955, 7960, 7995, 8009) ont été publiées après les
        // réunions des 4 et 10/11 qui portaient sur la n° 5820.
        const candidats = (parTitre.get(`${r.commission_id}|${formeComparable(titre)}`) ?? [])
          .filter((p) => p.datePublication.getTime() <= date.getTime());
        const seul = candidats.length === 1 ? candidats[0] : undefined;
        if (!seul) {
          rapport.titresNonRattaches.push(`${r.uid} « ${titre} » (${candidats.length} pétitions)`);
          continue;
        }
        etapes.push({ ...base, petitionId: seul.id, rattachement: 'titre_exact' });
        rapport.parTitre.push(`${r.uid} → n° ${seul.numero}`);
      }
    }
  }
  return etapes;
}

/** Étapes « rapport » : les dossiers AN de la procédure « Pétitions ». */
async function etapesDossiers(petitions: PetitionParcours[], rapport: RapportParcours): Promise<EtapeVoulue[]> {
  const parNumero = new Map(petitions.filter((p) => p.chambre === 'assemblee').map((p) => [p.numero, p]));
  const dossiers = await db().dossierLegislatif.findMany({
    where: { procedureCode: '16', uid: { startsWith: 'DLR5' } },
    select: { id: true, uid: true, titre: true, legislature: true, sourceData: true },
    orderBy: { uid: 'asc' },
  });
  const etapes: EtapeVoulue[] = [];
  for (const d of dossiers) {
    const numero = numeroDuDossier(d.titre);
    const p = numero === null ? undefined : parNumero.get(numero);
    // Les numéros de la plateforme AN courent d'une législature à l'autre : la
    // législature du dossier doit être celle de la pétition.
    if (!p || p.legislature !== d.legislature) {
      rapport.rejetsDossiers.push(`${d.uid} (${numero === null ? 'sans numéro' : `n° ${numero}`})`);
      continue;
    }
    etapes.push({
      petitionId: p.id, type: 'rapport', date: dateDuDossier(d.sourceData), source: 'dossier_an',
      rattachement: 'numero', cle: d.uid, libelle: d.titre, reunionId: null, dossierId: d.id,
    });
  }
  return etapes;
}

/** Étapes données par la pétition elle-même : statut, décision du fichier ou de la page. */
function etapesPlateforme(p: PetitionParcours): EtapeVoulue[] {
  const base = { petitionId: p.id, source: 'plateforme' as const, rattachement: 'plateforme' as const, cle: '', reunionId: null, dossierId: null };
  const etapes: EtapeVoulue[] = [];
  if (p.chambre === 'assemblee') {
    if (p.statutSource === 'classee') {
      // Date : celle que la page affiche (« classée par la commission : »), que
      // le fichier recopie en date limite. Jamais une date lue dans le texte de
      // la décision : les n° 5361 et 5379, classées le 02/11/2026, citent une
      // réunion du 11/06/2025.
      etapes.push({
        ...base, type: 'classement', date: p.decisionPageDate ?? p.dateLimite,
        libelle: p.decisionPage ?? p.decisionSource ?? 'Pétition classée par la commission.',
      });
    } else if (p.decisionPage && p.statutSource !== 'expiree') {
      // La page dit ce que la commission a fait, et ce n'est pas toujours un
      // classement : la n° 1067 (archivée) « a été examinée », avec rapport.
      etapes.push({
        ...base, type: /class/i.test(p.decisionPage) ? 'classement' : 'decision',
        date: p.decisionPageDate, libelle: p.decisionPage,
      });
    } else if (p.statutSource === 'archivee' && p.decisionSource && /class/i.test(p.decisionSource)) {
      // Classée puis archivée en fin de législature, page non lue : la date
      // limite affichée est celle de l'archivage, pas du classement.
      etapes.push({ ...base, type: 'classement', date: null, libelle: p.decisionSource });
    }
  } else {
    if (p.statutSource === 'Seuil atteint') {
      etapes.push({ ...base, type: 'seuil_atteint', date: null, libelle: 'Seuil de 100 000 signatures atteint.' });
    }
    if (p.decisionPage && /Conférence des Présidents/i.test(p.decisionPage)) {
      etapes.push({ ...base, type: 'decision_conference', date: p.decisionPageDate, libelle: p.decisionPage });
    }
  }
  return etapes;
}

/** Lit la réponse officielle des pétitions suivies dont la page n'a pas été lue récemment. */
async function lirePages(
  petitions: PetitionParcours[],
  suivies: Set<string>,
  aujourdhui: Date,
  rapport: RapportParcours,
  limite?: number,
): Promise<void> {
  const seuil = aujourdhui.getTime() - RELECTURE_PAGE_JOURS * 86_400_000;
  const aLire = petitions
    .filter((p) => suivies.has(p.id) && (!p.pageLueLe || p.pageLueLe.getTime() < seuil))
    .sort((a, b) => (a.pageLueLe?.getTime() ?? 0) - (b.pageLueLe?.getTime() ?? 0))
    .slice(0, limite);

  for (const p of aLire) {
    const url = `${HOTE_PLATEFORME[p.chambre as ChambrePetition]}/initiatives/i-${p.numero}`;
    try {
      const reponse = await axios.get<string>(url, {
        timeout: 30_000,
        responseType: 'text',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        maxRedirects: 0,
        validateStatus: (s) => s === 200,
      });
      const r = lireReponseOfficielle(reponse.data, url);
      const texte = r?.texte ?? null;
      const date = texte ? r?.date ?? null : null;
      await db().petition.update({
        where: { id: p.id },
        data: { decisionPage: texte, decisionPageDate: date, pageLueLe: new Date() },
      });
      p.decisionPage = texte;
      p.decisionPageDate = date;
      rapport.pages.lues++;
    } catch (e) {
      rapport.pages.echecs++;
      logger.warn({ url, error: errorMessage(e) }, 'Pétition : page officielle illisible, décision inchangée');
    }
    await pause(PAUSE_ENTRE_PAGES_MS);
  }
}

/**
 * Recalcule le parcours de toutes les pétitions : étapes (par différence),
 * collecte, dernière étape, « suivie ». Avec `lirePages`, lit d'abord la
 * réponse officielle des pétitions suivies (une page par seconde).
 */
export async function calculerParcoursPetitions(
  options: { lirePages?: boolean; limitePages?: number; aujourdhui?: Date; dryRun?: boolean } = {},
): Promise<RapportParcours> {
  const aujourdhui = options.aujourdhui ?? new Date();
  const rapport: RapportParcours = {
    etapes: { crees: 0, modifies: 0, supprimes: 0, total: 0 },
    petitions: { modifiees: 0, suivies: 0 },
    pages: { lues: 0, echecs: 0 },
    rejetsAgenda: [], titresNonRattaches: [], rejetsDossiers: [], parTitre: [],
  };

  const petitions: PetitionParcours[] = await db().petition.findMany({
    select: {
      id: true, chambre: true, numero: true, titre: true, commissionId: true, legislature: true,
      datePublication: true, statutSource: true, dateLimite: true, signatures: true, decisionSource: true,
      decisionPage: true, decisionPageDate: true, pageLueLe: true, collecte: true,
      etape: true, etapeDate: true, suivie: true,
    },
    orderBy: [{ chambre: 'asc' }, { numero: 'asc' }],
  });

  const externes = [...(await etapesAgenda(petitions, rapport)), ...(await etapesDossiers(petitions, rapport))];
  const calculer = () => {
    const voulues = [...externes, ...petitions.flatMap(etapesPlateforme)];
    const parPetition = new Map<string, EtapeVoulue[]>();
    for (const e of voulues) parPetition.set(e.petitionId, [...(parPetition.get(e.petitionId) ?? []), e]);
    return { voulues, parPetition };
  };

  let { voulues, parPetition } = calculer();
  if (options.lirePages && !options.dryRun) {
    const suivies = new Set(petitions.filter((p) => estSuivie(p.signatures, parPetition.get(p.id) ?? [], SEUIL_SUIVIE)).map((p) => p.id));
    await lirePages(petitions, suivies, aujourdhui, rapport, options.limitePages);
    ({ voulues, parPetition } = calculer());
  }

  // Étapes, par différence. Une même étape lue deux fois (un point d'agenda
  // qui cite deux fois la pétition) n'est écrite qu'une fois : `differencier`
  // garde la première.
  const existantes = await db().petitionEtape.findMany({
    select: { id: true, petitionId: true, type: true, source: true, cle: true, date: true, rattachement: true, libelle: true, reunionId: true, dossierId: true },
  });
  const d = differencier(existantes, voulues, { existant: cleEtape, voulu: cleEtape },
    ['date', 'rattachement', 'libelle', 'reunionId', 'dossierId']);
  rapport.etapes = { crees: d.aCreer.length, modifies: d.aModifier.length, supprimes: d.aSupprimer.length, total: d.aCreer.length + d.aModifier.length + d.inchanges };

  // Champs dérivés de chaque pétition.
  const derives = petitions.map((p) => {
    const etapes = parPetition.get(p.id) ?? [];
    const derniere = derniereEtape(etapes);
    return {
      id: p.id,
      collecte: calculerCollecte(p.statutSource, p.dateLimite, aujourdhui),
      etape: derniere?.type ?? null,
      etapeDate: derniere?.date ?? null,
      suivie: estSuivie(p.signatures, etapes, SEUIL_SUIVIE),
    };
  });
  const dp = differencier(petitions, derives, { existant: (p) => p.id, voulu: (p) => p.id },
    ['collecte', 'etape', 'etapeDate', 'suivie']);
  rapport.petitions = { modifiees: dp.aModifier.length, suivies: derives.filter((p) => p.suivie).length };

  if (!options.dryRun) {
    for (const lot of tranches(d.aCreer, 500)) await db().petitionEtape.createMany({ data: lot });
    for (const { existant, voulu } of d.aModifier) {
      await db().petitionEtape.update({
        where: { id: existant.id },
        data: { date: voulu.date, rattachement: voulu.rattachement, libelle: voulu.libelle, reunionId: voulu.reunionId, dossierId: voulu.dossierId },
      });
    }
    if (d.aSupprimer.length > 0) {
      await db().petitionEtape.deleteMany({ where: { id: { in: d.aSupprimer.map((e) => e.id) } } });
    }
    for (const { voulu } of dp.aModifier) {
      const { id, ...data } = voulu;
      await db().petition.update({ where: { id }, data });
    }
  }

  const anomalies = rapport.rejetsAgenda.length + rapport.titresNonRattaches.length + rapport.rejetsDossiers.length + rapport.pages.echecs;
  logger[anomalies > 0 ? 'warn' : 'info']({ ...rapport, dryRun: !!options.dryRun }, 'Parcours des pétitions à jour');
  return rapport;
}

// =============================================================================
// 3. Rattrapage des relevés depuis les archives
// =============================================================================

export interface RapportRattrapage {
  chambre: ChambrePetition;
  archives: number;
  releves: number;
  redondantsSupprimes: number;
}

/**
 * Relit les archives hebdomadaires d'une chambre, de la plus ancienne à la
 * plus récente, et écrit un relevé à chaque changement de compteur. Seules
 * les pétitions en base sont relevées (une pétition retirée depuis ne l'est
 * pas). Puis retire les relevés qui répètent le précédent : un relevé écrit
 * avant le rattrapage peut le devenir.
 */
export async function rattraperRelevesPetitions(
  chambre: ChambrePetition,
  options: { depuis?: string } = {},
): Promise<RapportRattrapage> {
  const archives = (await listerArchives(chambre)).filter((a) => !options.depuis || a.date >= options.depuis);
  const ids = new Map(
    (await db().petition.findMany({ where: { chambre }, select: { id: true, numero: true } })).map((p) => [p.numero, p.id]),
  );
  const dernier = new Map<number, number>();
  const rapport: RapportRattrapage = { chambre, archives: archives.length, releves: 0, redondantsSupprimes: 0 };

  for (const archive of archives) {
    const chemin = path.join(os.tmpdir(), `petitions-${chambre}-${archive.date}-${randomUUID()}.csv`);
    try {
      await downloadWithRetry(archive.url, chemin, { timeoutMs: 5 * 60_000, userAgent: USER_AGENT });
      const date = new Date(`${archive.date}T00:00:00Z`);
      const aEcrire: Array<{ petitionId: string; date: Date; signatures: number }> = [];
      await lireFichierPetitions(chemin, chambre, (ligne) => {
        const numero = Number((ligne.identifiant ?? '').trim());
        const brut = (ligne.nb_votes ?? '').trim();
        const id = ids.get(numero);
        if (!id || !/^\d+(?:\.0+)?$/.test(brut)) return;
        const signatures = Number.parseInt(brut, 10);
        if (dernier.get(numero) === signatures) return;
        dernier.set(numero, signatures);
        aEcrire.push({ petitionId: id, date, signatures });
      });
      rapport.releves += await ecrireReleves(aEcrire);
      logger.info({ chambre, archive: archive.date, releves: aEcrire.length }, 'Archive de pétitions relevée');
    } finally {
      await fs.promises.rm(chemin, { force: true });
    }
  }

  rapport.redondantsSupprimes = await db().$executeRaw`
    DELETE FROM petitions_releves r
    USING (
      SELECT petition_id, date, signatures,
             lag(signatures) OVER (PARTITION BY petition_id ORDER BY date) AS precedent
      FROM petitions_releves
      WHERE petition_id IN (SELECT id FROM petitions WHERE chambre = ${chambre})
    ) x
    WHERE r.petition_id = x.petition_id AND r.date = x.date AND x.precedent = x.signatures
  `;
  logger.info({ ...rapport }, 'Relevés de pétitions rattrapés');
  return rapport;
}
