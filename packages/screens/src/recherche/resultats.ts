import type { SearchCategorie, SearchParlementaire, SearchResult } from "@clair/data";
import {
  BookOpen,
  Building2,
  FileText,
  Landmark,
  type LucideIcon,
  Tag,
  Users,
  Vote,
} from "lucide-react";
import { typeCommission } from "../commissions-liste/libelles.ts";
import { legislatureLabel, scrutinHref } from "../shared/scrutins.ts";

/** Libellés et icônes des catégories (repris de `typeConfig` de apps/web/app/recherche). */
export const CATEGORIE: Record<
  SearchCategorie,
  { singulier: string; pluriel: string; icone: LucideIcon }
> = {
  deputes: { singulier: "Député", pluriel: "Députés", icone: Users },
  senateurs: { singulier: "Sénateur", pluriel: "Sénateurs", icone: Users },
  groupes: { singulier: "Groupe", pluriel: "Groupes", icone: Landmark },
  commissions: { singulier: "Commission", pluriel: "Commissions", icone: BookOpen },
  scrutins: { singulier: "Scrutin", pluriel: "Scrutins", icone: Vote },
  sujets: { singulier: "Sujet", pluriel: "Sujets", icone: Tag },
  lobbyistes: { singulier: "Lobbyiste", pluriel: "Lobbyistes", icone: Building2 },
  dossiers: { singulier: "Dossier", pluriel: "Dossiers", icone: FileText },
};

/** Catégorie d'un résultat ; un parlementaire se range selon sa chambre. */
export const categorieDe = (resultat: SearchResult): SearchCategorie => {
  switch (resultat._type) {
    case "depute":
    case "senateur":
      return resultat.chambre === "senat" ? "senateurs" : "deputes";
    case "scrutin":
      return "scrutins";
    case "lobbyiste":
      return "lobbyistes";
    case "dossier":
      return "dossiers";
    case "groupe":
      return "groupes";
    case "commission":
      return "commissions";
    case "sujet":
      return "sujets";
  }
};

/** Adresse de la fiche d'un résultat. */
export const lienDe = (resultat: SearchResult): string => {
  switch (resultat._type) {
    case "depute":
    case "senateur":
      return `/${resultat.chambre === "senat" ? "senateurs" : "deputes"}/${resultat.slug}`;
    case "scrutin":
      return scrutinHref(resultat);
    case "lobbyiste":
      return `/lobbying/${resultat.id}`;
    case "dossier":
      return `/dossiers/${resultat.uid}`;
    case "groupe":
      return `/groupes/${resultat.chambre || "assemblee"}/${resultat.slug}`;
    case "commission":
      return `/commissions/${resultat.slug}`;
    case "sujet":
      return `/sujets/${resultat.slug}`;
  }
};

/** Clé stable d'un résultat dans une liste. */
export const cleDe = (resultat: SearchResult) => `${resultat._type}-${resultat.id}`;

/**
 * Libellé d'un mandat clos : l'Assemblée se date par sa législature ; le Sénat n'a pas de
 * cohorte équivalente, on y donne l'année de fin de mandat. Accordé au genre quand il est
 * connu, neutre sinon (`ancienLabel` de apps/web).
 */
export const libelleAncien = (parlementaire: SearchParlementaire): string => {
  const senat = parlementaire.chambre === "senat";
  const titre =
    parlementaire.sexe === "F"
      ? senat
        ? "Ancienne sénatrice"
        : "Ancienne députée"
      : parlementaire.sexe === "M"
        ? senat
          ? "Ancien sénateur"
          : "Ancien député"
        : "Mandat clos";
  const mandat = parlementaire.dernierMandat;
  if (!mandat) return titre;
  if (mandat.legislature != null) return `${titre} · ${legislatureLabel(mandat.legislature)}`;
  if (mandat.dateFin) {
    const annee = new Date(mandat.dateFin).getUTCFullYear();
    if (Number.isFinite(annee)) return `${titre} · jusqu'en ${annee}`;
  }
  return titre;
};

/**
 * « enquete » → « Commission d'enquête » (libellés de la liste des commissions) ; un type
 * inconnu est seulement rendu lisible (« groupe_x » → « Groupe x »).
 */
export const libelleTypeCommission = (type: string) => {
  const { singulier } = typeCommission(type);
  if (singulier !== type) return singulier;
  const texte = type.replace(/_/g, " ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
};

/** « 1 scrutin », « 12 scrutins ». */
export const compte = (n: number, mot: string) =>
  `${n.toLocaleString("fr-FR")} ${mot}${n > 1 ? "s" : ""}`;
