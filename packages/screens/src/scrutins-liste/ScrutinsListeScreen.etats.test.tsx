import type { DossierTrending, PeriodeScrutins } from "@clair/data";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { pageScrutins, scrutinsExemples } from "./fixtures.ts";
import { ScrutinsListeScreen } from "./ScrutinsListeScreen.tsx";

/** Dossier et périodes FICTIFS. */
const dossierExemple: DossierTrending = {
  id: "dossier-exemple",
  uid: "DLEXEMPLE 1",
  titre: "Proposition de loi d'exemple sur les jardins partagés",
  titreCourt: null,
  chambre: "assemblee",
  etat: null,
  procedureLibelle: null,
  dateDepot: null,
  lastScrutinDate: null,
  _count: { scrutins: 3 },
};
const periodesExemple: PeriodeScrutins[] = [
  {
    chambre: "senat",
    legislature: null,
    session: "2025",
    dateDebut: "2025-10-01",
    dateFin: "2026-09-30",
    count: 10,
  },
  {
    chambre: "assemblee",
    legislature: null,
    session: "17",
    dateDebut: "2024-07-18",
    dateFin: "2026-06-30",
    count: 20,
  },
];

const routes = (extra: Record<string, unknown> = {}) => ({
  "/scrutins/tags": { data: [{ name: "environnement", count: 1234 }] },
  "/scrutins/periodes": { data: periodesExemple },
  "/dossiers/trending": { data: [] },
  "/scrutins": pageScrutins(scrutinsExemples, { total: 1500 }),
  ...extra,
});

describe("ScrutinsListeScreen, filtres et états", () => {
  it("compte tous les scrutins sans filtre et montre les dossiers en cours", async () => {
    const { findByText, findByRole } = renderScreen(<ScrutinsListeScreen />, {
      routes: routes({ "/dossiers/trending": { data: [dossierExemple] } }),
      pathname: "/scrutins",
    });
    expect(
      await findByText(/votes\s+publics de l'Assemblée nationale et du Sénat/),
    ).toBeInTheDocument();
    const section = await findByRole("region", { name: "Dossiers en cours" });
    expect(within(section).getByRole("link", { name: /jardins partagés/ })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE%201",
    );
  });

  it("affiche chaque filtre actif et le retire dans l'URL", async () => {
    const { findByRole, getByRole, getByText, visited } = renderScreen(
      <ScrutinsListeScreen
        params={{
          chambre: "assemblee",
          type: "solennel",
          nature: "credits",
          tag: "thème rare",
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        }}
      />,
      { routes: routes(), pathname: "/scrutins" },
    );
    expect(
      await findByRole("button", { name: /Chambre : Assemblée nationale/ }),
    ).toBeInTheDocument();
    expect(getByRole("button", { name: /Mode : Vote solennel/ })).toBeInTheDocument();
    expect(getByRole("button", { name: /Objet : Crédits budgétaires/ })).toBeInTheDocument();
    expect(getByRole("button", { name: /Thématique : Thème rare/ })).toBeInTheDocument();
    expect(
      getByRole("button", { name: /Période : du 1 janv\. 2025 au 31 déc\. 2025/ }),
    ).toBeInTheDocument();
    expect(await findByRole("option", { name: "Thème rare" })).toBeInTheDocument();
    expect(getByText(/correspondant aux filtres/)).toBeInTheDocument();
    expect(
      getByText("Les votes publics de l'Assemblée nationale et du Sénat."),
    ).toBeInTheDocument();

    fireEvent.click(getByRole("button", { name: /Chambre : Assemblée nationale/ }));
    fireEvent.click(getByRole("button", { name: /Mode : Vote solennel/ }));
    fireEvent.click(getByRole("button", { name: /Objet : Crédits budgétaires/ }));
    fireEvent.click(getByRole("button", { name: /Thématique : Thème rare/ }));
    fireEvent.click(getByRole("button", { name: /Période : du/ }));
    expect(visited).toHaveLength(5);
    expect(visited[0]).not.toContain("chambre=");
    expect(visited[1]).not.toContain("type=");
    expect(visited[2]).not.toContain("nature=");
    expect(visited[3]).not.toContain("tag=");
    expect(visited[4]).not.toContain("dateFrom=");
  });

  it("écrit une période ouverte d'un seul côté", async () => {
    const { findByRole } = renderScreen(<ScrutinsListeScreen params={{ dateTo: "2025-12-31" }} />, {
      routes: routes(),
      pathname: "/scrutins",
    });
    expect(await findByRole("button", { name: /Période : au 31 déc\. 2025/ })).toBeInTheDocument();
  });

  it("retire la censure et efface tous les filtres", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <ScrutinsListeScreen params={{ censure: "toutes", search: "jardin" }} />,
      { routes: routes(), pathname: "/scrutins" },
    );
    fireEvent.click(await findByRole("button", { name: /Motions de censure : Toutes/ }));
    expect(visited.at(-1)).toBe("/scrutins?search=jardin");
    const effacer = getByRole("button", { name: "Réinitialiser" });
    fireEvent.click(effacer);
    expect(visited.at(-1)).toBe("/scrutins?search=jardin");
  });

  it("change le mode et la thématique dans l'URL", async () => {
    const { findByLabelText, getByLabelText, visited } = renderScreen(<ScrutinsListeScreen />, {
      routes: routes(),
      pathname: "/scrutins",
    });
    const mode = await findByLabelText("Mode de scrutin");
    fireEvent.change(mode, { target: { value: "motion" } });
    await waitFor(() => expect(visited).toContain("/scrutins?type=motion"));
    const theme = getByLabelText("Thématique");
    await findByLabelText("Thématique");
    await waitFor(() =>
      expect(
        within(theme).getByRole("option", { name: /^Environnement \(1\s234\)$/ }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(theme, { target: { value: "environnement" } });
    await waitFor(() => expect(visited).toContain("/scrutins?tag=environnement"));
  });

  it("dit qu'aucun scrutin n'est disponible sans filtre", async () => {
    const { findByText, queryByRole } = renderScreen(<ScrutinsListeScreen />, {
      routes: routes({ "/scrutins": pageScrutins([]) }),
      pathname: "/scrutins",
    });
    expect(await findByText("Aucun scrutin n'est disponible pour le moment.")).toBeInTheDocument();
    expect(queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
  });

  it("choisit une session du Sénat en raccourci : la chambre suit", async () => {
    const { findByRole, getByRole, visited } = renderScreen(<ScrutinsListeScreen />, {
      routes: routes(),
      pathname: "/scrutins",
    });
    await findByRole("link", { name: /L'amendement d'exemple n° 3/ });
    fireEvent.click(getByRole("button", { name: /Période/ }));
    fireEvent.click(await findByRole("button", { name: "Session 2025-2026 (Sénat)" }));
    await waitFor(() =>
      expect(visited.at(-1)).toBe("/scrutins?chambre=senat&dateFrom=2025-10-01&dateTo=2026-09-30"),
    );
  });
});
