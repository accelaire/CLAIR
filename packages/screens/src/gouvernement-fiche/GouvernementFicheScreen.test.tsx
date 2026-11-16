import { ApiError } from "@clair/api-client";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { gouvernementAncienFictif, reponseFictive } from "./fixtures.ts";
import { GouvernementFicheScreen } from "./GouvernementFicheScreen.tsx";

const SLUG = "fictif-ii";
const BASE = `/gouvernements/${SLUG}`;
const MAINTENANT = Date.parse("2026-11-01T11:00:00Z");

const rendre = (params: Record<string, string> = {}, reponse = reponseFictive()) =>
  renderScreen(
    <GouvernementFicheScreen
      slug={reponse.data.slug}
      params={params}
      initialData={reponse}
      maintenant={MAINTENANT}
    />,
    { routes: { [`/gouvernements/${reponse.data.slug}`]: reponse }, pathname: BASE },
  );

describe("GouvernementFicheScreen", () => {
  it("découpe les notes de source en listes", () => {
    const { getByRole } = rendre();
    const sources = getByRole("contentinfo");
    const [notes] = within(sources).getAllByRole("list");
    if (!notes) throw new Error("notes de source absentes");
    expect(within(notes).getAllByRole("listitem").length).toBeGreaterThan(1);
  });

  it("affiche l'en-tête, la colonne de faits et la composition actuelle", () => {
    const { getByRole, getByText, getByLabelText } = rendre();
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Gouvernement Fictif II");
    expect(getByText("En fonction")).toBeInTheDocument();
    expect(getByText(/présidence de Ariane Exemple/)).toBeInTheDocument();
    const faits = getByLabelText("Faits du gouvernement Fictif II");
    expect(within(faits).getByRole("link", { name: "Camille Fictif" })).toHaveAttribute(
      "href",
      "/deputes/camille-fictif",
    );
    expect(within(faits).getByText("Bilan (calculé par CLAIR)")).toBeInTheDocument();
    expect(within(faits).getByText("Changements de composition").nextSibling).toHaveTextContent(
      "1",
    );
    expect(within(faits).getByRole("link", { name: /précédent : Fictif I/ })).toHaveAttribute(
      "href",
      "/gouvernements/fictif-i",
    );
    expect(getByRole("heading", { name: "Composition actuelle" })).toBeInTheDocument();
    expect(getByRole("tab", { name: /Textes portés/ })).toBeInTheDocument();
  });

  it("marque les changements de la dernière étape, et garde l'étape choisie dans l'URL", () => {
    const actuelle = rendre();
    expect(actuelle.getByText("Entrée")).toBeInTheDocument();
    expect(actuelle.getByText("Quittent le gouvernement")).toBeInTheDocument();
    actuelle.unmount();

    const { getByRole, queryByText, visited } = rendre({ etape: "2025-09-20" });
    expect(getByRole("heading", { name: "Composition à la nomination" })).toBeInTheDocument();
    expect(getByRole("button", { name: /Nomination/ })).toHaveAttribute("aria-pressed", "true");
    expect(queryByText("Quittent le gouvernement")).toBeNull();
    fireEvent.click(getByRole("button", { name: /Revenir à la composition actuelle/ }));
    expect(visited).toContain(BASE);
  });

  it("ouvre l'onglet de l'URL : textes portés, puis 49.3 et censure", () => {
    const textes = rendre({ onglet: "textes" });
    expect(textes.getByRole("tab", { name: /Textes portés/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(textes.getByText("promulgué")).toBeInTheDocument();
    expect(
      textes.getByRole("link", { name: "loi n° 2026-1 (nouvelle fenêtre)" }),
    ).toBeInTheDocument();
    textes.unmount();

    const censure = rendre({ onglet: "censure" });
    const ongletCensure = censure.getByRole("tab", { name: /49\.3 et censure/ });
    expect(ongletCensure).toHaveTextContent("1 · 1");
    expect(ongletCensure).toHaveTextContent("(1 recours au 49.3, 1 motion de censure)");
    expect(censure.getByText(/250 voix pour, 289 requises/)).toBeInTheDocument();
    expect(censure.getByRole("link", { name: /scrutin du 15 janvier 2026/ })).toHaveAttribute(
      "href",
      "/scrutins/1234?chambre=assemblee&session=17",
    );
  });

  it("change d'onglet par l'URL", () => {
    const { getByRole, visited } = rendre();
    fireEvent.click(getByRole("tab", { name: /Tous les postes/ }));
    expect(visited).toContain(`${BASE}?onglet=postes`);
  });

  it("n'a ni textes ni censure avant juin 2017, et le dit", () => {
    const { queryByRole, getByText, getByRole } = rendre(
      { onglet: "textes" },
      reponseFictive(gouvernementAncienFictif),
    );
    expect(queryByRole("tab", { name: /Textes portés/ })).toBeNull();
    expect(getByRole("tab", { name: /Composition/ })).toHaveAttribute("aria-selected", "true");
    expect(getByText("Pas de données de bilan avant juin 2017.")).toBeInTheDocument();
  });

  it("dit qu'un gouvernement est introuvable", async () => {
    const { findByText } = renderScreen(<GouvernementFicheScreen slug="inconnu" />, {
      routes: {
        "/gouvernements/inconnu": () => Promise.reject(new ApiError(404, "/gouvernements/inconnu")),
      },
    });
    expect(await findByText("Gouvernement introuvable")).toBeInTheDocument();
  });
});
