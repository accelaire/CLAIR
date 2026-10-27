import { ApiError } from "@clair/api-client";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { routesSujetExemple, SLUG_EXEMPLE, sujetExemple } from "./fixtures.ts";
import { SujetFicheScreen } from "./SujetFicheScreen.tsx";

const pathname = `/sujets/${SLUG_EXEMPLE}`;

describe("SujetFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<SujetFicheScreen slug={SLUG_EXEMPLE} />, {
      routes: { [pathname]: () => new Promise(() => undefined) },
    });
    expect(getByRole("status")).toHaveTextContent("Chargement du sujet");
  });

  it("présente le sujet, signale l'IA et les calculs, liste scrutins et dossiers", async () => {
    const { findByRole, findByText, getByRole, getAllByRole, getAllByText } = renderScreen(
      <SujetFicheScreen slug={SLUG_EXEMPLE} />,
      { pathname, routes: routesSujetExemple },
    );
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent(sujetExemple.label);
    expect(getAllByText("En cours").length).toBeGreaterThan(0);
    expect(getAllByText(/Générée par IA/).length).toBeGreaterThan(0);
    expect(await findByText(/Calculée par CLAIR/)).toBeInTheDocument();
    expect(getByRole("heading", { name: "Parcours législatif" })).toBeInTheDocument();
    const scrutin = await findByRole("link", { name: /l'ensemble de la proposition de loi/ });
    expect(scrutin).toHaveAttribute("href", "/scrutins/42?chambre=senat&session=2025");
    expect(
      getAllByRole("link", {
        name: "Proposition de loi relative aux jardins partagés (exemple)",
      })[0],
    ).toHaveAttribute("href", "/dossiers/DLR5L17N00001");
    expect(await findByRole("link", { name: /4 amendements/ })).toHaveAttribute(
      "href",
      "/dossiers/DLR5L17N00001?groupe=exa&tab=amendements",
    );
  });

  it("reprend les données de la route sans attendre", () => {
    const { getByRole } = renderScreen(
      <SujetFicheScreen slug={SLUG_EXEMPLE} initialData={{ sujet: { data: sujetExemple } }} />,
      { pathname, routes: routesSujetExemple },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(sujetExemple.label);
  });

  it("affiche l'état vide des scrutins filtrés", async () => {
    const { findByText } = renderScreen(
      <SujetFicheScreen slug={SLUG_EXEMPLE} params={{ chambre: "assemblee" }} />,
      {
        pathname,
        routes: {
          ...routesSujetExemple,
          [`${pathname}/scrutins`]: {
            data: [],
            meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false },
          },
        },
      },
    );
    expect(await findByText("Aucun scrutin ne correspond à ces filtres.")).toBeInTheDocument();
  });

  it("répond 404 pour un sujet inconnu", async () => {
    const { findByRole } = renderScreen(<SujetFicheScreen slug="inconnu" />, { routes: {} });
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent("Page introuvable");
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<SujetFicheScreen slug={SLUG_EXEMPLE} />, {
      routes: {
        [pathname]: () => {
          throw new ApiError(500, pathname);
        },
      },
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("écrit les filtres dans l'URL", async () => {
    const { findByRole, visited } = renderScreen(<SujetFicheScreen slug={SLUG_EXEMPLE} />, {
      pathname,
      routes: routesSujetExemple,
    });
    const chambre = await findByRole("group", { name: "Chambre" });
    fireEvent.click(within(chambre).getByRole("radio", { name: "Sénat" }));
    await waitFor(() => expect(visited).toContain(`${pathname}?chambre=senat`));
    fireEvent.change(await findByRole("combobox", { name: "Trier les groupes" }), {
      target: { value: "votes" },
    });
    await waitFor(() => expect(visited).toContain(`${pathname}?tri=votes`));
  });
});
