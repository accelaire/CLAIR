import { ApiError } from "@clair/api-client";
import type { PriseDeParoleReunion } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { debatExemple } from "./fixtures.ts";
import { PriseDeParole } from "./PriseDeParole.tsx";

const [base] = debatExemple.data;
if (!base) throw new Error("fixture vide");

/** Prise FICTIVE sans parlementaire relié. */
const anonyme: PriseDeParoleReunion = {
  ...base,
  id: "anonyme",
  ordre: null,
  parlementaire: null,
  orateurPrenom: null,
  orateurNom: null,
  orateurGroupe: "GRP",
  orateurQualite: "Rapporteur",
  hasMore: false,
  sourceUrl: "https://compte-rendu.exemple.test/1",
};

describe("PriseDeParole", () => {
  it("présente un orateur non identifié, son groupe, sa qualité et la source", () => {
    const { getByRole, getByText } = renderScreen(<PriseDeParole prise={anonyme} />);
    expect(
      getByRole("article", { name: "Prise de parole de Orateur non identifié" }),
    ).toBeInTheDocument();
    expect(getByText("GRP")).toBeInTheDocument();
    expect(getByText("Rapporteur")).toBeInTheDocument();
    expect(getByRole("link", { name: /Compte rendu officiel/ })).toHaveAttribute(
      "href",
      "https://compte-rendu.exemple.test/1",
    );
    expect(getByRole("article")).not.toHaveTextContent("…");
  });

  it("nomme l'orateur écrit au compte rendu", () => {
    const { getByText } = renderScreen(
      <PriseDeParole prise={{ ...anonyme, orateurPrenom: "Alex", orateurNom: "Modèle" }} />,
    );
    expect(getByText("Alex Modèle")).toBeInTheDocument();
  });

  it("dit que la suite n'a pas pu être chargée", async () => {
    const { getByRole, findByText } = renderScreen(
      <PriseDeParole prise={{ ...anonyme, hasMore: true, sourceUrl: null }} />,
      {
        routes: {
          "/scrutins/interventions/anonyme": () => Promise.reject(new ApiError(500, "x")),
        },
      },
    );
    fireEvent.click(getByRole("button", { name: "Lire la suite" }));
    expect(await findByText("La suite n'a pas pu être chargée.")).toBeInTheDocument();
  });
});
