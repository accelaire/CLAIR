// =============================================================================
// Résultats des sénatoriales, le soir du scrutin
// =============================================================================
//
// Lit les pages du site de résultats du ministère de l'Intérieur, les rattache
// aux unités de vote du fichier de candidatures, contrôle leur cohérence, puis
// écrit. Conçu pour être relancé toutes les cinq minutes pendant la soirée :
// chaque passage relit tout et n'écrit que ce qui est publié.
//
// Règles de rigueur :
//
//   — une circonscription dont un contrôle échoue n'est PAS écrite : elle reste
//     « résultats attendus » sur le site plutôt que d'afficher un chiffre faux,
//     et l'anomalie remonte dans le rapport (code de sortie non nul) ;
//   — le rattachement se fait par numéro de dépôt au proportionnel, par nom au
//     majoritaire, et JAMAIS par approximation : une ligne sans correspondance
//     est écrite sous un identifiant à part, avec son libellé source, et signalée ;
//   — une correction du ministère (ligne retirée, chiffre modifié) est reprise
//     telle quelle au passage suivant : on remplace le tour, on n'accumule pas.
// =============================================================================

import axios from 'axios';
import type { PrismaClient } from '@prisma/client';

import { logger } from '../../utils/logger';
import { errorMessage } from '../../utils/errors';
import {
  analyserIndex,
  analyserPageCirconscription,
  codeCirconscription,
  normaliserTexte,
} from './resultats-parser';
import type { LigneResultat, PageCirconscription, TourPublie } from './resultats-parser';

export const URL_RESULTATS_2026 =
  'https://www.resultats-elections.interieur.gouv.fr/senatoriales2026/';

const USER_AGENT = 'Mozilla/5.0 (compatible; CLAIR.vote/1.0; +https://clair.vote)';
const DELAI_ENTRE_PAGES_MS = 250;
const TIMEOUT_MS = 20_000;

/**
 * Code de région INSEE de chaque département, pour reconstruire l'URL
 * `ensemble_geographique/<région>/<département>/index.html` si l'accueil est
 * illisible. En temps normal, les URL viennent de l'accueil : cette table
 * n'est qu'un secours.
 */
const REGION_PAR_DEPARTEMENT: Record<string, string> = Object.fromEntries(
  (
    [
      ['11', ['75', '77', '78', '91', '92', '93', '94', '95']],
      ['24', ['18', '28', '36', '37', '41', '45']],
      ['27', ['21', '25', '39', '58', '70', '71', '89', '90']],
      ['28', ['14', '27', '50', '61', '76']],
      ['32', ['02', '59', '60', '62', '80']],
      ['44', ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88']],
      ['52', ['44', '49', '53', '72', '85']],
      ['53', ['22', '29', '35', '56']],
      ['75', ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87']],
      ['76', ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82']],
      ['84', ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74']],
      ['93', ['04', '05', '06', '13', '83', '84']],
      ['94', ['2A', '2B']],
      ['01', ['971']],
      ['02', ['972']],
      ['03', ['973']],
      ['04', ['974']],
      ['06', ['976']],
    ] as const
  ).flatMap(([region, departements]) => departements.map((d) => [d, region]))
);

/** URL de secours d'une circonscription, sans passer par l'accueil. */
export function urlDeSecours(base: string, code: string): string {
  const region = REGION_PAR_DEPARTEMENT[code];
  const segment = code === '997' ? 'ZZ' : code;
  const chemin = region
    ? `ensemble_geographique/${region}/${segment}/index.html`
    : `ensemble_geographique/${segment}/index.html`;
  return new URL(chemin, base).toString();
}

export interface OptionsResultats {
  scrutin: string;
  baseUrl: string;
  /** Restreint la lecture à ces codes de circonscription. */
  departements?: string[];
  /** Lit et contrôle sans rien écrire. */
  simulation?: boolean;
  /** Pour les tests : lecteur de page injecté. */
  lirePage?: (url: string) => Promise<string | null>;
  /** Heure d'écriture ; seulement pour rejouer une soirée simulée. */
  maintenant?: Date;
}

export interface EtatCirconscription {
  code: string;
  tours: number[];
  anomalies: string[];
  ecrit: boolean;
}

export interface RapportResultats {
  scrutin: string;
  circonscriptions: number;
  avecResultats: number;
  sansResultats: number;
  inaccessibles: string[];
  anomalies: { code: string; message: string }[];
  etats: EtatCirconscription[];
  simulation: boolean;
}

/** Unité de vote telle que la connaît le fichier de candidatures. */
export interface UniteConnue {
  sourceUid: string;
  modeScrutin: string;
  numeroDepot: number | null;
  libelle: string | null;
  nuance: string | null;
  titulaire: { nom: string; prenom: string } | null;
}

async function lirePageHttp(url: string): Promise<string | null> {
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const reponse = await axios.get<string>(url, {
        timeout: TIMEOUT_MS,
        responseType: 'text',
        headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' },
        validateStatus: (statut) => statut === 200 || statut === 404,
      });
      return reponse.status === 404 ? null : reponse.data;
    } catch (erreur) {
      if (essai === 2) throw erreur;
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
  return null;
}

/** Jetons d'un nom propre, sans accents, tirets ni casse : « Anne-Marie NÉDÉLEC » → [anne, marie, nedelec]. */
function jetons(valeur: string): string[] {
  return normaliserTexte(valeur.replace(/-/g, ' '))
    .split(' ')
    .filter(Boolean)
    .sort();
}

/**
 * Unité de vote correspondant à une ligne de résultat, ou `null`.
 *
 * Proportionnel : le libellé exact normalisé d'abord. Le numéro de dépôt du
 * lien `rappel_candidature` ne sert qu'en second, et seulement si la nuance
 * concorde : rien ne garantit que le site de résultats numérote les listes
 * comme le fichier de candidatures (le fichier 2023 ne publiait pas ce numéro
 * au proportionnel, on n'a donc pas pu le vérifier), et une erreur de
 * numérotation attribuerait des voix à la mauvaise liste sans aucun bruit.
 *
 * Majoritaire : prénom et nom du titulaire, à jetons près (ordre, accents,
 * tirets) ; puis le seul nom de famille s'il est unique dans la circonscription.
 * Rien d'autre : pas de distance d'édition, pas de « meilleure correspondance ».
 */
export function rattacherLigne(
  ligne: LigneResultat,
  unites: UniteConnue[]
): UniteConnue | null {
  const libelle = normaliserTexte(ligne.libelle);
  const parLibelle = unites.filter((u) => u.libelle && normaliserTexte(u.libelle) === libelle);
  if (parLibelle.length === 1) return parLibelle[0] ?? null;

  if (ligne.numeroDepot !== null) {
    const parDepot = unites.filter(
      (u) =>
        u.numeroDepot === ligne.numeroDepot &&
        (u.nuance ?? '').toUpperCase() === (ligne.nuance ?? '').trim().toUpperCase()
    );
    if (parDepot.length === 1) return parDepot[0] ?? null;
  }

  const jetonsLigne = jetons(ligne.libelle).join(' ');
  const parNomComplet = unites.filter(
    (u) => u.titulaire && jetons(`${u.titulaire.prenom} ${u.titulaire.nom}`).join(' ') === jetonsLigne
  );
  if (parNomComplet.length === 1) return parNomComplet[0] ?? null;

  const ensembleLigne = new Set(jetons(ligne.libelle));
  const parNom = unites.filter(
    (u) => u.titulaire && jetons(u.titulaire.nom).every((j) => ensembleLigne.has(j))
  );
  if (parNom.length === 1) return parNom[0] ?? null;

  return null;
}

/**
 * Contrôles de cohérence d'un tour publié. Rend la liste des anomalies ; vide
 * si le tour peut être écrit.
 */
export function controlerTour(
  tour: TourPublie,
  modeScrutin: 'proportionnel' | 'majoritaire',
  siegesAPourvoir: number
): string[] {
  const anomalies: string[] = [];
  const p = tour.participation;
  const sommeVoix = tour.lignes.reduce((total, l) => total + l.voix, 0);

  if (p.votants !== p.inscrits - p.abstentions) {
    anomalies.push(`tour ${tour.tour} : votants ${p.votants} ≠ inscrits ${p.inscrits} − abstentions ${p.abstentions}`);
  }
  if (p.exprimes !== p.votants - p.blancs - p.nuls) {
    anomalies.push(`tour ${tour.tour} : exprimés ${p.exprimes} ≠ votants − blancs − nuls`);
  }
  if (tour.lignes.length === 0) anomalies.push(`tour ${tour.tour} : aucune ligne`);

  if (modeScrutin === 'proportionnel') {
    // Un bulletin, une liste : les voix des listes sont exactement les exprimés.
    if (sommeVoix !== p.exprimes) {
      anomalies.push(`somme des voix ${sommeVoix} ≠ exprimés ${p.exprimes}`);
    }
    const sieges = tour.lignes.reduce((total, l) => total + (l.sieges ?? 0), 0);
    if (sieges !== siegesAPourvoir) {
      anomalies.push(`${sieges} sièges attribués pour ${siegesAPourvoir} à pourvoir`);
    }
  } else {
    // Scrutin plurinominal : un bulletin porte jusqu'à autant de noms que de
    // sièges. La somme des voix peut donc dépasser les exprimés, jamais leur
    // multiple par le nombre de sièges.
    if (sommeVoix > p.exprimes * siegesAPourvoir) {
      anomalies.push(`somme des voix ${sommeVoix} > exprimés × sièges (${p.exprimes * siegesAPourvoir})`);
    }
    if (tour.lignes.some((l) => l.elu === null)) {
      anomalies.push(`tour ${tour.tour} : colonne « élu » absente`);
    }
  }
  return anomalies;
}

/** Contrôles qui portent sur la circonscription entière, tous tours confondus. */
export function controlerCirconscription(
  page: PageCirconscription,
  modeScrutin: 'proportionnel' | 'majoritaire',
  siegesAPourvoir: number
): string[] {
  const anomalies = page.tours.flatMap((t) => controlerTour(t, modeScrutin, siegesAPourvoir));

  if (page.siegesAPourvoir !== null && page.siegesAPourvoir !== siegesAPourvoir) {
    anomalies.push(`la page annonce ${page.siegesAPourvoir} sièges, nous en attendons ${siegesAPourvoir}`);
  }
  if (modeScrutin === 'proportionnel' && page.tours.some((t) => t.tour === 2)) {
    anomalies.push('un 2nd tour publié au scrutin proportionnel');
  }
  if (modeScrutin === 'majoritaire') {
    const elus = page.tours.reduce((total, t) => total + t.lignes.filter((l) => l.elu).length, 0);
    if (elus > siegesAPourvoir) anomalies.push(`${elus} élus pour ${siegesAPourvoir} sièges`);
    if (page.tours.some((t) => t.tour === 2) && elus !== siegesAPourvoir) {
      anomalies.push(`2nd tour publié mais ${elus} élus pour ${siegesAPourvoir} sièges`);
    }
  }
  return anomalies;
}

interface Circonscription {
  id: string;
  code: string;
  modeScrutin: 'proportionnel' | 'majoritaire';
  siegesAPourvoir: number;
  unites: UniteConnue[];
}

/**
 * Circonscriptions du scrutin, avec leurs unités de vote et leur nombre de
 * sièges.
 *
 * Le nombre de sièges est celui des mandats sortants de la série, la même
 * source que la page publique : c'est lui qui sert de référence aux contrôles.
 */
async function chargerCirconscriptions(
  prisma: PrismaClient,
  scrutin: string
): Promise<Circonscription[]> {
  const listes = await prisma.candidatureListe.findMany({
    where: { scrutin },
    select: {
      sourceUid: true,
      modeScrutin: true,
      numeroDepot: true,
      libelle: true,
      nuance: true,
      circonscription: { select: { id: true, departement: true } },
      candidatures: {
        where: { role: 'titulaire', ordre: 1 },
        select: { nom: true, prenom: true },
      },
    },
  });

  const parCode = new Map<string, Circonscription>();
  for (const liste of listes) {
    const code = liste.circonscription.departement;
    let circo = parCode.get(code);
    if (!circo) {
      circo = {
        id: liste.circonscription.id,
        code,
        modeScrutin: liste.modeScrutin === 'proportionnel' ? 'proportionnel' : 'majoritaire',
        siegesAPourvoir: 0,
        unites: [],
      };
      parCode.set(code, circo);
    }
    circo.unites.push({
      sourceUid: liste.sourceUid,
      modeScrutin: liste.modeScrutin,
      numeroDepot: liste.numeroDepot,
      libelle: liste.libelle,
      nuance: liste.nuance,
      titulaire: liste.candidatures[0] ?? null,
    });
  }

  // Sièges à pourvoir = mandats de la série 2 ouverts la veille du scrutin,
  // comme sur la page publique.
  const sieges = await prisma.$queryRaw<{ departement: string; n: bigint }[]>`
    SELECT c.departement, COUNT(*)::bigint AS n
    FROM mandats_parlementaires m
    JOIN circonscriptions c ON c.id = m.circonscription_id
    WHERE m.chambre = 'senat' AND m.serie = '2' AND m.mandature = 2020
      AND m.date_debut <= '2026-09-26' AND (m.date_fin IS NULL OR m.date_fin >= '2026-09-26')
    GROUP BY c.departement
  `;
  for (const ligne of sieges) {
    const circo = parCode.get(ligne.departement);
    if (circo) circo.siegesAPourvoir = Number(ligne.n);
  }

  return [...parCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function slug(valeur: string): string {
  return normaliserTexte(valeur).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function ecrireCirconscription(
  prisma: PrismaClient,
  scrutin: string,
  circo: Circonscription,
  page: PageCirconscription,
  url: string,
  maintenant: Date
): Promise<string[]> {
  const nonRattachees: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const tour of page.tours) {
      await tx.resultatTour.upsert({
        where: {
          scrutin_circonscriptionId_tour: { scrutin, circonscriptionId: circo.id, tour: tour.tour },
        },
        create: {
          scrutin,
          circonscriptionId: circo.id,
          tour: tour.tour,
          ...tour.participation,
          sourceUrl: url,
          publieA: maintenant,
          verifieA: maintenant,
        },
        // `publieA` n'est jamais réécrit : c'est l'heure à laquelle le tour est
        // apparu, celle qu'on affiche.
        update: { ...tour.participation, sourceUrl: url, verifieA: maintenant },
      });

      const uids: string[] = [];
      for (const ligne of tour.lignes) {
        const unite = rattacherLigne(ligne, circo.unites);
        const listeSourceUid =
          unite?.sourceUid ?? `${scrutin}:${circo.code}:x:${slug(ligne.libelle)}`;
        if (!unite) nonRattachees.push(`tour ${tour.tour} : « ${ligne.libelle} »`);
        uids.push(listeSourceUid);

        const donnees = {
          voix: ligne.voix,
          pctInscrits: ligne.pctInscrits,
          pctExprimes: ligne.pctExprimes,
          sieges: circo.modeScrutin === 'proportionnel' ? ligne.sieges : null,
          elu: circo.modeScrutin === 'majoritaire' ? ligne.elu : null,
          libelleSource: ligne.libelle,
          nuanceSource: ligne.nuance,
        };
        await tx.resultatListe.upsert({
          where: { scrutin_listeSourceUid_tour: { scrutin, listeSourceUid, tour: tour.tour } },
          create: { scrutin, circonscriptionId: circo.id, tour: tour.tour, listeSourceUid, ...donnees },
          update: donnees,
        });
      }

      // Une ligne retirée par le ministère disparaît aussi chez nous.
      await tx.resultatListe.deleteMany({
        where: {
          scrutin,
          circonscriptionId: circo.id,
          tour: tour.tour,
          listeSourceUid: { notIn: uids },
        },
      });
    }
  });

  return nonRattachees;
}

export async function synchroniserResultats(
  prisma: PrismaClient,
  options: OptionsResultats
): Promise<RapportResultats> {
  const lire = options.lirePage ?? lirePageHttp;
  const maintenant = options.maintenant ?? new Date();
  const circonscriptions = (await chargerCirconscriptions(prisma, options.scrutin)).filter(
    (c) => !options.departements || options.departements.includes(c.code)
  );

  // Les URL viennent de l'accueil ; la table de régions n'est qu'un secours.
  const urlAccueil = new URL('index.html', options.baseUrl).toString();
  const urls = new Map<string, string>();
  try {
    const accueil = await lire(urlAccueil);
    if (accueil) {
      for (const entree of analyserIndex(accueil, urlAccueil)) {
        urls.set(codeCirconscription(entree.codeSource), entree.url);
      }
    }
  } catch (erreur) {
    logger.warn({ error: errorMessage(erreur) }, 'Accueil des résultats illisible, URL de secours');
  }

  const rapport: RapportResultats = {
    scrutin: options.scrutin,
    circonscriptions: circonscriptions.length,
    avecResultats: 0,
    sansResultats: 0,
    inaccessibles: [],
    anomalies: [],
    etats: [],
    simulation: options.simulation ?? false,
  };

  for (const circo of circonscriptions) {
    const url = urls.get(circo.code) ?? urlDeSecours(options.baseUrl, circo.code);
    const etat: EtatCirconscription = { code: circo.code, tours: [], anomalies: [], ecrit: false };
    rapport.etats.push(etat);

    let page: PageCirconscription;
    try {
      const html = await lire(url);
      if (html === null) {
        rapport.inaccessibles.push(circo.code);
        continue;
      }
      page = analyserPageCirconscription(html);
    } catch (erreur) {
      const message = `page illisible : ${errorMessage(erreur)}`;
      etat.anomalies.push(message);
      rapport.anomalies.push({ code: circo.code, message });
      continue;
    } finally {
      if (!options.lirePage) await new Promise((r) => setTimeout(r, DELAI_ENTRE_PAGES_MS));
    }

    etat.tours = page.tours.map((t) => t.tour);
    if (page.tours.length === 0) {
      rapport.sansResultats++;
      continue;
    }
    rapport.avecResultats++;

    etat.anomalies.push(...controlerCirconscription(page, circo.modeScrutin, circo.siegesAPourvoir));
    if (etat.anomalies.length > 0) {
      for (const message of etat.anomalies) rapport.anomalies.push({ code: circo.code, message });
      continue;
    }

    if (options.simulation) continue;

    const nonRattachees = await ecrireCirconscription(
      prisma,
      options.scrutin,
      circo,
      page,
      url,
      maintenant
    );
    etat.ecrit = true;
    for (const ligne of nonRattachees) {
      // Écrite quand même, sous son libellé source : le chiffre est juste, seul
      // le lien vers nos candidatures manque. Mais ça se corrige.
      rapport.anomalies.push({ code: circo.code, message: `ligne non rattachée, ${ligne}` });
    }
  }

  return rapport;
}
