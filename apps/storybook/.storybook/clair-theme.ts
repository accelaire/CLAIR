import { colors, fonts, palette } from "@clair/theme/tokens";
import { create } from "storybook/theming/create";

const commun = {
  brandTitle: "CLAIR — Design system",
  brandUrl: "https://docs.clair.vote/front",
  brandTarget: "_self",
  fontBase: fonts.interface,
  fontCode: fonts.code,
  appBorderRadius: 8,
  inputBorderRadius: 6,
} as const;

/** Thèmes de l'interface Storybook, équivalents de dsfr-theme.js, aux couleurs de CLAIR. */
export const clairTheme = create({
  ...commun,
  base: "light",
  colorPrimary: palette["bleu-600"],
  colorSecondary: palette["bleu-700"],
  appBg: colors.clair["fond-neutre"],
  appContentBg: colors.clair["fond-surface"],
  appPreviewBg: colors.clair["fond-page"],
  appBorderColor: colors.clair["bordure-defaut"],
  textColor: colors.clair["texte-defaut"],
  textMutedColor: colors.clair["texte-mention"],
  barBg: colors.clair["fond-surface"],
  barTextColor: colors.clair["texte-mention"],
  barSelectedColor: colors.clair["texte-action"],
  inputBg: colors.clair["fond-surface"],
  inputBorder: colors.clair["bordure-defaut"],
});

export const sombreTheme = create({
  ...commun,
  base: "dark",
  colorPrimary: palette["bleu-400"],
  colorSecondary: palette["bleu-400"],
  appBg: colors.sombre["fond-page"],
  appContentBg: colors.sombre["fond-surface"],
  appPreviewBg: colors.sombre["fond-page"],
  appBorderColor: colors.sombre["bordure-defaut"],
  textColor: colors.sombre["texte-defaut"],
  textMutedColor: colors.sombre["texte-mention"],
  barBg: colors.sombre["fond-surface"],
  barTextColor: colors.sombre["texte-mention"],
  barSelectedColor: colors.sombre["texte-action"],
  inputBg: colors.sombre["fond-neutre"],
  inputBorder: colors.sombre["bordure-forte"],
});

/** Thème de l'interface selon la préférence du système. */
export const preferredTheme = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? sombreTheme
    : clairTheme;
