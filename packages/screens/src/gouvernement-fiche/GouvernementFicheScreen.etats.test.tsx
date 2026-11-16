import { ApiError } from "@clair/api-client";
import type { GouvernementDetail, PosteMinisteriel } from "@clair/data";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CompositionGouvernement } from "./CompositionGouvernement.tsx";
import { gouvernementFictif, reponseFictive } from "./fixtures.ts";
import { GouvernementFicheScreen } from "./GouvernementFicheScreen.tsx";

const MAINTENANT = Date.parse("2026-11-01T11:00:00Z");
const bilan = gouvernementFictif.bilan;
if (!bilan) throw new Error("fixture sans bilan");

const rendre = (data: GouvernementDetail, params: Record<string, string> = {}) => {
  const reponse = { ...reponseFictive(data), domaines: undefined };
  return renderScreen(
    <GouvernementFicheScreen
      slug={data.slug}
      params={params}
      initialData={reponse}
      maintenant={MAINTENANT}
    />,
    {
      routes: { [`/gouvernements/${data.slug}`]: reponse },
      pathname: `/gouvernements/${data.slug}`,
    },
  );
};

describe("GouvernementFicheScreen, variantes", () => {
  it("propose de réessayer après une erreur autre qu'une absence", async () => {
    renderScreen(<GouvernementFicheScreen slug="fictif-ii" />, {
      routes: {
        "/gouvernements/fictif-ii": () =>
          Promise.reject(new ApiError(500, "/gouvernements/fictif-ii")),
      },
    });
    expect(
      await screen.findByText(
        "Le gouvernement n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.",
      ),
    ).toBeInTheDocument();
  });

  it("présente un gouvernement fini, sans Premier ministre, présidence ni compte des femmes", () => {
    const { visited } = rendre({
      ...gouvernementFictif,
      enCours: false,
      dateFin: "2026-06-30",
      premierMinistre: null,
      presidence: null,
      nbFemmes: undefined,
      precedent: null,
      suivant: { slug: "fictif-iii", nom: "Fictif III" },
      bilan: { ...bilan, motions: { ...bilan.motions, adoptees: 1 } },
    });
    expect(screen.getByText("Du 10 septembre 2025 au 30 juin 2026")).toBeInTheDocument();
    expect(screen.queryByText("En fonction")).toBeNull();
    expect(screen.queryByText(/présidence de/)).toBeNull();
    const faits = within(screen.getByLabelText("Faits du gouvernement Fictif II"));
    expect(faits.getByText("Durée")).toBeInTheDocument();
    expect(faits.queryByText("Femmes")).toBeNull();
    expect(faits.queryByText(/Premier ministre/)).toBeNull();
    expect(faits.getByText("Ratifications et conventions").nextSibling).toHaveTextContent("1");
    expect(faits.getByText("(1 adoptée)")).toBeInTheDocument();
    expect(faits.getByRole("link", { name: /suivant : Fictif III/ })).toHaveAttribute(
      "href",
      "/gouvernements/fictif-iii",
    );
    expect(screen.getByRole("heading", { name: "Composition finale" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /49.3 et censure/ }));
    expect(visited).toEqual(["/gouvernements/fictif-ii?onglet=censure"]);
  });

  it("choisit une étape de la composition et l'écrit dans l'URL", () => {
    const { visited } = rendre(gouvernementFictif);
    const etapes = within(screen.getByRole("list", { name: "Étapes du gouvernement" }));
    const [premiere] = etapes.getAllByRole("button");
    fireEvent.click(premiere as HTMLElement);
    expect(visited[0]).toMatch(/^\/gouvernements\/fictif-ii\?etape=/);
  });
});

describe("CompositionGouvernement", () => {
  const poste = (uid: string, partiel: Partial<PosteMinisteriel>): PosteMinisteriel => {
    const [modele] = gouvernementFictif.postes;
    if (!modele) throw new Error("fixture sans poste");
    return {
      ...modele,
      uid,
      rangProtocolaire: 20,
      ...partiel,
      membre: { ...modele.membre, acteurUid: uid, nom: uid },
    };
  };

  it("lit au singulier le bilan d'une étape à un seul mouvement", () => {
    const postes = [
      poste("PM", { rangProtocolaire: 1, qualite: "Premier ministre", dateDebut: "2025-01-01" }),
      poste("A", { dateDebut: "2025-01-05", dateFin: "2025-06-01" }),
      poste("C", { dateDebut: "2025-06-02" }),
    ];
    renderScreen(
      <CompositionGouvernement
        gouvernement={{ dateDebut: "2025-01-01", dateFin: null, enCours: true, postes }}
        domaines={[]}
        etape=""
        onEtape={() => undefined}
      />,
    );
    expect(screen.getAllByText("1 entrée").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 départ").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 entrées")).toBeNull();
  });

  it("présente un gouvernement sans poste comme une composition vide", () => {
    renderScreen(
      <CompositionGouvernement
        gouvernement={{ dateDebut: "2025-01-01", dateFin: null, enCours: true, postes: [] }}
        domaines={[]}
        etape=""
        onEtape={() => undefined}
      />,
    );
    expect(screen.getByText(/^0 membres au 1 janvier 2025/)).toBeInTheDocument();
  });

  it("montre une étape passée : entrées, départs et changement de poste", () => {
    const postes = [
      poste("PM", { rangProtocolaire: 1, qualite: "Premier ministre", dateDebut: "2025-01-01" }),
      poste("A", { dateDebut: "2025-01-05", dateFin: "2025-06-01" }),
      poste("B", { dateDebut: "2025-01-05", dateFin: "2025-06-01" }),
      {
        ...poste("B2", { dateDebut: "2025-06-02", intituleCourt: "Culture", rangProtocolaire: 40 }),
        membre: poste("B", {}).membre,
      },
      poste("C", { dateDebut: "2025-06-02" }),
      poste("D", { dateDebut: "2025-09-01" }),
    ];
    const choisies: string[] = [];
    renderScreen(
      <CompositionGouvernement
        gouvernement={{ dateDebut: "2025-01-01", dateFin: null, enCours: true, postes }}
        domaines={[]}
        etape="2025-06-02"
        onEtape={(date) => choisies.push(date)}
      />,
    );
    expect(screen.getByRole("heading", { name: "Composition au 2 juin 2025" })).toBeVisible();
    expect(screen.getByText("Quittent le gouvernement")).toBeInTheDocument();
    expect(screen.getByText("Nouveau poste")).toBeInTheDocument();
    expect(screen.getByText("Entrée")).toBeInTheDocument();
    const boutons = within(
      screen.getByRole("list", { name: "Étapes du gouvernement" }),
    ).getAllByRole("button");
    fireEvent.click(boutons[0] as HTMLElement);
    fireEvent.click(boutons[boutons.length - 1] as HTMLElement);
    expect(choisies).toEqual(["2025-01-05", ""]);
  });
});
