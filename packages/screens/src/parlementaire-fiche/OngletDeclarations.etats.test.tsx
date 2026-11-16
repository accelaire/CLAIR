import type { DeclarationHatvp } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ficheExemple } from "./fixtures.ts";
import { OngletDeclarations } from "./OngletDeclarations.tsx";

const [base] = ficheExemple.declarations;
if (!base) throw new Error("fixture sans déclaration");

// Déclarations FICTIVES.
const declarations: DeclarationHatvp[] = [
  base,
  {
    ...base,
    id: "d2",
    typeDocument: "xyz",
    datePublication: null,
    urlDossier: null,
    statut: "En cours",
  },
  { ...base, id: "d3", typeDocument: "dsp", datePublication: null, urlDossier: null, statut: null },
];

describe("OngletDeclarations", () => {
  it("nomme chaque déclaration, sa date ou son statut, et le lien vers hatvp.fr", () => {
    renderScreen(<OngletDeclarations declarations={declarations} />);
    expect(screen.getByRole("heading", { name: "Déclarations à la HATVP" })).toBeInTheDocument();
    expect(screen.getByText("Déclaration d'intérêts et d'activités")).toBeInTheDocument();
    expect(screen.getByText("Publiée le 1 octobre 2024")).toBeInTheDocument();
    expect(screen.getByText("xyz")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.getByText("Déclaration de situation patrimoniale")).toBeInTheDocument();
    expect(screen.getByText("Publication à venir")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Consulter sur hatvp.fr/ })).toHaveLength(1);
  });
});
