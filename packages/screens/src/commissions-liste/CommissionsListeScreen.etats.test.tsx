import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CommissionsListeScreen } from "./CommissionsListeScreen.tsx";
import { commissionExemple, pageCommissions } from "./fixtures.ts";
import { typeCommission } from "./libelles.ts";

// Organe fictif inactif, sans date de début, d'un type inconnu.
const organePasse = {
  ...commissionExemple,
  id: "commission-exemple-3",
  slug: "assemblee-organe-passe-exemple",
  nom: "Organe passé d'exemple",
  type: "type_exemple",
  actif: false,
  dateDebut: null,
};

describe("CommissionsListeScreen : états", () => {
  it("organes passés inclus : carte inactive, section des types inconnus, retrait du filtre", async () => {
    const { findByRole, getByRole, getByText, visited } = renderScreen(
      <CommissionsListeScreen params={{ historique: "1", type: "permanente" }} />,
      { routes: { "/commissions": pageCommissions([organePasse]) }, pathname: "/commissions" },
    );
    // Type inconnu : rangé dans une section « inconnu », ouverte par le filtre de type.
    const bascule = await findByRole("button", { name: /inconnu/ });
    expect(bascule).toHaveAttribute("aria-expanded", "true");
    expect(getByText("Inactive")).toBeInTheDocument();
    expect(
      getByText(/1 organe \(actifs et passés\) correspondant aux filtres/),
    ).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /Organes passés inclus/ }));
    expect(visited).toEqual(["/commissions?type=permanente"]);
  });

  it("aucune commission sans filtre : message général", async () => {
    const { findByText, queryByRole } = renderScreen(<CommissionsListeScreen />, {
      routes: { "/commissions": pageCommissions([]) },
      pathname: "/commissions",
    });
    expect(
      await findByText("Aucune commission n'est disponible pour le moment."),
    ).toBeInTheDocument();
    expect(queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
  });

  it("revient à « tous les types »", async () => {
    const { findByLabelText, visited } = renderScreen(
      <CommissionsListeScreen params={{ type: "permanente" }} />,
      {
        routes: { "/commissions": pageCommissions([commissionExemple]) },
        pathname: "/commissions",
      },
    );
    fireEvent.change(await findByLabelText("Type d'organe"), { target: { value: "" } });
    expect(visited).toEqual(["/commissions"]);
  });

  it("un type inconnu garde son code", () => {
    expect(typeCommission("type_exemple")).toEqual({
      section: "type_exemple",
      filtre: "type_exemple",
      singulier: "type_exemple",
    });
  });
});
