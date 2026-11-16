import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { eluExemple, groupesExemple, listeExemple, pageListe } from "./fixtures.ts";
import { ParlementairesListeScreen } from "./ParlementairesListeScreen.tsx";

// Sessions et élus FICTIFS.
const sessions = {
  data: [
    { session: "2025", count: 348 },
    { session: "2024", count: 348 },
  ],
};
const routesSenat = {
  "/senateurs": pageListe(
    [eluExemple("alex-fictif", "Alex", "Fictif"), eluExemple("sam-fictif", "Sam", "Fictif")],
    { total: 2, totalPages: 1 },
  ),
  "/senateurs/groupes": groupesExemple,
  "/senateurs/sessions": sessions,
};

describe("ParlementairesListeScreen, variantes", () => {
  it("présente le Sénat, ses sièges, sa session et le lien vers les archives", async () => {
    renderScreen(<ParlementairesListeScreen chambre="senat" />, {
      pathname: "/senateurs",
      routes: routesSenat,
    });
    expect(await screen.findByText("2 résultats")).toBeInTheDocument();
    expect(await screen.findByText(/2 sénateurs sur 348 sièges — Session 2025/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Guide" })).toBeNull();
    expect(screen.getByRole("link", { name: /Voir les archives/ })).toHaveAttribute(
      "href",
      "/senateurs?session=2024",
    );
  });

  it("dit « ont siégé » pour une période passée, sans lien vers les archives", async () => {
    renderScreen(<ParlementairesListeScreen chambre="senat" params={{ session: "2024" }} />, {
      pathname: "/senateurs",
      routes: routesSenat,
    });
    expect(await screen.findByText(/2 sénateurs ont siégé — Session 2024/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /Voir les archives/ })).toBeNull();
  });

  it("donne l'effectif filtré, sans les sièges, pendant la période en cours", async () => {
    renderScreen(<ParlementairesListeScreen chambre="senat" params={{ groupe: "exemple" }} />, {
      pathname: "/senateurs",
      routes: routesSenat,
    });
    expect(await screen.findByText(/^2 sénateurs — Session 2025$/)).toBeVisible();
  });

  it("accorde l'effectif au singulier pour un seul élu", async () => {
    renderScreen(<ParlementairesListeScreen chambre="senat" params={{ groupe: "exemple" }} />, {
      pathname: "/senateurs",
      routes: {
        ...routesSenat,
        "/senateurs": pageListe([eluExemple("alex-fictif", "Alex", "Fictif")], {
          total: 1,
          totalPages: 1,
        }),
      },
    });
    expect(await screen.findByText(/^1 sénateur — Session 2025$/)).toBeVisible();
  });

  it("change de chambre par l'interrupteur", async () => {
    const { visited } = renderScreen(<ParlementairesListeScreen chambre="assemblee" />, {
      pathname: "/deputes",
      routes: { "/deputes": listeExemple, "/deputes/groupes": groupesExemple },
    });
    await screen.findByRole("link", { name: /Camille Exemple/ });
    fireEvent.click(screen.getByRole("radio", { name: /Assemblée nationale/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Sénat" }));
    expect(visited).toEqual(["/senateurs"]);
  });

  it("décoche un élu du comparateur et bloque au-delà du maximum", async () => {
    const { visited } = renderScreen(
      <ParlementairesListeScreen
        chambre="assemblee"
        params={{ compare: "camille-exemple,dominique-test,a-b,c-d" }}
      />,
      {
        pathname: "/deputes",
        routes: { "/deputes": listeExemple, "/deputes/groupes": groupesExemple },
      },
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: /Comparer Camille Exemple/ }));
    expect(visited[0]).toBe("/deputes?compare=dominique-test%2Ca-b%2Cc-d");
  });
});
