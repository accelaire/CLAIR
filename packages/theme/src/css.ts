import {
  breakpoints,
  type ColorScheme,
  colors,
  contentMaxWidth,
  fonts,
  parliamentaryGroups,
  radius,
  shadows,
  spacing,
  typeScale,
  voteChartColors,
} from "./tokens.ts";

const px = (value: number) => `${value}px`;

type Variable = [string, string];

/** Variables qui ne changent pas avec le thème. */
const sharedVariables = (): Variable[] => [
  ...Object.entries(voteChartColors).map(
    ([name, value]): Variable => [`--clair-graphique-vote-${name}`, value],
  ),
  ...Object.entries(parliamentaryGroups).map(
    ([code, group]): Variable => [`--clair-groupe-${code.toLowerCase()}`, group.color],
  ),
  ["--clair-police-interface", fonts.interface],
  ["--clair-police-code", fonts.code],
  ...Object.entries(typeScale).flatMap(([name, style]): Variable[] => [
    [`--clair-texte-${name}-taille`, px(style.size)],
    [`--clair-texte-${name}-interligne`, px(style.lineHeight)],
    [`--clair-texte-${name}-graisse`, String(style.weight)],
  ]),
  ...Object.entries(spacing).map(
    ([name, value]): Variable => [`--clair-espacement-${name}`, px(value)],
  ),
  ...Object.entries(radius).map(([name, value]): Variable => [`--clair-rayon-${name}`, px(value)]),
  ...Object.entries(shadows).map(([name, value]): Variable => [`--clair-ombre-${name}`, value]),
  ...Object.entries(breakpoints).map(
    ([name, value]): Variable => [`--clair-rupture-${name}`, px(value)],
  ),
  ["--clair-largeur-contenu", px(contentMaxWidth)],
  /** Épaisseur d'un trait, pour composer une bordure (`--clair-trait-*` sont des bordures complètes). */
  ["--clair-trait-epaisseur", "1px"],
  ["--clair-focus-epaisseur", "2px"],
  ["--clair-focus-decalage", "2px"],
];

/** Variables de couleur d'un thème, et traits qui en dépendent. */
const schemeVariables = (scheme: ColorScheme): Variable[] => {
  const c = colors[scheme];
  return [
    ...Object.entries(c).map(([name, value]): Variable => [`--clair-${name}`, value]),
    ["--clair-trait-defaut", `1px solid ${c["bordure-defaut"]}`],
    ["--clair-trait-fort", `1px solid ${c["bordure-forte"]}`],
    ["--clair-focus-contour", `2px solid ${c.focus}`],
  ];
};

/** Toutes les variables CSS `--clair-*` du thème clair, dans l'ordre d'affichage. */
export const cssVariables = (): Variable[] => [...schemeVariables("clair"), ...sharedVariables()];

const block = (selector: string, variables: Variable[]) =>
  [`${selector} {`, ...variables.map(([name, value]) => `  ${name}: ${value};`), "}"].join("\n");

/**
 * Contenu de `tokens.css` : thème clair par défaut, thème sombre sous
 * `[data-mantine-color-scheme="dark"]` (attribut posé par Mantine sur `<html>`, ou sur un
 * conteneur d'aperçu dans la documentation).
 */
export const tokensCss = () =>
  [
    "/* Fichier généré par `pnpm --filter @clair/theme generate` depuis src/tokens.ts. Ne pas modifier. */",
    block(':root,\n[data-mantine-color-scheme="light"]', cssVariables()),
    "",
    block('[data-mantine-color-scheme="dark"]', schemeVariables("sombre")),
    "",
  ].join("\n");
