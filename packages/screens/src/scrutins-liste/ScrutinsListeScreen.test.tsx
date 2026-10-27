import { ApiError } from "@clair/api-client";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { pageScrutins, scrutinsExemples } from "./fixtures.ts";
import { ScrutinsListeScreen } from "./ScrutinsListeScreen.tsx";

const routesDeBase = {
  "/scrutins/tags": { data: [{ name: "environnement", count: 4 }] },
  "/scrutins/periodes": { data: [] },
  "/dossiers/trending": { data: [] },
};

describe("ScrutinsListeScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<ScrutinsListeScreen />, {
      routes: { ...routesDeBase, "/scrutins": () => new Promise(() => undefined) },
      pathname: "/scrutins",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement des scrutins");
  });

  it("liste les scrutins avec un lien qui porte la chambre et la session", async () => {
    const { findByRole, getByRole } = renderScreen(<ScrutinsListeScreen />, {
      routes: {
        ...routesDeBase,
        "/scrutins": pageScrutins(scrutinsExemples, { totalPages: 3, total: 50 }),
      },
      pathname: "/scrutins",
    });
    const lien = await findByRole("link", { name: /L'amendement d'exemple n° 3/ });
    expect(lien).toHaveAttribute("href", "/scrutins/12?chambre=senat&session=2025");
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Scrutins");
    expect(getByRole("link", { name: "Page 2" })).toHaveAttribute("href", "/scrutins?page=2");
  });

  it("garde les filtres dans les liens de pagination", async () => {
    const { findByRole } = renderScreen(
      <ScrutinsListeScreen params={{ chambre: "senat", tag: "europe" }} />,
      {
        routes: { ...routesDeBase, "/scrutins": pageScrutins(scrutinsExemples, { totalPages: 2 }) },
        pathname: "/scrutins",
      },
    );
    expect(await findByRole("link", { name: "Page 2" })).toHaveAttribute(
      "href",
      "/scrutins?chambre=senat&tag=europe&page=2",
    );
  });

  it("propose d'effacer les filtres quand rien ne correspond", async () => {
    const { findByText, getByRole, visited } = renderScreen(
      <ScrutinsListeScreen params={{ nature: "amendement", page: "2" }} />,
      { routes: { ...routesDeBase, "/scrutins": pageScrutins([]) }, pathname: "/scrutins" },
    );
    expect(await findByText("Aucun scrutin trouvé")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Effacer les filtres" }));
    expect(visited).toEqual(["/scrutins"]);
  });

  it("écrit un filtre dans l'URL et revient en page 1", async () => {
    const { findByLabelText, visited } = renderScreen(
      <ScrutinsListeScreen params={{ page: "4" }} />,
      {
        routes: { ...routesDeBase, "/scrutins": pageScrutins(scrutinsExemples) },
        pathname: "/scrutins",
      },
    );
    const select = await findByLabelText("Objet du vote");
    fireEvent.change(select, { target: { value: "ensemble" } });
    await waitFor(() => expect(visited).toEqual(["/scrutins?nature=ensemble"]));
  });

  it("affiche une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<ScrutinsListeScreen />, {
      routes: {
        ...routesDeBase,
        "/scrutins": () => Promise.reject(new ApiError(500, "/scrutins")),
      },
      pathname: "/scrutins",
    });
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
