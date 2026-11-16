import type { EntreeDuSommaire } from "@clair/data";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { seanceExemple } from "./fixtures.ts";
import { SommaireDeSeance } from "./SommaireDeSeance.tsx";

const [scrutin] = seanceExemple.scrutins ?? [];
if (!scrutin) throw new Error("fixture sans scrutin");

/** Entrées FICTIVES reconstituées texte par texte (sans annonce de la présidence). */
const entrees: EntreeDuSommaire[] = [
  {
    cle: "d1",
    source: "dossier",
    titre: "Titre d'origine",
    ordre: null,
    dossiers: [
      { id: "d1", uid: "DLEX 1", titre: "Texte d'exemple sur les jardins", procedureLibelle: null },
    ],
    nbPrises: 3,
    scrutins: [scrutin],
  },
  {
    cle: "autres",
    source: "autres",
    titre: "Autres votes d'exemple",
    ordre: null,
    dossiers: [],
    nbPrises: 0,
    scrutins: [],
  },
];

describe("SommaireDeSeance", () => {
  it("ne montre rien sans entrée", () => {
    const { queryByRole } = renderScreen(
      <SommaireDeSeance entrees={[]} votesDuJour={false} hrefDuRang={(r) => `#${r}`} />,
    );
    expect(queryByRole("heading")).toBeNull();
  });

  it("liste les textes examinés et prévient que les votes sont ceux de la journée", () => {
    const { getByRole, getByText } = renderScreen(
      <SommaireDeSeance entrees={entrees} votesDuJour hrefDuRang={(r) => `#${r}`} />,
    );
    expect(getByRole("heading", { name: "Textes examinés" })).toBeInTheDocument();
    expect(getByText(/ceux-ci sont les votes de la journée/)).toBeInTheDocument();
    expect(getByText("3 prises de parole")).toBeInTheDocument();
    expect(getByText("1 vote")).toBeInTheDocument();
    expect(getByText("Autres votes d'exemple")).toBeInTheDocument();
    const bouton = getByRole("button", { name: /Texte d'exemple sur les jardins/ });
    fireEvent.click(bouton);
    expect(getByRole("link", { name: "Voir le dossier législatif" })).toHaveAttribute(
      "href",
      "/dossiers/DLEX%201",
    );
    expect(getByRole("link", { name: /Scrutin n° 42|amendement n° 7/ })).toBeInTheDocument();
  });
});
