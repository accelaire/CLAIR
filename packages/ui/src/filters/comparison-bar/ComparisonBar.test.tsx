import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { ComparisonBar } from "./ComparisonBar.tsx";

const camille = { id: "camille-exemple", name: "Camille Exemple", detail: "SOC" };
const dominique = { id: "dominique-modele", name: "Dominique Modèle" };

describe("ComparisonBar", () => {
  it("n'affiche rien sans sélection", () => {
    const { queryByRole } = renderWithProviders(
      <ComparisonBar items={[]} onRemove={() => {}} compareHref="/comparer" />,
    );
    expect(queryByRole("region", { name: "Comparaison" })).toBeNull();
    expect(queryByRole("button", { name: "Comparer" })).toBeNull();
  });

  it("désactive « Comparer » sous deux élus et l'explique", () => {
    const { getByRole } = renderWithProviders(
      <ComparisonBar items={[camille]} onRemove={() => {}} compareHref="/comparer" />,
    );
    expect(getByRole("status")).toHaveTextContent("1 élu sélectionné sur 4");
    const compare = getByRole("button", { name: "Comparer" });
    expect(compare).toBeDisabled();
    expect(compare).toHaveAccessibleDescription("Sélectionnez au moins 2 élus pour les comparer.");
  });

  it("mène à la comparaison à partir de deux élus", () => {
    const { getByRole, getByText } = renderWithProviders(
      <ComparisonBar
        items={[camille, dominique]}
        onRemove={() => {}}
        compareHref="/comparer?elus=a,b"
        max={2}
        noun={["député", "députés"]}
      />,
    );
    expect(getByRole("region", { name: "Comparaison" })).toBeInTheDocument();
    expect(getByRole("link", { name: "Comparer" })).toHaveAttribute("href", "/comparer?elus=a,b");
    expect(getByText("Maximum atteint : 2 députés.")).toBeInTheDocument();
  });

  it("retire un élu ou toute la sélection", async () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    const { getByRole } = renderWithProviders(
      <ComparisonBar
        items={[camille, dominique]}
        onRemove={onRemove}
        onClear={onClear}
        compareHref="/comparer"
      />,
    );
    expect(getByRole("list", { name: "Élus sélectionnés" }).querySelectorAll("li")).toHaveLength(2);
    await userEvent.click(
      getByRole("button", { name: "Retirer Camille Exemple de la comparaison" }),
    );
    expect(onRemove).toHaveBeenCalledWith("camille-exemple");
    await userEvent.click(getByRole("button", { name: "Tout retirer" }));
    expect(onClear).toHaveBeenCalled();
  });
});
