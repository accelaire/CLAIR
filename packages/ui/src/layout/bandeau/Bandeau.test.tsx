import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Bandeau } from "./Bandeau.tsx";

describe("Bandeau", () => {
  it("annonce un direct par un texte, pas seulement par la couleur", () => {
    const { getByRole } = renderWithProviders(
      <Bandeau tone="direct" link={{ href: "/elections", label: "Suivre les résultats" }}>
        Les résultats arrivent, circonscription par circonscription.
      </Bandeau>,
    );
    const region = getByRole("region", { name: "En direct" });
    expect(region).toHaveTextContent("En direct");
    expect(region).toHaveAttribute("data-tone", "direct");
    expect(getByRole("link", { name: "Suivre les résultats" })).toHaveAttribute(
      "href",
      "/elections",
    );
  });

  it("place le message dans une zone annoncée", () => {
    const { getByText } = renderWithProviders(<Bandeau>Maintenance prévue ce soir.</Bandeau>);
    expect(getByText("Maintenance prévue ce soir.").closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("n'est pas fermable par défaut", () => {
    const { queryByRole } = renderWithProviders(<Bandeau>Annonce</Bandeau>);
    expect(queryByRole("button")).toBeNull();
  });

  it("se masque et prévient l'application", async () => {
    const onDismiss = vi.fn();
    const { getByRole, queryByRole } = renderWithProviders(
      <Bandeau dismissible onDismiss={onDismiss}>
        Annonce
      </Bandeau>,
    );
    await userEvent.click(getByRole("button", { name: "Masquer le bandeau" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(queryByRole("region", { name: "Annonce" })).toBeNull();
  });
});
