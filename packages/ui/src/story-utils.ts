import { expect } from "storybook/test";

/**
 * Vérifie, dans une fonction `play`, qu'un élément atteint au clavier a le focus et que le
 * contour de focus du thème (`:focus-visible`, `--clair-focus-contour`) est bien dessiné.
 * `contour` : l'élément qui porte l'anneau quand il est reporté ailleurs (une carte cliquable
 * le dessine autour de toute la carte, pas autour de son lien).
 * Réservé aux stories : ce fichier n'est pas exporté par `index.ts`.
 */
export const attendreFocusVisible = async (element: Element, contour: Element = element) => {
  await expect(element).toHaveFocus();
  await expect(element.matches(":focus-visible")).toBe(true);
  const style = getComputedStyle(contour);
  await expect(style.outlineStyle).not.toBe("none");
  await expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0);
};

/** Carte cliquable qui contient ce lien : c'est elle qui dessine l'anneau de focus. */
export const carteDe = (lien: Element) => {
  const carte = lien.closest("[data-clickable]");
  if (!carte) throw new Error("Le lien n'est pas dans une carte cliquable");
  return carte;
};
