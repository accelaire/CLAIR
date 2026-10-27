import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { AppShell } from "./AppShell.tsx";

describe("AppShell", () => {
  it("relie le lien d'évitement au contenu principal", () => {
    const { getByRole } = renderWithProviders(
      <AppShell header={<header>En-tête</header>} footer={<footer>Pied</footer>}>
        <h1>Page</h1>
      </AppShell>,
    );
    expect(getByRole("link", { name: "Aller au contenu" })).toHaveAttribute("href", "#contenu");
    expect(getByRole("main")).toHaveAttribute("id", "contenu");
  });
});
