import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { SkipLink } from "./SkipLink.tsx";

describe("SkipLink", () => {
  it("mène au contenu principal et prend le premier focus", async () => {
    const { getByRole } = renderWithProviders(<SkipLink />);
    await userEvent.tab();
    const link = getByRole("link", { name: "Aller au contenu" });
    expect(link).toHaveAttribute("href", "#contenu");
    expect(link).toHaveFocus();
  });
});
