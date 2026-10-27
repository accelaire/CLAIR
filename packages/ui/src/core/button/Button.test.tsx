import { userEvent } from "@testing-library/user-event";
import { Download } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Button } from "./Button.tsx";

describe("Button", () => {
  it("rend un bouton de type button qui déclenche son action", async () => {
    const onClick = vi.fn();
    const { getByRole } = renderWithProviders(<Button onClick={onClick}>Télécharger</Button>);
    const button = getByRole("button", { name: "Télécharger" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "primaire");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("s'active au clavier", async () => {
    const onClick = vi.fn();
    const { getByRole } = renderWithProviders(<Button onClick={onClick}>Valider</Button>);
    await userEvent.tab();
    expect(getByRole("button", { name: "Valider" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("nomme un bouton à icône seule par son aria-label", () => {
    const { getByRole } = renderWithProviders(
      <Button icon={<Download />} aria-label="Télécharger les données" />,
    );
    expect(getByRole("button", { name: "Télécharger les données" })).toHaveAttribute(
      "data-icon-only",
      "true",
    );
  });

  it("annonce le chargement et n'agit plus", async () => {
    const onClick = vi.fn();
    const { getByRole } = renderWithProviders(
      <Button loading onClick={onClick}>
        Envoyer
      </Button>,
    );
    const button = getByRole("button", { name: "Envoyer" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("désactive le bouton", () => {
    const { getByRole } = renderWithProviders(<Button disabled>Envoyer</Button>);
    expect(getByRole("button", { name: "Envoyer" })).toBeDisabled();
  });

  it("rend un lien interne quand href est fourni", () => {
    const { getByRole } = renderWithProviders(
      <Button href="/soutenir" variant="secondaire">
        Nous soutenir
      </Button>,
    );
    expect(getByRole("link", { name: "Nous soutenir" })).toHaveAttribute("href", "/soutenir");
  });

  it("annonce un lien externe comme ouvrant une nouvelle fenêtre", () => {
    const { getByRole } = renderWithProviders(
      <Button href="https://www.senat.fr" external>
        Site du Sénat
      </Button>,
    );
    const link = getByRole("link", { name: "Site du Sénat (nouvelle fenêtre)" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
