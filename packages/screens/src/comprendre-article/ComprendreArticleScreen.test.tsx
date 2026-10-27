import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { COMPRENDRE_ARTICLES, type ComprendreSlug } from "./articles/index.ts";
import { ComprendreArticleScreen } from "./ComprendreArticleScreen.tsx";

describe("ComprendreArticleScreen", () => {
  it.each(Object.keys(COMPRENDRE_ARTICLES) as ComprendreSlug[])(
    "affiche la fiche %s avec fil d'Ariane et intertitres",
    (slug) => {
      const article = COMPRENDRE_ARTICLES[slug];
      expect(article.slug).toBe(slug);
      const { getByRole, getAllByRole } = renderScreen(<ComprendreArticleScreen slug={slug} />);
      expect(getByRole("heading", { level: 1 })).toHaveTextContent(article.title);
      const breadcrumb = getByRole("navigation", { name: "Fil d'Ariane" });
      expect(breadcrumb).toHaveTextContent("Comprendre");
      const h2 = getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      for (const section of article.sections) expect(h2).toContain(section.title);
      const [primary] = article.actions;
      if (primary) {
        expect(getByRole("link", { name: primary.label })).toHaveAttribute("href", primary.href);
      }
    },
  );

  it("relie les fiches voisines", () => {
    const { getByRole } = renderScreen(<ComprendreArticleScreen slug="parlementaire" />);
    const nav = getByRole("navigation", { name: "Autres fiches Comprendre" });
    expect(nav.querySelector('a[href="/comprendre/parlement"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/comprendre/scrutin"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/comprendre"]')).not.toBeNull();
  });

  it("garde les ancres citées ailleurs et déplie la liste des sorts", async () => {
    const { getByRole, getByText, queryByText } = renderScreen(
      <ComprendreArticleScreen slug="dossier-legislatif" />,
    );
    expect(document.getElementById("amendements-sort")).not.toBeNull();
    expect(queryByText("En traitement")).toBeNull();
    const more = getByRole("button", { name: "Voir 28 autres sorts" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    expect(getByText("En traitement")).toBeInTheDocument();
    expect(getByRole("button", { name: "Masquer" })).toHaveAttribute("aria-expanded", "true");
  });

  it("affiche l'encart de données en direct des commissions", () => {
    const { getByRole } = renderScreen(<ComprendreArticleScreen slug="commissions" />);
    expect(document.getElementById("saisine")).not.toBeNull();
    expect(getByRole("link", { name: "Voir les commissions" })).toHaveAttribute(
      "href",
      "/commissions",
    );
    expect(getByRole("link", { name: "Consulter l'agenda" })).toHaveAttribute("href", "/agenda");
  });
});
