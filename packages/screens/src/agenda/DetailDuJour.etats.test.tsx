import type { AgendaEvenement, AgendaReunion, DirectsDuJour } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DetailDuJour } from "./DetailDuJour.tsx";
import { evenementExemple, reunionAgendaExemple, seanceAgendaExemple } from "./fixtures.ts";

const JOUR = "2026-03-03";
const APRES = new Date("2026-03-04T00:00:00.000Z");

const rendre = (
  reunions: AgendaReunion[],
  evenements: AgendaEvenement[] = [],
  { maintenant = APRES, routes = {} }: { maintenant?: Date; routes?: Record<string, unknown> } = {},
) =>
  renderScreen(
    <DetailDuJour
      jour={JOUR}
      reunions={reunions}
      evenements={evenements}
      maintenant={maintenant}
    />,
    { routes },
  );

afterEach(() => {
  window.location.hash = "";
});

describe("DetailDuJour", () => {
  it("invite à choisir un jour", () => {
    const { getByText } = renderScreen(
      <DetailDuJour jour="" reunions={[]} evenements={[]} maintenant={APRES} />,
    );
    expect(getByText("Choisissez un jour dans le calendrier")).toBeInTheDocument();
  });

  it("titre une réunion sans organe par sa nature, et un organe sans nom par son nom court", () => {
    const commission = reunionAgendaExemple.commission;
    if (!commission) throw new Error("fixture sans commission");
    const { getByRole } = rendre([
      { ...seanceAgendaExemple, id: "s", scrutins: [] },
      { ...reunionAgendaExemple, id: "r", commission: null, nbParticipants: 0 },
      { ...reunionAgendaExemple, id: "c", commission: { ...commission, nom: "" } },
    ]);
    const liste = getByRole("list", { name: "Réunions du jour" });
    expect(within(liste).getByRole("heading", { name: "Séance publique" })).toBeInTheDocument();
    expect(
      within(liste).getByRole("heading", { name: "Réunion de commission" }),
    ).toBeInTheDocument();
    expect(within(liste).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("ne donne ni vidéo ni compte rendu à une réunion à venir sans adresse", () => {
    const { queryByRole } = rendre(
      [
        {
          ...reunionAgendaExemple,
          urlVideo: "pas une adresse",
          nbParticipants: 0,
          odjResume: null,
        },
      ],
      [],
      { maintenant: new Date("2026-03-01T00:00:00.000Z") },
    );
    expect(queryByRole("link", { name: /Vidéo/ })).toBeNull();
    expect(queryByRole("link", { name: /Compte rendu/ })).toBeNull();
  });

  it("déplie puis replie un long ordre du jour", () => {
    const long = Array.from({ length: 8 }, (_, i) => `Point d'exemple numéro ${i} assez long`).join(
      "|",
    );
    const { getByRole } = rendre([{ ...reunionAgendaExemple, odjResume: long }]);
    const bouton = getByRole("button", { name: /Lire tout l'ordre du jour/ });
    fireEvent.click(bouton);
    expect(bouton).toHaveAccessibleName(/Réduire l'ordre du jour/);
  });

  it("lie la page dédiée d'un événement et ignore une source sans adresse sûre", () => {
    const { getByRole, getByText } = rendre(
      [],
      [
        {
          ...evenementExemple,
          slug: "bureau-senat-2026",
          sources: [{ label: "Source sans adresse", url: "javascript:alert(1)" }],
        },
        {
          ...evenementExemple,
          id: "e2",
          slug: "autre",
          titre: "Autre repère d'exemple",
          sources: null,
        },
      ],
    );
    expect(getByRole("link", { name: "Les résultats des sénatoriales" })).toHaveAttribute(
      "href",
      "/senatoriales-2026#resultats",
    );
    expect(getByText("Source sans adresse")).toBeInTheDocument();
    expect(getByText("Autre repère d'exemple")).toBeInTheDocument();
  });

  it("annonce une réunion en cours avec le lien du direct de sa commission", async () => {
    const debut = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const directs: DirectsDuJour = {
      commissions: [
        {
          organeRef: "POEXEMPLE1",
          directUrl: "https://direct.exemple.test/commission",
          chambre: "assemblee",
        },
      ],
      seances: [],
    };
    const { findByRole, findAllByText, queryByRole } = rendre(
      [{ ...reunionAgendaExemple, dateDebut: debut }],
      [],
      { maintenant: new Date(), routes: { "/agenda/direct": directs } },
    );
    expect((await findAllByText("En direct")).length).toBeGreaterThan(0);
    expect(await findByRole("link", { name: /Suivre en direct/ })).toHaveAttribute(
      "href",
      "https://direct.exemple.test/commission",
    );
    expect(queryByRole("link", { name: /Vidéo/ })).toBeNull();
  });

  it("amène à l'écran la réunion visée par l'ancre, sans animation si le lecteur le demande", () => {
    const defiler = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = defiler;
    const matchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    window.location.hash = `#event-${reunionAgendaExemple.id}`;
    try {
      rendre([reunionAgendaExemple]);
      expect(defiler).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    } finally {
      Element.prototype.scrollIntoView = original;
      window.matchMedia = matchMedia;
    }
  });

  it("ignore une ancre qui ne vise pas une réunion", () => {
    const defiler = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = defiler;
    window.location.hash = "#ailleurs";
    try {
      rendre([reunionAgendaExemple]);
      expect(defiler).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
