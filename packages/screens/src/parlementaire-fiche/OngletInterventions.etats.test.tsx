import type { InterventionSeance, SeanceInterventions } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { page } from "./fixtures.ts";
import { OngletInterventions } from "./OngletInterventions.tsx";
import { type ParlementaireFicheFiltres, parseParlementaireFicheParams } from "./params.ts";

// Séances et prises de parole FICTIVES.
const intervention = (
  id: string,
  partiel: Partial<InterventionSeance> = {},
): InterventionSeance => ({
  id,
  date: "2026-03-03T14:00:00.000Z",
  type: "intervention",
  contenu: `Propos fictif ${id}`,
  hasMore: false,
  motsCles: [],
  sourceUrl: null,
  ordre: 1,
  articleVise: null,
  dossier: null,
  scrutinIds: [],
  ...partiel,
});

const seance = (id: string, partiel: Partial<SeanceInterventions> = {}): SeanceInterventions => ({
  seanceId: id,
  date: "2026-03-03T14:00:00.000Z",
  interventions: [intervention(`${id}-1`)],
  scrutins: [],
  ordreDuJour: [],
  ...partiel,
});

const route = "/deputes/camille-exemple/interventions";

const rendre = (reponse: unknown, filtres: Partial<ParlementaireFicheFiltres> = {}) => {
  const changements: Partial<ParlementaireFicheFiltres>[] = [];
  const rendu = renderScreen(
    <OngletInterventions
      chemin="/deputes"
      slug="camille-exemple"
      filtres={{ ...parseParlementaireFicheParams({}), ...filtres }}
      changer={(changement) => changements.push(changement)}
      pageHref={(n) => `?page=${n}`}
    />,
    { routes: { [route]: reponse } },
  );
  return { ...rendu, changements };
};

describe("OngletInterventions, variantes", () => {
  it("dit qu'aucune prise de parole de cette nature n'existe et explique les interruptions", async () => {
    const { changements } = rendre(page([]), { type: "interruption" });
    expect(
      await screen.findByText("Aucune prise de parole de cette nature pour ces critères."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Les interruptions sont de vraies prises de parole/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Nature des prises de parole"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Nature des prises de parole"), {
      target: { value: "question" },
    });
    expect(changements).toEqual([{ type: "" }, { type: "question" }]);
  });

  it("présente les séances : la première ouverte, avec ses votes, les autres repliées", async () => {
    rendre(
      page([
        seance("S1", {
          interventions: [
            intervention("S1-1", {
              type: "question",
              articleVise: "Article 2",
              dossier: { uid: "DLR-FICTIF", titre: "Projet de loi fictif" },
              sourceUrl: "https://exemple.fr/compte-rendu",
              hasMore: true,
            }),
            intervention("S1-2", { type: "nature_inconnue" }),
          ],
          scrutins: [
            {
              id: "sc1",
              numero: 9,
              titre: "l'article 2",
              date: "2026-03-03T00:00:00.000Z",
              sort: "adopte",
              chambre: "assemblee",
              session: "17",
            },
          ],
        }),
        seance("S2"),
      ]),
    );
    expect(await screen.findByText("2 interventions · 1 vote")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("nature_inconnue")).toBeInTheDocument();
    expect(screen.getByText("Article 2")).toBeInTheDocument();
    expect(screen.getByText("Propos fictif S1-1…")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compte rendu intégral/ })).toHaveAttribute(
      "href",
      "https://exemple.fr/compte-rendu",
    );
    expect(screen.getByRole("link", { name: "Scrutin n° 9 : l'article 2" })).toHaveAttribute(
      "href",
      "/scrutins/9?chambre=assemblee&session=17",
    );
    expect(screen.getByText("1 intervention")).toBeInTheDocument();
    const boutons = screen.getAllByRole("button", { name: /les prises de parole/ });
    expect(boutons[0]).toHaveAttribute("aria-expanded", "true");
    expect(boutons[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("link", { name: /Voir la séance complète/ })).toHaveLength(1);
    fireEvent.click(boutons[1] as HTMLElement);
    expect(screen.getAllByRole("link", { name: /Voir la séance complète/ })).toHaveLength(2);
  });
});
