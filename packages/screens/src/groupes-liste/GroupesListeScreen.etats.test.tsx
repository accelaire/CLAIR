import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import {
  groupeExemple,
  groupeExempleBis,
  groupeExempleSenat,
  groupesExemple,
  legislaturesExemple,
} from "./fixtures.ts";
import { GroupesListeScreen } from "./GroupesListeScreen.tsx";

// Sessions FICTIVES du Sénat (deux, pour proposer le choix).
const session = (annee: string) => ({
  chambre: "senat",
  legislature: null,
  session: annee,
  dateDebut: `${annee}-10-01`,
  dateFin: `${Number(annee) + 1}-07-01`,
  count: 10,
});
const deuxSessions = { data: [session("2024"), session("2025")] };

const routes = {
  "/parlementaires/groupes": groupesExemple(),
  "/deputes/groupes": groupesExemple([groupeExemple, groupeExempleBis]),
  "/senateurs/groupes": groupesExemple([
    groupeExempleSenat,
    {
      ...groupeExempleSenat,
      id: "g-solo",
      slug: "gsolo",
      nom: "SOLO",
      nomComplet: "",
      membresCount: 1,
      logoUrl: "https://exemple.fr/logo.png",
    },
  ]),
  "/deputes/legislatures": legislaturesExemple,
  "/scrutins/periodes": deuxSessions,
};

describe("GroupesListeScreen, variantes", () => {
  it("propose les sessions du Sénat et écrit la session choisie dans l'URL", async () => {
    const { visited } = renderScreen(<GroupesListeScreen params={{ chambre: "senat" }} />, {
      routes,
      pathname: "/groupes",
    });
    const select = await screen.findByLabelText("Session sénatoriale");
    expect(within(select).getByRole("option", { name: "Session 2025-2026" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "2024" } });
    fireEvent.change(select, { target: { value: "2025" } });
    expect(visited).toEqual(["/groupes?chambre=senat&session=2024", "/groupes?chambre=senat"]);
    const cartes = within(screen.getByRole("list", { name: "Groupes, Sénat" }));
    expect(cartes.getByText(/^membre$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir tous les sénateurs" })).toHaveAttribute(
      "href",
      "/senateurs",
    );
  });

  it("mène aux sénateurs et aux fiches de la session passée choisie", async () => {
    renderScreen(<GroupesListeScreen params={{ chambre: "senat", session: "2024" }} />, {
      routes,
      pathname: "/groupes",
    });
    expect(await screen.findByRole("link", { name: "Voir tous les sénateurs" })).toHaveAttribute(
      "href",
      "/senateurs?session=2024",
    );
    const cartes = within(screen.getByRole("list", { name: "Groupes, Sénat" }));
    expect(cartes.getByRole("link", { name: /Groupe sénatorial d'exemple/ })).toHaveAttribute(
      "href",
      "/groupes/senat/gsen?session=2024",
    );
  });

  it("retire le filtre de chambre et mène aux députés de la législature passée", async () => {
    const { visited } = renderScreen(
      <GroupesListeScreen params={{ chambre: "assemblee", legislature: "16" }} />,
      { routes, pathname: "/groupes" },
    );
    expect(await screen.findByRole("link", { name: "Voir tous les députés" })).toHaveAttribute(
      "href",
      "/deputes?legislature=16",
    );
    fireEvent.change(screen.getByLabelText("Législature"), { target: { value: "17" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer le filtre Chambre : Assemblée nationale" }),
    );
    expect(visited).toEqual(["/groupes?chambre=assemblee", "/groupes?legislature=16"]);
  });

  it("nomme le Sénat dans le filtre actif", async () => {
    renderScreen(<GroupesListeScreen params={{ chambre: "senat" }} />, {
      routes,
      pathname: "/groupes",
    });
    expect(
      await screen.findByRole("button", { name: "Retirer le filtre Chambre : Sénat" }),
    ).toBeInTheDocument();
  });

  it("dit qu'aucun groupe n'est disponible pour la période", async () => {
    renderScreen(<GroupesListeScreen />, {
      routes: { ...routes, "/parlementaires/groupes": groupesExemple([]) },
      pathname: "/groupes",
    });
    expect(
      await screen.findByText("Aucun groupe politique n'est disponible pour cette période."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voir tous les groupes" })).toBeNull();
  });

  it("compte les groupes retenus par la recherche, au singulier", async () => {
    renderScreen(<GroupesListeScreen params={{ search: "solo" }} />, {
      routes: { ...routes, "/parlementaires/groupes": routes["/senateurs/groupes"] },
      pathname: "/groupes",
    });
    expect(await screen.findByText(/^1 groupe sur 2, /)).toBeInTheDocument();
  });
});
