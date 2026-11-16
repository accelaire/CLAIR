import type { LobbyingActionListItem } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ActionLobbying } from "./ActionLobbying.tsx";
import { actionExemple, actionExemple2 } from "./fixtures.ts";

const rendre = (action: LobbyingActionListItem, avecAuteur = true) =>
  renderScreen(
    <ul>
      <ActionLobbying
        action={action}
        lobbyiste={avecAuteur ? action.lobbyiste : undefined}
        maxSecteurs={2}
      />
    </ul>,
  );

/** Secteurs FICTIFS, plus nombreux que ceux affichés. */
const secteurs = (nombre: number) =>
  Array.from({ length: nombre }, (_, index) => ({
    slug: `secteur-${index}`,
    label: `Secteur fictif ${index}`,
  }));

describe("ActionLobbying : cas limites", () => {
  it("compte un secteur de plus que ceux affichés, au singulier", () => {
    const { getByText } = rendre({ ...actionExemple, secteursList: secteurs(3) });
    expect(getByText("+1")).toBeInTheDocument();
    expect(getByText("autre secteur", { exact: false })).toBeInTheDocument();
  });

  it("compte plusieurs secteurs de plus, au pluriel", () => {
    const { getByText } = rendre({ ...actionExemple, secteursList: secteurs(5) });
    expect(getByText("+3")).toBeInTheDocument();
    expect(getByText("autres secteurs", { exact: false })).toBeInTheDocument();
  });

  it("sans objet, cible, date, détails ni auteur, garde un titre explicite", () => {
    const { getByRole, queryByRole, queryByText } = rendre(
      {
        ...actionExemple,
        description: "",
        cible: null,
        dateDebut: null,
        texteViseNom: null,
        cibleNom: null,
        parlementaire: null,
      },
      false,
    );
    expect(getByRole("heading", { name: "Objet non précisé" })).toBeInTheDocument();
    expect(queryByText(/Cible :/)).toBeNull();
    expect(queryByRole("time")).toBeNull();
    expect(queryByText("Texte visé")).toBeNull();
    expect(queryByRole("link")).toBeNull();
  });

  it("garde une cible inconnue telle quelle et un parlementaire sans groupe", () => {
    const { getByText, getByRole, queryByText } = rendre({
      ...actionExemple2,
      cible: "cible-fictive",
      texteViseNom: null,
      cibleNom: "Responsables fictifs",
      parlementaire: actionExemple.parlementaire
        ? { ...actionExemple.parlementaire, groupe: null }
        : null,
    });
    expect(getByText("cible-fictive")).toBeInTheDocument();
    expect(getByText("Responsables fictifs")).toBeInTheDocument();
    expect(getByRole("link", { name: "Camille Exemple" })).toBeInTheDocument();
    expect(queryByText("Groupe d'exemple")).toBeNull();
  });

  it("montre l'auteur sans type ni secteur, puis avec un type inconnu", () => {
    const sansMention = rendre({
      ...actionExemple,
      lobbyiste: { ...actionExemple.lobbyiste, type: null, secteur: null },
    });
    expect(
      sansMention.getByRole("link", { name: actionExemple.lobbyiste.nom }),
    ).toBeInTheDocument();
    expect(sansMention.queryByText(/·/)).toBeNull();
    sansMention.unmount();

    const typeInconnu = rendre({
      ...actionExemple,
      lobbyiste: { ...actionExemple.lobbyiste, type: "type-fictif", secteur: null },
    });
    expect(typeInconnu.getByText("type-fictif")).toBeInTheDocument();
  });
});
