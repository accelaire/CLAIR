import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { LEGAL_PAGES, type LegalPageSlug, PageLegaleScreen } from "./PageLegaleScreen.tsx";

describe("PageLegaleScreen", () => {
  it.each(Object.keys(LEGAL_PAGES) as LegalPageSlug[])(
    "affiche %s : titre, date, sommaire et sections",
    (page) => {
      const content = LEGAL_PAGES[page];
      const { getByRole, getAllByRole, getByText } = renderScreen(<PageLegaleScreen page={page} />);
      expect(getByRole("heading", { level: 1 })).toHaveTextContent(content.title);
      expect(getByText(`Dernière mise à jour : ${content.updatedAt}`)).toBeInTheDocument();
      expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
        "Sommaire",
        ...content.sections.map((section) => section.title),
      ]);
      const toc = getByRole("navigation", { name: "Sommaire" });
      for (const section of content.sections) {
        expect(
          getAllByRole("link", { name: section.title }).some(
            (link) => toc.contains(link) && link.getAttribute("href") === `#${section.id}`,
          ),
        ).toBe(true);
        expect(document.getElementById(section.id)).not.toBeNull();
      }
    },
  );

  it("garde les liens des CGU vers la confidentialité et le contact", () => {
    const { getByRole } = renderScreen(<PageLegaleScreen page="cgu" />);
    expect(getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute(
      "href",
      "/confidentialite",
    );
    expect(getByRole("link", { name: "contact@clair.vote" })).toHaveAttribute(
      "href",
      "mailto:contact@clair.vote",
    );
  });

  it("garde les coordonnées de l'éditeur dans les mentions légales", () => {
    const { getByText } = renderScreen(<PageLegaleScreen page="mentions-legales" />);
    expect(getByText(/W751282503/)).toBeInTheDocument();
  });
});
