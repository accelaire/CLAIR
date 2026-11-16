import { ApiError } from "@clair/api-client";
import type { GroupeDetail } from "@clair/data";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { ChiffresGroupe } from "./ChiffresGroupe.tsx";
import { EnTeteGroupe } from "./EnTeteGroupe.tsx";
import {
  alliancesExemple,
  groupeDetailExemple,
  thematiquesExemple,
  votesExemple,
} from "./fixtures.ts";
import { GroupeFicheScreen } from "./GroupeFicheScreen.tsx";
import { MembresGroupe } from "./MembresGroupe.tsx";
import { parseGroupeFicheParams } from "./params.ts";
import { VotesGroupe } from "./VotesGroupe.tsx";

// Variantes FICTIVES du groupe d'exemple.
const groupeSenat: GroupeDetail = {
  ...groupeDetailExemple,
  chambre: "senat",
  legislature: null,
  session: "2023",
  sessionCourante: false,
  nomComplet: "GEX",
  position: null,
  logoUrl: "https://exemple.fr/logo.png",
  membresActifsCount: 1,
  rang: 2,
  stats: { ...groupeDetailExemple.stats, presenceSolennelMoyenne: null },
};

const [membre1, membre2] = groupeDetailExemple.membres;
if (!membre1 || !membre2) throw new Error("fixture incomplète");

describe("EnTeteGroupe", () => {
  it("présente un groupe du Sénat d'une session passée, au singulier", () => {
    const { container } = renderScreen(<EnTeteGroupe groupe={groupeSenat} />);
    expect(screen.getByText(/Session 2023-2024 · composition d'époque/)).toBeInTheDocument();
    expect(screen.queryByText(/Position déclarée/)).toBeNull();
    expect(screen.getByRole("link", { name: "1 sénateur actif" })).toHaveAttribute(
      "href",
      "#membres",
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://exemple.fr/logo.png");
  });

  it("présente la session en cours sans mention d'époque", () => {
    renderScreen(<EnTeteGroupe groupe={{ ...groupeSenat, sessionCourante: true }} />);
    expect(screen.getByText("Session 2023-2024")).toBeInTheDocument();
  });
});

describe("ChiffresGroupe", () => {
  it("dit « Participation moyenne » au Sénat sans scrutin solennel, et le rang « 2e »", () => {
    renderScreen(<ChiffresGroupe groupe={groupeSenat} />);
    expect(screen.getByText("Participation moyenne")).toBeInTheDocument();
    expect(screen.getByText("Pas de scrutin solennel")).toBeInTheDocument();
    expect(screen.getByText("2e groupe sur 3 par effectif")).toBeInTheDocument();
  });

  it("met la présence aux votes solennels au Sénat quand elle existe", () => {
    renderScreen(
      <ChiffresGroupe
        groupe={{ ...groupeSenat, stats: { ...groupeSenat.stats, presenceSolennelMoyenne: 70 } }}
      />,
    );
    expect(screen.getByText("Présence moyenne")).toBeInTheDocument();
    expect(screen.getByText(/aux votes solennels ; 60\s% tous scrutins/u)).toBeInTheDocument();
  });

  it("omet le rang inconnu et le détail sans présence solennelle à l'Assemblée", () => {
    renderScreen(
      <ChiffresGroupe
        groupe={{
          ...groupeDetailExemple,
          rang: null,
          stats: { ...groupeDetailExemple.stats, presenceSolennelMoyenne: null },
        }}
      />,
    );
    expect(screen.queryByText(/par effectif/)).toBeNull();
    expect(screen.queryByText(/tous scrutins/)).toBeNull();
  });
});

describe("MembresGroupe", () => {
  it("dit qu'il n'y a aucun membre actif", () => {
    renderScreen(
      <MembresGroupe
        chambre="assemblee"
        membres={[]}
        sort={{ key: "nom", direction: "ascending" }}
        onSortChange={() => undefined}
      />,
    );
    expect(screen.getByText("Aucun membre actif dans ce groupe")).toBeInTheDocument();
  });

  it("présente les sénateurs, leur département et leur présence aux votes solennels", () => {
    const tris: unknown[] = [];
    renderScreen(
      <MembresGroupe
        chambre="senat"
        membres={[
          {
            ...membre1,
            circonscription: { departement: "99", numero: 0, nom: "Exemple-sur-Mer" },
            statsPresenceSolennel: 77,
          },
          membre2,
        ]}
        sort={{ key: "presence", direction: "descending" }}
        onSortChange={(sort) => tris.push(sort)}
      />,
    );
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("columnheader", { name: /Département/ })).toBeInTheDocument();
    expect(table.getByText("Exemple-sur-Mer")).toBeInTheDocument();
    expect(table.getByText(/77\s%/u)).toBeInTheDocument();
    expect(table.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(table.getByRole("link", { name: "Camille Exemple" })).toHaveAttribute(
      "href",
      "/senateurs/camille-exemple",
    );
    fireEvent.click(table.getByRole("button", { name: /Loyauté/ }));
    expect(tris).toHaveLength(1);
  });
});

describe("VotesGroupe", () => {
  const rendre = (reponse: unknown, initie = false) => {
    const bascules: boolean[] = [];
    renderScreen(
      <VotesGroupe
        chambre="senat"
        slug="gex"
        periode={{ legislature: "", session: "" }}
        initie={initie}
        onInitieChange={(valeur) => bascules.push(valeur)}
      />,
      { routes: { "/groupes/senat/gex/votes": reponse } },
    );
    return bascules;
  };

  it("annonce une erreur de chargement", async () => {
    rendre(() => {
      throw new ApiError(500, "/groupes/senat/gex/votes");
    });
    expect(await screen.findByText("Les votes du groupe n'ont pas pu être chargés.")).toBeVisible();
  });

  it("dit les scrutins demandés par le groupe, sans position majoritaire, et bascule le filtre", async () => {
    const [scrutin] = votesExemple.data.scrutinsRecents;
    if (!scrutin) throw new Error("fixture sans scrutin");
    const bascules = rendre(
      {
        data: {
          ...votesExemple.data,
          scrutinsRecents: [
            {
              ...scrutin,
              positionMajoritaire: null,
              groupeVotes: { pour: 1, contre: 1, abstention: 2, absent: 0 },
            },
          ],
        },
      },
      true,
    );
    expect(await screen.findByText("Pas de position majoritaire")).toBeInTheDocument();
    expect(
      screen.getByText(/votes exprimés par les membres du groupe, scrutins demandés par le groupe/),
    ).toBeInTheDocument();
    expect(screen.getByText("1 pour, 1 contre, 2 abstentions")).toBeInTheDocument();
    const bouton = screen.getByRole("button", {
      name: "Seulement les scrutins demandés par le groupe",
    });
    expect(bouton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(bouton);
    expect(bascules).toEqual([false]);
  });
});

describe("GroupeFicheScreen, variantes", () => {
  const PATH = "/groupes/senat/gex";

  it("propose de réessayer après une erreur autre qu'une absence", async () => {
    renderScreen(<GroupeFicheScreen chambre="senat" slug="gex" params={{}} />, {
      routes: {
        [PATH]: () => {
          throw new ApiError(500, PATH);
        },
      },
      pathname: PATH,
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("n'affiche ni alliances ni thématiques pour une session passée", async () => {
    renderScreen(<GroupeFicheScreen chambre="senat" slug="gex" params={{ session: "2023" }} />, {
      routes: {
        [PATH]: { data: groupeSenat },
        [`${PATH}/votes`]: votesExemple,
        [`${PATH}/alliances`]: alliancesExemple,
        [`${PATH}/thematiques`]: thematiquesExemple,
      },
      pathname: PATH,
    });
    expect(
      await screen.findByText(/données disponibles uniquement pour la session en cours/),
    ).toBeInTheDocument();
  });
});

describe("parseGroupeFicheParams", () => {
  it("lit l'ordre explicite et ignore une période malformée", () => {
    expect(
      parseGroupeFicheParams({ tri: "presence", ordre: "asc", legislature: "x" }),
    ).toMatchObject({
      legislature: "",
      tri: "presence",
      ordre: "ascending",
    });
    expect(parseGroupeFicheParams({ ordre: "desc", session: "2025" })).toMatchObject({
      session: "2025",
      ordre: "descending",
    });
  });
});
