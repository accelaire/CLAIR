import type { FixtureRoutes } from "@clair/api-client";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ficheExemple, ficheReponse, page, votesExemple } from "./fixtures.ts";
import { metaFiche } from "./meta.ts";
import { ParlementaireFicheScreen } from "./ParlementaireFicheScreen.tsx";

const pathname = "/deputes/camille-exemple";
const routes: FixtureRoutes = {
  "/deputes/camille-exemple": ficheReponse,
  "/deputes/camille-exemple/votes": votesExemple,
  "/deputes/camille-exemple/amendements": page([]),
};

const rendre = (params = {}, autres: FixtureRoutes = routes) =>
  renderScreen(
    <ParlementaireFicheScreen chambre="assemblee" slug="camille-exemple" params={params} />,
    { pathname, routes: autres },
  );

describe("ParlementaireFicheScreen", () => {
  it("annonce le chargement", () => {
    const { getByRole } = rendre(
      {},
      { ...routes, "/deputes/camille-exemple": () => new Promise(() => {}) },
    );
    expect(getByRole("status")).toHaveTextContent("Chargement de la fiche");
  });

  it("présente l'élu, ses statistiques calculées, la synthèse IA et ses votes", async () => {
    const { findByRole, getByRole, getByText, getAllByText } = rendre();
    expect(await findByRole("heading", { level: 1 })).toHaveTextContent("Camille Exemple");
    expect(getByText("2e circonscription (99)")).toBeInTheDocument();
    expect(getByRole("heading", { name: "Statistiques" })).toBeInTheDocument();
    expect(getByText("Calculée par CLAIR")).toBeInTheDocument();
    expect(getAllByText("Générée par IA, à vérifier")).toHaveLength(1);
    expect(getByRole("tab", { name: "Votes", selected: true })).toBeInTheDocument();
    expect(
      await findByRole("link", { name: "L'ensemble du projet de loi exemple" }),
    ).toHaveAttribute("href", "/scrutins/42?chambre=assemblee&session=17");
    expect(getByText(/position majoritaire du groupe \(Pour\)/)).toBeInTheDocument();
    expect(getByRole("link", { name: /Suivant/ })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple?page=2",
    );
  });

  it("écrit l'onglet et les filtres dans l'URL", async () => {
    const { findByRole, getByLabelText, visited } = rendre({ page: "2" });
    fireEvent.click(await findByRole("tab", { name: /Déclarations HATVP/ }));
    fireEvent.click(getByLabelText("Uniquement les votes différents de la position du groupe"));
    expect(visited).toEqual([
      "/deputes/camille-exemple?onglet=declarations",
      "/deputes/camille-exemple?dissidents=1",
    ]);
  });

  it("affiche l'état vide d'un onglet", async () => {
    const { findByText } = rendre({ onglet: "amendements" });
    expect(await findByText("Aucun amendement trouvé pour ces critères.")).toBeInTheDocument();
  });

  it("affiche les mandats et les déclarations depuis la fiche", async () => {
    const { findByRole, getByRole } = rendre({ onglet: "declarations" });
    expect(await findByRole("link", { name: /Consulter sur hatvp.fr/ })).toBeInTheDocument();
    expect(
      getByRole("heading", { name: "Déclaration d'intérêts et d'activités" }),
    ).toBeInTheDocument();
  });

  it("ouvre l'onglet d'un ancien lien à ancre (#interventions) et le porte dans l'URL", async () => {
    window.history.replaceState(null, "", "/deputes/camille-exemple#interventions");
    // happy-dom signale le changement d'ancre (`hashchange`) après coup : on le laisse passer.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const { findByRole, visited } = rendre();
      await findByRole("heading", { level: 1 });
      expect(visited).toEqual(["/deputes/camille-exemple?onglet=interventions"]);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("filtre les interventions par nature et mène à la page de la séance", async () => {
    // Séance fictive, pour le test.
    const seances = page([
      {
        seanceId: "RUANR5L17S2025IDS99999",
        date: "2025-03-04T15:00:00.000Z",
        interventions: [
          {
            id: "i1",
            date: "2025-03-04T15:00:00.000Z",
            type: "question",
            contenu: "Texte fictif d'une question.",
            hasMore: false,
            motsCles: [],
            sourceUrl: null,
            ordre: 1,
            articleVise: null,
            dossier: null,
            scrutinIds: [],
          },
        ],
        scrutins: [],
        ordreDuJour: [],
      },
    ]);
    const { findAllByRole, getByLabelText, visited } = rendre(
      { onglet: "interventions", type: "interruption" },
      { ...routes, "/deputes/camille-exemple/interventions": seances },
    );
    const liens = await findAllByRole("link", { name: /Séance du|Voir la séance complète/ });
    for (const lien of liens) {
      expect(lien).toHaveAttribute("href", "/reunions/RUANR5L17S2025IDS99999");
    }
    expect(liens).toHaveLength(2);
    fireEvent.change(getByLabelText("Nature des prises de parole"), {
      target: { value: "question" },
    });
    expect(visited).toEqual(["/deputes/camille-exemple?onglet=interventions&type=question"]);
  });

  it("n'ouvre que la première séance des interventions, les autres se déplient au clavier", async () => {
    // Séances fictives, pour le test.
    const seance = (seanceId: string, date: string, contenu: string) => ({
      seanceId,
      date,
      interventions: [
        {
          id: `${seanceId}-1`,
          date,
          type: "intervention",
          contenu,
          hasMore: false,
          motsCles: [],
          sourceUrl: null,
          ordre: 1,
          articleVise: null,
          dossier: null,
          scrutinIds: [],
        },
      ],
      scrutins: [],
      ordreDuJour: [],
    });
    const seances = page([
      seance(
        "RUANR5L17S2025IDS99998",
        "2025-03-05T15:00:00.000Z",
        "Première prise de parole fictive.",
      ),
      seance(
        "RUANR5L17S2025IDS99997",
        "2025-03-04T15:00:00.000Z",
        "Seconde prise de parole fictive.",
      ),
    ]);
    const { findByRole, getByRole, getByText, queryByText } = rendre(
      { onglet: "interventions" },
      { ...routes, "/deputes/camille-exemple/interventions": seances },
    );
    const premiere = await findByRole("button", { name: /^Masquer les prises de parole/ });
    const seconde = getByRole("button", { name: /^Afficher les prises de parole/ });
    expect(premiere).toHaveAttribute("aria-expanded", "true");
    expect(getByText("Première prise de parole fictive.")).toBeVisible();
    expect(seconde).toHaveAttribute("aria-expanded", "false");
    expect(seconde).toHaveTextContent("1 intervention");
    expect(queryByText("Seconde prise de parole fictive.")).not.toBeVisible();
    fireEvent.click(seconde);
    expect(seconde).toHaveAttribute("aria-expanded", "true");
    expect(getByText("Seconde prise de parole fictive.")).toBeVisible();
  });

  it("ne propose le filtre de chambre qu'à un élu passé par les deux chambres", async () => {
    const { findByRole, queryByRole } = rendre({ onglet: "amendements" });
    await findByRole("heading", { level: 1 });
    expect(queryByRole("group", { name: "Chambre" })).not.toBeInTheDocument();
  });

  it("propose de situer l'élu dans le classement, à côté du comparateur", async () => {
    const { findByRole, getByRole } = rendre();
    expect(await findByRole("link", { name: "Situer dans le classement" })).toHaveAttribute(
      "href",
      "/classements?chambre=assemblee&highlight=camille-exemple",
    );
    expect(getByRole("link", { name: /Comparer avec d'autres/ })).toBeInTheDocument();
  });

  it("montre les thématiques d'un scrutin dans la liste des votes (les deux premières)", async () => {
    const [vote] = votesExemple.data;
    if (!vote) throw new Error("vote d'exemple absent");
    const { findByText } = rendre(
      {},
      {
        ...routes,
        "/deputes/camille-exemple/votes": page([
          { ...vote, scrutin: { ...vote.scrutin, tags: ["santé", "budget", "europe"] } },
        ]),
      },
    );
    expect(await findByText(/Santé, Budget$/)).toHaveTextContent("Thématiques : Santé, Budget");
  });

  it("résume le mandat en cours et les déclarations HATVP hors des onglets", async () => {
    const { findByRole } = rendre();
    const bloc = async (titre: string) => {
      const section = (await findByRole("heading", { name: titre })).closest("section");
      if (!section) throw new Error(`bloc « ${titre} » absent`);
      return section;
    };
    const mandat = await bloc("Mandat en cours");
    expect(mandat).toHaveTextContent("XVIIe législature, depuis le 8 juillet 2024");
    expect(within(mandat).getByRole("link", { name: "Commission des exemples" })).toHaveAttribute(
      "href",
      "/commissions/commission-exemple",
    );
    expect(within(mandat).getByRole("link", { name: /Voir 1 mandat/ })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple?onglet=mandats",
    );
    const hatvp = await bloc("Déclarations HATVP");
    expect(hatvp).toHaveTextContent("publiée le 1 octobre 2024");
    expect(within(hatvp).getByRole("link", { name: "Voir 1 déclaration" })).toHaveAttribute(
      "href",
      "/deputes/camille-exemple?onglet=declarations",
    );
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = rendre({}, {});
    expect(await findByRole("alert")).toHaveTextContent("Le chargement a échoué");
  });
});

describe("metaFiche", () => {
  it("décrit l'élu par des faits", () => {
    expect(metaFiche(ficheExemple, "assemblee")).toEqual({
      title: "Camille Exemple, députée — votes et activité",
      description:
        "Camille Exemple (EXE), députée. 120 votes, 4 interventions, 3 amendements déposés, 95 % de loyauté au groupe. Mis à jour chaque jour.",
    });
  });
});
