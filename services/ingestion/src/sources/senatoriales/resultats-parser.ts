// =============================================================================
// Lecture des pages du site de résultats du ministère de l'Intérieur
// =============================================================================
//
// Le soir du scrutin, la seule source des résultats est le site
// `resultats-elections.interieur.gouv.fr/senatoriales2026/` : du HTML statique,
// régénéré par le ministère au fil de la soirée, sans export CSV ni JSON. Le
// fichier XLSX de data.gouv n'arrive que deux à quatre jours plus tard.
//
// Le générateur est le même d'une élection à l'autre (sénatoriales 2023,
// législatives 2024, municipales 2026). Les tests tournent sur des pages
// archivées de 2023. Pour tenir face à une retouche de gabarit, rien n'est lu
// par position :
//
//   — un tableau est reconnu par sa légende (« Résultats au 1er tour »,
//     « Rappel des résultats au 1er tour », « Mentions 2nd tour ») ;
//   — une colonne est reconnue par son en-tête (« Voix », « % Exprimés »,
//     « Sièges », « Elu(e) ») ;
//   — une ligne de participation est reconnue par son libellé (« Inscrits »).
//
// Une page sans tableau de résultats n'est pas une erreur : c'est une
// circonscription dont le dépouillement n'est pas publié. Le module rend alors
// une liste de tours vide, et c'est à l'appelant de ne rien écrire.
// =============================================================================

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export interface LigneResultat {
  /** Libellé de la liste, ou « Prénom NOM » du candidat, civilité retirée. */
  libelle: string;
  /** « M. » ou « Mme » au majoritaire, `null` au proportionnel. */
  civilite: string | null;
  nuance: string | null;
  /**
   * Numéro de dépôt, lu dans le lien `rappel_candidature/<tour>/<n>.html` que
   * porte chaque liste au proportionnel. C'est la clé stable du fichier de
   * candidatures : elle évite tout rapprochement par libellé. Absent au
   * majoritaire, où les lignes ne portent pas de lien.
   */
  numeroDepot: number | null;
  voix: number;
  pctInscrits: number | null;
  pctExprimes: number | null;
  /** Sièges obtenus, au proportionnel. */
  sieges: number | null;
  /** Élu à ce tour, au majoritaire. */
  elu: boolean | null;
}

export interface Participation {
  inscrits: number;
  abstentions: number;
  votants: number;
  blancs: number;
  nuls: number;
  exprimes: number;
}

export interface TourPublie {
  tour: 1 | 2;
  lignes: LigneResultat[];
  participation: Participation;
}

export interface PageCirconscription {
  siegesAPourvoir: number | null;
  /** Tours dont les résultats sont publiés, dans l'ordre. Vide avant publication. */
  tours: TourPublie[];
}

export interface EntreeIndex {
  /** Code tel que le ministère l'écrit : `38`, `2A`, `975`, `ZZ`. */
  codeSource: string;
  libelle: string;
  /** URL absolue de la page de la circonscription. */
  url: string;
}

/** Minuscules sans accents ni ponctuation, pour comparer des libellés. */
export function normaliserTexte(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%()]+/g, ' ')
    .trim();
}

function texte($: cheerio.CheerioAPI, noeud: AnyNode): string {
  return $(noeud).text().replace(/\s+/g, ' ').trim();
}

/**
 * Nombre à la française : « 1 215 », « 3 124 » avec espace fine insécable.
 * Rend `null` sur une cellule vide, et lève sur une cellule illisible : un
 * chiffre mal lu ne doit jamais devenir un zéro publié.
 */
export function lireEntier(valeur: string): number | null {
  const propre = valeur.replace(/[\s\u00a0\u202f]/g, '');
  if (propre === '') return null;
  if (!/^\d+$/.test(propre)) throw new Error(`Nombre illisible : « ${valeur} »`);
  return Number(propre);
}

export function lireDecimal(valeur: string): number | null {
  const propre = valeur.replace(/[\s\u00a0\u202f%]/g, '').replace(',', '.');
  if (propre === '') return null;
  if (!/^\d+(\.\d+)?$/.test(propre)) throw new Error(`Pourcentage illisible : « ${valeur} »`);
  return Number(propre);
}

/** Tour désigné par une légende : « au 1er tour », « 2nd tour ». `null` si aucun. */
function tourDeLegende(legende: string): 1 | 2 | null {
  const normalisee = normaliserTexte(legende);
  if (/\b1\s*(er)?\s*tour\b/.test(normalisee)) return 1;
  if (/\b2\s*(nd|e|eme)?\s*tour\b/.test(normalisee)) return 2;
  return null;
}

type Colonne = 'libelle' | 'nuance' | 'voix' | 'pctInscrits' | 'pctExprimes' | 'sieges' | 'elu';

function colonneDEntete(entete: string): Colonne | null {
  const e = normaliserTexte(entete);
  if (e.startsWith('liste des candidat') || e === 'candidat' || e === 'liste') return 'libelle';
  if (e === 'nuance') return 'nuance';
  if (e === 'voix') return 'voix';
  if (e.includes('inscrits')) return 'pctInscrits';
  if (e.includes('exprimes')) return 'pctExprimes';
  if (e.startsWith('siege')) return 'sieges';
  if (e.startsWith('elu')) return 'elu';
  return null;
}

const CIVILITE = /^(M\.|Mme|Mlle)\s+/;

function lireTableauResultats(
  $: cheerio.CheerioAPI,
  table: AnyNode
): LigneResultat[] {
  const entetes = $(table)
    .find('thead th, thead td')
    .toArray()
    .map((th) => colonneDEntete(texte($, th)));

  if (!entetes.includes('libelle') || !entetes.includes('voix')) {
    throw new Error(`Tableau de résultats sans colonne « liste » ou « voix » : ${entetes.join(', ')}`);
  }

  return $(table)
    .find('tbody tr')
    .toArray()
    .map((tr) => {
      const cellules = $(tr).find('td').toArray();
      const valeur = (colonne: Colonne): string => {
        const index = entetes.indexOf(colonne);
        return index >= 0 && cellules[index] ? texte($, cellules[index]) : '';
      };

      const brut = valeur('libelle');
      const civilite = brut.match(CIVILITE)?.[1] ?? null;
      const libelle = brut.replace(CIVILITE, '').trim();

      // Le lien est sur la cellule du libellé ; le `onclick` de la ligne porte
      // la même adresse, on s'en sert en secours.
      const lien =
        $(tr).find('a[href*="rappel_candidature"]').attr('href') ??
        $(tr).attr('onclick') ??
        '';
      const depot = lien.match(/rappel_candidature\/\d+\/(\d+)\.html/);

      const voix = lireEntier(valeur('voix'));
      if (voix === null) throw new Error(`Voix absentes pour « ${libelle} »`);

      const sieges = entetes.includes('sieges') ? lireEntier(valeur('sieges')) : null;
      const eluBrut = normaliserTexte(valeur('elu'));
      const elu = entetes.includes('elu') ? eluBrut === 'oui' : null;

      return {
        libelle,
        civilite,
        nuance: valeur('nuance') || null,
        numeroDepot: depot ? Number(depot[1]) : null,
        voix,
        pctInscrits: lireDecimal(valeur('pctInscrits')),
        pctExprimes: lireDecimal(valeur('pctExprimes')),
        sieges,
        elu,
      };
    });
}

const LIBELLES_PARTICIPATION: Record<string, keyof Participation> = {
  inscrits: 'inscrits',
  abstentions: 'abstentions',
  votants: 'votants',
  blancs: 'blancs',
  nuls: 'nuls',
  exprimes: 'exprimes',
};

function lireTableauMentions($: cheerio.CheerioAPI, table: AnyNode): Participation {
  const lu: Partial<Participation> = {};
  for (const tr of $(table).find('tbody tr').toArray()) {
    const [libelle, valeur] = $(tr).find('td, th').toArray();
    if (!libelle || !valeur) continue;
    const cle = LIBELLES_PARTICIPATION[normaliserTexte(texte($, libelle))];
    if (!cle) continue;
    const nombre = lireEntier(texte($, valeur));
    if (nombre !== null) lu[cle] = nombre;
  }

  for (const cle of Object.values(LIBELLES_PARTICIPATION)) {
    if (lu[cle] === undefined) throw new Error(`Ligne « ${cle} » absente du tableau de participation`);
  }
  return lu as Participation;
}

/**
 * Lit la page d'une circonscription.
 *
 * Lève si un tableau reconnu est illisible : mieux vaut ne rien publier pour
 * une circonscription que d'y publier un chiffre faux. Une page sans tableau de
 * résultats rend `tours: []`.
 */
export function analyserPageCirconscription(html: string): PageCirconscription {
  const $ = cheerio.load(html);

  const sieges = $('h1, h2, h3, h4, p')
    .toArray()
    .map((n) => texte($, n).match(/Si[eè]ges\s+à\s+pourvoir\s*:\s*(\d+)/i))
    .find((m) => m !== null);

  const resultats = new Map<1 | 2, LigneResultat[]>();
  const mentions = new Map<1 | 2, Participation>();

  for (const table of $('table').toArray()) {
    const legende = texte($, $(table).find('caption').get(0) ?? table);
    const tour = tourDeLegende(legende);
    if (tour === null) continue;

    const normalisee = normaliserTexte(legende);
    if (normalisee.startsWith('mentions')) {
      mentions.set(tour, lireTableauMentions($, table));
    } else if (normalisee.includes('resultats')) {
      resultats.set(tour, lireTableauResultats($, table));
    }
  }

  const tours: TourPublie[] = [];
  for (const tour of [1, 2] as const) {
    const lignes = resultats.get(tour);
    if (!lignes) continue;
    const participation = mentions.get(tour);
    if (!participation) {
      throw new Error(`Résultats du tour ${tour} publiés sans tableau de participation`);
    }
    tours.push({ tour, lignes, participation });
  }

  return {
    siegesAPourvoir: sieges ? Number(sieges[1]) : null,
    tours,
  };
}

/**
 * Lit le sélecteur de départements de l'accueil.
 *
 * Le code est pris dans le libellé (« 38 - Isère », « ZZ - Français établis
 * hors de France »), et l'URL dans la valeur de l'option, résolue contre
 * l'adresse de l'accueil.
 */
export function analyserIndex(html: string, urlAccueil: string): EntreeIndex[] {
  const $ = cheerio.load(html);
  const entrees: EntreeIndex[] = [];
  const vus = new Set<string>();

  for (const option of $('option[value*="ensemble_geographique"]').toArray()) {
    const valeur = $(option).attr('value') ?? '';
    const libelleBrut = texte($, option);
    const code = libelleBrut.match(/^([0-9]{1,3}|2A|2B|Z[A-Z])\s*-\s*/i);
    if (!code) continue;

    const codeSource = (code[1] ?? '').toUpperCase();
    if (vus.has(codeSource)) continue;
    vus.add(codeSource);

    entrees.push({
      codeSource,
      // « 40 - Landes - Pourvu T1 » : l'état est répété dans le libellé.
      libelle: libelleBrut.slice(code[0].length).replace(/\s*-\s*Pourvu.*$/i, '').trim(),
      url: new URL(valeur, urlAccueil).toString(),
    });
  }
  return entrees;
}

/**
 * Codes alphabétiques de l'outre-mer et de l'étranger.
 *
 * Le site de 2023 écrit l'outre-mer en chiffres (`975`, `988`) et l'étranger
 * `ZZ`, mais le fichier de résultats de 2020 codait l'outre-mer `ZC`, `ZP`…
 * Les deux conventions coexistent chez le même producteur : on accepte les deux.
 */
const CODES_ALPHABETIQUES: Record<string, string> = {
  ZZ: '997',
  ZC: '973',
  ZS: '975',
  ZY: '977',
  ZT: '978',
  ZW: '986',
  ZP: '987',
  ZN: '988',
};

/**
 * Code du ministère → code de circonscription chez nous : départements à un
 * chiffre écrits sans zéro (`1`), codes alphabétiques de l'outre-mer et de
 * l'étranger.
 */
export function codeCirconscription(codeSource: string): string {
  const code = codeSource.trim().toUpperCase();
  if (CODES_ALPHABETIQUES[code]) return CODES_ALPHABETIQUES[code];
  if (/^\d$/.test(code)) return `0${code}`;
  return code;
}
