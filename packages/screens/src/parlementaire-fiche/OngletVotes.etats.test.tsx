import type { PageVotes, VoteDuParlementaire } from "@clair/data";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { page, votesExemple } from "./fixtures.ts";
import { OngletVotes } from "./OngletVotes.tsx";
import { parseParlementaireFicheParams } from "./params.ts";

// Votes FICTIFS dérivés du vote d'exemple.
const [base] = votesExemple.data;
if (!base) throw new Error("fixture sans vote");

const vote = (id: string, partiel: Partial<VoteDuParlementaire>, sort = base.scrutin.sort) => ({
  ...base,
  id,
  ...partiel,
  scrutin: { ...base.scrutin, id: `scrutin-${id}`, titre: `scrutin fictif ${id}`, sort },
});

const rendre = (reponse: PageVotes) =>
  renderScreen(
    <OngletVotes
      chemin="/senateurs"
      slug="alex-fictif"
      filtres={{ ...parseParlementaireFicheParams({}), dateFrom: "2026-01-01" }}
      changer={() => undefined}
      pageHref={(n) => `?page=${n}`}
    />,
    { routes: { "/senateurs/alex-fictif/votes": reponse } },
  );

describe("OngletVotes, variantes", () => {
  it("écrit une position inconnue, un sort inconnu et les deux premières thématiques", async () => {
    rendre(
      page([
        {
          ...vote("a", { position: "inconnue", groupePosition: null }, "en suspens"),
          scrutin: {
            ...base.scrutin,
            id: "scrutin-a",
            titre: "scrutin fictif a",
            sort: "en suspens",
            tags: ["santé", "budget", "école"],
          },
        },
      ]),
    );
    expect(await screen.findByText("inconnue")).toBeInTheDocument();
    expect(screen.getByText("en suspens")).toBeInTheDocument();
    expect(screen.getByText(/Santé, Budget/)).toBeInTheDocument();
    expect(screen.queryByText(/École/)).toBeNull();
    expect(screen.queryByText(/Vote différent/)).toBeNull();
  });

  it("ne signale pas un absent ni un vote conforme au groupe", async () => {
    rendre(
      page([
        vote("b", { position: "absent", groupePosition: "pour" }),
        vote("c", { position: "pour", groupePosition: "pour" }),
      ]),
    );
    expect(await screen.findByText("Scrutin fictif b")).toBeInTheDocument();
    expect(screen.queryByText(/Vote différent/)).toBeNull();
  });
});
