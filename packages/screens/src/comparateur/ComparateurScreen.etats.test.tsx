import { ApiError, type FixtureRoutes } from "@clair/api-client";
import type {
  AmendementParlementaire,
  PageAmendements,
  PageVotes,
  ParlementaireCompare,
  VoteDuParlementaire,
} from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { tauxAdoption } from "./AmendementsCompares.tsx";
import { ComparateurScreen } from "./ComparateurScreen.tsx";
import { amendementsCamille, compareExemple, votesCamille, votesDominique } from "./fixtures.ts";
import { comparateurParamsOf } from "./params.ts";

/** Élus FICTIFS dérivés des fixtures du comparateur. */
const premier = <T,>(liste: T[], quoi: string): T => {
  const element = liste[0];
  if (element === undefined) throw new Error(`fixture vide : ${quoi}`);
  return element;
};
const parSlug = (slug: string) =>
  premier(
    compareExemple.data.filter((elu) => elu.slug === slug),
    slug,
  );
const camille = parSlug("camille-exemple");
const dominique = parSlug("dominique-test");
const avecSlug = (base: ParlementaireCompare, slug: string, prenom: string, nom: string) => ({
  ...base,
  id: `id-${slug}`,
  slug,
  prenom,
  nom,
});
const alix = avecSlug(camille, "alix-fictif", "Alix", "Fictif");
const sacha = avecSlug(camille, "sacha-fictif", "Sacha", "Fictif");

const voteBase = premier(votesCamille.data, "votes");
const vote = (numero: number, position: string): VoteDuParlementaire => ({
  ...voteBase,
  id: `v-${numero}-${position}`,
  position,
  scrutin: { ...voteBase.scrutin, id: `scrutin-${numero}`, numero },
});
const pageVotes = (data: VoteDuParlementaire[]): PageVotes => ({
  data,
  meta: { total: data.length, page: 1, limit: 100, totalPages: 1 },
});

const pathname = "/deputes/comparer";
const params = { slugs: "camille-exemple,dominique-test" };
const routesBase: FixtureRoutes = {
  "/deputes/compare": compareExemple,
  "/deputes/camille-exemple/votes": votesCamille,
  "/deputes/dominique-test/votes": votesDominique,
  "/deputes/camille-exemple/amendements": amendementsCamille,
};

const erreur = () => Promise.reject(new ApiError(500, "/deputes"));

describe("taux d'adoption", () => {
  it("vaut null sans amendement déposé, pas 0 %", () => {
    expect(tauxAdoption(0, 0)).toBeNull();
    expect(tauxAdoption(3, 1)).toBe(33);
  });
});

describe("paramètres du comparateur", () => {
  it("omet les slugs vides et les divergents absents", () => {
    expect(comparateurParamsOf({ slugs: [], divergents: false })).toEqual({});
  });
});

describe("ComparateurScreen : cas limites", () => {
  it("indique des élus introuvables quand l'API en renvoie moins de deux", async () => {
    const { findByText, getByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={params} />,
      { pathname, routes: { ...routesBase, "/deputes/compare": { data: [camille] } } },
    );
    expect(await findByText("Députés introuvables")).toBeInTheDocument();
    expect(getByRole("link", { name: /Retour à la liste/ })).toHaveAttribute("href", "/deputes");
  });

  it("retire un élu sur trois en restant sur le comparateur, sans bouton d'ajout à quatre", async () => {
    const quatre = [camille, dominique, alix, sacha];
    const { findByRole, queryByRole, visited } = renderScreen(
      <ComparateurScreen
        chambre="assemblee"
        params={{ slugs: quatre.map((elu) => elu.slug).join(",") }}
      />,
      {
        pathname,
        routes: {
          ...routesBase,
          "/deputes/compare": { data: quatre },
          "/deputes/alix-fictif/votes": pageVotes([]),
          "/deputes/sacha-fictif/votes": pageVotes([]),
        },
      },
    );
    fireEvent.click(await findByRole("checkbox", { name: /Comparer Alix Fictif/ }));
    expect(visited).toEqual([
      "/deputes/comparer?slugs=camille-exemple%2Cdominique-test%2Csacha-fictif",
    ]);
    expect(queryByRole("link", { name: /Ajouter un député/ })).toBeNull();
  });
});

describe("ComparateurScreen : statistiques", () => {
  it("au Sénat, montre la présence solennelle, la participation et l'explication", async () => {
    const senat = (elu: ParlementaireCompare): ParlementaireCompare => ({
      ...elu,
      chambre: "senat",
      stats: elu.stats ? { ...elu.stats, presenceSolennel: null, loyaute: null } : null,
    });
    const { findByRole, getByRole, getByText } = renderScreen(
      <ComparateurScreen chambre="senat" params={params} />,
      {
        pathname: "/senateurs/comparer",
        routes: {
          "/senateurs/compare": { data: [senat(camille), { ...senat(dominique), stats: null }] },
          "/senateurs/camille-exemple/votes": votesCamille,
          "/senateurs/dominique-test/votes": votesDominique,
        },
      },
    );
    const stats = await findByRole("table", { name: "Statistiques comparées" });
    expect(
      within(stats).getByRole("row", { name: /Participation \(tous scrutins/ }),
    ).toHaveTextContent(/60\s%/);
    expect(within(stats).getAllByText("Non mesurable").length).toBeGreaterThan(0);
    expect(within(stats).getByText("Aucun vote à comparer")).toBeInTheDocument();
    expect(within(stats).getAllByText("Non disponible").length).toBeGreaterThan(0);
    expect(getByText("Statistiques non disponibles.")).toBeInTheDocument();
    expect(getByRole("region", { name: "Statistiques" })).toHaveTextContent(
      /un scrutin ordinaire se vote par groupe/,
    );
  });

  it("à l'Assemblée, ajoute la présence aux solennels quand un élu en a une", async () => {
    const avecSolennel: ParlementaireCompare = {
      ...camille,
      stats: camille.stats ? { ...camille.stats, presence: null, presenceSolennel: 75 } : null,
    };
    const { findByRole } = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: { ...routesBase, "/deputes/compare": { data: [avecSolennel, dominique] } },
    });
    const stats = await findByRole("table", { name: "Statistiques comparées" });
    const ligne = within(stats).getByRole("row", { name: /Présence aux scrutins solennels/ });
    expect(ligne).toHaveTextContent(/75\s%/);
    expect(ligne).toHaveTextContent("Non disponible");
    expect(within(stats).getByText("Non mesurable")).toBeInTheDocument();
  });
});

describe("ComparateurScreen : votes comparés", () => {
  it("affiche les scrutins divergents seulement, et une position inconnue telle quelle", async () => {
    const { findByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={{ ...params, divergents: "1" }} />,
      {
        pathname,
        routes: {
          ...routesBase,
          "/deputes/camille-exemple/votes": pageVotes([vote(1, "pour"), vote(2, "procuration")]),
        },
      },
    );
    const votes = await findByRole("table", { name: "Positions de vote par scrutin" });
    expect(within(votes).getAllByRole("row")).toHaveLength(2);
    expect(within(votes).getByText("procuration")).toBeInTheDocument();
    expect(await findByRole("status", { name: "" })).toHaveTextContent(/^1 scrutin$/);
  });

  it("écrit un tiret pour l'élu qui n'a pas voté un scrutin commun aux deux autres", async () => {
    const trois = [camille, dominique, alix];
    const { findByRole } = renderScreen(
      <ComparateurScreen
        chambre="assemblee"
        params={{ slugs: trois.map((elu) => elu.slug).join(",") }}
      />,
      {
        pathname,
        routes: {
          ...routesBase,
          "/deputes/compare": { data: trois },
          "/deputes/alix-fictif/votes": pageVotes([vote(3, "contre")]),
        },
      },
    );
    const votes = await findByRole("table", { name: "Positions de vote par scrutin" });
    expect(within(votes).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("annonce l'absence de scrutin commun, puis de scrutin divergent", async () => {
    const vide = { ...routesBase, "/deputes/camille-exemple/votes": pageVotes([]) };
    const tous = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: vide,
    });
    expect(await tous.findByText("Aucun scrutin commun")).toBeInTheDocument();
    tous.unmount();
    const divergents = renderScreen(
      <ComparateurScreen chambre="assemblee" params={{ ...params, divergents: "1" }} />,
      { pathname, routes: vide },
    );
    expect(
      await divergents.findByText("Aucun scrutin où les positions diffèrent"),
    ).toBeInTheDocument();
  });

  it("limite l'affichage aux 50 scrutins les plus récents", async () => {
    const soixante = Array.from({ length: 60 }, (_, index) => vote(index + 1, "pour"));
    const { findByText } = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: {
        ...routesBase,
        "/deputes/camille-exemple/votes": pageVotes(soixante),
        "/deputes/dominique-test/votes": pageVotes(soixante),
      },
    });
    expect(await findByText(/60 scrutins, les 50 plus récents affichés/)).toBeInTheDocument();
  });

  it("signale une erreur de chargement des votes", async () => {
    const { findByText, getAllByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={params} />,
      { pathname, routes: { ...routesBase, "/deputes/dominique-test/votes": erreur } },
    );
    expect(await findByText("Les votes n'ont pas pu être chargés.")).toBeInTheDocument();
    for (const bouton of getAllByRole("button", { name: "Réessayer" })) fireEvent.click(bouton);
  });
});

/** Amendement FICTIF rattaché à un dossier, avec ou sans titre court. */
const amendementBase = premier(amendementsCamille({ page: 1 }).data, "amendements");
const pageAmendements = (data: AmendementParlementaire[], hasNext?: boolean): PageAmendements => ({
  data,
  meta: { total: data.length, page: 1, limit: 10, totalPages: 2, hasNext },
});

describe("ComparateurScreen : amendements", () => {
  it("écrit les singuliers et l'absence d'amendement déposé", async () => {
    const un: ParlementaireCompare = {
      ...camille,
      stats: camille.stats ? { ...camille.stats, amendements: { proposes: 1, adoptes: 0 } } : null,
    };
    const zero: ParlementaireCompare = {
      ...dominique,
      stats: dominique.stats
        ? { ...dominique.stats, amendements: { proposes: 0, adoptes: 0 } }
        : null,
    };
    const { findByRole } = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: { ...routesBase, "/deputes/compare": { data: [un, zero] } },
    });
    const section = await findByRole("region", { name: "Amendements" });
    expect(section).toHaveTextContent("1 déposé");
    expect(section).toHaveTextContent("0 adopté");
    expect(section).toHaveTextContent("Aucun amendement déposé");
  });

  it("écrit le pluriel des adoptés", async () => {
    const deux: ParlementaireCompare = {
      ...camille,
      stats: camille.stats ? { ...camille.stats, amendements: { proposes: 4, adoptes: 2 } } : null,
    };
    const { findByRole } = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: { ...routesBase, "/deputes/compare": { data: [deux, dominique] } },
    });
    expect(await findByRole("region", { name: "Amendements" })).toHaveTextContent("2 adoptés");
  });

  it("relie le dossier de l'amendement, par son titre court sinon son titre", async () => {
    const avecDossiers = pageAmendements(
      [
        {
          ...amendementBase,
          id: "a1",
          dossier: { uid: "DLR-FICTIF-1", titre: "Titre long fictif", titreCourt: "Court fictif" },
        },
        {
          ...amendementBase,
          id: "a2",
          dossier: { uid: "DLR-FICTIF-2", titre: "Autre titre fictif", titreCourt: null },
        },
      ],
      undefined,
    );
    const { findByRole, getByRole } = renderScreen(
      <ComparateurScreen chambre="assemblee" params={params} />,
      {
        pathname,
        routes: { ...routesBase, "/deputes/camille-exemple/amendements": avecDossiers },
      },
    );
    await findByRole("region", { name: "Amendements" });
    fireEvent.click(
      getByRole("button", { name: "Voir les derniers amendements de Camille Exemple" }),
    );
    const liste = await findByRole("list", { name: "Amendements de Camille Exemple" });
    expect(await within(liste).findByRole("link", { name: /Court fictif/ })).toHaveAttribute(
      "href",
      "/dossiers/DLR-FICTIF-1",
    );
    expect(within(liste).getByRole("link", { name: /Autre titre fictif/ })).toBeInTheDocument();
    // Sans `hasNext`, la page 1 sur 2 propose la suite.
    expect(within(liste).getByRole("button", { name: "Voir plus" })).toBeInTheDocument();

    fireEvent.click(getByRole("button", { name: "Masquer les amendements de Camille Exemple" }));
    expect(
      getByRole("button", { name: "Voir les derniers amendements de Camille Exemple" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("indique l'absence d'amendement, puis une erreur de chargement", async () => {
    const vide = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: { ...routesBase, "/deputes/camille-exemple/amendements": pageAmendements([]) },
    });
    fireEvent.click(
      await vide.findByRole("button", { name: "Voir les derniers amendements de Camille Exemple" }),
    );
    expect(await vide.findByText("Aucun amendement trouvé.")).toBeInTheDocument();
    vide.unmount();

    const enErreur = renderScreen(<ComparateurScreen chambre="assemblee" params={params} />, {
      pathname,
      routes: { ...routesBase, "/deputes/camille-exemple/amendements": erreur },
    });
    fireEvent.click(
      await enErreur.findByRole("button", {
        name: "Voir les derniers amendements de Camille Exemple",
      }),
    );
    expect(
      await enErreur.findByText("Les amendements n'ont pas pu être chargés."),
    ).toBeInTheDocument();
  });
});
