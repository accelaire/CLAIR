import type { ChambreSwitchValue } from "@clair/ui";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { SLUG_EXEMPLE } from "./fixtures.ts";
import { ScrutinsSujet } from "./ScrutinsSujet.tsx";

const scrutins = `/sujets/${SLUG_EXEMPLE}/scrutins`;
const vide = {
  data: [],
  meta: { total: 0, page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrev: false },
};
const hrefFor = ({
  chambre,
  nature,
  page,
}: {
  chambre: ChambreSwitchValue;
  nature: string;
  page: number;
}) => `/f?chambre=${chambre}&nature=${nature}&page=${page}`;

describe("ScrutinsSujet : états", () => {
  it("annonce le chargement", () => {
    const visites: string[] = [];
    const { getAllByRole } = renderScreen(
      <ScrutinsSujet
        slug={SLUG_EXEMPLE}
        totalSujet={3}
        chambre=""
        nature=""
        page={1}
        hrefFor={hrefFor}
        navigate={(href) => visites.push(href)}
      />,
      { routes: { [scrutins]: () => new Promise(() => undefined) } },
    );
    expect(
      getAllByRole("status").some((s) => s.textContent?.includes("Chargement des scrutins")),
    ).toBe(true);
  });

  it("vide sans filtre : pas de description de filtre", async () => {
    const { findByText, queryByText, getByRole } = renderScreen(
      <ScrutinsSujet
        slug={SLUG_EXEMPLE}
        totalSujet={0}
        chambre=""
        nature=""
        page={1}
        hrefFor={hrefFor}
        navigate={() => undefined}
      />,
      { routes: { [scrutins]: vide } },
    );
    expect(await findByText("Aucun scrutin")).toBeInTheDocument();
    expect(queryByText("Aucun scrutin ne correspond à ces filtres.")).toBeNull();
    expect(getByRole("heading", { level: 2 })).toHaveTextContent("Scrutins (0)");
  });

  it("objet du vote choisi : compte filtré, désélection vers l'URL sans objet", async () => {
    const visites: string[] = [];
    const { findByText, getByRole, getByText } = renderScreen(
      <ScrutinsSujet
        slug={SLUG_EXEMPLE}
        totalSujet={5}
        chambre=""
        nature="article"
        page={2}
        hrefFor={hrefFor}
        navigate={(href) => visites.push(href)}
      />,
      { routes: { [scrutins]: vide } },
    );
    expect(await findByText("Aucun scrutin ne correspond à ces filtres.")).toBeInTheDocument();
    expect(getByRole("heading", { level: 2 })).toHaveTextContent("Scrutins (0 sur 5)");
    expect(getByText("1 objet de vote choisi", { selector: "[role=status]" })).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Tout désélectionner" }));
    expect(visites).toEqual(["/f?chambre=&nature=&page=1"]);
  });
});
