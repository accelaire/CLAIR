import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ExpandableText } from "./ExpandableText.tsx";

const texte = "Première phrase du texte. Deuxième phrase, nettement plus longue que la limite.";

describe("ExpandableText", () => {
  it("affiche un texte court sans bouton", () => {
    const { getByText, queryByRole } = renderWithProviders(
      <ExpandableText>Texte court.</ExpandableText>,
    );
    expect(getByText("Texte court.")).toBeInTheDocument();
    expect(queryByRole("button")).toBeNull();
  });

  it("replie un texte long au dernier mot entier", () => {
    const { getByText, getByRole } = renderWithProviders(
      <ExpandableText maxLength={30}>{texte}</ExpandableText>,
    );
    expect(getByText("Première phrase du texte.…")).toBeInTheDocument();
    const button = getByRole("button", { name: "Lire la suite" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", getByText(/Première/).id);
  });

  it("déplie puis replie le texte au clavier", async () => {
    const { getByText, getByRole } = renderWithProviders(
      <ExpandableText maxLength={30}>{texte}</ExpandableText>,
    );
    getByRole("button", { name: "Lire la suite" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(getByText(texte)).toBeInTheDocument();
    const button = getByRole("button", { name: "Réduire" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard(" ");
    expect(getByRole("button", { name: "Lire la suite" })).toBeInTheDocument();
  });
});
