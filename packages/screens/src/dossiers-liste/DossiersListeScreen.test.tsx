import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DossiersListeScreen } from "./DossiersListeScreen.tsx";
import { dossierExemple, dossierExempleSenat, filtresDossiers, pageDossiers } from "./fixtures.ts";

const routes = (dossiers = [dossierExemple, dossierExempleSenat], totalPages = 3) => ({
  "/dossiers": pageDossiers(dossiers, { totalPages }),
  "/dossiers/filters": filtresDossiers,
});

describe("DossiersListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<DossiersListeScreen />, {
      routes: { "/dossiers": () => new Promise(() => {}) },
      pathname: "/dossiers",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des dossiers");
  });

  it("liste les dossiers avec un lien par carte et une pagination en liens", async () => {
    const { findByRole, getByRole } = renderScreen(<DossiersListeScreen />, {
      routes: routes(),
      pathname: "/dossiers",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Dossiers législatifs");
    expect(await findByRole("link", { name: /jardins partagés/ })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE1",
    );
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute("href", "/dossiers?page=2");
  });

  it("reprend les données du serveur sans attendre", () => {
    const { getByRole } = renderScreen(
      <DossiersListeScreen initialData={pageDossiers([dossierExemple])} />,
      { routes: routes(), pathname: "/dossiers" },
    );
    expect(getByRole("link", { name: /jardins partagés/ })).toBeInTheDocument();
  });

  it("garde les filtres dans l'URL et revient en page 1", async () => {
    const { findByLabelText, visited } = renderScreen(
      <DossiersListeScreen params={{ chambre: "senat", page: "2" }} />,
      { routes: routes(), pathname: "/dossiers" },
    );
    const etat = await findByLabelText("État");
    fireEvent.change(etat, { target: { value: "promulgue" } });
    expect(visited).toEqual(["/dossiers?etat=promulgue&chambre=senat"]);
  });

  it("transmet la recherche à l'URL", async () => {
    const { getByRole, visited } = renderScreen(<DossiersListeScreen />, {
      routes: routes(),
      pathname: "/dossiers",
    });
    fireEvent.change(getByRole("searchbox", { name: "Rechercher un dossier" }), {
      target: { value: "jardins" },
    });
    await waitFor(() => expect(visited).toEqual(["/dossiers?search=jardins"]));
  });

  it("propose d'effacer les filtres quand rien ne correspond", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <DossiersListeScreen params={{ etat: "rejete" }} />,
      { routes: routes([], 0), pathname: "/dossiers" },
    );
    expect(await findByText("Aucun dossier trouvé")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(visited).toEqual(["/dossiers"]);
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<DossiersListeScreen />, {
      routes: {
        "/dossiers": () => Promise.reject(new Error("panne")),
        "/dossiers/filters": filtresDossiers,
      },
      pathname: "/dossiers",
    });
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
