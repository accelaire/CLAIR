import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { tableVotesExemple } from "../fixtures.ts";
import { ChartFrame } from "./ChartFrame.tsx";

const renderFrame = () =>
  renderWithProviders(
    <ChartFrame
      title="Votes du groupe par mois"
      subtitle="Session 2024-2025"
      provenance="calculee"
      source={{
        label: "Assemblée nationale, open data",
        href: "https://data.assemblee-nationale.fr",
      }}
      table={tableVotesExemple}
    >
      <div>graphique</div>
    </ChartFrame>,
  );

describe("ChartFrame", () => {
  it("nomme la section par son titre et affiche la nature et la source de la donnée", () => {
    const { getByRole, getByText } = renderFrame();
    expect(getByRole("region", { name: "Votes du groupe par mois" })).toBeInTheDocument();
    expect(
      getByRole("heading", { level: 2, name: "Votes du groupe par mois" }),
    ).toBeInTheDocument();
    expect(getByText("Calculée par CLAIR")).toBeInTheDocument();
    expect(
      getByRole("link", { name: "Assemblée nationale, open data (nouvelle fenêtre)" }),
    ).toHaveAttribute("href", "https://data.assemblee-nationale.fr");
  });

  it("révèle le tableau des données avec « Afficher les données »", async () => {
    const { getByRole, queryByRole } = renderFrame();
    const toggle = getByRole("button", { name: "Afficher les données" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(queryByRole("table")).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Masquer les données");
    const table = getByRole("table", { name: "Votes du groupe par mois (exemple)" });
    expect(table).toBeVisible();
    expect(getByRole("columnheader", { name: "Pour" })).toHaveAttribute("scope", "col");
    expect(getByRole("cell", { name: "42" })).toBeInTheDocument();
  });
});
