import { ApiError } from "@clair/api-client";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossiersCommission } from "./DossiersCommission.tsx";
import { dossierCommissionExemple, pageDossiersCommission } from "./fixtures.ts";
import { type CommissionFicheParams, parseCommissionFicheParams } from "./params.ts";

const SLUG = "commission-exemple";
const CHEMIN = `/commissions/${SLUG}/dossiers`;
const hrefFor = (page: number) => `/commissions/${SLUG}?tab=dossiers&page=${page}`;

const rendre = (params: Partial<CommissionFicheParams>, reponse: unknown) => {
  const update = vi.fn();
  const rendu = renderScreen(
    <DossiersCommission
      slug={SLUG}
      params={{ ...parseCommissionFicheParams({ tab: "dossiers" }), ...params }}
      update={update}
      hrefFor={hrefFor}
    />,
    { routes: { [CHEMIN]: reponse } },
  );
  return { ...rendu, update };
};

describe("DossiersCommission : états", () => {
  it("annonce le chargement", () => {
    const { getAllByRole } = rendre({}, () => new Promise(() => undefined));
    expect(
      getAllByRole("status").some((s) => s.textContent?.includes("Chargement des textes")),
    ).toBe(true);
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = rendre({}, () => {
      throw new ApiError(500, CHEMIN);
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("sans filtre ni texte : message général", async () => {
    const { findByText, queryByRole } = rendre({}, pageDossiersCommission([]));
    expect(await findByText("Aucun texte enregistré pour cette commission.")).toBeInTheDocument();
    expect(queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
  });

  it("filtres actifs sans résultat : pastilles, retrait et effacement", async () => {
    const { findByText, getByRole, update } = rendre(
      { role: "fond", etat: "adopte", dateFrom: "2026-01-01", dateTo: "2026-02-01" },
      pageDossiersCommission([]),
    );
    expect(await findByText("Aucun texte ne correspond à ces critères.")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: /Rôle : Saisie au fond/ }));
    expect(update).toHaveBeenLastCalledWith({ role: "" });
    fireEvent.click(getByRole("button", { name: /État : / }));
    expect(update).toHaveBeenLastCalledWith({ etat: "" });
    fireEvent.click(getByRole("button", { name: /Déposés depuis le .* jusqu'au / }));
    expect(update).toHaveBeenLastCalledWith({ dateFrom: "", dateTo: "" });
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(update).toHaveBeenLastCalledWith({ role: "", etat: "", dateFrom: "", dateTo: "" });
  });

  it("période ouverte d'un seul côté", async () => {
    const debut = rendre({ dateFrom: "2026-01-01" }, pageDossiersCommission([]));
    const pastille = await debut.findByRole("button", { name: /Déposés depuis le/ });
    expect(pastille).not.toHaveAccessibleName(/jusqu'au/);
    debut.unmount();
    const fin = rendre({ dateTo: "2026-02-01" }, pageDossiersCommission([]));
    expect(await fin.findByRole("button", { name: /Déposés jusqu'au/ })).toBeInTheDocument();
  });

  it("texte saisi pour avis ; choix d'état et retour à « tous »", async () => {
    const { findByText, getByLabelText, update } = rendre(
      { etat: "adopte" },
      pageDossiersCommission([{ ...dossierCommissionExemple, role: "avis" }]),
    );
    expect(await findByText("Saisie pour avis")).toBeInTheDocument();
    fireEvent.change(getByLabelText("État du texte"), { target: { value: "rejete" } });
    expect(update).toHaveBeenLastCalledWith({ etat: "rejete" });
    fireEvent.change(getByLabelText("État du texte"), { target: { value: "" } });
    expect(update).toHaveBeenLastCalledWith({ etat: "" });
    fireEvent.change(getByLabelText("Rôle de la commission"), { target: { value: "" } });
    expect(update).toHaveBeenLastCalledWith({ role: "" });
  });
});
