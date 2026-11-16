import type { Sortant } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { sortantsExemple } from "../fixtures.ts";
import { PyramideAges } from "./PyramideAges.tsx";

const base = sortantsExemple[0] as Sortant;
const avecPersonne = (id: string, personne: Partial<Sortant["personne"]>): Sortant => ({
  ...base,
  mandatId: `mandat-${id}`,
  personne: { ...base.personne, ...personne },
});

describe("PyramideAges", () => {
  it("prévient quand aucune date de naissance n'est connue", () => {
    renderScreen(<PyramideAges sortants={[avecPersonne("a", { dateNaissance: null })]} />);
    expect(
      screen.getByText("Les dates de naissance ne sont pas encore disponibles pour ces sénateurs."),
    ).toBeInTheDocument();
  });

  it("compte les sexes non renseignés et surligne la tranche", () => {
    const onSelection = vi.fn();
    renderScreen(
      <PyramideAges
        sortants={[
          avecPersonne("x", { dateNaissance: "1960-01-01", sexe: null }),
          avecPersonne("y", { dateNaissance: null }),
        ]}
        onSelection={onSelection}
      />,
    );
    const tranche = screen.getByRole("button", {
      name: "Surligner les sortants de 65–69 ans : 0 hommes, 0 femmes, 1 non renseignés",
    });
    fireEvent.click(tranche);
    expect(onSelection).toHaveBeenCalledWith(["mandat-x"], "65–69 ans");
    fireEvent.focus(tranche);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Non renseigné");
  });
});
