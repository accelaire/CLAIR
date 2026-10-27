import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { EmptyState, ErrorState, LoadingState } from "./QueryStates.tsx";

describe("LoadingState", () => {
  it("annonce le chargement aux lecteurs d'écran", () => {
    const { getByRole } = renderWithProviders(<LoadingState label="Chargement des scrutins…" />);
    const status = getByRole("status");
    expect(status).toHaveTextContent("Chargement des scrutins…");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("masque les squelettes et garde le message lu", () => {
    const { getByRole, container } = renderWithProviders(
      <LoadingState variant="skeleton" lines={4} />,
    );
    expect(getByRole("status")).toHaveTextContent("Chargement en cours…");
    const skeleton = container.querySelector("[aria-hidden='true']");
    expect(skeleton?.children).toHaveLength(4);
  });
});

describe("ErrorState", () => {
  it("annonce l'erreur et relance la requête", async () => {
    const onRetry = vi.fn();
    const { getByRole } = renderWithProviders(<ErrorState onRetry={onRetry} />);
    expect(getByRole("alert")).toHaveTextContent("Le chargement a échoué");
    await userEvent.click(getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("n'affiche pas de bouton sans relance possible", () => {
    const { queryByRole } = renderWithProviders(<ErrorState title="Page indisponible" />);
    expect(queryByRole("button")).toBeNull();
  });
});

describe("EmptyState", () => {
  it("affiche le titre, la description et l'action", () => {
    const { getByText, getByRole } = renderWithProviders(
      <EmptyState
        title="Aucun scrutin trouvé"
        description="Essayez d'autres filtres."
        action={<button type="button">Effacer les filtres</button>}
      />,
    );
    expect(getByText("Aucun scrutin trouvé")).toBeInTheDocument();
    expect(getByText("Essayez d'autres filtres.")).toBeInTheDocument();
    expect(getByRole("button", { name: "Effacer les filtres" })).toBeInTheDocument();
  });
});
