import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { GUIDE_ARTICLES, type GuideSlug } from "./articles/index.ts";
import { GuideArticleScreen } from "./GuideArticleScreen.tsx";

describe("GuideArticleScreen", () => {
  it.each(Object.keys(GUIDE_ARTICLES) as GuideSlug[])(
    "affiche le parcours %s : étapes en intertitres et lien pour commencer",
    (slug) => {
      const article = GUIDE_ARTICLES[slug];
      expect(article.slug).toBe(slug);
      const { getByRole, getAllByRole } = renderScreen(<GuideArticleScreen slug={slug} />);
      expect(getByRole("heading", { level: 1 })).toHaveTextContent(article.title);
      expect(getByRole("navigation", { name: "Fil d'Ariane" })).toHaveTextContent("Guide pratique");
      expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
        article.steps.map((step) => step.title),
      );
      expect(
        getByRole("link", { name: new RegExp(`^Commencer.*${article.start.label}$`) }),
      ).toHaveAttribute("href", article.start.href);
    },
  );

  it("relie les parcours voisins", () => {
    const { getByRole } = renderScreen(<GuideArticleScreen slug="decouvrir-mon-depute" />);
    const nav = getByRole("navigation", { name: "Autres parcours du guide" });
    expect(nav).not.toHaveTextContent("Précédent");
    expect(nav.querySelector('a[href="/guide/suivre-un-sujet"]')).not.toBeNull();
  });
});
