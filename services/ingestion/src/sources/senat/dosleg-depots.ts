// =============================================================================
// Sénat — projets de loi déposés au Sénat et leurs auteurs (DOSLEG)
// =============================================================================
//
// L'Assemblée ne publie que le Premier ministre comme signataire d'un projet de
// loi déposé d'abord au Sénat (247 projets ordinaires sur 247 depuis 2017). Le
// dump DOSLEG du Sénat nomme les ministres : les auteurs du texte de dépôt
// (`texte.oritxtcod = 1`, « déposé au Sénat ») sont dans `ecr`, dans l'ordre
// `ecrnumtri`, et un auteur ministre a `auteur.typautcod = 4`, avec sa fonction
// (`autfct`). Mesuré le 11/11/2026 : 305 projets de loi sur 309 et 91
// conventions sur 91 déposés depuis le 21/06/2017 nomment au moins un ministre
// autre que le Premier ministre. Voir SPEC-BILAN-MINISTRE.md, §2.
//
// Ce module ne fait que lire : le rattachement des auteurs aux postes
// ministériels est fait par le worker du bilan.

import { telechargerTablesDump, type DumpSenat, type LigneDump } from './sens-client';

export const DUMP_DOSLEG: DumpSenat = {
  url: 'https://data.senat.fr/data/dosleg/dosleg.zip',
  fichierSql: 'dosleg.sql',
  nom: 'dosleg',
};

export const TABLES_DOSLEG_DEPOTS = ['loi', 'lecture', 'lecass', 'texte', 'oritxt', 'ecr', 'auteur'] as const;

/** Types de loi (`typloicod`) déposés par le Gouvernement. */
export const TYPES_PROJET = new Set(['pjl', 'pjlo', 'pjlc', 'pjlr', 'pjlf', 'pjfs', 'pjlg', 'cvn']);

/** Origine « déposé au Sénat » d'un texte (`oritxt`). */
const ORIGINE_DEPOT_SENAT = '1';
/** Type d'auteur « ministre » (`typaut`). */
const AUTEUR_MINISTRE = '4';
/**
 * Origines de séance qui ne sont pas un examen : retrait de l'ordre du jour,
 * retrait par l'auteur, retrait par le Premier ministre.
 */
const ORIGINES_RETRAIT = new Set(['10', '15', '24']);
/** État « promulgué » d'une loi (`etaloi`). */
const ETAT_PROMULGUE = '04';

export interface AuteurMinistre {
  rang: number;
  prenom: string;
  nom: string;
  fonction: string | null;
}

export interface DepotSenat {
  /** `pjl24-661`, la fin de l'URL du dossier sur senat.fr */
  signet: string;
  typloicod: string;
  /** Titre long (`loiint`, à défaut `loitit`) : le titre court ne dit pas toujours la nature */
  titreLong: string;
  /** YYYY-MM-DD */
  dateDepot: string;
  promulgue: boolean;
  /** Une décision de séance au Sénat (texte adopté, modifié ou rejeté) */
  examine: boolean;
  /** Une adoption définitive au Sénat */
  adopteDefinitivement: boolean;
  /** Les ministres auteurs du texte de dépôt, dans l'ordre */
  ministres: AuteurMinistre[];
}

const t = (v: string | null | undefined): string => (v ?? '').trim();
const jour = (v: string | null | undefined): string | null => /^\d{4}-\d{2}-\d{2}/.exec(t(v))?.[0] ?? null;

function grouper(lignes: readonly LigneDump[] | undefined, colonne: string): Map<string, LigneDump[]> {
  const r = new Map<string, LigneDump[]>();
  for (const l of lignes ?? []) {
    const k = t(l[colonne]);
    if (!k) continue;
    const liste = r.get(k);
    if (liste) liste.push(l);
    else r.set(k, [l]);
  }
  return r;
}

/**
 * Les projets déposés au Sénat à partir de `depuis` (YYYY-MM-DD), avec leurs
 * ministres auteurs. Un projet sans texte de dépôt au Sénat (venu de
 * l'Assemblée) n'y figure pas.
 */
export function depotsSenat(tables: ReadonlyMap<string, LigneDump[]>, depuis: string): DepotSenat[] {
  const lectures = grouper(tables.get('lecture'), 'loicod');
  const lecass = grouper(tables.get('lecass'), 'lecidt');
  const textes = grouper(tables.get('texte'), 'lecassidt');
  const ecrits = grouper(tables.get('ecr'), 'texcod');
  const auteurs = new Map((tables.get('auteur') ?? []).map((a) => [t(a.autcod), a]));
  const origines = new Map((tables.get('oritxt') ?? []).map((o) => [t(o.oritxtcod), o]));

  const depots: DepotSenat[] = [];
  for (const loi of tables.get('loi') ?? []) {
    const typloicod = t(loi.typloicod);
    const signet = t(loi.signet);
    if (!TYPES_PROJET.has(typloicod) || !signet) continue;

    const textesLoi = (lectures.get(t(loi.loicod)) ?? [])
      .flatMap((le) => lecass.get(t(le.lecidt)) ?? [])
      .flatMap((la) => textes.get(t(la.lecassidt)) ?? []);
    const depot = textesLoi
      .filter((x) => t(x.oritxtcod) === ORIGINE_DEPOT_SENAT && jour(x.txtoritxtdat))
      .sort((a, b) => jour(a.txtoritxtdat)!.localeCompare(jour(b.txtoritxtdat)!) || Number(a.texcod) - Number(b.texcod))[0];
    const dateDepot = depot ? jour(depot.txtoritxtdat) : null;
    if (!depot || !dateDepot || dateDepot < depuis) continue;

    // Une décision de séance : `oriordre = 1` (adopté, modifié, rejeté…), à
    // distinguer des textes de commission (2) et des dépôts ou transmissions
    // (0). Un retrait n'est pas un examen.
    const seance = textesLoi.filter(
      (x) => t(origines.get(t(x.oritxtcod))?.oriordre) === '1' && !ORIGINES_RETRAIT.has(t(x.oritxtcod)),
    );
    const ministres = (ecrits.get(t(depot.texcod)) ?? [])
      .slice()
      .sort((a, b) => Number(a.ecrnumtri) - Number(b.ecrnumtri))
      .map((e) => auteurs.get(t(e.autcod)))
      .filter((a): a is LigneDump => !!a && t(a.typautcod) === AUTEUR_MINISTRE)
      .map((a, i) => ({ rang: i + 1, prenom: t(a.prenom), nom: t(a.nomuse), fonction: t(a.autfct) || null }));

    depots.push({
      signet,
      typloicod,
      titreLong: t(loi.loiint) || t(loi.loitit) || t(loi.loient),
      dateDepot,
      promulgue: t(loi.etaloicod) === ETAT_PROMULGUE,
      examine: seance.length > 0,
      adopteDefinitivement: seance.some((x) => t(origines.get(t(x.oritxtcod))?.oritxtado) === 'D'),
      ministres,
    });
  }
  return depots.sort((a, b) => a.dateDepot.localeCompare(b.dateDepot) || a.signet.localeCompare(b.signet));
}

/** Les projets déposés au Sénat depuis `depuis`, lus dans le dump du jour (ou `archive`). */
export async function telechargerDepotsSenat(depuis: string, options: { archive?: string } = {}): Promise<DepotSenat[]> {
  const tables = await telechargerTablesDump(DUMP_DOSLEG, TABLES_DOSLEG_DEPOTS, options);
  return depotsSenat(tables, depuis);
}
