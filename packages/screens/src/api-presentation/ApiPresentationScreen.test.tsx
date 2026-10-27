import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ApiPresentationScreen } from "./ApiPresentationScreen.tsx";

describe("ApiPresentationScreen", () => {
  it("présente l'API, ses ressources, un exemple et les conditions d'utilisation", () => {
    const { getByRole, getAllByRole, getByText } = renderScreen(<ApiPresentationScreen />);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("L'API ouverte CLAIR");
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Pourquoi une API ouverte ?",
      "Ce que vous pouvez récupérer",
      "Prêt en une ligne",
      "Conditions d'utilisation",
      "Sources des données",
      "Construisons ensemble la transparence",
    ]);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(9);
    expect(getByRole("link", { name: /^Scrutins/ })).toHaveAttribute(
      "href",
      "https://api.clair.vote/api/v1/scrutins?limit=5",
    );
    expect(getByRole("link", { name: /Documentation de l'API/ })).toHaveAttribute(
      "href",
      "https://docs.clair.vote/api",
    );
    expect(getByRole("link", { name: "Soutenir CLAIR" })).toHaveAttribute("href", "/soutenir");
    expect(
      getByText(/curl "https:\/\/api\.clair\.vote\/api\/v1\/scrutins\?limit=5"/),
    ).toBeInTheDocument();
  });
});
