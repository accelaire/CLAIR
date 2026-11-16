import type { ResultatsNationaux, StatutCirconscription } from "@clair/data";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../test-utils.tsx";
import { resultatsNationauxExemple } from "../fixtures.ts";
import { BadgeCirconscription, BadgeEtat, PastilleEtat, PointsSieges } from "./Etats.tsx";

const compteurs = (
  extra: Partial<ResultatsNationaux["compteurs"]>,
): ResultatsNationaux["compteurs"] => ({
  ...resultatsNationauxExemple.compteurs,
  pourvue: 0,
  partielle: 0,
  second_tour: 0,
  ...extra,
});

describe("BadgeEtat", () => {
  it("toutes les circonscriptions pourvues : résultats connus", () => {
    const { getByText } = renderScreen(
      <BadgeEtat compteurs={compteurs({ pourvue: 2 })} maintenant="2026-09-27T23:00:00+02:00" />,
    );
    expect(getByText("Résultats connus")).toBeInTheDocument();
  });

  it("un 2nd tour en attente : résultats partiels", () => {
    const { getByText } = renderScreen(
      <BadgeEtat
        compteurs={compteurs({ second_tour: 1 })}
        maintenant="2026-09-27T13:00:00+02:00"
      />,
    );
    expect(getByText("Résultats partiels")).toBeInTheDocument();
  });

  it("avant l'ouverture des premiers bureaux : la date du scrutin", () => {
    const { getByText } = renderScreen(
      <BadgeEtat compteurs={compteurs({})} maintenant="2026-09-26T20:00:00+02:00" />,
    );
    expect(getByText("Scrutin dimanche 27 septembre")).toBeInTheDocument();
  });

  it("bureaux ouverts, aucun résultat : vote en cours", () => {
    const { getByText } = renderScreen(
      <BadgeEtat compteurs={compteurs({})} maintenant="2026-09-27T10:00:00+02:00" />,
    );
    expect(getByText("Vote en cours")).toBeInTheDocument();
  });
});

describe("BadgeCirconscription", () => {
  it.each<[StatutCirconscription, string]>([
    ["pourvue", "Résultats connus"],
    ["partielle", "1er tour connu"],
    ["second_tour", "1er tour connu"],
    ["resultats_attendus", "Résultats attendus"],
    ["vote_en_cours", "Vote en cours"],
    ["pas_ouvert", "Scrutin dimanche 27 septembre"],
  ])("%s : « %s »", (statut, libelle) => {
    const { getByText } = renderScreen(<BadgeCirconscription statut={statut} />);
    expect(getByText(libelle)).toBeInTheDocument();
  });
});

describe("PastilleEtat", () => {
  it.each<[StatutCirconscription, string]>([
    ["pas_ouvert", "Vote pas encore ouvert"],
    ["vote_en_cours", "Vote en cours"],
    ["second_tour", "2nd tour en cours"],
    ["partielle", "Résultats partiels"],
  ])("%s : « %s »", (statut, libelle) => {
    const { getByText } = renderScreen(
      <PastilleEtat statut={statut} secondTour="en_cours" connue={false} />,
    );
    expect(getByText(libelle)).toBeInTheDocument();
  });
});

describe("PointsSieges", () => {
  it("aucun siège attribué : le décompte le dit sans détail", () => {
    const { getByText } = renderScreen(<PointsSieges sieges={[null, null]} />);
    expect(getByText("0 siège attribué sur 2")).toBeInTheDocument();
  });

  it("un siège attribué sans nuance, un autre avec", () => {
    const { getByText } = renderScreen(
      <PointsSieges sieges={[{ famille: "gauche", nuance: null }, null]} />,
    );
    expect(getByText("1 siège attribué sur 2 : Gauche")).toBeInTheDocument();
  });

  it("plusieurs sièges attribués : accord au pluriel et nuances", () => {
    const { getByText } = renderScreen(
      <PointsSieges
        sieges={[
          { famille: "droite", nuance: "LEX" },
          { famille: null, nuance: null },
        ]}
      />,
    );
    expect(
      getByText("2 sièges attribués sur 2 : Droite (LEX), Nuance non classée"),
    ).toBeInTheDocument();
  });
});
