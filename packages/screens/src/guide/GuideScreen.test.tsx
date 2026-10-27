import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { GuideScreen } from "./GuideScreen.tsx";

describe("GuideScreen", () => {
  it("liste les cinq parcours et renvoie vers Comprendre", () => {
    const { getByRole, getAllByRole } = renderScreen(<GuideScreen />);
    expect(getByRole("heading", { level: 1 })).toHaveTextContent("Guide pratique");
    expect(getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Découvrir mon député",
      "Suivre un sujet",
      "Comparer des élus",
      "Comprendre le lobbying",
      "Décrypter un scrutin",
    ]);
    expect(getByRole("link", { name: "Suivre un sujet" })).toHaveAttribute(
      "href",
      "/guide/suivre-un-sujet",
    );
    expect(getByRole("link", { name: "Consultez nos pages pédagogiques" })).toHaveAttribute(
      "href",
      "/comprendre",
    );
  });
});
