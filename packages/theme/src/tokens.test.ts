import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";
import { cssVariables, tokensCss } from "./css.ts";
import { type ColorScheme, type ColorToken, colors, voteChartColors } from "./tokens.ts";

describe("tokens.css", () => {
  it("est à jour avec tokens.ts (sinon : pnpm --filter @clair/theme generate)", () => {
    const onDisk = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
    expect(onDisk).toBe(tokensCss());
  });

  it("ne déclare jamais deux fois la même variable", () => {
    const names = cssVariables().map(([name]) => name);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it("définit les mêmes rôles de couleur en clair et en sombre", () => {
    expect(Object.keys(colors.sombre).sort()).toEqual(Object.keys(colors.clair).sort());
  });
});

/** Texte sur fond : WCAG AA exige 4,5:1. */
const textPairs: [ColorToken, ColorToken][] = [
  ["texte-defaut", "fond-page"],
  ["texte-defaut", "fond-surface"],
  ["texte-defaut", "fond-neutre"],
  ["texte-titre", "fond-page"],
  ["texte-mention", "fond-page"],
  ["texte-mention", "fond-surface"],
  ["texte-mention", "fond-neutre"],
  ["texte-action", "fond-page"],
  ["texte-action", "fond-surface"],
  ["texte-action", "fond-neutre"],
  ["texte-sur-action", "fond-action"],
  ["texte-sur-action", "fond-action-survol"],
  ...(["succes", "erreur", "avertissement", "info", "neutre"] as const).map(
    (status): [ColorToken, ColorToken] => [`statut-${status}`, `statut-${status}-fond`],
  ),
  ...(["assemblee", "senat"] as const).map((chamber): [ColorToken, ColorToken] => [
    `chambre-${chamber}`,
    `chambre-${chamber}-fond`,
  ]),
  ...(["pour", "contre", "abstention", "absent"] as const).map((vote): [ColorToken, ColorToken] => [
    `vote-${vote}`,
    `vote-${vote}-fond`,
  ]),
];

const schemes: ColorScheme[] = ["clair", "sombre"];

describe.each(schemes)("contrastes du thème %s (WCAG AA)", (scheme) => {
  it.each(textPairs)("%s sur %s ≥ 4,5:1", (fg, bg) => {
    expect(contrastRatio(colors[scheme][fg], colors[scheme][bg])).toBeGreaterThanOrEqual(4.5);
  });

  const fonds: ColorToken[] = ["fond-page", "fond-surface", "fond-neutre"];

  /** Éléments graphiques et contours de composants : WCAG 1.4.11 exige 3:1. */
  it.each(fonds)("la bordure forte (champs, sièges vacants) se voit sur %s (≥ 3:1)", (fond) => {
    expect(
      contrastRatio(colors[scheme]["bordure-forte"], colors[scheme][fond]),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(
    fonds.flatMap((fond) =>
      Object.entries(voteChartColors).map(([vote, couleur]) => [vote, couleur, fond]),
    ),
  )("la couleur de graphique « %s » (%s) se voit sur %s (≥ 3:1)", (_vote, couleur, fond) => {
    expect(contrastRatio(couleur, colors[scheme][fond as ColorToken])).toBeGreaterThanOrEqual(3);
  });

  it("le focus se voit sur le fond de page (≥ 3:1)", () => {
    expect(contrastRatio(colors[scheme].focus, colors[scheme]["fond-page"])).toBeGreaterThanOrEqual(
      3,
    );
  });
});
