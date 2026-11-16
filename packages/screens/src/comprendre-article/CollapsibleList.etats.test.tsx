import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../test-utils.tsx";
import { CollapsibleList } from "./CollapsibleList.tsx";

describe("CollapsibleList : cas limites", () => {
  it("sans élément caché, n'affiche pas de bouton", () => {
    const { getAllByRole, queryByRole } = renderScreen(
      <CollapsibleList visible={3} moreLabel="Voir les autres" columns={1}>
        <li>Un</li>
        <li>Deux</li>
      </CollapsibleList>,
    );
    expect(getAllByRole("listitem")).toHaveLength(2);
    expect(queryByRole("button")).toBeNull();
  });

  it("déplie puis replie les éléments cachés", () => {
    const { getAllByRole, getByRole } = renderScreen(
      <CollapsibleList visible={1} moreLabel="Voir les autres" columns={2}>
        <li>Un</li>
        <li>Deux</li>
      </CollapsibleList>,
    );
    expect(getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(getByRole("button", { name: "Voir les autres" }));
    expect(getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(getByRole("button", { name: "Masquer" }));
    expect(getAllByRole("listitem")).toHaveLength(1);
  });
});
