import { ApiError } from "@clair/api-client";
import type { AmendementParlementaire } from "@clair/data";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { page } from "./fixtures.ts";
import { OngletAmendements } from "./OngletAmendements.tsx";
import type { OngletProps } from "./OngletCommun.tsx";
import { type ParlementaireFicheFiltres, parseParlementaireFicheParams } from "./params.ts";

// Amendements FICTIFS.
const amendement: AmendementParlementaire = {
  id: "amdt-1",
  uid: "AMANR5L17FICTIF1",
  numero: "12",
  legislature: 17,
  chambre: "assemblee",
  texteRef: null,
  articleVise: "Article 1er",
  alinea: null,
  dispositif: "Supprimer cet article.",
  exposeSommaire: null,
  auteurLibelle: "Camille Exemple",
  sort: "Adopté",
  dateDepot: "2026-01-10T00:00:00.000Z",
  dateSort: null,
  amendementParent: null,
  scrutins: [
    {
      id: "s1",
      numero: 77,
      chambre: "assemblee",
      session: "17",
      titre: "l'amendement n° 12",
      date: "2026-01-12T00:00:00.000Z",
      sort: "adopte",
    },
  ],
  dossier: { uid: "DLR-FICTIF", titre: "Projet de loi fictif long", titreCourt: "Loi fictive" },
};

const chemin = "/deputes";
const route = "/deputes/camille-exemple/amendements";

const rendre = (
  reponse: unknown,
  filtres: Partial<ParlementaireFicheFiltres> = {},
  autres: Partial<OngletProps> = {},
) => {
  const changements: Partial<ParlementaireFicheFiltres>[] = [];
  const rendu = renderScreen(
    <OngletAmendements
      chemin={chemin}
      slug="camille-exemple"
      filtres={{ ...parseParlementaireFicheParams({ onglet: "amendements" }), ...filtres }}
      changer={(changement) => changements.push(changement)}
      pageHref={(n) => `/deputes/camille-exemple?onglet=amendements&page=${n}`}
      {...autres}
    />,
    { routes: { [route]: reponse } },
  );
  return { ...rendu, changements };
};

describe("OngletAmendements", () => {
  it("annonce le chargement", () => {
    rendre(() => new Promise(() => undefined));
    expect(screen.getByText("Chargement des amendements…")).toBeInTheDocument();
  });

  it("propose de réessayer après une erreur", async () => {
    rendre(() => {
      throw new ApiError(500, route);
    });
    expect(
      await screen.findByText(
        "Les amendements n'ont pas pu être chargés. Vérifiez votre connexion puis réessayez.",
      ),
    ).toBeInTheDocument();
  });

  it("liste les amendements, leur dossier et leurs scrutins, sur plusieurs pages", async () => {
    rendre(page([amendement, { ...amendement, id: "amdt-2", dossier: null, scrutins: [] }], 2));
    expect(await screen.findByText("2 amendements — page 1 sur 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Loi fictive/ })).toHaveAttribute(
      "href",
      "/dossiers/DLR-FICTIF",
    );
    expect(screen.getByRole("link", { name: /77/ })).toHaveAttribute(
      "href",
      "/scrutins/77?chambre=assemblee&session=17",
    );
  });

  it("prend le titre long d'un dossier sans titre court", async () => {
    rendre(
      page([
        {
          ...amendement,
          dossier: { uid: "DLR-FICTIF", titre: "Projet de loi fictif long", titreCourt: null },
        },
      ]),
    );
    expect(await screen.findByRole("link", { name: /Projet de loi fictif long/ })).toBeVisible();
  });

  it("écrit le filtre des scrutins publics et propose la chambre à un élu des deux chambres", async () => {
    const { changements } = rendre(
      page([]),
      { votesPublics: true, chambre: "senat" },
      {
        deuxChambres: true,
      },
    );
    expect(await screen.findByText("Aucun amendement trouvé pour ces critères.")).toBeVisible();
    const filtre = screen.getByLabelText(
      "Uniquement les amendements mis aux voix par scrutin public",
    );
    expect(filtre).toBeChecked();
    fireEvent.click(filtre);
    fireEvent.click(screen.getByRole("radio", { name: "Les deux" }));
    expect(changements).toEqual([{ votesPublics: false }, { chambre: "" }]);
  });
});
