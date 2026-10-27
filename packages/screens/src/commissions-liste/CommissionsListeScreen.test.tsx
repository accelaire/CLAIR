import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CommissionsListeScreen } from "./CommissionsListeScreen.tsx";
import { commissionExemple, commissionExempleSenat, pageCommissions } from "./fixtures.ts";

const routes = (items = [commissionExemple, commissionExempleSenat]) => ({
  "/commissions": pageCommissions(items),
});

describe("CommissionsListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<CommissionsListeScreen />, {
      routes: { "/commissions": () => new Promise(() => {}) },
      pathname: "/commissions",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des commissions");
  });

  it("range les commissions par type, avec un lien par carte", async () => {
    const { findByRole, getByRole } = renderScreen(<CommissionsListeScreen />, {
      routes: routes(),
      pathname: "/commissions",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Commissions parlementaires");
    expect(await findByRole("link", { name: /jardins partagés/ })).toHaveAttribute(
      "href",
      "/commissions/assemblee-commission-des-jardins-partages",
    );
    expect(getByRole("heading", { level: 2, name: /Commissions permanentes/ })).toBeInTheDocument();
    expect(getByRole("heading", { level: 2, name: /Groupes d'études/ })).toBeInTheDocument();
  });

  it("filtre sur la page avec la recherche de l'URL, sans tenir compte des accents", () => {
    const { getByRole, queryByRole } = renderScreen(
      <CommissionsListeScreen
        params={{ search: "bibliotheques" }}
        initialData={pageCommissions([commissionExemple, commissionExempleSenat])}
      />,
      { routes: routes(), pathname: "/commissions" },
    );
    expect(getByRole("link", { name: /bibliothèques/ })).toBeInTheDocument();
    expect(queryByRole("link", { name: /jardins partagés/ })).not.toBeInTheDocument();
  });

  it("garde les filtres dans l'URL", async () => {
    const { findByLabelText, getByRole, visited } = renderScreen(
      <CommissionsListeScreen params={{ chambre: "senat" }} />,
      { routes: routes(), pathname: "/commissions" },
    );
    fireEvent.change(await findByLabelText("Type d'organe"), { target: { value: "enquete" } });
    fireEvent.click(getByRole("checkbox", { name: "Inclure les organes passés" }));
    expect(visited).toEqual([
      "/commissions?chambre=senat&type=enquete",
      "/commissions?chambre=senat&historique=1",
    ]);
  });

  it("transmet la recherche à l'URL", async () => {
    const { getByRole, visited } = renderScreen(<CommissionsListeScreen />, {
      routes: routes(),
      pathname: "/commissions",
    });
    fireEvent.change(getByRole("searchbox", { name: "Rechercher une commission" }), {
      target: { value: "jardins" },
    });
    await waitFor(() => expect(visited).toEqual(["/commissions?search=jardins"]));
  });

  it("propose d'effacer les filtres quand rien ne correspond", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <CommissionsListeScreen params={{ type: "office" }} />,
      { routes: routes([]), pathname: "/commissions" },
    );
    expect(await findByText("Aucune commission trouvée")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(visited).toEqual(["/commissions"]);
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<CommissionsListeScreen />, {
      routes: { "/commissions": () => Promise.reject(new Error("panne")) },
      pathname: "/commissions",
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
