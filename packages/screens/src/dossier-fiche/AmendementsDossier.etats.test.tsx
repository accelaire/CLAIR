import { ApiError, type FixtureRoutes, type Query } from "@clair/api-client";
import type { AmendementDuDossier, DossierDetail } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AmendementsDossier } from "./AmendementsDossier.tsx";
import { amendementExemple, dossierDetailExemple, page } from "./fixtures.ts";
import { type DossierFicheParams, parseDossierFicheParams } from "./params.ts";

const CHEMIN = `/dossiers/${dossierDetailExemple.uid}/amendements`;
const hrefFor = (n: number) => `/dossiers/${dossierDetailExemple.uid}?page=${n}`;

// Sous-amendement fictif, sans sort.
const sousAmendement: AmendementDuDossier = {
  ...amendementExemple,
  id: "amendement-exemple-2",
  uid: "AMEXEMPLE2",
  numero: "8",
  sort: null,
  amendementParent: {
    id: "amendement-exemple-1",
    uid: "AMEXEMPLE1",
    numero: "7",
    auteurLibelle: "Camille Exemple",
  },
  scrutins: [],
};

const rendre = (
  params: Partial<DossierFicheParams>,
  routes: FixtureRoutes,
  dossier: DossierDetail = dossierDetailExemple,
) => {
  const onChange = vi.fn();
  const rendu = renderScreen(
    <AmendementsDossier
      dossier={dossier}
      params={{ ...parseDossierFicheParams({ tab: "amendements" }), ...params }}
      onChange={onChange}
      hrefFor={hrefFor}
    />,
    { routes },
  );
  return { ...rendu, onChange };
};

describe("AmendementsDossier : états", () => {
  it("annonce le chargement d'une page filtrée", () => {
    const { getAllByRole } = rendre(
      { voted: true },
      { [CHEMIN]: () => new Promise(() => undefined) },
    );
    expect(
      getAllByRole("status").some((s) => s.textContent?.includes("Chargement des amendements")),
    ).toBe(true);
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = rendre(
      { page: 2 },
      {
        [CHEMIN]: () => {
          throw new ApiError(500, CHEMIN);
        },
      },
    );
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("aucun résultat filtré : état vide propre aux filtres", async () => {
    const { findByText } = rendre({ sort: "Retiré" }, { [CHEMIN]: page([]) });
    expect(await findByText("Aucun amendement correspondant aux filtres")).toBeInTheDocument();
  });

  it("dossier sans amendement ni filtre possible", async () => {
    const { findByText, queryByLabelText } = rendre(
      {},
      { [CHEMIN]: page([]) },
      {
        ...dossierDetailExemple,
        amendements: [],
        amendementsCount: 0,
        votedAmendementsCount: 0,
        amendementsGroupes: [],
      },
    );
    expect(await findByText("Aucun amendement associé à ce dossier")).toBeInTheDocument();
    expect(queryByLabelText(/Votes publics/)).toBeNull();
    expect(queryByLabelText("Groupe de l'auteur")).toBeNull();
    expect(queryByLabelText("Sort")).toBeNull();
  });

  it("filtres actifs : pastilles, compte au pluriel et retrait", async () => {
    const { findByText, getByRole, onChange } = rendre(
      { voted: true, groupe: "groupe-inconnu", sort: "Irrecevable" },
      { [CHEMIN]: page([amendementExemple, sousAmendement], 25) },
    );
    expect(await findByText("25 amendements sur 1 correspondant aux filtres")).toBeInTheDocument();
    expect(getByRole("heading", { name: "Amendement n° 8" })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /Votes publics/ }));
    expect(onChange).toHaveBeenLastCalledWith({ voted: false });
    fireEvent.click(getByRole("button", { name: /Groupe : groupe-inconnu/ }));
    expect(onChange).toHaveBeenLastCalledWith({ groupe: "" });
    fireEvent.click(getByRole("button", { name: /Sort : Irrecevable/ }));
    expect(onChange).toHaveBeenLastCalledWith({ sort: "" });
    // Le sort demandé reste proposé même s'il n'apparaît dans aucun amendement chargé.
    expect(getByRole("option", { name: "Irrecevable" })).toBeInTheDocument();
  });

  it("nomme le groupe connu dans la pastille et transmet les choix", async () => {
    const { findByRole, getByLabelText, onChange } = rendre(
      { groupe: "groupe-exemple" },
      { [CHEMIN]: page([amendementExemple]) },
    );
    expect(await findByRole("button", { name: /Groupe : EXE/ })).toBeInTheDocument();
    fireEvent.click(getByLabelText(/Votes publics seulement/));
    expect(onChange).toHaveBeenLastCalledWith({ voted: true });
    fireEvent.change(getByLabelText("Sort"), { target: { value: "Adopté" } });
    expect(onChange).toHaveBeenLastCalledWith({ sort: "Adopté" });
  });

  it("épingle l'amendement demandé et le retire de la liste", async () => {
    const { findByRole, getByRole, onChange } = rendre(
      { amendement: "AMEXEMPLE2" },
      {
        [CHEMIN]: (q: Query) =>
          q.amendement ? page([sousAmendement]) : page([amendementExemple, sousAmendement]),
      },
    );
    const epingle = await findByRole("region", { name: "L'amendement demandé" });
    expect(await findByRole("heading", { name: "Amendement n° 8" })).toBeInTheDocument();
    expect(epingle).toHaveTextContent("8");
    fireEvent.click(getByRole("button", { name: "Revenir à la liste seule" }));
    expect(onChange).toHaveBeenLastCalledWith({ amendement: "" });
  });

  it("amendement demandé en chargement, puis introuvable", async () => {
    const enCours = rendre(
      { amendement: "AMINCONNU" },
      { [CHEMIN]: () => new Promise(() => undefined) },
    );
    expect(
      enCours
        .getAllByRole("status")
        .some((s) => s.textContent?.includes("Chargement de l'amendement")),
    ).toBe(true);
    enCours.unmount();

    const { findByText } = rendre(
      { amendement: "AMINCONNU" },
      { [CHEMIN]: (q: Query) => (q.amendement ? page([]) : page([amendementExemple])) },
    );
    expect(await findByText("Cet amendement n'est pas rangé dans ce dossier.")).toBeInTheDocument();
  });
});
