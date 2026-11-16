import type { SujetListItem } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { pageSujets, sujetEnCours } from "./fixtures.ts";
import { SujetCard } from "./SujetCard.tsx";
import { SujetsListeScreen } from "./SujetsListeScreen.tsx";
import { SujetsSections } from "./SujetsSections.tsx";

const maintenant = new Date("2026-10-26T12:00:00.000Z").getTime();

/** Sujets FICTIFS dérivés des fixtures. */
const sujet = (id: number, patch: Partial<SujetListItem> = {}): SujetListItem => ({
  ...sujetEnCours,
  id: `sujet-fictif-${id}`,
  slug: `sujet-fictif-${id}`,
  label: `Sujet fictif ${id}`,
  ...patch,
});

describe("SujetsSections : cas limites", () => {
  it("met un sujet à la une, avec son nombre de dossiers", () => {
    const aLaUne = sujet(1, { dateDernierVote: "2026-10-20T00:00:00.000Z", dossierCount: 1 });
    const { getByRole, getByText } = renderScreen(
      <SujetsSections sujets={[aLaUne]} recherche={false} maintenant={maintenant} />,
    );
    const region = getByRole("region", { name: "À la une" });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent("Sujet fictif 1");
    expect(region).toHaveTextContent("À la une");
    expect(region).toHaveTextContent("1 dossier");
    expect(getByText(/Choisi automatiquement chaque jour/)).toBeInTheDocument();
  });

  it("sans dates ni statut connu, garde la carte lisible et classe en discussion", () => {
    const sansDates = sujet(2, {
      dateDebut: null,
      dateDernierVote: null,
      status: "en_cours",
      scrutinCount: 1,
    });
    const { getByRole } = renderScreen(
      <SujetsSections sujets={[sansDates]} recherche maintenant={maintenant} />,
    );
    const carte = getByRole("link", { name: "Sujet fictif 2" }).closest("li");
    expect(carte).toHaveTextContent("1 scrutin");
    expect(carte).not.toHaveTextContent("Dépôt");
    expect(carte).not.toHaveTextContent("Dernier vote");
  });

  it("range les caducs et retirés dans une section repliée", () => {
    const { getByRole } = renderScreen(
      <SujetsSections
        sujets={[sujet(3, { status: "caduc" }), sujet(4, { status: "retire" })]}
        recherche
        maintenant={maintenant}
      />,
    );
    const bouton = getByRole("button", { name: /Caducs et retirés/ });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
  });

  it("affiche douze sujets, puis la suite avec « Voir plus », puis « Réduire »", () => {
    const vingt = Array.from({ length: 20 }, (_, index) =>
      sujet(index + 10, { dateDernierVote: `2026-0${(index % 9) + 1}-01T00:00:00.000Z` }),
    );
    const { getByRole, getAllByRole, queryByRole } = renderScreen(
      <SujetsSections sujets={vingt} recherche maintenant={maintenant} />,
    );
    expect(getAllByRole("link", { name: /Sujet fictif/ })).toHaveLength(12);
    expect(queryByRole("button", { name: "Réduire" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Voir plus (8 sur 8 restants)" }));
    expect(getAllByRole("link", { name: /Sujet fictif/ })).toHaveLength(20);
    fireEvent.click(getByRole("button", { name: "Réduire" }));
    expect(getAllByRole("link", { name: /Sujet fictif/ })).toHaveLength(12);
  });

  it("un statut inconnu s'affiche comme en cours", () => {
    const { getByRole } = renderScreen(
      <ul>
        <SujetCard sujet={sujet(5, { status: "statut-fictif" })} />
      </ul>,
    );
    expect(getByRole("link", { name: "Sujet fictif 5" }).closest("li")).toHaveTextContent(
      "En cours",
    );
  });
});

describe("SujetsListeScreen : état vide sans recherche", () => {
  it("annonce qu'aucun sujet n'est encore suivi", async () => {
    const { findByText } = renderScreen(<SujetsListeScreen />, {
      routes: { "/sujets": pageSujets([]) },
    });
    expect(await findByText(/Aucun sujet n'est encore suivi/)).toBeInTheDocument();
  });
});
