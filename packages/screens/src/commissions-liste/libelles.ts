import { COMMISSION_TYPES, type CommissionType } from "@clair/data";

/** Libellés des types d'organes : titre de section (pluriel), option de filtre et nom (singulier). */
export const TYPES_COMMISSION: Record<
  CommissionType,
  { section: string; filtre: string; singulier: string }
> = {
  permanente: {
    section: "Commissions permanentes",
    filtre: "Permanentes",
    singulier: "Commission permanente",
  },
  enquete: {
    section: "Commissions d'enquête",
    filtre: "Enquête",
    singulier: "Commission d'enquête",
  },
  speciale: {
    section: "Commissions spéciales",
    filtre: "Spéciales",
    singulier: "Commission spéciale",
  },
  mixte_paritaire: {
    section: "Commissions mixtes paritaires",
    filtre: "Mixtes paritaires",
    singulier: "Commission mixte paritaire",
  },
  delegation: {
    section: "Délégations parlementaires",
    filtre: "Délégations",
    singulier: "Délégation parlementaire",
  },
  mission_info: {
    section: "Missions d'information",
    filtre: "Missions d'information",
    singulier: "Mission d'information",
  },
  office: {
    section: "Offices parlementaires",
    filtre: "Offices parlementaires",
    singulier: "Office parlementaire",
  },
  hemicycle: { section: "Hémicycle", filtre: "Hémicycle", singulier: "Séance plénière" },
  autre: { section: "Autres organes", filtre: "Autres", singulier: "Autre organe" },
  groupe_etudes: {
    section: "Groupes d'études",
    filtre: "Groupes d'études",
    singulier: "Groupe d'études",
  },
  groupe_amitie: {
    section: "Groupes d'amitié",
    filtre: "Groupes d'amitié",
    singulier: "Groupe d'amitié",
  },
  assemblee_internationale: {
    section: "Assemblées internationales",
    filtre: "Assemblées internationales",
    singulier: "Assemblée internationale",
  },
};

/** Libellés d'un type venu de l'API (un type inconnu garde son code). */
export const typeCommission = (type: string) => {
  const connu = COMMISSION_TYPES.find((valeur) => valeur === type);
  return connu ? TYPES_COMMISSION[connu] : { section: type, filtre: type, singulier: type };
};
