import type { BarChartDatum, BarChartSeries } from "./bar-chart/BarChart.tsx";
import type { ChartTable } from "./chart-frame/ChartFrame.tsx";
import type { HemicycleGroup } from "./hemicycle/Hemicycle.tsx";

/*
 * Données d'EXEMPLE des stories, des tests et de la documentation des graphiques.
 * Les sigles de groupes sont réels, les effectifs sont plausibles mais ne décrivent aucune
 * composition officielle : ils ne doivent jamais être présentés comme tels.
 */

/** Répartition d'exemple des 577 sièges de l'Assemblée nationale (ordre d'affichage fourni). */
export const groupesAssembleeExemple: HemicycleGroup[] = [
  {
    id: "lfi",
    sigle: "LFI",
    nom: "La France insoumise",
    sieges: 71,
    couleur: "var(--clair-groupe-lfi)",
  },
  {
    id: "gdr",
    sigle: "GDR",
    nom: "Gauche démocrate et républicaine",
    sieges: 17,
    couleur: "var(--clair-groupe-gdr)",
  },
  {
    id: "eco",
    sigle: "ECO",
    nom: "Écologiste et social",
    sieges: 38,
    couleur: "var(--clair-groupe-eco)",
  },
  {
    id: "soc",
    sigle: "SOC",
    nom: "Socialistes et apparentés",
    sieges: 66,
    couleur: "var(--clair-groupe-soc)",
  },
  {
    id: "liot",
    sigle: "LIOT",
    nom: "Libertés, indépendants, outre-mer et territoires",
    sieges: 23,
    couleur: "var(--clair-groupe-liot)",
  },
  {
    id: "epr",
    sigle: "EPR",
    nom: "Ensemble pour la République",
    sieges: 91,
    couleur: "var(--clair-groupe-epr)",
  },
  {
    id: "dem",
    sigle: "DEM",
    nom: "Les Démocrates",
    sieges: 36,
    couleur: "var(--clair-groupe-dem)",
  },
  {
    id: "hor",
    sigle: "HOR",
    nom: "Horizons et indépendants",
    sieges: 34,
    couleur: "var(--clair-groupe-hor)",
  },
  {
    id: "dr",
    sigle: "DR",
    nom: "Droite républicaine",
    sieges: 47,
    couleur: "var(--clair-groupe-dr)",
  },
  {
    id: "udi",
    sigle: "UDI",
    nom: "UDI et indépendants",
    sieges: 16,
    couleur: "var(--clair-groupe-udi)",
  },
  {
    id: "rn",
    sigle: "RN",
    nom: "Rassemblement national",
    sieges: 123,
    couleur: "var(--clair-groupe-rn)",
  },
  { id: "ni", sigle: "NI", nom: "Non inscrits", sieges: 15, couleur: "var(--clair-groupe-ni)" },
];

/**
 * Répartition d'exemple des 348 sièges du Sénat. Sans couleur fournie par les données,
 * le composant prend la palette des graphiques.
 */
export const groupesSenatExemple: HemicycleGroup[] = [
  {
    id: "crce",
    sigle: "CRCE-K",
    nom: "Communiste, républicain, citoyen et écologiste – Kanaky",
    sieges: 18,
  },
  { id: "gest", sigle: "GEST", nom: "Écologiste – Solidarité et Territoires", sieges: 16 },
  { id: "ser", sigle: "SER", nom: "Socialiste, écologiste et républicain", sieges: 64 },
  { id: "rdse", sigle: "RDSE", nom: "Rassemblement démocratique et social européen", sieges: 17 },
  {
    id: "rdpi",
    sigle: "RDPI",
    nom: "Rassemblement des démocrates, progressistes et indépendants",
    sieges: 19,
  },
  { id: "uc", sigle: "UC", nom: "Union centriste", sieges: 59 },
  { id: "lirt", sigle: "LIRT", nom: "Les Indépendants – République et Territoires", sieges: 19 },
  { id: "lr", sigle: "LR", nom: "Les Républicains", sieges: 130 },
  { id: "ni", sigle: "NI", nom: "Non inscrits", sieges: 6 },
];

/** Répartition d'exemple des votes d'un groupe sur une session (donnée calculée). */
export const votesParMoisExemple: BarChartDatum[] = [
  { mois: "Janvier", pour: 42, contre: 18, abstention: 6 },
  { mois: "Février", pour: 35, contre: 22, abstention: 9 },
  { mois: "Mars", pour: 51, contre: 14, abstention: 4 },
  { mois: "Avril", pour: 28, contre: 30, abstention: 11 },
];

export const seriesVotesExemple: BarChartSeries[] = [
  { key: "pour", label: "Pour", color: "var(--clair-graphique-vote-pour)" },
  { key: "contre", label: "Contre", color: "var(--clair-graphique-vote-contre)" },
  { key: "abstention", label: "Abstention", color: "var(--clair-graphique-vote-abstention)" },
];

/** Décompte d'exemple par commission (barres horizontales : libellés longs). */
export const commissionsExemple: BarChartDatum[] = [
  { commission: "Lois constitutionnelles", membres: 73 },
  { commission: "Finances", membres: 73 },
  { commission: "Affaires sociales", membres: 72 },
  { commission: "Affaires économiques", membres: 71 },
  { commission: "Affaires étrangères", membres: 71 },
];

/** Tableau alternatif d'un graphique de votes par mois. */
export const tableVotesExemple: ChartTable = {
  caption: "Votes du groupe par mois (exemple)",
  columns: [
    { key: "mois", label: "Mois" },
    { key: "pour", label: "Pour" },
    { key: "contre", label: "Contre" },
    { key: "abstention", label: "Abstention" },
  ],
  rows: votesParMoisExemple,
};

/** Tableau alternatif d'un hémicycle : sigle, groupe, sièges. */
export const tableDeGroupes = (caption: string, groupes: HemicycleGroup[]): ChartTable => ({
  caption,
  columns: [
    { key: "sigle", label: "Sigle" },
    { key: "nom", label: "Groupe" },
    { key: "sieges", label: "Sièges" },
  ],
  rows: groupes.map(({ sigle, nom, sieges }) => ({ sigle, nom, sieges })),
});
