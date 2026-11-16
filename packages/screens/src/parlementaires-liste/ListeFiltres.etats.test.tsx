import type { GroupeOption } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { groupesExemple } from "./fixtures.ts";
import { ListeFiltres, type PeriodeOption } from "./ListeFiltres.tsx";
import { type ParlementairesListeFiltres, parseParlementairesListeParams } from "./params.ts";

const groupes: GroupeOption[] = groupesExemple.data;
const sessions: PeriodeOption[] = [
  { valeur: "2025", label: "Session 2025" },
  { valeur: "2024", label: "Session 2024" },
];

const rendre = (
  filtres: Partial<ParlementairesListeFiltres>,
  periodes: PeriodeOption[] = sessions,
) => {
  const changements: Partial<ParlementairesListeFiltres>[] = [];
  let reinitialise = 0;
  renderScreen(
    <ListeFiltres
      chambre="senat"
      filtres={{ ...parseParlementairesListeParams({}, "senat"), ...filtres }}
      groupes={groupes}
      periodes={periodes}
      onChange={(changement) => changements.push(changement)}
      onReset={() => {
        reinitialise += 1;
      }}
    />,
  );
  return { changements, reinitialises: () => reinitialise };
};

describe("ListeFiltres", () => {
  it("affiche les filtres actifs et les retire un à un", () => {
    const { changements, reinitialises } = rendre({
      recherche: "exemple",
      groupe: "exemple",
      periode: "2024",
    });
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Recherche : exemple" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Groupe : EXE" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Session 2024" }));
    expect(changements).toEqual([{ recherche: "" }, { groupe: "" }, { periode: "", groupe: "" }]);
    fireEvent.click(screen.getAllByRole("button", { name: /Réinitialiser/ })[0] as HTMLElement);
    expect(reinitialises()).toBe(1);
  });

  it("garde le slug d'un groupe inconnu et la valeur d'une période inconnue", () => {
    rendre({ groupe: "disparu", periode: "1999" });
    expect(
      screen.getByRole("button", { name: "Retirer le filtre Groupe : disparu" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer le filtre 1999" })).toBeInTheDocument();
  });

  it("n'affiche pas la période en cours comme un filtre et change de session", () => {
    const { changements } = rendre({ periode: "2025" });
    expect(screen.queryByRole("button", { name: /Retirer le filtre/ })).toBeNull();
    const session = screen.getByLabelText("Session");
    expect(screen.getByRole("option", { name: "Session 2025 (en cours)" })).toBeInTheDocument();
    fireEvent.change(session, { target: { value: "2024" } });
    fireEvent.change(session, { target: { value: "2025" } });
    fireEvent.change(screen.getByLabelText("Groupe politique"), {
      target: { value: "exemple" },
    });
    fireEvent.change(screen.getByLabelText("Trier par"), { target: { value: "presence" } });
    expect(changements).toEqual([
      { periode: "2024", groupe: "" },
      { periode: "", groupe: "" },
      { groupe: "exemple" },
      { tri: "presence" },
    ]);
  });

  it("masque le choix de période quand il n'y en a qu'une, ou aucune", () => {
    rendre({}, []);
    expect(screen.queryByLabelText("Session")).toBeNull();
  });
});
