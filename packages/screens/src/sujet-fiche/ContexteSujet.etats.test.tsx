import type { SujetDossier } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ContexteSujet } from "./ContexteSujet.tsx";
import { dossiersExemple, sujetExemple } from "./fixtures.ts";

const [an, senat] = dossiersExemple.data;
if (!an || !senat) throw new Error("fixtures incomplètes");

describe("ContexteSujet : états", () => {
  it("enjeux seuls, sans résumé", () => {
    const { getByRole, queryByRole } = renderScreen(
      <ContexteSujet sujet={{ ...sujetExemple, resume: null }} dossiers={[]} />,
    );
    expect(getByRole("heading", { name: "Enjeux" })).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Résumé" })).toBeNull();
  });

  it("résumé seul, sans enjeux", () => {
    const { getByRole, queryByRole } = renderScreen(
      <ContexteSujet sujet={{ ...sujetExemple, enjeux: null }} dossiers={[]} />,
    );
    expect(getByRole("heading", { name: "Résumé" })).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Enjeux" })).toBeNull();
  });

  it("sans texte généré ni dossier : examen sans procédure, un scrutin, sans date", () => {
    const { queryByRole, getByRole, queryByText } = renderScreen(
      <ContexteSujet
        sujet={{
          ...sujetExemple,
          resume: null,
          enjeux: null,
          scrutinCount: 1,
          dateDernierVote: null,
        }}
        dossiers={[]}
      />,
    );
    expect(queryByRole("heading", { name: "En clair" })).toBeNull();
    const examen = getByRole("heading", { name: "Texte en cours d'examen" }).closest("section");
    expect(examen).toHaveTextContent("1 scrutin enregistré.");
    expect(queryByText(/Procédure/)).toBeNull();
    expect(queryByRole("link")).toBeNull();
  });

  it("liens officiels sans doublon : Légifrance, Assemblée, Sénat", () => {
    const dossiers: SujetDossier[] = [
      { ...an, urlLegifrance: "https://example.org/legifrance", procedureLibelle: null },
      { ...an, id: "dossier-exemple-3", urlLegifrance: "https://example.org/legifrance" },
      senat,
    ];
    const { getAllByRole, getByText } = renderScreen(
      <ContexteSujet sujet={sujetExemple} dossiers={dossiers} />,
    );
    const externes = getAllByRole("link").filter((lien) =>
      lien.getAttribute("href")?.startsWith("https://"),
    );
    expect(externes.map((lien) => lien.textContent)).toEqual([
      expect.stringContaining("Consulter sur Légifrance"),
      expect.stringContaining("Dossier de l'Assemblée nationale"),
      expect.stringContaining("Dossier du Sénat"),
    ]);
    expect(getByText("Proposition de loi")).toBeInTheDocument();
  });

  it("loi promulguée : carte de la loi, titre du sujet à défaut de titre de loi", () => {
    const { getByText, queryByRole } = renderScreen(
      <ContexteSujet
        sujet={{ ...sujetExemple, status: "promulgue" }}
        dossiers={[{ ...an, etat: "promulgue", loiNumero: "2026-12" }]}
      />,
    );
    expect(getByText(sujetExemple.label)).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Texte en cours d'examen" })).toBeNull();
  });

  it("loi promulguée avec son titre officiel", () => {
    const { getByText } = renderScreen(
      <ContexteSujet
        sujet={{ ...sujetExemple, status: "promulgue" }}
        dossiers={[
          { ...an, loiNumero: "", loiTitre: "" },
          { ...senat, loiNumero: "2026-12", loiTitre: "Loi d'exemple sur les jardins" },
        ]}
      />,
    );
    expect(getByText("Loi d'exemple sur les jardins")).toBeInTheDocument();
  });

  it("loi promulguée : la suite du nom donnée par la source est précédée de « Loi »", () => {
    const { getByRole } = renderScreen(
      <ContexteSujet
        sujet={{ ...sujetExemple, status: "promulgue" }}
        dossiers={[{ ...an, loiNumero: "2026-12", loiTitre: "de finances d'exemple pour 2026" }]}
      />,
    );
    expect(
      getByRole("heading", { name: "Loi de finances d'exemple pour 2026" }),
    ).toBeInTheDocument();
  });
});
