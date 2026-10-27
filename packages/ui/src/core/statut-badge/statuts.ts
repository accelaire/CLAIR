import type { BadgeTone } from "../badge/Badge.tsx";

/**
 * Statuts législatifs affichables. Sort d'un scrutin ou d'un amendement (adopté, rejeté,
 * retiré, tombé…) et état d'un dossier (en cours, promulgué, caduc…).
 */
export type Statut =
  | "adopte"
  | "adopte_modifie"
  | "rejete"
  | "retire"
  | "tombe"
  | "non_soutenu"
  | "irrecevable"
  | "satisfait"
  | "en_attente"
  | "en_cours"
  | "promulgue"
  | "caduc"
  | "fusionne";

export type StatutDefinition = { label: string; tone: BadgeTone };

/**
 * Mapping unique statut → libellé et ton. Le ton suit le sens du statut, pas sa source :
 * succès (adopté, promulgué), erreur (rejeté), avertissement (retiré, tombé),
 * information (en cours, en attente), neutre (sans suite : non soutenu, irrecevable, caduc…).
 */
export const STATUTS: Record<Statut, StatutDefinition> = {
  adopte: { label: "Adopté", tone: "succes" },
  adopte_modifie: { label: "Adopté modifié", tone: "succes" },
  rejete: { label: "Rejeté", tone: "erreur" },
  retire: { label: "Retiré", tone: "avertissement" },
  tombe: { label: "Tombé", tone: "avertissement" },
  non_soutenu: { label: "Non soutenu", tone: "neutre" },
  irrecevable: { label: "Irrecevable", tone: "neutre" },
  satisfait: { label: "Satisfait", tone: "neutre" },
  en_attente: { label: "En attente", tone: "info" },
  en_cours: { label: "En cours", tone: "info" },
  promulgue: { label: "Promulgué", tone: "succes" },
  caduc: { label: "Caduc", tone: "neutre" },
  fusionne: { label: "Fusionné", tone: "neutre" },
};

/** Minuscules, sans accents, espaces et tirets remplacés par `_`. */
const normalize = (raw: string) =>
  raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

/** Fragments des motifs d'irrecevabilité de l'Assemblée et du Sénat (cavalier, gage, art. 40…). */
const MOTIFS_IRRECEVABILITE = [
  "irr",
  "cavalier",
  "gage",
  "credits",
  "hors",
  "disposition",
  "injonction",
  "domaine",
  "ratification",
  "ordre_du_jour",
  "habilitation",
];

const isStatut = (value: string): value is Statut => Object.hasOwn(STATUTS, value);

/**
 * Lit un sort ou un état brut de l'API (« Adopté », `adopte`, `rejete`, « Non soutenu »,
 * « Cavalier (45) »…) et renvoie le statut correspondant, ou `null` s'il est inconnu.
 * Ignore la casse et les accents (voir `lib/scrutin-sort.ts` de apps/web).
 */
export const parseStatut = (raw: string | null | undefined): Statut | null => {
  if (!raw) return null;
  const value = normalize(raw);
  if (isStatut(value)) return value;
  if (value === "r" || value.includes("retir")) return "retire";
  if (value.startsWith("adopt")) return "adopte";
  if (value.startsWith("rejet")) return "rejete";
  if (value.includes("tomb") || value.includes("entonnoir") || value.includes("efface")) {
    return "tombe";
  }
  if (value.includes("satisfait")) return "satisfait";
  if (value.includes("traitement") || value.includes("discuter") || value.includes("attente")) {
    return "en_attente";
  }
  if (MOTIFS_IRRECEVABILITE.some((motif) => value.includes(motif))) return "irrecevable";
  return null;
};
