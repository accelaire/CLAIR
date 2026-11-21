// =============================================================================
// Rattachement d'un scrutin du Sénat aux amendements que sa page cite
// =============================================================================
//
// La page d'un scrutin public du Sénat cite l'amendement mis aux voix :
// `/amendements/2013-2014/155/Amdt_I-361.html`. La SESSION y fait partie de
// l'identité : un numéro de texte n'est unique que dans sa session de dépôt.
// Le n° 155 est le PLF 2014 en 2013-2014 et le PLF 2027 en 2026-2027.
//
// Jusqu'au 21 novembre 2026, la session était lue puis jetée. Le texte n° 155
// de toutes les sessions était candidat, et l'amendement le plus récent
// l'emportait : les scrutins de novembre 2013 sur le PLF 2014 se sont reliés à
// des amendements du PLF 2027 déposés en 2026, puis leur dossier a été
// propagé aux 4 696 amendements du PLF 2027 (« Budget 2014 » sur clair.vote).
// 284 liens sur 1 082 étaient impossibles (amendement déposé après le vote).
//
// La session de l'adresse est celle du DÉPÔT du texte (`txt_ameli.sesdepid`),
// pas celle de son inscription : `ppl24-501`, déposé en 2024-2025 et examiné
// en 2025-2026, a ses amendements sous `/amendements/2024-2025/501/`, alors que
// `/amendements/2025-2026/501/` est un autre texte.
// =============================================================================

import { deposeApresLeVote } from './amendement-scrutin';

/** `2026` → `2026-2027`, le libellé des adresses senat.fr. */
export function libelleSessionSenat(annee: number): string {
  return `${annee}-${annee + 1}`;
}

/** Année d'ouverture d'un libellé `2026-2027`, ou `null` s'il n'a pas cette forme. */
export function anneeDeSessionSenat(libelle: string): number | null {
  const m = /^(\d{4})-(\d{4})$/.exec(libelle.trim());
  if (!m) return null;
  const debut = Number(m[1]);
  return Number(m[2]) === debut + 1 ? debut : null;
}

/**
 * Numéro de texte sans sa rectification : AMELI écrit « 636 rect. bis », les
 * adresses senat.fr « 636 ».
 */
export function numeroTexteDeBase(numero: string): string {
  return numero.trim().split(/\s+/)[0] ?? '';
}

/** Clé d'un texte du Sénat : session de dépôt et numéro de base. */
export function cleTexteSenat(sessionDepot: number, numeroTexte: string): string {
  return `${libelleSessionSenat(sessionDepot)}/${numeroTexteDeBase(numeroTexte)}`;
}

export interface LienAmendementSenat {
  /** `2013-2014` */
  session: string;
  texteNumero: string;
  /** Numéro de l'amendement sans rectification : `I-361`, `COM-12`, `A-1` */
  numero: string;
}

/**
 * Les amendements qu'une page de scrutin cite, chacun une fois, dans l'ordre de
 * la page. Les amendements de commission (`/amendements/commissions/…`) ne
 * passent pas en scrutin public et ne sont pas retenus.
 */
export function extraireLiensAmendementsSenat(html: string): LienAmendementSenat[] {
  const re = /href="[^"]*\/amendements\/(\d{4}-\d{4})\/(\d+)\/Amdt_([A-Z0-9-]+)\.html"/gi;
  const vus = new Set<string>();
  const liens: LienAmendementSenat[] = [];
  for (const m of html.matchAll(re)) {
    const lien = { session: m[1]!, texteNumero: m[2]!, numero: m[3]!.toUpperCase() };
    const cle = `${lien.session}/${lien.texteNumero}/${lien.numero}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    liens.push(lien);
  }
  return liens;
}

/**
 * Le numéro d'amendement stocké, rectification comprise (« 12 rect. bis »,
 * « I-361 rect. »), désigne-t-il le numéro de base cité par l'adresse ?
 */
export function memeNumeroAmendement(numeroStocke: string, numeroDeBase: string): boolean {
  const base = numeroStocke.trim().split(/\s+/)[0] ?? '';
  return base.toUpperCase() === numeroDeBase.toUpperCase();
}

export interface CandidatAmendementSenat {
  id: string;
  dateDepot: Date | null;
  dossierId: string | null;
}

/**
 * L'amendement que vise le scrutin, parmi ceux du bon texte (même session de
 * dépôt, même numéro) qui portent le numéro cité.
 *
 * Écarte l'amendement déposé après le jour du vote, et celui dont le dossier,
 * connu, n'est pas celui du scrutin. Restent parfois plusieurs lignes pour un
 * même amendement (import AMELI d'avant 2026 et CSV, cf. la dette de
 * doublons) ou plusieurs parties d'un PLF : on prend le dépôt le plus récent
 * avant le vote, puis le plus petit identifiant, pour un choix qui ne dépend
 * pas de l'ordre de la requête. `null` si rien ne convient : un lien absent
 * vaut mieux qu'un lien faux.
 */
export function choisirAmendementSenat(
  candidats: readonly CandidatAmendementSenat[],
  scrutin: { date: Date; dossierId: string | null },
): CandidatAmendementSenat | null {
  const restants = candidats.filter(
    (c) =>
      !deposeApresLeVote(c.dateDepot, scrutin.date) &&
      !(scrutin.dossierId && c.dossierId && c.dossierId !== scrutin.dossierId),
  );
  if (restants.length === 0) return null;
  return [...restants].sort((a, b) => {
    const da = a.dateDepot?.getTime() ?? -Infinity;
    const db = b.dateDepot?.getTime() ?? -Infinity;
    if (da !== db) return db - da;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0]!;
}
