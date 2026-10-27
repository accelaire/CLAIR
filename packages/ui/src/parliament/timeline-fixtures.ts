import type { DataTableColumn } from "./data-table/DataTable.tsx";
import type { LegislativeStep } from "./legislative-timeline/LegislativeTimeline.tsx";
import type { Mandat } from "./mandats-timeline/MandatsTimeline.tsx";
import type { TopFlopItem } from "./top-flop/TopFlop.tsx";

/*
 * Données d'EXEMPLE des stories, des tests et de la documentation de LegislativeTimeline,
 * MandatsTimeline, DataTable, TopFlop et EvenementCard. Personnes fictives, dates et
 * valeurs plausibles mais inventées : elles ne décrivent aucun dossier ni aucun élu réel.
 * Les adresses restent des ancres (`#…`) : aucune route du site.
 */

/** Dossier en navette : première lecture faite à l'Assemblée, en cours au Sénat. */
export const etapesEnCours: LegislativeStep[] = [
  {
    code: "AN1",
    label: "1re lecture",
    chambre: "assemblee",
    status: "done",
    outcome: "adopted",
    date: "2025-01-21",
  },
  {
    code: "SN1",
    label: "1re lecture",
    chambre: "senat",
    status: "active",
    date: "2025-03-04",
    detail: "Texte transmis au Sénat et renvoyé en commission.",
  },
  { code: "CMP", label: "Commission mixte paritaire", chambre: "both", status: "pending" },
  { code: "PROM", label: "Promulgation", chambre: null, status: "pending" },
];

/** Dossier terminé, promulgué après décision du Conseil constitutionnel. */
export const etapesTerminees: LegislativeStep[] = [
  {
    code: "AN1",
    label: "1re lecture",
    chambre: "assemblee",
    status: "done",
    outcome: "adopted",
    date: "2024-10-08",
  },
  {
    code: "SN1",
    label: "1re lecture",
    chambre: "senat",
    status: "done",
    outcome: "adopted_modified",
    date: "2024-11-19",
  },
  {
    code: "CMP",
    label: "Commission mixte paritaire",
    chambre: "both",
    status: "done",
    outcome: "cmp_accord",
    date: "2024-12-03",
  },
  {
    code: "CC",
    label: "Conseil constitutionnel",
    chambre: null,
    status: "done",
    outcome: "cc_partiel",
    date: "2025-01-16",
  },
  {
    code: "PROM",
    label: "Promulgation",
    chambre: null,
    status: "done",
    date: "2025-01-24",
    detail: "Loi publiée au Journal officiel.",
  },
];

/** Navette : désaccord en commission mixte paritaire, nouvelle lecture en cours. */
export const etapesNavette: LegislativeStep[] = [
  {
    code: "AN1",
    label: "1re lecture",
    chambre: "assemblee",
    status: "done",
    outcome: "adopted",
    date: "2024-05-14",
  },
  {
    code: "SN1",
    label: "1re lecture",
    chambre: "senat",
    status: "done",
    outcome: "adopted_modified",
    date: "2024-06-25",
  },
  {
    code: "CMP",
    label: "Commission mixte paritaire",
    chambre: "both",
    status: "done",
    outcome: "cmp_desaccord",
    date: "2024-07-09",
  },
  {
    code: "AN-NL",
    label: "Nouvelle lecture",
    chambre: "assemblee",
    status: "active",
    date: "2024-10-01",
  },
  { code: "SN-NL", label: "Nouvelle lecture", chambre: "senat", status: "pending" },
  { code: "AN-LD", label: "Lecture définitive", chambre: "assemblee", status: "pending" },
];

/** Parcours d'une parlementaire fictive : députée, puis sénatrice. */
export const mandatsExemple: Mandat[] = [
  {
    id: "an-16",
    chambre: "assemblee",
    periode: "XVIe législature",
    dateDebut: "2022-06-22",
    dateFin: "2023-09-30",
    groupe: {
      sigle: "DEM",
      nom: "Démocrate (MoDem et indépendants)",
      couleur: "var(--clair-groupe-dem)",
    },
    circonscription: "Exempleville (3e circonscription)",
    fonctions: [
      {
        id: "f1",
        qualite: "Membre",
        organe: "Commission des finances",
        dateDebut: "2022-07-01",
        dateFin: "2023-09-30",
        href: "#commission",
      },
    ],
  },
  {
    id: "sn-2023",
    chambre: "senat",
    periode: "Mandature 2023",
    dateDebut: "2023-10-01",
    dateFin: null,
    groupe: { sigle: "UC", nom: "Union centriste", href: "#groupe" },
    circonscription: "Département d'exemple",
    fonctions: [
      {
        id: "f2",
        qualite: "Vice-présidente",
        organe: "Commission des affaires sociales",
        dateDebut: "2023-10-10",
        href: "#commission",
      },
      { id: "f3", qualite: "Membre", organe: "Groupe d'études sur l'eau", dateDebut: "2023-11-02" },
      {
        id: "f4",
        qualite: "Rapporteure",
        organe: "Mission d'information sur les mobilités",
        dateDebut: "2024-01-15",
        dateFin: "2024-07-01",
      },
    ],
  },
];

/** Un seul mandat, en cours. */
export const mandatUnique: Mandat[] = [
  {
    id: "an-17",
    chambre: "assemblee",
    periode: "XVIIe législature",
    dateDebut: "2024-07-18",
    groupe: {
      sigle: "ECO",
      nom: "Écologiste et social",
      couleur: "var(--clair-groupe-eco)",
      href: "#groupe",
    },
    circonscription: "Exempleville (1re circonscription)",
    fonctions: [
      {
        id: "f5",
        qualite: "Membre",
        organe: "Commission du développement durable",
        dateDebut: "2024-07-20",
      },
    ],
  },
];

/** Ligne d'un classement (statistiques calculées par CLAIR). */
export type LigneClassement = {
  id: string;
  nom: string;
  groupe: string;
  presence: number | null;
  amendements: number;
};

export const classementExemple: LigneClassement[] = [
  { id: "1", nom: "Camille Exemple", groupe: "SOC", presence: 92, amendements: 148 },
  { id: "2", nom: "Dominique Modèle", groupe: "DR", presence: 78, amendements: 312 },
  { id: "3", nom: "Alix Fictif", groupe: "EPR", presence: 85, amendements: 57 },
  { id: "4", nom: "Sacha Démo", groupe: "RN", presence: null, amendements: 9 },
  { id: "5", nom: "Élise Témoin", groupe: "LFI", presence: 64, amendements: 1203 },
];

const pourcentage = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const nombre = new Intl.NumberFormat("fr-FR");

export const colonnesClassement: DataTableColumn<LigneClassement>[] = [
  {
    key: "nom",
    header: "Parlementaire",
    cell: (ligne) => ligne.nom,
    sortValue: (ligne) => ligne.nom,
    rowHeader: true,
  },
  {
    key: "groupe",
    header: "Groupe",
    cell: (ligne) => ligne.groupe,
    sortValue: (ligne) => ligne.groupe,
  },
  {
    key: "presence",
    header: "Présence",
    cell: (ligne) => (ligne.presence === null ? "—" : pourcentage.format(ligne.presence / 100)),
    sortValue: (ligne) => ligne.presence,
    firstDirection: "descending",
    align: "end",
  },
  {
    key: "amendements",
    header: "Amendements",
    cell: (ligne) => nombre.format(ligne.amendements),
    sortValue: (ligne) => ligne.amendements,
    firstDirection: "descending",
    align: "end",
  },
];

const personnes = [
  "Camille Exemple",
  "Dominique Modèle",
  "Alix Fictif",
  "Sacha Démo",
  "Élise Témoin",
];

export const topExemple: TopFlopItem[] = personnes.map((name, index) => ({
  id: `top-${index}`,
  name,
  href: "#parlementaire",
  value: 99 - index * 2,
  detail: index % 2 === 0 ? "Assemblée nationale" : "Sénat",
}));

export const flopExemple: TopFlopItem[] = [...personnes].reverse().map((name, index) => ({
  id: `flop-${index}`,
  name: name.replace("Exemple", "Essai").replace("Modèle", "Maquette"),
  href: "#parlementaire",
  value: 12 + index * 3,
  rank: 577 - index,
  detail: "Assemblée nationale",
}));
