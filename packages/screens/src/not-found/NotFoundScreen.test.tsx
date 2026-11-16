import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { NotFoundScreen } from "./NotFoundScreen.tsx";

describe("NotFoundScreen", () => {
  it("annonce la page introuvable et propose l'accueil et la recherche", () => {
    const { getByRole } = renderScreen(<NotFoundScreen />);
    expect(getByRole("heading", { level: 1, name: "Page introuvable" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Revenir à l'accueil" })).toHaveAttribute("href", "/");
    expect(getByRole("link", { name: "Faire une recherche" })).toHaveAttribute(
      "href",
      "/recherche",
    );
  });

  it("propose la recherche sur la page et y mène avec la saisie", () => {
    const { getByRole, visited } = renderScreen(<NotFoundScreen />);
    const champ = getByRole("searchbox", { name: /Rechercher un élu/ });
    expect(champ.closest("form")).toHaveAttribute("action", "/recherche");
    fireEvent.change(champ, { target: { value: "jardins" } });
    fireEvent.click(getByRole("button", { name: "Rechercher" }));
    expect(visited).toEqual(["/recherche?q=jardins"]);
  });
});
