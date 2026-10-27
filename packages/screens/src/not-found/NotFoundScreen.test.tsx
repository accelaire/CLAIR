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
});
