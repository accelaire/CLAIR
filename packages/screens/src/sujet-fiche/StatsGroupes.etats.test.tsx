import { ApiError } from "@clair/api-client";
import type { SujetStatsGroupe } from "@clair/data";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { dossiersExemple, SLUG_EXEMPLE, statsExemple } from "./fixtures.ts";
import { StatsGroupes } from "./StatsGroupes.tsx";

const stats = `/sujets/${SLUG_EXEMPLE}/stats`;

// Groupes fictifs.
const groupe = (
  nom: string,
  chambre: SujetStatsGroupe["chambre"],
  pour: number,
  amendements: number,
): SujetStatsGroupe => ({
  nom,
  slug: nom.toLowerCase(),
  couleur: null,
  chambre,
  votes: { pour, contre: 0, abstention: 0, absent: 0 },
  amendements,
});

const groupes = [
  groupe("EXC", "senat", 1, 0),
  groupe("EXA", "assemblee", 50, 1),
  groupe("EXB", "senat", 30, 2),
  groupe("EXD", "assemblee", 10, 0),
];

const ordre = (texte: string) => (texte.match(/EX[A-Z0-9]/g) ?? []).join(",");

describe("StatsGroupes : états", () => {
  it("annonce le chargement", () => {
    const { getByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="amendements"
        onChange={vi.fn()}
      />,
      { routes: { [stats]: () => new Promise(() => undefined) } },
    );
    expect(getByRole("status")).toHaveTextContent("Chargement des groupes");
  });

  it("signale une erreur récupérable", async () => {
    const { findByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="amendements"
        onChange={vi.fn()}
      />,
      {
        routes: {
          [stats]: () => {
            throw new ApiError(500, stats);
          },
        },
      },
    );
    expect(await findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("état vide quand aucun groupe de la chambre choisie", async () => {
    const { findByText, queryByText } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre="senat"
        tri="amendements"
        onChange={vi.fn()}
      />,
      {
        routes: {
          [stats]: { data: [groupe("EXA", "assemblee", 1, 0)], groupeAmendementDescriptions: {} },
        },
      },
    );
    expect(await findByText("Aucune statistique disponible")).toBeInTheDocument();
    expect(queryByText(/Positions des groupes/)).toBeNull();
  });

  it("trie par votes", async () => {
    const { findByRole } = renderScreen(
      <StatsGroupes slug={SLUG_EXEMPLE} dossiers={[]} chambre="" tri="votes" onChange={vi.fn()} />,
      { routes: { [stats]: { data: groupes, groupeAmendementDescriptions: {} } } },
    );
    const liste = await findByRole("list");
    expect(ordre(liste.textContent ?? "")).toBe("EXA,EXB,EXD,EXC");
  });

  it("trie par chambre puis par nom", async () => {
    const { findByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="chambre"
        onChange={vi.fn()}
      />,
      { routes: { [stats]: { data: groupes, groupeAmendementDescriptions: {} } } },
    );
    const liste = await findByRole("list");
    expect(ordre(liste.textContent ?? "")).toBe("EXA,EXD,EXB,EXC");
  });

  it("sans dossier, les amendements ne sont pas liés ; dossier de l'autre chambre sinon", async () => {
    const [an] = dossiersExemple.data;
    if (!an) throw new Error("fixtures incomplètes");
    const sansDossier = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="amendements"
        onChange={vi.fn()}
      />,
      { routes: { [stats]: { data: groupes, groupeAmendementDescriptions: {} } } },
    );
    expect(await sansDossier.findByText("2 amendements")).toBeInTheDocument();
    expect(sansDossier.getByText("1 amendement")).toBeInTheDocument();
    expect(sansDossier.queryByRole("link", { name: /amendement/ })).toBeNull();
    sansDossier.unmount();

    const { findByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[an]}
        chambre=""
        tri="amendements"
        onChange={vi.fn()}
      />,
      { routes: { [stats]: { data: groupes, groupeAmendementDescriptions: {} } } },
    );
    expect(await findByRole("link", { name: /2 amendements/ })).toHaveAttribute(
      "href",
      `/dossiers/${an.uid}?groupe=exb&tab=amendements`,
    );
  });

  it("un seul groupe caché : libellé au singulier, puis réduire", async () => {
    const sept = Array.from({ length: 7 }, (_, i) => groupe(`EX${i}`, "assemblee", 1, 0));
    const { findByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="amendements"
        onChange={vi.fn()}
      />,
      { routes: { [stats]: { data: sept, groupeAmendementDescriptions: {} } } },
    );
    const bouton = await findByRole("button", { name: "Afficher l'autre groupe" });
    fireEvent.click(bouton);
    expect(bouton).toHaveTextContent("Réduire la liste des groupes");
  });

  it("transmet le choix de chambre et de tri", async () => {
    const onChange = vi.fn();
    const { findByRole, getByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="amendements"
        onChange={onChange}
      />,
      { routes: { [stats]: statsExemple } },
    );
    fireEvent.click(getByRole("radio", { name: "Sénat" }));
    expect(onChange).toHaveBeenCalledWith({ groupes: "senat", tri: "amendements" });
    fireEvent.change(await findByRole("combobox", { name: "Trier les groupes" }), {
      target: { value: "chambre" },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ groupes: "", tri: "chambre" }));
  });

  it("un seul groupe caché : libellé correct au singulier", async () => {
    const sept = Array.from({ length: 7 }, (_, i) => groupe(`EX${i}`, "assemblee", 1, 0));
    const { findByRole } = renderScreen(
      <StatsGroupes
        slug={SLUG_EXEMPLE}
        dossiers={[]}
        chambre=""
        tri="amendements"
        onChange={vi.fn()}
      />,
      { routes: { [stats]: { data: sept, groupeAmendementDescriptions: {} } } },
    );
    expect(await findByRole("button", { name: "Afficher l'autre groupe" })).toBeInTheDocument();
  });
});
