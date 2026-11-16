import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { initialesLobbyiste, LobbyisteLogo } from "./LobbyisteLogo.tsx";

describe("LobbyisteLogo", () => {
  it("nomme le logo d'après le représentant d'intérêts", () => {
    const { getByRole } = renderWithProviders(
      <LobbyisteLogo nom="Fédération Exemple" logoUrl="/logo.png" />,
    );
    expect(getByRole("img", { name: "Logo de Fédération Exemple" })).toBeInTheDocument();
  });

  it("affiche les initiales sans logo", () => {
    const { getByText } = renderWithProviders(<LobbyisteLogo nom="Fédération Exemple" />);
    expect(getByText("FE")).toBeInTheDocument();
  });

  it("prend les deux premiers caractères alphanumériques d'un nom en un mot", () => {
    expect(initialesLobbyiste("1001PACT")).toBe("10");
    expect(initialesLobbyiste("« Exemple » (fictif)")).toBe("EF");
    expect(initialesLobbyiste("X")).toBe("X");
  });

  it("se masque quand il est décoratif", () => {
    const { queryByRole } = renderWithProviders(
      <LobbyisteLogo nom="Fédération Exemple" decorative />,
    );
    expect(queryByRole("img")).toBeNull();
  });

  it("se place dans un titre sans y mettre de div (HTML valide)", () => {
    const { container } = renderWithProviders(
      <h1>
        <LobbyisteLogo nom="Exemple SA" decorative /> Exemple SA
      </h1>,
    );
    expect(container.querySelector("h1 div")).toBeNull();
  });
});
