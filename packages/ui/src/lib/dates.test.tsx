import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test-utils.tsx";
import {
  DATE_INCONNUE,
  estDateValide,
  formatSur,
  jourAParis,
  jourParis,
  moisParis,
  Quand,
} from "./dates.tsx";

describe("dates", () => {
  it("formate en heure de Paris : 23 h UTC le 2 mars, c'est déjà le 3 à Paris", () => {
    expect(formatSur(jourParis, "2026-03-02T23:30:00Z")).toBe("3 mars 2026");
    expect(formatSur(moisParis, "2026-03-02")).toBe("mars 2026");
  });

  it("repère une date vide ou invalide au lieu de lever une exception", () => {
    for (const valeur of ["", "pas une date", null, undefined]) {
      expect(estDateValide(valeur)).toBe(false);
      expect(formatSur(jourParis, valeur)).toBeNull();
    }
  });

  it("rend un <time> lisible, ou « date inconnue » en texte", () => {
    const { container, getByText } = renderWithProviders(
      <>
        <Quand iso="2026-03-03" />
        <Quand iso="n'importe quoi" />
      </>,
    );
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-03-03");
    expect(getByText(DATE_INCONNUE).tagName).toBe("SPAN");
  });

  it("donne le jour à Paris : 23 h 30 UTC le 31 décembre, c'est déjà le 1er janvier", () => {
    expect(jourAParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});
