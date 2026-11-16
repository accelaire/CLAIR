import type { FonctionParlementaire, ParlementaireDetail } from "@clair/data";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { FicheApercu } from "./FicheApercu.tsx";
import { ficheExemple } from "./fixtures.ts";

// Variantes FICTIVES de la fiche d'exemple.
const [mandat] = ficheExemple.mandatsParlementaires;
const [fonction] = ficheExemple.mandats;
const [declaration] = ficheExemple.declarations;
if (!mandat || !fonction || !declaration) throw new Error("fixture incomplète");

const fonctionLibre = (id: string, dateDebut: string): FonctionParlementaire => ({
  ...fonction,
  id,
  qualite: null,
  typeOrgane: "GE",
  institution: `Groupe d'études ${id}`,
  commission: null,
  dateDebut,
});

const rendre = (fiche: ParlementaireDetail) =>
  renderScreen(
    <FicheApercu
      fiche={fiche}
      mandatsHref="?onglet=mandats"
      declarationsHref="?onglet=declarations"
    />,
  );

describe("FicheApercu", () => {
  it("ne rend rien sans mandat ni déclaration", () => {
    rendre({ ...ficheExemple, mandatsParlementaires: [], declarations: [] });
    expect(screen.queryByRole("region", { name: "Mandat et déclarations" })).toBeNull();
  });

  it("présente le mandat en cours, ses fonctions et les dernières déclarations", () => {
    rendre({
      ...ficheExemple,
      mandats: [
        fonction,
        fonctionLibre("a", "2024-08-01"),
        fonctionLibre("b", "2024-09-01"),
        fonctionLibre("c", "2024-10-01"),
        fonctionLibre("d", "2024-11-01"),
        fonctionLibre("e", "2024-12-01"),
        { ...fonctionLibre("finie", "2025-01-01"), dateFin: "2025-02-01" },
      ],
      declarations: [
        declaration,
        { ...declaration, id: "d2", typeDocument: "xyz", urlDossier: null, datePublication: null },
        {
          ...declaration,
          id: "d3",
          typeDocument: "dsp",
          datePublication: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(screen.getByRole("heading", { name: "Mandat en cours" })).toBeVisible();
    expect(screen.getByText("XVIIe législature, depuis le 8 juillet 2024")).toBeInTheDocument();
    const fonctions = within(screen.getByRole("list", { name: "Fonctions en cours" }));
    expect(fonctions.getAllByRole("listitem")).toHaveLength(5);
    expect(fonctions.getByText(/^et 2 autres? fonctions en cours$/)).toBeInTheDocument();
    expect(fonctions.queryByText(/Membre ·/)).toBeNull();
    expect(screen.getByRole("link", { name: "Voir 1 mandat et les fonctions" })).toHaveAttribute(
      "href",
      "?onglet=mandats",
    );
    expect(
      screen.getByRole("link", { name: /Déclaration de situation patrimoniale/ }),
    ).toBeVisible();
    expect(screen.getByText("· publiée le 1 janvier 2025")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir 3 déclarations" })).toBeInTheDocument();
  });

  it("accorde « autres fonctions » au pluriel", () => {
    rendre({
      ...ficheExemple,
      mandats: ["a", "b", "c", "d", "e", "f"].map((id, i) =>
        fonctionLibre(id, `2024-0${i + 1}-01`),
      ),
    });
    expect(screen.getByText("et 2 autres fonctions en cours")).toBeInTheDocument();
  });

  it("présente un dernier mandat terminé, une fonction liée, et une déclaration sans lien", () => {
    rendre({
      ...ficheExemple,
      mandatsParlementaires: [
        { ...mandat, dateFin: "2025-06-30T00:00:00.000Z" },
        {
          ...mandat,
          id: "m16",
          legislature: 16,
          dateDebut: "2022-06-22T00:00:00.000Z",
          dateFin: "2024-06-09T00:00:00.000Z",
        },
      ],
      mandats: [fonction, fonctionLibre("a", "2024-08-01")],
      declarations: [{ ...declaration, urlDossier: null, datePublication: null }],
    });
    expect(screen.getByRole("heading", { name: "Dernier mandat" })).toBeVisible();
    expect(
      screen.getByText("XVIIe législature, du 8 juillet 2024 au 30 juin 2025"),
    ).toBeInTheDocument();
    const fonctions = within(screen.getByRole("list", { name: "Fonctions en cours" }));
    expect(fonctions.getByText("Membre ·")).toBeInTheDocument();
    expect(fonctions.getByRole("link", { name: "Commission des exemples" })).toBeInTheDocument();
    expect(fonctions.queryByText(/autre fonction/)).toBeNull();
    expect(screen.getByRole("link", { name: "Voir 2 mandats et les fonctions" })).toBeVisible();
    expect(screen.getByText("Déclaration d'intérêts et d'activités")).toBeInTheDocument();
    expect(screen.queryByText(/publiée le/)).toBeNull();
  });

  it("ne montre que les déclarations d'un élu sans mandat ni fonction en cours", () => {
    rendre({ ...ficheExemple, mandatsParlementaires: [], mandats: [] });
    expect(screen.queryByRole("heading", { name: /mandat/i })).toBeNull();
    expect(screen.getByRole("heading", { name: "Déclarations HATVP" })).toBeVisible();
  });

  it("n'a pas de liste de fonctions sans fonction en cours", () => {
    rendre({ ...ficheExemple, mandats: [], declarations: [] });
    expect(screen.queryByRole("list", { name: "Fonctions en cours" })).toBeNull();
  });
});
