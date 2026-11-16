import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ErrorScreen } from "./ErrorScreen.tsx";

describe("ErrorScreen : sans nouvelle tentative", () => {
  it("propose seulement le retour à l'accueil", () => {
    const { getByRole, queryByRole } = renderScreen(<ErrorScreen />);
    expect(queryByRole("button", { name: "Réessayer" })).toBeNull();
    expect(getByRole("link", { name: "Revenir à l'accueil" })).toHaveAttribute("href", "/");
  });
});
