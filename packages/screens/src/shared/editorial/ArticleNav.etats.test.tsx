import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { ArticleNav, neighboursOf } from "./ArticleNav.tsx";
import { Steps } from "./Steps.tsx";

const index = { title: "Toutes les fiches", href: "/comprendre" };

describe("ArticleNav", () => {
  it("propose la fiche précédente, la rubrique et la suivante", () => {
    renderScreen(
      <ArticleNav
        label="Autres fiches"
        index={index}
        previous={{ title: "Fiche A", href: "/comprendre/a" }}
        next={{ title: "Fiche C", href: "/comprendre/c" }}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Autres fiches" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Précédent.*Fiche A/ })).toHaveAttribute(
      "href",
      "/comprendre/a",
    );
    expect(screen.getByRole("link", { name: /Suivant.*Fiche C/ })).toHaveAttribute(
      "href",
      "/comprendre/c",
    );
    expect(screen.getByRole("link", { name: "Toutes les fiches" })).toBeInTheDocument();
  });

  it("n'a que le lien de la rubrique aux deux bouts", () => {
    renderScreen(<ArticleNav label="Autres fiches" index={index} previous={null} next={null} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("neighboursOf", () => {
  const fiches = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];

  it("trouve les voisines d'une fiche", () => {
    expect(neighboursOf(fiches, "a")).toEqual({ previous: null, next: { slug: "b" } });
    expect(neighboursOf(fiches, "b")).toEqual({ previous: { slug: "a" }, next: { slug: "c" } });
    expect(neighboursOf(fiches, "c")).toEqual({ previous: { slug: "b" }, next: null });
  });

  it("n'a aucune voisine pour une fiche inconnue", () => {
    expect(neighboursOf(fiches, "z")).toEqual({ previous: null, next: null });
  });
});

describe("Steps", () => {
  const steps = [
    { title: "Dépôt", description: "Le texte est déposé." },
    { title: "Examen", description: [{ strong: "En commission" }, " puis en séance."] as const },
  ];

  it("numérote les étapes avec des titres de niveau 3 par défaut", () => {
    renderScreen(<Steps steps={steps} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.getByText("Le texte est déposé.")).toBeInTheDocument();
    expect(screen.getByText("En commission")).toBeInTheDocument();
  });

  it("suit la hiérarchie demandée", () => {
    renderScreen(<Steps steps={steps} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Dépôt" })).toBeInTheDocument();
  });
});
