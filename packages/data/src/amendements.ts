/**
 * Renvoi au droit en vigueur repéré dans le dispositif d'un amendement (`renvois` des amendements
 * de `/scrutins/:numero`, `/dossiers/:uid`, `/dossiers/:uid/amendements` et des fiches). Écrit
 * d'après l'API (apps/api, `utils/renvois-legi.ts`) le 2026-11-14.
 *
 * Le repérage est calculé par CLAIR (index de la base LEGI) ; l'adresse mène à Légifrance, dans
 * la version en vigueur au dépôt de l'amendement. Un renvoi douteux est écarté par l'API : un lien
 * faux est pire qu'un lien absent.
 */
export type RenvoiDispositif = {
  /** Positions dans `dispositif` brut, en unités de code UTF-16 (`String#slice`). */
  debut: number;
  fin: number;
  type: "article" | "texte";
  /** Identifiant Légifrance de la version de l'article citée (LEGIARTI). */
  article: string | null;
  /** Identifiant Légifrance du texte : LEGITEXT d'un code, JORFTEXT d'un texte paru au JO. */
  texte: string;
  /** Nature du texte (CODE, LOI, ORDONNANCE…), si l'index la connaît. */
  nature: string | null;
  url: string;
};
