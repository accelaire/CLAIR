import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { SoutenirScreen } from "./SoutenirScreen.tsx";

const stats = { scrutins: 12345, amendements: 678, interventions: 90, actionsLobby: 4321 };

const h2s = (headings: HTMLElement[]) => headings.map((h) => h.textContent);

describe("SoutenirScreen", () => {
  it("affiche les chiffres de CLAIR quand la route les fournit", () => {
    const { getByRole, getAllByRole, getByText, getByTitle } = renderScreen(
      <SoutenirScreen initialData={stats} />,
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(
      "CLAIR reste gratuit grâce à vous",
    );
    expect(h2s(getAllByRole("heading", { level: 2 }))).toEqual([
      "Ce que vous trouvez déjà sur CLAIR",
      "Ce que votre don rend possible",
      "Faire un don",
      "Pas de budget ? Aidez autrement",
      "Derrière le projet",
      "Questions fréquentes",
    ]);
    expect(getByText("scrutins analysés")).toBeInTheDocument();
    expect(getByText("12 345")).toBeInTheDocument();
    expect(getByText("4 321")).toBeInTheDocument();
    expect(getByRole("link", { name: "Faire un don" })).toHaveAttribute("href", "#don");
    expect(getByTitle("Formulaire de don HelloAsso")).toHaveAttribute(
      "src",
      expect.stringContaining("helloasso.com"),
    );
  });

  it("reste utilisable sans les chiffres (API indisponible)", () => {
    const { queryByRole, queryByText, getByRole } = renderScreen(<SoutenirScreen />);
    expect(queryByRole("heading", { name: "Ce que vous trouvez déjà sur CLAIR" })).toBeNull();
    expect(queryByText("scrutins analysés")).toBeNull();
    expect(getByRole("heading", { level: 2, name: "Faire un don" })).toBeInTheDocument();
    expect(
      getByRole("button", { name: "Les dons sont-ils déductibles des impôts ?" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
