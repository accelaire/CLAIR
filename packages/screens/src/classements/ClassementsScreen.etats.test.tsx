import type { FixtureRoutes, Query } from "@clair/api-client";
import type { GroupeClasse, GroupeOption, ParlementaireListItem } from "@clair/data";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ClassementsScreen } from "./ClassementsScreen.tsx";
import { groupeClasse, pageClassement, parlementaireClasse } from "./fixtures.ts";

/** Données fictives : un élu sans groupe ni statistique, et deux élus ordinaires. */
const sansStats: ParlementaireListItem = {
  ...parlementaireClasse(9),
  groupe: null,
  stats: null,
};
const tous = [parlementaireClasse(1), parlementaireClasse(2), sansStats];

const groupesOptions: GroupeOption[] = [
  {
    id: "g-a",
    slug: "gex",
    chambre: "assemblee",
    nom: "GEX",
    nomComplet: "Groupe d'exemple",
    couleur: null,
    membresCount: 10,
  },
  {
    id: "g-b",
    slug: "gmeme",
    chambre: "assemblee",
    nom: "GMEME",
    nomComplet: "GMEME",
    couleur: null,
    membresCount: 5,
  },
];

const routes = (
  items: ParlementaireListItem[] = tous,
  { historique = false, prefixe = "/parlementaires" } = {},
): FixtureRoutes => ({
  "/parlementaires": (query: Query) =>
    query.order === "asc" ? pageClassement([...items].reverse()) : pageClassement(items),
  [`${prefixe}/groupes`]: { data: groupesOptions },
  [`${prefixe}/historique-carriere`]: { data: { present: historique } },
});

const rendre = (params: Record<string, string>, r: FixtureRoutes = routes()) =>
  renderScreen(<ClassementsScreen params={params} />, {
    routes: r,
    pathname: "/classements",
  });

describe("ClassementsScreen : onglet des parlementaires, cas limites", () => {
  it("écrit un tiret pour un élu sans groupe ni statistique", async () => {
    const { findByRole } = rendre({ sort: "amendements" });
    const tableau = await findByRole("table", { name: /par amendements/ });
    const ligne = within(tableau).getByRole("row", { name: /Camille Exemple9/ });
    expect(within(ligne).getAllByText("—").length).toBeGreaterThan(1);
  });

  it("classe par ordre alphabétique, sans top ni note de taux", async () => {
    const { findByRole, queryByText } = rendre({ sort: "nom", order: "asc" });
    expect(await findByRole("table", { name: /par alphabétique/ })).toBeInTheDocument();
    expect(queryByText(/Taux calculés/)).not.toBeInTheDocument();
  });

  it("choisit un critère dans la liste et passe l'ordre alphabétique en croissant", async () => {
    const { findByRole, getByRole, visited } = rendre({});
    await findByRole("table", { name: /Classement des parlementaires/ });
    fireEvent.change(getByRole("combobox", { name: "Critère" }), { target: { value: "nom" } });
    fireEvent.change(getByRole("combobox", { name: "Critère" }), {
      target: { value: "interventions" },
    });
    expect(visited).toEqual(["/classements?sort=nom&order=asc", "/classements?sort=interventions"]);
  });

  it("propose la période quand la carrière existe, et l'écrit dans l'URL", async () => {
    const { findByRole, getByText, visited } = rendre(
      { sort: "loyaute" },
      routes(tous, { historique: true }),
    );
    const periode = await findByRole("combobox", { name: "Période" });
    expect(getByText(/choisissez « Carrière complète »/)).toBeInTheDocument();
    fireEvent.change(periode, { target: { value: "carriere" } });
    expect(visited).toEqual(["/classements?sort=loyaute&periode=carriere"]);
  });

  it("revient au mandat en cours depuis la carrière complète", async () => {
    const { findByRole, getByText, visited } = rendre(
      { periode: "carriere" },
      routes(tous, { historique: true }),
    );
    const periode = await findByRole("combobox", { name: "Période" });
    await findByRole("table", { name: /Classement des parlementaires/ });
    expect(getByText(/Taux calculés sur toute la carrière/)).toBeInTheDocument();
    fireEvent.change(periode, { target: { value: "mandat" } });
    expect(visited).toEqual(["/classements"]);
  });

  it("nomme le groupe choisi dans les filtres actifs et permet de le retirer", async () => {
    const { findByRole, getByRole, visited } = rendre({ groupe: "gex" });
    await findByRole("table", { name: /Classement des parlementaires/ });
    const liste = getByRole("combobox", { name: "Groupe politique" });
    expect(
      within(liste).getByRole("option", { name: "GEX (Groupe d'exemple)" }),
    ).toBeInTheDocument();
    expect(within(liste).getByRole("option", { name: "GMEME" })).toBeInTheDocument();
    fireEvent.change(liste, { target: { value: "gmeme" } });
    expect(visited).toEqual(["/classements?groupe=gmeme"]);
  });

  it("garde le slug d'un groupe inconnu dans le filtre actif", async () => {
    const { findByText } = rendre({ groupe: "inconnu" });
    expect(await findByText(/Groupe : inconnu/)).toBeInTheDocument();
  });

  it("trie en ordre croissant depuis l'en-tête de colonne", async () => {
    const { findByRole, visited } = rendre({ sort: "loyaute", order: "asc" });
    const tableau = await findByRole("table", { name: /par loyauté/ });
    fireEvent.click(within(tableau).getByRole("button", { name: /Amendements/ }));
    fireEvent.click(within(tableau).getByRole("button", { name: /Loyauté/ }));
    expect(visited).toEqual(["/classements?sort=amendements", "/classements?sort=loyaute"]);
  });

  it("à l'Assemblée, classe les députés sans la note du Sénat", async () => {
    const { findByRole, queryByText, getByText } = rendre(
      { chambre: "assemblee" },
      routes(tous, { prefixe: "/deputes" }),
    );
    expect(
      await findByRole("table", { name: /Classement des parlementaires/ }),
    ).toBeInTheDocument();
    expect(queryByText(/Classement des députés. Au Sénat/)).not.toBeInTheDocument();
    expect(getByText(/« n.c. » : non classé/)).toBeInTheDocument();
  });

  it("sans chambre, rappelle que la présence classe les députés", async () => {
    const { findByText } = rendre({});
    expect(await findByText(/Classement des députés. Au Sénat/)).toBeInTheDocument();
  });

  it("change d'onglet vers les groupes en effaçant la mise en avant", async () => {
    const { getByRole, visited } = rendre({ highlight: "personne-exemple-1", rank: "3" });
    fireEvent.click(getByRole("tab", { name: /Groupes/ }));
    expect(visited).toEqual(["/classements?tab=groupes"]);
  });

  it("revient à l'onglet des parlementaires", () => {
    const { getByRole, visited } = rendre({ tab: "groupes" }, { "/groupes": { data: [] } });
    fireEvent.click(getByRole("tab", { name: /Parlementaires/ }));
    expect(visited).toEqual(["/classements"]);
  });
});

/** Groupes fictifs, avec les statistiques manquantes que l'écran doit tolérer. */
const groupeSenat: GroupeClasse = {
  ...groupeClasse(3, 40),
  chambre: "senat",
  statsPresenceSolennelMoyenne: 66,
};
const groupeVide: GroupeClasse = {
  ...groupeClasse(4, 10),
  statsLoyauteMoyenne: null,
  statsCohesion: null,
  statsPresenceMoyenne: null,
};

describe("ClassementsScreen : onglet des groupes, cas limites", () => {
  const routesGroupes = { "/groupes": { data: [groupeClasse(1, 50), groupeSenat, groupeVide] } };

  it.each([
    ["loyaute", /par loyauté moyenne/],
    ["cohesion", /par cohésion/],
    ["membres", /par nombre de membres/],
  ])("classe les groupes par « %s »", async (groupeSort, nom) => {
    const { findByRole } = rendre({ tab: "groupes", groupeSort }, routesGroupes);
    const tableau = await findByRole("table", { name: nom });
    expect(within(tableau).getAllByRole("row")).toHaveLength(4);
  });

  it("met en avant un groupe, prend la présence solennelle au Sénat et écrit un tiret sans donnée", async () => {
    const { findByRole, getByText } = rendre({ tab: "groupes", highlight: "g3" }, routesGroupes);
    const tableau = await findByRole("table", { name: /groupes politiques/ });
    const senat = within(tableau).getByRole("row", { name: /numéro 3/ });
    expect(senat).toHaveTextContent("Mis en avant");
    expect(senat).toHaveTextContent(/66\s%/);
    const vide = within(tableau).getByRole("row", { name: /numéro 4/ });
    expect(within(vide).getAllByText("—")).toHaveLength(3);
    expect(getByText(/Au Sénat, la présence moyenne d'un groupe/)).toBeInTheDocument();
  });

  it("à l'Assemblée, n'affiche pas la note du Sénat", async () => {
    const { findByRole, queryByText } = rendre(
      { tab: "groupes", chambre: "assemblee" },
      routesGroupes,
    );
    await findByRole("table", { name: /groupes politiques/ });
    expect(queryByText(/Au Sénat, la présence moyenne/)).not.toBeInTheDocument();
  });

  it("change de critère dans la liste", async () => {
    const { findByRole, visited } = rendre({ tab: "groupes" }, routesGroupes);
    fireEvent.change(await findByRole("combobox", { name: "Critère" }), {
      target: { value: "cohesion" },
    });
    expect(visited).toEqual(["/classements?tab=groupes&groupeSort=cohesion"]);
  });

  it("annonce le chargement puis signale une erreur", async () => {
    const chargement = rendre(
      { tab: "groupes" },
      { "/groupes": () => new Promise(() => undefined) },
    );
    expect(chargement.getByRole("status")).toHaveTextContent(
      "Chargement du classement des groupes",
    );
    chargement.unmount();
    const erreur = rendre(
      { tab: "groupes" },
      { "/groupes": () => Promise.reject(new Error("panne")) },
    );
    expect(await erreur.findByText(/n'a pas pu être chargé/)).toBeInTheDocument();
    expect(erreur.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
