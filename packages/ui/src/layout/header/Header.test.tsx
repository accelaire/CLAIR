import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { navigationExemple } from "./fixtures.ts";
import { Header } from "./Header.tsx";

describe("Header", () => {
  it("mène à l'accueil, à la recherche et à l'appel à l'action", () => {
    const { getByRole } = renderWithProviders(
      <Header navigation={navigationExemple} cta={{ label: "Nous soutenir", href: "/soutenir" }} />,
    );
    expect(getByRole("link", { name: "CLAIR, accueil" })).toHaveAttribute("href", "/");
    expect(getByRole("link", { name: "Rechercher" })).toHaveAttribute("href", "/recherche");
    expect(getByRole("link", { name: "Nous soutenir" })).toHaveAttribute("href", "/soutenir");
  });

  it("ouvre une rubrique, liste ses pages et se ferme avec Échap", async () => {
    const { getByRole } = renderWithProviders(<Header navigation={navigationExemple} />);
    const rubrique = getByRole("button", { name: "Parlementaires" });
    await userEvent.click(rubrique);
    expect(rubrique).toHaveAttribute("aria-expanded", "true");
    expect(getByRole("link", { name: "Députés" })).toHaveAttribute("href", "/deputes");
    await userEvent.keyboard("{Escape}");
    expect(rubrique).toHaveAttribute("aria-expanded", "false");
    expect(rubrique).toHaveFocus();
  });

  it("signale la page courante", () => {
    const { getByRole } = renderWithProviders(<Header navigation={navigationExemple} />, {
      pathname: "/lobbying",
    });
    expect(getByRole("link", { name: "Lobbying" })).toHaveAttribute("aria-current", "page");
  });

  it("referme une rubrique quand on la quitte avec Tab", async () => {
    const { getByRole } = renderWithProviders(<Header navigation={navigationExemple} />);
    const rubrique = getByRole("button", { name: "Parlementaires" });
    await userEvent.click(rubrique);
    expect(rubrique).toHaveAttribute("aria-expanded", "true");
    // Dernier lien de la rubrique, puis Tab : le focus sort de la rubrique.
    getByRole("link", { name: "Commissions" }).focus();
    await userEvent.tab();
    expect(rubrique).toHaveAttribute("aria-expanded", "false");
  });

  it("relie chaque rubrique à sa liste par un identifiant valide, même avec des accents", async () => {
    const { getByRole } = renderWithProviders(
      <Header navigation={[{ label: "Données", items: [{ label: "API", href: "/api" }] }]} />,
    );
    const rubrique = getByRole("button", { name: "Données" });
    const id = rubrique.getAttribute("aria-controls") ?? "";
    expect(id).toMatch(/^rubrique-[\w-]+$/);
    expect(document.getElementById(id)).not.toBeNull();
  });

  it("signale la page courante dans le tiroir mobile", async () => {
    const { findByRole } = renderWithProviders(<Header navigation={navigationExemple} />, {
      pathname: "/deputes",
    });
    // Bouton masqué en CSS hors mobile : happy-dom l'exclut des rôles, on le prend par son libellé.
    const burger = document.querySelector<HTMLButtonElement>('[aria-label="Ouvrir le menu"]');
    if (!burger) throw new Error("bouton du menu absent");
    await userEvent.click(burger);
    const tiroir = await findByRole("navigation", { name: "Navigation principale (mobile)" });
    const lien = [...tiroir.querySelectorAll("a")].find((a) => a.textContent === "Députés");
    expect(lien).toHaveAttribute("aria-current", "page");
  });
});
