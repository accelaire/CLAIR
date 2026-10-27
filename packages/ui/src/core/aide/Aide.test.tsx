import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Aide } from "./Aide.tsx";

describe("Aide", () => {
  it("nomme le bouton d'aide par son sujet", () => {
    const { getByRole } = renderWithProviders(
      <Aide label="taux de participation">Part des scrutins votés.</Aide>,
    );
    const button = getByRole("button", { name: "Aide : taux de participation" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("s'ouvre avec Entrée, se ferme avec Échap et rend le focus", async () => {
    const { getByRole, findByRole } = renderWithProviders(
      <Aide label="taux de participation" learnMoreHref="/comprendre">
        Part des scrutins votés.
      </Aide>,
    );
    const button = getByRole("button", { name: "Aide : taux de participation" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    const dialog = await findByRole("dialog", { hidden: true });
    expect(dialog).toHaveTextContent("Part des scrutins votés.");
    expect(dialog).toHaveAttribute("aria-labelledby", button.id);
    expect(getByRole("link", { name: "En savoir plus", hidden: true })).toHaveAttribute(
      "href",
      "/comprendre",
    );
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });
});
