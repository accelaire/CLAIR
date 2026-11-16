import type { EtapeParcoursDossier } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { etapeExemple } from "./fixtures.ts";
import { ParcoursDossier, volumeEtape } from "./ParcoursDossier.tsx";

// Étapes fictives.
const reunion: EtapeParcoursDossier = {
  ...etapeExemple,
  uid: "REUNIONEXEMPLE1",
  type: "commission",
  chambre: "assemblee",
  commission: null,
  nbPrises: 1,
  nbAvis: 4,
  consultable: false,
  scrutins: [],
};
const reunionNommee: EtapeParcoursDossier = {
  ...reunion,
  uid: "REUNIONEXEMPLE2",
  commission: { slug: "commission-exemple", nom: "Commission d'exemple" },
  nbPrises: null,
  nbAvis: null,
};
const seanceDeuxVotes: EtapeParcoursDossier = {
  ...etapeExemple,
  uid: "SEANCEEXEMPLE2",
  consultable: false,
  nbPrises: null,
  scrutins: [
    ...etapeExemple.scrutins,
    ...etapeExemple.scrutins.map((s) => ({ ...s, id: "scrutin-exemple-2", numero: 43 })),
  ],
};

describe("ParcoursDossier : états", () => {
  it("dit quand aucune étape n'est connue", () => {
    const { getByText } = renderScreen(<ParcoursDossier etapes={[]} />);
    expect(getByText("Aucune étape connue")).toBeInTheDocument();
  });

  it("résume le volume de chaque étape", () => {
    expect(volumeEtape(reunion)).toBe("1 prise de parole · 4 avis sur amendements");
    expect(volumeEtape(reunionNommee)).toBeNull();
    expect(volumeEtape({ ...reunion, nbPrises: 3, nbAvis: null })).toBe("3 prises de parole");
  });

  it("nomme l'étape par sa commission quand elle est connue", () => {
    const { getByText } = renderScreen(<ParcoursDossier etapes={[reunionNommee]} />);
    expect(getByText("Commission d'exemple")).toBeInTheDocument();
  });

  it("sans page consultable, l'étape n'est pas liée", () => {
    const { getByText, queryByRole } = renderScreen(
      <ParcoursDossier etapes={[reunion, seanceDeuxVotes]} />,
    );
    expect(getByText("Réunion de commission")).toBeInTheDocument();
    expect(getByText("Séance publique")).toBeInTheDocument();
    expect(queryByRole("link", { name: "Séance publique" })).toBeNull();
  });

  it("une étape consultable mène à son débat", () => {
    const { getByRole } = renderScreen(
      <ParcoursDossier etapes={[{ ...seanceDeuxVotes, consultable: true }]} />,
    );
    expect(getByRole("link", { name: "Séance publique" })).toHaveAttribute(
      "href",
      "/reunions/SEANCEEXEMPLE2",
    );
  });
});
