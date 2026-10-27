/**
 * Tokens de CLAIR : source unique des valeurs visuelles du nouveau front.
 *
 * Le CSS (`tokens.css`, généré par `pnpm --filter @clair/theme generate`), le thème Mantine, le
 * Storybook et la documentation en dérivent. En code, on utilise les tokens sémantiques
 * (`var(--clair-fond-…)`, `var(--clair-texte-…)`), jamais les valeurs hexadécimales.
 *
 * Valeurs reprises de `apps/web` (globals.css, tailwind.config.ts, lib/colors.ts), corrigées là où
 * elles ne passaient pas le contraste WCAG AA (voir `tokens.test.ts`).
 */

/** Palette brute. */
export const palette = {
  "bleu-50": "#ECF3FE",
  "bleu-100": "#CEE2FD",
  "bleu-200": "#9EC4FA",
  "bleu-300": "#6DA7F8",
  "bleu-400": "#5598F7",
  "bleu-500": "#297EF5",
  "bleu-600": "#106FF4",
  "bleu-700": "#195BCC",
  "bleu-800": "#1748AB",
  "bleu-900": "#074192",
  blanc: "#FFFFFF",
  "ardoise-50": "#F8FAFC",
  "ardoise-100": "#F1F5F9",
  "ardoise-200": "#E2E8F0",
  "ardoise-500": "#5B6475",
  "ardoise-900": "#0F172A",
  "ardoise-950": "#020817",
  "nuit-950": "#0C0E12",
  "nuit-900": "#12151B",
  "nuit-800": "#22262F",
  "nuit-700": "#373A41",
  "nuit-500": "#767A82",
  "nuit-400": "#94969C",
} as const;

export type PaletteName = keyof typeof palette;

/** Rôles de couleur, identiques en clair et en sombre. */
type ColorRoles = {
  "fond-page": string;
  "fond-surface": string;
  "fond-neutre": string;
  "fond-action": string;
  "fond-action-survol": string;
  "texte-sur-action": string;
  "texte-titre": string;
  "texte-defaut": string;
  "texte-mention": string;
  "texte-action": string;
  "bordure-defaut": string;
  "bordure-forte": string;
  focus: string;
  "statut-succes": string;
  "statut-succes-fond": string;
  "statut-erreur": string;
  "statut-erreur-fond": string;
  "statut-avertissement": string;
  "statut-avertissement-fond": string;
  "statut-info": string;
  "statut-info-fond": string;
  "statut-neutre": string;
  "statut-neutre-fond": string;
  "chambre-assemblee": string;
  "chambre-assemblee-fond": string;
  "chambre-senat": string;
  "chambre-senat-fond": string;
  "vote-pour": string;
  "vote-pour-fond": string;
  "vote-contre": string;
  "vote-contre-fond": string;
  "vote-abstention": string;
  "vote-abstention-fond": string;
  "vote-absent": string;
  "vote-absent-fond": string;
};

export type ColorToken = keyof ColorRoles;

/** Couleurs du thème clair. */
const clair: ColorRoles = {
  "fond-page": palette.blanc,
  "fond-surface": palette.blanc,
  "fond-neutre": palette["ardoise-100"],
  "fond-action": palette["bleu-600"],
  "fond-action-survol": palette["bleu-700"],
  "texte-sur-action": palette.blanc,
  "texte-titre": palette["ardoise-950"],
  "texte-defaut": palette["ardoise-950"],
  "texte-mention": palette["ardoise-500"],
  "texte-action": palette["bleu-700"],
  "bordure-defaut": palette["ardoise-200"],
  "bordure-forte": palette["ardoise-500"],
  focus: palette["bleu-600"],
  "statut-succes": "#166534",
  "statut-succes-fond": "#DCFCE7",
  "statut-erreur": "#B91C1C",
  "statut-erreur-fond": "#FEE2E2",
  "statut-avertissement": "#B45309",
  "statut-avertissement-fond": "#FEF3C7",
  "statut-info": "#1D4ED8",
  "statut-info-fond": "#DBEAFE",
  "statut-neutre": "#374151",
  "statut-neutre-fond": "#F3F4F6",
  "chambre-assemblee": "#7E22CE",
  "chambre-assemblee-fond": "#F3E8FF",
  "chambre-senat": "#1D4ED8",
  "chambre-senat-fond": "#DBEAFE",
  "vote-pour": "#166534",
  "vote-pour-fond": "#DCFCE7",
  "vote-contre": "#B91C1C",
  "vote-contre-fond": "#FEE2E2",
  "vote-abstention": "#854D0E",
  "vote-abstention-fond": "#FEF9C3",
  "vote-absent": "#374151",
  "vote-absent-fond": "#F3F4F6",
};

/** Couleurs du thème sombre (fond « nuit » de la maquette Figma de apps/web). */
const sombre: ColorRoles = {
  "fond-page": palette["nuit-950"],
  "fond-surface": palette["nuit-900"],
  "fond-neutre": palette["nuit-800"],
  "fond-action": palette["bleu-600"],
  "fond-action-survol": palette["bleu-700"],
  "texte-sur-action": palette.blanc,
  "texte-titre": palette.blanc,
  "texte-defaut": palette.blanc,
  "texte-mention": palette["nuit-400"],
  "texte-action": palette["bleu-400"],
  "bordure-defaut": palette["nuit-800"],
  "bordure-forte": palette["nuit-500"],
  focus: palette["bleu-400"],
  "statut-succes": "#4ADE80",
  "statut-succes-fond": "#0F261B",
  "statut-erreur": "#F87171",
  "statut-erreur-fond": "#341316",
  "statut-avertissement": "#FBBF24",
  "statut-avertissement-fond": "#321C11",
  "statut-info": "#60A5FA",
  "statut-info-fond": "#121D3C",
  "statut-neutre": "#D1D5DB",
  "statut-neutre-fond": "#1B2028",
  "chambre-assemblee": "#C084FC",
  "chambre-assemblee-fond": "#27133B",
  "chambre-senat": "#60A5FA",
  "chambre-senat-fond": "#121D3C",
  "vote-pour": "#4ADE80",
  "vote-pour-fond": "#0F261B",
  "vote-contre": "#F87171",
  "vote-contre-fond": "#341316",
  "vote-abstention": "#FACC15",
  "vote-abstention-fond": "#2F1F12",
  "vote-absent": "#D1D5DB",
  "vote-absent-fond": "#1B2028",
};

export const colors = { clair, sombre } as const;

export type ColorScheme = keyof typeof colors;

/**
 * Couleurs des graphiques de vote (barres, hémicycles), identiques dans les deux thèmes.
 * Toujours accompagnées d'un libellé ou d'une légende : jamais la couleur seule.
 * Teintes de apps/web (#4CAF50, #F44336, #FF9800, #9E9E9E) foncées dans la même famille pour
 * atteindre 3:1 sur tous les fonds, clairs et sombres (WCAG 1.4.11, voir `tokens.test.ts`).
 */
export const voteChartColors = {
  pour: "#388E3C",
  contre: "#E53935",
  abstention: "#E65100",
  absent: "#808080",
} as const;

/**
 * Couleurs de repli des groupes politiques (apps/web lib/colors.ts), par sigle.
 * La couleur fournie par l'API pour un groupe reste prioritaire.
 * Toujours accompagnées du sigle du groupe.
 */
export const parliamentaryGroups = {
  EPR: { label: "Ensemble pour la République", color: "#FFEB00" },
  LFI: { label: "La France insoumise", color: "#CC2443" },
  RN: { label: "Rassemblement national", color: "#0D378A" },
  DR: { label: "Droite républicaine", color: "#0066CC" },
  SOC: { label: "Socialistes et apparentés", color: "#FF8080" },
  ECO: { label: "Écologiste et social", color: "#00C000" },
  DEM: { label: "Les Démocrates", color: "#FF9900" },
  HOR: { label: "Horizons et indépendants", color: "#00BFFF" },
  GDR: { label: "Gauche démocrate et républicaine", color: "#DD0000" },
  LIOT: { label: "Libertés, indépendants, outre-mer et territoires", color: "#8B4513" },
  UDI: { label: "UDI et indépendants", color: "#00FFFF" },
  NI: { label: "Non inscrits", color: "#AAAAAA" },
} as const;

export type ParliamentaryGroupCode = keyof typeof parliamentaryGroups;

/** Palette des graphiques sans groupe (apps/web lib/colors.ts CHART_COLORS). */
export const chartPalette = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#14B8A6",
  "#06B6D4",
  "#6366F1",
  "#A855F7",
  "#F43F5E",
  "#84CC16",
] as const;

export const fonts = {
  interface: '"Inter Variable", "Inter", system-ui, sans-serif',
  code: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
} as const;

type TextStyle = { size: number; lineHeight: number; weight: 400 | 500 | 600 | 700 };

/** Échelle typographique (px), alignée sur celle de apps/web (Tailwind). */
export const typeScale = {
  h1: { size: 36, lineHeight: 40, weight: 700 },
  h2: { size: 30, lineHeight: 36, weight: 700 },
  h3: { size: 24, lineHeight: 32, weight: 600 },
  h4: { size: 20, lineHeight: 28, weight: 600 },
  h5: { size: 18, lineHeight: 28, weight: 600 },
  h6: { size: 16, lineHeight: 24, weight: 600 },
  lg: { size: 18, lineHeight: 28, weight: 400 },
  md: { size: 16, lineHeight: 24, weight: 400 },
  sm: { size: 14, lineHeight: 20, weight: 400 },
  xs: { size: 12, lineHeight: 16, weight: 400 },
  chiffre: { size: 30, lineHeight: 36, weight: 700 },
} as const satisfies Record<string, TextStyle>;

/** Grille de 4 px (1v = 4 px), nommée comme dans le DSFR. */
export const spacing = {
  "1v": 4,
  "2v": 8,
  "3v": 12,
  "4v": 16,
  "6v": 24,
  "8v": 32,
  "10v": 40,
  "12v": 48,
  "16v": 64,
} as const;

/** Rayons (apps/web : --radius = 8 px). */
export const radius = {
  aucun: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  pilule: 999,
} as const;

/** Ombres. */
export const shadows = {
  sm: "0 1px 2px rgba(2, 8, 23, 0.06)",
  md: "0 4px 12px rgba(2, 8, 23, 0.10)",
  lg: "0 10px 30px rgba(2, 8, 23, 0.16)",
} as const;

/** Points de rupture (px), ceux de apps/web (Tailwind) pour garder les mêmes mises en page. */
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

/** Largeur maximale du contenu (apps/web : container 2xl). */
export const contentMaxWidth = 1280;
