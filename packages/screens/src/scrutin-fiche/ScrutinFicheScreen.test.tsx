import { ApiError } from "@clair/api-client";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { motionAdopteeExemple } from "../shared/contexte-gouvernemental/fixtures.ts";
import { renderScreen } from "../test-utils.tsx";
import { interventionsExemple, scrutinDetailExemple, vote } from "./fixtures.ts";
import { ScrutinFicheScreen } from "./ScrutinFicheScreen.tsx";

const PATH = "/scrutins/101";

describe("ScrutinFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(<ScrutinFicheScreen numero={101} />, {
      routes: { [PATH]: () => new Promise(() => undefined) },
      pathname: PATH,
    });
    expect(getByRole("status")).toHaveTextContent("Chargement du scrutin");
  });

  it("transmet la chambre et la session à l'API", async () => {
    const requetes: unknown[] = [];
    renderScreen(
      <ScrutinFicheScreen numero={101} params={{ chambre: "senat", session: "2025" }} />,
      {
        routes: {
          [PATH]: (query: unknown) => {
            requetes.push(query);
            return { data: scrutinDetailExemple({ chambre: "senat", session: "2025" }) };
          },
        },
        pathname: PATH,
      },
    );
    await waitFor(() => expect(requetes).toEqual([{ chambre: "senat", session: "2025" }]));
  });

  it("présente le scrutin, le dossier, le résumé IA signalé et les amendements", async () => {
    const { findByRole, getByRole, getByText } = renderScreen(
      <ScrutinFicheScreen numero={101} params={{ chambre: "assemblee", session: "17" }} />,
      { routes: { [PATH]: { data: scrutinDetailExemple() } }, pathname: PATH },
    );
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent(
      "L'amendement d'exemple n° 7",
    );
    expect(getByText("Générée par IA, à vérifier")).toBeInTheDocument();
    expect(getByRole("link", { name: /Proposition de loi d'exemple/ })).toHaveAttribute(
      "href",
      "/dossiers/DOSSIER-EXEMPLE",
    );
    // Onglet par défaut : les amendements, quand il y en a.
    expect(getByRole("tab", { name: /Amendements/ })).toHaveAttribute("aria-selected", "true");
    expect(getByRole("heading", { name: "Amendement n° 7" })).toBeInTheDocument();
    expect(getByText("Défendu en séance")).toBeInTheDocument();
  });

  it("annonce une motion de censure avant le dossier", async () => {
    const { findByRole, getByText } = renderScreen(
      <ScrutinFicheScreen numero={101} params={{ chambre: "assemblee", session: "17" }} />,
      {
        routes: { [PATH]: { data: scrutinDetailExemple({ motionCensure: motionAdopteeExemple }) } },
        pathname: PATH,
      },
    );
    expect(
      await findByRole("heading", { name: /Motion de censure · article 49, alinéa 3/ }),
    ).toBeInTheDocument();
    expect(getByText("adoptée, le gouvernement est renversé")).toBeInTheDocument();
  });

  it("change d'onglet dans l'URL en gardant la chambre et la session", async () => {
    const { findByRole, visited } = renderScreen(
      <ScrutinFicheScreen numero={101} params={{ chambre: "assemblee", session: "17" }} />,
      { routes: { [PATH]: { data: scrutinDetailExemple() } }, pathname: PATH },
    );
    fireEvent.click(await findByRole("tab", { name: /Vote/ }));
    expect(visited).toEqual([`${PATH}?chambre=assemblee&session=17&onglet=vote`]);
  });

  it("montre les votes par groupe et par élu, filtrables dans l'URL", async () => {
    const { findByRole, getByLabelText, getByRole, visited } = renderScreen(
      <ScrutinFicheScreen
        numero={101}
        params={{ chambre: "assemblee", session: "17", onglet: "vote", groupe: "GPB" }}
      />,
      { routes: { [PATH]: { data: scrutinDetailExemple() } }, pathname: PATH },
    );
    const tableau = await findByRole("table");
    expect(within(tableau).getAllByRole("row")).toHaveLength(3);
    expect(getByRole("link", { name: "Alex Fictif" })).toHaveAttribute(
      "href",
      "/deputes/alex-fictif",
    );
    expect(() => getByRole("link", { name: "Camille Exemple" })).toThrow();
    fireEvent.change(getByLabelText("Position"), { target: { value: "contre" } });
    expect(visited).toEqual([
      `${PATH}?chambre=assemblee&session=17&onglet=vote&groupe=GPB&position=contre`,
    ]);
  });

  it("ne montre d'abord que seize élus par position, les autres derrière un bouton", async () => {
    // Vingt votes fictifs.
    const pour = Array.from({ length: 20 }, (_, i) =>
      vote(`e${i}`, "pour", "Élu", `Fictif${i}`, "GPA"),
    );
    const scrutin = scrutinDetailExemple({
      votesByPosition: { pour, contre: [], abstention: [], absent: [] },
      votesByGroupe: { GPA: { pour: 20, contre: 0, abstention: 0, absent: 0 } },
      totalVotes: 20,
    });
    const { findByRole, getAllByRole, queryByRole } = renderScreen(
      <ScrutinFicheScreen
        numero={101}
        params={{ chambre: "assemblee", session: "17", onglet: "vote" }}
      />,
      { routes: { [PATH]: { data: scrutin } }, pathname: PATH },
    );
    const bouton = await findByRole("button", { name: "Afficher les 4 autres (pour)" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(getAllByRole("link", { name: /^Élu Fictif/ })).toHaveLength(16);
    expect(queryByRole("link", { name: "Élu Fictif19" })).toBeNull();
    fireEvent.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(getAllByRole("link", { name: /^Élu Fictif/ })).toHaveLength(20);
  });

  it("charge les débats du vote", async () => {
    const { findByText } = renderScreen(
      <ScrutinFicheScreen
        numero={101}
        params={{ chambre: "assemblee", session: "17", onglet: "debats" }}
      />,
      {
        routes: {
          [PATH]: { data: scrutinDetailExemple() },
          [`${PATH}/interventions`]: interventionsExemple,
        },
        pathname: PATH,
      },
    );
    expect(await findByText(/cette prise de parole est inventée/)).toBeInTheDocument();
    expect(await findByText("Défense de l'amendement n° 7")).toBeInTheDocument();
  });

  it("signale un scrutin introuvable", async () => {
    const { findByText } = renderScreen(<ScrutinFicheScreen numero={9999} />, {
      routes: {},
      pathname: "/scrutins/9999",
    });
    expect(await findByText("Scrutin introuvable")).toBeInTheDocument();
  });

  it("affiche une erreur récupérable", async () => {
    const { findByRole } = renderScreen(<ScrutinFicheScreen numero={101} />, {
      routes: { [PATH]: () => Promise.reject(new ApiError(500, PATH)) },
      pathname: PATH,
    });
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
