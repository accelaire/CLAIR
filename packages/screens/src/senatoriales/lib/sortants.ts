/**
 * Regroupement et recherche des sortants de la page des sénatoriales (repris de apps/web
 * `app/senatoriales-2026/PageClient.tsx`).
 */
import type { Sortant, TriSortants } from "@clair/data";
import { ancreDepartement, nomGroupe, sansAccents } from "./format.ts";
import { familleProfession, SANS_COMMISSION, SANS_PROFESSION } from "./graphiques.ts";

/**
 * Regroupe les identifiants de mandat par libellé : un graphique en barres ne reçoit que des
 * couples libellé/effectif, cet index lui dit quels sortants se cachent derrière une barre.
 */
export const indexerPar = (
  sortants: Sortant[],
  cle: (sortant: Sortant) => string,
): Record<string, string[]> => {
  const index: Record<string, string[]> = {};
  for (const sortant of sortants) {
    const libelle = cle(sortant);
    const ids = index[libelle] ?? [];
    ids.push(sortant.mandatId);
    index[libelle] = ids;
  }
  return index;
};

/** Tris qui rassemblent les sortants en sections plutôt que de les classer. */
const TRIS_REGROUPANTS: readonly TriSortants[] = [
  "departement",
  "groupe",
  "commission",
  "profession",
];

/**
 * Clé de regroupement d'un sortant et libellé de sa section. La clé ordonne (le code INSEE range
 * « 01 » avant « 10 »), le libellé s'affiche ; les valeurs absentes prennent une clé `zzz`.
 */
const clefDeSection = (tri: TriSortants, sortant: Sortant): { cle: string; libelle: string } => {
  switch (tri) {
    case "groupe":
      return { cle: sortant.groupe?.slug ?? "zzz-sans-groupe", libelle: nomGroupe(sortant.groupe) };
    case "commission":
      return {
        cle: sortant.commissionPermanente ?? "zzz-sans-commission",
        libelle: sortant.commissionPermanente ?? SANS_COMMISSION,
      };
    case "profession": {
      const famille = familleProfession(sortant.personne.profession);
      return { cle: famille ?? "zzz-sans-profession", libelle: famille ?? SANS_PROFESSION };
    }
    default:
      return {
        cle: sortant.circonscription?.departement ?? "zzz",
        libelle: sortant.circonscription?.nom ?? "Circonscription non renseignée",
      };
  }
};

export type SectionSortants = { cle: string; libelle: string; ancre: string; sortants: Sortant[] };

/**
 * Sections de la liste pour les tris regroupants, `null` pour les classements (présence, âge,
 * nombre d'amendements…), dont l'ordre serait cassé par un découpage en paquets. Par
 * département, ordre des codes INSEE ; sinon les plus gros effectifs en tête, départagés par
 * libellé pour un ordre stable.
 */
export const sectionsDeSortants = (
  sortants: Sortant[],
  tri: TriSortants,
): SectionSortants[] | null => {
  if (!TRIS_REGROUPANTS.includes(tri)) return null;
  const parCle = new Map<string, SectionSortants>();
  for (const sortant of sortants) {
    const { cle, libelle } = clefDeSection(tri, sortant);
    const section = parCle.get(cle) ?? {
      cle,
      libelle,
      ancre: ancreDepartement(libelle),
      sortants: [],
    };
    section.sortants.push(sortant);
    parCle.set(cle, section);
  }
  const sections = Array.from(parCle.values());
  if (tri === "departement") return sections.sort((a, b) => a.cle.localeCompare(b.cle));
  return sections.sort(
    (a, b) => b.sortants.length - a.sortants.length || a.libelle.localeCompare(b.libelle, "fr"),
  );
};

/**
 * Recherche par nom, accents retirés des deux côtés : sans ça « Herve » ne trouve pas « Hervé ».
 */
export const rechercherSortants = (sortants: Sortant[], recherche: string): Sortant[] => {
  if (!recherche) return sortants;
  const q = sansAccents(recherche);
  return sortants.filter((s) => sansAccents(`${s.personne.prenom} ${s.personne.nom}`).includes(q));
};
