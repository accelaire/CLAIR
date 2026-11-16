import type { VoteParlementaire } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { scrutinDetailExemple, vote } from "./fixtures.ts";
import { parseScrutinFicheParams, type ScrutinFicheParams } from "./params.ts";
import { VotesOnglet } from "./VotesOnglet.tsx";

const rendre = (
  scrutin: ReturnType<typeof scrutinDetailExemple>,
  params: Partial<ScrutinFicheParams> = {},
) => {
  const update = vi.fn();
  return {
    ...renderScreen(
      <VotesOnglet
        scrutin={scrutin}
        params={{ ...parseScrutinFicheParams({}), ...params }}
        update={update}
      />,
    ),
    update,
  };
};

/** Votant FICTIF du Sénat. */
const senateur = (id: string, sigle: string | null): VoteParlementaire => {
  const v = vote(id, "pour", "Alex", `Sénateur${id}`, sigle ?? "X");
  return {
    ...v,
    parlementaire: {
      ...v.parlementaire,
      chambre: "senat",
      groupe: sigle ? v.parlementaire.groupe : null,
    },
  };
};

describe("VotesOnglet", () => {
  it("lie les groupes du Sénat à leur session, et un groupe sans votant reste sans lien", () => {
    const { getByRole } = rendre(
      scrutinDetailExemple({
        chambre: "senat",
        session: "2025",
        votesByPosition: {
          pour: [senateur("s1", "GSA"), senateur("s2", null)],
          contre: [],
          abstention: [],
          absent: [],
        },
        votesByGroupe: {
          GSA: { pour: 1, contre: 0, abstention: 0, absent: 0 },
          ORPHELIN: { pour: 0, contre: 0, abstention: 0, absent: 0 },
        },
      }),
    );
    expect(getByRole("link", { name: /composition du groupe/ })).toHaveAttribute(
      "href",
      "/groupes/senat/gsa?session=2025",
    );
    const table = getByRole("table", { name: /Positions de vote par groupe/ });
    expect(within(table).getByText("ORPHELIN")).toBeInTheDocument();
    expect(getByRole("heading", { name: /Par élu \(3 sénateurs\)/ })).toBeInTheDocument();
  });

  it("ne date pas un groupe sans session ni législature", () => {
    const sansPeriodeSenat = rendre(
      scrutinDetailExemple({
        chambre: "senat",
        session: null,
        votesByPosition: { pour: [senateur("s1", "GSA")], contre: [], abstention: [], absent: [] },
        votesByGroupe: { GSA: { pour: 1, contre: 0, abstention: 0, absent: 0 } },
      }),
    );
    expect(sansPeriodeSenat.getByRole("link", { name: /composition du groupe/ })).toHaveAttribute(
      "href",
      "/groupes/senat/gsa",
    );
    sansPeriodeSenat.unmount();
    const { getAllByRole } = rendre(scrutinDetailExemple({ legislature: null }));
    expect(
      getAllByRole("link", { name: /composition du groupe/ }).map((lien) =>
        lien.getAttribute("href"),
      ),
    ).toContain("/groupes/assemblee/gpa");
  });

  it("filtre par groupe et par position, et dit quand rien ne correspond", () => {
    const { getByText, getByLabelText, update } = rendre(scrutinDetailExemple(), {
      groupe: "GPA",
      position: "contre",
    });
    expect(getByText("Aucun vote pour ces critères.")).toBeInTheDocument();
    fireEvent.change(getByLabelText("Groupe"), { target: { value: "GPB" } });
    expect(update).toHaveBeenCalledWith({ groupe: "GPB" });
    fireEvent.change(getByLabelText("Position"), { target: { value: "pour" } });
    expect(update).toHaveBeenCalledWith({ position: "pour" });
  });

  it("compte zéro non-votant et dit qu'aucun groupe n'est décompté", () => {
    const scrutin = scrutinDetailExemple();
    const { getByText } = rendre({
      ...scrutin,
      votesByPosition: { ...scrutin.votesByPosition, absent: [] },
      votesByGroupe: {},
    });
    expect(getByText(/0 non-votant/)).toBeInTheDocument();
    expect(getByText("Aucun décompte par groupe")).toBeInTheDocument();
  });

  it("replie de nouveau une longue liste d'élus", () => {
    const pour = Array.from({ length: 18 }, (_, i) =>
      vote(`p${i}`, "pour", "Élu", `Fictif${i}`, "GPA"),
    );
    const { getByRole } = rendre(
      scrutinDetailExemple({ votesByPosition: { pour, contre: [], abstention: [], absent: [] } }),
    );
    const bouton = getByRole("button", { name: /Afficher les 2 autres/ });
    fireEvent.click(bouton);
    expect(bouton).toHaveTextContent(/Réduire la liste/);
  });
});
