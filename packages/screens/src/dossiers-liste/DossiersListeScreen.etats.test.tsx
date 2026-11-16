import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossiersListeScreen } from "./DossiersListeScreen.tsx";
import { dossierExemple, filtresDossiers, pageDossiers } from "./fixtures.ts";

const routes = (dossiers = [dossierExemple]) => ({
  "/dossiers": pageDossiers(dossiers),
  "/dossiers/filters": filtresDossiers,
});

describe("DossiersListeScreen : états", () => {
  it("pastilles de procédure, de code et de période ; retrait de chacune", async () => {
    const { findByRole, getByRole, visited } = renderScreen(
      <DossiersListeScreen
        params={{
          procedureLibelle: "Projet de loi ordinaire",
          procedureCode: "1",
          dateFrom: "2026-01-01",
          dateTo: "2026-02-01",
        }}
      />,
      { routes: routes(), pathname: "/dossiers" },
    );
    fireEvent.click(await findByRole("button", { name: /Procédure : Projet de loi ordinaire/ }));
    fireEvent.click(getByRole("button", { name: /Code de procédure : 1/ }));
    fireEvent.click(getByRole("button", { name: /Déposés du .* au / }));
    expect(visited).toEqual([
      "/dossiers?procedureCode=1&dateFrom=2026-01-01&dateTo=2026-02-01",
      "/dossiers?procedureLibelle=Projet+de+loi+ordinaire&dateFrom=2026-01-01&dateTo=2026-02-01",
      "/dossiers?procedureCode=1&procedureLibelle=Projet+de+loi+ordinaire",
    ]);
  });

  it("période ouverte d'un seul côté", async () => {
    const debut = renderScreen(<DossiersListeScreen params={{ dateFrom: "2026-01-01" }} />, {
      routes: routes(),
      pathname: "/dossiers",
    });
    const pastille = await debut.findByRole("button", { name: /Déposés du/ });
    expect(pastille).not.toHaveAccessibleName(/ au /);
    debut.unmount();

    const fin = renderScreen(<DossiersListeScreen params={{ dateTo: "2026-02-01" }} />, {
      routes: routes(),
      pathname: "/dossiers",
    });
    expect(await fin.findByRole("button", { name: /Déposés +au / })).toBeInTheDocument();
  });

  it("un seul dossier filtré : compte au singulier", async () => {
    const { findByText } = renderScreen(<DossiersListeScreen params={{ chambre: "assemblee" }} />, {
      routes: routes(),
      pathname: "/dossiers",
    });
    expect(await findByText("1 dossier correspondant aux filtres")).toBeInTheDocument();
  });

  it("aucun dossier sans filtre : message général, pas de bouton", async () => {
    const { findByText, queryByRole } = renderScreen(<DossiersListeScreen />, {
      routes: {
        "/dossiers": pageDossiers([], { totalPages: 0 }),
        "/dossiers/filters": { procedures: [] },
      },
      pathname: "/dossiers",
    });
    expect(
      await findByText("Aucun dossier législatif avec scrutin n'est disponible pour le moment."),
    ).toBeInTheDocument();
    expect(queryByRole("button", { name: "Effacer les filtres" })).toBeNull();
    expect(queryByRole("combobox", { name: "Procédure" })).toBeNull();
  });

  it("choisit une procédure, puis revient à « tous » pour l'état et l'origine", async () => {
    const { findByLabelText, getByLabelText, visited } = renderScreen(
      <DossiersListeScreen params={{ etat: "adopte", gouvernement: "projets" }} />,
      { routes: routes(), pathname: "/dossiers" },
    );
    fireEvent.change(await findByLabelText("Procédure"), {
      target: { value: "Projet de loi ordinaire" },
    });
    fireEvent.change(getByLabelText("État"), { target: { value: "" } });
    fireEvent.change(getByLabelText("Origine du texte"), { target: { value: "" } });
    expect(visited).toEqual([
      "/dossiers?etat=adopte&gouvernement=projets&procedureLibelle=Projet+de+loi+ordinaire",
      "/dossiers?gouvernement=projets",
      "/dossiers?etat=adopte",
    ]);
  });
});
