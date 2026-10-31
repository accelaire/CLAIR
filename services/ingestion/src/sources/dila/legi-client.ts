// =============================================================================
// Client DILA — base LEGI (droit consolidé), lue pour un index minimal
// Source: https://echanges.dila.gouv.fr/OPENDATA/LEGI/ (Licence Ouverte)
// =============================================================================
//
// La DILA publie la base LEGI sous deux formes :
//  - un dump global (`Freemium_legi_global_AAAAMMJJ-HHMMSS.tar.gz`, 1,1 Go),
//    republié rarement : celui du 13/07/2025 était encore le dernier en
//    octobre 2026 ;
//  - un incrément par jour ouvré (`LEGI_AAAAMMJJ-HHMMSS.tar.gz`, quelques Mo,
//    publié vers 21 h), qui contient les fichiers ajoutés ou modifiés depuis
//    la veille et la liste de ce qui a été retiré.
//
// Chaque fichier XML décrit un objet (version de texte, article, section…), à
// un chemin qui dit où il est rangé :
//   legi/global/code_et_TNC_en_vigueur/TNC_en_vigueur/JORF/TEXT/00/00/00/76/20/
//     JORFTEXT000000762078/article/LEGI/ARTI/00/00/51/86/57/LEGIARTI000051865798.xml
// Deux fichiers de suppression accompagnent un incrément :
//  - `liste_suppression_legi.dat` : un fichier retiré par ligne. Un objet qui
//    ne fait que changer de chemin y figure aussi, et revient dans le même
//    incrément : les suppressions s'appliquent donc avant les ajouts
//    (workers/index-legi.ts) ;
//  - `liste_suppression_legi_dossier.dat` : un dossier de texte par ligne,
//    suivi de « D ». Ce sont des DÉPLACEMENTS, pas des suppressions : sur les
//    1 007 lignes publiées du 13/07/2025 au 25/10/2026, le texte réapparaît
//    chaque fois dans un autre dossier du même incrément (en vigueur → plus en
//    vigueur, le plus souvent), mais avec ses seuls fichiers modifiés. Retirer
//    le dossier aurait perdu tout le reste : 3 382 articles de l'index pour
//    le Code du travail applicable à Mayotte, déplacé le 11/06/2026 avec 10
//    articles renvoyés. Comme l'index ne
//    retient pas le dossier d'un objet, un déplacement n'y change rien : ces
//    lignes sont ignorées.
//
// Ce client ne lit que ce dont l'index a besoin : identifiants, numéros, dates,
// natures et titres. Le contenu des articles est ignoré.
// =============================================================================

import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import axios from 'axios';
import * as tarStream from 'tar-stream';
import { downloadWithRetry } from '../../utils/download.js';
import { logger } from '../../utils/logger.js';

export const URL_LEGI = 'https://echanges.dila.gouv.fr/OPENDATA/LEGI/';

const USER_AGENT = 'CLAIR-Bot/1.0 (https://github.com/clair)';

// =============================================================================
// TYPES
// =============================================================================

export interface VersionTexteLegi {
  /** LEGITEXT… */
  id: string;
  /** JORFTEXT…, ou LEGITEXT… pour un code */
  cid: string;
  nature: string;
  num: string | null;
  dateTexte: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  etat: string | null;
  titre: string;
}

export interface ArticleLegi {
  /** LEGIARTI… */
  id: string;
  /** `cid` du texte qui contient l'article */
  cid: string;
  /** Nature du texte qui contient l'article ; inconnue quand l'article ne la donne pas */
  natureTexte: string | null;
  num: string | null;
  etat: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

/** Ce que désigne un chemin de la base, d'un fichier ou d'une ligne de suppression. */
export type CheminLegi =
  | { type: 'article'; id: string; conteneur: string }
  | { type: 'version_texte'; id: string; conteneur: string }
  /** Un dossier de texte (ou de section) entier. */
  | { type: 'dossier'; conteneur: string }
  /** Structure, sections, ou chemin hors de la base : sans intérêt pour l'index. */
  | { type: 'autre' };

/** Ce qu'une ligne de `liste_suppression_legi.dat` retire de l'index. */
export type SuppressionLegi = Extract<CheminLegi, { type: 'article' | 'version_texte' }>;

export type ElementLegi =
  | { type: 'texte'; texte: VersionTexteLegi }
  | { type: 'article'; article: ArticleLegi }
  | { type: 'suppression'; chemin: SuppressionLegi };

export interface ArchivesLegi {
  /** Dumps globaux, du plus ancien au plus récent */
  globaux: string[];
  /** Incréments quotidiens, du plus ancien au plus récent */
  increments: string[];
}

// =============================================================================
// LECTURE (fonctions pures, testées)
// =============================================================================

/** Horodatage d'une archive (« 20261024-214209 »), qui ordonne globaux et incréments entre eux. */
export function horodatageArchive(nom: string): string {
  const m = /(\d{8}-\d{6})\.tar\.gz$/.exec(nom);
  if (!m) throw new Error(`Nom d'archive LEGI inattendu : ${nom}`);
  return m[1]!;
}

/** Archives listées par la page d'index du répertoire LEGI de la DILA. */
export function lireListeArchives(html: string): ArchivesLegi {
  const noms = new Set<string>();
  for (const m of html.matchAll(/href="((?:Freemium_legi_global_|LEGI_)\d{8}-\d{6}\.tar\.gz)"/g)) noms.add(m[1]!);
  const parDate = (a: string, b: string) => horodatageArchive(a).localeCompare(horodatageArchive(b));
  const tous = [...noms];
  return {
    globaux: tous.filter((n) => n.startsWith('Freemium_legi_global_')).sort(parDate),
    increments: tous.filter((n) => n.startsWith('LEGI_')).sort(parDate),
  };
}

const RE_CHEMIN =
  /legi\/global\/[^/]+\/[^/]+\/(?:JORF|LEGI)\/(?:TEXT|SCTA)\/(?:\d{2}\/){5}((?:JORF|LEGI)(?:TEXT|SCTA)\d{12})(?:\/(.+))?$/;

export function analyserCheminLegi(chemin: string): CheminLegi {
  const m = RE_CHEMIN.exec(chemin.trim().replace(/\.xml$/, ''));
  if (!m) return { type: 'autre' };
  const conteneur = m[1]!;
  const reste = m[2];
  if (reste === undefined) return { type: 'dossier', conteneur };
  const article = /^article\/LEGI\/ARTI\/(?:\d{2}\/){5}(LEGIARTI\d{12})$/.exec(reste);
  if (article) return { type: 'article', id: article[1]!, conteneur };
  const version = /^texte\/version\/(LEGITEXT\d{12})$/.exec(reste);
  if (version) return { type: 'version_texte', id: version[1]!, conteneur };
  return { type: 'autre' };
}

/**
 * Versions de textes et articles retirés par un fichier de suppression. Les
 * dossiers entiers (`liste_suppression_legi_dossier.dat`) sont des
 * déplacements et ne retirent rien (voir l'en-tête).
 */
export function lireSuppressions(contenu: string): SuppressionLegi[] {
  const out: SuppressionLegi[] = [];
  for (const ligne of contenu.split(/\r?\n/)) {
    const chemin = ligne.trim().split(/\s+/)[0];
    if (!chemin) continue;
    const c = analyserCheminLegi(chemin);
    if (c.type === 'article' || c.type === 'version_texte') out.push(c);
  }
  return out;
}

function decoderEntites(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] as string;
  });
}

/**
 * Contenu texte de la première balise `<nom>…</nom>` ; `null` si absente ou
 * vide. Une balise vide (`<NUM/>`) compte comme la première : chercher la
 * forme ouvrante seule irait chercher une homonyme plus loin dans le fichier.
 */
function balise(xml: string, nom: string): string | null {
  const m = new RegExp(`<${nom}(?:/>|>([\\s\\S]*?)</${nom}>)`).exec(xml);
  if (!m?.[1]) return null;
  const v = decoderEntites(m[1]).replace(/\s+/g, ' ').trim();
  return v || null;
}

function attribut(element: string, nom: string): string | null {
  const m = new RegExp(`\\s${nom}="([^"]*)"`).exec(element);
  const v = m ? decoderEntites(m[1]!).trim() : '';
  return v || null;
}

/** Date AAAA-MM-JJ valide, sinon `null` (le type `date` de Postgres refuserait le reste). */
export function dateLegi(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

export function lireVersionTexte(xml: string): VersionTexteLegi | null {
  const id = balise(xml, 'ID');
  const cid = balise(xml, 'CID');
  const nature = balise(xml, 'NATURE');
  const titre = balise(xml, 'TITREFULL') ?? balise(xml, 'TITRE');
  if (!id || !cid || !nature || !titre) return null;
  return {
    id,
    cid,
    nature,
    num: balise(xml, 'NUM'),
    dateTexte: dateLegi(balise(xml, 'DATE_TEXTE')),
    dateDebut: dateLegi(balise(xml, 'DATE_DEBUT')),
    dateFin: dateLegi(balise(xml, 'DATE_FIN')),
    etat: balise(xml, 'ETAT'),
    titre,
  };
}

export function lireArticle(xml: string, conteneur: string): ArticleLegi | null {
  const id = balise(xml, 'ID');
  // Le texte qui contient l'article : `<CONTEXTE><TEXTE cid="…" nature="…">`.
  // Une petite centaine d'articles du dump n'ont pas de contexte, dont les 18
  // de la Déclaration des droits de l'homme : leur texte est alors le dossier
  // qui les range.
  const texte = /<TEXTE\s[^>]*>/.exec(xml)?.[0];
  const cid = (texte && attribut(texte, 'cid')) || (/TEXT\d{12}$/.test(conteneur) ? conteneur : null);
  const natureTexte = texte ? attribut(texte, 'nature') : null;
  if (!id || !cid) return null;
  return {
    id,
    cid,
    natureTexte,
    num: balise(xml, 'NUM'),
    etat: balise(xml, 'ETAT'),
    dateDebut: dateLegi(balise(xml, 'DATE_DEBUT')),
    dateFin: dateLegi(balise(xml, 'DATE_FIN')),
  };
}

// =============================================================================
// RÉSEAU ET ARCHIVES
// =============================================================================

export async function listerArchivesLegi(): Promise<ArchivesLegi> {
  const { data } = await axios.get<string>(URL_LEGI, {
    timeout: 60_000,
    responseType: 'text',
    headers: { 'User-Agent': USER_AGENT },
  });
  const archives = lireListeArchives(data);
  if (archives.globaux.length === 0 && archives.increments.length === 0) {
    throw new Error(`Aucune archive LEGI lue sur ${URL_LEGI} : la page d'index a changé de forme ?`);
  }
  return archives;
}

/**
 * Télécharge une archive dans un dossier temporaire, puis la parcourt en flux :
 * `surElement` reçoit chaque version de texte, article et suppression, dans
 * l'ordre de l'archive, et peut être asynchrone (le parcours l'attend, ce qui
 * borne la mémoire sur le dump global). Le fichier est supprimé à la fin.
 */
export async function parcourirArchiveLegi(
  nom: string,
  surElement: (e: ElementLegi) => Promise<void> | void,
): Promise<{ fichiers: number; octets: number }> {
  const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clair-legi-'));
  const fichier = path.join(dossier, nom);
  try {
    const { bytes } = await downloadWithRetry(URL_LEGI + nom, fichier, {
      // Le dump global fait 1,1 Go.
      timeoutMs: 3_600_000,
      accept: 'application/gzip, application/x-gzip, application/octet-stream',
    });
    logger.debug({ nom, octets: bytes }, 'Archive LEGI téléchargée');
    const fichiers = await lireFichierArchiveLegi(fichier, surElement);
    return { fichiers, octets: bytes };
  } finally {
    await fs.promises.rm(dossier, { recursive: true, force: true });
  }
}

/** Parcourt une archive LEGI (`.tar.gz`) déjà sur le disque ; renvoie le nombre de fichiers lus. */
export async function lireFichierArchiveLegi(
  fichier: string,
  surElement: (e: ElementLegi) => Promise<void> | void,
): Promise<number> {
  const extraction = tarStream.extract();
  const flux = pipeline(fs.createReadStream(fichier), zlib.createGunzip(), extraction);
  // Une erreur du flux remonte aussi par la boucle ci-dessous ; la promesse
  // est attendue après, il ne faut pas qu'elle soit signalée comme orpheline.
  flux.catch(() => undefined);

  let fichiers = 0;
  for await (const entree of extraction) {
    const nomEntree = entree.header.name;
    if (entree.header.type !== 'file') {
      entree.resume();
      continue;
    }
    fichiers++;
    if (/liste_suppression_legi\.dat$/.test(nomEntree)) {
      for (const chemin of lireSuppressions(await lireEntree(entree))) {
        await surElement({ type: 'suppression', chemin });
      }
      continue;
    }
    const chemin = analyserCheminLegi(nomEntree);
    if (chemin.type === 'article') {
      const article = lireArticle(await lireEntree(entree), chemin.conteneur);
      if (article) await surElement({ type: 'article', article });
      else logger.warn({ fichier: nomEntree }, 'Article LEGI illisible, ignoré');
    } else if (chemin.type === 'version_texte') {
      const texte = lireVersionTexte(await lireEntree(entree));
      if (texte) await surElement({ type: 'texte', texte });
      else logger.warn({ fichier: nomEntree }, 'Version de texte LEGI illisible, ignorée');
    } else {
      entree.resume();
    }
  }
  await flux;
  return fichiers;
}

async function lireEntree(entree: AsyncIterable<Buffer>): Promise<string> {
  const morceaux: Buffer[] = [];
  for await (const m of entree) morceaux.push(m);
  return Buffer.concat(morceaux).toString('utf8');
}
