import type { FixtureRoutes } from "@clair/api-client";
import type { AgendaEvenement, DirectsDuJour, HomepageReunion } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { AccueilScreen } from "./AccueilScreen.tsx";
import { chambreDeReunion } from "./agenda.ts";
import { echeanceExemple, homepageExemple, reunionCommission, reunionSeance } from "./fixtures.ts";
import { ProchainementAuParlement } from "./ProchainementAuParlement.tsx";

/** Directs FICTIFS du jour de la séance d'exemple. */
const directs: DirectsDuJour = {
  commissions: [],
  seances: [
    {
      isoDate: "2026-03-03",
      order: 1,
      directUrl: "https://direct.exemple.invalid/1",
      chambre: "assemblee",
    },
  ],
};

const rendre = (
  events: HomepageReunion[],
  routes: FixtureRoutes = {},
  evenements?: AgendaEvenement[],
) =>
  renderScreen(
    <ProchainementAuParlement
      upcoming={{ events, evenements }}
      isPending={false}
      isError={false}
      onRetry={() => undefined}
    />,
    { routes },
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("ProchainementAuParlement : réunions en cours", () => {
  it("signale « En direct » une séance retransmise en ce moment", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-03T14:30:00.000Z") });
    const { findByText } = rendre([reunionSeance], { "/agenda/direct": directs });
    expect(await findByText("En direct")).toBeInTheDocument();
  });

  it("signale « En cours » une réunion sans direct, sans chambre connue", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-03T14:30:00.000Z") });
    const sansChambre: HomepageReunion = {
      ...reunionSeance,
      type: "commission",
      lieu: null,
      compteRenduRef: null,
      odjResume: null,
      commission: reunionCommission.commission
        ? { ...reunionCommission.commission, nomCourt: "", chambre: "inconnue", organeRef: null }
        : null,
    };
    const { findByText, getByRole } = rendre([sansChambre], {
      "/agenda/direct": { commissions: [], seances: [] },
    });
    expect(await findByText("En cours")).toBeInTheDocument();
    const lien = getByRole("link", { name: /Commission des exemples/ });
    expect(within(lien).queryByText("En direct")).toBeNull();
    expect(lien).toHaveTextContent("Commission");
  });
});

describe("ProchainementAuParlement : planning", () => {
  it("nomme « Séance publique » une réunion sans organe et place les repères du jour", () => {
    const repere: AgendaEvenement = {
      ...echeanceExemple,
      id: "repere-fictif",
      type: "session",
      titre: "Exemple : repère fictif",
      dateDebut: "2026-03-03T00:00:00.000Z",
    };
    const { getByRole } = rendre([{ ...reunionSeance, commission: null }], {}, [repere]);
    expect(getByRole("link", { name: /Séance publique/ })).toBeInTheDocument();
    expect(getByRole("link", { name: /Exemple : repère fictif/ })).toHaveAttribute(
      "href",
      "/agenda?date=2026-03-03",
    );
  });

  it("sans planning, annonce l'absence d'événement", () => {
    const { getByText, queryByRole } = renderScreen(
      <ProchainementAuParlement
        upcoming={null}
        isPending={false}
        isError={false}
        onRetry={() => undefined}
      />,
    );
    expect(getByText("Aucun événement à venir")).toBeInTheDocument();
    expect(queryByRole("heading", { name: "Prochaines échéances" })).toBeNull();
  });
});

describe("chambre d'une réunion", () => {
  it("se lit sur le compte rendu du Sénat ou sur le lieu", () => {
    const base: HomepageReunion = { ...reunionSeance, commission: null, lieu: null };
    expect(chambreDeReunion({ ...base, compteRenduRef: "CRSSFICTIF" })).toBe("senat");
    expect(chambreDeReunion({ ...base, compteRenduRef: null, lieu: "Palais du Luxembourg" })).toBe(
      "senat",
    );
    expect(chambreDeReunion({ ...base, compteRenduRef: null, lieu: "Assemblée nationale" })).toBe(
      "assemblee",
    );
    expect(chambreDeReunion({ ...base, compteRenduRef: null })).toBeNull();
  });
});

describe("AccueilScreen : recherche vide", () => {
  it("ne lance pas de recherche sur un terme vide", () => {
    const { getByRole, visited } = renderScreen(<AccueilScreen initialData={homepageExemple} />, {
      routes: {},
    });
    fireEvent.change(
      getByRole("searchbox", { name: "Rechercher un député, un département, un scrutin" }),
      { target: { value: "   " } },
    );
    fireEvent.click(getByRole("button", { name: "Rechercher" }));
    expect(visited).toEqual([]);
  });
});
