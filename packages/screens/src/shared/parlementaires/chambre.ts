import type { Chambre } from "@clair/data";
import { VOTE_POSITIONS, type VotePositionValue } from "@clair/ui";

/**
 * Ce qui distingue l'Assemblée du Sénat dans les écrans des parlementaires (liste, fiche,
 * comparateur) : adresses, libellés, nombre de sièges, source officielle et axe de période.
 */
export type ChambreConfig = {
  /** Chemin des pages et des routes d'API (`/deputes`, `/senateurs`). */
  chemin: string;
  titre: string;
  singulier: string;
  pluriel: string;
  /** Nombre de sièges de la chambre. */
  sieges: number;
  /** Paramètre de période : législature à l'Assemblée, session au Sénat. */
  periode: "legislature" | "session";
  source: { label: string; href: string; producteur: string };
};

export const CHAMBRE_CONFIG: Record<Chambre, ChambreConfig> = {
  assemblee: {
    chemin: "/deputes",
    titre: "Députés",
    singulier: "député",
    pluriel: "députés",
    sieges: 577,
    periode: "legislature",
    source: {
      label: "data.assemblee-nationale.fr",
      href: "https://data.assemblee-nationale.fr",
      producteur: "Assemblée nationale",
    },
  },
  senat: {
    chemin: "/senateurs",
    titre: "Sénateurs",
    singulier: "sénateur",
    pluriel: "sénateurs",
    sieges: 348,
    periode: "session",
    source: { label: "data.senat.fr", href: "https://data.senat.fr", producteur: "Sénat" },
  },
};

/** Nombre maximal d'élus comparés (limite de l'API). */
export const MAX_COMPARAISON = 4;

const ROMAINS: Array<[number, string]> = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 17 → « XVIIe législature ». */
export const libelleLegislature = (numero: number) => {
  let reste = numero;
  let romain = "";
  for (const [valeur, chiffre] of ROMAINS) {
    while (reste >= valeur) {
      romain += chiffre;
      reste -= valeur;
    }
  }
  return `${romain}${numero === 1 ? "re" : "e"} législature`;
};

/** « député », « ancienne sénatrice »… selon la chambre, le sexe et le mandat en cours. */
export const fonctionDe = (chambre: Chambre, sexe: string | null, actif: boolean) => {
  const femme = sexe === "F";
  const base =
    chambre === "senat" ? (femme ? "sénatrice" : "sénateur") : femme ? "députée" : "député";
  if (actif) return base;
  return `${femme ? "ancienne" : "ancien"} ${base}`;
};

/** Adresse d'un scrutin : le numéro seul n'est pas unique, la chambre et la session l'identifient. */
export const scrutinHref = (scrutin: {
  numero: number;
  chambre?: Chambre | null;
  session?: string | null;
}) => {
  const query = new URLSearchParams({ chambre: scrutin.chambre ?? "assemblee" });
  if (scrutin.session) query.set("session", scrutin.session);
  return `/scrutins/${scrutin.numero}?${query.toString()}`;
};

/** Page d'un groupe politique. */
export const groupeHref = (chambre: Chambre, slug: string) => `/groupes/${chambre}/${slug}`;

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** « 23 octobre 2026 ». */
export const formatDate = (iso: string) => dateLongue.format(new Date(iso));

const nombre = new Intl.NumberFormat("fr-FR");

/** « 1 234 ». */
export const formatNombre = (valeur: number) => nombre.format(valeur);

const estPosition = (valeur: string): valeur is VotePositionValue =>
  Object.hasOwn(VOTE_POSITIONS, valeur);

/** Position de vote de l'API reconnue par `VotePosition`, ou `null`. */
export const positionDeVote = (position: string | null): VotePositionValue | null => {
  if (position === null) return null;
  const normalisee = position === "nonVotant" ? "non_votant" : position;
  return estPosition(normalisee) ? normalisee : null;
};

/** « Pour », « Contre »… ; la valeur brute si elle est inconnue. */
export const libellePosition = (position: string) => {
  const valeur = positionDeVote(position);
  return valeur ? VOTE_POSITIONS[valeur].label : position;
};

/** Sort d'un scrutin en toutes lettres (« adopte » → « Adopté »). */
export const libelleSort = (sort: string) =>
  /adopt/i.test(sort) ? "Adopté" : /rejet/i.test(sort) ? "Rejeté" : sort;

/** « 09 - Circonscription 2 » : nom générique de la source, qui répète le département et le numéro. */
const NOM_GENERIQUE = /^\s*\S+\s*-\s*Circonscription\s+\d+\s*$/i;

/**
 * Circonscription prête pour `ParlementaireCard` : le nom générique de l'Assemblée devient
 * « Département 09 », pour lire « Département 09, 2e circonscription » et non
 * « 09 - Circonscription 2 (09), 2e circonscription ».
 */
export const circonscriptionLisible = <C extends { nom: string; departement: string }>(
  circonscription: C | null,
): C | null =>
  circonscription && NOM_GENERIQUE.test(circonscription.nom)
    ? { ...circonscription, nom: `Département ${circonscription.departement}`, departement: "" }
    : circonscription;

/** « la loi… » → « La loi… » : les titres de scrutin de l'Assemblée commencent en minuscule. */
export const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);
