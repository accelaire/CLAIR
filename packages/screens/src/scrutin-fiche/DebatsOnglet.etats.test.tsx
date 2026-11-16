import { ApiError, type Query } from "@clair/api-client";
import type { InterventionsScrutinResponse } from "@clair/data";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { DebatsOnglet } from "./DebatsOnglet.tsx";
import { interventionExemple, interventionsExemple, scrutinDetailExemple } from "./fixtures.ts";
import { parseScrutinFicheParams, type ScrutinFicheParams } from "./params.ts";

const PATH = "/scrutins/101/interventions";

/** Réponse FICTIVE dérivée de la fixture. */
const reponse = (
  meta: Partial<InterventionsScrutinResponse["meta"]>,
  data = interventionsExemple.data,
): InterventionsScrutinResponse => ({ data, meta: { ...interventionsExemple.meta, ...meta } });

const rendre = (
  route: unknown,
  {
    params = {},
    scrutin = scrutinDetailExemple(),
  }: {
    params?: Partial<ScrutinFicheParams>;
    scrutin?: ReturnType<typeof scrutinDetailExemple>;
  } = {},
) => {
  const update = vi.fn();
  const rendu = renderScreen(
    <DebatsOnglet
      scrutin={scrutin}
      params={{ ...parseScrutinFicheParams({}), ...params }}
      update={update}
      hrefFor={(page) => `${PATH}?page=${page}`}
    />,
    { routes: { [PATH]: route } },
  );
  return { ...rendu, update };
};

describe("DebatsOnglet", () => {
  it("annonce le chargement des débats", () => {
    const { getByText } = rendre(() => new Promise(() => undefined));
    expect(getByText("Chargement des débats…")).toBeInTheDocument();
  });

  it("propose de réessayer quand les débats ne se chargent pas", async () => {
    const { findByText, getByRole } = rendre(() => Promise.reject(new ApiError(500, PATH)));
    expect(await findByText("Les débats n'ont pas pu être chargés.")).toBeInTheDocument();
    fireEvent.click(getByRole("button", { name: "Réessayer" }));
  });

  it("signale une recherche sans résultat", async () => {
    const { findByText } = rendre(reponse({ total: 0, parType: {} }, []), {
      params: { q: "zzz" },
    });
    expect(await findByText("Aucun résultat pour « zzz »")).toBeInTheDocument();
  });

  it("dit qu'il n'y a aucune prise de parole", async () => {
    const { findByText } = rendre(reponse({ total: 0, parType: {} }, []));
    expect(await findByText("Aucune prise de parole")).toBeInTheDocument();
  });

  it("avertit que les débats sont ceux de la journée", async () => {
    const { findByText } = rendre(reponse({ rattachement: "journee" }));
    expect(await findByText("Débats de la journée")).toBeInTheDocument();
  });

  it("dit la précision du rattachement (fenêtre, budget)", async () => {
    const fenetre = rendre(reponse({ precision: "fenetre" }));
    expect(
      await fenetre.findByText(/Voici le débat qui a précédé ce vote sur ce texte/),
    ).toBeInTheDocument();
    fenetre.unmount();
    const budget = rendre(reponse({ precision: "finances" }));
    expect(
      await budget.findByText(/Voici la discussion de la partie du budget/),
    ).toBeInTheDocument();
  });

  it("ne dit rien du rattachement quand l'API ne le donne pas", async () => {
    const { findByText, queryByText } = rendre(reponse({ rattachement: undefined }));
    expect(await findByText(/cette prise de parole est inventée/)).toBeInTheDocument();
    expect(queryByText(/extraites de la séance/)).toBeNull();
  });

  it("lie la séance et le compte rendu officiel du Sénat", async () => {
    const { findByRole, getByRole } = rendre(
      reponse({}, [
        { ...interventionExemple, sourceUrl: "https://www.senat.fr/cr/s1.html#par_12" },
      ]),
      { scrutin: scrutinDetailExemple({ chambre: "senat", seance: { uid: "SEANCE1", rang: 2 } }) },
    );
    expect(await findByRole("link", { name: "Voir le débat complet" })).toHaveAttribute(
      "href",
      "/reunions/SEANCE1?vote=scrutin-exemple-1&rang=2",
    );
    expect(getByRole("link", { name: "Lire ce passage dans toute la séance" })).toBeInTheDocument();
    expect(getByRole("link", { name: /Compte rendu officiel sur senat\.fr/ })).toHaveAttribute(
      "href",
      "https://www.senat.fr/cr/s1.html",
    );
  });

  it("lie le compte rendu de l'Assemblée sans séance sur le site", async () => {
    const { findByRole, queryByRole } = rendre(
      reponse({}, [{ ...interventionExemple, sourceUrl: "https://www.assemblee.test/cr#par_3" }]),
    );
    expect(
      await findByRole("link", { name: /Compte rendu officiel sur assemblee-nationale\.fr/ }),
    ).toBeInTheDocument();
    expect(queryByRole("link", { name: "Lire ce passage dans toute la séance" })).toBeNull();
  });

  it("met les explications de vote devant et filtre par nature dans l'URL", async () => {
    const types: unknown[] = [];
    const { findByRole, update } = rendre((query: Query) => {
      types.push(query.type);
      return reponse({ parType: { explication_vote: 2, intervention: 3 } });
    });
    const select = await findByRole("combobox", { name: "Nature des prises de parole" });
    await waitFor(() => expect(types).toContain("explication_vote"));
    expect(select).toHaveValue("explication_vote");
    expect(
      await findByRole("option", { name: "Toutes les prises de parole (5)" }),
    ).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "intervention" } });
    expect(update).toHaveBeenCalledWith({ nature: "intervention", page: 1 });
    fireEvent.change(select, { target: { value: "toutes" } });
    expect(update).toHaveBeenCalledWith({ nature: "toutes", page: 1 });
  });

  it("garde toutes les natures quand le lecteur l'a choisi", async () => {
    const { findByRole } = rendre(reponse({ parType: { explication_vote: 2, intervention: 3 } }), {
      params: { nature: "toutes" },
    });
    expect(await findByRole("combobox", { name: "Nature des prises de parole" })).toHaveValue(
      "toutes",
    );
  });

  it("garde une nature choisie dans l'URL", async () => {
    const { findByRole } = rendre(reponse({ parType: { question: 1, intervention: 3 } }), {
      params: { nature: "question" },
    });
    expect(await findByRole("combobox", { name: "Nature des prises de parole" })).toHaveValue(
      "question",
    );
  });
});
