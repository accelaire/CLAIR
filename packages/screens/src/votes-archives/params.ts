import type { QueryParams } from "@clair/ui";
import { parsePage } from "../scrutins-liste/params.ts";

export const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Plancher de l'historique des scrutins (première session du Sénat ingérée), comme apps/web. */
export const PREMIERE_ANNEE = 2006;

/** Scrutins par page d'archives (comme apps/web). */
export const ARCHIVES_PAR_PAGE = 50;

/** Période d'archives : une année, ou un mois (1 à 12) d'une année. */
export type PeriodeArchive = { annee: number; mois: number | null };

/** État de la page d'archives dans l'URL : la page seule (`?page=2`). */
export type VotesArchivesParams = { page: number };

export const parseVotesArchivesParams = (params: QueryParams = {}): VotesArchivesParams => ({
  page: parsePage(params.page),
});

export const votesArchivesParamsOf = (params: VotesArchivesParams) => ({
  page: params.page > 1 ? params.page : null,
});

/** Année de l'adresse (`/votes/2025`) : quatre chiffres, entre 2006 et l'année en cours. */
export const parseAnnee = (raw: string, today = new Date()): number | null => {
  if (!/^\d{4}$/.test(raw)) return null;
  const annee = Number(raw);
  return annee >= PREMIERE_ANNEE && annee <= today.getFullYear() ? annee : null;
};

/** Mois de l'adresse (`/votes/2025/03`) : deux chiffres, de 01 à 12. */
export const parseMois = (raw: string): number | null => {
  if (!/^\d{2}$/.test(raw)) return null;
  const mois = Number(raw);
  return mois >= 1 && mois <= 12 ? mois : null;
};

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/** Chemin d'une période : `/votes/2025` ou `/votes/2025/03`. */
export const archiveHref = ({ annee, mois }: PeriodeArchive) =>
  mois === null ? `/votes/${annee}` : `/votes/${annee}/${deuxChiffres(mois)}`;

/** Premier et dernier jour de la période (`YYYY-MM-DD`). */
export const bornesArchive = ({ annee, mois }: PeriodeArchive) => {
  if (mois === null) return { dateFrom: `${annee}-01-01`, dateTo: `${annee}-12-31` };
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return {
    dateFrom: `${annee}-${deuxChiffres(mois)}-01`,
    dateTo: `${annee}-${deuxChiffres(mois)}-${deuxChiffres(dernierJour)}`,
  };
};

/** Requête `/scrutins` de la période. */
export const archivesQueryOf = (periode: PeriodeArchive, params: VotesArchivesParams) => ({
  ...bornesArchive(periode),
  page: String(params.page),
  limit: String(ARCHIVES_PAR_PAGE),
});

/** « Mars 2025 » ou « 2025 ». */
export const libellePeriode = ({ annee, mois }: PeriodeArchive) =>
  mois === null ? String(annee) : `${MOIS[mois - 1] ?? ""} ${annee}`;

/** Mois précédent et suivant, bornés à l'historique et au mois en cours. */
export const moisVoisins = (annee: number, mois: number, today = new Date()) => {
  const precedent = mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
  const suivant = mois === 12 ? { annee: annee + 1, mois: 1 } : { annee, mois: mois + 1 };
  const apresAujourdhui =
    suivant.annee > today.getFullYear() ||
    (suivant.annee === today.getFullYear() && suivant.mois > today.getMonth() + 1);
  return {
    precedent: precedent.annee >= PREMIERE_ANNEE ? precedent : null,
    suivant: apresAujourdhui ? null : suivant,
  };
};
