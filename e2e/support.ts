import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Collecte les erreurs de la page (exceptions et console.error) pour vérifier qu'il n'y en a aucune. */
export const trackErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
};

/** Aucune violation d'accessibilité grave ou critique (règles WCAG 2.1 A et AA). */
export const expectAccessible = async (page: Page, { include }: { include?: string } = {}) => {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  const { violations } = await (include ? builder.include(include) : builder).analyze();
  const serious = violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious.map(
      (violation) =>
        `${violation.id} : ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
};
