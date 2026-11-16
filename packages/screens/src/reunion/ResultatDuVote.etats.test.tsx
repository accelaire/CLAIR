import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { seanceExemple } from "./fixtures.ts";
import { ResultatDuVote } from "./ResultatDuVote.tsx";

const [scrutin] = seanceExemple.scrutins ?? [];
if (!scrutin) throw new Error("fixture sans scrutin");

describe("ResultatDuVote", () => {
  it("écrit le décompte sans marquer un vote non suivi au sort inconnu", () => {
    const { getByRole, getByText, queryByText } = renderScreen(
      <ResultatDuVote scrutin={{ ...scrutin, sort: "sort d'exemple", nombreAbstention: 1 }} />,
    );
    expect(getByRole("link", { name: "Scrutin n° 42" })).not.toHaveAttribute("aria-current");
    expect(getByText(/79 pour · 84 contre · 1 abstention$/)).toBeInTheDocument();
    expect(queryByText("Le vote que vous consultiez")).toBeNull();
  });
});
