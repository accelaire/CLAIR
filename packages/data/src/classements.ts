import type { Chambre } from "./common.ts";

/**
 * Données des classements, telles que les renvoie l'API (apps/api, modules groupes et
 * parlementaires). Relevé sur l'API le 2026-10-26. Toutes ces valeurs sont calculées par CLAIR.
 * Le classement des parlementaires reprend `ParlementaireListItem` (`/parlementaires?sort=`).
 */

/** Groupe dans le classement des groupes (`/groupes?chambre=`), statistiques en %. */
export type GroupeClasse = {
  id: string;
  slug: string;
  chambre: Chambre;
  legislature: number | null;
  nom: string;
  nomComplet: string | null;
  couleur: string | null;
  logoUrl: string | null;
  position: string | null;
  ordre: number;
  actif: boolean;
  membresCount: number;
  membresActifsCount: number;
  statsPresenceMoyenne: number | null;
  statsPresenceSolennelMoyenne: number | null;
  statsLoyauteMoyenne: number | null;
  statsCohesion: number | null;
};

/** Rang d'un parlementaire dans un classement (`/parlementaires/:slug/rank`). */
export type RangClassement = { rank: number | null; total: number };

/**
 * Le tri « carrière » a-t-il un sens (`/parlementaires/historique-carriere`, `/deputes/…`) :
 * faux tant qu'aucun réélu n'est en base, les deux périodes donnant alors les mêmes valeurs.
 */
export type HistoriqueCarriere = { present: boolean };
