import { within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { MethodologieScreen } from "./MethodologieScreen.tsx";

describe("MethodologieScreen", () => {
  it("présente les sources, la synchronisation, l'IA, le modèle, la stack et les limites", () => {
    const { getByRole, getAllByRole, container } = renderScreen(<MethodologieScreen />);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Méthodologie");
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Sommaire",
      "Sources de données",
      "Synchronisation des données",
      "Enrichissement par intelligence artificielle",
      "Modèle de données",
      "Stack technique",
      "Limitations et transparence",
    ]);
    expect(getByRole("link", { name: /data\.assemblee-nationale\.fr/ })).toHaveAttribute(
      "href",
      "https://data.assemblee-nationale.fr",
    );
    expect(getByRole("link", { name: /Mistral AI/ })).toHaveAttribute("target", "_blank");
    expect(getByRole("heading", { level: 4, name: "Note sur le comptage" })).toBeInTheDocument();
    expect(container.querySelector("#hatvp")).not.toBeNull();
    expect(container.querySelector("#enrichissement-ia")).not.toBeNull();
  });

  it("ouvre sur un sommaire dont chaque lien mène à une section de la page", () => {
    const { getByRole, container } = renderScreen(<MethodologieScreen />);
    const liens = within(getByRole("navigation", { name: "Sommaire" })).getAllByRole("link");
    expect(liens).toHaveLength(6);
    for (const lien of liens) {
      const ancre = lien.getAttribute("href") ?? "";
      expect(container.querySelector(ancre)).not.toBeNull();
    }
  });
});
