import { ApiError } from "@clair/api-client";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { dossierDetailExemple, page } from "./fixtures.ts";
import { ScrutinsDossier } from "./ScrutinsDossier.tsx";

const CHEMIN = `/dossiers/${dossierDetailExemple.uid}/scrutins`;
const hrefFor = (n: number) => `/dossiers/${dossierDetailExemple.uid}?tab=scrutins&page=${n}`;
const dossier = { ...dossierDetailExemple, naturesCount: { ensemble: 1, article: 2 } };

describe("ScrutinsDossier : états", () => {
  it("annonce le chargement d'un objet de vote", () => {
    const { getAllByRole } = renderScreen(
      <ScrutinsDossier
        dossier={dossier}
        nature="article"
        page={1}
        onNatureChange={vi.fn()}
        hrefFor={hrefFor}
      />,
      { routes: { [CHEMIN]: () => new Promise(() => undefined) } },
    );
    expect(
      getAllByRole("status").some((s) => s.textContent?.includes("Chargement des scrutins")),
    ).toBe(true);
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(
      <ScrutinsDossier
        dossier={dossier}
        nature=""
        page={2}
        onNatureChange={vi.fn()}
        hrefFor={hrefFor}
      />,
      {
        routes: {
          [CHEMIN]: () => {
            throw new ApiError(500, CHEMIN);
          },
        },
      },
    );
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("aucun scrutin de l'objet choisi, et transmet le choix d'objet", async () => {
    const onNatureChange = vi.fn();
    const { findByText, getByLabelText } = renderScreen(
      <ScrutinsDossier
        dossier={dossier}
        nature="article"
        page={1}
        onNatureChange={onNatureChange}
        hrefFor={hrefFor}
      />,
      { routes: { [CHEMIN]: page([]) } },
    );
    expect(await findByText("Aucun scrutin de ce type pour ce dossier.")).toBeInTheDocument();
    fireEvent.change(getByLabelText("Objet du vote"), { target: { value: "ensemble" } });
    expect(onNatureChange).toHaveBeenCalledWith("ensemble");
  });

  it("sans décompte par objet, pas de filtre", () => {
    const { queryByLabelText } = renderScreen(
      <ScrutinsDossier
        dossier={{ ...dossierDetailExemple, naturesCount: undefined }}
        nature=""
        page={1}
        onNatureChange={vi.fn()}
        hrefFor={hrefFor}
      />,
    );
    expect(queryByLabelText("Objet du vote")).toBeNull();
  });
});
