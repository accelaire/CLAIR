import { ApiError } from "@clair/api-client";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { debatExemple, detail, reunionDetailExemple, seanceExemple } from "./fixtures.ts";
import { ReunionScreen } from "./ReunionScreen.tsx";

const routesDe = (uid: string, data = detail(reunionDetailExemple)) => ({
  [`/agenda/${uid}`]: data,
  [`/agenda/${uid}/debat`]: debatExemple,
  "/scrutins/interventions/prise-1": {
    data: {
      id: "prise-1",
      contenu: "Début d'un propos d'exemple, et sa suite complète.",
      sourceUrl: null,
    },
  },
});

describe("ReunionScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<ReunionScreen uid="RUANREXEMPLE1" />, {
      routes: { "/agenda/RUANREXEMPLE1": () => new Promise(() => {}) },
      pathname: "/reunions/RUANREXEMPLE1",
    });
    expect(getByRole("status")).toHaveTextContent("Chargement de la réunion");
  });

  it("affiche la réunion d'une commission : ordre du jour, liens, avis et participants", async () => {
    const { getByRole, findByRole } = renderScreen(
      <ReunionScreen uid="RUANREXEMPLE1" initialData={detail(reunionDetailExemple)} />,
      { routes: routesDe("RUANREXEMPLE1"), pathname: "/reunions/RUANREXEMPLE1" },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Commission des jardins partagés");
    const fil = getByRole("navigation", { name: /fil d'Ariane/i });
    expect(
      within(fil).getByRole("link", { name: "Commission des jardins partagés" }),
    ).toHaveAttribute("href", "/commissions/assemblee-commission-des-jardins-partages");
    expect(getByRole("link", { name: /Compte rendu intégral/ })).toHaveAttribute(
      "href",
      "https://www.assemblee-nationale.fr/dyn/docs/CRCANREXEMPLE.html",
    );
    expect(getByRole("table", { name: /Avis de la commission/ })).toBeInTheDocument();
    expect(getByRole("link", { name: "Camille Fictive" })).toHaveAttribute(
      "href",
      "/deputes/camille-fictive",
    );
    expect(await findByRole("heading", { name: /Débat : 2 prises de parole/ })).toBeInTheDocument();
  });

  it("déroule le débat avec ses intertitres, ses votes et la suite des propos", async () => {
    const { findByRole, getByRole, findByText, getByText } = renderScreen(
      <ReunionScreen
        uid="RUANRSEANCEEXEMPLE"
        params={{ vote: "scrutin-exemple-1", rang: "1" }}
        initialData={detail(seanceExemple)}
      />,
      { routes: routesDe("RUANRSEANCEEXEMPLE", detail(seanceExemple)), pathname: "/reunions/X" },
    );
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Séance publique");
    expect(getByRole("complementary", { name: "Vote suivi" })).toHaveTextContent(
      "Vous suivez le scrutin n° 42",
    );
    expect(await findByText(/Article 1 · Amendement n° 7/)).toBeInTheDocument();
    const vote = await findByRole("link", { name: "Scrutin n° 42", current: true });
    expect(vote).toHaveAttribute("href", "/scrutins/42?chambre=assemblee&session=17");
    fireEvent.click(getByRole("button", { name: "Lire la suite" }));
    expect(await findByText(/et sa suite complète/)).toBeInTheDocument();
    expect(getByText("Ordre du jour de la séance")).toBeInTheDocument();
    expect(getByRole("link", { name: /2 prises de parole/ })).toHaveAttribute(
      "href",
      "/reunions/X?vote=scrutin-exemple-1&rang=1#prise-1",
    );
  });

  it("déplie un point du sommaire", () => {
    const { getByRole } = renderScreen(
      <ReunionScreen uid="RUANRSEANCEEXEMPLE" initialData={detail(seanceExemple)} />,
      { routes: routesDe("RUANRSEANCEEXEMPLE", detail(seanceExemple)), pathname: "/reunions/X" },
    );
    const bouton = getByRole("button", { name: /Suite de la discussion/ });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(getByRole("link", { name: "Texte d'exemple" })).toHaveAttribute(
      "href",
      "/dossiers/DLEXEMPLE9",
    );
  });

  it("dit qu'une réunion est introuvable", async () => {
    const { findByText } = renderScreen(<ReunionScreen uid="inconnue" />, {
      routes: { "/agenda/inconnue": () => Promise.reject(new ApiError(404, "x")) },
      pathname: "/reunions/inconnue",
    });
    expect(await findByText("Réunion introuvable")).toBeInTheDocument();
  });

  it("signale une erreur et permet de réessayer", async () => {
    const { findByRole } = renderScreen(<ReunionScreen uid="X" />, {
      routes: { "/agenda/X": () => Promise.reject(new Error("panne")) },
      pathname: "/reunions/X",
    });
    expect(await findByRole("alert")).toBeInTheDocument();
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
