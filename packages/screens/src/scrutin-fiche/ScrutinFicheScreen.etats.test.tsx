import type { ScrutinDetail } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { interventionsExemple, scrutinDetailExemple } from "./fixtures.ts";
import { ScrutinFicheScreen } from "./ScrutinFicheScreen.tsx";

const PATH = "/scrutins/101";

const rendre = (scrutin: ScrutinDetail, params: Record<string, string> = {}) =>
  renderScreen(<ScrutinFicheScreen numero={101} params={params} />, {
    routes: {
      [PATH]: { data: scrutin },
      [`${PATH}/interventions`]: interventionsExemple,
      "/groupes": { data: [] },
    },
    pathname: PATH,
  });

describe("ScrutinFicheScreen, cas limites", () => {
  it("présente un scrutin sans dossier, sans résumé, sans amendement ni débat", async () => {
    const { findByRole, getByRole, queryByRole, getAllByText } = rendre(
      scrutinDetailExemple({
        dossier: null,
        resumeIA: null,
        amendements: [],
        totalInterventions: 0,
        sort: "sort d'exemple",
        session: "",
        legislature: null,
      }),
    );
    expect(await findByRole("tab", { name: /Vote/ })).toHaveAttribute("aria-selected", "true");
    expect(queryByRole("tab", { name: /Amendements/ })).toBeNull();
    expect(queryByRole("tab", { name: /Débat/ })).toBeNull();
    expect(queryByRole("heading", { name: "En clair" })).toBeNull();
    const fil = getByRole("navigation", { name: /fil d'Ariane/i });
    expect(within(fil).queryByRole("link", { name: /jardins/i })).toBeNull();
    expect(getAllByText("sort d'exemple").length).toBeGreaterThan(0);
  });

  it("nomme l'onglet « Débats du jour » quand le débat n'est pas rattaché", async () => {
    const { findByRole } = rendre(scrutinDetailExemple({ debatRattache: false }));
    expect(await findByRole("tab", { name: /Débats du jour/ })).toBeInTheDocument();
  });

  it("nomme l'onglet « Débats » quand le rattachement est inconnu, et l'ouvre depuis l'URL", async () => {
    const { findByRole } = rendre(scrutinDetailExemple({ debatRattache: undefined }), {
      onglet: "debats",
    });
    expect(await findByRole("tab", { name: /^Débats/ })).toHaveAttribute("aria-selected", "true");
  });

  it("revient à l'onglet par défaut sans le mettre dans l'URL", async () => {
    const { findByRole, visited } = rendre(scrutinDetailExemple(), {
      chambre: "assemblee",
      session: "17",
      onglet: "vote",
    });
    fireEvent.click(await findByRole("tab", { name: /Amendements/ }));
    expect(visited).toEqual([`${PATH}?chambre=assemblee&session=17`]);
  });

  it("ouvre les amendements sans lien vers le débat quand il n'y en a pas", async () => {
    const { findByRole, queryByRole } = rendre(scrutinDetailExemple({ totalInterventions: 0 }));
    expect(await findByRole("tab", { name: /Amendements/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(queryByRole("link", { name: "Lire le débat de ce vote" })).toBeNull();
  });
});
