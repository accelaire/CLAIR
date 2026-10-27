import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { EvenementCard, formatEvenementDate, isHappeningNow } from "./EvenementCard.tsx";

describe("EvenementCard", () => {
  it("affiche type, chambre, date et heure de Paris, et mène à la réunion", () => {
    const { getByRole, getByText } = renderWithProviders(
      <EvenementCard
        title="Commission des finances"
        type="commission"
        chambre="assemblee"
        start="2026-03-03T09:30:00+01:00"
        end="2026-03-03T12:00:00+01:00"
        lieu="Salle d'exemple"
        href="#reunion"
      />,
    );
    expect(getByRole("article")).toBeInTheDocument();
    expect(getByRole("link", { name: "Commission des finances" })).toHaveAttribute(
      "href",
      "#reunion",
    );
    expect(getByText("Réunion de commission")).toBeInTheDocument();
    expect(getByText("Assemblée nationale")).toBeInTheDocument();
    expect(getByText("mardi 3 mars 2026, 09:30 – 12:00")).toBeInTheDocument();
    expect(getByText("Salle d'exemple")).toBeInTheDocument();
  });

  it("annonce « En direct » en texte et propose la retransmission", () => {
    const { getByText, getByRole } = renderWithProviders(
      <EvenementCard
        title="Séance publique"
        type="seance"
        chambre="senat"
        start="2026-03-03T14:30:00+01:00"
        live
        liveHref="https://videos.senat.fr"
      />,
    );
    expect(getByText("En direct")).toBeInTheDocument();
    expect(getByRole("link", { name: "Suivre en direct (nouvelle fenêtre)" })).toHaveAttribute(
      "href",
      "https://videos.senat.fr",
    );
  });

  it("n'affiche que le mois d'une date non encore fixée", () => {
    expect(formatEvenementDate("2026-09-01", null, false)).toBe(
      "Courant septembre 2026 (date non encore fixée)",
    );
    expect(formatEvenementDate("2026-07-01", "2026-07-03")).toBe(
      "Du mercredi 1 juillet 2026 au vendredi 3 juillet 2026",
    );
  });

  it("calcule si l'événement a lieu maintenant (4 h par défaut sans fin)", () => {
    const debut = "2026-03-03T14:00:00+01:00";
    expect(isHappeningNow(debut, null, new Date("2026-03-03T16:00:00+01:00"))).toBe(true);
    expect(isHappeningNow(debut, null, new Date("2026-03-03T19:00:00+01:00"))).toBe(false);
    expect(
      isHappeningNow(debut, "2026-03-03T15:00:00+01:00", new Date("2026-03-03T16:00:00+01:00")),
    ).toBe(false);
  });

  it("dit « date inconnue » pour un début invalide et ignore une fin invalide", () => {
    expect(formatEvenementDate("")).toBe("date inconnue");
    expect(formatEvenementDate("2026-03-03", "invalide")).toBe(formatEvenementDate("2026-03-03"));
  });
});
