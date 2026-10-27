import { type CSSVariablesResolver, createTheme, type MantineColorsTuple } from "@mantine/core";
import {
  breakpoints,
  colors,
  fonts,
  palette,
  radius,
  shadows,
  spacing,
  typeScale,
} from "./tokens.ts";

const rem = (value: number) => `${value / 16}rem`;
const em = (value: number) => `${value / 16}em`;

/** Teintes du bleu CLAIR ; l'index 6 est la couleur d'action (`--clair-fond-action`). */
const bleu: MantineColorsTuple = [
  palette["bleu-50"],
  palette["bleu-100"],
  palette["bleu-200"],
  palette["bleu-300"],
  palette["bleu-400"],
  palette["bleu-500"],
  palette["bleu-600"],
  palette["bleu-700"],
  palette["bleu-800"],
  palette["bleu-900"],
];

const heading = (style: { size: number; lineHeight: number; weight: number }) => ({
  fontSize: rem(style.size),
  lineHeight: `${style.lineHeight / style.size}`,
  fontWeight: String(style.weight),
});

/**
 * Gris du thème sombre de Mantine (champs, menus, bulles, calendriers, tiroirs), pris dans la
 * palette « nuit » : sans eux, ces composants garderaient les gris neutres de Mantine.
 * 0-2 : textes, 3 : texte indicatif, 4 : bordures (3:1), 5 : survol, 6 : fond des champs,
 * 7 : surfaces flottantes, 8-9 : fonds.
 */
const dark: MantineColorsTuple = [
  palette.blanc,
  "#C5C7CB",
  palette["nuit-400"],
  palette["nuit-400"],
  palette["nuit-500"],
  palette["nuit-700"],
  palette["nuit-800"],
  palette["nuit-900"],
  palette["nuit-950"],
  "#08090C",
];

/** Thème Mantine construit sur les tokens. */
export const theme = createTheme({
  primaryColor: "bleu",
  primaryShade: 6,
  colors: { bleu, dark },
  black: colors.clair["texte-defaut"],
  white: palette.blanc,
  fontFamily: fonts.interface,
  fontFamilyMonospace: fonts.code,
  headings: {
    fontFamily: fonts.interface,
    sizes: {
      h1: heading(typeScale.h1),
      h2: heading(typeScale.h2),
      h3: heading(typeScale.h3),
      h4: heading(typeScale.h4),
      h5: heading(typeScale.h5),
      h6: heading(typeScale.h6),
    },
  },
  fontSizes: {
    xs: rem(typeScale.xs.size),
    sm: rem(typeScale.sm.size),
    md: rem(typeScale.md.size),
    lg: rem(typeScale.lg.size),
    xl: rem(typeScale.h4.size),
  },
  lineHeights: { xs: "1.33", sm: "1.43", md: "1.5", lg: "1.56", xl: "1.4" },
  spacing: {
    xs: rem(spacing["2v"]),
    sm: rem(spacing["3v"]),
    md: rem(spacing["4v"]),
    lg: rem(spacing["6v"]),
    xl: rem(spacing["8v"]),
  },
  radius: {
    xs: rem(radius.sm),
    sm: rem(radius.md),
    md: rem(radius.lg),
    lg: rem(radius.xl),
    xl: rem(16),
  },
  defaultRadius: "md",
  shadows: { xs: shadows.sm, sm: shadows.sm, md: shadows.md, lg: shadows.lg, xl: shadows.lg },
  // Mêmes noms et mêmes valeurs que les CSS modules (`breakpoints` des tokens : 640, 768, 1024,
  // 1280) : `visibleFrom="md"` et `@media (min-width: 768px)` désignent le même écran. xs garde la
  // valeur de Mantine.
  breakpoints: {
    xs: em(576),
    sm: em(breakpoints.sm),
    md: em(breakpoints.md),
    lg: em(breakpoints.lg),
    xl: em(breakpoints.xl),
  },
  focusRing: "auto",
  cursorType: "pointer",
});

/** Aligne les variables de Mantine sur les tokens, dans les deux thèmes. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": colors.clair["fond-page"],
    "--mantine-color-text": colors.clair["texte-defaut"],
    "--mantine-color-dimmed": colors.clair["texte-mention"],
    "--mantine-color-default-border": colors.clair["bordure-defaut"],
    "--mantine-color-anchor": colors.clair["texte-action"],
  },
  dark: {
    "--mantine-color-body": colors.sombre["fond-page"],
    "--mantine-color-text": colors.sombre["texte-defaut"],
    "--mantine-color-dimmed": colors.sombre["texte-mention"],
    "--mantine-color-default-border": colors.sombre["bordure-defaut"],
    "--mantine-color-anchor": colors.sombre["texte-action"],
  },
});
