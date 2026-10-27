import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AgendaScreen } from "./AgendaScreen.tsx";
import { agendaExemple } from "./fixtures.ts";

const AUJOURDHUI = "2026-03-03";

describe("AgendaScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<AgendaScreen aujourdhui={AUJOURDHUI} />, {
      routes: { "/agenda": () => new Promise(() => {}) },
      pathname: "/agenda",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement de l'agenda");
  });

  it("demande le mois affiché à l'API", async () => {
    const demandes: unknown[] = [];
    const { findByText } = renderScreen(
      <AgendaScreen aujourdhui={AUJOURDHUI} params={{ mois: "2026-02", chambre: "senat" }} />,
      {
        routes: {
          "/agenda": (query: unknown) => {
            demandes.push(query);
            return agendaExemple({}, []);
          },
        },
        pathname: "/agenda",
      },
    );
    expect(await findByText("Choisissez un jour dans le calendrier")).toBeInTheDocument();
    expect(demandes[0]).toMatchObject({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      chambre: "senat",
    });
  });

  it("montre le calendrier et les réunions du jour, triées par heure", async () => {
    const { findByRole, getByRole } = renderScreen(<AgendaScreen aujourdhui={AUJOURDHUI} />, {
      routes: { "/agenda": agendaExemple() },
      pathname: "/agenda",
    });
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Agenda parlementaire");
    expect(getByRole("heading", { level: 2, name: /mars 2026/i })).toBeInTheDocument();
    const jour = await findByRole("button", { name: /mardi 3 mars, 2 réunions/ });
    expect(jour).toHaveAttribute("aria-pressed", "true");
    expect(jour).toHaveAttribute("aria-current", "date");
    const reunions = await findByRole("list", { name: "Réunions du jour" });
    const titres = within(reunions).getAllByRole("heading", { level: 3 });
    expect(titres.map((titre) => titre.textContent)).toEqual([
      "Commission des jardins partagés",
      "Séance publique",
    ]);
    expect(within(reunions).getByRole("link", { name: "Séance publique" })).toHaveAttribute(
      "href",
      "/reunions/RUSNREXEMPLE3",
    );
    expect(within(reunions).getByRole("link", { name: /Scrutin n° 42/ })).toBeInTheDocument();
  });

  it("écrit le jour choisi et le mois dans l'URL", () => {
    const { getByRole, visited } = renderScreen(
      <AgendaScreen aujourdhui={AUJOURDHUI} initialData={agendaExemple()} />,
      { routes: { "/agenda": agendaExemple() }, pathname: "/agenda" },
    );
    fireEvent.click(getByRole("button", { name: /mardi 10 mars/ }));
    fireEvent.click(getByRole("button", { name: "Mois suivant" }));
    expect(visited).toEqual(["/agenda?date=2026-03-10", "/agenda?mois=2026-04"]);
  });

  it("se parcourt au clavier, un seul jour dans l'ordre de tabulation", () => {
    const { getByRole, visited } = renderScreen(
      <AgendaScreen aujourdhui={AUJOURDHUI} initialData={agendaExemple()} />,
      { routes: { "/agenda": agendaExemple() }, pathname: "/agenda" },
    );
    const trois = getByRole("button", { name: /mardi 3 mars/ });
    expect(trois).toHaveAttribute("tabindex", "0");
    expect(getByRole("button", { name: /mercredi 4 mars/ })).toHaveAttribute("tabindex", "-1");
    trois.focus();
    fireEvent.keyDown(trois, { key: "ArrowDown" });
    expect(getByRole("button", { name: /mardi 10 mars/ })).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? trois, { key: "End" });
    expect(getByRole("button", { name: /dimanche 15 mars/ })).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? trois, { key: "PageUp" });
    expect(visited).toEqual(["/agenda?mois=2026-02"]);
  });

  it("montre les événements du jour et les périodes", () => {
    const { getByRole, getByText } = renderScreen(
      <AgendaScreen
        aujourdhui={AUJOURDHUI}
        params={{ date: "2026-03-10" }}
        initialData={agendaExemple()}
      />,
      { routes: { "/agenda": agendaExemple() }, pathname: "/agenda" },
    );
    expect(
      getByRole("heading", { level: 3, name: "Ouverture d'une session d'exemple" }),
    ).toBeInTheDocument();
    expect(getByText("Suspension d'exemple")).toBeInTheDocument();
  });

  it("garde les filtres dans l'URL", () => {
    const { getByLabelText, visited } = renderScreen(
      <AgendaScreen aujourdhui={AUJOURDHUI} params={{ date: "2026-03-03" }} />,
      { routes: { "/agenda": agendaExemple() }, pathname: "/agenda" },
    );
    fireEvent.change(getByLabelText("Type"), { target: { value: "seance" } });
    expect(visited).toEqual(["/agenda?date=2026-03-03&type=seance"]);
  });

  it("dit qu'un jour est vide", async () => {
    const { findByText } = renderScreen(
      <AgendaScreen aujourdhui={AUJOURDHUI} params={{ date: "2026-03-04" }} />,
      { routes: { "/agenda": agendaExemple({}, []) }, pathname: "/agenda" },
    );
    expect(await findByText("Aucune réunion ce jour")).toBeInTheDocument();
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<AgendaScreen aujourdhui={AUJOURDHUI} />, {
      routes: { "/agenda": () => Promise.reject(new Error("panne")) },
      pathname: "/agenda",
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
